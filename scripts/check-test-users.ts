/**
 * Check seeded test users in the database
 */

import { db } from '../server/db';
import { users, profiles, profileMembers } from '../shared/schema';
import { like } from 'drizzle-orm';

async function check() {
  console.log('\n📊 Checking seeded test users in Railway DB...\n');
  
  const testUsers = await db.select({
    email: users.email,
    name: users.name,
    tier: users.subscriptionTier,
    isAdmin: users.isAdmin,
  }).from(users).where(like(users.email, '%cagpttest.com'));
  
  console.log(`USERS (${testUsers.length} found):`);
  testUsers.forEach(u => console.log(`  • ${u.email} | ${u.tier}${u.isAdmin ? ' | ADMIN' : ''}`));
  
  const testProfiles = await db.select({
    name: profiles.name,
    type: profiles.type,
  }).from(profiles);
  
  console.log(`\nPROFILES (${testProfiles.length} total, showing last 15):`);
  testProfiles.slice(-15).forEach(p => console.log(`  • ${p.name} (${p.type})`));
  
  const members = await db.select({
    name: profileMembers.name,
    email: profileMembers.email,
    role: profileMembers.role,
  }).from(profileMembers);
  
  console.log(`\nPROFILE MEMBERS (${members.length} total, showing last 20):`);
  members.slice(-20).forEach(m => console.log(`  • ${m.name} | ${m.email} | ${m.role}`));
  
  console.log('\n✅ Database check complete!\n');
  process.exit(0);
}

check().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
