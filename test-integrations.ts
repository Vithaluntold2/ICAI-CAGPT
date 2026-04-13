#!/usr/bin/env tsx

/**
 * Railway & GoDaddy Integration Test Script
 * 
 * Tests:
 * - GoDaddy API connection
 * - Lists domains
 * - Shows DNS records
 * - Railway CLI connectivity
 */

import 'dotenv/config';
import { godaddyDNS } from './server/services/godaddyDNS';

async function main() {
  console.log('🚀 ICAI CAGPT - Railway & GoDaddy Integration Test\n');
  
  // Test GoDaddy API
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📡 Testing GoDaddy API Connection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const connected = await godaddyDNS.testConnection();
    
    if (connected) {
      // List domains
      console.log('\n📋 Listing your domains:\n');
      const domains = await godaddyDNS.listDomains();
      
      if (domains.length === 0) {
        console.log('   No domains found in this GoDaddy account.');
      } else {
        domains.forEach(domain => {
          console.log(`   • ${domain.domain}`);
          console.log(`     Status: ${domain.status}`);
          console.log(`     Expires: ${domain.expires}`);
          console.log(`     Name Servers: ${domain.nameServers?.join(', ') || 'N/A'}\n`);
        });
        
        // Show DNS records for first domain
        if (domains.length > 0) {
          const firstDomain = domains[0].domain;
          console.log(`\n🌐 DNS Records for ${firstDomain}:\n`);
          
          try {
            const records = await godaddyDNS.getDNSRecords(firstDomain);
            
            if (records.length === 0) {
              console.log('   No DNS records found.');
            } else {
              // Group by type
              const groupedRecords: Record<string, typeof records> = {};
              records.forEach(record => {
                if (!groupedRecords[record.type]) {
                  groupedRecords[record.type] = [];
                }
                groupedRecords[record.type].push(record);
              });
              
              Object.entries(groupedRecords).forEach(([type, typeRecords]) => {
                console.log(`   ${type} Records:`);
                typeRecords.forEach(record => {
                  console.log(`     • ${record.name || '@'} → ${record.data} (TTL: ${record.ttl || 'N/A'})`);
                });
                console.log();
              });
            }
          } catch (error: any) {
            console.log(`   ⚠️  Could not fetch DNS records: ${error.message}`);
          }
        }
      }
      
      console.log('✅ GoDaddy API integration successful!\n');
    } else {
      console.log('❌ GoDaddy API connection failed. Check your credentials in .env\n');
    }
  } catch (error: any) {
    console.error('❌ GoDaddy API Error:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Check GODADDY_API_KEY in .env');
    console.log('2. Check GODADDY_API_SECRET in .env');
    console.log('3. Verify API keys are valid at https://developer.godaddy.com/keys\n');
  }
  
  // Railway CLI info
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚂 Railway CLI Information');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('To connect to Railway:');
  console.log('1. Visit: https://railway.com/cli-login');
  console.log('2. Login with your Railway account');
  console.log('3. Run: railway link');
  console.log('4. Run: railway up (to deploy)\n');
  
  console.log('Common Railway commands:');
  console.log('  railway login       - Login to Railway');
  console.log('  railway init        - Initialize new project');
  console.log('  railway link        - Link to existing project');
  console.log('  railway up          - Deploy current directory');
  console.log('  railway status      - Check deployment status');
  console.log('  railway logs        - View application logs');
  console.log('  railway open        - Open project in browser');
  console.log('  railway variables   - Manage environment variables');
  console.log('  railway domain      - Manage custom domains\n');
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔗 Quick Setup Guide');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('To setup custom domain with GoDaddy + Railway:\n');
  console.log('1. Deploy to Railway:');
  console.log('   railway up\n');
  console.log('2. Get Railway deployment URL:');
  console.log('   railway status\n');
  console.log('3. Setup DNS with GoDaddy (programmatically):');
  console.log('   // In your code:');
  console.log('   await godaddyDNS.setupRailwaySubdomain(');
  console.log('     "yourdomain.com",');
  console.log('     "app",  // subdomain');
  console.log('     "your-project.up.railway.app"');
  console.log('   );\n');
  console.log('4. Configure custom domain in Railway:');
  console.log('   railway domain\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
