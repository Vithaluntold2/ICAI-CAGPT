#!/usr/bin/env tsx

/**
 * Setup cagpt.icai.org DNS to point to Railway
 */

import 'dotenv/config';
import { godaddyDNS } from './server/services/godaddyDNS';

async function setupDomain() {
  console.log('🌐 Setting up cagpt.icai.org DNS for Railway...\n');
  
  try {
    // Railway requires CNAME @ → 4gl1wfxs.up.railway.app
    // But @ (root) cannot be CNAME, so we'll use A and AAAA records
    // Let me check current records first
    
    console.log('📋 Current DNS records for cagpt.icai.org:\n');
    const records = await godaddyDNS.getDNSRecords('cagpt.icai.org');
    
    const aRecords = records.filter(r => r.type === 'A');
    const cnameRecords = records.filter(r => r.type === 'CNAME');
    
    console.log('A Records:', aRecords);
    console.log('CNAME Records:', cnameRecords);
    
    // For root domain, we need to replace A record with Railway's IP
    // But Railway provides CNAME, which doesn't work for root
    // So we'll setup www subdomain instead
    
    console.log('\n🔧 Setting up www.cagpt.icai.org → Railway...\n');
    
    await godaddyDNS.replaceDNSRecord('cagpt.icai.org', 'CNAME', 'www', [
      {
        type: 'CNAME',
        name: 'www',
        data: '4gl1wfxs.up.railway.app',
        ttl: 600
      }
    ]);
    
    console.log('✅ DNS configured successfully!');
    console.log('\nSetup complete:');
    console.log('  • www.cagpt.icai.org → 4gl1wfxs.up.railway.app');
    console.log('\n⏳ DNS propagation may take 5-60 minutes.');
    console.log('🔗 Access your app at: https://www.cagpt.icai.org\n');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

setupDomain();
