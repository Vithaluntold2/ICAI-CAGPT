/**
 * Simple User Checker
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

async function getUsers() {
  try {
    // Get basic user info
    const users = await pool.query(
      'SELECT id, username, email, role_id, organization_id FROM users LIMIT 10'
    );
    
    console.log('👥 Existing users in database:\n');
    
    if (users.rows.length === 0) {
      console.log('❌ No users found');
      console.log('\n💡 Creating a simple test user...\n');
      
      // Create a simple test user
      const newUser = await pool.query(`
        INSERT INTO users (
          id, username, email, password, first_name, last_name,
          email_verified, phone_verified, kyc_status, 
          role_id, is_active, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), 'testuser', 'test@professional.com', 
          '$2a$10$K8BPS.Ur7CFYTxZRBTF6feD6s3kXHMbD4pU.YOkGJzF7jLwqULLje',
          'Test', 'User', true, false, 'pending',
          'role_professional_user', true, NOW(), NOW()
        ) RETURNING id, username, email
      `);
      
      console.log('✅ Created test user:');
      console.log(`   Username: ${newUser.rows[0].username}`);
      console.log(`   Email: ${newUser.rows[0].email}`);
      console.log(`   Password: test123`);
      console.log(`   Role: Professional User\n`);
      
    } else {
      users.rows.forEach(user => {
        console.log(`✅ ${user.username} (${user.email})`);
        console.log(`   - Role: ${user.role_id}`);
        console.log(`   - Org: ${user.organization_id || 'None'}`);
        console.log(`   - Try password: test123 or password123\n`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

getUsers();