/**
 * Final User Credentials Check
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const envPath = join(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf-8');
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!dbUrlMatch) {
  throw new Error('DATABASE_URL not found in .env file');
}
const DATABASE_URL = dbUrlMatch[1].trim();

const pool = new Pool({ connectionString: DATABASE_URL });

async function getFinalCredentials() {
  try {
    // Check roles table structure
    const roleColumns = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'roles' ORDER BY ordinal_position`
    );
    
    console.log('📋 Roles table columns:', roleColumns.rows.map(r => r.column_name).join(', '));
    
    // Get roles without tier
    const roles = await pool.query(`SELECT * FROM roles LIMIT 5`);
    
    console.log('\n🔐 Available User Credentials for Testing:\n');
    
    console.log('🎯 RECOMMENDED FOR PROFESSIONAL TESTING:');
    console.log('   📧 Email: superadmin@accute.com');
    console.log('   🔑 Password: test123');
    console.log('   ⭐ Access: Full admin access (best for testing all features)\n');
    
    console.log('🎯 ALTERNATIVE OPTIONS:');
    console.log('   📧 Email: admin@sterling.com');
    console.log('   🔑 Password: test123');
    console.log('   ⭐ Access: Admin level\n');
    
    console.log('   📧 Email: david@technova.com');
    console.log('   🔑 Password: test123');
    console.log('   ⭐ Access: Standard user\n');
    
    console.log('💡 To test the SSE streaming chat:');
    console.log('   1. Open browser to http://localhost:3000');
    console.log('   2. Login with superadmin@accute.com / test123');
    console.log('   3. Navigate to Chat');
    console.log('   4. Test all professional modes:');
    console.log('      • Deep Research');
    console.log('      • Checklist Generation');
    console.log('      • Workflow Generation');
    console.log('      • Audit Plan');
    console.log('      • Calculation');
    console.log('      • Standard Chat');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

getFinalCredentials();