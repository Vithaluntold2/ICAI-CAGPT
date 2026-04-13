# 📋 ICAI CAGPT Complete Testing Guide

**Application URL**: `http://localhost:3000` (Development) | Your production URL  
**Last Updated**: January 2026

---

## 🚀 Quick Start: Seed Test Users

Before testing, seed all test accounts into your database:

```bash
npx tsx scripts/seed-test-users.ts
```

> ⚠️ **Important**: Add `superadmin@lucatest.com` to `SUPER_ADMIN_EMAILS` environment variable for full system access.

---

## 📊 Test User Overview

| Role | Email | Password | Subscription | Primary Testing Focus |
|------|-------|----------|--------------|----------------------|
| **Super Admin** | `superadmin@lucatest.com` | `SuperAdmin123!` | Enterprise | System monitoring, deployments, security |
| **Admin** | `admin@lucatest.com` | `Admin123!` | Enterprise | User management, analytics |
| **Enterprise** | `enterprise.owner@lucatest.com` | `Enterprise123!` | Enterprise | SSO, teams, custom AI |
| **Professional** | `professional.cpa@lucatest.com` | `Professional123!` | Professional | API, forensic, white-label |
| **Plus** | `plus.business@lucatest.com` | `Plus123!` | Plus | Scenario simulator, deliverables |
| **Free** | `free.home@lucatest.com` | `Free123!` | Free | Basic chat, limited features |
| **New User** | `free.newuser@lucatest.com` | `NewUser123!` | None | Onboarding flow |
| **Quota Limit** | `quota.exhausted@lucatest.com` | `Quota123!` | Free | Quota errors, upgrade prompts |
| **MFA Enabled** | `mfa.enabled@lucatest.com` | `MFA123!` | Professional | 2FA login flow |
| **Locked** | `locked.account@lucatest.com` | `Locked123!` | Free | Account recovery |

---

## 👑 1. Super Admin User

### Account Details
```
Email:    superadmin@lucatest.com
Password: SuperAdmin123!
Tier:     Enterprise + Super Admin Flag
```

### Environment Setup
Add to your `.env` file:
```
SUPER_ADMIN_EMAILS=superadmin@lucatest.com
```

### What You Can Test

#### System Monitoring Dashboard (`/admin/system-monitoring`)
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **Health Dashboard** | Navigate to System Monitoring | View real-time system metrics, CPU/Memory usage |
| **Threat Detection** | Check Security Threats section | See any detected security issues or "No threats" |
| **API Routes Status** | View Routes tab | List of all registered API endpoints with health |
| **Integration Health** | Check Integrations | Status of QuickBooks, Xero, payment providers |
| **Alert Management** | View Active Alerts | Resolve or dismiss system alerts |

#### Deployment Management
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **View Deployments** | Deployments section | List of recent deployments with status |
| **Start Deployment** | Click "Deploy" button | Initiate new deployment with confirmation |
| **Rollback** | Click rollback on a deployment | Revert to previous version |
| **View Performance** | Performance tab | Response times, error rates, throughput |

#### Maintenance Mode
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **Schedule Maintenance** | Maintenance tab → Schedule | Set maintenance window with notification |
| **Cancel Maintenance** | Click cancel on scheduled | Remove upcoming maintenance |
| **Activate Immediately** | Emergency maintenance option | Immediately enable maintenance mode |

### Step-by-Step Testing Workflow

1. **Login**
   ```
   Navigate to: /auth
   Enter: superadmin@lucatest.com / SuperAdmin123!
   ```

2. **Access Admin Panel**
   ```
   Click profile icon → Admin Panel
   Or navigate to: /admin
   ```

3. **Test System Monitoring**
   ```
   Navigate to: /admin/system-monitoring
   ✓ Verify health metrics display
   ✓ Check for security alerts
   ✓ View deployment history
   ✓ Test alert resolution
   ```

4. **Test All Regular Features**
   - Super Admin has access to ALL features from every tier
   - Test any feature from lower tiers

### API Endpoints (Super Admin Only)
```bash
# Health metrics
curl -X GET http://localhost:3000/api/admin/system/health \
  -H "Cookie: your-session-cookie"

# Security threats
curl -X GET http://localhost:3000/api/admin/system/threats

# Active alerts
curl -X GET http://localhost:3000/api/admin/system/alerts

# Resolve an alert
curl -X POST http://localhost:3000/api/admin/system/alerts/ALERT_ID/resolve

# Start deployment
curl -X POST http://localhost:3000/api/admin/system/deployments/start \
  -H "Content-Type: application/json" \
  -d '{"version": "1.2.0", "notes": "Feature release"}'
```

---

## 🛡️ 2. Admin User

### Account Details
```
Email:    admin@lucatest.com
Password: Admin123!
Tier:     Enterprise + Admin Flag
```

### What You Can Test

#### User Management (`/admin/users`)
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **View All Users** | Navigate to Users page | Table of all registered users |
| **Change User Tier** | Click tier dropdown → Select new tier | User subscription updated |
| **Toggle Admin** | Click "Make Admin" / "Remove Admin" | Admin status toggled |
| **Search Users** | Use search box | Filter users by email/name |
| **View User Details** | Click on user row | Show user profile, usage stats |

#### Subscription Management (`/admin/subscriptions`)
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **View Subscriptions** | Navigate to Subscriptions | List all active subscriptions |
| **View Revenue** | Check analytics section | MRR, ARR, churn metrics |
| **Manage Plans** | View plan distribution | Chart of users per plan |
| **Cancel Subscription** | Admin cancel option | Subscription terminated |

#### Coupon Management (`/admin/coupons`)
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **Create Coupon** | Click "Create Coupon" | New discount code created |
| **View Active Coupons** | Coupon list | See all coupons with redemption count |
| **Deactivate Coupon** | Toggle coupon status | Coupon disabled |
| **View Usage** | Click coupon → Details | See who used the coupon |

#### Dashboard Analytics (`/admin`)
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **User Growth** | View chart | Daily/weekly/monthly signups |
| **Query Volume** | Analytics widget | Total queries processed |
| **Revenue Metrics** | Financial overview | Current MRR, growth rate |
| **Popular Features** | Usage breakdown | Most used chat modes |

### Step-by-Step Testing Workflow

1. **Login**
   ```
   Navigate to: /auth
   Enter: admin@lucatest.com / Admin123!
   ```

2. **Access Admin Dashboard**
   ```
   Click profile icon → Admin Panel
   Or navigate to: /admin
   ✓ Verify dashboard loads with analytics
   ```

3. **Test User Management**
   ```
   Navigate to: /admin/users
   ✓ Search for a test user (e.g., "free.home")
   ✓ Change their tier from Free to Plus
   ✓ Verify change persists after refresh
   ✓ Toggle admin status on/off
   ```

4. **Test Subscription Management**
   ```
   Navigate to: /admin/subscriptions
   ✓ View subscription list
   ✓ Check revenue metrics
   ✓ Export subscription data
   ```

5. **Test Coupon Creation**
   ```
   Navigate to: /admin/coupons
   ✓ Create new coupon: "TEST25" - 25% off
   ✓ Set expiration date
   ✓ Verify coupon appears in list
   ✓ Deactivate the coupon
   ```

### Limitations
- ❌ Cannot access System Monitoring (Super Admin only)
- ❌ Cannot manage deployments
- ❌ Cannot schedule maintenance

---

## 🏢 3. Enterprise User

### Account Details
```
Email:    enterprise.owner@lucatest.com
Password: Enterprise123!
Tier:     Enterprise (Full Features)
```

### Feature Limits
| Resource | Limit |
|----------|-------|
| Queries | **Unlimited** |
| Documents | **Unlimited** |
| Profiles | **Unlimited** |
| Scenarios | **Unlimited** |
| Deliverables | **Unlimited** |

### What You Can Test

#### Team Management (Enterprise Exclusive)
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **Create Team** | Settings → Teams → Create | New team workspace created |
| **Invite Members** | Team → Invite | Send invitation emails |
| **Assign Roles** | Member → Change Role | Owner/Admin/Member/Viewer roles |
| **Team Analytics** | Team Dashboard | View team usage statistics |

#### SSO/SAML (Enterprise Exclusive)
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **Configure SSO** | Settings → Security → SSO | SSO setup wizard |
| **Test Connection** | SSO → Test | Validate SAML configuration |
| **Enforce SSO** | Toggle "Require SSO" | Users must use SSO to login |

#### Custom AI Training (Enterprise Exclusive)
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **Upload Training Data** | Settings → AI → Training | Upload company documents |
| **Configure Personality** | AI Settings → Tone | Customize AI responses |
| **Industry Templates** | AI → Templates | Select industry-specific knowledge |

#### All Professional Features
- Everything from Professional, Plus, and Free tiers

### Step-by-Step Testing Workflow

1. **Login & Navigate**
   ```
   Login: enterprise.owner@lucatest.com / Enterprise123!
   Navigate to: /settings
   ```

2. **Test Profile Management**
   ```
   Navigate to: /settings → Profiles
   ✓ Create unlimited business profiles
   ✓ Add team members to profiles
   ✓ Set different access levels
   ```

3. **Test All Chat Modes**
   ```
   Navigate to: /chat
   Test each mode (no restrictions):
   ✓ Deep Research (8 agents)
   ✓ Scenario Simulator (12 agents)
   ✓ Deliverable Composer (45 agents)
   ✓ Forensic Intelligence (8 agents)
   ✓ Roundtable (6 agents)
   ```

4. **Test Document Features**
   ```
   ✓ Upload any document type
   ✓ Generate white-label reports
   ✓ Export in all 6 formats (PDF, Word, Excel, PPT, TXT, CSV)
   ```

---

## 💼 4. Professional User

### Account Details
```
Email:    professional.cpa@lucatest.com
Password: Professional123!
Tier:     Professional
```

### Feature Limits
| Resource | Limit |
|----------|-------|
| Queries | **Unlimited** |
| Documents | **Unlimited** |
| Profiles | **Unlimited** |
| Scenarios | **Unlimited** |
| Deliverables | **Unlimited** |

### What You Can Test

#### API Access (Professional+)
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **Generate API Key** | Settings → API → Generate | New API key created |
| **Test API Call** | Use curl with key | Successful API response |
| **View Usage** | API → Usage | API call statistics |
| **Regenerate Key** | API → Regenerate | Old key invalidated |

#### Forensic Intelligence (Professional+)
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **Upload Documents** | Forensic → Upload | Multiple documents analyzed |
| **Pattern Detection** | Run analysis | Anomalies highlighted |
| **Fraud Indicators** | View report | Risk scores and flags |
| **Generate Report** | Export findings | Professional forensic report |

#### White-Label Reports (Professional+)
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **Upload Logo** | Settings → Branding | Custom logo applied |
| **Custom Colors** | Branding → Colors | Report colors changed |
| **Generate Report** | Any deliverable | Your branding on output |

### Step-by-Step Testing Workflow

1. **Login**
   ```
   Login: professional.cpa@lucatest.com / Professional123!
   ```

2. **Test API Access**
   ```
   Navigate to: /settings → API
   ✓ Generate new API key
   ✓ Copy key to clipboard
   ✓ Test with curl:
   
   curl -X POST http://localhost:3000/api/v1/chat \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"message": "What is depreciation?"}'
   ```

3. **Test Forensic Intelligence**
   ```
   Navigate to: /chat
   Select mode: Forensic Intelligence
   
   Try query: "Analyze this transaction data for unusual patterns"
   ✓ Upload sample financial data
   ✓ Review anomaly detection
   ✓ Export forensic report
   ```

4. **Test White-Label**
   ```
   Navigate to: /settings → Branding
   ✓ Upload your company logo
   ✓ Set brand colors
   ✓ Generate a deliverable
   ✓ Verify branding on output
   ```

5. **Test All Modes**
   ```
   All 10 chat modes available:
   ✓ Standard, Deep Research, Checklist, Workflow
   ✓ Audit Plan, Calculation, Scenario Simulator
   ✓ Deliverable Composer, Forensic Intelligence, Roundtable
   ```

---

## ⭐ 5. Plus User

### Account Details
```
Email:    plus.business@lucatest.com
Password: Plus123!
Tier:     Plus
```

### Feature Limits
| Resource | Limit |
|----------|-------|
| Queries | **3,000/month** |
| Documents | **Unlimited** |
| Profiles | **5** |
| Scenarios | **10/month** |
| Deliverables | **10/month** |

### What You Can Test

#### Scenario Simulator (Plus+)
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **What-If Analysis** | Create scenario | Multiple outcomes calculated |
| **Tax Optimization** | Run tax scenarios | Best strategy identified |
| **Monte Carlo** | Stress testing | Probability distributions |
| **Compare Options** | Side-by-side | Comparative analysis |

#### Deliverable Composer (Plus+)
| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **Audit Plans** | Generate audit plan | Structured document |
| **Tax Memos** | Generate tax memo | Professional memo format |
| **Client Letters** | Generate letter | Formal correspondence |
| **Presentations** | Generate slides | PowerPoint-style output |

#### Export Formats (Plus+)
| Format | Test Method |
|--------|-------------|
| PDF | Export any deliverable to PDF |
| Word | Export to .docx |
| Excel | Export calculations to .xlsx |
| PowerPoint | Export presentations to .pptx |
| TXT | Basic text export |
| CSV | Data tables export |

### Step-by-Step Testing Workflow

1. **Login**
   ```
   Login: plus.business@lucatest.com / Plus123!
   ```

2. **Test Scenario Simulator**
   ```
   Navigate to: /chat
   Select mode: Scenario Simulator
   
   Sample query:
   "Compare incorporation in Delaware vs Nevada for a tech startup 
   with projected revenue of $500K in year 1, growing 50% annually"
   
   ✓ Review comparison table
   ✓ Check multi-year projections
   ✓ Export Excel with formulas
   ```

3. **Test Deliverable Composer**
   ```
   Navigate to: /chat
   Select mode: Deliverable Composer
   
   Sample query:
   "Generate an audit plan for a retail company with $5M revenue"
   
   ✓ Review generated plan
   ✓ Export to Word format
   ✓ Verify professional formatting
   ```

4. **Test Profile Limits**
   ```
   Navigate to: /settings → Profiles
   ✓ Create up to 5 profiles
   ✓ Try creating 6th profile → Error expected
   ```

5. **Check Usage Quotas**
   ```
   Navigate to: /settings → Subscription
   ✓ View queries used vs. limit (X / 3,000)
   ✓ View scenarios remaining (X / 10)
   ✓ View deliverables remaining (X / 10)
   ```

### Limitations
- ❌ No API access
- ❌ No Forensic Intelligence
- ❌ No white-label reports
- ❌ 3,000 query limit (not unlimited)

---

## 🆓 6. Free User

### Account Details
```
Email:    free.home@lucatest.com
Password: Free123!
Tier:     Free
```

### Feature Limits
| Resource | Limit |
|----------|-------|
| Queries | **500/month** |
| Documents | **10/month** |
| Profiles | **1** |
| Scenarios | **0** |
| Deliverables | **0** |

### What You Can Test

#### Basic Chat Modes
| Mode | Available | Description |
|------|-----------|-------------|
| Standard Chat | ✅ | General Q&A |
| Deep Research | ✅ | With citations |
| Checklist | ✅ | Task lists |
| Workflow | ✅ | Process diagrams |
| Audit Plan | ✅ | Basic audit planning |
| Calculation | ✅ | Financial calculations |
| Scenario Simulator | ❌ | Requires Plus+ |
| Deliverable Composer | ❌ | Requires Plus+ |
| Forensic Intelligence | ❌ | Requires Professional+ |
| Roundtable | ❌ | Requires Plus+ |

#### Export Formats (Free)
| Format | Available |
|--------|-----------|
| TXT | ✅ |
| CSV | ✅ |
| PDF | ❌ |
| Word | ❌ |
| Excel | ❌ |
| PowerPoint | ❌ |

### Step-by-Step Testing Workflow

1. **Login**
   ```
   Login: free.home@lucatest.com / Free123!
   ```

2. **Test Available Modes**
   ```
   Navigate to: /chat
   
   Test Standard Chat:
   "What is the difference between LIFO and FIFO?"
   ✓ Should receive helpful response
   
   Test Deep Research:
   "Explain cryptocurrency taxation in the USA with sources"
   ✓ Should include citations
   
   Test Calculation:
   "Calculate NPV for a $100,000 investment with 10% discount rate 
   and cash flows of $30,000 per year for 5 years"
   ✓ Should provide Excel formula
   ```

3. **Test Blocked Features**
   ```
   Try Scenario Simulator mode:
   ✓ Should show upgrade prompt
   
   Try Deliverable Composer:
   ✓ Should show upgrade prompt
   
   Try export to PDF:
   ✓ Should show upgrade prompt
   ```

4. **Test Document Limits**
   ```
   Upload 10 documents:
   ✓ Should succeed
   
   Upload 11th document:
   ✓ Should show limit reached error
   ```

5. **Check Upgrade Prompts**
   ```
   Navigate to: /pricing
   ✓ View available plans
   ✓ Compare features
   ✓ Test upgrade button
   ```

---

## 🆕 7. New User (No Profile)

### Account Details
```
Email:    free.newuser@lucatest.com
Password: NewUser123!
Tier:     Free (No profile created)
```

### What You Can Test

#### Onboarding Flow
| Step | What to Verify |
|------|----------------|
| **First Login** | Welcome modal appears |
| **Profile Prompt** | Prompted to create first profile |
| **Profile Type Selection** | Personal/Business/Family options |
| **Profile Creation** | Can create initial profile |
| **Redirect to Chat** | After profile, goes to chat |

### Step-by-Step Testing Workflow

1. **Login**
   ```
   Login: free.newuser@lucatest.com / NewUser123!
   ```

2. **Observe Onboarding**
   ```
   ✓ Welcome message displayed
   ✓ Onboarding tooltip/guide appears
   ✓ Prompt to create first profile
   ```

3. **Create First Profile**
   ```
   ✓ Choose profile type (Personal recommended)
   ✓ Enter profile name
   ✓ Complete profile setup
   ✓ Verify redirect to /chat
   ```

4. **First Chat Experience**
   ```
   ✓ Tutorial tips appear
   ✓ Sample questions suggested
   ✓ Mode selector explained
   ```

---

## ⚠️ 8. Quota Exhausted User

### Account Details
```
Email:    quota.exhausted@lucatest.com
Password: Quota123!
Tier:     Free (Queries used up)
```

### What You Can Test

#### Quota Enforcement
| Action | Expected Result |
|--------|-----------------|
| Send chat message | "Monthly query limit reached" error |
| Upload document | May work (separate limit) |
| View history | Should work (read-only) |
| Access settings | Should work |

### Step-by-Step Testing Workflow

1. **Login**
   ```
   Login: quota.exhausted@lucatest.com / Quota123!
   ```

2. **Test Quota Error**
   ```
   Navigate to: /chat
   Send any message
   
   Expected response:
   ✓ Error: "Monthly query limit reached. Please upgrade to continue."
   ✓ Upgrade button displayed
   ✓ Link to /pricing
   ```

3. **Verify Read Access**
   ```
   ✓ Can view past conversations
   ✓ Can view settings
   ✓ Can view usage statistics
   ```

4. **Test Upgrade Path**
   ```
   Click upgrade button
   ✓ Navigates to /pricing
   ✓ Shows available plans
   ✓ Plus plan highlighted as solution
   ```

---

## 🔐 9. MFA Enabled User

### Account Details
```
Email:    mfa.enabled@lucatest.com
Password: MFA123!
Tier:     Professional (MFA enabled)
```

### What You Can Test

#### Two-Factor Authentication
| Flow | What to Verify |
|------|----------------|
| **Login Step 1** | Email/password accepted |
| **MFA Prompt** | TOTP code requested |
| **Valid Code** | Access granted |
| **Invalid Code** | Error shown, retry allowed |
| **Backup Codes** | Can use backup code instead |

### Step-by-Step Testing Workflow

1. **Login with Password**
   ```
   Navigate to: /auth
   Enter: mfa.enabled@lucatest.com / MFA123!
   Click Login
   ```

2. **MFA Code Entry**
   ```
   ✓ MFA code input screen appears
   ✓ Enter TOTP from authenticator app
   ✓ Or use backup code
   ```

3. **Test Invalid Code**
   ```
   Enter incorrect code: 000000
   ✓ Error: "Invalid verification code"
   ✓ Can retry
   ```

4. **Test Backup Codes**
   ```
   Click "Use backup code"
   Enter one of the backup codes
   ✓ Access granted
   ✓ Backup code marked as used
   ```

5. **Manage MFA Settings**
   ```
   After login, navigate to: /settings → Security
   ✓ View backup codes
   ✓ Regenerate backup codes
   ✓ Disable MFA (with confirmation)
   ```

---

## 🔒 10. Locked Account User

### Account Details
```
Email:    locked.account@lucatest.com
Password: Locked123!
Tier:     Free (Account locked due to failed attempts)
```

### What You Can Test

#### Account Lockout
| Scenario | Expected Behavior |
|----------|-------------------|
| Login attempt | "Account locked" error |
| Lockout duration | Shows time remaining |
| Password reset | Available option |
| Support contact | Link provided |

### Step-by-Step Testing Workflow

1. **Attempt Login**
   ```
   Navigate to: /auth
   Enter: locked.account@lucatest.com / Locked123!
   ```

2. **Observe Lockout**
   ```
   Expected:
   ✓ Error: "Account is locked due to too many failed attempts"
   ✓ Shows: "Try again in X minutes"
   ✓ "Forgot password?" link available
   ```

3. **Test Recovery Options**
   ```
   Click "Forgot password?"
   ✓ Password reset form appears
   ✓ Enter email
   ✓ "Reset link sent" confirmation
   ```

4. **Wait for Unlock**
   ```
   After lockout period (default: 15 minutes):
   ✓ Login should work again
   ✓ Failed attempt counter reset
   ```

---

## 🔧 Developer Testing Tools

### Useful API Endpoints for Testing

```bash
# Check user quota
curl http://localhost:3000/api/subscription/quota \
  -H "Cookie: your-session-cookie"

# Get agent capabilities
curl http://localhost:3000/api/agents/capabilities/deep-research

# Check system health (Super Admin)
curl http://localhost:3000/api/admin/system/health

# Verify authentication
curl http://localhost:3000/api/user \
  -H "Cookie: your-session-cookie"
```

### Database Queries for Testing

```sql
-- Reset user's query count for testing
UPDATE usage_quotas 
SET queries_used = 0 
WHERE user_id = (SELECT id FROM users WHERE email = 'your-test-email');

-- Unlock a locked account
UPDATE users 
SET locked_until = NULL, failed_login_attempts = 0 
WHERE email = 'locked.account@lucatest.com';

-- Change subscription tier
UPDATE users 
SET subscription_tier = 'professional' 
WHERE email = 'free.home@lucatest.com';
```

---

## 📝 Testing Checklist Summary

### Authentication Tests
- [ ] Login with valid credentials (all user types)
- [ ] Login with invalid password → Error
- [ ] Login with non-existent email → Error
- [ ] MFA login flow complete
- [ ] Locked account behavior
- [ ] Password reset flow
- [ ] Logout functionality

### Authorization Tests
- [ ] Free user blocked from premium features
- [ ] Plus user blocked from Professional features
- [ ] Admin access to admin panel
- [ ] Super Admin access to system monitoring
- [ ] Non-admin blocked from admin routes

### Feature Tests by Tier
- [ ] Free: 6 basic chat modes, TXT/CSV export
- [ ] Plus: + Scenario Simulator, Deliverable Composer, all exports
- [ ] Professional: + API, Forensic Intelligence, white-label
- [ ] Enterprise: + Teams, SSO, custom AI
- [ ] Admin: + User/subscription management
- [ ] Super Admin: + System monitoring, deployments

### Quota Tests
- [ ] Query limit enforcement
- [ ] Document limit enforcement
- [ ] Profile limit enforcement
- [ ] Upgrade prompts appear correctly
- [ ] Usage statistics accurate

---

## 🆘 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Can't login | Clear cookies, check credentials case-sensitivity |
| Admin panel 403 | Verify user.isAdmin = true in database |
| System monitoring 403 | Add email to SUPER_ADMIN_EMAILS env var |
| MFA not working | Sync device time, regenerate TOTP secret |
| Quota not resetting | Check usage_quotas table, reset monthly |

### Logs to Check
```bash
# Server logs
npm run dev  # Watch console output

# Look for patterns:
[Auth] Login attempt for: email
[SuperAdmin] Access denied for: email
[Quota] User exceeded limit: userId
```

---

**Happy Testing! 🚀**

For issues or feature requests, create a GitHub issue or contact the development team.
