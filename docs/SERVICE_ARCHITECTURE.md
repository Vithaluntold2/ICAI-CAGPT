# ICAI CAGPT Service Architecture & Connections

> **Document Version:** 1.0  
> **Last Updated:** December 28, 2025  
> **Category:** Architecture Reference

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Service Layer Overview](#service-layer-overview)
3. [AI Orchestration Layer](#ai-orchestration-layer)
4. [Database Layer](#database-layer)
5. [Security Layer](#security-layer)
6. [Frontend-Backend Communication](#frontend-backend-communication)
7. [External Integrations](#external-integrations)
8. [Data Flow Diagrams](#data-flow-diagrams)
9. [Service Dependencies Matrix](#service-dependencies-matrix)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER                                  │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     React + Vite Frontend                          │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐  │ │
│  │  │ Pages    │ │Components│ │  Hooks   │ │  React Query Cache   │  │ │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────────┬───────────┘  │ │
│  └───────┼────────────┼────────────┼──────────────────┼──────────────┘ │
└──────────┼────────────┼────────────┼──────────────────┼─────────────────┘
           │            │            │                  │
           ▼            ▼            ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            API LAYER                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    Express.js Server                               │ │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐  │ │
│  │  │  Routes (REST)  │ │  SSE Streaming  │ │  WebSocket (Legacy) │  │ │
│  │  └────────┬────────┘ └────────┬────────┘ └──────────┬──────────┘  │ │
│  └───────────┼───────────────────┼─────────────────────┼─────────────┘ │
└──────────────┼───────────────────┼─────────────────────┼────────────────┘
               │                   │                     │
               ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          SERVICE LAYER                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ AI           │ │ Financial    │ │ Document     │ │ Security     │   │
│  │ Orchestrator │ │ Solvers      │ │ Services     │ │ Services     │   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘   │
│         │                │                │                │            │
│         ▼                ▼                ▼                ▼            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      AI Provider Registry                         │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────────┐  │  │
│  │  │ OpenAI │ │ Claude │ │ Gemini │ │ Azure  │ │   Perplexity   │  │  │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
               │                   │                     │
               ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                      │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐ │
│  │  PostgreSQL DB   │ │  Redis Cache     │ │  File Storage (Encrypted)│ │
│  │  (Drizzle ORM)   │ │  (Sessions/Cache)│ │  (AWS S3 / Local)        │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Service Layer Overview

### Directory Structure

```
server/services/
├── aiOrchestrator.ts          # Main AI coordination
├── aiProviders/               # AI provider implementations
│   ├── index.ts               # Provider exports
│   ├── registry.ts            # Provider registry
│   ├── healthMonitor.ts       # Health monitoring
│   ├── openai.provider.ts     # OpenAI implementation
│   ├── claude.provider.ts     # Anthropic Claude
│   ├── gemini.provider.ts     # Google Gemini
│   ├── azureOpenAI.provider.ts# Azure OpenAI
│   ├── perplexity.provider.ts # Perplexity AI
│   ├── costOptimizer.ts       # Cost optimization
│   ├── modelSelector.ts       # Model selection logic
│   └── providerRouter.ts      # Request routing
├── agents/                    # Specialized AI agents
├── cache/                     # Caching services
├── core/                      # Core services
├── excel/                     # Excel generation
├── langchain/                 # LangChain integrations
├── accountingIntegrations.ts  # QuickBooks, Xero, etc.
├── analyticsProcessor.ts      # Usage analytics
├── calculationFormatter.ts    # Financial formatting
├── cashfreeService.ts         # Payment processing
├── chatModeNormalizer.ts      # Chat mode handling
├── circuitBreaker.ts          # Fault tolerance
├── complianceSentinel.ts      # Compliance checks
├── deliverableGenerator.ts    # Document generation
├── documentExporter.ts        # Export to PDF/DOCX
├── embeddingService.ts        # Vector embeddings
├── excelOrchestrator.ts       # Excel operations
├── financialSolvers.ts        # Financial calculations
├── forensicAnalyzer.ts        # Forensic analysis
├── jobQueue.ts                # Background jobs
├── keyVaultService.ts         # Key management
├── logger.ts                  # Logging service
├── mfaService.ts              # Multi-factor auth
├── queryTriage.ts             # Query classification
├── reasoningGovernor.ts       # Advanced reasoning
├── subscriptionService.ts     # Subscription management
├── systemMonitor.ts           # System monitoring
├── validationAgent.ts         # Response validation
├── virusScanService.ts        # File scanning
├── visualizationGenerator.ts  # Chart generation
└── workflowGenerator.ts       # Workflow automation
```

---

## AI Orchestration Layer

### Query Processing Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                        User Query                                     │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   1. Query Triage (queryTriage.ts)                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ • Classify domain (tax, accounting, audit, etc.)               │  │
│  │ • Detect jurisdiction (US, India, Canada, etc.)                │  │
│  │ • Assess complexity (simple, moderate, complex)                │  │
│  │ • Identify required solvers (NPV, depreciation, etc.)          │  │
│  │ • Determine confidence score                                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   2. Model Routing Decision                           │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ • Select optimal AI provider based on:                         │  │
│  │   - Query complexity                                           │  │
│  │   - User tier (free/plus/professional/enterprise)              │  │
│  │   - Provider health status                                     │  │
│  │   - Cost optimization                                          │  │
│  │   - Document attachment presence                               │  │
│  │ • Define fallback chain                                        │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│               3. Advanced Reasoning (Optional)                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ If chain-of-thought mode enabled:                              │  │
│  │ • reasoningGovernor.ts enhances routing decision               │  │
│  │ • Parallel reasoning streams activated                         │  │
│  │ • Cognitive monitoring enabled                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│               4. Requirement Clarification Check                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ If query lacks context (no attachment):                        │  │
│  │ • requirementClarification.ts analyzes for missing info        │  │
│  │ • May ask clarifying questions before proceeding               │  │
│  │ • Deep Research mode always clarifies on first query           │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│               5. Document Processing (If Attached)                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ • documentAnalyzer.ts processes attachment                     │  │
│  │ • Azure Document Intelligence for OCR                          │  │
│  │ • Excel parsing for spreadsheets                               │  │
│  │ • Text extraction and structuring                              │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│               6. AI Provider Call                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ • Build prompt via promptBuilder.ts                            │  │
│  │ • Call selected provider through registry                      │  │
│  │ • Handle streaming response if applicable                      │  │
│  │ • Execute fallback on provider failure                         │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│               7. Financial Solver Integration                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ If calculations required (based on triage):                    │  │
│  │ • financialSolvers.ts executes calculations                    │  │
│  │ • NPV, IRR, depreciation, tax calculations                     │  │
│  │ • calculationFormatter.ts formats results                      │  │
│  │ • excelOrchestrator.ts generates Excel output                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│               8. Response Validation                                  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ • complianceSentinel.ts validates professional standards       │  │
│  │ • validationAgent.ts checks factual accuracy                   │  │
│  │ • Quality scoring                                              │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│               9. Response Assembly                                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ • Combine AI response with calculation results                 │  │
│  │ • Generate visualizations if applicable                        │  │
│  │ • Prepare deliverable content for output pane                  │  │
│  │ • Include reasoning traces if enabled                          │  │
│  │ • Package metadata (tokens, timing, model used)                │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### AI Provider Registry

```typescript
// server/services/aiProviders/registry.ts
export enum AIProviderName {
  OPENAI = 'openai',
  AZURE_OPENAI = 'azure_openai',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
  PERPLEXITY = 'perplexity'
}

// Provider Selection Logic
User Tier         Default Provider    Fallback Chain
─────────────────────────────────────────────────────
free              gemini             openai → azure
plus              gpt-4o             claude → gemini
professional      gpt-4o             claude → azure
enterprise        gpt-4o + claude    perplexity → azure
```

### Health Monitoring

```
┌─────────────────────────────────────────────────────────────────┐
│                Provider Health Monitor                           │
│                                                                  │
│  Provider      Status    Latency   Success Rate   Last Check    │
│  ─────────────────────────────────────────────────────────────  │
│  OpenAI        ✓ OK      245ms     99.8%          10s ago       │
│  Azure OpenAI  ✓ OK      180ms     99.9%          8s ago        │
│  Claude        ✓ OK      320ms     99.5%          12s ago       │
│  Gemini        ✓ OK      200ms     99.7%          5s ago        │
│  Perplexity    ⚠ Slow    850ms     98.2%          15s ago       │
│                                                                  │
│  Circuit Breaker States:                                        │
│  • OpenAI: CLOSED (healthy)                                     │
│  • Azure: CLOSED (healthy)                                      │
│  • Perplexity: HALF-OPEN (recovering)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Layer

### Database Schema Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                          │
│                                                                  │
│  Core Tables:                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   users     │  │  profiles   │  │  profile_members        │  │
│  │  ─────────  │  │  ─────────  │  │  ─────────────────────  │  │
│  │  id (PK)    │◄─┤  userId(FK) │  │  profileId (FK)         │  │
│  │  email      │  │  name       │  │  name, email            │  │
│  │  password   │  │  type       │  │  relationship           │  │
│  │  tier       │  │  isDefault  │  │  role                   │  │
│  │  mfaEnabled │  └─────────────┘  └─────────────────────────┘  │
│  └─────────────┘                                                 │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │   conversations     │  │         messages                │   │
│  │  ─────────────────  │  │  ─────────────────────────────  │   │
│  │  id (PK)            │◄─┤  conversationId (FK)            │   │
│  │  userId (FK)        │  │  role (user/assistant)          │   │
│  │  profileId (FK)     │  │  content                        │   │
│  │  title, preview     │  │  modelUsed                      │   │
│  │  pinned, isShared   │  │  tokensUsed                     │   │
│  │  qualityScore       │  │  calculationResults             │   │
│  └─────────────────────┘  │  excelBuffer                    │   │
│                           └─────────────────────────────────┘   │
│                                                                  │
│  Analytics Tables:                                               │
│  ┌────────────────────┐  ┌─────────────────────────────────┐   │
│  │ conversation_      │  │    user_behavior_patterns       │   │
│  │ analytics          │  │  ─────────────────────────────  │   │
│  │  ────────────────  │  │  userId (FK)                    │   │
│  │  conversationId    │  │  averageSessionDuration         │   │
│  │  sentimentScore    │  │  topQueryCategories             │   │
│  │  topicsDiscussed   │  │  churnRisk                      │   │
│  │  qualityScore      │  │  potentialUpsellCandidate       │   │
│  └────────────────────┘  └─────────────────────────────────┘   │
│                                                                  │
│  Financial Tables:                                               │
│  ┌────────────────────┐  ┌─────────────────────────────────┐   │
│  │   payments         │  │       subscriptions              │   │
│  │  ────────────────  │  │  ─────────────────────────────  │   │
│  │  userId (FK)       │  │  userId (FK)                    │   │
│  │  amount, currency  │  │  plan, status                   │   │
│  │  status            │  │  currentPeriodStart/End         │   │
│  │  razorpayOrderId   │  │  cancelAtPeriodEnd              │   │
│  └────────────────────┘  └─────────────────────────────────┘   │
│                                                                  │
│  Security Tables:                                                │
│  ┌────────────────────┐  ┌─────────────────────────────────┐   │
│  │   audit_logs       │  │       gdpr_consents              │   │
│  │  ────────────────  │  │  ─────────────────────────────  │   │
│  │  userId (FK)       │  │  userId (FK)                    │   │
│  │  action            │  │  consentType                    │   │
│  │  resourceType      │  │  consented                      │   │
│  │  ipAddress         │  │  ipAddress                      │   │
│  └────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Storage Service Pattern

```typescript
// server/pgStorage.ts - Storage abstraction layer

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  updateUserSubscription(id: string, tier: string): Promise<User | undefined>;
  
  // Conversation operations
  getConversation(id: string): Promise<Conversation | undefined>;
  getUserConversations(userId: string): Promise<Conversation[]>;
  createConversation(data: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, data: Partial<Conversation>): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  
  // Message operations
  getConversationMessages(conversationId: string): Promise<Message[]>;
  createMessage(data: InsertMessage): Promise<Message>;
  
  // And many more...
}

// Implementation uses Drizzle ORM
export const storage = new PostgresStorage(db);
```

---

## Security Layer

### Security Middleware Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    Request Entry Point                           │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. Helmet (HTTP Headers)                      │
│  • Content-Security-Policy                                       │
│  • X-Frame-Options: DENY                                         │
│  • X-Content-Type-Options: nosniff                              │
│  • HSTS (production only)                                        │
│  • XSS Protection                                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. CORS Middleware                            │
│  Development:                                                    │
│  • localhost, 127.0.0.1 allowed                                 │
│  • *.repl.co, *.replit.dev allowed                              │
│                                                                  │
│  Production:                                                     │
│  • cagpt.icai.org, www.cagpt.icai.org                                   │
│  • *.repl.co, *.replit.dev                                      │
│  • luca-agent.onrender.com                                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. Rate Limiting                              │
│                                                                  │
│  authRateLimiter:      10 requests / 15 min window              │
│  chatRateLimiter:      20 requests / 1 min window               │
│  fileUploadRateLimiter: 20 requests / 15 min window             │
│  integrationRateLimiter: 5 requests / 15 min window             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. Session Middleware                         │
│  • Session ID in signed cookie (luca.sid)                       │
│  • HttpOnly, Secure (production), SameSite: lax                 │
│  • 30-day expiration with rolling refresh                       │
│  • Redis store (production) / Memory store (dev)                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    5. Authentication Checks                      │
│                                                                  │
│  requireAuth:      Validates session.userId exists              │
│  requireAdmin:     Checks user.isAdmin === true                 │
│  requireSuperAdmin: Checks for super admin privileges           │
└─────────────────────────────────────────────────────────────────┘
```

### File Security Pipeline

```
┌────────────────────┐
│    File Upload     │
└────────┬───────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│                    1. Multer Validation                         │
│  • MIME type whitelist (PDF, images, Excel, CSV, TXT)          │
│  • Size limit: 50MB max                                         │
│  • Memory storage (no temp files on disk)                       │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│                    2. Virus Scanning                            │
│  • virusScanService.ts                                          │
│  • ClamAV integration (if available)                            │
│  • Cloud scanning API fallback                                  │
│  • Quarantine infected files                                    │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│                    3. Encryption                                │
│  • AES-256-GCM encryption                                       │
│  • Unique key per file                                          │
│  • Key encrypted with master key (Key Vault)                    │
│  • Checksum calculated for integrity                            │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│                    4. Secure Storage                            │
│  • Encrypted file written to disk/S3                            │
│  • Metadata stored in database                                  │
│  • Original content never persisted unencrypted                 │
└────────────────────────────────────────────────────────────────┘
```

### MFA Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        MFA Setup Flow                            │
│                                                                  │
│  1. POST /api/mfa/setup                                         │
│     └─► Generate TOTP secret                                    │
│         └─► Generate QR code (otpauth:// URL)                   │
│             └─► Store secret in session temporarily             │
│                 └─► Return QR code to user                      │
│                                                                  │
│  2. User scans QR with authenticator app                        │
│                                                                  │
│  3. POST /api/mfa/enable                                        │
│     └─► Verify TOTP token matches secret                        │
│         └─► Generate 10 backup codes                            │
│             └─► Encrypt secret with master key                  │
│                 └─► Store encrypted secret in DB                │
│                     └─► Return backup codes (show once)         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       MFA Login Flow                             │
│                                                                  │
│  1. POST /api/auth/login (email + password)                     │
│     └─► Validate credentials                                    │
│         └─► Check if mfaEnabled === true                        │
│             └─► Return { mfaRequired: true, userId }            │
│                                                                  │
│  2. POST /api/mfa/verify                                        │
│     └─► Decrypt stored TOTP secret                              │
│         └─► Verify token (or backup code)                       │
│             └─► Establish session                               │
│                 └─► Return user data                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend-Backend Communication

### API Client Layer

```typescript
// client/src/lib/api.ts

// Authentication API
export const authApi = {
  register: (data) => POST('/api/auth/register', data),
  login: (data) => POST('/api/auth/login', data),
  logout: () => POST('/api/auth/logout'),
  me: () => GET('/api/auth/me'),
};

// Conversation API
export const conversationApi = {
  getAll: () => GET('/api/conversations'),
  getMessages: (id) => GET(`/api/conversations/${id}/messages`),
};

// Chat API (supports streaming)
export const chatApi = {
  streamMessage: (data, callbacks) => {
    // Uses Server-Sent Events (SSE)
    // POST /api/chat/stream
    // Returns: { onStart, onChunk, onEnd, onError }
  },
  sendMessage: (data) => POST('/api/chat', data),
};

// Usage API
export const usageApi = {
  get: () => GET('/api/usage'),
};
```

### SSE Streaming Flow

```
┌─────────────┐                                    ┌─────────────┐
│   Client    │                                    │   Server    │
└──────┬──────┘                                    └──────┬──────┘
       │                                                  │
       │  POST /api/chat/stream                          │
       │  { query: "...", conversationId: "..." }        │
       │ ─────────────────────────────────────────────► │
       │                                                  │
       │  SSE: data: {"type":"start","conversationId":"x"}
       │ ◄───────────────────────────────────────────── │
       │                                                  │
       │  SSE: data: {"type":"chunk","content":"Hello "}  │
       │ ◄───────────────────────────────────────────── │
       │                                                  │
       │  SSE: data: {"type":"chunk","content":"world "} │
       │ ◄───────────────────────────────────────────── │
       │                                                  │
       │  SSE: data: {"type":"chunk","content":"!"}      │
       │ ◄───────────────────────────────────────────── │
       │                                                  │
       │  SSE: data: {"type":"end","metadata":{...}}     │
       │ ◄───────────────────────────────────────────── │
       │                                                  │
       │  Connection closed                               │
       │ ◄───────────────────────────────────────────── │
```

### React Query Integration

```typescript
// React Query hooks for data fetching and caching

// useQuery for GET requests
const { data: conversations } = useQuery({
  queryKey: ['conversations'],
  queryFn: () => conversationApi.getAll(),
});

// useMutation for POST/PATCH/DELETE
const createConversation = useMutation({
  mutationFn: (data) => POST('/api/conversations', data),
  onSuccess: () => {
    queryClient.invalidateQueries(['conversations']);
  },
});

// Cache invalidation on mutations
// Automatic refetch on window focus
// Stale-while-revalidate pattern
```

---

## External Integrations

### Accounting Software OAuth Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    OAuth 2.0 Integration Flow                    │
│                                                                  │
│  Supported Providers:                                            │
│  • QuickBooks Online                                             │
│  • Xero                                                          │
│  • Zoho Books                                                    │
│  • ADP (Payroll)                                                 │
│                                                                  │
│  1. POST /api/integrations/:provider/initiate                   │
│     └─► Generate state token (CSRF protection)                  │
│         └─► Store state in session                              │
│             └─► Build OAuth authorization URL                   │
│                 └─► Return { authUrl, provider }                │
│                                                                  │
│  2. User redirected to provider login                           │
│     └─► User grants permissions                                 │
│         └─► Provider redirects to callback URL                  │
│                                                                  │
│  3. GET /api/integrations/callback                              │
│     └─► Verify state matches session                            │
│         └─► Exchange code for access/refresh tokens             │
│             └─► Encrypt tokens before storage                   │
│                 └─► Store integration in database               │
│                     └─► Redirect to /integrations?success=true  │
└─────────────────────────────────────────────────────────────────┘
```

### Payment Gateway Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    Razorpay Payment Flow                         │
│                                                                  │
│  1. GET /api/pricing/:currency                                  │
│     └─► Return plans with localized pricing                     │
│                                                                  │
│  2. POST /api/payments/create-order                             │
│     └─► Create Razorpay order via API                           │
│         └─► Store pending payment in database                   │
│             └─► Return { orderId, amount, razorpayKeyId }       │
│                                                                  │
│  3. Client opens Razorpay checkout modal                        │
│     └─► User completes payment                                  │
│                                                                  │
│  4. POST /api/payments/verify                                   │
│     └─► Verify Razorpay signature                               │
│         └─► Update payment status to 'successful'               │
│             └─► Activate subscription                           │
│                 └─► Update user tier                            │
│                                                                  │
│  5. POST /api/webhooks/razorpay (async)                         │
│     └─► Handle payment.captured event                           │
│         └─► Handle payment.failed event                         │
│             └─► Handle refund events                            │
└─────────────────────────────────────────────────────────────────┘
```

### Azure Document Intelligence

```
┌─────────────────────────────────────────────────────────────────┐
│              Document Analysis Pipeline                          │
│                                                                  │
│  Supported Document Types:                                       │
│  • Invoices                                                      │
│  • Receipts                                                      │
│  • W-2 forms                                                     │
│  • 1040, 1098, 1099 forms                                       │
│  • General documents                                             │
│                                                                  │
│  1. File uploaded via /api/chat/upload-file                     │
│     └─► Convert to base64                                       │
│         └─► Detect document type from filename                  │
│                                                                  │
│  2. documentAnalyzer.ts processes attachment                    │
│     └─► Send to Azure Form Recognizer API                       │
│         └─► Use appropriate model (invoice, receipt, etc.)      │
│             └─► Extract structured data (fields, tables)        │
│                                                                  │
│  3. Extracted data merged with AI prompt                        │
│     └─► AI model receives structured context                    │
│         └─► Response includes document-specific insights        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Complete Chat Request Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Browser │     │ Express │     │Services │     │Database │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │ POST /api/chat/stream         │               │
     │──────────────►│               │               │
     │               │               │               │
     │               │ requireAuth   │               │
     │               │──────────────►│               │
     │               │               │               │
     │               │ storage.getUser               │
     │               │───────────────────────────────►
     │               │               │◄──────────────│
     │               │               │               │
     │               │ storage.getConversation       │
     │               │───────────────────────────────►
     │               │               │◄──────────────│
     │               │               │               │
     │               │ aiOrchestrator.processQuery   │
     │               │──────────────►│               │
     │               │               │               │
     │               │               │ queryTriage.classifyQuery
     │               │               │──────┐        │
     │               │               │◄─────┘        │
     │               │               │               │
     │               │               │ aiProviderRegistry.generate
     │               │               │──────┐        │
     │               │               │◄─────┘        │
     │               │               │               │
     │               │◄──────────────│               │
     │               │               │               │
     │               │ storage.createMessage         │
     │               │───────────────────────────────►
     │               │               │◄──────────────│
     │               │               │               │
     │ SSE: chunk    │               │               │
     │◄──────────────│               │               │
     │               │               │               │
     │ SSE: end      │               │               │
     │◄──────────────│               │               │
```

---

## Service Dependencies Matrix

### Critical Dependencies

| Service | Depends On | Used By |
|---------|-----------|---------|
| `aiOrchestrator` | queryTriage, aiProviders, financialSolvers, promptBuilder | routes.ts |
| `queryTriage` | (standalone) | aiOrchestrator |
| `aiProviderRegistry` | openai, claude, gemini, azure | aiOrchestrator |
| `financialSolvers` | (standalone) | aiOrchestrator |
| `storage` | pg, drizzle-orm | All routes |
| `sessionStore` | redis OR memorystore | Express |
| `mfaService` | speakeasy, qrcode | Auth routes |

### Initialization Order

```typescript
// server/index.ts - Startup sequence

1. Express app creation
2. Session middleware setup
3. Security middleware (helmet, cors, rate limiting)
4. Route registration
   a. Health check routes (no auth)
   b. Auth routes
   c. Payment routes
   d. Main routes (chat, conversations, etc.)
   e. Admin routes
5. AI agent initialization
6. HTTP server creation
7. (Legacy) WebSocket setup (now SSE)
8. Server listening
```

### Feature Flags

```typescript
// server/config/featureFlags.ts

// Features that can be enabled/disabled
DOCUMENT_ANALYSIS      // Azure Document Intelligence
KNOWLEDGE_GRAPH        // Document ingestion to knowledge graph
ADVANCED_REASONING     // Chain-of-thought reasoning
MFA_ENABLED           // Multi-factor authentication
REDIS_SESSIONS        // Redis session store
```

---

## Performance Considerations

### Caching Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                     Caching Layers                               │
│                                                                  │
│  1. React Query (Client)                                        │
│     • Query results cached with configurable staleTime          │
│     • Background refetching on window focus                     │
│     • Optimistic updates for mutations                          │
│                                                                  │
│  2. LRU Cache (Server)                                          │
│     • Query classification results                              │
│     • Embedding vectors                                         │
│     • Provider health status                                    │
│                                                                  │
│  3. Redis (Production)                                          │
│     • Session data                                              │
│     • Rate limiting counters                                    │
│     • Feature flag cache                                        │
│                                                                  │
│  4. Node Cache (In-memory)                                      │
│     • Configuration values                                      │
│     • Static content                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Circuit Breaker Pattern

```typescript
// server/services/circuitBreaker.ts

// Prevents cascade failures when AI providers are down
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,      // Open after 5 failures
  successThreshold: 3,      // Close after 3 successes
  timeout: 30000,           // Request timeout
  resetTimeout: 60000,      // Time before half-open
});

// States:
// CLOSED  - Normal operation, requests pass through
// OPEN    - Failing, requests immediately rejected
// HALF-OPEN - Testing, limited requests pass
```

---

*This document provides a comprehensive overview of ICAI CAGPT's service architecture. For specific implementation details, refer to the source code and inline documentation.*
