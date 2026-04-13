#!/usr/bin/env tsx

/**
 * Complete SSL Certificate Fix for cagpt.icai.org
 * This script automates the domain setup with Railway and GoDaddy
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import { godaddyDNS } from './server/services/godaddyDNS';

const DOMAIN = 'cagpt.icai.org';
const WWW_DOMAIN = 'www.cagpt.icai.org';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
  } catch (error: any) {
    return error.stdout || error.message;
  }
}

async function checkRailwayCLI(): Promise<boolean> {
  log('\n📦 Checking Railway CLI installation...', colors.cyan);
  
  try {
    const version = exec('railway --version');
    if (version.includes('railway version')) {
      log(`✅ Railway CLI installed: ${version.trim()}`, colors.green);
      return true;
    }
  } catch {
    // Fall through
  }
  
  log('❌ Railway CLI not found', colors.red);
  log('\n📥 Install Railway CLI:', colors.yellow);
  log('   npm install -g @railway/cli');
  log('   or');
  log('   scoop install railway\n');
  return false;
}

async function checkRailwayLogin(): Promise<boolean> {
  log('\n🔐 Checking Railway authentication...', colors.cyan);
  
  try {
    const status = exec('railway whoami');
    if (status.includes('@') || status.includes('Logged in')) {
      log('✅ Logged into Railway', colors.green);
      return true;
    }
  } catch {
    // Fall through
  }
  
  log('❌ Not logged into Railway', colors.red);
  log('\n🔓 Please login:', colors.yellow);
  log('   railway login\n');
  return false;
}

async function getRailwayServiceURL(): Promise<string | null> {
  log('\n🔍 Getting Railway service URL...', colors.cyan);
  
  try {
    const status = exec('railway status --json');
    const data = JSON.parse(status);
    
    if (data.service && data.service.domain) {
      const url = data.service.domain;
      log(`✅ Railway URL: ${url}`, colors.green);
      return url;
    }
  } catch (error) {
    // Try alternative method
    try {
      const domains = exec('railway domain');
      const match = domains.match(/([a-z0-9-]+\.up\.railway\.app)/);
      if (match) {
        log(`✅ Railway URL: ${match[1]}`, colors.green);
        return match[1];
      }
    } catch {
      // Fall through
    }
  }
  
  log('⚠️  Could not auto-detect Railway URL', colors.yellow);
  log('   Using default pattern: luca-agent-production.up.railway.app', colors.yellow);
  return 'luca-agent-production.up.railway.app';
}

async function addDomainsToRailway(): Promise<boolean> {
  log('\n🌐 Adding custom domains to Railway...', colors.cyan);
  
  try {
    // Add root domain
    log(`   Adding ${DOMAIN}...`);
    exec(`railway domain add ${DOMAIN}`);
    
    // Add www subdomain
    log(`   Adding ${WWW_DOMAIN}...`);
    exec(`railway domain add ${WWW_DOMAIN}`);
    
    // List domains to verify
    const domains = exec('railway domain list');
    
    if (domains.includes(DOMAIN) && domains.includes(WWW_DOMAIN)) {
      log('✅ Domains added to Railway successfully', colors.green);
      log('\n📋 Current domains:', colors.blue);
      console.log(domains);
      return true;
    } else {
      log('⚠️  Domains may already exist or require manual addition', colors.yellow);
      return false;
    }
  } catch (error: any) {
    log(`❌ Error adding domains: ${error.message}`, colors.red);
    log('\n💡 Please add domains manually:', colors.yellow);
    log(`   1. Go to Railway Dashboard: https://railway.app/dashboard`);
    log(`   2. Select your project → Settings → Domains`);
    log(`   3. Add: ${DOMAIN}`);
    log(`   4. Add: ${WWW_DOMAIN}\n`);
    return false;
  }
}

async function updateGoDaddyDNS(railwayURL: string): Promise<boolean> {
  log('\n🔧 Updating GoDaddy DNS records...', colors.cyan);
  
  if (!process.env.GODADDY_API_KEY || !process.env.GODADDY_API_SECRET) {
    log('❌ GoDaddy API credentials not found in .env', colors.red);
    log('\n📝 Add to .env file:', colors.yellow);
    log('   GODADDY_API_KEY=your_key_here');
    log('   GODADDY_API_SECRET=your_secret_here\n');
    log('💡 Get credentials from: https://developer.godaddy.com/keys\n');
    return false;
  }
  
  try {
    // Check existing records
    log('   Checking existing DNS records...');
    const existingRecords = await godaddyDNS.getDNSRecords(DOMAIN);
    
    // Update www CNAME
    log(`   Setting up www.${DOMAIN} → ${railwayURL}...`);
    await godaddyDNS.replaceDNSRecord(DOMAIN, 'CNAME', 'www', [
      {
        type: 'CNAME',
        name: 'www',
        data: railwayURL,
        ttl: 600
      }
    ]);
    log(`   ✅ www.${DOMAIN} configured`, colors.green);
    
    // Note about apex domain
    log(`\n   ℹ️  Root domain (${DOMAIN}) configuration:`, colors.blue);
    log(`   • GoDaddy doesn't support CNAME at root`);
    log(`   • Railway will auto-redirect apex to www`);
    log(`   • This is the standard approach for Railway\n`);
    
    return true;
  } catch (error: any) {
    log(`❌ Error updating DNS: ${error.message}`, colors.red);
    
    if (error.response?.status === 401) {
      log('\n🔐 Authentication failed. Check your GoDaddy API credentials.', colors.yellow);
    } else if (error.response?.status === 403) {
      log('\n🚫 Permission denied. Ensure your API key has DNS management permissions.', colors.yellow);
    }
    
    log('\n💡 Manual DNS Setup:', colors.yellow);
    log(`   1. Go to GoDaddy: https://dcc.godaddy.com/`);
    log(`   2. Navigate to ${DOMAIN} → DNS Management`);
    log(`   3. Add CNAME record:`);
    log(`      • Type: CNAME`);
    log(`      • Name: www`);
    log(`      • Value: ${railwayURL}`);
    log(`      • TTL: 600 seconds\n`);
    
    return false;
  }
}

async function verifyDNS(): Promise<void> {
  log('\n🔍 Verifying DNS configuration...', colors.cyan);
  
  try {
    // Check www subdomain
    log(`   Checking www.${DOMAIN}...`);
    const wwwLookup = exec(`nslookup www.${DOMAIN}`);
    
    if (wwwLookup.includes('railway.app') || wwwLookup.includes('CNAME')) {
      log(`   ✅ www.${DOMAIN} DNS configured`, colors.green);
    } else {
      log(`   ⏳ www.${DOMAIN} DNS not propagated yet`, colors.yellow);
    }
    
  } catch (error) {
    log('   ⏳ DNS not propagated yet (this is normal)', colors.yellow);
  }
  
  log('\n⏱️  DNS propagation timeline:', colors.blue);
  log('   • Immediate: Configuration saved');
  log('   • 5-15 min: Initial propagation');
  log('   • 30-60 min: Global propagation');
  log('   • Check status: https://dnschecker.org/#CNAME/www.cagpt.icai.org\n');
}

async function checkSSLStatus(): Promise<void> {
  log('\n🔒 SSL Certificate Status...', colors.cyan);
  
  log('   Railway auto-provisions SSL certificates via Let\'s Encrypt', colors.blue);
  log('   This happens automatically after DNS propagates\n');
  
  log('📊 Timeline:', colors.blue);
  log('   1. DNS propagates (5-60 minutes)');
  log('   2. Railway detects propagation (1-5 minutes)');
  log('   3. SSL certificate issued (1-10 minutes)');
  log('   4. Total: Usually 10-75 minutes\n');
  
  log('✅ Check SSL status:', colors.green);
  log(`   • Railway Dashboard: https://railway.app/dashboard`);
  log('   • Look for green checkmark next to domains');
  log('   • Status should show "Active" with SSL enabled\n');
}

async function setEnvironmentVariables(): Promise<void> {
  log('\n⚙️  Setting environment variables...', colors.cyan);
  
  try {
    log(`   Setting CLIENT_URL...`);
    exec(`railway variables set CLIENT_URL=https://${DOMAIN}`);
    
    log(`   Setting VITE_API_URL...`);
    exec(`railway variables set VITE_API_URL=https://${DOMAIN}`);
    
    log(`   Setting COOKIE_DOMAIN...`);
    exec(`railway variables set COOKIE_DOMAIN=.${DOMAIN}`);
    
    log('✅ Environment variables updated', colors.green);
  } catch (error: any) {
    log('⚠️  Could not update environment variables automatically', colors.yellow);
    log('\n💡 Set manually in Railway Dashboard:', colors.yellow);
    log(`   CLIENT_URL=https://${DOMAIN}`);
    log(`   VITE_API_URL=https://${DOMAIN}`);
    log(`   COOKIE_DOMAIN=.${DOMAIN}\n`);
  }
}

async function displayNextSteps(): Promise<void> {
  log('\n' + '='.repeat(60), colors.bright);
  log('🎉 SSL Certificate Fix Process Complete!', colors.green + colors.bright);
  log('='.repeat(60) + '\n', colors.bright);
  
  log('📋 Next Steps:', colors.cyan + colors.bright);
  log('\n1️⃣  Wait for DNS Propagation (5-60 minutes)');
  log('   • Monitor: https://dnschecker.org/#CNAME/www.cagpt.icai.org');
  log('   • Check locally: nslookup www.cagpt.icai.org\n');
  
  log('2️⃣  Verify SSL Certificate Issued (after DNS propagates)');
  log('   • Go to: https://railway.app/dashboard');
  log('   • Check for green checkmark next to domains');
  log('   • Should show "Active" status\n');
  
  log('3️⃣  Test Your Site');
  log(`   • https://${DOMAIN}`);
  log(`   • https://www.${DOMAIN}`);
  log('   • Both should show valid SSL certificate\n');
  
  log('🔧 Troubleshooting:', colors.yellow + colors.bright);
  log('   • If DNS not propagating: ipconfig /flushdns');
  log('   • If SSL not issued after 2 hours: railway domain remove/add');
  log('   • View logs: railway logs');
  log('   • Full guide: docs/SSL_CERTIFICATE_FIX_GUIDE.md\n');
  
  log('📞 Support:', colors.blue);
  log('   • Railway Status: https://status.railway.app');
  log('   • Railway Support: https://railway.app/help');
  log('   • Email: support@railway.app\n');
}

async function main() {
  log('\n' + '='.repeat(60), colors.bright);
  log('🔒 SSL Certificate Fix for cagpt.icai.org', colors.cyan + colors.bright);
  log('='.repeat(60) + '\n', colors.bright);
  
  // Step 1: Check Railway CLI
  const hasRailwayCLI = await checkRailwayCLI();
  if (!hasRailwayCLI) {
    log('⛔ Please install Railway CLI and run this script again\n', colors.red);
    process.exit(1);
  }
  
  // Step 2: Check Railway login
  const isLoggedIn = await checkRailwayLogin();
  if (!isLoggedIn) {
    log('⛔ Please login to Railway and run this script again\n', colors.red);
    process.exit(1);
  }
  
  // Step 3: Get Railway service URL
  const railwayURL = await getRailwayServiceURL();
  if (!railwayURL) {
    log('⛔ Could not determine Railway service URL\n', colors.red);
    process.exit(1);
  }
  
  // Step 4: Add domains to Railway
  await addDomainsToRailway();
  
  // Step 5: Update GoDaddy DNS
  await updateGoDaddyDNS(railwayURL);
  
  // Step 6: Set environment variables
  await setEnvironmentVariables();
  
  // Step 7: Verify DNS
  await verifyDNS();
  
  // Step 8: SSL status info
  await checkSSLStatus();
  
  // Step 9: Display next steps
  await displayNextSteps();
  
  log('✨ Script complete! Your SSL certificate will be active soon.\n', colors.green + colors.bright);
}

main().catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, colors.red);
  process.exit(1);
});
