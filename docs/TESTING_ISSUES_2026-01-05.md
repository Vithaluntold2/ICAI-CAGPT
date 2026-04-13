# Testing Issues Report - January 5, 2026

## Enterprise User Testing Results

### ✅ **PASSED**
- Step 1: Login
- Step 2: What You See After Login
- Step 3: Click Your Profile  
- Step 4: Use All 10 Chat Modes

### ❌ **FAILED - Step 5: Ask a Question**

#### Issue 1: Scenario Simulator Errors
**Status:** Needs Investigation
**Location:** `/client/src/pages/ScenarioSimulator.tsx`
**Impact:** Enterprise users cannot use scenario simulation feature

**Root Cause Analysis:**
- Backend routes for scenario simulation exist at `/api/scenarios/playbooks`
- Need to check specific error messages
- May be permissions/tier checking issue

**Action Items:**
1. Check browser console for specific errors
2. Verify user tier checking in routes
3. Test with enterprise user credentials
4. Check database schema for scenario tables

#### Issue 2: Financial Calculation - Missing Download Button
**Status:** Confirmed Missing
**Location:** `/client/src/components/OutputPane.tsx` and `/client/src/components/SpreadsheetViewer.tsx`
**Impact:** Users cannot download Excel files from calculations

**Root Cause:**
- Download button exists but only shows when `hasExcel=true` prop is passed
- May not be propagating correctly from Chat page to OutputPane

**Files Involved:**
- `client/src/pages/Chat.tsx` - needs to set `hasExcel` prop
- `client/src/components/OutputPane.tsx` - displays download button
- `server/routes.ts` - `/api/conversations/:id/messages/:messageId/excel` endpoint

**Fix Required:**
```typescript
// In Chat.tsx, need to set hasExcel when message has Excel data
<OutputPane
  content={outputContent}
  visualization={outputVisualization}
  hasExcel={currentMessage?.metadata?.hasExcel || false}
  conversationId={activeConversation}
  messageId={outputMessageId}
  // ...other props
/>
```

#### Issue 3: Upload Document Errors
**Status:** Needs Investigation  
**Location:** File upload handling in `/server/routes.ts`
**Impact:** Users cannot upload documents for analysis

**Possible Causes:**
- File size limits
- MIME type restrictions
- Virus scanning failures
- Storage/encryption errors

**Action Items:**
1. Check specific error messages
2. Verify file upload multer configuration
3. Check virus scanning service status
4. Verify document analyzer integration

### ❌ **MISSING - Steps 8, 9, 10**
**Status:** Features Not Implemented
**Impact:** Cannot test these features

**Required Features:**
- Step 8: Unknown feature
- Step 9: Unknown feature  
- Step 10: Unknown feature

**Action:** Need user guide reference to identify what these steps should be

---

## Professional User Testing Results

### ✅ **PASSED**
- Step 1: Login
- Step 2: What You See After Login
- Step 3: What Professional Can Do

### ⚠️ **PASSED WITH ISSUES - Step 4: Forensic Intelligence**
**Status:** Works but needs enhancement
**Location:** `/client/src/pages/ForensicIntelligence.tsx`
**Impact:** User experience not optimal

**Current Behavior:**
- Directly analyzes uploaded document
- Shows results immediately

**Expected Behavior:**
- Should ask clarifying questions first
- Questions based on document type/content
- Generate structured output after user responses
- Show pie charts, flow charts, quality assessments

**Enhancement Required:**
Create interactive questionnaire workflow:
1. User uploads document
2. System analyzes document type
3. System generates relevant questions
4. User answers questions
5. System performs deep analysis with context
6. Generate visualizations (pie charts, flow charts)
7. Provide percentage-based quality assessment

**Files to Modify:**
- `server/services/forensicAnalyzer.ts` - add questionnaire generation
- `client/src/pages/ForensicIntelligence.tsx` - add multi-step workflow UI

### ❌ **FAILED - Step 5: Generate API Key**
**Status:** Feature Not Implemented
**Location:** Backend route missing
**Impact:** Professional users cannot generate API keys

**Missing Implementation:**
- Backend route: `/api/user/api-keys` (POST, GET, DELETE)
- Frontend page: `/client/src/pages/API.tsx` (exists but incomplete)
- Database schema: Need `user_api_keys` table

**Required Implementation:**

```typescript
// Database Schema
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  key_name VARCHAR(255) NOT NULL,
  api_key_hash VARCHAR(255) NOT NULL,
  api_key_prefix VARCHAR(16) NOT NULL, -- First 8 chars for display
  permissions JSONB DEFAULT '[]',
  rate_limit INTEGER DEFAULT 1000,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);
```

```typescript
// Backend Routes Needed
POST   /api/user/api-keys          - Generate new API key
GET    /api/user/api-keys          - List user's API keys
DELETE /api/user/api-keys/:id      - Revoke API key
POST   /api/user/api-keys/:id/regenerate - Regenerate key
```

**Security Requirements:**
- Hash API keys with bcrypt before storing
- Only show full key once at generation
- Implement rate limiting per key
- Allow permission scoping (read, write, admin)
- Support key expiration

### ❌ **FAILED - Step 6: White-Label Reports**
**Status:** Feature Not Implemented  
**Location:** Backend route missing
**Impact:** Professional users cannot set up white-label reports

**Missing Implementation:**
- Backend route: `/api/user/white-label` (GET, POST, PUT)
- Frontend page: White-label settings UI
- Database schema: Need `white_label_configs` table

**Required Implementation:**

```typescript
// Database Schema
CREATE TABLE white_label_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  company_name VARCHAR(255) NOT NULL,
  company_logo_url VARCHAR(500),
  primary_color VARCHAR(7), -- Hex color
  secondary_color VARCHAR(7),
  custom_header TEXT,
  custom_footer TEXT,
  show_powered_by BOOLEAN DEFAULT true,
  custom_domain VARCHAR(255),
  email_signature TEXT,
  report_template JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

```typescript
// Backend Routes Needed
GET    /api/user/white-label       - Get white-label config
POST   /api/user/white-label       - Create white-label config
PUT    /api/user/white-label       - Update white-label config
POST   /api/user/white-label/logo  - Upload logo
DELETE /api/user/white-label/logo  - Remove logo
POST   /api/user/white-label/preview - Preview report with branding
```

**Features Required:**
- Company branding (name, logo, colors)
- Custom headers/footers for reports
- Email signature customization
- Report template customization
- Optional "Powered by Luca" removal
- Custom domain support
- Preview before applying

---

## Priority Fixes

### 🔥 **HIGH PRIORITY**
1. **Fix Download Button** - Critical for financial calculations feature
2. **Implement API Key Generation** - Promised Professional tier feature
3. **Fix Upload Document Errors** - Blocking multiple features

### ⚠️ **MEDIUM PRIORITY**
4. **Implement White-Label Reports** - Important Professional feature
5. **Enhance Forensic Intelligence** - Improve user experience
6. **Fix Scenario Simulator Errors** - Enterprise feature not working

### 📝 **LOW PRIORITY**
7. **Identify Steps 8-10** - Need clarification on requirements

---

## Immediate Action Plan

### Phase 1: Critical Fixes (Today)
1. ✅ Fix document export markdown formatting (COMPLETED)
2. 🔄 Fix download button visibility for financial calculations
3. 🔄 Investigate and fix upload document errors
4. 🔄 Debug scenario simulator errors

### Phase 2: Missing Features (Next 2 days)
5. 🔄 Implement API key generation system
6. 🔄 Implement white-label reports system
7. 🔄 Enhance forensic intelligence workflow

### Phase 3: Enhancements (Next week)
8. 🔄 Add interactive questionnaire to forensic intelligence
9. 🔄 Improve error messaging across all features
10. 🔄 Add comprehensive testing for all tiers

---

## Testing Checklist for Next Round

### Enterprise User
- [ ] Scenario Simulator creates playbook successfully
- [ ] Scenario Simulator runs simulation without errors
- [ ] Scenario Simulator shows results with charts
- [ ] Financial Calculation shows download button
- [ ] Financial Calculation Excel file downloads correctly
- [ ] Upload Document accepts all supported formats
- [ ] Upload Document processes without errors
- [ ] All 10 chat modes work correctly
- [ ] Steps 8, 9, 10 identified and tested

### Professional User
- [ ] API Key generation page loads
- [ ] API Key can be generated
- [ ] API Key can be copied
- [ ] API Key can be revoked
- [ ] Multiple API keys can be managed
- [ ] White-label settings page loads
- [ ] White-label logo can be uploaded
- [ ] White-label colors can be customized
- [ ] White-label preview works
- [ ] Forensic Intelligence asks questions
- [ ] Forensic Intelligence shows visualizations
- [ ] Forensic Intelligence quality assessment works

---

## Error Logs Needed

To fix these issues, please provide:

1. **Browser Console Errors** - for scenario simulator
2. **Network Tab Errors** - for API calls
3. **Specific Error Messages** - shown to users
4. **Steps to Reproduce** - exact sequence of actions
5. **Test Credentials** - for each user tier

---

**Report Date:** January 5, 2026  
**Status:** Investigation in Progress  
**Next Update:** After implementing fixes
