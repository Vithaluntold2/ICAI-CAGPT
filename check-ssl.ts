#!/usr/bin/env tsx

/**
 * Check current SSL/DNS configuration status
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import https from 'https';
import dns from 'dns/promises';

const DOMAIN = 'cagpt.icai.org';
const WWW_DOMAIN = 'www.cagpt.icai.org';

function exec(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
  } catch (error: any) {
    return error.stdout || error.message || '';
  }
}

async function checkDNS(domain: string): Promise<void> {
  console.log(`\n🔍 DNS Check: ${domain}`);
  console.log('─'.repeat(50));
  
  try {
    // Check CNAME
    const cname = await dns.resolveCname(domain);
    console.log('✅ CNAME Record:', cname.join(', '));
    
    if (cname.some(c => c.includes('railway.app'))) {
      console.log('   ✓ Points to Railway');
    } else {
      console.log('   ⚠️  Does not point to Railway');
    }
  } catch (error: any) {
    console.log('❌ CNAME:', error.code);
    
    // Try A record
    try {
      const addresses = await dns.resolve4(domain);
      console.log('   A Record:', addresses.join(', '));
    } catch (aError: any) {
      console.log('   A Record:', aError.code);
    }
  }
}

async function checkSSL(domain: string): Promise<void> {
  console.log(`\n🔒 SSL Check: ${domain}`);
  console.log('─'.repeat(50));
  
  return new Promise((resolve) => {
    const options = {
      hostname: domain,
      port: 443,
      method: 'HEAD',
      rejectUnauthorized: true,
      timeout: 10000
    };
    
    const req = https.request(options, (res) => {
      const cert = (res.socket as any).getPeerCertificate();
      
      if (cert && Object.keys(cert).length > 0) {
        console.log('✅ SSL Certificate Found');
        console.log(`   Subject: ${cert.subject.CN}`);
        console.log(`   Issuer: ${cert.issuer.O}`);
        console.log(`   Valid From: ${cert.valid_from}`);
        console.log(`   Valid To: ${cert.valid_to}`);
        
        const now = new Date();
        const validTo = new Date(cert.valid_to);
        const daysLeft = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   Days Until Expiry: ${daysLeft}`);
        
        if (cert.subject.CN === domain || cert.subjectaltname?.includes(domain)) {
          console.log('   ✓ Certificate matches domain');
        } else {
          console.log('   ⚠️  Certificate domain mismatch');
          console.log(`   Expected: ${domain}`);
          console.log(`   Got: ${cert.subject.CN}`);
        }
      } else {
        console.log('❌ No certificate found');
      }
      
      resolve();
    });
    
    req.on('error', (error: any) => {
      console.log('❌ SSL Error:', error.message);
      
      if (error.code === 'ENOTFOUND') {
        console.log('   → Domain not found in DNS');
      } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        console.log('   → Certificate verification failed');
      } else if (error.code === 'CERT_HAS_EXPIRED') {
        console.log('   → Certificate has expired');
      }
      
      resolve();
    });
    
    req.on('timeout', () => {
      console.log('❌ Request timed out');
      req.destroy();
      resolve();
    });
    
    req.end();
  });
}

async function checkRailway(): Promise<void> {
  console.log(`\n🚂 Railway Configuration`);
  console.log('─'.repeat(50));
  
  try {
    const whoami = exec('railway whoami');
    if (whoami.includes('@')) {
      console.log('✅ Logged into Railway');
    } else {
      console.log('❌ Not logged into Railway');
      console.log('   Run: railway login');
    }
    
    const status = exec('railway status');
    console.log('Project Status:', status.trim() || 'Unknown');
    
    const domains = exec('railway domain list');
    if (domains) {
      console.log('\n📋 Configured Domains:');
      console.log(domains);
      
      if (domains.includes(DOMAIN)) {
        console.log(`   ✓ ${DOMAIN} configured`);
      } else {
        console.log(`   ✗ ${DOMAIN} not configured`);
      }
      
      if (domains.includes(WWW_DOMAIN)) {
        console.log(`   ✓ ${WWW_DOMAIN} configured`);
      } else {
        console.log(`   ✗ ${WWW_DOMAIN} not configured`);
      }
    }
  } catch (error: any) {
    console.log('❌ Railway CLI not available');
    console.log('   Install: npm install -g @railway/cli');
  }
}

async function checkGoDaddy(): Promise<void> {
  console.log(`\n🌐 GoDaddy Configuration`);
  console.log('─'.repeat(50));
  
  if (!process.env.GODADDY_API_KEY || !process.env.GODADDY_API_SECRET) {
    console.log('❌ GoDaddy API credentials not configured');
    console.log('   Set in .env:');
    console.log('   GODADDY_API_KEY=your_key');
    console.log('   GODADDY_API_SECRET=your_secret');
    return;
  }
  
  try {
    const { godaddyDNS } = await import('./server/services/godaddyDNS');
    const records = await godaddyDNS.getDNSRecords(DOMAIN);
    
    console.log('✅ Connected to GoDaddy API');
    console.log(`\n📋 DNS Records for ${DOMAIN}:`);
    
    const cnameRecords = records.filter((r: any) => r.type === 'CNAME');
    const aRecords = records.filter((r: any) => r.type === 'A');
    
    if (cnameRecords.length > 0) {
      console.log('\n   CNAME Records:');
      cnameRecords.forEach((r: any) => {
        console.log(`   • ${r.name || '@'} → ${r.data} (TTL: ${r.ttl}s)`);
        if (r.data.includes('railway.app')) {
          console.log('     ✓ Points to Railway');
        }
      });
    }
    
    if (aRecords.length > 0) {
      console.log('\n   A Records:');
      aRecords.forEach((r: any) => {
        console.log(`   • ${r.name || '@'} → ${r.data} (TTL: ${r.ttl}s)`);
      });
    }
  } catch (error: any) {
    console.log('❌ GoDaddy API Error:', error.message);
  }
}

async function runDiagnostics(): Promise<void> {
  console.log('\n' + '═'.repeat(60));
  console.log('🔧 SSL/DNS Diagnostics for cagpt.icai.org');
  console.log('═'.repeat(60));
  
  await checkRailway();
  await checkGoDaddy();
  await checkDNS(WWW_DOMAIN);
  await checkDNS(DOMAIN);
  await checkSSL(WWW_DOMAIN);
  await checkSSL(DOMAIN);
  
  console.log('\n' + '═'.repeat(60));
  console.log('🎯 Summary & Recommendations');
  console.log('═'.repeat(60));
  
  console.log('\n📝 Next Steps:');
  console.log('   1. If DNS not pointing to Railway:');
  console.log('      → Run: npm run fix:ssl');
  console.log('');
  console.log('   2. If DNS correct but no SSL:');
  console.log('      → Wait 30-60 minutes for certificate');
  console.log('      → Check Railway dashboard for SSL status');
  console.log('');
  console.log('   3. If certificate domain mismatch:');
  console.log('      → Ensure domain added to Railway');
  console.log('      → Run: railway domain add cagpt.icai.org');
  console.log('');
  console.log('📖 Full Guide: docs/SSL_CERTIFICATE_FIX_GUIDE.md');
  console.log('🚀 Quick Fix: docs/QUICK_SSL_FIX.md\n');
}

runDiagnostics().catch(console.error);
