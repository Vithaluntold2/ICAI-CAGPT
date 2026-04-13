/**
 * Test User Seeding Script
 * 
 * Creates predefined user accounts with different roles and subscription tiers
 * for comprehensive testing across all user personas.
 * 
 * Usage: npx tsx scripts/seed-test-users.ts
 */

import { db } from '../server/db';
import { users, profiles, profileMembers } from '../shared/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

// ================================
// Test User Definitions
// ================================

const TEST_PASSWORD = 'TestPassword123!';

interface TestUserDefinition {
  email: string;
  name: string;
  subscriptionTier: 'free' | 'plus' | 'professional' | 'enterprise';
  isAdmin: boolean;
  isSuperAdmin: boolean; // For documentation - actual super admin is via env whitelist
  description: string;
  profileType?: 'personal' | 'business' | 'family';
  profileName?: string;
}

const TEST_USERS: TestUserDefinition[] = [
  // ========== SUPER ADMIN ==========
  {
    email: 'superadmin@cagpttest.com',
    name: 'Super Admin User',
    subscriptionTier: 'enterprise',
    isAdmin: true,
    isSuperAdmin: true,
    description: 'Highest privilege - system control, deployments, monitoring',
    profileType: 'personal',
    profileName: 'Super Admin Profile',
  },

  // ========== ADMIN ==========
  {
    email: 'admin@cagpttest.com',
    name: 'Platform Admin',
    subscriptionTier: 'professional',
    isAdmin: true,
    isSuperAdmin: false,
    description: 'Platform administration - user management, training data, coupons',
    profileType: 'personal',
    profileName: 'Admin Profile',
  },

  // ========== ENTERPRISE USERS ==========
  {
    email: 'enterprise.owner@cagpttest.com',
    name: 'Enterprise Owner (Corporate)',
    subscriptionTier: 'enterprise',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'Enterprise tier - SSO, multi-user, custom AI training, unlimited everything',
    profileType: 'business',
    profileName: 'Acme Corporation',
  },
  {
    email: 'enterprise.cfo@cagpttest.com',
    name: 'Enterprise CFO',
    subscriptionTier: 'enterprise',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'Enterprise team member - CFO role for corporate testing',
    profileType: 'business',
    profileName: 'CFO Office',
  },
  {
    email: 'enterprise.accountant@cagpttest.com',
    name: 'Enterprise Staff Accountant',
    subscriptionTier: 'enterprise',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'Enterprise team member - Staff level for permission testing',
    profileType: 'personal',
    profileName: 'Accountant Workspace',
  },

  // ========== PROFESSIONAL USERS ==========
  {
    email: 'professional.cpa@cagpttest.com',
    name: 'Professional CPA',
    subscriptionTier: 'professional',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'Professional tier - API access, forensic intelligence, white-label',
    profileType: 'business',
    profileName: 'CPA Practice',
  },
  {
    email: 'professional.consultant@cagpttest.com',
    name: 'Tax Consultant Pro',
    subscriptionTier: 'professional',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'Professional tier - consultant workflow testing',
    profileType: 'business',
    profileName: 'Tax Consulting LLC',
  },

  // ========== PLUS USERS ==========
  {
    email: 'plus.business@cagpttest.com',
    name: 'Plus Business Owner',
    subscriptionTier: 'plus',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'Plus tier - 3K queries, 5 profiles, scenario simulator',
    profileType: 'business',
    profileName: 'Small Business Inc',
  },
  {
    email: 'plus.family@cagpttest.com',
    name: 'Plus Family Manager',
    subscriptionTier: 'plus',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'Plus tier - family profile testing with multiple members',
    profileType: 'family',
    profileName: 'Johnson Family Finances',
  },
  {
    email: 'plus.freelancer@cagpttest.com',
    name: 'Plus Freelancer',
    subscriptionTier: 'plus',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'Plus tier - freelancer/sole proprietor workflow',
    profileType: 'personal',
    profileName: 'Freelance Taxes',
  },

  // ========== FREE USERS ==========
  {
    email: 'free.home@cagpttest.com',
    name: 'Free Home User',
    subscriptionTier: 'free',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'Free tier - 500 queries, 10 docs, 1 profile, basic features',
    profileType: 'personal',
    profileName: 'My Taxes',
  },
  {
    email: 'free.student@cagpttest.com',
    name: 'Free Student',
    subscriptionTier: 'free',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'Free tier - student use case, simple tax situations',
    profileType: 'personal',
    profileName: 'Student Taxes',
  },
  {
    email: 'free.newuser@cagpttest.com',
    name: 'New Free User',
    subscriptionTier: 'free',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'Free tier - fresh account, no usage history',
    // No profile - tests onboarding flow
  },

  // ========== EDGE CASE USERS ==========
  {
    email: 'quota.exhausted@cagpttest.com',
    name: 'Quota Exhausted User',
    subscriptionTier: 'free',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'Free user at quota limit - tests upgrade prompts',
    profileType: 'personal',
    profileName: 'Limited Profile',
  },
  {
    email: 'mfa.enabled@cagpttest.com',
    name: 'MFA Enabled User',
    subscriptionTier: 'plus',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'User with MFA enabled - tests 2FA flows',
    profileType: 'personal',
    profileName: 'Secure Profile',
  },
  {
    email: 'locked.account@cagpttest.com',
    name: 'Locked Account User',
    subscriptionTier: 'free',
    isAdmin: false,
    isSuperAdmin: false,
    description: 'Account locked due to failed attempts - tests lockout flow',
    profileType: 'personal',
    profileName: 'Locked Profile',
  },
];

// ================================
// Seeding Functions
// ================================

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function createTestUser(userDef: TestUserDefinition): Promise<string> {
  const hashedPassword = await hashPassword(TEST_PASSWORD);
  
  // Check if user exists
  const existing = await db.select().from(users).where(eq(users.email, userDef.email));
  
  if (existing.length > 0) {
    console.log(`  ⏭️  User exists: ${userDef.email}`);
    return existing[0].id;
  }

  // Create user
  const [newUser] = await db.insert(users).values({
    email: userDef.email,
    password: hashedPassword,
    name: userDef.name,
    subscriptionTier: userDef.subscriptionTier,
    isAdmin: userDef.isAdmin,
    // Special handling for edge cases
    ...(userDef.email === 'locked.account@cagpttest.com' && {
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // Locked for 30 min
    }),
  }).returning();

  console.log(`  ✅ Created: ${userDef.email} (${userDef.subscriptionTier}${userDef.isAdmin ? ', admin' : ''})`);

  // Create profile if specified
  if (userDef.profileType && userDef.profileName) {
    const [newProfile] = await db.insert(profiles).values({
      name: userDef.profileName,
      type: userDef.profileType,
      userId: newUser.id,
    }).returning();

    // Add user as owner member of the profile
    await db.insert(profileMembers).values({
      profileId: newProfile.id,
      name: userDef.name,
      email: userDef.email,
      role: 'owner',
    });

    console.log(`     📁 Profile: ${userDef.profileName} (${userDef.profileType})`);
  }

  return newUser.id;
}

async function createFamilyMembers(familyOwnerId: string): Promise<void> {
  // Get the family profile
  const ownerProfiles = await db.select()
    .from(profiles)
    .where(eq(profiles.userId, familyOwnerId));
  
  const familyProfile = ownerProfiles.find(p => p.type === 'family');
  if (!familyProfile) return;

  // Create spouse as admin
  const spouseEmail = 'plus.family.spouse@cagpttest.com';
  const existingSpouse = await db.select().from(users).where(eq(users.email, spouseEmail));
  
  if (existingSpouse.length === 0) {
    const hashedPassword = await hashPassword(TEST_PASSWORD);
    const [spouse] = await db.insert(users).values({
      email: spouseEmail,
      password: hashedPassword,
      name: 'Family Spouse',
      subscriptionTier: 'plus',
      isAdmin: false,
    }).returning();

    await db.insert(profileMembers).values({
      profileId: familyProfile.id,
      name: 'Family Spouse',
      email: spouseEmail,
      relationship: 'spouse',
      role: 'admin',
    });

    console.log(`  ✅ Created family member: ${spouseEmail} (admin)`);
  }

  // Create child as viewer
  const childEmail = 'plus.family.child@cagpttest.com';
  const existingChild = await db.select().from(users).where(eq(users.email, childEmail));
  
  if (existingChild.length === 0) {
    const hashedPassword = await hashPassword(TEST_PASSWORD);
    const [child] = await db.insert(users).values({
      email: childEmail,
      password: hashedPassword,
      name: 'Family Child (College)',
      subscriptionTier: 'free', // Child has own free account
      isAdmin: false,
    }).returning();

    await db.insert(profileMembers).values({
      profileId: familyProfile.id,
      name: 'Family Child (College)',
      email: childEmail,
      relationship: 'child',
      role: 'viewer',
    });

    console.log(`  ✅ Created family member: ${childEmail} (viewer)`);
  }
}

async function createCorporateTeam(corporateOwnerId: string): Promise<void> {
  // Get the corporate profile
  const ownerProfiles = await db.select()
    .from(profiles)
    .where(eq(profiles.userId, corporateOwnerId));
  
  const bizProfile = ownerProfiles.find(p => p.type === 'business');
  if (!bizProfile) return;

  // Add CFO as admin
  const cfoEmail = 'enterprise.cfo@cagpttest.com';
  const existingCfo = await db.select().from(users).where(eq(users.email, cfoEmail));
  
  if (existingCfo.length > 0) {
    // Check if already a member by email
    const existingMembership = await db.select()
      .from(profileMembers)
      .where(eq(profileMembers.email, cfoEmail));
    
    if (!existingMembership.find(m => m.profileId === bizProfile.id)) {
      await db.insert(profileMembers).values({
        profileId: bizProfile.id,
        name: existingCfo[0].name || 'CFO',
        email: cfoEmail,
        relationship: 'employee',
        role: 'admin',
      });
      console.log(`  🔗 Linked CFO to corporate profile as admin`);
    }
  }

  // Add Staff Accountant as member
  const accountantEmail = 'enterprise.accountant@cagpttest.com';
  const existingAccountant = await db.select().from(users).where(eq(users.email, accountantEmail));
  
  if (existingAccountant.length > 0) {
    const existingMembership = await db.select()
      .from(profileMembers)
      .where(eq(profileMembers.email, accountantEmail));
    
    if (!existingMembership.find(m => m.profileId === bizProfile.id)) {
      await db.insert(profileMembers).values({
        profileId: bizProfile.id,
        name: existingAccountant[0].name || 'Staff Accountant',
        email: accountantEmail,
        relationship: 'employee',
        role: 'member',
      });
      console.log(`  🔗 Linked Accountant to corporate profile as member`);
    }
  }
}

// ================================
// Main Execution
// ================================

async function main(): Promise<void> {
  console.log('\n🌱 Seeding Test Users for ICAI CAGPT\n');
  console.log('=' .repeat(50));
  console.log(`Password for all test users: ${TEST_PASSWORD}`);
  console.log('=' .repeat(50));
  console.log('\n');

  const userIds: Record<string, string> = {};

  // Create all users
  for (const userDef of TEST_USERS) {
    const userId = await createTestUser(userDef);
    userIds[userDef.email] = userId;
  }

  console.log('\n📎 Creating team relationships...\n');

  // Create family members
  if (userIds['plus.family@cagpttest.com']) {
    await createFamilyMembers(userIds['plus.family@cagpttest.com']);
  }

  // Create corporate team
  if (userIds['enterprise.owner@cagpttest.com']) {
    await createCorporateTeam(userIds['enterprise.owner@cagpttest.com']);
  }

  console.log('\n');
  console.log('=' .repeat(50));
  console.log('✅ Test user seeding complete!');
  console.log('=' .repeat(50));
  console.log('\n📋 Test User Summary:\n');

  console.log('SUPER ADMIN (add to ADMIN_EMAIL_WHITELIST env):');
  console.log('  • superadmin@cagpttest.com\n');

  console.log('ADMIN:');
  console.log('  • admin@cagpttest.com\n');

  console.log('ENTERPRISE (Corporate):');
  console.log('  • enterprise.owner@cagpttest.com (Owner)');
  console.log('  • enterprise.cfo@cagpttest.com (CFO - Admin member)');
  console.log('  • enterprise.accountant@cagpttest.com (Staff - Member)\n');

  console.log('PROFESSIONAL:');
  console.log('  • professional.cpa@cagpttest.com');
  console.log('  • professional.consultant@cagpttest.com\n');

  console.log('PLUS:');
  console.log('  • plus.business@cagpttest.com (Business owner)');
  console.log('  • plus.family@cagpttest.com (Family owner)');
  console.log('  • plus.family.spouse@cagpttest.com (Family admin)');
  console.log('  • plus.family.child@cagpttest.com (Family viewer)');
  console.log('  • plus.freelancer@cagpttest.com\n');

  console.log('FREE (Home/Personal):');
  console.log('  • free.home@cagpttest.com');
  console.log('  • free.student@cagpttest.com');
  console.log('  • free.newuser@cagpttest.com (no profile)\n');

  console.log('EDGE CASES:');
  console.log('  • quota.exhausted@cagpttest.com (at quota limit)');
  console.log('  • mfa.enabled@cagpttest.com (2FA enabled)');
  console.log('  • locked.account@cagpttest.com (locked out)\n');

  console.log('⚠️  Remember to add superadmin@cagpttest.com to ADMIN_EMAIL_WHITELIST!\n');

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error seeding test users:', error);
  process.exit(1);
});
