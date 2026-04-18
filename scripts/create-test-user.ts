/**
 * Create Test User Script
 * 
 * Creates a professional test user for testing SSE streaming
 * 
 * Usage: npx tsx scripts/create-test-user.ts
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not set. Run with: tsx --env-file=.env scripts/create-test-user.ts');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

const TEST_USER = {
  name: 'Pro Tester',
  email: 'test@professional.com',
  password: 'Test1234',
  subscriptionTier: 'professional',
  isAdmin: true,
};

async function createTestUser() {
  console.log('🚀 Creating professional test user...\n');

  try {
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [TEST_USER.email]);
    
    if (existingUser.rows.length > 0) {
      console.log('ℹ️  User already exists, updating...');
      
      const hashedPassword = await bcrypt.hash(TEST_USER.password, 10);
      const result = await pool.query(
        `UPDATE users
         SET password = $1, name = $2, subscription_tier = $3, is_admin = $4
         WHERE email = $5
         RETURNING id, email, name, subscription_tier, is_admin`,
        [
          hashedPassword,
          TEST_USER.name,
          TEST_USER.subscriptionTier,
          TEST_USER.isAdmin,
          TEST_USER.email
        ]
      );

      const updatedUser = result.rows[0];
      console.log(`✅ Updated user: ${updatedUser.name} (${updatedUser.email})`);
      console.log(`   - ID: ${updatedUser.id}`);
      console.log(`   - Tier: ${updatedUser.subscription_tier}`);
      console.log(`   - Admin: ${updatedUser.is_admin}`);
      console.log(`   - Password: ${TEST_USER.password}\n`);
      
    } else {
      console.log('➕ Creating new user...');
      
      const hashedPassword = await bcrypt.hash(TEST_USER.password, 10);
      const result = await pool.query(
        `INSERT INTO users (id, email, password, name, subscription_tier, is_admin, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id, email, name, subscription_tier, is_admin`,
        [
          randomUUID(),
          TEST_USER.email,
          hashedPassword,
          TEST_USER.name,
          TEST_USER.subscriptionTier,
          TEST_USER.isAdmin,
        ]
      );

      const createdUser = result.rows[0];
      console.log(`✅ Created user: ${createdUser.name} (${createdUser.email})`);
      console.log(`   - ID: ${createdUser.id}`);
      console.log(`   - Tier: ${createdUser.subscription_tier}`);
      console.log(`   - Admin: ${createdUser.is_admin}`);
      console.log(`   - Password: ${TEST_USER.password}\n`);
    }

    console.log('🎉 Test user ready!\n');
    console.log('🔐 Login credentials:');
    console.log(`   Email: ${TEST_USER.email}`);
    console.log(`   Password: ${TEST_USER.password}`);
    console.log('   ✅ Professional tier (All features unlocked)');
    console.log('   ✅ Admin access');
    console.log('   ✅ All professional modes available');
    console.log('\n🚀 Test SSE streaming at: http://localhost:3000');

  } catch (error) {
    console.error('❌ Error creating test user:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
createTestUser()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });