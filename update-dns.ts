#!/usr/bin/env tsx

import 'dotenv/config';
import { godaddyDNS } from './server/services/godaddyDNS';

async function updateDNS() {
  console.log('🔄 Updating DNS records for cagpt.icai.org → Railway...\n');
  
  const DOMAIN = 'cagpt.icai.org';
  const RAILWAY_URL = 'luca-agent-production.up.railway.app';
  
  try {
    // First, let's see existing records
    console.log('📋 Current DNS records for', DOMAIN + ':\n');
    const existingRecords = await godaddyDNS.getDNSRecords(DOMAIN);
    
    const cnameRecords = existingRecords.filter((r: any) => r.type === 'CNAME');
    const aRecords = existingRecords.filter((r: any) => r.type === 'A');
    
    if (cnameRecords.length > 0) {
      console.log('   CNAME Records:');
      cnameRecords.forEach((r: any) => console.log(`     • ${r.name} → ${r.data}`));
    }
    if (aRecords.length > 0) {
      console.log('   A Records:');
      aRecords.forEach((r: any) => console.log(`     • ${r.name} → ${r.data}`));
    }
    console.log('');
    
    // Update www CNAME to Railway
    console.log('🔧 Setting up www subdomain...');
    await godaddyDNS.replaceDNSRecord(DOMAIN, 'CNAME', 'www', [
      {
        type: 'CNAME',
        name: 'www',
        data: RAILWAY_URL,
        ttl: 600
      }
    ]);
    console.log(`   ✅ www.${DOMAIN} → ${RAILWAY_URL}`);
    
    // Update root domain CNAME (for apex domain - some registrars support this)
    // Note: GoDaddy may not support CNAME at apex, use A record instead if needed
    console.log('\n🔧 Setting up root domain...');
    try {
      // Try CNAME first (some providers support ALIAS/ANAME)
      await godaddyDNS.replaceDNSRecord(DOMAIN, 'CNAME', '@', [
        {
          type: 'CNAME',
          name: '@',
          data: RAILWAY_URL,
          ttl: 600
        }
      ]);
      console.log(`   ✅ ${DOMAIN} → ${RAILWAY_URL} (CNAME)`);
    } catch (error: any) {
      console.log(`   ⚠️  CNAME at root not supported, this is normal for GoDaddy`);
      console.log(`   💡 For apex domain (${DOMAIN}), you may need to:`);
      console.log(`      1. Use Railway's custom domain IP address`);
      console.log(`      2. Or redirect apex to www in Railway settings`);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 DNS setup complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⏳ DNS propagation takes 5-60 minutes\n');
    console.log('🔗 Your sites will be available at:');
    console.log(`   • https://www.${DOMAIN}`);
    console.log(`   • https://${RAILWAY_URL} (direct Railway URL)\n`);
    console.log('📝 Next steps:');
    console.log('   1. Add custom domain in Railway Dashboard:');
    console.log('      railway.com → Your Project → Settings → Domains');
    console.log(`   2. Add: www.${DOMAIN}`);
    console.log('   3. Railway will auto-provision SSL certificate\n');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

updateDNS();
