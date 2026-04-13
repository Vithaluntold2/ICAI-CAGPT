# ICAI CAGPT - Integrations Guide
## Complete Integration Architecture & Implementation

**Document Version**: 1.0  
**Last Updated**: December 23, 2025  
**Consolidated from**: INTEGRATIONS.md, RAG_IMPLEMENTATION.md

---

## Table of Contents
1. [Integration Overview](#1-integration-overview)
2. [Accounting Software Integrations](#2-accounting-software-integrations)
3. [Banking & Financial Data](#3-banking--financial-data)
4. [Payment Processing](#4-payment-processing)
5. [Document Management](#5-document-management)
6. [Payroll Services](#6-payroll-services)
7. [E-commerce Platforms](#7-e-commerce-platforms)
8. [Communication & Notifications](#8-communication--notifications)
9. [Technical Architecture](#9-technical-architecture)
10. [RAG Implementation](#10-rag-implementation)
11. [Security & Compliance](#11-security--compliance)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Cost Analysis](#13-cost-analysis)
14. [API Reference](#14-api-reference)

---

## 1. Integration Overview

ICAI CAGPT's integration ecosystem enables seamless data exchange with:
- Accounting software (QuickBooks, Xero, Zoho)
- Banking (Plaid)
- Payment processors (Stripe, Cashfree)
- Document storage (Google Drive, Dropbox)
- Payroll (ADP, Gusto)
- E-commerce (Shopify)
- Communication (Slack, Twilio)

### Integration Priority Matrix

| Tier | Integrations | Timeline |
|------|-------------|----------|
| **Tier 1** | Plaid, QuickBooks, Stripe | Launch |
| **Tier 2** | Xero, Google Drive, Shopify | +3 months |
| **Tier 3** | ADP/Gusto, Slack | +6 months |
| **Tier 4** | NetSuite, Salesforce, Custom APIs | Future |

---

## 2. Accounting Software Integrations

### 2.1 QuickBooks Online ✅ FULLY IMPLEMENTED

**Status**: Production-ready (800+ lines)  
**File**: `server/services/accountingIntegrations.ts`

| Property | Value |
|----------|-------|
| Authentication | OAuth 2.0 ✅ Complete |
| API | QuickBooks Online API v3 |
| Data Flow | Bidirectional (read access) |
| Rate Limits | 500 requests/minute |
| Webhooks | ✅ Available |
| Token Encryption | AES-256-GCM ✅ |
| Multi-Company | ✅ Supported |

**Implemented Features**:
- ✅ OAuth flow (authorization, token exchange, refresh)
- ✅ Trial Balance report with debit/credit totals
- ✅ Profit & Loss (Income Statement)
- ✅ Balance Sheet (Assets, Liabilities, Equity)
- ✅ Customer list with balances
- ✅ Vendor list with balances
- ✅ Invoice tracking (Paid/Open/Overdue status)
- ✅ Chart of Accounts
- ✅ Company information retrieval

**API Endpoints**:
- `POST /api/integrations/initiate` - Start OAuth flow
- `GET /api/integrations/callback` - OAuth callback handler

**AI Integration**:
- Automatic data fetching for financial analysis
- Real-time cash flow forecasting
- Customer payment behavior analysis
- Expense category optimization
- Month-end close automation

### 2.2 Xero

**Purpose**: International accounting platform

| Property | Value |
|----------|-------|
| Authentication | OAuth 2.0 |
| API | Xero Accounting API |
| Data Flow | Bidirectional |
| Rate Limits | 60 requests/minute |

**Features**:
- Bank reconciliation
- Invoice & bill management
- Financial reporting
- Multi-currency support

### 2.3 Zoho Books

**Purpose**: Small business accounting

| Property | Value |
|----------|-------|
| Authentication | OAuth 2.0 |
| API | Zoho Books API v3 |
| Data Flow | Bidirectional |

---

## 3. Banking & Financial Data

### 3.1 Plaid Integration

**Purpose**: Bank account connections and transaction feeds

| Property | Value |
|----------|-------|
| Authentication | Link Token + Access Token |
| Coverage | 12,000+ financial institutions |
| Data Refresh | Daily automatic sync |
| Security | SOC 2 Type II certified |

**Products**:
- **Transactions**: Historical and real-time transaction data
- **Auth**: Account and routing numbers for ACH
- **Balance**: Real-time account balances
- **Identity**: Account holder information
- **Assets**: Asset reports for verification

**Implementation Flow**:
```typescript
1. User clicks "Connect Bank Account"
2. Generate Link Token via /api/plaid/create_link_token
3. Launch Plaid Link UI (client-side)
4. User authenticates with bank
5. Exchange public_token for access_token
6. Store encrypted access_token in database
7. Fetch transactions via /api/plaid/transactions/get
8. Categorize and store in local database
9. Set up webhook for real-time updates
```

---

## 4. Payment Processing

### 4.1 Stripe

**Purpose**: Payment processing, revenue tracking, reconciliation

| Property | Value |
|----------|-------|
| Authentication | API Keys |
| Data Flow | Bidirectional |
| Status | Already implemented (subscriptions) |

**Features**:
- Payment intents and charges
- Customer management
- Subscription billing
- Payout tracking
- Automatic reconciliation with bank deposits

**Webhook Events**:
- `payment_intent.succeeded`
- `charge.refunded`
- `payout.paid`
- `invoice.payment_failed`

**Accounting Integration**:
- Auto-categorize Stripe fees as expenses
- Match deposits to bank transactions (via Plaid)
- Generate revenue reports by product/service

### 4.2 Cashfree

**Purpose**: Primary payment processing for India

| Property | Value |
|----------|-------|
| Authentication | App ID + Secret Key |
| Environment | Sandbox/Production |
| Status | Implemented |

---

## 5. Document Management

### 5.1 Google Drive

**Purpose**: Secure storage for financial documents

| Property | Value |
|----------|-------|
| Authentication | OAuth 2.0 |
| API | Google Drive API v3 |

**Features**:
- Auto-upload receipts and invoices
- Organize by tax year and category
- Share audit packages with CPAs
- OCR integration with Google Cloud Vision

**Folder Structure**:
```
Luca Documents/
├── Tax Year 2025/
│   ├── Receipts/
│   ├── Invoices/
│   ├── Bank Statements/
│   └── Tax Returns/
├── Tax Year 2024/
└── Audit Trail/
```

### 5.2 Dropbox Business

**Purpose**: Alternative cloud storage

| Property | Value |
|----------|-------|
| Authentication | OAuth 2.0 |
| API | Dropbox API v2 |

---

## 6. Payroll Services

### 6.1 ADP Workforce Now

**Purpose**: Payroll data import

| Property | Value |
|----------|-------|
| Authentication | OAuth 2.0 + API Credentials |
| Data Flow | Read-only |

**Key Data**:
- Employee wages and salaries
- Tax withholdings
- Benefits deductions
- Employer tax obligations

### 6.2 Gusto

**Purpose**: Small business payroll

| Property | Value |
|----------|-------|
| API | Gusto API v1 |

**Features**:
- Payroll run history
- Contractor payments
- Benefits administration
- Tax filing status

---

## 7. E-commerce Platforms

### 7.1 Shopify

**Purpose**: E-commerce revenue and inventory tracking

| Property | Value |
|----------|-------|
| Authentication | OAuth 2.0 |
| API | Shopify Admin API (GraphQL + REST) |

**Key Data**:
- Orders and refunds
- Product costs and pricing
- Shipping expenses
- Payment gateway fees
- Inventory valuation

**Accounting Features**:
- Revenue recognition (order date vs. fulfillment date)
- COGS calculation (FIFO/LIFO/Weighted Average)
- Sales tax collection by jurisdiction
- Multi-currency revenue conversion

---

## 8. Communication & Notifications

### 8.1 Slack

**Purpose**: Team collaboration and AI assistant bot

| Property | Value |
|----------|-------|
| Authentication | OAuth 2.0 |
| API | Slack Web API |

**Bot Features**:
- `/luca query` - Ask accounting questions
- Daily digest of financial metrics
- Alert for unusual transactions
- Tax deadline reminders
- Expense approval workflows

### 8.2 Twilio

**Purpose**: SMS alerts for critical events

| Property | Value |
|----------|-------|
| Authentication | API Key + Secret |

**Use Cases**:
- Large transaction alerts (> $10,000)
- Tax deadline reminders (7, 3, 1 day before)
- Subscription payment failures
- Security alerts (login from new device)

---

## 9. Technical Architecture

### 9.1 Integration Provider Base Class

```typescript
export abstract class IntegrationProvider {
  abstract name: string;
  abstract authType: 'oauth2' | 'apikey' | 'basic';
  
  abstract connect(userId: string, credentials: any): Promise<Connection>;
  abstract disconnect(connectionId: string): Promise<void>;
  abstract refreshToken(connectionId: string): Promise<string>;
  abstract validateConnection(connectionId: string): Promise<boolean>;
  abstract fetchData(connectionId: string, params: any): Promise<any>;
  abstract syncData(connectionId: string): Promise<SyncResult>;
  abstract handleWebhook(payload: any): Promise<void>;
}
```

### 9.2 QuickBooks Implementation

```typescript
export class QuickBooksProvider extends IntegrationProvider {
  name = 'quickbooks';
  authType = 'oauth2' as const;
  
  async connect(userId: string, authCode: string) {
    const tokens = await this.exchangeCodeForTokens(authCode);
    return db.insert(integrationConnections).values({
      userId,
      provider: 'quickbooks',
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      metadata: { realmId: tokens.realmId }
    });
  }
  
  async syncData(connectionId: string) {
    const connection = await this.getConnection(connectionId);
    const accessToken = decrypt(connection.accessToken);
    const transactions = await this.fetchTransactions(accessToken);
    
    for (const txn of transactions) {
      await this.storeTransaction(txn, connectionId);
    }
    
    return { synced: transactions.length, errors: [] };
  }
}
```

### 9.3 Database Schema

```typescript
export const integrationConnections = pgTable('integration_connections', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull().references(() => users.id),
  provider: varchar('provider').notNull(),
  status: varchar('status').notNull().default('active'),
  accessToken: text('access_token'), // encrypted
  refreshToken: text('refresh_token'), // encrypted
  expiresAt: timestamp('expires_at'),
  lastSyncAt: timestamp('last_sync_at'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const syncLogs = pgTable('sync_logs', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar('connection_id').references(() => integrationConnections.id),
  status: varchar('status').notNull(),
  recordsSynced: integer('records_synced').default(0),
  errors: jsonb('errors'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const externalTransactions = pgTable('external_transactions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar('connection_id').references(() => integrationConnections.id),
  externalId: varchar('external_id').notNull(),
  type: varchar('type').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency').default('USD'),
  date: date('date').notNull(),
  description: text('description'),
  category: varchar('category'),
  metadata: jsonb('metadata'),
  matched: boolean('matched').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## 10. RAG Implementation

### 10.1 Architecture

```
User Query → Embedding → Vector Search → Re-ranking → LLM + Context
                              ↓
                    ┌─────────────────────┐
                    │  Knowledge Bases:   │
                    │  - Tax Code (IRC)   │
                    │  - IRS Publications │
                    │  - GAAP Standards   │
                    │  - Court Cases      │
                    │  - State Tax Laws   │
                    └─────────────────────┘
```

### 10.2 Technology Stack

| Component | Technology |
|-----------|-----------|
| Vector DB | Pinecone (production) / ChromaDB (dev) |
| Embeddings | OpenAI text-embedding-3-large |
| Chunking | LangChain with metadata preservation |
| Re-ranking | Cohere Rerank API |

### 10.3 Knowledge Sources

| Source | Documents | Priority |
|--------|-----------|----------|
| IRS Publications | 100+ PDFs | 🔴 Critical |
| US Tax Code (IRC) | 9,800 sections | 🔴 Critical |
| FASB ASC | 1,000+ topics | 🔴 Critical |
| Tax Court Cases | 10,000+ | 🟡 High |
| State Tax Codes | 50 states | 🟡 High |
| IFRS Standards | 41 standards | 🟢 Medium |

### 10.4 Retrieval Configuration

```typescript
interface RAGConfig {
  // Vector Search
  topK: number;           // 10 for initial retrieval
  minScore: number;       // 0.7 threshold
  
  // Re-ranking
  rerankTopK: number;     // 5 final documents
  
  // Context Assembly
  maxTokens: number;      // 8000 context window
  overlapTokens: number;  // 200 for chunk overlap
}
```

### 10.5 Implementation Timeline

| Week | Deliverable |
|------|-------------|
| 1 | Pinecone setup, schema design |
| 2 | IRS publication scraper + ingestion |
| 3 | Tax code ingestion (Cornell LII) |
| 4 | FASB standards (public summaries) |
| 5 | Retrieval API + integration |
| 6 | Re-ranking + quality testing |

---

## 11. Security & Compliance

### 11.1 OAuth 2.0 Best Practices

1. **Token Storage**: AES-256-GCM encryption
2. **Refresh Strategy**: Auto-refresh 5 minutes before expiration
3. **Scope Minimization**: Request only necessary permissions
4. **PKCE**: Use for public clients
5. **State Parameter**: CSRF protection

### 11.2 API Key Management

1. Store in environment variables
2. Rotate keys quarterly
3. Separate keys for dev/staging/production
4. Monitor for unauthorized usage

### 11.3 Data Privacy

1. **PII Encryption**: All sensitive data encrypted at rest
2. **Data Retention**: 7 years default for financial data
3. **Right to Deletion**: Support data export and deletion
4. **SOC 2 Compliance**: Type II controls

### 11.4 Rate Limiting Implementation

```typescript
async function apiCall(url: string, options: any, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await sleep(delay);
        continue;
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
}
```

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Build base `IntegrationProvider` abstract class
- [ ] Create database schema
- [ ] Implement encryption service
- [ ] Build OAuth 2.0 callback handler
- [ ] Create integration management UI

### Phase 2: Banking (Weeks 3-4)
- [ ] Plaid integration
  - [ ] Link Token generation
  - [ ] Account connection flow
  - [ ] Transaction sync
  - [ ] Webhook handling
  - [ ] AI auto-categorization
- [ ] Bank reconciliation UI

### Phase 3: Accounting (Weeks 5-7)
- [ ] QuickBooks Online
  - [ ] OAuth flow
  - [ ] Chart of accounts mapping
  - [ ] Invoice/Expense sync
  - [ ] Journal entry creation
- [ ] Xero integration
- [ ] Sync conflict resolution

### Phase 4: Payments & E-commerce (Weeks 8-9)
- [ ] Enhanced Stripe integration
- [ ] Shopify integration

### Phase 5: Document & Communication (Weeks 10-11)
- [ ] Google Drive integration
- [ ] Slack bot

### Phase 6: Monitoring (Week 12)
- [ ] Integration health dashboard
- [ ] Error tracking and retry logic
- [ ] Usage analytics

---

## 13. Cost Analysis

### Per-User Monthly Costs

| Integration | Cost Model | Est. Cost/User |
|-------------|-----------|----------------|
| Plaid | $0.25/item/month + $0.10/update | $1.50 |
| QuickBooks API | Free (OAuth app) | $0 |
| Xero API | Free (partner app) | $0 |
| Stripe | Included in payment fees | $0 |
| Google Drive API | Free tier | $0 |
| Slack API | Free tier | $0 |
| Twilio SMS | $0.0075/msg × 10/mo | $0.08 |
| **Total** | | **~$1.58/user/month** |

**Revenue Impact**: Add $2-5/month integration fee to Pro+ plans.

---

## 14. API Reference

### Integration Management

```
POST   /api/integrations/:provider/connect
DELETE /api/integrations/:connectionId/disconnect
POST   /api/integrations/:connectionId/sync
GET    /api/integrations/:connectionId/status
GET    /api/integrations/available
```

### OAuth Callbacks

```
GET    /api/integrations/:provider/callback
```

### Webhooks

```
POST   /api/webhooks/plaid
POST   /api/webhooks/quickbooks
POST   /api/webhooks/stripe
```

### Data Access

```
GET    /api/integrations/:connectionId/transactions
GET    /api/integrations/:connectionId/accounts
GET    /api/integrations/:connectionId/invoices
```

---

## Integration Settings UI

```
Settings > Integrations

┌─────────────────────────────────────────┐
│ Connected Integrations                  │
├─────────────────────────────────────────┤
│ ✓ QuickBooks Online                     │
│   Last sync: 2 minutes ago              │
│   Status: Active                        │
│   [Disconnect] [Sync Now]               │
├─────────────────────────────────────────┤
│ ✓ Plaid - Chase Bank (...1234)         │
│   Last sync: 1 hour ago                 │
│   Status: Active                        │
│   [Disconnect] [Refresh]                │
├─────────────────────────────────────────┤
│ Available Integrations                  │
├─────────────────────────────────────────┤
│ [+] Xero                                │
│ [+] Google Drive                        │
│ [+] Slack                               │
└─────────────────────────────────────────┘
```

---

## Success Metrics

### Adoption
- % of users with ≥1 integration
- Average integrations per user
- Integration abandonment rate

### Technical
- Sync success rate (target: >99%)
- Average sync duration (target: <30s)
- Token refresh success rate (target: 100%)

### Business
- Revenue from integration tier upgrades
- Cost per integration per user
- NPS for integration users

---

*This document consolidates: INTEGRATIONS.md, RAG_IMPLEMENTATION.md*
