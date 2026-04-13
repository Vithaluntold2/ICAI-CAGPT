# 📋 ICAI CAGPT Complete Testing Guide

> **🌐 Production URL**: https://cagpt.icai.org  
> **📅 Last Updated**: January 2026

---

## 🚀 FIRST: Create Test Users

> ⚠️ **IMPORTANT**: Test users must be created before testing. Run this command:
> ```bash
> npx tsx scripts/seed-test-users.ts
> ```

---

## 🎯 Before You Start

### Prerequisites
1. Open your web browser (Chrome, Firefox, Safari, or Edge)
2. Make sure you have internet connection
3. Have this guide open for reference
4. **Ensure test users have been seeded** (see above)

### How to Login (All Users)
1. Go to **https://cagpt.icai.org/auth**
2. Enter your **Email** from the table below
3. Enter the **Password** from the table below
4. Click the **"Sign In"** button
5. Wait for the page to load

---

## 🔑 Test User Credentials

**Password for ALL users**: `TestPassword123!`

| User Type | Email | Password |
|-----------|-------|----------|
| **Super Admin** | `superadmin@cagpttest.com` | `TestPassword123!` |
| **Admin** | `admin@cagpttest.com` | `TestPassword123!` |
| **Enterprise** | `enterprise.owner@cagpttest.com` | `TestPassword123!` |
| **Professional** | `professional.cpa@cagpttest.com` | `TestPassword123!` |
| **Plus** | `plus.business@cagpttest.com` | `TestPassword123!` |
| **Free** | `free.home@cagpttest.com` | `TestPassword123!` |
| **New User** | `free.newuser@cagpttest.com` | `TestPassword123!` |
| **Quota Limit** | `quota.exhausted@cagpttest.com` | `TestPassword123!` |
| **MFA Enabled** | `mfa.enabled@cagpttest.com` | `TestPassword123!` |
| **Locked Account** | `locked.account@cagpttest.com` | `TestPassword123!` |

> ⚠️ **IMPORTANT**: Before testing Super Admin features, add the email to your environment:
> ```
> SUPER_ADMIN_EMAILS=superadmin@cagpttest.com
> ```

---

## 📖 How to Use This Guide

1. Find your user type in the Table of Contents below
2. Follow the step-by-step instructions
3. Each section shows:
   - **What You'll See**: Screenshots/descriptions of the interface
   - **How to Access**: Exact URLs and click paths
   - **What to Test**: Specific actions and expected results

---

# Table of Contents

1. [Super Admin User](#1-super-admin-user)
2. [Admin User](#2-admin-user)
3. [Enterprise User](#3-enterprise-user)
4. [Professional User](#4-professional-user)
5. [Plus User](#5-plus-user)
6. [Free User](#6-free-user)
7. [New User](#7-new-user-onboarding)
8. [Quota Limit User](#8-quota-limit-user)
9. [MFA Enabled User](#9-mfa-enabled-user)
10. [Locked Account User](#10-locked-account-user)

---

# 1. Super Admin User

## 🔐 Login Details
| Field | Value |
|-------|-------|
| Email | `superadmin@cagpttest.com` |
| Password | `TestPassword123!` |
| Role | Super Admin (highest access) |

## ✅ What Super Admin Can Do

Super Admin has access to **EVERYTHING** including:

| Feature | Access | Location |
|---------|--------|----------|
| Chat & Documents | ✅ Yes | https://cagpt.icai.org/chat |
| All Chat Modes | ✅ Yes | Chat page mode selector |
| Admin Dashboard | ✅ Yes | https://cagpt.icai.org/admin |
| User Management | ✅ Yes | https://cagpt.icai.org/admin/users |
| Subscription Management | ✅ Yes | https://cagpt.icai.org/admin/subscriptions |
| Coupon Management | ✅ Yes | https://cagpt.icai.org/admin/coupons |
| **System Monitoring** | ✅ **EXCLUSIVE** | https://cagpt.icai.org/admin/system-monitoring |
| **Deployments** | ✅ **EXCLUSIVE** | System Monitoring page |
| **Maintenance Scheduling** | ✅ **EXCLUSIVE** | System Monitoring page |

---

## 📝 Step-by-Step: How to Login

**Step 1:** Open your browser

**Step 2:** Go to the login page
```
https://cagpt.icai.org/auth
```

**Step 3:** Fill in the login form
- In the **Email** field, type: `superadmin@cagpttest.com`
- In the **Password** field, type: `TestPassword123!`

**Step 4:** Click the **"Sign In"** button

**Step 5:** Wait for redirect
- ✅ **Success**: You will see the Chat page
- ✅ **Success**: Your name appears in top-right corner
- ❌ **If Error**: Check email/password spelling

---

## 📝 Step-by-Step: How to Access Admin Panel

**Step 1:** After logging in, look at the **top-right corner** of the screen

**Step 2:** Click on your **profile icon** (circle with your initials)

**Step 3:** A dropdown menu will appear with these options:
- Settings
- **Admin Panel** ← Click this!
- Logout

**Step 4:** Click **"Admin Panel"**

**Step 5:** You will see the Admin Dashboard

> **💡 Quick Access**: You can also go directly to:
> ```
> https://cagpt.icai.org/admin
> ```

### What You'll See in Admin Panel:

**Left Sidebar Menu:**
| Icon | Menu Item | What It Does | URL |
|------|-----------|--------------|-----|
| 📊 | Dashboard | Overview of all metrics | /admin |
| 📈 | System Monitor | Server health, security (**Super Admin only**) | /admin/system-monitoring |
| 🏷️ | Coupons | Create/manage discount codes | /admin/coupons |
| 👥 | Users | Manage all user accounts | /admin/users |
| 💳 | Subscriptions | View all subscriptions | /admin/subscriptions |
| 📉 | Analytics | Usage analytics | /admin/analytics |

---

## 📝 Step-by-Step: How to Access System Monitoring

> ⚠️ **SUPER ADMIN ONLY** - Regular admins cannot see this page

**Step 1:** Go to Admin Panel (see steps above)

**Step 2:** In the left sidebar, click **"System Monitor"**

**Step 3:** Or go directly to:
```
https://cagpt.icai.org/admin/system-monitoring
```

### What You'll See on System Monitoring Page

#### Section 1: System Health Score (Big Card at Top)

| What You See | What It Means |
|--------------|---------------|
| **95-100 / 100** with green badge | ✅ System is healthy, everything working |
| **70-94 / 100** with yellow badge | ⚠️ System is degraded, some issues |
| **Below 70 / 100** with red badge | ❌ System is unhealthy, needs immediate attention |

#### Section 2: Resource Metrics (4 Cards in a Row)

| Card Name | What It Shows | Good Value | Bad Value |
|-----------|---------------|------------|------------|
| **CPU Usage** | How busy the server processor is | Below 80% | Above 90% |
| **Memory Usage** | How much RAM is being used | Below 85% | Above 95% |
| **Uptime** | How long server has been running | Hours/Days | - |
| **Active Alerts** | Number of problems needing attention | 0 | Any number > 0 |

#### Section 3: Component Health (Multiple Small Cards)

Each component shows its status:

| Component | 🟢 Green (Good) | 🟡 Yellow (Warning) | 🔴 Red (Problem) |
|-----------|----------------|-------------------|------------------|
| Database | Connected | Slow | Disconnected |
| Cache | Connected | - | Disconnected |
| AI Providers | All working | Some slow | Not responding |
| File Storage | Working | - | Error |
| WebSocket | Connected | - | Disconnected |

#### Section 4: Security Threats Table

Shows attacks blocked in the last 24 hours:

| Column | What It Means |
|--------|---------------|
| **Type** | Kind of attack (brute_force, sql_injection, etc.) |
| **Severity** | How dangerous (low/medium/high/critical) |
| **IP Address** | Where attack came from |
| **Description** | Details about the attack |
| **Status** | Blocked = attack was stopped |

#### Section 5: API Routes Health

Shows how each API endpoint is performing:

| Column | Good Value | Bad Value |
|--------|------------|------------|
| **Avg Response** | Below 200ms | Above 1000ms |
| **Error Rate** | 0% | Above 5% |

---

## 📝 Step-by-Step: How to Deploy a New Version

> ⚠️ **SUPER ADMIN ONLY** - Regular admins cannot deploy

**Step 1:** Go to System Monitoring page
```
https://cagpt.icai.org/admin/system-monitoring
```

**Step 2:** Look at the **top-right corner** of the page

**Step 3:** Click the **"Deploy Update"** button (blue button with git icon)

**Step 4:** A popup form will appear. Fill in:

| Field | What to Enter | Example |
|-------|---------------|----------|
| **Version** | New version number | `v1.2.3` |
| **Changes** | List changes (one per line) | `- Fixed login bug` |

**Step 5:** Click **"Start Deployment"** button

**Step 6:** Watch the deployment progress:
- Status shows: 🔵 **in-progress**
- Wait for it to complete

**Step 7:** Check final status:
- ✅ **completed** = Success!
- ❌ **failed** = Click "Rollback" to undo

### How to Rollback a Failed Deployment

**Step 1:** Find the failed deployment in the "Recent Deployments" table

**Step 2:** Click the **"Rollback"** button on that row

**Step 3:** Confirm the rollback

**Step 4:** System automatically reverts to the previous working version

---

## 📝 Step-by-Step: How to Schedule Maintenance

> ⚠️ **SUPER ADMIN ONLY** - Regular admins cannot schedule maintenance

**Step 1:** Go to System Monitoring page
```
https://cagpt.icai.org/admin/system-monitoring
```

**Step 2:** Look at the **top-right corner** of the page

**Step 3:** Click the **"Schedule Maintenance"** button

**Step 4:** A popup form will appear. Fill in:

| Field | What to Enter | Example |
|-------|---------------|----------|
| **Start Time** | When maintenance begins | `2026-01-05 02:00` |
| **End Time** | When maintenance ends | `2026-01-05 04:00` |
| **Reason** | Why you're doing maintenance | `Database optimization` |
| **Affected Services** | Comma-separated list | `database, cache` |

**Step 5:** Click **"Schedule Maintenance"** button

**Step 6:** The scheduled maintenance appears in the "Scheduled Maintenance" section:
- Status: 🔵 **scheduled**
- Time window displayed
- Can be cancelled if needed

---

## 📝 Step-by-Step: How to Resolve Active Alerts

**Step 1:** On System Monitoring page, scroll down to find **"Active Alerts"** section
- If there are no problems, this section may not appear
- If there ARE problems, you'll see a red-bordered section

**Step 2:** Read the alert details:
- **Severity**: How urgent (critical = most urgent)
- **Type**: What kind of problem (error_rate, memory, etc.)
- **Message**: Description of the problem

**Step 3:** Fix the underlying problem:
- For high error rate: Check server logs
- For memory issues: Restart services or scale up
- For AI provider errors: Check API keys

**Step 4:** Alert auto-resolves when the problem is fixed
- Or click **"Resolve"** to manually dismiss

---

# 2. Admin User

## 🔐 Login Details
| Field | Value |
|-------|-------|
| Email | `admin@cagpttest.com` |
| Password | `TestPassword123!` |
| Role | Admin (platform management) |

## ✅ What Admin Can Do

| Feature | Access | Location |
|---------|--------|----------|
| Chat & Documents | ✅ Yes | https://cagpt.icai.org/chat |
| All Chat Modes | ✅ Yes | Chat page mode selector |
| Admin Dashboard | ✅ Yes | https://cagpt.icai.org/admin |
| User Management | ✅ Yes | https://cagpt.icai.org/admin/users |
| Subscription Management | ✅ Yes | https://cagpt.icai.org/admin/subscriptions |
| Coupon Management | ✅ Yes | https://cagpt.icai.org/admin/coupons |
| **System Monitoring** | ❌ **NO** | Super Admin only |
| **Deployments** | ❌ **NO** | Super Admin only |
| **Maintenance Scheduling** | ❌ **NO** | Super Admin only |

---

## 📝 Step-by-Step: How to Access Admin Dashboard

**Step 1:** Login with admin credentials (see above)

**Step 2:** Click on your **profile icon** (top-right corner)

**Step 3:** Click **"Admin Panel"** from the dropdown

**Step 4:** Or go directly to:
```
https://cagpt.icai.org/admin
```

### What You'll See on Admin Dashboard

**6 KPI Cards showing:**

| Card | What It Shows |
|------|---------------|
| **Total Users** | Total registered users + growth % |
| **Active Subscriptions** | Paid subscribers count |
| **Monthly Revenue** | Total revenue this month |
| **Queries** | Total AI queries made |
| **Documents** | Total documents processed |
| **Churn Rate** | Users who cancelled (lower = better) |

**Plan Distribution Chart:**
- Shows pie chart of users per plan (Free, Plus, Professional, Enterprise)

---

## 📝 Step-by-Step: How to Manage Users

**Step 1:** Go to Admin Panel (click profile icon → Admin Panel)

**Step 2:** Click **"Users"** in the left sidebar

**Step 3:** Or go directly to:
```
https://cagpt.icai.org/admin/users
```

### What You'll See

| Column | What It Shows |
|--------|---------------|
| **Name** | User's full name |
| **Email** | User's email address |
| **Tier** | Subscription level (Free, Plus, Professional, Enterprise) |
| **Admin** | 👑 if admin, blank if not |
| **Actions** | Edit and Admin buttons |

---

### Task: How to Change a User's Subscription Tier

**Step 1:** Type the user's name or email in the **Search** box at the top

**Step 2:** Find the user row and click the **"Edit"** button

**Step 3:** In the popup, find the **"Subscription Tier"** dropdown

**Step 4:** Click the dropdown and select:
- `free` - 500 queries/month
- `plus` - 3,000 queries/month
- `professional` - Unlimited
- `enterprise` - Unlimited + team features

**Step 5:** Click **"Save"** button

**Step 6:** ✅ See success message "User updated successfully"

---

### Task: How to Make Someone an Admin

**Step 1:** Type the user's name or email in the **Search** box

**Step 2:** Find the user row

**Step 3:** Click the **"Make Admin"** button (in Actions column)

**Step 4:** Confirm when prompted

**Step 5:** ✅ A crown icon 👑 appears next to the user

**Step 6:** ✅ That user can now access the Admin Panel

---

### Task: How to Remove Admin Access

**Step 1:** Find the admin user (look for 👑 icon)

**Step 2:** Click the **"Remove Admin"** button

**Step 3:** Confirm when prompted

**Step 4:** ✅ Crown icon disappears

**Step 5:** ✅ User can no longer access Admin Panel

---

## 📝 Step-by-Step: How to View Subscriptions

**Step 1:** Go to Admin Panel (click profile icon → Admin Panel)

**Step 2:** Click **"Subscriptions"** in the left sidebar

**Step 3:** Or go directly to:
```
https://cagpt.icai.org/admin/subscriptions
```

### What You'll See

| Column | What It Shows |
|--------|---------------|
| **User** | Subscriber's name |
| **Email** | Subscriber's email |
| **Plan** | Which plan they're on |
| **Status** | 🟢 active / 🔴 expired / 🟡 cancelled |
| **Valid Until** | When subscription expires |

---

### Task: How to Filter Subscriptions

**Step 1:** Look at the top of the page for filter dropdowns

**Step 2:** Click **"Status"** dropdown to filter by:
- `All` - Show everyone
- `Active` - Only current subscribers
- `Expired` - Only expired subscriptions
- `Cancelled` - Only cancelled subscriptions

**Step 3:** Click **"Plan"** dropdown to filter by:
- `All` - All plans
- `Free` - Free tier users
- `Plus` - Plus subscribers
- `Professional` - Professional subscribers
- `Enterprise` - Enterprise subscribers

**Step 4:** Use the **Search** box to find specific users

---

## 📝 Step-by-Step: How to Manage Coupons

**Step 1:** Go to Admin Panel (click profile icon → Admin Panel)

**Step 2:** Click **"Coupons"** in the left sidebar

**Step 3:** Or go directly to:
```
https://cagpt.icai.org/admin/coupons
```

### What You'll See

| Column | What It Shows |
|--------|---------------|
| **Code** | The discount code users enter |
| **Discount** | Amount off (% or $) |
| **Max Uses** | How many times code can be used |
| **Used** | How many times code has been used |
| **Status** | 🟢 active / 🔴 maxed / ⚪ inactive |
| **Actions** | Edit and Delete buttons |

---

### Task: How to Create a New Coupon

**Step 1:** Click the **"+ Create Coupon"** button (top of page)

**Step 2:** Fill in the popup form:

| Field | What to Enter | Required? |
|-------|---------------|-----------|
| **Code** | The discount code (e.g., `SUMMER30`) | ✅ Yes |
| **Description** | Explain the discount | ✅ Yes |
| **Discount Type** | Select: `Percentage` or `Fixed Amount` | ✅ Yes |
| **Discount Value** | Number (e.g., `30` for 30%) | ✅ Yes |
| **Max Uses** | Total times code can be used | Optional |
| **Max Per User** | How many times one user can use it | Optional |
| **Valid From** | When code starts working | Optional |
| **Valid Until** | When code expires | Optional |
| **Active** | Toggle ON to activate | ✅ Yes |

**Step 3:** Click **"Create Coupon"** button

**Step 4:** ✅ Coupon appears in the list

**Step 5:** ✅ Users can now use this code at checkout

---

### Task: How to Deactivate a Coupon

**Step 1:** Find the coupon in the list

**Step 2:** Click the **"Edit"** button

**Step 3:** Toggle **"Active"** to OFF

**Step 4:** Click **"Save"**

**Step 5:** ✅ Coupon no longer works for users

---

### Task: How to Delete a Coupon

**Step 1:** Find the coupon in the list

**Step 2:** Click the **🗑️** (trash) icon

**Step 3:** Confirm deletion

**Step 4:** ✅ Coupon is permanently removed

---

# 3. Enterprise User

## 🔐 Login Details
| Field | Value |
|-------|-------|
| Email | `enterprise.owner@cagpttest.com` |
| Password | `TestPassword123!` |
| Role | Enterprise (highest paid tier) |

## ✅ What Enterprise Can Do

**Everything is UNLIMITED:**

| Feature | Limit |
|---------|-------|
| Queries | **Unlimited** |
| Documents | **Unlimited** |
| Profiles | **Unlimited** |
| Scenarios | **Unlimited** |
| Deliverables | **Unlimited** |
| All Chat Modes | ✅ All 10 modes |
| All Export Formats | ✅ PDF, Word, Excel, PowerPoint, TXT, CSV |
| Team Management | ✅ Yes |
| SSO/SAML | ✅ Yes |
| Custom AI Training | ✅ Yes |
| API Access | ✅ Yes |
| White-Label | ✅ Yes |

---

## 📝 Step-by-Step: How to Use Chat Modes

**Step 1:** Login with Enterprise credentials (see above)

**Step 2:** Go to Chat page:
```
https://cagpt.icai.org/chat
```

**Step 3:** Look at the bottom of the chat area for the **mode dropdown**

**Step 4:** Click the dropdown to see all 10 modes:

| Mode | What It Does | Example Query |
|------|--------------|---------------|
| 💬 **Standard Chat** | General Q&A | "What is depreciation?" |
| ✨ **Deep Research** | In-depth with citations | "Explain cryptocurrency taxation" |
| ✅ **Create Checklist** | Task lists | "Create month-end close checklist" |
| 🔗 **Workflow** | Process diagrams | "Show accounts payable process" |
| 📊 **Audit Plan** | Comprehensive audit | "Create audit plan for retail company" |
| 🔢 **Financial Calculation** | Tax/NPV/IRR | "Calculate NPV for $100K at 10%" |
| 📈 **Scenario Simulator** | What-if analysis | "Compare Delaware vs Nevada incorporation" |
| 📝 **Deliverable Composer** | Documents | "Generate audit engagement letter" |
| 🔍 **Forensic Intelligence** | Fraud detection | "Analyze transactions for anomalies" |
| 👥 **Roundtable** | Multi-expert panel | "M&A due diligence analysis" |

**Step 5:** Select a mode from the dropdown

**Step 6:** Type your question in the message box

**Step 7:** Press **Enter** or click **Send**

**Step 8:** View the AI response in the right panel (Output Pane)

---

## Document Export (All Formats)

### Available Formats
- 📄 **PDF** - Professional formatted document
- 📝 **Word (.docx)** - Editable document
- 📊 **Excel (.xlsx)** - Spreadsheet with formulas
- 📑 **PowerPoint (.pptx)** - Presentation slides
- 📋 **TXT** - Plain text
- 📈 **CSV** - Data tables

### How to Export

1. Generate content using any chat mode
2. The right panel (Output Pane) shows the content
3. Click the **Export** button (top of output pane)
4. Select your format
5. File downloads automatically

---

# 4. Professional User

## 🔐 Login Details
| Field | Value |
|-------|-------|
| Email | `professional.cpa@cagpttest.com` |
| Password | `TestPassword123!` |
| Role | Professional (CPAs, accountants) |

## ✅ What Professional Can Do

| Feature | Limit |
|---------|-------|
| Queries | **Unlimited** |
| Documents | **Unlimited** |
| Profiles | **Unlimited** |
| Scenarios | **Unlimited** |
| Deliverables | **Unlimited** |
| All Chat Modes | ✅ All 10 modes |
| All Export Formats | ✅ Yes |
| API Access | ✅ Yes |
| Forensic Intelligence | ✅ Yes |
| White-Label Reports | ✅ Yes |

## ❌ What Professional CANNOT Do
- ❌ Team Management (Enterprise only)
- ❌ SSO/SAML (Enterprise only)
- ❌ Custom AI Training (Enterprise only)

---

## API Access (Professional Feature)

### How to Access API Settings
```
URL: https://cagpt.icai.org/settings
```
Navigate to the **API** section.

### Generate API Key

#### Step 1: Go to Settings → API
#### Step 2: Click "Generate API Key"
#### Step 3: Copy Your Key
```
⚠️ IMPORTANT: Save this key! It won't be shown again.

Your API Key: dummy_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Using the API

```bash
# Example API call
curl -X POST https://cagpt.icai.org/api/v1/chat \
  -H "Authorization: Bearer dummy_live_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the depreciation method for computers?"}'
```

---

## Forensic Intelligence Mode

### How to Use

1. Select **"Forensic Intelligence"** mode in chat
2. Upload financial documents or describe data
3. Ask for pattern analysis

### Sample Queries
- "Analyze this bank statement for unusual patterns"
- "Identify potential fraud indicators in this transaction data"
- "Review these invoices for duplicate payments"

### What You'll Get
- 🔍 Anomaly detection results
- ⚠️ Risk scores and flags
- 📊 Pattern analysis charts
- 📄 Professional forensic report

---

## White-Label Reports

### How to Set Up

#### Step 1: Go to Settings → Branding
```
URL: https://cagpt.icai.org/settings
```

#### Step 2: Upload Your Logo
Click the logo upload area and select your company logo

#### Step 3: Set Brand Colors
Choose your primary and secondary brand colors

#### Step 4: Save Settings

### Result
All exported documents now include:
- Your company logo
- Your brand colors
- Custom footer with your company name

---

# 5. Plus User

## 🔐 Login Details
| Field | Value |
|-------|-------|
| Email | `plus.business@cagpttest.com` |
| Password | `TestPassword123!` |
| Role | Plus (small business tier) |

## ✅ What Plus Can Do

| Feature | Limit |
|---------|-------|
| Queries | **3,000/month** |
| Documents | **Unlimited** |
| Profiles | **5** |
| Scenarios | **10/month** |
| Deliverables | **10/month** |
| Scenario Simulator | ✅ Yes |
| Deliverable Composer | ✅ Yes |
| All Export Formats | ✅ Yes |

## ❌ What Plus CANNOT Do
- ❌ API Access (Professional+ only)
- ❌ Forensic Intelligence (Professional+ only)
- ❌ White-Label Reports (Professional+ only)
- ❌ Roundtable Mode (Professional+ only)

---

## Check Your Usage Quota

### How to View
```
URL: https://cagpt.icai.org/settings
```
Go to **Subscription** section.

### What You'll See
```
┌─────────────────────────────────────────────────────────┐
│ Your Subscription: Plus                                  │
├─────────────────────────────────────────────────────────┤
│ Queries Used:      1,234 / 3,000    [████████░░░░░░] 41%│
│ Scenarios Used:    4 / 10           [████░░░░░░░░░░] 40%│
│ Deliverables Used: 7 / 10           [███████░░░░░░░] 70%│
│ Profiles Created:  3 / 5            [██████░░░░░░░░] 60%│
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Step-by-Step: How to Use Scenario Simulator

**Step 1:** Go to Chat page:
```
https://cagpt.icai.org/chat
```

**Step 2:** Click the **mode dropdown** at the bottom of the chat

**Step 3:** Select **"📈 Scenario Simulator"**

**Step 4:** Type a comparison scenario. Example:
```
Compare incorporation in Delaware vs Nevada for a tech startup 
with projected revenue of $500K in year 1, growing 50% annually 
for 5 years. Consider tax implications, filing fees, and 
annual maintenance costs.
```

**Step 5:** Press **Enter** or click **Send**

**Step 6:** View the results in the right panel:
- 📊 Side-by-side comparison table
- 📈 5-year projection charts
- 💰 Total cost analysis
- ✅ Recommendation with reasoning
- 📥 Download Excel button with formulas

---

## 📝 Step-by-Step: How to Use Deliverable Composer

**Step 1:** Go to Chat page:
```
https://cagpt.icai.org/chat
```

**Step 2:** Click the **mode dropdown** at the bottom of the chat

**Step 3:** Select **"📝 Deliverable Composer"**

**Step 4:** Request a document. Example:
```
Generate an audit engagement letter for ABC Manufacturing Corp, 
a mid-sized manufacturing company with $5M annual revenue. 
Include scope, timeline, and fee structure.
```

**Step 5:** Press **Enter** or click **Send**

**Step 6:** View the professional document in the right panel:
- 📄 Fully formatted document
- ✏️ Editable sections highlighted in yellow
- 📥 Export to Word or PDF button

### Available Document Types
| Document Type | Description |
|---------------|-------------|
| Audit Plans | Comprehensive audit strategy |
| Tax Memos | Tax position analysis |
| Engagement Letters | Client agreements |
| Client Reports | Financial analysis reports |
| Financial Analyses | Detailed financial breakdowns |
| Compliance Checklists | Regulatory compliance items |
| Management Letters | Recommendations to management |

---

# 6. Free User

## 🔐 Login Details
| Field | Value |
|-------|-------|
| Email | `free.home@cagpttest.com` |
| Password | `TestPassword123!` |
| Role | Free (personal use tier) |

## ✅ What Free Can Do

| Feature | Limit |
|---------|-------|
| Queries | **500/month** |
| Documents | **10/month** |
| Profiles | **1** |
| Scenarios | ❌ Not available |
| Deliverables | ❌ Not available |

## Available Chat Modes (6 of 10)

| Mode | Available? |
|------|------------|
| Standard Chat | ✅ Yes |
| Deep Research | ✅ Yes |
| Create Checklist | ✅ Yes |
| Workflow Visualization | ✅ Yes |
| Audit Plan | ✅ Yes |
| Financial Calculation | ✅ Yes |
| Scenario Simulator | ❌ Upgrade Required |
| Deliverable Composer | ❌ Upgrade Required |
| Forensic Intelligence | ❌ Upgrade Required |
| Roundtable | ❌ Upgrade Required |

## Available Export Formats (2 of 6)

| Format | Available? |
|--------|------------|
| TXT | ✅ Yes |
| CSV | ✅ Yes |
| PDF | ❌ Upgrade Required |
| Word | ❌ Upgrade Required |
| Excel | ❌ Upgrade Required |
| PowerPoint | ❌ Upgrade Required |

---

## What Happens When You Hit Limits

### Trying to Use Blocked Mode
```
┌─────────────────────────────────────────────────────────┐
│ ⬆️ Upgrade Required                                      │
│                                                          │
│ Scenario Simulator is available on Plus plans and above.│
│                                                          │
│ Upgrade now to unlock:                                   │
│ • Scenario Simulator (12 AI agents)                      │
│ • Deliverable Composer (45 AI agents)                    │
│ • All export formats                                     │
│                                                          │
│ [View Pricing]  [Maybe Later]                            │
└─────────────────────────────────────────────────────────┘
```

### Trying to Export to PDF
```
┌─────────────────────────────────────────────────────────┐
│ ⬆️ Upgrade to Export PDF                                 │
│                                                          │
│ PDF export is available on Plus plans and above.         │
│                                                          │
│ [Upgrade Now]  [Export as TXT]                           │
└─────────────────────────────────────────────────────────┘
```

---

## How to Upgrade

### Step 1: Go to Pricing
```
URL: https://cagpt.icai.org/pricing
```
Or click **"Upgrade"** when prompted.

### Step 2: Compare Plans
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│    FREE     │    PLUS     │ PROFESSIONAL│ ENTERPRISE  │
│    $0/mo    │   $29/mo    │   $49/mo    │   Custom    │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ 500 queries │ 3K queries  │ Unlimited   │ Unlimited   │
│ 10 docs     │ Unlimited   │ Unlimited   │ Unlimited   │
│ 1 profile   │ 5 profiles  │ Unlimited   │ Unlimited   │
│ Basic modes │ All modes   │ All modes   │ All modes   │
│ TXT/CSV     │ All exports │ All exports │ All exports │
│             │             │ API Access  │ SSO/Teams   │
│             │             │ Forensic    │ Custom AI   │
├─────────────┼─────────────┼─────────────┼─────────────┤
│  [Current]  │  [Select]   │  [Select]   │ [Contact]   │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### Step 3: Select Plan & Pay
Complete payment to unlock features immediately.

---

# 7. New User (Onboarding)

## 🔐 Login Details
| Field | Value |
|-------|-------|
| Email | `free.newuser@cagpttest.com` |
| Password | `TestPassword123!` |
| Role | New User (testing onboarding flow) |

## 📝 Step-by-Step: What Happens at First Login

**Step 1:** Go to login page
```
https://cagpt.icai.org/auth
```

**Step 2:** Enter credentials:
- Email: `free.newuser@cagpttest.com`
- Password: `Test@123`

**Step 3:** Click **"Sign In"**

**Step 4:** See the **Welcome Screen**:
- Big greeting: "Welcome to CA GPT! 👋"
- Description: "Your intelligent accounting & tax assistant"
- Button: **"Get Started"**

**Step 5:** Click **"Get Started"** button

**Step 6:** See the **Create Profile** screen:
- Choose profile type: **Personal**, **Business**, or **Family**
- Enter a profile name

**Step 7:** Click **"Create Profile"** button

**Step 8:** You're redirected to the **Chat page** with tips:
- Quick tips panel shows how to use the app
- Suggested first question to try

### Step 1: Welcome Screen
```
┌─────────────────────────────────────────────────────────┐
│                    Welcome to CA GPT! 👋                   │
│                                                          │
│    Your intelligent accounting & tax assistant           │
│                                                          │
│    Let's set up your first profile to get started.       │
│                                                          │
│                   [Get Started]                          │
└─────────────────────────────────────────────────────────┘
```

### Step 2: Create First Profile
```
┌─────────────────────────────────────────────────────────┐
│ Create Your Profile                                      │
├─────────────────────────────────────────────────────────┤
│ What type of profile?                                    │
│                                                          │
│ ┌─────────┐  ┌─────────┐  ┌─────────┐                    │
│ │ 👤      │  │ 🏢      │  │ 👨‍👩‍👧‍👦      │                    │
│ │Personal │  │Business │  │ Family  │                    │
│ └─────────┘  └─────────┘  └─────────┘                    │
│                                                          │
│ Profile Name: [My Personal Finances        ]             │
│                                                          │
│                      [Create Profile]                    │
└─────────────────────────────────────────────────────────┘
```

### Step 3: Redirect to Chat
After profile creation, you're taken to the chat page with tips:

```
┌─────────────────────────────────────────────────────────┐
│ 💡 Quick Tips                                            │
│                                                          │
│ • Use the mode selector to switch between chat modes     │
│ • Upload documents using the 📎 button                   │
│ • Your conversations are saved automatically             │
│                                                          │
│ Try asking: "What tax deductions can I claim as a        │
│ freelancer?"                                             │
└─────────────────────────────────────────────────────────┘
```

---

# 8. Quota Limit User

## 🔐 Login Details
| Field | Value |
|-------|-------|
| Email | `quota.exhausted@cagpttest.com` |
| Password | `TestPassword123!` |
| Role | User who has used all monthly queries |

## 📝 Step-by-Step: What Happens When Quota is Exhausted

**Step 1:** Login with quota user credentials

**Step 2:** Go to Chat page:
```
https://cagpt.icai.org/chat
```

**Step 3:** Try to send a message

**Step 4:** See the **Quota Exceeded** popup:
- Message: "❌ Monthly Query Limit Reached"
- Shows: "You've used all 500 queries for this month"
- Shows: "Your limit resets on: February 1, 2026"
- Buttons: **"Upgrade to Plus"** and **"View All Plans"**

## ✅ What Still Works
- ✅ View past conversations
- ✅ View settings
- ✅ View usage statistics
- ✅ Export previous content

## ❌ What Doesn't Work
- ❌ Send new messages
- ❌ Upload new documents

---

# 9. MFA Enabled User

## 🔐 Login Details
| Field | Value |
|-------|-------|
| Email | `mfa.enabled@cagpttest.com` |
| Password | `TestPassword123!` |
| Role | User with Two-Factor Authentication enabled |

## 📝 Step-by-Step: Login with MFA

**Step 1:** Go to login page:
```
https://cagpt.icai.org/auth
```

**Step 2:** Enter credentials:
- Email: `mfa.enabled@cagpttest.com`
- Password: `TestPassword123!`

**Step 3:** Click **"Sign In"**

**Step 4:** See the **Two-Factor Authentication** screen:
- Message: "Enter the 6-digit code from your authenticator app"
- 6 input boxes for the code

**Step 5:** Open your **Authenticator App** (Google Authenticator, Authy, etc.)

**Step 6:** Find the code for "CA GPT" or "cagpt.icai.org"

**Step 7:** Enter the 6-digit code into the boxes

**Step 8:** Click **"Verify"**

**Step 9:** ✅ You're logged in!

---

### If You Don't Have the Authenticator App (Use Backup Code)

**Step 1:** On the MFA screen, click **"Use backup code"** link

**Step 2:** Enter one of your saved backup codes

**Step 3:** Click **"Verify"**

**Step 4:** ✅ Logged in (that backup code is now used and won't work again)

---

## Manage MFA Settings

### How to Access
```
URL: https://cagpt.icai.org/settings
```
Go to **Security** section.

### Options Available
- **View backup codes** - See remaining unused codes
- **Regenerate backup codes** - Get new set of codes
- **Disable MFA** - Turn off two-factor (requires current code)

---

# 10. Locked Account User

## 🔐 Login Details
| Field | Value |
|-------|-------|
| Email | `locked.account@cagpttest.com` |
| Password | `TestPassword123!` |
| Role | Account locked due to failed login attempts |

## ❓ What Causes Account Lock?
- **5 consecutive failed login attempts** = Account locked
- Lock duration: **15 minutes**

## 📝 Step-by-Step: What Happens When Locked

**Step 1:** Go to login page:
```
https://cagpt.icai.org/auth
```

**Step 2:** Enter the locked account credentials:
- Email: `locked.account@cagpttest.com`
- Password: `TestPassword123!`

**Step 3:** See the **Account Locked** screen:
- Message: "❌ Account Locked"
- Reason: "Too many failed login attempts"
- Timer: "Time remaining: XX minutes"
- Options: **"Forgot Password?"** and **"Contact Support"**

## 🔓 How to Unlock the Account

### Option 1: Wait It Out
- Wait **15 minutes** for the lockout to expire
- Try logging in again

### Option 2: Reset Password

**Step 1:** Click **"Forgot Password?"** link

**Step 2:** Enter your email: `locked.account@cagpttest.com`

**Step 3:** Click **"Send Reset Link"**

**Step 4:** Check your email inbox for the reset link

**Step 5:** Click the link in the email

**Step 6:** Create a new password

**Step 7:** Login with your new password

**Step 8:** ✅ Account is now unlocked!

---

# 📋 Quick Reference: Feature Matrix

| Feature | Free | Plus | Professional | Enterprise | Admin | Super Admin |
|---------|------|------|--------------|------------|-------|-------------|
| Standard Chat | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deep Research | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Checklist | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Workflow | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Audit Plan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Calculation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Scenario Simulator | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deliverable Composer | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Forensic Intelligence | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Roundtable | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| PDF/Word Export | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| White-Label | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Team Management | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Admin Panel | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| System Monitoring | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Deployments | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

# 🔧 Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| **Can't login** | Wrong email or password | Check email spelling (case-sensitive), use password `Test@123` |
| **"Admin access required"** | User is not an admin | Super Admin needs to grant admin access in User Management |
| **"Super admin required"** | Not in super admin list | Add email to `SUPER_ADMIN_EMAILS` environment variable |
| **MFA code not working** | Device time out of sync | Sync device time automatically, or use backup code |
| **Account locked** | 5 failed login attempts | Wait 15 minutes OR reset password via email |
| **"Quota exceeded"** | Monthly limit reached | Wait for monthly reset OR upgrade subscription |
| **Chat mode not available** | Subscription tier too low | Upgrade to Plus or higher |
| **Export format greyed out** | Not available on Free tier | Upgrade to Plus for all export formats |
| **Page not loading** | Server issue | Refresh page, clear browser cache, try incognito mode |
| **System Monitoring not visible** | Not super admin | Only super admins see this menu item |

---

**End of Testing Guide**
