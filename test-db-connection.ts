/**
 * Test database connection
 * Run with: npx tsx test-db-connection.ts
 */

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

console.log('🔌 Testing connection to:', connectionString.replace(/:[^:@]+@/, ':****@'));

try {
  const sql = postgres(connectionString, {
    ssl: 'require',
    max: 1,
    connect_timeout: 10,
  });

  console.log('⏳ Connecting...');
  
  const result = await sql`SELECT version(), current_database(), current_user`;
  
  console.log('✅ Connection successful!');
  console.log('📊 Database info:');
  console.log('  Version:', result[0].version.split(' ')[0] + ' ' + result[0].version.split(' ')[1]);
  console.log('  Database:', result[0].current_database);
  console.log('  User:', result[0].current_user);
  
  await sql.end();
  process.exit(0);
} catch (error) {
  console.error('❌ Connection failed:');
  console.error('  Error:', error instanceof Error ? error.message : error);
  if (error instanceof Error && 'code' in error) {
    console.error('  Code:', (error as any).code);
  }
  process.exit(1);
}
