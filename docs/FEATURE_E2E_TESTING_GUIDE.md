# ICAI CAGPT Feature E2E Testing Guide

## Complete End-to-End Testing Coverage for All Features

**Version:** 1.0.0  
**Last Updated:** January 2, 2026  
**Scope:** All application features, services, and integrations

---

## 🔑 Quick Start: Test Accounts

**Password for ALL test accounts:** `TestPassword123!`

| Feature Category | Test Account | Tier Features |
|------------------|--------------|---------------|
| Basic Chat, Profiles | `free.home@lucatest.com` | 500 queries, 10 docs, 1 profile |
| Scenario Simulator, Deliverables | `plus.business@lucatest.com` | 3K queries, 5 profiles |
| API, Forensic, White-label | `professional.cpa@lucatest.com` | Unlimited, API access |
| SSO, Multi-user, Custom AI | `enterprise.owner@lucatest.com` | All features |
| Admin Dashboard | `admin@lucatest.com` | User/training management |
| System Monitoring | `superadmin@lucatest.com` | Deployments, maintenance |

---

## Table of Contents

1. [Chat & AI Features](#1-chat--ai-features)
2. [Document Processing](#2-document-processing)
3. [Excel & Financial Models](#3-excel--financial-models)
4. [Scenario Simulator](#4-scenario-simulator)
5. [Forensic Intelligence](#5-forensic-intelligence)
6. [Deliverable Composer](#6-deliverable-composer)
7. [Export Features](#7-export-features)
8. [Profile & Member Management](#8-profile--member-management)
9. [Integrations](#9-integrations)
10. [Subscription & Billing](#10-subscription--billing)
11. [Security Features](#11-security-features)
12. [Admin Features](#12-admin-features)
13. [System Health & Monitoring](#13-system-health--monitoring)

---

## 1. Chat & AI Features

### 1.1 Basic Chat Functionality

| Test ID | Feature | Test Steps | Expected Result | Test Account |
|---------|---------|------------|-----------------|--------------|
| CHAT-001 | Send message | POST `/api/chat` with `{ message: "What is depreciation?" }` | AI response with explanation | `free.home@lucatest.com` |
| CHAT-002 | Streaming chat | POST `/api/chat/stream` with message | SSE stream with chunks | Any |
| CHAT-003 | Chat with history | Send follow-up in same conversation | Context from previous messages used | Any |
| CHAT-004 | Create conversation | POST message with new `conversationId` | New conversation created in DB | Any |
| CHAT-005 | Auto-title generation | Send first message | Conversation title auto-generated | Any |
| CHAT-006 | Conversation list | GET `/api/conversations` | List sorted by date, pinned first | Any |
| CHAT-007 | Pin conversation | PATCH `/api/conversations/:id/pin` | Pinned status toggled | Any |
| CHAT-008 | Delete conversation | DELETE `/api/conversations/:id` | Conversation and messages removed | Any |
| CHAT-009 | Share conversation | POST `/api/conversations/:id/share` | Share token generated | Any |
| CHAT-010 | View shared conversation | GET `/api/shared/:token` | Public read-only access | Guest |

**Test Code:**
```typescript
describe('Basic Chat', () => {
  it('CHAT-001: should process a simple query', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Cookie', freeCookie)
      .send({
        message: 'What is depreciation?',
        conversationId: 'new-conv-123',
      });
    
    expect(res.status).toBe(200);
    expect(res.body.response).toContain('depreciation');
    expect(res.body.conversationId).toBeDefined();
  });

  it('CHAT-003: should use conversation history', async () => {
    // First message
    await request(app)
      .post('/api/chat')
      .set('Cookie', freeCookie)
      .send({ message: 'What is MACRS?', conversationId: 'conv-history-test' });
    
    // Follow-up
    const res = await request(app)
      .post('/api/chat')
      .set('Cookie', freeCookie)
      .send({ message: 'What are the recovery periods?', conversationId: 'conv-history-test' });
    
    // Should reference MACRS without repeating
    expect(res.body.response).toContain('year');
  });
});
```

### 1.2 Chat Modes (Professional Features)

| Test ID | Mode | Test Steps | Expected Result | Required Tier |
|---------|------|------------|-----------------|---------------|
| MODE-001 | `deep-research` | Query with IRC citations needed | Response with IRC § references | Plus+ |
| MODE-002 | `calculation` | "Calculate NPV of $100K investment at 8%" | Excel file generated with formulas | Plus+ |
| MODE-003 | `checklist` | "Compliance checklist for S-Corp" | Structured checklist with deadlines | Plus+ |
| MODE-004 | `workflow` | "Show tax filing workflow" | Mermaid diagram generated | Plus+ |
| MODE-005 | `scenario-simulator` | "Compare LLC vs S-Corp" | Multi-scenario comparison | Plus+ |
| MODE-006 | `forensic-intelligence` | Upload bank statement + "Find anomalies" | Fraud indicators flagged | Professional+ |
| MODE-007 | `roundtable` | Complex tax question | Multi-expert perspective response | Plus+ |
| MODE-008 | `audit-plan` | "Create audit plan for nonprofit" | Risk assessment + procedures | Professional+ |
| MODE-009 | `deliverable` | "Draft engagement letter" | Professional document generated | Plus+ |

**Test Code:**
```typescript
describe('Chat Modes', () => {
  it('MODE-001: deep-research should include IRC citations', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Cookie', plusCookie)
      .send({
        message: 'What are the rules for home office deduction?',
        mode: 'deep-research',
      });
    
    expect(res.status).toBe(200);
    expect(res.body.response).toMatch(/IRC §|Internal Revenue Code/);
    expect(res.body.mode).toBe('deep-research');
  });

  it('MODE-002: calculation should generate Excel', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Cookie', plusCookie)
      .send({
        message: 'Calculate NPV for investment: $100,000 initial, cash flows of $30,000 for 5 years, 10% discount rate',
        mode: 'calculation',
      });
    
    expect(res.status).toBe(200);
    expect(res.body.excel).toBeDefined();
    expect(res.body.excel.base64).toBeDefined();
  });

  it('MODE-006: forensic requires Professional tier', async () => {
    // Plus user - should be denied
    const plusRes = await request(app)
      .post('/api/chat')
      .set('Cookie', plusCookie)
      .send({ message: 'Analyze for fraud', mode: 'forensic-intelligence' });
    
    expect(plusRes.status).toBe(403);

    // Professional user - should work
    const proRes = await request(app)
      .post('/api/chat')
      .set('Cookie', proCookie)
      .send({ message: 'Analyze for fraud', mode: 'forensic-intelligence' });
    
    expect(proRes.status).toBe(200);
  });
});
```

### 1.3 Message Feedback

| Test ID | Feature | Test Steps | Expected Result |
|---------|---------|------------|-----------------|
| FEED-001 | Thumbs up | POST feedback with `isPositive: true` | Feedback recorded, used for training |
| FEED-002 | Thumbs down | POST feedback with `isPositive: false` | Correction requested |
| FEED-003 | Correction | Submit corrected response | Stored for fine-tuning dataset |
| FEED-004 | Conversation rating | Rate 1-5 stars | Quality score updated |

---

## 2. Document Processing

### 2.1 File Upload in Chat

| Test ID | Feature | Test Steps | Expected Result | Limits |
|---------|---------|------------|-----------------|--------|
| DOC-001 | Upload PDF | Attach PDF to chat message | Text extracted, analyzed | 10MB max |
| DOC-002 | Upload image | Attach PNG/JPEG | OCR processed | 10MB max |
| DOC-003 | Upload Excel | Attach XLSX | Data parsed, tables extracted | 10MB max |
| DOC-004 | Tax form detection | Upload W-2 or 1099 | Form type identified | Any |
| DOC-005 | Multiple files | Upload 3 files | All processed in context | 10MB each |
| DOC-006 | Invalid file type | Upload .exe file | 400 error, rejected | N/A |
| DOC-007 | Oversized file | Upload 15MB file | 413 error | N/A |
| DOC-008 | Virus-infected file | Upload test virus | 400 error, blocked | N/A |

**Test Code:**
```typescript
describe('Document Processing', () => {
  it('DOC-001: should extract text from PDF', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Cookie', plusCookie)
      .attach('files', './test-fixtures/sample-invoice.pdf')
      .field('message', 'Summarize this invoice');
    
    expect(res.status).toBe(200);
    expect(res.body.response).toContain('invoice');
    expect(res.body.attachments).toHaveLength(1);
  });

  it('DOC-006: should reject invalid file types', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Cookie', plusCookie)
      .attach('files', './test-fixtures/malicious.exe')
      .field('message', 'Process this');
    
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('file type');
  });
});
```

### 2.2 Tax File Management

| Test ID | Feature | Test Steps | Expected Result |
|---------|---------|------------|-----------------|
| TAXF-001 | Upload tax file | POST `/api/tax-files` with encrypted file | File stored, virus scanned |
| TAXF-002 | List tax files | GET `/api/tax-files` | User's files (not deleted) |
| TAXF-003 | Download tax file | GET `/api/tax-files/:id/download` | Decrypted file returned |
| TAXF-004 | Delete tax file | DELETE `/api/tax-files/:id` | Soft deleted, file overwritten |
| TAXF-005 | Vendor filter | GET `/api/tax-files?vendor=quickbooks` | Filtered by vendor |
| TAXF-006 | Checksum verification | Download after upload | Checksum matches original |

---

## 3. Excel & Financial Models

### 3.1 Excel Formula Generation

| Test ID | Feature | Test Steps | Expected Result |
|---------|---------|------------|-----------------|
| EXCEL-001 | Simple formula | "Create VLOOKUP formula" | Excel formula returned |
| EXCEL-002 | Complex formula | "INDEX-MATCH with multiple criteria" | Working formula |
| EXCEL-003 | VBA macro | POST `/api/excel/generate-vba` | VBA code generated |
| EXCEL-004 | Parse uploaded Excel | POST `/api/excel/parse` with file | Data extracted as JSON |

### 3.2 Financial Model Generation

| Test ID | Model Type | Test Steps | Expected Result |
|---------|------------|------------|-----------------|
| MODEL-001 | DCF Model | POST `/api/excel/generate-model` type: dcf | 3-tab workbook with formulas |
| MODEL-002 | LBO Model | type: lbo | Debt schedule, returns analysis |
| MODEL-003 | 3-Statement | type: three-statement | IS, BS, CF linked |
| MODEL-004 | Budget Template | type: budget | Monthly/annual budget |
| MODEL-005 | Cap Table | type: cap-table | Equity waterfall |
| MODEL-006 | M&A Model | type: merger | Synergy analysis |

**Test Code:**
```typescript
describe('Excel Generation', () => {
  it('MODEL-001: should generate DCF model', async () => {
    const res = await request(app)
      .post('/api/excel/generate-model')
      .set('Cookie', plusCookie)
      .send({
        type: 'dcf',
        parameters: {
          projectionYears: 5,
          terminalGrowthRate: 0.02,
          wacc: 0.10,
        },
      });
    
    expect(res.status).toBe(200);
    expect(res.body.filename).toContain('.xlsx');
    expect(res.body.base64).toBeDefined();
    
    // Verify it's a valid Excel file
    const buffer = Buffer.from(res.body.base64, 'base64');
    expect(buffer.slice(0, 4).toString('hex')).toBe('504b0304'); // XLSX magic bytes
  });
});
```

### 3.3 Financial Calculations

| Test ID | Calculation | Input | Expected Formula |
|---------|-------------|-------|------------------|
| CALC-001 | NPV | Cash flows + discount rate | `=NPV(rate, values) + initial` |
| CALC-002 | IRR | Cash flows | `=IRR(values)` |
| CALC-003 | Corporate Tax (US) | $500K income, C-Corp | Brackets: 21% federal |
| CALC-004 | Corporate Tax (India) | ₹1Cr income | 25%/30% based on turnover |
| CALC-005 | GST (India) | ₹10,000 sale, inter-state | IGST @ applicable rate |
| CALC-006 | TDS (India) | ₹50,000 professional fee | Section 194J @ 10% |
| CALC-007 | Depreciation MACRS | $100K asset, 5-year | Year 1: 20%, Year 2: 32%, etc. |
| CALC-008 | Depreciation SLN | $100K, 10 years, $10K salvage | `=(100000-10000)/10` |

**Test Code:**
```typescript
describe('Financial Calculations', () => {
  it('CALC-001: should provide NPV Excel formula', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Cookie', plusCookie)
      .send({
        message: 'Calculate NPV: Initial $100,000, annual cash flows of $30,000 for 5 years, 8% discount rate',
        mode: 'calculation',
      });
    
    expect(res.status).toBe(200);
    // Should contain Excel formula, NOT a computed number
    expect(res.body.response).toMatch(/=NPV\(/);
    expect(res.body.excel).toBeDefined();
  });

  it('CALC-007: should calculate MACRS depreciation', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Cookie', plusCookie)
      .send({
        message: 'MACRS depreciation schedule for $100,000 equipment, 5-year property',
        mode: 'calculation',
      });
    
    expect(res.status).toBe(200);
    expect(res.body.response).toContain('Year 1');
    expect(res.body.response).toContain('20%'); // First year rate
  });
});
```

---

## 4. Scenario Simulator

### 4.1 Playbook Management

| Test ID | Feature | Endpoint | Expected Result | Required Tier |
|---------|---------|----------|-----------------|---------------|
| SCEN-001 | Create playbook | POST `/api/scenarios/playbooks` | Playbook created with baseline | Plus+ |
| SCEN-002 | List playbooks | GET `/api/scenarios/playbooks` | User's playbooks | Plus+ |
| SCEN-003 | Get playbook | GET `/api/scenarios/playbooks/:id` | Full details + variants | Plus+ |
| SCEN-004 | Update playbook | PATCH `/api/scenarios/playbooks/:id` | Playbook updated | Plus+ |
| SCEN-005 | Delete playbook | DELETE `/api/scenarios/playbooks/:id` | Playbook removed | Plus+ |

### 4.2 Variant & Simulation

| Test ID | Feature | Test Steps | Expected Result |
|---------|---------|------------|-----------------|
| SCEN-010 | Create variant | POST `/api/scenarios/playbooks/:id/variants` | Alternative scenario added |
| SCEN-011 | Run simulation | POST `/api/scenarios/playbooks/:id/simulate` | Comparison results generated |
| SCEN-012 | Compare entities | Baseline LLC vs Variant S-Corp | Tax liability comparison |
| SCEN-013 | Optimal suggestion | Multiple variants | System recommends best option |
| SCEN-014 | Export comparison | GET simulation as PDF/XLSX | Downloadable report |

**Test Code:**
```typescript
describe('Scenario Simulator', () => {
  let playbookId: string;

  it('SCEN-001: should create a tax scenario playbook', async () => {
    const res = await request(app)
      .post('/api/scenarios/playbooks')
      .set('Cookie', plusCookie)
      .send({
        name: 'Entity Selection 2026',
        baselineConfig: {
          entityType: 'sole-proprietor',
          jurisdiction: 'US-CA',
          annualRevenue: 250000,
          annualExpenses: 100000,
          ownerSalary: 75000,
        },
      });
    
    expect(res.status).toBe(201);
    playbookId = res.body.id;
  });

  it('SCEN-010: should create S-Corp variant', async () => {
    const res = await request(app)
      .post(`/api/scenarios/playbooks/${playbookId}/variants`)
      .set('Cookie', plusCookie)
      .send({
        name: 'S-Corp Option',
        config: {
          entityType: 's-corp',
          ownerSalary: 80000, // Reasonable salary
        },
      });
    
    expect(res.status).toBe(201);
  });

  it('SCEN-011: should run simulation and compare taxes', async () => {
    const res = await request(app)
      .post(`/api/scenarios/playbooks/${playbookId}/simulate`)
      .set('Cookie', plusCookie);
    
    expect(res.status).toBe(200);
    expect(res.body.baseline.totalTax).toBeDefined();
    expect(res.body.variants[0].totalTax).toBeDefined();
    expect(res.body.recommendation).toBeDefined();
  });
});
```

---

## 5. Forensic Intelligence

### 5.1 Case Management

| Test ID | Feature | Endpoint | Expected Result | Required Tier |
|---------|---------|----------|-----------------|---------------|
| FOR-001 | Create case | POST `/api/forensics/cases` | Case created | Professional+ |
| FOR-002 | List cases | GET `/api/forensics/cases` | User's cases | Professional+ |
| FOR-003 | Get case details | GET `/api/forensics/cases/:id` | Case + findings | Professional+ |
| FOR-004 | Upload document | POST `/api/forensics/cases/:id/documents` | Document analyzed | Professional+ |
| FOR-005 | Get findings | GET `/api/forensics/cases/:id/findings` | Anomalies detected | Professional+ |

### 5.2 Anomaly Detection

| Test ID | Anomaly Type | Test Data | Expected Finding |
|---------|--------------|-----------|------------------|
| FOR-010 | Round numbers | Transaction: $50,000.00 | Flag: Suspiciously round amount |
| FOR-011 | Weekend transactions | Date: Saturday | Flag: Unusual business day |
| FOR-012 | Missing fields | Vendor blank | Flag: Incomplete record |
| FOR-013 | Duplicate invoices | Same invoice 2x | Flag: Potential duplicate payment |
| FOR-014 | Unusual timing | 3 AM transaction | Flag: After-hours activity |
| FOR-015 | Amount threshold | Just under approval limit | Flag: Split transaction pattern |

**Test Code:**
```typescript
describe('Forensic Intelligence', () => {
  let caseId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/forensics/cases')
      .set('Cookie', proCookie)
      .send({
        name: 'Vendor Fraud Investigation',
        description: 'Analyzing vendor payments for anomalies',
      });
    caseId = res.body.id;
  });

  it('FOR-004: should analyze uploaded document', async () => {
    const res = await request(app)
      .post(`/api/forensics/cases/${caseId}/documents`)
      .set('Cookie', proCookie)
      .attach('file', './test-fixtures/suspicious-transactions.xlsx');
    
    expect(res.status).toBe(200);
    expect(res.body.documentId).toBeDefined();
    expect(res.body.analysisStarted).toBe(true);
  });

  it('FOR-010: should detect round number anomalies', async () => {
    // Wait for analysis to complete
    await new Promise(r => setTimeout(r, 5000));
    
    const res = await request(app)
      .get(`/api/forensics/cases/${caseId}/findings`)
      .set('Cookie', proCookie);
    
    expect(res.status).toBe(200);
    const roundNumberFindings = res.body.filter(
      (f: any) => f.type === 'round_number'
    );
    expect(roundNumberFindings.length).toBeGreaterThan(0);
  });
});
```

---

## 6. Deliverable Composer

### 6.1 Template Management

| Test ID | Feature | Endpoint | Expected Result |
|---------|---------|----------|-----------------|
| DEL-001 | List templates | GET `/api/deliverables/templates` | System + user templates |
| DEL-002 | Get template | GET `/api/deliverables/templates/:id` | Template with variables |
| DEL-003 | Create custom template | POST `/api/deliverables/templates` | User template created |

### 6.2 Document Generation

| Test ID | Document Type | Test Steps | Expected Result | Required Tier |
|---------|---------------|------------|-----------------|---------------|
| DEL-010 | Engagement letter | Generate with client details | Professional PDF | Plus+ |
| DEL-011 | Tax memo | Generate with analysis | Formatted memo | Plus+ |
| DEL-012 | Audit report | Generate with findings | Structured report | Professional+ |
| DEL-013 | Opinion letter | Generate with conclusions | Legal-style letter | Professional+ |
| DEL-014 | Management letter | Generate with recommendations | Client letter | Plus+ |
| DEL-015 | Custom template | User-defined template | Custom output | Plus+ |

**Test Code:**
```typescript
describe('Deliverable Composer', () => {
  it('DEL-010: should generate engagement letter', async () => {
    const res = await request(app)
      .post('/api/deliverables/generate')
      .set('Cookie', plusCookie)
      .send({
        templateId: 'engagement-letter',
        variables: {
          clientName: 'Acme Corporation',
          serviceDescription: 'Tax preparation services for FY 2025',
          fee: '$5,000',
          startDate: '2026-01-15',
        },
      });
    
    expect(res.status).toBe(200);
    expect(res.body.instanceId).toBeDefined();
    expect(res.body.previewHtml).toContain('Acme Corporation');
  });

  it('DEL-014: should export as PDF', async () => {
    const instance = await createTestDeliverableInstance();
    
    const res = await request(app)
      .get(`/api/deliverables/instances/${instance.id}/export?format=pdf`)
      .set('Cookie', plusCookie);
    
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });
});
```

---

## 7. Export Features

### 7.1 Content Export

| Test ID | Format | Test Steps | Expected Result | Required Tier |
|---------|--------|------------|-----------------|---------------|
| EXP-001 | TXT | Export conversation as text | Plain text file | Free+ |
| EXP-002 | CSV | Export data as CSV | Comma-separated values | Free+ |
| EXP-003 | PDF | Export as PDF | Formatted document | Plus+ |
| EXP-004 | DOCX | Export as Word | Editable document | Plus+ |
| EXP-005 | XLSX | Export as Excel | Spreadsheet | Plus+ |
| EXP-006 | PPTX | Export as PowerPoint | Presentation | Plus+ |

**Test Code:**
```typescript
describe('Export Features', () => {
  it('EXP-001: Free user can export TXT', async () => {
    const res = await request(app)
      .post('/api/export')
      .set('Cookie', freeCookie)
      .send({ conversationId: testConvId, format: 'txt' });
    
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
  });

  it('EXP-003: Free user blocked from PDF export', async () => {
    const res = await request(app)
      .post('/api/export')
      .set('Cookie', freeCookie)
      .send({ conversationId: testConvId, format: 'pdf' });
    
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('upgrade');
  });

  it('EXP-003: Plus user can export PDF', async () => {
    const res = await request(app)
      .post('/api/export')
      .set('Cookie', plusCookie)
      .send({ conversationId: testConvId, format: 'pdf' });
    
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });
});
```

---

## 8. Profile & Member Management

### 8.1 Profile CRUD

| Test ID | Feature | Test Steps | Expected Result |
|---------|---------|------------|-----------------|
| PROF-001 | Create personal profile | POST `/api/profiles` type: personal | Profile created |
| PROF-002 | Create business profile | POST `/api/profiles` type: business | Profile created (Plus+) |
| PROF-003 | Create family profile | POST `/api/profiles` type: family | Profile with members (Plus+) |
| PROF-004 | List profiles | GET `/api/profiles` | All user's profiles |
| PROF-005 | Update profile | PATCH `/api/profiles/:id` | Profile updated |
| PROF-006 | Delete profile | DELETE `/api/profiles/:id` | Profile removed |
| PROF-007 | Profile limit (Free) | Create 2nd profile | 403 - upgrade required |
| PROF-008 | Profile limit (Plus) | Create 6th profile | 403 - limit reached |

### 8.2 Family/Business Members

| Test ID | Feature | Test Steps | Expected Result |
|---------|---------|------------|-----------------|
| MEM-001 | Add member | POST `/api/profiles/:id/members` | Member added |
| MEM-002 | Update member role | PATCH `/api/profiles/:id/members/:mid` | Role changed |
| MEM-003 | Remove member | DELETE `/api/profiles/:id/members/:mid` | Member removed |
| MEM-004 | Owner permissions | Owner changes member roles | Allowed |
| MEM-005 | Admin permissions | Admin invites members | Allowed |
| MEM-006 | Member permissions | Member tries to invite | 403 Forbidden |
| MEM-007 | Viewer permissions | Viewer tries to add data | 403 Forbidden |

---

## 9. Integrations

### 9.1 Accounting Software Connections

| Test ID | Provider | Test Steps | Expected Result | Required Tier |
|---------|----------|------------|-----------------|---------------|
| INT-001 | QuickBooks | Initiate OAuth | Redirect to QBO auth page | Plus+ |
| INT-002 | QuickBooks | Complete callback | Integration stored, tokens encrypted | Plus+ |
| INT-003 | Xero | Full OAuth flow | Xero connected | Plus+ |
| INT-004 | Zoho Books | Full OAuth flow | Zoho connected | Plus+ |
| INT-005 | ADP Workforce | Full OAuth flow | ADP connected | Enterprise |
| INT-006 | Disconnect | DELETE `/api/integrations/:id` | Tokens revoked, removed | Plus+ |
| INT-007 | List integrations | GET `/api/integrations` | User's connections | Plus+ |

**Test Code:**
```typescript
describe('Integrations', () => {
  it('INT-001: should initiate QuickBooks OAuth', async () => {
    const res = await request(app)
      .post('/api/integrations/quickbooks/initiate')
      .set('Cookie', plusCookie);
    
    expect(res.status).toBe(200);
    expect(res.body.authUrl).toContain('intuit.com');
    expect(res.body.state).toBeDefined();
  });

  it('INT-002: should handle OAuth callback', async () => {
    const res = await request(app)
      .get('/api/integrations/callback')
      .query({
        code: 'mock-auth-code',
        state: 'valid-state-token',
        realmId: '1234567890',
      })
      .set('Cookie', plusCookie);
    
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/settings/integrations');
  });
});
```

---

## 10. Subscription & Billing

### 10.1 Subscription Management

| Test ID | Feature | Endpoint | Expected Result |
|---------|---------|----------|-----------------|
| SUB-001 | Get current subscription | GET `/api/subscription` | Plan details + usage |
| SUB-002 | Get pricing (US) | GET `/api/pricing?region=us` | USD prices |
| SUB-003 | Get pricing (India) | GET `/api/pricing?region=in` | INR prices |
| SUB-004 | Create order | POST `/api/subscription/create-order` | Payment order created |
| SUB-005 | Verify payment | POST `/api/subscription/verify` | Subscription activated |
| SUB-006 | Cancel subscription | POST `/api/subscription/cancel` | Cancellation scheduled |
| SUB-007 | Payment history | GET `/api/subscription/payments` | Past transactions |

### 10.2 Coupon System

| Test ID | Feature | Test Steps | Expected Result |
|---------|---------|------------|-----------------|
| COUP-001 | Valid coupon | Apply "NEWYEAR50" | 50% discount calculated |
| COUP-002 | Expired coupon | Apply expired code | 400 - Coupon expired |
| COUP-003 | Wrong tier coupon | Apply Plus coupon to Free upgrade | 400 - Not applicable |
| COUP-004 | Usage limit reached | Use exhausted coupon | 400 - Limit reached |
| COUP-005 | Currency mismatch | Apply USD coupon in INR | 400 - Wrong currency |

### 10.3 Usage Tracking

| Test ID | Feature | Test Steps | Expected Result |
|---------|---------|------------|-----------------|
| USAGE-001 | Query count | GET `/api/subscription/usage` | Queries used this month |
| USAGE-002 | Document count | Upload documents | Count incremented |
| USAGE-003 | Quota exceeded | Free user: 501st query | 429 - Quota exceeded |
| USAGE-004 | Quota reset | First of month | Counters reset to 0 |

---

## 11. Security Features

### 11.1 MFA (Two-Factor Authentication)

| Test ID | Feature | Endpoint | Expected Result |
|---------|---------|----------|-----------------|
| MFA-001 | Setup MFA | POST `/api/mfa/setup` | QR code + secret returned |
| MFA-002 | Enable MFA | POST `/api/mfa/enable` with TOTP | MFA activated, backup codes generated |
| MFA-003 | Login with MFA | Login + TOTP verification | Full session granted |
| MFA-004 | Invalid TOTP | Wrong 6-digit code | 401 - Invalid code |
| MFA-005 | Backup code | Use backup code | Login succeeds, code consumed |
| MFA-006 | Disable MFA | POST `/api/mfa/disable` with password | MFA removed |

**Test Account:** `mfa.enabled@lucatest.com`

### 11.2 Rate Limiting

| Test ID | Endpoint Category | Limit | Window | Test Steps |
|---------|-------------------|-------|--------|------------|
| RATE-001 | Authentication | 10 requests | 15 minutes | 11 login attempts → 429 |
| RATE-002 | Chat | 20 requests | 1 minute | 21 messages → 429 |
| RATE-003 | File upload | 20 requests | 15 minutes | 21 uploads → 429 |
| RATE-004 | OAuth | 5 requests | 15 minutes | 6 initiations → 429 |

### 11.3 Account Security

| Test ID | Feature | Test Steps | Expected Result |
|---------|---------|------------|-----------------|
| SEC-001 | Account lockout | 5 failed logins | Account locked 30 minutes |
| SEC-002 | Lockout recovery | Wait 30 minutes | Account unlocked |
| SEC-003 | Password hashing | Register user | Password stored as bcrypt hash |
| SEC-004 | Session security | Logout | Session destroyed, cookie cleared |
| SEC-005 | CSRF protection | POST without token | 403 - CSRF token required |

**Test Account:** `locked.account@lucatest.com`

---

## 12. Admin Features

### 12.1 Dashboard & Users

| Test ID | Feature | Endpoint | Expected Result | Required Role |
|---------|---------|----------|-----------------|---------------|
| ADM-001 | Dashboard KPIs | GET `/api/admin/dashboard` | Total users, revenue, etc. | Admin |
| ADM-002 | List users | GET `/api/admin/users` | All users (no passwords) | Admin |
| ADM-003 | Search users | GET `/api/admin/users?search=test` | Filtered users | Admin |
| ADM-004 | Update user tier | PATCH `/api/admin/users/:id` | Tier changed | Admin |
| ADM-005 | Toggle admin | PATCH `/api/admin/users/:id/admin` | Admin status toggled | Admin |
| ADM-006 | Cannot toggle self | Toggle own admin status | 403 - Cannot modify self | Admin |

### 12.2 Training Data Management

| Test ID | Feature | Endpoint | Expected Result |
|---------|---------|----------|-----------------|
| TRAIN-001 | List pending | GET `/api/admin/training-data?status=pending` | Unapproved examples |
| TRAIN-002 | Approve example | PATCH `/api/admin/training-data/:id/approve` | Status: approved |
| TRAIN-003 | Reject example | PATCH with `approved: false` | Status: rejected |
| TRAIN-004 | Bulk approve | POST `/api/admin/training-data/bulk-approve` | Multiple approved |
| TRAIN-005 | Expert review | Complete expert review | Quality score updated |

### 12.3 Coupon Management (Admin)

| Test ID | Feature | Endpoint | Expected Result |
|---------|---------|----------|-----------------|
| COUP-ADM-001 | Create coupon | POST `/api/admin/coupons` | Coupon created |
| COUP-ADM-002 | List coupons | GET `/api/admin/coupons` | All coupons |
| COUP-ADM-003 | Update coupon | PATCH `/api/admin/coupons/:id` | Coupon modified |
| COUP-ADM-004 | Delete coupon | DELETE `/api/admin/coupons/:id` | Coupon deactivated |
| COUP-ADM-005 | Usage history | GET `/api/admin/coupons/:id/usage` | Redemption log |

### 12.4 Finetuning Management

| Test ID | Feature | Endpoint | Expected Result |
|---------|---------|----------|-----------------|
| FINE-001 | Get status | GET `/api/admin/finetuning/status` | Current job status |
| FINE-002 | List jobs | GET `/api/admin/finetuning/jobs` | Job history |
| FINE-003 | Trigger job | POST `/api/admin/finetuning/trigger` | Job queued |
| FINE-004 | Cancel job | POST `/api/admin/finetuning/jobs/:id/cancel` | Job cancelled |

---

## 13. System Health & Monitoring

### 13.1 Health Checks

| Test ID | Feature | Endpoint | Expected Result | Access |
|---------|---------|----------|-----------------|--------|
| HEALTH-001 | Basic health | GET `/api/health` | 200 OK | Public |
| HEALTH-002 | Azure health | GET `/api/health/azure` | Azure services status | Public |
| HEALTH-003 | AI provider health | GET `/api/admin/ai-providers/health` | Provider latencies | Admin |
| HEALTH-004 | Reset provider | POST `/api/admin/ai-providers/:id/reset-health` | Circuit breaker reset | Admin |

### 13.2 System Monitoring (Super Admin Only)

| Test ID | Feature | Endpoint | Expected Result |
|---------|---------|----------|-----------------|
| SYS-001 | System metrics | GET `/api/admin/system/health` | CPU, memory, disk |
| SYS-002 | Threat log | GET `/api/admin/system/threats` | Security threats |
| SYS-003 | Route health | GET `/api/admin/system/routes` | Endpoint response times |
| SYS-004 | Integration health | GET `/api/admin/system/integrations` | Third-party status |
| SYS-005 | Active alerts | GET `/api/admin/system/alerts` | System alerts |
| SYS-006 | Resolve alert | POST `/api/admin/system/alerts/:id/resolve` | Alert dismissed |

### 13.3 Maintenance & Deployments (Super Admin Only)

| Test ID | Feature | Endpoint | Expected Result |
|---------|---------|----------|-----------------|
| MAINT-001 | List maintenance | GET `/api/admin/system/maintenance` | Scheduled windows |
| MAINT-002 | Schedule maintenance | POST `/api/admin/system/maintenance` | Maintenance scheduled |
| MAINT-003 | Cancel maintenance | POST `/api/admin/system/maintenance/:id/cancel` | Maintenance cancelled |
| DEPLOY-001 | Deployment history | GET `/api/admin/system/deployments` | Past deployments |
| DEPLOY-002 | Start deployment | POST `/api/admin/system/deployments` | Deployment initiated |
| DEPLOY-003 | Rollback | POST `/api/admin/system/deployments/:id/rollback` | Rolled back |

---

## Appendix A: Feature × Tier Matrix

| Feature | Free | Plus | Pro | Enterprise |
|---------|:----:|:----:|:---:|:----------:|
| Basic Chat | ✅ | ✅ | ✅ | ✅ |
| Chat History | ✅ | ✅ | ✅ | ✅ |
| Deep Research Mode | ❌ | ✅ | ✅ | ✅ |
| Calculation Mode | ❌ | ✅ | ✅ | ✅ |
| Scenario Simulator | ❌ | ✅ | ✅ | ✅ |
| Deliverable Composer | ❌ | ✅ | ✅ | ✅ |
| Forensic Intelligence | ❌ | ❌ | ✅ | ✅ |
| Document Upload | 10/mo | ∞ | ∞ | ∞ |
| Profiles | 1 | 5 | ∞ | ∞ |
| Export TXT/CSV | ✅ | ✅ | ✅ | ✅ |
| Export PDF/DOCX/XLSX | ❌ | ✅ | ✅ | ✅ |
| Excel Models | ❌ | ✅ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ | ✅ |
| White-label Reports | ❌ | ❌ | ✅ | ✅ |
| Integrations | ❌ | ✅ | ✅ | ✅ |
| SSO/SAML | ❌ | ❌ | ❌ | ✅ |
| Multi-user (6+) | ❌ | ❌ | ❌ | ✅ |
| Custom AI Training | ❌ | ❌ | ❌ | ✅ |

---

## Appendix B: Test IDs Reference

| Prefix | Category | Count |
|--------|----------|-------|
| CHAT-* | Basic Chat | 10 |
| MODE-* | Chat Modes | 9 |
| FEED-* | Feedback | 4 |
| DOC-* | Document Processing | 8 |
| TAXF-* | Tax Files | 6 |
| EXCEL-* | Excel Formulas | 4 |
| MODEL-* | Financial Models | 6 |
| CALC-* | Calculations | 8 |
| SCEN-* | Scenario Simulator | 14 |
| FOR-* | Forensic Intelligence | 15 |
| DEL-* | Deliverables | 15 |
| EXP-* | Export | 6 |
| PROF-* | Profiles | 8 |
| MEM-* | Members | 7 |
| INT-* | Integrations | 7 |
| SUB-* | Subscriptions | 7 |
| COUP-* | Coupons | 5 |
| USAGE-* | Usage | 4 |
| MFA-* | MFA | 6 |
| RATE-* | Rate Limiting | 4 |
| SEC-* | Security | 5 |
| ADM-* | Admin | 6 |
| TRAIN-* | Training Data | 5 |
| FINE-* | Finetuning | 4 |
| HEALTH-* | Health | 4 |
| SYS-* | System | 6 |
| MAINT-* | Maintenance | 3 |
| DEPLOY-* | Deployments | 3 |

**Total Feature Test Cases: 180+**

---

*This guide covers all ICAI CAGPT features. Update when new features are added.*
