/**
 * Role Checker
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

async function checkRoles() {
  try {
    const roles = await pool.query(
      `SELECT id, name, tier, permissions 
       FROM roles 
       WHERE id IN (
         'f7365d0f-d05d-4a9d-861f-9755720ac7b1',
         'eb04641c-ce93-45c0-97ef-0f53f7c59d40',
         '0efb48c0-d71c-4c54-a6eb-950380c6634d',
         'ad808a15-806f-4f4d-84de-c6bffe056298',
         '49726409-122a-423f-a2b6-725e581e7bdc'
       )`
    );
    
    console.log('🔐 User Roles and Access Levels:\n');
    
    const users = [
      { email: 'superadmin@accute.com', roleId: 'f7365d0f-d05d-4a9d-861f-9755720ac7b1' },
      { email: 'employee@sterling.com', roleId: 'eb04641c-ce93-45c0-97ef-0f53f7c59d40' },
      { email: 'david@technova.com', roleId: '0efb48c0-d71c-4c54-a6eb-950380c6634d' },
      { email: 'saivithalvalluri@gmail.com', roleId: 'ad808a15-806f-4f4d-84de-c6bffe056298' },
      { email: 'admin@sterling.com', roleId: '49726409-122a-423f-a2b6-725e581e7bdc' }
    ];
    
    users.forEach(user => {
      const role = roles.rows.find(r => r.id === user.roleId);
      if (role) {
        console.log(`✅ ${user.email}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   🔑 Password: test123`);
        console.log(`   👤 Role: ${role.name}`);
        console.log(`   🏷️ Tier: ${role.tier}`);
        console.log(`   🛡️ Permissions: ${Array.isArray(role.permissions) ? role.permissions.join(', ') : role.permissions}`);
        console.log('');
      }
    });
    
    console.log('💡 For testing ALL professional modes, use:');
    const professionalRole = roles.rows.find(r => r.tier === 'professional' || r.name.toLowerCase().includes('professional'));
    if (professionalRole) {
      const profUser = users.find(u => u.roleId === professionalRole.id);
      console.log(`   📧 Email: ${profUser?.email}`);
      console.log(`   🔑 Password: test123`);
    } else {
      console.log('   📧 Email: superadmin@accute.com (highest access)');
      console.log('   🔑 Password: test123');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkRoles();