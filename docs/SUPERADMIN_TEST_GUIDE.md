# 🔐 Super Admin Test Guide

**Version:** 2.0  
**Last Updated:** February 9, 2026  
**Application:** ICAI CAGPT Platform

---

## 📋 Overview

This guide covers **Super Admin** (System Level Access) testing for ICAI CAGPT. Super Admins manage **system infrastructure**, not user features.

### ⚠️ Critical Understanding

**Super Admin ≠ Regular Admin**

| Feature Type | Super Admin | Regular Admin | Regular User |
|--------------|-------------|---------------|--------------|
| System Health | ✅ Yes | ❌ No | ❌ No |
| Security Monitoring | ✅ Yes | ❌ No | ❌ No |
| Deployment Management | ✅ Yes | ❌ No | ❌ No |
| System Integrations | ✅ Yes | ❌ No | ❌ No |
| User Management | ✅ Yes | ✅ Yes | ❌ No |
| Chat/AI Features | ❌ No | ✅ Yes | ✅ Yes |
| PDF Upload | ❌ No | ✅ Yes | ✅ Yes |
| Document Analysis | ❌ No | ✅ Yes | ✅ Yes |

---

## 🔑 Test Credentials

### Super Admin Account
```
Email:    superadmin@lucatest.com
Password: TestPassword123!
Tier:     Enterprise
Role:     Super Admin (System Level Access)
```

**Environment Configuration Required:**
```bash
SUPER_ADMIN_EMAILS=superadmin@lucatest.com
```

---

## 🎯 Super Admin Features

### 1. Super Admin Dashboard (`/superadmin`)
- **Route:** `/superadmin`
- **API:** `GET /api/admin/kpis`
- **Purpose:** High-level system overview and quick access

**Dashboard Metrics:**
- **Health Score:** 0-100 system health indicator
- **CPU Usage:** Real-time CPU percentage (0.0%)
- **Memory Usage:** RAM consumption (0.0%)
- **Uptime:** System uptime (0m since last restart)
- **Total Users:** Platform user count (0 active / 350 total)
- **Conversations:** Chat conversations created (0 messages total)
- **Security Threats:** Active security incidents (0 blocked today)
- **Unresolved Alerts:** System alerts needing attention (0 errors, 0 warnings)

**Quick Access Buttons:**
- System Health → `/superadmin/health`
- Security Threats → `/superadmin/threats`
- Deployments → `/superadmin/deployments`
- Maintenance → `/superadmin/maintenance`
- Alerts → `/superadmin/alerts`
- Performance → `/superadmin/performance`
- Integrations → `/superadmin/integrations`

**Additional Sections:**
- **Component Health:** Database, AI Providers, Payment Gateways status
- **Subscription Distribution:** User tiers breakdown (Free, Plus, Pro, Enterprise)

**Test Steps:**
1. Login with super admin credentials
2. Navigate to `/superadmin`
3. Verify all 8 metric cards display
4. Check Quick Access buttons are clickable
5. Verify "Refresh All" button in top-right
6. Confirm data auto-refreshes every 30 seconds

---

### 2. System Monitoring  (`/superadmin/health`)
- **Route:** `/superadmin/health`
- **API:** `GET /api/admin/system/health`
- **Purpose:** Real-time infrastructure health monitoring

**System Health Score:**
- **0-100 scale** with color-coded status:
  - 🟢 90-100: Healthy (Green banner)
  - 🟡 70-89: Degraded (Yellow banner)
  - 🔴 0-69: Critical (Red "Unknown" banner)

**Resource Metrics:**
- **CPU Usage:** Percentage with progress bar (0 cores, Load: 0.00)
- **Memory Usage:** Used/Total in MB (0 MB / 0 MB)
- **Uptime:** Hours since last restart (0h, 0 minutes)
- **Active Alerts:** Count of unresolved system alerts (0 total alerts)

**Component Health:**
Status of critical system components:
- Database (PostgreSQL)
- AI Providers (OpenAI, Azure, Anthropic, Gemini)
- Payment Gateways (Razorpay, Cashfree)
- Email Services (Mailgun, SMTP)
- Storage (AWS S3, Azure Blob)

**Security Threats (Last 24h):**
- Total Threats: Count of detected incidents
- Blocked: Successfully blocked attacks
- High/Critical: Severe threats requiring attention
- Brute Force: Login attempt attacks

**Action Buttons:**
- 🔄 **Refresh:** Manual metrics update
- 📅 **Schedule Maintenance:** Plan downtime
- 🚀 **Deploy Update:** Trigger new deployment

**Test Steps:**
1. Navigate to `/superadmin/health`
2. Verify System Health Score displays 0-100
3. Check resource metrics update in real-time
4. Confirm Component Health shows all services
5. Review Security Threats (Last 24h) section
6. Test Refresh button functionality
7. Verify auto-refresh every 5 seconds

---

### 3. Security Threats (`/superadmin/threats`)
- **Route:** `/superadmin/threats`
- **API:** `GET /api/admin/system/threats`
- **Purpose:** Monitor and manage security incidents

**Threat Statistics:**
- **Total Threats:** All detected incidents (0 All-time detected)
- **Active Threats:** Currently unresolved (0 Require attention)
- **Blocked:** Successfully mitigated (0 Successfully blocked)
- **Resolved:** Closed incidents (0 Fully resolved)

**Threats by Severity (Chart):**
- 🔴 **Critical:** Immediate action required
- 🟠 **High:** Should address soon
- 🟡 **Medium:** Monitor closely
- 🟢 **Low:** Normal activity

**Threats by Type (Chart):**
- **Brute Force:** Failed login attempts
- **SQL Injection:** Database attack attempts
- **Rate Limit Exceeded:** API abuse
- **Unauthorized Access:** Invalid tokens
- **Malicious Upload:** Suspicious files
- **XSS Attempt:** Cross-site scripting

**All Threats Table:**
| Column | Description |
|--------|-------------|
| Type | Attack category |
| Severity | Critical/High/Medium/Low |
| Source | IP address or origin |
| Description | Threat details |
| Status | Active/Blocked/Resolved/Investigating |
| Detected | Timestamp |
| Actions | Block/Resolve/View Details |

**Filters:**
- 🔍 Search box for threats
- 📊 All Severities dropdown
- 📋 All Statuses filter

**Test Steps:**
1. Navigate to `/superadmin/threats`
2. Verify all 4 stat cards display
3. Check "Threats by Severity" doughnut chart
4. Check "Threats by Type" bar chart
5. Review threats table (may show "No threats detected")
6. Test search functionality
7. Test severity filter dropdown
8. Test status filter dropdown
9. Click Refresh button

---

### 4. Deployments (`/superadmin/deployments`)
- **Route:** `/superadmin/deployments`
- **API:** `GET /api/admin/system/deployments`
- **Purpose:** Track application deployments and rollbacks

**Deployment Statistics:**
- **Total Deployments:** Historical count (0 All time)
- **Success Rate:** Percentage of successful deploys (100.0%)
- **Avg Duration:** Average deployment time (-- Per deployment)
- **Last Deployment:** Most recent deploy timestamp (Never)

**Deployments by Environment (Chart):**
- 🟢 **Production:** Live environment
- 🟡 **Staging:** Pre-production testing
- 🔵 **Development:** Dev environment

**Deployments by Status (Chart):**
- ✅ **Success:** Completed successfully
- ❌ **Failed:** Deployment errors
- 🔄 **In Progress:** Currently deploying
- ⏮️ **Rolled Back:** Reverted to previous

**All Deployments Table:**
| Column | Description |
|--------|-------------|
| Version | Release version number |
| Environment | Prod/Staging/Dev |
| Branch | Git branch deployed |
| Status | Success/Failed/In Progress |
| Deployed By | User who triggered |
| Duration | Time taken |
| Started | Deployment timestamp |
| Actions | Rollback/View Logs |

**Filters:**
- 🔍 Search deployments
- 🌍 All Environments (All/Production/Staging/Development)
- 📊 All Statuses (All/Success/Failed/In Progress)

**Action Buttons:**
- 🔄 **Refresh:** Update deployment list
- 🚀 **+ New Deployment:** Trigger new deploy

**Test Steps:**
1. Navigate to `/superadmin/deployments`
2. Verify 4 stat cards display
3. Check "Deployments by Environment" chart
4. Check "Deployments by Status" chart
5. Review deployments table (may show "No deployments found")
6. Test environment filter
7. Test status filter
8. Click "+ New Deployment" button (should open modal)

---

### 5. System Maintenance (`/superadmin/maintenance`)
- **Route:** `/superadmin/maintenance`
- **API:** `GET /api/admin/system/maintenance`
- **Purpose:** Perform system maintenance operations

**Maintenance Statistics:**
- **System Health:** Current health percentage (100%)
- **Active Tasks:** Currently running tasks (0 Currently running)
- **Scheduled:** Upcoming scheduled tasks (0 Upcoming tasks)
- **Completed Today:** Tasks finished today (0 Tasks completed)

**Quick Actions:**
Common maintenance operations:
- 🗄️ **Database Vacuum:** Optimize database
- 🧹 **Clear Cache:** Clear application cache
- 📋 **Rotate Logs:** Archive old log files
- 💾 **Create Backup:** Backup database

**Maintenance Tasks Table:**
| Column | Description |
|--------|-------------|
| Task | Task name |
| Category | Database/Cache/Logs/Backup/System |
| Type | Manual/Scheduled/Automatic |
| Status | Pending/Running/Completed/Failed |
| Last Run | Last execution timestamp |
| Next Run | Next scheduled execution |
| Actions | Run Now/Edit/Delete |

**Top Controls:**
- 🔧 **Maintenance Mode:** Toggle to enable/disable (top-right)
- 🔄 **Refresh:** Update task list

**Test Steps:**
1. Navigate to `/superadmin/maintenance`
2. Verify 4 stat cards display
3. Check Quick Actions buttons visible
4. Review Maintenance Tasks table
5. Test Maintenance Mode toggle
6. Click on a Quick Action button (e.g., Clear Cache)
7. Verify task execution confirmation
8. Check Refresh button

---

### 6. System Alerts (`/superadmin/alerts`)
- **Route:** `/superadmin/alerts`
- **API:** `GET /api/admin/system/alerts`
- **Purpose:** Monitor system alerts and notifications

**Alert Statistics:**
- **Total Alerts:** All alerts count (0 All time)
- **Unacknowledged:** Alerts needing attention (0 Require attention)
- **Errors:** Critical error alerts (0 Critical issues)
- **Warnings:** Warning-level alerts (0 Attention needed)

**Alerts by Category (Chart):**
- 🖥️ **System:** Infrastructure alerts
- 🔒 **Security:** Security-related
- ⚡ **Performance:** Performance issues
- 🗄️ **Database:** Database problems
- 🤖 **AI Providers:** AI service issues

**Recent Critical Alerts:**
Shows latest critical alerts requiring immediate action

**All Alerts Table:**
| Column | Description |
|--------|-------------|
| Type | Error/Warning/Info |
| Category | System/Security/Performance/etc |
| Title | Alert title |
| Source | Component that triggered |
| Status | Active/Acknowledged/Resolved |
| Time | Alert timestamp |
| Actions | Acknowledge/Resolve/Details |

**Filters:**
- 🔍 Search alerts
- 📊 All Types (All/Error/Warning/Info)
- 📋 All Categories
- ✅ All Status (All/Active/Acknowledged/Resolved)

**Test Steps:**
1. Navigate to `/superadmin/alerts`
2. Verify 4 stat cards display
3. Check "Alerts by Category" chart
4. Review "Recent Critical Alerts" section
5. Check All Alerts table
6. Test search functionality
7. Test Type filter
8. Test Category filter
9. Test Status filter

---

### 7. Performance Metrics (`/superadmin/performance`)
- **Route:** `/superadmin/performance`
- **API:** `GET /api/admin/system/performance`
- **Purpose:** Monitor system performance metrics

**System Health Score:**
- **0-100 indicator** with status label
- Color-coded: Green (Live), Yellow (Degraded), Red (Downtime)
- Uptime counter (0m since last restart)

**Resource Usage Metrics:**
- **CPU Usage:** 0.0% (0 cores, Load: 0.00, 0.00)
- **Memory Usage:** 0.0% (0 B / 0 B)
- **Disk Usage:** 0.0% (0 B / 0 B)
- **Network I/O:** ↓ 0 B / ↑ 0 B

**Response Time:**
API endpoint response statistics:
- **Min:** 0ms (fastest response)
- **Median:** 0ms (p95 - 95th percentile)
- **Max:** 0ms (p99 - 99th percentile)

**Request Statistics:**
- **Total Requests:** 0 (cumulative count)
- **Requests/sec:** 0.00 (rate)
- **Errors:** 0 (failed requests)
- **Error Rate:** 0.00% (percentage)

**Database Performance:**
Database connection and query metrics:
- Connection pool status
- Query execution times
- Slow query log
- Database size

**Time Range Filter:**
Top-right dropdown:
- Last 1h (default)
- Last 6h
- Last 24h
- Last 7d

**Test Steps:**
1. Navigate to `/superadmin/performance`
2. Verify System Health Score displays
3. Check all 4 resource usage cards
4. Review Response Time metrics
5. Check Request Statistics
6. Verify Database Performance section
7. Test time range dropdown (Last 1h/6h/24h/7d)
8. Click Refresh button

---

### 8. Integrations (`/superadmin/integrations`)
- **Route:** `/superadmin/integrations`
- **API:** `GET /api/admin/system/integrations`
- **Purpose:** Monitor third-party service integrations

**Integration Statistics:**
- **Total Integrations:** Configured services (0 Configured services)
- **Connected:** Active connections (0 Active connections)
- **Errors:** Failed integrations (0 Need attention)
- **Requests Today:** API calls made today (0 API calls made)

**Integrations by Type (Chart):**
- 🤖 **AI Provider:** OpenAI, Azure, Anthropic, Gemini
- ☁️ **Cloud Service:** Azure, AWS
- 💳 **Payment Gateway:** Razorpay, Cashfree
- 📧 **Email Service:** Mailgun, SMTP

**AI Provider Status:**
Special section showing AI model provider health:
- OpenAI (GPT-4, GPT-3.5)
- Azure OpenAI (Model Router)
- Anthropic Claude (Claude 3.5)
- Google Gemini (Gemini Pro)

Status indicators:
- 🟢 **Connected:** Working properly
- 🟡 **Degraded:** Slow response
- 🔴 **Failed:** Not accessible
- ⚫ **Disabled:** Not configured

**All Integrations Table:**
| Column | Description |
|--------|-------------|
| Integration | Service name |
| Type | AI/Cloud/Payment/Email |
| Status | Connected/Degraded/Failed/Disabled |
| Health | Response time/uptime |
| Last Sync | Last successful connection |
| Enabled | On/Off toggle |
| Actions | Configure/Test/Delete |

**Filters:**
- 🔍 Search integrations
- 📊 All Types (All/AI Provider/Cloud/Payment/Email)
- ✅ All Status (All/Connected/Degraded/Failed/Disabled)

**Action Buttons:**
- 🔄 **Refresh:** Update integration status
- ➕ **Add Integration:** Configure new service

**Test Steps:**
1. Navigate to `/superadmin/integrations`
2. Verify 4 stat cards display
3. Check "Integrations by Type" chart
4. Review "AI Provider Status" section
5. Check All Integrations table
6. Test search functionality
7. Test Type filter
8. Test Status filter
9. Click "+ Add Integration" button

---

### 9. EasyLoans DSA Management (`/superadmin/easyloans`)
- **Route:** `/superadmin/easyloans`
- **API:** `GET /api/admin/easyloans`
- **Purpose:** Manage loan products, lenders, and schemes

**DSA Statistics:**
- **Lenders:** Registered lenders (0 total / 0 inactive)
- **Loan Products:** Available loan types (0 total / 0 inactive)
- **Eligibility Criteria:** Qualification rules (0 total)
- **Rate Slabs:** Interest rate tiers (0 total)
- **Government Schemes:** Public loan schemes (0 active / 0 expired)

**Quick Actions:**
- 🏦 **Add New Lender:** Register new lender
- 📊 **Update Rate Slabs:** Modify interest rates
- 📋 **Create Loan Product:** Add new loan type
- 🏛️ **Manage Schemes:** Government schemes
- ✅ **Define Eligibility:** Set qualification criteria
- 📈 **View Analytics:** (Coming Soon)

**Test Steps:**
1. Navigate to `/superadmin/easyloans`
2. Verify 5 stat cards display
3. Check Quick Actions buttons visible
4. Click "Add New Lender" (should open form)
5. Test "Manage Lenders" button
6. Verify data sections load properly

---

### 10. Regular Admin Dashboard (`/admin`)
- **Route:** `/admin`
- **API:** `GET /api/admin/users`, `GET /api/admin/subscriptions`
- **Purpose:** User and subscription management (different from Super Admin)

**Note:** This is the **Regular Admin** dashboard, NOT Super Admin.

**Admin Metrics:**
- **Total Users:** Platform users (0 / +0% from last month)
- **Active Subscriptions:** Paid subscriptions (0 / +0% from last month)
- **Monthly Revenue:** Revenue this month ($0 / +0% from last month)
- **Queries This Month:** AI queries used (0 / -25% from last month)
- **Documents Analyzed:** Files processed (0 / +0% from last month)
- **Churn Rate:** User cancellation rate (0% / 0% from last month)

**Additional Sections:**
- **Recent Activity:** Latest platform events
- **Popular Plans:** Subscription tier distribution

**Test Steps:**
1. Navigate to `/admin` (not `/superadmin`)
2. Verify 6 metric cards display
3. Check Recent Activity timeline
4. Review Popular Plans section
5. Note the difference from Super Admin dashboard

---

## 🧪 Testing Checklist

### Authentication
- [ ] Login with `superadmin@lucatest.com` / `TestPassword123!`
- [ ] Verify session persists
- [ ] Check `isAdmin` flag in `/api/auth/me`
- [ ] Confirm logout destroys session

### System Dashboard
- [ ] Access `/superadmin`
- [ ] Verify all KPI cards load
- [ ] Check data is current
- [ ] Test auto-refresh

### Health Monitoring
- [ ] Access `/superadmin/health`
- [ ] Verify all metrics display
- [ ] Check alert badges
- [ ] Test manual refresh

### Security
- [ ] Access `/superadmin/threats`
- [ ] Review threat list
- [ ] Test severity filtering
- [ ] Block a threat
- [ ] Resolve a threat

### Integrations
- [ ] Access `/superadmin/integrations`
- [ ] Check all provider statuses
- [ ] Review response times
- [ ] Identify failed connections

### Deployments
- [ ] Access `/superadmin/deployments`
- [ ] Review deployment history
- [ ] Check latest deployment
- [ ] Verify rollback option exists

### Performance
- [ ] Access `/superadmin/performance`
- [ ] Review endpoint metrics
- [ ] Check error rates
- [ ] Analyze slow queries

### Maintenance
- [ ] Access `/superadmin/maintenance`
- [ ] Review scheduled tasks
- [ ] Execute a safe task
- [ ] Verify completion

---

## 🚨 What Super Admin CANNOT Do

Super Admin is for **system management**, NOT user features:

**❌ Cannot Access:**
- Chat interface (`/chat`)
- PDF upload features
- Document analysis
- Conversation management
- Profile settings
- Personal account features

**✅ Use Regular User Account Instead:**
For testing chat, PDF uploads, or document analysis, use:
```
Email:    enterprise.owner@lucatest.com
Password: TestPassword123!
```

---

## 🔐 Security Considerations

### Access Control
- Super admin emails must be in `SUPER_ADMIN_EMAILS` env var
- Session-based authentication required
- No API key authentication for super admin routes
- All super admin routes require `requireSuperAdmin` middleware

### Rate Limiting
Super admin endpoints have higher rate limits but are still protected:
- 1000 requests per 15 minutes
- Stricter monitoring for suspicious activity

### Audit Logging
All super admin actions are logged:
- User who performed action
- Timestamp
- Action type
- IP address
- Result (success/failure)

---

## 📊 API Endpoints Reference

### Authentication
```
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Super Admin Only
```
GET  /api/admin/kpis
GET  /api/admin/system/health
GET  /api/admin/system/threats
POST /api/admin/system/threats/:id/block
POST /api/admin/system/threats/:id/resolve
GET  /api/admin/system/integrations
GET  /api/admin/system/deployments
POST /api/admin/system/deployments/:id/rollback
GET  /api/admin/system/performance
GET  /api/admin/system/alerts
GET  /api/admin/system/maintenance
POST /api/admin/system/maintenance/:task/execute
GET  /api/admin/system/routes
```

---

## 🐛 Troubleshooting

### Cannot Access Super Admin Pages
**Problem:** Getting 401 Unauthorized  
**Solution:**
1. Verify you're logged in with `superadmin@lucatest.com`
2. Check `SUPER_ADMIN_EMAILS` environment variable is set
3. Clear browser cookies and login again
4. Verify session cookie is being sent

### KPIs Not Loading
**Problem:** Dashboard shows "Loading..." forever  
**Solution:**
1. Check browser console for errors
2. Verify `/api/admin/kpis` endpoint returns 200
3. Check database connection
4. Verify mock data in test environment

### Threats Page Empty
**Problem:** No threats displayed  
**Solution:**
1. This is normal if no threats detected
2. Generate test threats by:
   - Multiple failed login attempts
   - Rapid API requests without auth
3. Check system monitor is initialized

---

## 📝 Test Automation

### Automated E2E Test Location
```
tests/users/superadmin-system.e2e.test.ts
```

### Run Super Admin Tests
```bash
npx vitest run tests/users/superadmin-system.e2e.test.ts
```

### Test Coverage
- ✅ Login/logout flows
- ✅ Session persistence
- ✅ All super admin endpoints
- ✅ Access denial for non-super-admins
- ✅ Error handling

---

## 📞 Support

For issues or questions:
- Review `docs/SUPERADMIN_PAGES_CHANGELOG.md`
- Check server logs for errors
- Verify environment variables are set
- Test with mock data first

---

**Last Verified:** February 9, 2026  
**Test Environment:** Local Development  
**Production Ready:** ✅ Yes
