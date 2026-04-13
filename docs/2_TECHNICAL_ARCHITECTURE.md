# ICAI CAGPT - Technical Architecture
## Complete System Design & Implementation Details

**Document Version**: 2.0  
**Last Updated**: December 23, 2025  
**Consolidated from**: COMPREHENSIVE_CODEBASE_ANALYSIS.md, COMPREHENSIVE_FEATURE_ANALYSIS.md, BRUTAL_TRUTH_AUDIT.md, COMPLETION_STATUS.md, AGENT_INTEGRATION_STATUS.md, SESSION_STATUS_REPORT.md, GAP_ANALYSIS_VERIFICATION_REPORT.md, ERROR_RESOLUTION_COMPLETE.md

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Codebase Metrics](#2-codebase-metrics)
3. [Agent System Architecture](#3-agent-system-architecture)
4. [AI Provider Orchestration](#4-ai-provider-orchestration)
5. [Database Schema](#5-database-schema)
6. [API Endpoints](#6-api-endpoints)
7. [Core Services](#7-core-services)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Current Status & Known Issues](#9-current-status--known-issues)

---

## 1. System Overview

### 1.1 Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TailwindCSS, Radix UI |
| **Backend** | Express.js, TypeScript |
| **Database** | PostgreSQL (Supabase) + Drizzle ORM |
| **AI Providers** | OpenAI, Anthropic, Google, Azure, Perplexity |
| **Real-time** | WebSocket for streaming |
| **Caching** | Redis (optional) + Memory fallback |
| **Document AI** | Azure Document Intelligence |

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client (React + Vite)                        │
├─────────────────────────────────────────────────────────────────┤
│  ModeDockRibbon │ Chat.tsx │ OutputPane │ ContextCard │ Admin   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Express.js Server                            │
├─────────────────────────────────────────────────────────────────┤
│ Security Middleware │ Rate Limiting │ Session Management        │
├─────────────────────────────────────────────────────────────────┤
│                       Routes Layer                               │
│  /api/auth │ /api/chat │ /api/conversations │ /api/agents       │
├─────────────────────────────────────────────────────────────────┤
│                     Services Layer                               │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ AI Orchestrator │  │ Agent System    │  │ Financial       │ │
│  │ - Query Triage  │  │ - 104 Agents    │  │ - NPV/IRR       │ │
│  │ - Provider Route│  │ - Orchestrator  │  │ - Tax Calc      │ │
│  │ - Health Monitor│  │ - Message Queue │  │ - Depreciation  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Document Intel  │  │ Context Manager │  │ Security        │ │
│  │ - Azure DI      │  │ - Knowledge     │  │ - Encryption    │ │
│  │ - PDF Parse     │  │ - Vector Store  │  │ - MFA           │ │
│  │ - OCR           │  │ - Templates     │  │ - Virus Scan    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Supabase)                         │
│                       30 Tables                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Codebase Metrics

### 2.1 Size Distribution

| Component | Lines of Code | Files |
|-----------|---------------|-------|
| **Total TypeScript/TSX** | 61,427 | 232 |
| **Server Code** | ~38,000 | ~99 |
| **Client Code** | ~24,000 | 133 |
| **Shared Code** | ~2,000 | ~15 |

### 2.2 Largest Files (Complexity Hotspots)

| File | Lines | Risk Level | Notes |
|------|-------|------------|-------|
| `server/routes.ts` | 4,066 | ⚠️ HIGH | Needs splitting |
| `server/services/aiOrchestrator.ts` | 1,455 | ✅ OK | Well-structured |
| `client/src/pages/Chat.tsx` | 1,311 | ⚠️ MEDIUM | Consider splitting |
| `server/pgStorage.ts` | 865 | ✅ OK | Data layer |
| `server/services/excelOrchestrator.ts` | 815 | ✅ OK | Feature file |

### 2.3 Test Coverage

| Metric | Current | Target |
|--------|---------|--------|
| Test Files | 2 | 50+ |
| Total Test Lines | 1,213 | 10,000+ |
| Coverage Ratio | ~3.3% | 60%+ |

---

## 3. Agent System Architecture

### 3.1 Agent Count by Mode

| Mode | Agents | Status |
|------|--------|--------|
| **Deep Research** | 8 | ✅ Registered |
| **Financial Calculation** | 5 | ✅ Registered |
| **Workflow Visualization** | 5 | ✅ Registered |
| **Audit Planning** | 14 | ✅ Registered |
| **Scenario Simulator** | 12 | ✅ Registered |
| **Deliverable Composer** | 45 | ✅ Registered |
| **Forensic Intelligence** | 8 | ✅ Registered |
| **Roundtable** | 6 | ✅ Registered |
| **TOTAL** | **104** | |

### 3.2 Agent Files

| File | Agent Count | Lines |
|------|-------------|-------|
| `deepResearchAgents.ts` | 8 | 667 |
| `financialCalculationAgents.ts` | 5 | ~400 |
| `workflowVisualizationAgents.ts` | 5 | ~300 |
| `auditPlanningAgents.ts` | 14 | 720 |
| `scenarioSimulatorAgents.ts` | 12 | 774 |
| `deliverableComposerPart1.ts` | 18 | ~500 |
| `deliverableComposerPart2.ts` | 27 | ~600 |
| `forensicIntelligenceAgents.ts` | 8 | ~500 |
| `roundtableAgents.ts` | 6 | 565 |

### 3.3 Complete Agent List (104 Agents)

#### Deep Research Mode (8)
1. Research Coordinator
2. Source Validator
3. Citation Generator
4. Regulation Searcher
5. Case Law Analyzer
6. Tax Code Navigator
7. Cross-Reference Builder
8. Summary Generator

#### Financial Calculation Mode (5)
9. NPV Calculator
10. Tax Liability Calculator
11. Depreciation Scheduler
12. ROI Calculator
13. Break-Even Analyzer

#### Workflow Visualization Mode (5)
14. Workflow Parser
15. Node Generator
16. Edge Generator
17. Layout Optimizer
18. Workflow Validator

#### Audit Planning Mode (14)
19. Scope Definer
20. Risk Assessor
21. Materiality Calculator
22. Control Evaluator
23. Sampling Planner
24. Evidence Planner
25. Team Allocator
26. Timeline Planner
27. Budget Estimator
28. Procedure Designer
29. Testing Strategy Designer
30. Documentation Planner
31. Communication Planner
32. Audit Plan Finalizer

#### Scenario Simulator Mode (12)
33. Scenario Designer
34. Assumption Validator
35. Tax Impact Modeler
36. Financial Projector
37. Regulatory Simulator
38. What-If Analyzer
39. Sensitivity Analyzer
40. Monte Carlo Simulator
41. Scenario Comparator
42. Risk Modeler
43. Outcome Predictor
44. Recommendation Synthesizer

#### Deliverable Composer Mode (45)

**Audit Reports (9):**
45-53. Executive Summary Generator, Findings Reporter, Recommendation Writer, Management Response Collector, Appendix Assembler, Opinion Formatter, Scope Describer, Methodology Documenter, Audit Report Finalizer

**Tax Opinions (9):**
54-62. Tax Position Analyzer, Legal Citation Builder, Precedent Analyzer, Risk Assessment Writer, Conclusion Drafter, Disclaimer Generator, Qualification Lister, Alternative Position Explorer, Tax Opinion Finalizer

**Advisory Letters (9):**
63-71. Situation Summarizer, Options Generator, Pro-Con Analyzer, Recommendation Formulator, Action Plan Developer, Timeline Creator, Risk Mitigation Planner, Cost-Benefit Analyzer, Advisory Letter Finalizer

**Compliance Documents (9):**
72-80. Requirement Mapper, Checklist Generator, Form Preparation Guide, Deadline Tracker, Documentation Assembler, Compliance Certificate Generator, Filing Instruction Writer, Audit Trail Documenter, Compliance Report Finalizer

**Financial Models (9):**
81-89. Assumption Definer, Revenue Modeler, Expense Forecaster, Cash Flow Projector, Valuation Calculator, Sensitivity Table Builder, Scenario Comparison Builder, Chart Data Preparation, Financial Model Finalizer

#### Forensic Intelligence Mode (8)
90. Pattern Detector
91. Anomaly Identifier
92. Transaction Tracer
93. Entity Relationship Mapper
94. Timeline Constructor
95. Evidence Linker
96. Suspicion Scorer
97. Investigation Reporter

#### Roundtable Mode (6)
98. Expert Assembler
99. Discussion Moderator
100. Perspective Collector
101. Argument Analyzer
102. Consensus Synthesizer
103. Recommendation Finalizer

### 3.4 Agent Infrastructure

| Component | File | Purpose |
|-----------|------|---------|
| **Agent Orchestrator** | `agentOrchestrator.ts` | Coordinates multi-agent workflows |
| **Agent Registry** | `agentRegistry.ts` | Agent discovery and lifecycle |
| **Agent Bootstrap** | `agentBootstrap.ts` | Workflow templates (513 lines) |
| **Message Queue** | `messageQueue.ts` | Inter-agent communication |
| **Agent Monitor** | `agentMonitor.ts` | Health and performance tracking |
| **Context Manager** | `contextManager.ts` | Conversation state management |
| **Template Manager** | `templateManager.ts` | Prompt template system |

### 3.5 Agent Workflow Execution Flow

```
User Query → Chat Mode Detection → isAgentWorkflowMode?
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │ YES                                       │ NO
                    ▼                                           ▼
            executeWorkflow()                           aiOrchestrator
                    │                                    .processQuery()
                    ▼
            agentBootstrap.ts
            (mode → template)
                    │
                    ▼
            agentOrchestrator
            .executeAgents()
                    │
                    ▼
            Individual Agents
            (parallel/sequential)
                    │
                    ▼
            Aggregated Result
```

---

## 4. AI Provider Orchestration

### 4.1 Provider Configuration

| Provider | Environment Variable | Models |
|----------|---------------------|--------|
| **OpenAI** | `OPENAI_API_KEY` | gpt-4, gpt-4-turbo, gpt-3.5-turbo |
| **Anthropic** | `ANTHROPIC_API_KEY` | claude-3-5-sonnet, claude-3-opus |
| **Google** | `GOOGLE_AI_API_KEY` | gemini-2.0-flash-exp |
| **Azure OpenAI** | `AZURE_OPENAI_*` | gpt-4o |
| **Perplexity** | `PERPLEXITY_API_KEY` | llama-3.1-sonar-large |

### 4.2 Query Triage System

**Domains Classified:**
- `tax` - Tax-related queries
- `audit` - Audit and assurance
- `financial_reporting` - Financial statements
- `compliance` - Regulatory compliance
- `general_accounting` - Basic accounting
- `advisory` - Strategic advice

**Complexity Levels:**
- `simple` - Basic questions (<100 chars)
- `moderate` - Multi-step analysis
- `complex` - Deep domain expertise
- `expert` - Multiple jurisdictions

### 4.3 Intelligent Routing

```typescript
// Query Triage → Model Selection
Domain + Complexity → Optimal Provider + Model

Examples:
- Tax + Expert → Claude 3.5 Sonnet (best reasoning)
- Calculation + Simple → GPT-4-turbo (fast)
- Research + Complex → Perplexity (real-time citations)
```

### 4.4 Health Monitoring & Failover

| Feature | Implementation |
|---------|---------------|
| **Success Rate Tracking** | Per-provider metrics |
| **Latency Monitoring** | P50, P95, P99 |
| **Automatic Failover** | Cooldown after failures |
| **Circuit Breaker** | Opossum library |
| **Cost Optimization** | Cheapest capable model |

### 4.5 Advanced Reasoning System

| Component | Purpose |
|-----------|---------|
| **Reasoning Governor** | Orchestrates 5 reasoning profiles |
| **Compliance Sentinel** | Validates responses for hallucinations |
| **Validation Agent** | Checks calculations and citations |
| **CoT Templates** | Mode-specific reasoning chains |
| **Quality Scoring** | 0-1 score for every response |

---

## 5. Database Schema

### 5.1 Core Tables (30 Total)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | User accounts | id, email, password, mfaEnabled |
| `conversations` | Chat sessions | id, userId, title, profileId |
| `messages` | Chat messages | id, conversationId, role, content |
| `profiles` | Business contexts | id, userId, name, type |
| `subscriptions` | User subscriptions | id, userId, tier, status |
| `payments` | Payment history | id, userId, amount, status |
| `usageQuotas` | Usage tracking | id, userId, queries, documents |
| `integrations` | OAuth connections | id, userId, provider, tokens |
| `sessions` | Express sessions | sid, sess, expire |
| `coupons` | Discount codes | id, code, discountPercent |

### 5.2 Schema Patterns

```typescript
// All tables follow these patterns:
- UUID primary keys: gen_random_uuid()
- Timestamps: createdAt, updatedAt (auto-managed)
- Soft deletes: deletedAt (where applicable)
- JSONB columns: metadata, extra
- Proper indexes: Foreign keys, query patterns
```

---

## 6. API Endpoints

### 6.1 Endpoint Summary

| Category | Count | Base Path |
|----------|-------|-----------|
| Authentication | 5 | `/api/auth/*` |
| MFA | 4 | `/api/mfa/*` |
| Chat | 11 | `/api/chat/*`, `/api/conversations/*` |
| Agents | 3 | `/api/agents/*` |
| Files | 4 | `/api/files/*` |
| Subscriptions | 5 | `/api/subscriptions/*` |
| Payments | 4 | `/api/payments/*` |
| Integrations | 6 | `/api/integrations/*` |
| Admin | 12 | `/api/admin/*` |
| Profiles | 4 | `/api/profiles/*` |
| **TOTAL** | **~113** | |

### 6.2 Key Endpoints

```
Authentication:
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/register
GET  /api/auth/me

Chat:
POST /api/chat                 - Main chat endpoint
POST /api/chat/stream          - SSE streaming
POST /api/chat/upload-file     - File upload
GET  /api/conversations        - List conversations
POST /api/conversations        - Create conversation

Agents:
GET  /api/agents/capabilities/:mode - Get mode capabilities
POST /api/agents/execute            - Execute agent workflow

Admin:
GET  /api/admin/users          - List all users
GET  /api/admin/subscriptions  - Subscription management
GET  /api/admin/analytics      - Dashboard analytics
```

---

## 7. Core Services

### 7.1 Service Architecture

```
server/services/
├── aiOrchestrator.ts          (1,455 lines) - AI coordination
├── aiProviders/
│   ├── openai.provider.ts
│   ├── claude.provider.ts
│   ├── gemini.provider.ts
│   ├── azureOpenAI.provider.ts
│   ├── perplexity.provider.ts
│   ├── healthMonitor.ts
│   ├── providerRouter.ts
│   ├── modelSelector.ts
│   └── registry.ts
├── agents/                    - 104 agents
├── core/
│   ├── agentOrchestrator.ts
│   ├── contextManager.ts
│   ├── knowledgeGraph.ts
│   ├── vectorStore.ts
│   └── documentIngestion.ts
├── queryTriage.ts             - Query classification
├── financialSolvers.ts        - Deterministic calculations
├── documentAnalyzer.ts        - Document AI
├── excelOrchestrator.ts       (815 lines) - Excel generation
├── subscriptionService.ts     - Subscription management
├── cashfreeService.ts         - Payment processing
├── mfaService.ts              - Multi-factor auth
└── virusScanService.ts        - File security
```

### 7.2 Financial Solvers

| Calculator | Method | Description |
|-----------|--------|-------------|
| NPV | Newton-Raphson | Net Present Value |
| IRR | Iterative | Internal Rate of Return |
| Depreciation | SL, DB, DDB, SYD | Multiple methods |
| Tax Liability | Multi-jurisdiction | Federal + state + international |
| Amortization | Standard | Loan payment schedules |
| Break-even | Formula | Break-even point |
| Ratios | 10+ types | Financial ratio calculations |

### 7.3 Document Intelligence

| Feature | Implementation |
|---------|---------------|
| **Primary** | Azure Document Intelligence |
| **Fallback** | pdf-parse text extraction |
| **OCR** | Included in Azure DI |
| **Supported** | PDF, XLSX, XLS, CSV, DOC, DOCX, JPEG, PNG |
| **Max Size** | 50MB |

---

## 8. Frontend Architecture

### 8.1 Component Structure

```
client/src/
├── components/
│   ├── ui/                    - Radix-based components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── ModeDockRibbon.tsx     - Mode selector
│   ├── ContextCard.tsx        - Context display
│   ├── OutputPane.tsx         - Results display
│   └── AdminLayout.tsx        - Admin wrapper
├── pages/
│   ├── Chat.tsx               (1,311 lines) - Main chat
│   ├── Auth.tsx               - Login/register
│   ├── Admin.tsx              - Admin panel
│   └── Roundtable.tsx         - Roundtable page
├── hooks/
│   ├── useChat.ts
│   ├── useAuth.ts
│   └── ...
└── lib/
    └── utils.ts
```

### 8.2 State Management

| Concern | Solution |
|---------|----------|
| **Server State** | React Query (TanStack) |
| **Client State** | Zustand |
| **Forms** | React Hook Form + Zod |
| **Routing** | Wouter |

### 8.3 Visualizations

| Library | Use Case |
|---------|----------|
| **Apache ECharts** | Advanced charts (Combo, Waterfall, Gauge) |
| **Recharts** | Simple charts (line, bar, pie) |
| **ReactFlow** | Workflow diagrams |

---

## 9. Current Status & Known Issues

### 9.1 Overall Completion Status

| Component | Status | Notes |
|-----------|--------|-------|
| Agent System | ✅ 104/104 | All agents registered |
| AI Orchestration | ✅ Complete | Multi-provider working |
| Financial Calculators | ✅ Complete | NPV, IRR, depreciation |
| Authentication | ✅ Complete | MFA, session, lockout |
| Payments | ✅ Complete | Cashfree integration |
| UI/Frontend | 🟡 80% | Some modes not in ribbon |
| Testing | 🔴 5% | Critical gap |
| Knowledge Graph | 🔴 0% | Never populated |

### 9.2 Known Issues (From Brutal Truth Audit)

| Issue | Severity | Status |
|-------|----------|--------|
| Knowledge graph empty | 🔴 HIGH | Agents query empty stores |
| Random embeddings | 🔴 HIGH | deepResearchAgents.ts |
| Random confidence scores | 🟡 MEDIUM | roundtableAgents.ts |
| Bundle size 3.8MB | 🟡 MEDIUM | Exceeds 500KB warning |
| Duplicate keys | 🟡 MEDIUM | agentBootstrap.ts (fixed) |
| Test coverage 3% | 🔴 HIGH | Need 60%+ |

### 9.3 Mode Integration Status

| Mode | Frontend | Backend | Agents | Execution |
|------|----------|---------|--------|-----------|
| Standard | ✅ | ✅ | N/A | ✅ |
| Deep Research | ✅ | ✅ | ✅ | ✅ |
| Checklist | ✅ | ✅ | ✅ | ⚠️ |
| Workflow | ✅ | ✅ | ✅ | ⚠️ |
| Audit Plan | ✅ | ✅ | ✅ | ✅ |
| Calculation | ✅ | ⚠️ | ✅ | ⚠️ (name mismatch) |
| Scenario Simulator | 🔴 | ✅ | ✅ | ✅ |
| Deliverable Composer | 🔴 | ✅ | ✅ | ✅ |
| Forensic Intelligence | 🔴 | ✅ | ✅ | ✅ |
| Roundtable | ✅ | ✅ | ✅ | ✅ |

### 9.4 Honest Completion Percentages

| Component | Claimed | Actual |
|-----------|---------|--------|
| Overall | 100% | 55-60% |
| Agent Execution | 100% | 70% |
| UI Integration | 80% | 60% |
| Knowledge Base | N/A | 0% |
| Testing | N/A | 5% |

---

## Document Changelog

| Date | Version | Changes |
|------|---------|---------|
| Nov 22, 2025 | 1.0 | Initial technical analysis |
| Dec 17, 2025 | 1.5 | Added codebase metrics |
| Dec 23, 2025 | 2.0 | Consolidated into single document |

---

*This document consolidates: COMPREHENSIVE_CODEBASE_ANALYSIS.md, COMPREHENSIVE_FEATURE_ANALYSIS.md (technical sections), BRUTAL_TRUTH_AUDIT.md, COMPLETION_STATUS.md, AGENT_INTEGRATION_STATUS.md, SESSION_STATUS_REPORT.md, GAP_ANALYSIS_VERIFICATION_REPORT.md, ERROR_RESOLUTION_COMPLETE.md*
