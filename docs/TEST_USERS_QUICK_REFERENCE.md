# 🧪 Test User Quick Reference Card

## Password for ALL test accounts
```
TestPassword123!
```

---

## User Accounts by Role

### 🔴 SUPER ADMIN
| Email | Features |
|-------|----------|
| `superadmin@lucatest.com` | System monitoring, deployments, maintenance mode, all admin features |

> ⚠️ **Must add to `ADMIN_EMAIL_WHITELIST` env variable**

---

### 🟠 ADMIN
| Email | Features |
|-------|----------|
| `admin@lucatest.com` | User management, training data, coupons, analytics |

---

### 🟣 ENTERPRISE (Corporate)
| Email | Role | Features |
|-------|------|----------|
| `enterprise.owner@lucatest.com` | Owner | SSO, multi-user, custom AI, unlimited all |
| `enterprise.cfo@lucatest.com` | Admin Member | Same tier, admin of corporate profile |
| `enterprise.accountant@lucatest.com` | Staff Member | Same tier, member of corporate profile |

**Team Structure:**
```
Acme Corporation (Business Profile)
├── enterprise.owner@lucatest.com (Owner)
├── enterprise.cfo@lucatest.com (Admin)
└── enterprise.accountant@lucatest.com (Member)
```

---

### 🔵 PROFESSIONAL
| Email | Profile Type | Features |
|-------|--------------|----------|
| `professional.cpa@lucatest.com` | Business | API access, forensic, white-label |
| `professional.consultant@lucatest.com` | Business | Same as above |

---

### 🟢 PLUS
| Email | Profile Type | Features |
|-------|--------------|----------|
| `plus.business@lucatest.com` | Business | 3K queries, 5 profiles, scenarios |
| `plus.family@lucatest.com` | Family | Multi-member family profile |
| `plus.family.spouse@lucatest.com` | Family Member | Admin of family profile |
| `plus.family.child@lucatest.com` | Family Member | Viewer of family profile |
| `plus.freelancer@lucatest.com` | Personal | Freelancer workflow |

**Family Structure:**
```
Johnson Family Finances (Family Profile)
├── plus.family@lucatest.com (Owner)
├── plus.family.spouse@lucatest.com (Admin)
└── plus.family.child@lucatest.com (Viewer)
```

---

### ⚪ FREE (Home/Personal)
| Email | Notes |
|-------|-------|
| `free.home@lucatest.com` | Standard home user with personal profile |
| `free.student@lucatest.com` | Student use case |
| `free.newuser@lucatest.com` | Fresh account, NO profile (tests onboarding) |

**Limits:** 500 queries/mo, 10 docs/mo, 1 profile, TXT/CSV export only

---

### ⚠️ EDGE CASES
| Email | Condition | Test Purpose |
|-------|-----------|--------------|
| `quota.exhausted@lucatest.com` | At quota limit | Upgrade prompts, limit messages |
| `mfa.enabled@lucatest.com` | MFA enabled | 2FA login flow |
| `locked.account@lucatest.com` | Account locked | Lockout recovery flow |

---

## Feature Access Matrix

| Feature | Free | Plus | Pro | Enterprise | Admin | Super |
|---------|:----:|:----:|:---:|:----------:|:-----:|:-----:|
| Chat queries | 500 | 3K | ∞ | ∞ | ∞ | ∞ |
| Documents | 10 | ∞ | ∞ | ∞ | ∞ | ∞ |
| Profiles | 1 | 5 | ∞ | ∞ | ∞ | ∞ |
| Scenario Simulator | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Forensic Analysis | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| White-label | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| SSO/SAML | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Custom AI Training | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Admin Dashboard | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| System Monitoring | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Deployments | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Profile Member Roles

| Role | View | Add Data | Invite | Change Roles | Delete Profile |
|------|:----:|:--------:|:------:|:------------:|:--------------:|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ❌ | ❌ |
| Member | ✅ | ✅ | ❌ | ❌ | ❌ |
| Viewer | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Setup Instructions

### 1. Seed the test users
```bash
npx tsx scripts/seed-test-users.ts
```

### 2. Add Super Admin to whitelist
```bash
# In .env file
ADMIN_EMAIL_WHITELIST=superadmin@lucatest.com,your-real-admin@company.com
```

### 3. Restart the server
```bash
npm run dev
```

---

## Common Test Scenarios

### Scenario 1: Upgrade Flow
1. Login as `free.home@lucatest.com`
2. Try to create a second profile
3. Verify upgrade prompt appears
4. (In admin) Upgrade user to Plus
5. Verify second profile creation now works

### Scenario 2: Team Collaboration
1. Login as `enterprise.owner@lucatest.com`
2. View "Acme Corporation" profile
3. Verify CFO and Accountant are members
4. Login as `enterprise.accountant@lucatest.com`
5. Verify can view but not invite members

### Scenario 3: Family Profile
1. Login as `plus.family@lucatest.com`
2. View family members
3. Verify spouse has admin role
4. Login as `plus.family.child@lucatest.com`
5. Verify can only view, not edit

### Scenario 4: Admin Operations
1. Login as `admin@lucatest.com`
2. Access admin dashboard
3. Search for users
4. Try to access System Monitoring
5. Verify access denied (Super Admin only)

### Scenario 5: Quota Limits
1. Login as `quota.exhausted@lucatest.com`
2. Try to send a chat message
3. Verify quota exceeded message
4. Verify upgrade CTA shown

### Scenario 6: Account Lockout
1. Try to login as `locked.account@lucatest.com`
2. Verify locked account message
3. Wait for lockout to expire (or reset in admin)
4. Verify login works after unlock

---

*Generated for ICAI CAGPT E2E Testing*
