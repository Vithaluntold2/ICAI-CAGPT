# 📖 ICAI CAGPT Step-by-Step User Guide

🌐 **Website**: https://cagpt.icai.org

🔑 **Password for ALL users**: `TestPassword123!`

---

## 📋 Table of Contents

1. [User Login Order](#user-login-order)
2. [Super Admin - Complete Guide](#1-super-admin---complete-guide)
3. [Admin - Complete Guide](#2-admin---complete-guide)
4. [Enterprise User - Complete Guide](#3-enterprise-user---complete-guide)
5. [Professional User - Complete Guide](#4-professional-user---complete-guide)
6. [Plus User - Complete Guide](#5-plus-user---complete-guide)
7. [Free User - Complete Guide](#6-free-user---complete-guide)
8. [Quick Reference: All Users](#quick-reference-all-users)

---

## User Login Order

### Which User to Login First?

Recommended order for testing:

| Order | User | Why First? |
|-------|------|------------|
| 1st | Super Admin | Creates system, monitors everything |
| 2nd | Admin | Manages users, creates coupons |
| 3rd | Enterprise | Tests all premium features |
| 4th | Professional | Tests API and forensics |
| 5th | Plus | Tests scenarios and deliverables |
| 6th | Free | Tests basic features and limits |

---

## 1. Super Admin - Complete Guide

### 🔐 Login Credentials

| Field | Value |
|-------|-------|
| **Email** | `superadmin@lucatest.com` |
| **Password** | `TestPassword123!` |

### STEP 1: Login

1. Open browser
2. Go to: `https://cagpt.icai.org/auth`
3. Type email: `superadmin@lucatest.com`
4. Type password: `TestPassword123!`
5. Click **"Sign In"** button

### STEP 2: What You See After Login

You will see the **CHAT PAGE**:

```
┌────────────────────────────────────────────────────────────────┐
│  🏠 CA GPT                              [👤 Super Admin ▼]       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────┐  ┌─────────────────────────────┐      │
│  │                     │  │                             │      │
│  │   Chat History      │  │      Output Pane            │      │
│  │                     │  │   (Results appear here)     │      │
│  │  - Conversation 1   │  │                             │      │
│  │  - Conversation 2   │  │                             │      │
│  │                     │  │                             │      │
│  └─────────────────────┘  └─────────────────────────────┘      │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Type your message...              [Mode ▼]     [Send]    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

**What you can do here:**
- ✅ Ask any question
- ✅ Upload documents
- ✅ Use all 10 chat modes
- ✅ Export to any format

### STEP 3: Access Admin Panel

1. Look at top-right corner
2. Click on `[👤 Super Admin ▼]` (your profile)
3. You see a dropdown menu:
```
┌─────────────────────┐
│ ⚙️ Settings         │
│ 👑 Admin Panel      │ ← Click this!
│ 🚪 Logout           │
└─────────────────────┘
```
4. Click **"Admin Panel"**

### STEP 4: What You See in Admin Panel

You will see the **ADMIN DASHBOARD**:

```
┌────────────────────────────────────────────────────────────────┐
│  👑 CA GPT Admin                        [👤 Super Admin ▼]       │
├──────────────┬─────────────────────────────────────────────────┤
│              │                                                 │
│ 📊 Dashboard │  DASHBOARD                                      │
│              │                                                 │
│ 📈 System    │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│    Monitor   │  │Total     │  │Active    │  │Monthly   │       │
│              │  │Users     │  │Subs      │  │Revenue   │       │
│ 🏷️ Coupons   │  │   156    │  │   89     │  │  $4,521  │       │
│              │  └──────────┘  └──────────┘  └──────────┘       │
│ 👥 Users     │                                                 │
│              │  ┌──────────┐  ┌──────────┐                     │
│ 💳 Subs      │  │Queries   │  │Documents │                     │
│              │  │  12,456  │  │   8,234  │                     │
│ 📉 Analytics │  └──────────┘  └──────────┘                     │
│              │                                                 │
└──────────────┴─────────────────────────────────────────────────┘
```

**Left sidebar menu (Super Admin sees ALL):**

| Menu Item | What It Does |
|-----------|--------------|
| 📊 Dashboard | Overview statistics |
| 📈 System Monitor | **SUPER ADMIN ONLY** - Server health |
| 🏷️ Coupons | Create discount codes |
| 👥 Users | Manage all users |
| 💳 Subscriptions | View all subscriptions |
| 📉 Analytics | Usage statistics |

### STEP 5: Access System Monitoring (Super Admin Only)

1. In Admin Panel, look at left sidebar
2. Click **"📈 System Monitor"**
3. Or go directly to: `https://cagpt.icai.org/admin/system-monitoring`

### STEP 6: What You See in System Monitoring

```
┌────────────────────────────────────────────────────────────────┐
│  System Monitoring                  [Deploy ▼] [Maintenance]   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              SYSTEM HEALTH SCORE                         │  │
│  │  ████████████████████████████░░░░░░  95/100  Healthy     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │ CPU Usage  │  │  Memory    │  │  Uptime    │  │  Alerts    ││
│  │    45%     │  │    62%     │  │  14 days   │  │     0      ││
│  │   Good     │  │   Good     │  │   Good     │  │   None     ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                │
│  COMPONENT HEALTH                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ 🗄️ Database     │  │ 💾 Cache        │  │ AI Providers    │ │
│  │   Connected     │  │   Connected     │  │    Healthy      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                │
│  SECURITY THREATS (Last 24h)                                   │
│  ┌────────────┬──────────┬─────────────┬──────────┐            │
│  │    Type    │ Severity │ IP Address  │  Status  │            │
│  ├────────────┼──────────┼─────────────┼──────────┤            │
│  │ brute_force│   high   │ 192.168.1.1 │ Blocked  │            │
│  │ sql_inject │  🔴 crit │  10.0.0.5   │ Blocked  │            │
│  └────────────┴──────────┴─────────────┴──────────┘            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**What each section means:**

| Section | What It Shows | Good Value |
|---------|---------------|------------|
| Health Score | Overall system health | 95-100 |
| CPU Usage | Server processor load | Below 80% |
| Memory | RAM usage | Below 85% |
| Uptime | How long running | Higher = better |
| Alerts | Problems to fix | 0 |
| Component Health | Each system part | All Green |
| Security Threats | Blocked attacks | Shows what was stopped |

### STEP 7: Deploy New Version (Super Admin Only)

1. In System Monitoring page
2. Click **"Deploy Update"** button (top-right, blue)
3. Fill the form:
```
┌─────────────────────────────────────────┐
│        Deploy New Version               │
├─────────────────────────────────────────┤
│  Version:  [ v1.2.3              ]      │
│                                         │
│  Changes:                               │
│  ┌─────────────────────────────────┐    │
│  │ - Fixed login bug               │    │
│  │ - Added new feature             │    │
│  │ - Performance improvements      │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Cancel]         [Start Deployment]    │
└─────────────────────────────────────────┘
```
4. Click **"Start Deployment"**
5. Watch progress:
   - 🔵 In Progress → Wait
   - ✅ Completed → Success!
   - 🔴 Failed → Click "Rollback"

### STEP 8: Schedule Maintenance (Super Admin Only)

1. In System Monitoring page
2. Click **"Schedule Maintenance"** button (top-right)
3. Fill the form:
```
┌─────────────────────────────────────────┐
│       Schedule Maintenance              │
├─────────────────────────────────────────┤
│  Start:    [ 2026-01-10 02:00 ]         │
│  End:      [ 2026-01-10 04:00 ]         │
│  Reason:   [ Database upgrade  ]        │
│  Services: [ database, cache   ]        │
│                                         │
│  [Cancel]      [Schedule Maintenance]   │
└─────────────────────────────────────────┘
```
4. Click **"Schedule Maintenance"**
5. ✅ Users will be notified before maintenance

### STEP 9: Manage Users

1. In Admin Panel, click **"👥 Users"** in sidebar
2. Or go to: `https://cagpt.icai.org/admin/users`

**What you see:**

```
┌────────────────────────────────────────────────────────────────┐
│  User Management                                               │
├────────────────────────────────────────────────────────────────┤
│  🔍 Search: [                                        ]         │
├────────────────────────────────────────────────────────────────┤
│  Name           │ Email                │ Tier   │Admin│Actions │
├─────────────────┼──────────────────────┼────────┼─────┼────────┤
│  John Doe       │ john@example.com     │ Free   │     │[Edit]  │
│  Jane Smith     │ jane@company.com     │ Plus   │     │[Edit]  │
│  Bob Admin      │ admin@lucatest.com   │ Enter. │ 👑  │[Edit]  │
└─────────────────┴──────────────────────┴────────┴─────┴────────┘
```

**To change user's subscription:**
1. Find user (use Search box)
2. Click "Edit" on their row
3. Change Tier dropdown to: Free / Plus / Professional / Enterprise
4. Click "Save"

**To make someone Admin:**
1. Find user
2. Click "Make Admin" button
3. ✅ User now sees 👑 and can access Admin Panel

**To remove Admin:**
1. Find admin user (has 👑)
2. Click "Remove Admin"
3. ✅ They can no longer access Admin Panel

### STEP 10: Create Coupon

1. In Admin Panel, click **"🏷️ Coupons"** in sidebar
2. Or go to: `https://cagpt.icai.org/admin/coupons`
3. Click **"+ Create Coupon"** button
4. Fill form:

| Field | Enter | Example |
|-------|-------|---------|
| Code | Discount code | `SAVE20` |
| Description | What it's for | `20% off first month` |
| Type | Percentage or Fixed | `Percentage` |
| Value | Amount | `20` |
| Max Uses | Total uses allowed | `100` |
| Active | Toggle ON | ✅ |

5. Click **"Create Coupon"**
6. ✅ Users can now use this code!

### Super Admin Summary: What You Can See

| Page | URL | What You Do |
|------|-----|-------------|
| Chat | `/chat` | Ask questions, upload docs |
| Settings | `/settings` | Your profile, password |
| Dashboard | `/admin` | View statistics |
| System Monitor | `/admin/system-monitoring` | Server health, deploy, maintenance |
| Users | `/admin/users` | Manage all users |
| Coupons | `/admin/coupons` | Create discount codes |
| Subscriptions | `/admin/subscriptions` | View all subscriptions |
| Analytics | `/admin/analytics` | Usage data |

---

## 2. Admin - Complete Guide

### 🔐 Login Credentials

| Field | Value |
|-------|-------|
| **Email** | `admin@lucatest.com` |
| **Password** | `TestPassword123!` |

### STEP 1: Login

1. Open browser
2. Go to: `https://cagpt.icai.org/auth`
3. Type email: `admin@lucatest.com`
4. Type password: `TestPassword123!`
5. Click **"Sign In"** button

### STEP 2: What You See After Login

Same as Super Admin - You see the **CHAT PAGE**

You can:
- ✅ Ask any question
- ✅ Upload documents
- ✅ Use all 10 chat modes
- ✅ Export to any format

### STEP 3: Access Admin Panel

1. Click your profile (top-right)
2. Click **"Admin Panel"**

### STEP 4: What You See in Admin Panel

**DIFFERENT from Super Admin!**

Admin sees this sidebar:
```
┌──────────────────┐
│ 📊 Dashboard     │
│ 🏷️ Coupons       │
│ 👥 Users         │
│ 💳 Subscriptions │
│ 📉 Analytics     │
└──────────────────┘
```

❌ **Admin does NOT see:**
- System Monitor
- Deploy button
- Maintenance button

*These are Super Admin only.*

### STEP 5: View Dashboard

1. Click **"📊 Dashboard"** in sidebar
2. You see statistics cards:

| Card | Shows |
|------|-------|
| Total Users | How many registered |
| Active Subscriptions | Paying users |
| Monthly Revenue | Money this month |
| Queries | Total AI questions |
| Documents | Files processed |
| Churn Rate | Users who left |

### STEP 6: Manage Users

1. Click **"👥 Users"** in sidebar
2. Search for user by name or email
3. **Change subscription:** Click Edit → Change Tier → Save
4. **Make admin:** Click "Make Admin" button
5. **Remove admin:** Click "Remove Admin" button

### STEP 7: Create Coupons

1. Click **"🏷️ Coupons"** in sidebar
2. Click **"+ Create Coupon"**
3. Fill form (Code, Discount, etc.)
4. Click **"Create Coupon"**

### STEP 8: View Subscriptions

1. Click **"💳 Subscriptions"** in sidebar
2. See all subscribers:
   - User name
   - Email
   - Plan (Free/Plus/Pro/Enterprise)
   - Status (Active/Expired/Cancelled)
   - Valid until date
3. Filter by Status or Plan using dropdowns

### Admin Summary: What You Can See

| Page | URL | What You Do |
|------|-----|-------------|
| Chat | `/chat` | Ask questions, upload docs |
| Settings | `/settings` | Your profile, password |
| Dashboard | `/admin` | View statistics |
| Users | `/admin/users` | Manage all users |
| Coupons | `/admin/coupons` | Create discount codes |
| Subscriptions | `/admin/subscriptions` | View all subscriptions |
| Analytics | `/admin/analytics` | Usage data |

❌ **Admin CANNOT see:**
- System Monitoring
- Deployments
- Maintenance Scheduling

---

## 3. Enterprise User - Complete Guide

### 🔐 Login Credentials

| Field | Value |
|-------|-------|
| **Email** | `enterprise.owner@lucatest.com` |
| **Password** | `TestPassword123!` |

### STEP 1: Login

1. Open browser
2. Go to: `https://cagpt.icai.org/auth`
3. Type email: `enterprise.owner@lucatest.com`
4. Type password: `TestPassword123!`
5. Click **"Sign In"** button

### STEP 2: What You See After Login

You see the **CHAT PAGE**

```
┌────────────────────────────────────────────────────────────────┐
│  🏠 CA GPT                           [👤 Enterprise User ▼]      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│          Chat area                     Output Pane             │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Type your message...              [Mode ▼]     [Send]    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### STEP 3: Click Your Profile

1. Click your profile (top-right)
2. You see dropdown:
```
┌─────────────────────┐
│ ⚙️ Settings         │ ← Click for settings
│ 🚪 Logout           │
└─────────────────────┘
```

❌ **Enterprise does NOT see "Admin Panel"**
> Only Admins and Super Admins see Admin Panel

### STEP 4: Use All 10 Chat Modes

1. In chat, click `[Mode ▼]` dropdown
2. You see **ALL 10 modes**:

| # | Mode | Click to Use |
|---|------|--------------|
| 1 | 💬 Standard Chat | General questions |
| 2 | ✨ Deep Research | Research with sources |
| 3 | ✅ Create Checklist | Task lists |
| 4 | 🔗 Workflow | Process diagrams |
| 5 | 📊 Audit Plan | Audit strategies |
| 6 | 🔢 Financial Calculation | NPV, IRR, tax |
| 7 | 📈 Scenario Simulator | Compare options |
| 8 | 📝 Deliverable Composer | Create documents |
| 9 | 🔍 Forensic Intelligence | Fraud detection |
| 10 | 👥 Roundtable | Multi-expert opinions |

3. Select a mode
4. Type your question
5. Press Enter

### STEP 5: Ask a Question

**Example with Standard Chat:**
1. Select "💬 Standard Chat" mode
2. Type: `What is depreciation?`
3. Press Enter
4. See answer in Output Pane (right side)

**Example with Scenario Simulator:**
1. Select "📈 Scenario Simulator" mode
2. Type: `Compare LLC vs S-Corp for a $200K revenue business`
3. Press Enter
4. See comparison table, charts, recommendation

**Example with Financial Calculation:**
1. Select "🔢 Financial Calculation" mode
2. Type: `Calculate NPV for $100,000 investment at 10% rate over 5 years with $30,000 annual cash flows`
3. Press Enter
4. See Excel formulas and download button

### STEP 6: Upload a Document

1. Click 📎 (paperclip icon) in chat
2. Select file from your computer (PDF, Word, Excel)
3. File uploads
4. Type question about the file: `Summarize this document`
5. Press Enter
6. AI analyzes and responds

### STEP 7: Export Results

1. After getting a response, look at Output Pane (right side)
2. Click **"Export"** button at top
3. Choose format:
   - 📄 PDF
   - 📝 Word
   - 📊 Excel
   - 📽️ PowerPoint
   - 📋 TXT
   - 📈 CSV
4. File downloads to your computer

### STEP 8: Access Settings

1. Click your profile (top-right)
2. Click **"Settings"**
3. Or go to: `https://cagpt.icai.org/settings`

**Settings tabs:**

| Tab | What You Can Do |
|-----|-----------------|
| Profile | Change name, email, photo |
| Security | Change password, enable MFA |
| Subscription | See your plan, usage |
| Team | Manage team members (Enterprise only) |
| Branding | Set your logo, colors (Enterprise only) |
| Preferences | Dark mode, language |

### STEP 9: Manage Team (Enterprise Only)

1. Go to Settings
2. Click **"Team"** tab
3. Click **"Invite Member"**
4. Enter their email
5. Select role: Member / Manager
6. Click **"Send Invitation"**
7. ✅ They receive email invitation

### STEP 10: Set Up White-Label Branding (Enterprise Only)

1. Go to Settings
2. Click **"Branding"** tab
3. Upload your company logo
4. Choose your brand colors
5. Click **"Save"**
6. ✅ All exports now have your branding

### Enterprise Summary: What You Can See

| Page | URL | What You Do |
|------|-----|-------------|
| Chat | `/chat` | Ask questions, all 10 modes |
| Settings | `/settings` | Profile, team, branding |

❌ **Enterprise CANNOT see:**
- Admin Panel
- User Management
- System Monitoring

---

## 4. Professional User - Complete Guide

### 🔐 Login Credentials

| Field | Value |
|-------|-------|
| **Email** | `professional.cpa@lucatest.com` |
| **Password** | `TestPassword123!` |

### STEP 1: Login

1. Open browser
2. Go to: `https://cagpt.icai.org/auth`
3. Type email: `professional.cpa@lucatest.com`
4. Type password: `TestPassword123!`
5. Click **"Sign In"** button

### STEP 2: What You See After Login

You see the **CHAT PAGE** (same as Enterprise)

### STEP 3: What Professional Can Do

| Feature | Available? |
|---------|------------|
| All 10 Chat Modes | ✅ Yes |
| All Export Formats | ✅ Yes |
| Unlimited Queries | ✅ Yes |
| Unlimited Documents | ✅ Yes |
| API Access | ✅ Yes |
| Forensic Intelligence | ✅ Yes |
| White-Label Reports | ✅ Yes |
| Team Management | ❌ No (Enterprise only) |
| SSO/SAML | ❌ No (Enterprise only) |

### STEP 4: Use Forensic Intelligence

1. Click Mode dropdown
2. Select **"🔍 Forensic Intelligence"**
3. Upload financial documents (optional)
4. Ask: `Analyze these transactions for fraud indicators`
5. Press Enter
6. See:
   - Risk scores
   - Anomaly detection
   - Pattern analysis
   - Forensic report

### STEP 5: Generate API Key

1. Go to Settings: `https://cagpt.icai.org/settings`
2. Click **"API"** tab
3. Click **"Generate API Key"**
4. Copy the key (save it - won't show again!)
5. Use in your applications:

```bash
curl -X POST https://cagpt.icai.org/api/v1/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"message": "What is depreciation?"}'
```

### STEP 6: Set Up White-Label Reports

1. Go to Settings
2. Click **"Branding"** tab
3. Upload logo
4. Set colors
5. Save
6. ✅ All exports have your branding

### Professional Summary: What You Can See

| Page | URL | What You Do |
|------|-----|-------------|
| Chat | `/chat` | All 10 modes, forensics |
| Settings | `/settings` | Profile, API key, branding |

❌ **Professional CANNOT see:**
- Admin Panel
- Team Management

---

## 5. Plus User - Complete Guide

### 🔐 Login Credentials

| Field | Value |
|-------|-------|
| **Email** | `plus.business@lucatest.com` |
| **Password** | `TestPassword123!` |

### STEP 1: Login

1. Open browser
2. Go to: `https://cagpt.icai.org/auth`
3. Type email: `plus.business@lucatest.com`
4. Type password: `TestPassword123!`
5. Click **"Sign In"** button

### STEP 2: What You See After Login

You see the **CHAT PAGE**

### STEP 3: What Plus Can Do

| Feature | Limit |
|---------|-------|
| Queries | 3,000/month |
| Documents | Unlimited |
| Profiles | 5 |
| Chat Modes | 8 of 10 |
| Export Formats | All |

**Available modes:**
- ✅ Standard Chat
- ✅ Deep Research
- ✅ Create Checklist
- ✅ Workflow
- ✅ Audit Plan
- ✅ Financial Calculation
- ✅ Scenario Simulator
- ✅ Deliverable Composer
- ❌ Forensic Intelligence (Professional only)
- ❌ Roundtable (Professional only)

### STEP 4: Use Scenario Simulator

1. Click Mode dropdown
2. Select **"📈 Scenario Simulator"**
3. Type: `Compare Delaware LLC vs California LLC for a tech startup`
4. Press Enter
5. See:
   - Side-by-side comparison
   - 5-year projections
   - Cost analysis
   - Recommendation
   - Download Excel button

### STEP 5: Use Deliverable Composer

1. Click Mode dropdown
2. Select **"📝 Deliverable Composer"**
3. Type: `Create an audit engagement letter for ABC Corp`
4. Press Enter
5. See professional document
6. Click Export → Word or PDF

### STEP 6: Check Your Usage

1. Go to Settings: `https://cagpt.icai.org/settings`
2. Click **"Subscription"** tab
3. See your usage:
```
Queries:      1,234 / 3,000  (41% used)
Scenarios:    4 / 10         (40% used)
Deliverables: 7 / 10         (70% used)
Profiles:     3 / 5          (60% used)
```

### STEP 7: What Happens If You Try Blocked Features

If you click Forensic Intelligence:
```
┌─────────────────────────────────────────┐
│           ⬆️ Upgrade Required            │
│                                         │
│  Forensic Intelligence requires         │
│  Professional plan.                     │
│                                         │
│       [View Plans]  [Maybe Later]       │
└─────────────────────────────────────────┘
```
Click "View Plans" to upgrade.

### Plus Summary: What You Can See

| Page | URL | What You Do |
|------|-----|-------------|
| Chat | `/chat` | 8 modes, scenarios, deliverables |
| Settings | `/settings` | Profile, usage |

❌ **Plus CANNOT see/use:**
- Admin Panel
- Forensic Intelligence
- Roundtable Mode
- API Access

---

## 6. Free User - Complete Guide

### 🔐 Login Credentials

| Field | Value |
|-------|-------|
| **Email** | `free.home@lucatest.com` |
| **Password** | `TestPassword123!` |

### STEP 1: Login

1. Open browser
2. Go to: `https://cagpt.icai.org/auth`
3. Type email: `free.home@lucatest.com`
4. Type password: `TestPassword123!`
5. Click **"Sign In"** button

### STEP 2: What You See After Login

You see the **CHAT PAGE**

### STEP 3: What Free Can Do

| Feature | Limit |
|---------|-------|
| Queries | 500/month |
| Documents | 10/month |
| Profiles | 1 |
| Chat Modes | 6 of 10 |
| Export Formats | TXT, CSV only |

**Available modes:**
- ✅ Standard Chat
- ✅ Deep Research
- ✅ Create Checklist
- ✅ Workflow
- ✅ Audit Plan
- ✅ Financial Calculation
- ❌ Scenario Simulator (Plus only)
- ❌ Deliverable Composer (Plus only)
- ❌ Forensic Intelligence (Professional only)
- ❌ Roundtable (Professional only)

### STEP 4: Use Basic Chat

1. Mode is already "💬 Standard Chat"
2. Type: `What tax deductions can I claim as a freelancer?`
3. Press Enter
4. See answer in Output Pane

### STEP 5: Use Financial Calculation

1. Click Mode dropdown
2. Select **"🔢 Financial Calculation"**
3. Type: `Calculate depreciation for a $50,000 vehicle over 5 years`
4. Press Enter
5. See Excel formulas
6. Export as CSV (TXT also available)

### STEP 6: What Happens When Blocked

**If you click Scenario Simulator:**
```
┌─────────────────────────────────────────┐
│           ⬆️ Upgrade Required            │
│                                         │
│  Scenario Simulator requires Plus plan. │
│                                         │
│       [View Plans]  [Maybe Later]       │
└─────────────────────────────────────────┘
```

**If you try PDF export:**
```
┌─────────────────────────────────────────┐
│           ⬆️ Upgrade Required            │
│                                         │
│  PDF export requires Plus plan.         │
│                                         │
│       [Upgrade]  [Export as TXT]        │
└─────────────────────────────────────────┘
```

### STEP 7: What Happens When Quota Runs Out

**After using 500 queries:**
```
┌─────────────────────────────────────────┐
│        ❌ Monthly Limit Reached          │
│                                         │
│  You've used all 500 queries.           │
│  Resets: February 1, 2026               │
│                                         │
│    [Upgrade to Plus]  [View Plans]      │
└─────────────────────────────────────────┘
```

**What you can still do:**
- ✅ View past conversations
- ✅ Export previous results
- ✅ View settings
- ❌ Ask new questions

### STEP 8: How to Upgrade

1. Go to: `https://cagpt.icai.org/pricing`
2. Compare plans:
```
┌─────────┬─────────┬──────────────┬────────────┐
│  FREE   │  PLUS   │ PROFESSIONAL │ ENTERPRISE │
│  $0/mo  │ $29/mo  │   $49/mo     │   Custom   │
├─────────┼─────────┼──────────────┼────────────┤
│500 query│3K query │  Unlimited   │ Unlimited  │
│10 docs  │Unlimited│  Unlimited   │ Unlimited  │
│6 modes  │8 modes  │  10 modes    │ 10 modes   │
│TXT/CSV  │All exp  │  API access  │ Team mgmt  │
└─────────┴─────────┴──────────────┴────────────┘
```
3. Click **"Select"** on desired plan
4. Enter payment info
5. Click **"Subscribe"**
6. ✅ Features unlock immediately!

### Free Summary: What You Can See

| Page | URL | What You Do |
|------|-----|-------------|
| Chat | `/chat` | 6 basic modes |
| Settings | `/settings` | Profile only |

❌ **Free CANNOT see/use:**
- Admin Panel
- Scenario Simulator
- Deliverable Composer
- Forensic Intelligence
- Roundtable
- PDF/Word/Excel/PowerPoint export

---

## Quick Reference: All Users

### All Login Credentials

| User | Email | Password |
|------|-------|----------|
| Super Admin | `superadmin@lucatest.com` | `TestPassword123!` |
| Admin | `admin@lucatest.com` | `TestPassword123!` |
| Enterprise | `enterprise.owner@lucatest.com` | `TestPassword123!` |
| Professional | `professional.cpa@lucatest.com` | `TestPassword123!` |
| Plus | `plus.business@lucatest.com` | `TestPassword123!` |
| Free | `free.home@lucatest.com` | `TestPassword123!` |

### What Each User Sees After Login

| User | Sees Chat | Sees Admin Panel | Sees System Monitor |
|------|-----------|------------------|---------------------|
| Super Admin | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ❌ |
| Enterprise | ✅ | ❌ | ❌ |
| Professional | ✅ | ❌ | ❌ |
| Plus | ✅ | ❌ | ❌ |
| Free | ✅ | ❌ | ❌ |

### Feature Access by User

| Feature | Free | Plus | Pro | Enterprise | Admin | Super |
|---------|------|------|-----|------------|-------|-------|
| Standard Chat | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deep Research | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Checklist | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Workflow | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Audit Plan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Calculation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Scenario Sim | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deliverable | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Forensic | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Roundtable | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| PDF Export | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Team Mgmt | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Admin Panel | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| System Monitor | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Deploy | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

© 2026 ICAI CAGPT. All Rights Reserved.

*End of Guide*
