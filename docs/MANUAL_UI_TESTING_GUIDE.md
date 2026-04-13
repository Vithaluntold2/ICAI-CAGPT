# ICAI CAGPT Manual UI Testing Guide

## Step-by-Step User Testing Scenarios

**Version:** 1.0.0  
**Last Updated:** January 2, 2026  
**For:** QA Testers, Manual Testing

---

## 🔑 Test Account Credentials

**Password for ALL accounts:** `TestPassword123!`

| Tier | Login Email | What to Test |
|------|-------------|--------------|
| Super Admin | `superadmin@lucatest.com` | System settings, deployments |
| Admin | `admin@lucatest.com` | User management, analytics |
| Enterprise | `enterprise.owner@lucatest.com` | All premium features |
| Professional | `professional.cpa@lucatest.com` | API, forensic, white-label |
| Plus | `plus.business@lucatest.com` | Scenarios, 5 profiles |
| Free | `free.home@lucatest.com` | Basic features, limits |
| New User | `free.newuser@lucatest.com` | Onboarding flow |
| Locked | `locked.account@lucatest.com` | Lockout message |

---

## Test 1: Login Flow

### 1.1 Successful Login (Free User)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to `https://your-app.railway.app` | Landing page loads |
| 2 | Click **"Sign In"** button | Login form appears |
| 3 | Enter email: `free.home@lucatest.com` | Email field populated |
| 4 | Enter password: `TestPassword123!` | Password field shows dots |
| 5 | Click **"Sign In"** button | Loading spinner appears |
| 6 | Wait for redirect | Dashboard loads |
| 7 | Check top-right corner | Shows "Free Home User" or avatar |

✅ **Pass if:** Dashboard loads and user name appears  
❌ **Fail if:** Error message or stuck on login

---

### 1.2 Wrong Password

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to login page | Login form appears |
| 2 | Enter email: `free.home@lucatest.com` | |
| 3 | Enter password: `WrongPassword` | |
| 4 | Click **"Sign In"** | |
| 5 | Observe | Error: "Invalid email or password" |

✅ **Pass if:** Error message appears, stays on login page  
❌ **Fail if:** Logs in or shows different error

---

### 1.3 Locked Account

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to login page | |
| 2 | Enter email: `locked.account@lucatest.com` | |
| 3 | Enter password: `TestPassword123!` | |
| 4 | Click **"Sign In"** | |
| 5 | Observe | Error: "Account locked" or similar |

✅ **Pass if:** Shows locked message with unlock time  
❌ **Fail if:** Logs in successfully

---

## Test 2: Chat Feature

### 2.1 Basic Chat (Any User)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `free.home@lucatest.com` | Dashboard loads |
| 2 | Click **"New Chat"** or chat icon | Chat interface opens |
| 3 | Type: `What is depreciation?` | Text appears in input |
| 4 | Press Enter or click Send | Message appears in chat |
| 5 | Wait 2-10 seconds | AI response streams in |
| 6 | Read response | Explains depreciation clearly |

✅ **Pass if:** AI responds with relevant accounting info  
❌ **Fail if:** Error, no response, or irrelevant answer

---

### 2.2 Chat with Follow-up

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Continue from Test 2.1 | Previous chat visible |
| 2 | Type: `Give me an example` | |
| 3 | Send message | |
| 4 | Read response | AI gives depreciation example |
| 5 | Type: `What about for a car?` | |
| 6 | Send message | |
| 7 | Read response | AI explains car depreciation specifically |

✅ **Pass if:** AI remembers context from previous messages  
❌ **Fail if:** AI forgets context or gives generic response

---

### 2.3 Chat History Persistence

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Note the chat title (e.g., "Depreciation Question") | |
| 2 | Click **"New Chat"** | New empty chat opens |
| 3 | Look at sidebar/chat list | Previous chat visible in list |
| 4 | Click on previous chat | Old conversation loads |
| 5 | Verify messages | All previous messages visible |

✅ **Pass if:** Old chat loads with all messages  
❌ **Fail if:** Chat missing or messages lost

---

## Test 3: Subscription Limits

### 3.1 Free User - Profile Limit

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `free.home@lucatest.com` | |
| 2 | Go to **Profiles** section | Shows "My Taxes" profile |
| 3 | Click **"Create New Profile"** | |
| 4 | Try to create a Business profile | |
| 5 | Observe | Error: "Upgrade to Plus for more profiles" |

✅ **Pass if:** Shows upgrade prompt, blocks creation  
❌ **Fail if:** Allows creating second profile

---

### 3.2 Free User - Export Limit

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `free.home@lucatest.com` | |
| 2 | Open any chat conversation | |
| 3 | Click **"Export"** button | Export options appear |
| 4 | Try to select **PDF** | Option disabled or locked |
| 5 | Try to select **TXT** | Option available |
| 6 | Export as TXT | Download starts |

✅ **Pass if:** PDF locked, TXT works  
❌ **Fail if:** PDF downloads or TXT fails

---

### 3.3 Plus User - PDF Export Works

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `plus.business@lucatest.com` | |
| 2 | Open any chat conversation | |
| 3 | Click **"Export"** | Export options appear |
| 4 | Select **PDF** | Option available |
| 5 | Click export | PDF downloads |
| 6 | Open downloaded file | PDF opens with chat content |

✅ **Pass if:** PDF downloads and opens correctly  
❌ **Fail if:** PDF blocked or corrupted

---

### 3.4 Plus User - Scenario Simulator Access

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `plus.business@lucatest.com` | |
| 2 | Navigate to **Scenario Simulator** | Tool loads |
| 3 | Create a basic tax scenario | Form/wizard appears |
| 4 | Run simulation | Results display |

✅ **Pass if:** Simulator accessible and functional  
❌ **Fail if:** Blocked or errors

---

### 3.5 Free User - Scenario Simulator Blocked

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `free.home@lucatest.com` | |
| 2 | Try to access **Scenario Simulator** | |
| 3 | Observe | "Upgrade to Plus" message |

✅ **Pass if:** Shows upgrade prompt  
❌ **Fail if:** Allows access

---

## Test 4: Profile Management

### 4.1 View Profile

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `plus.family@lucatest.com` | |
| 2 | Go to **Profiles** | Profile list shows |
| 3 | Click on **"Johnson Family Finances"** | Profile details open |
| 4 | Check **Members** section | Shows: Owner (you), Spouse (admin), Child (viewer) |

✅ **Pass if:** All 3 family members visible with correct roles  
❌ **Fail if:** Members missing or wrong roles

---

### 4.2 Family Member - Viewer Permissions

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `plus.family.child@lucatest.com` | |
| 2 | Go to **Profiles** | |
| 3 | Click on **"Johnson Family Finances"** | Profile opens |
| 4 | Try to **edit** profile name | Edit button missing or disabled |
| 5 | Try to **invite** new member | Invite button missing or disabled |
| 6 | Try to view financial data | Data is visible (read-only) |

✅ **Pass if:** Can view but cannot edit or invite  
❌ **Fail if:** Can edit or invite members

---

### 4.3 Family Member - Admin Permissions

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `plus.family.spouse@lucatest.com` | |
| 2 | Go to Johnson Family profile | |
| 3 | Try to **edit** profile settings | Can edit |
| 4 | Try to **invite** new member | Invite form opens |
| 5 | Try to **delete** profile | Delete button missing or disabled |

✅ **Pass if:** Can edit and invite, but cannot delete  
❌ **Fail if:** Can delete or cannot edit

---

## Test 5: Document Upload

### 5.1 Upload PDF Document

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `plus.business@lucatest.com` | |
| 2 | Go to **Documents** or open chat | |
| 3 | Click **Upload** or attach icon | File picker opens |
| 4 | Select a PDF file (any receipt or statement) | File selected |
| 5 | Upload | Progress bar, then "Uploaded" |
| 6 | Check document list | New document appears |

✅ **Pass if:** Document uploads and appears in list  
❌ **Fail if:** Error or document missing

---

### 5.2 Chat About Uploaded Document

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Continue from Test 5.1 | |
| 2 | Start new chat or attach document to chat | |
| 3 | Type: `Summarize this document` | |
| 4 | Send | AI analyzes document |
| 5 | Read response | AI summarizes document content |

✅ **Pass if:** AI correctly references document content  
❌ **Fail if:** AI doesn't understand or ignores document

---

### 5.3 Free User - Document Limit

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `quota.exhausted@lucatest.com` | |
| 2 | Try to upload a document | |
| 3 | Observe | "Monthly limit reached" or upgrade prompt |

✅ **Pass if:** Shows limit message  
❌ **Fail if:** Allows upload

---

## Test 6: Admin Dashboard

### 6.1 Admin Access

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `admin@lucatest.com` | |
| 2 | Look for **Admin** link in navigation | Link visible |
| 3 | Click **Admin** | Admin dashboard loads |
| 4 | Check for sections: Users, Analytics, Training Data | All sections visible |

✅ **Pass if:** Admin dashboard loads with all sections  
❌ **Fail if:** Access denied or sections missing

---

### 6.2 Regular User - No Admin Access

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `free.home@lucatest.com` | |
| 2 | Look for **Admin** link | Link NOT visible |
| 3 | Try URL: `/admin` directly | Access denied or redirected |

✅ **Pass if:** No admin link, direct URL blocked  
❌ **Fail if:** Can access admin

---

### 6.3 Admin - User Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `admin@lucatest.com` | |
| 2 | Go to **Admin > Users** | User list loads |
| 3 | Search for `free.student@lucatest.com` | User found |
| 4 | Click on user | User details open |
| 5 | Find subscription tier dropdown | Shows "free" |
| 6 | Change to "plus" | Dropdown changes |
| 7 | Save | Success message |
| 8 | Login as `free.student@lucatest.com` in new window | |
| 9 | Check for Plus features | Plus features now available |

✅ **Pass if:** Tier change takes effect immediately  
❌ **Fail if:** Change doesn't save or doesn't take effect

---

## Test 7: Super Admin Features

### 7.1 System Monitoring Access

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `superadmin@lucatest.com` | |
| 2 | Go to **Admin > System Monitoring** | System dashboard loads |
| 3 | Check for: CPU, Memory, Active Users | Metrics visible |

✅ **Pass if:** System metrics visible  
❌ **Fail if:** Access denied

---

### 7.2 Regular Admin - No System Access

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `admin@lucatest.com` | |
| 2 | Look for **System Monitoring** | Link NOT visible or disabled |
| 3 | Try direct URL: `/admin/system/monitoring` | Access denied |

✅ **Pass if:** Blocked for regular admin  
❌ **Fail if:** Can access

---

## Test 8: Excel Generation

### 8.1 Generate NPV Calculation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `plus.business@lucatest.com` | |
| 2 | Start chat | |
| 3 | Type: `Calculate NPV for investment: $100,000 initial, cash flows $30,000/year for 5 years, 10% discount rate` | |
| 4 | Send | AI responds |
| 5 | Look for **"Download Excel"** button | Button appears |
| 6 | Click download | Excel file downloads |
| 7 | Open Excel file | Contains formulas (=NPV(...)) |
| 8 | Check cell with NPV result | Shows calculated value via formula |

✅ **Pass if:** Excel has formulas, not hardcoded numbers  
❌ **Fail if:** No download or hardcoded values

---

## Test 9: Mobile Responsiveness

### 9.1 Mobile Login

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open app on mobile phone or resize browser to 375px wide | |
| 2 | Navigate to login | Login form fits screen |
| 3 | Enter credentials | Keyboard appears, form scrolls |
| 4 | Submit | Login works |

✅ **Pass if:** Form usable on mobile  
❌ **Fail if:** Elements overlap or off-screen

---

### 9.2 Mobile Chat

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login on mobile | |
| 2 | Open chat | Chat interface fits screen |
| 3 | Type message | Keyboard doesn't hide input |
| 4 | Send | Message appears |
| 5 | Read response | Response readable, scrollable |

✅ **Pass if:** Chat fully functional on mobile  
❌ **Fail if:** Input hidden or unreadable

---

## Test 10: Error Handling

### 10.1 Network Error Recovery

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login normally | |
| 2 | Start a chat | |
| 3 | Turn off WiFi/internet | |
| 4 | Send a message | |
| 5 | Observe | Error: "No internet connection" or similar |
| 6 | Turn WiFi back on | |
| 7 | Retry or refresh | Message sends or recovers |

✅ **Pass if:** Clear error message, recovers gracefully  
❌ **Fail if:** App crashes or freezes

---

### 10.2 Session Expiry

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login | |
| 2 | Leave tab open for 30+ minutes without activity | |
| 3 | Try to perform action | |
| 4 | Observe | Either still works OR prompts to re-login |

✅ **Pass if:** Graceful handling (works or re-login prompt)  
❌ **Fail if:** Cryptic error or data loss

---

## Test 11: Professional Features

### 11.1 Forensic Analysis (Pro Only)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `professional.cpa@lucatest.com` | |
| 2 | Navigate to **Forensic Intelligence** | Tool loads |
| 3 | Upload a financial document | |
| 4 | Run forensic analysis | |
| 5 | Review results | Shows anomalies, risk flags |

✅ **Pass if:** Forensic analysis runs and shows findings  
❌ **Fail if:** Blocked or no results

---

### 11.2 Forensic Blocked for Plus

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `plus.business@lucatest.com` | |
| 2 | Try to access **Forensic Intelligence** | |
| 3 | Observe | "Upgrade to Professional" message |

✅ **Pass if:** Shows upgrade prompt  
❌ **Fail if:** Allows access

---

## Test 12: Onboarding Flow

### 12.1 New User First Login

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `free.newuser@lucatest.com` | |
| 2 | Observe | Onboarding wizard or "Create your first profile" |
| 3 | Follow prompts to create profile | Profile created |
| 4 | Complete onboarding | Taken to dashboard |

✅ **Pass if:** Guided through setup  
❌ **Fail if:** Dumped on empty dashboard

---

## Quick Test Checklist

### Smoke Test (5 minutes)
- [ ] Login works
- [ ] Chat responds
- [ ] Can see profile
- [ ] Can logout

### Full Regression (30 minutes)
- [ ] All login scenarios (1.1-1.3)
- [ ] Chat with context (2.1-2.3)
- [ ] Free user limits (3.1-3.2)
- [ ] Plus features work (3.3-3.4)
- [ ] Profile permissions (4.1-4.3)
- [ ] Document upload (5.1-5.2)
- [ ] Admin access control (6.1-6.3)
- [ ] Excel generation (8.1)
- [ ] Mobile works (9.1-9.2)

---

## Bug Report Template

When a test fails, report:

```
**Test ID:** 3.1 Free User - Profile Limit
**Account Used:** free.home@lucatest.com
**Expected:** Error "Upgrade to Plus for more profiles"
**Actual:** Second profile was created successfully
**Steps to Reproduce:**
1. Login as free.home@lucatest.com
2. Go to Profiles
3. Click Create New Profile
4. Select Business type
5. Click Create
**Screenshot:** [attach]
**Browser:** Chrome 120 / macOS
```

---

*Last tested: [DATE] by [TESTER NAME]*
