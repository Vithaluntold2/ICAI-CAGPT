# LucaSearch — AI-Powered Search for Accounting, Tax & Finance

> **Created:** February 2026  
> **Status:** Phase 1 Complete (Scaffolding). Phases 2–5 Not Started.  
> **Scope:** Transform Luca from a chat-only assistant into a research-grade search engine for accounting, tax, and finance professionals.

---

## Table of Contents

1. [Vision & Phases](#1-vision--phases)
2. [Deep Insights Per Phase](#2-deep-insights-per-phase)
3. [Codebase Audit — What We Had vs What We Need](#3-codebase-audit)
4. [Revised Architecture Plan](#4-revised-architecture-plan)
5. [What Was Built (Phase 1)](#5-what-was-built-phase-1)
6. [What Remains (Phases 2–5)](#6-what-remains-phases-2-5)
7. [Honest Assessment](#7-honest-assessment)

---

## 1. Vision & Phases

Luca is not just a search engine that returns links. It is a research assistant that thinks like 10,000 CPAs — researches, cross-references standards, identifies risks, cites authoritative sources, and delivers professional-grade analysis.

### Phase 1: Search Foundation
- Dedicated search bar with domain-aware routing
- AI-synthesized answers with inline citations and source cards
- Domain filter chips: Tax, Audit, GAAP/IFRS, Compliance, Advisory
- Provider chain: Perplexity Sonar (primary, real-time web) → Azure OpenAI (fallback) → OpenAI (last resort)
- Search history with pin/delete, suggested searches

### Phase 2: Knowledge Base Layer
- Ingest authoritative content: Indian Income Tax Act, GST Act, Companies Act, ICAI Standards on Auditing, IFRS/Ind AS text, CBDT circulars
- Vector embeddings (pgvector) for semantic retrieval
- RAG pipeline: local knowledge first, web search for gaps
- Content update scheduling (circulars: daily, statutes: quarterly, standards: annually)

### Phase 3: Intelligent Caching & Scale
- Query similarity cache using embeddings (cosine threshold)
- Trending query pre-computation (deadline-aware: ITR due dates, GST filing, audit reports)
- Redis layer for hot queries
- Target: 70% local knowledge, 20% cache hits, 10% live API — $1,850/month for 18M queries vs $630K/month all-live

### Phase 4: Expert Reasoning Layer
- Cross-referencing engine: pull from multiple sources, compare, flag conflicts
- Jurisdiction-aware analysis (India, US, UK, UAE, Singapore, Australia)
- Confidence scoring: distinguish settled law from contested positions
- Amendment tracking: flag when answers may be affected by recent changes

### Phase 5: Professional Workflow Integration
- Search → Deliverable: turn search results into memos, opinions, engagement letters
- Search → Checklist: generate compliance checklists from regulatory searches
- Search → Calculation: detect numeric queries and route to financial solvers (NPV, IRR, depreciation)
- Collaborative annotations: team members flag/comment on shared searches

---

## 2. Deep Insights Per Phase

### Phase 1: Search Flow (Implemented)

```
User Query
  ↓
Domain Detection (keyword matching across 6 domains)
  ↓
Jurisdiction Detection (India, US, UK, UAE, Singapore, Australia)
  ↓
Build Domain-Aware System Prompt
  (domain-specific instructions + citation format + follow-up instructions)
  ↓
Provider Chain Execution
  Perplexity Sonar (real-time web search with native citations)
  → Azure OpenAI (knowledge-cutoff, no web search)
  → OpenAI (last resort)
  ↓
Citation Extraction (3-layer):
  1. Perplexity native metadata (response.citations array)
  2. Text-based regex: [n] Title — URL
  3. Bare URL fallback
  ↓
Related Question Extraction (RELATED_Q: prefix parsing)
  ↓
Save to History (PostgreSQL)
  ↓
Render: Markdown answer + Source cards + Related questions
```

**Backend components:**
- `server/services/searchEngine.ts` — Core engine (domain detection, prompts, provider chain, citation parsing, history persistence)
- `server/routes/searchRoutes.ts` — REST API (POST /search, GET /history, GET /suggestions, POST /:id/pin, DELETE /:id)

**Frontend components:**
- `client/src/pages/Search.tsx` — Full search page with collapsible history sidebar
- `client/src/components/search/SearchBar.tsx` — Auto-expanding textarea + domain chips
- `client/src/components/search/SourceCard.tsx` — Citation card with authoritative domain badges
- `client/src/components/search/RelatedQuestions.tsx` — Follow-up question buttons
- `client/src/hooks/useSearch.ts` — React hook (TanStack Query + manual search state)

**Wiring:**
- `shared/schema.ts` — `searchHistory` table (id, userId, query, domain, jurisdiction, answer, citations JSONB, relatedQuestions JSONB, modelUsed, providerUsed, tokensUsed, processingTimeMs, pinned, createdAt)
- `server/config/featureFlags.ts` — `AI_SEARCH` flag, gated on `PERPLEXITY_API_KEY || AZURE_OPENAI_API_KEY`
- `server/services/chatModeNormalizer.ts` — `'web-search'` mode added
- `server/routes.ts` — Mounted at `/api/search`
- `client/src/App.tsx` — `/search` route with ProtectedRoute wrapper

### Phase 2: Knowledge Base Content to Ingest

| Content | Source | Volume | Update Frequency |
|---------|--------|--------|------------------|
| Income Tax Act 1961 | incometaxindia.gov.in | ~800 sections | Quarterly (Finance Act) |
| CGST/IGST/SGST Acts | cbic.gov.in | ~200 sections | As amended |
| Companies Act 2013 | mca.gov.in | ~470 sections | As amended |
| ICAI Standards on Auditing (SA) | icai.org | ~38 standards | Annually |
| IFRS Standards | ifrs.org | ~17 standards + IAS | As issued |
| Ind AS | mca.gov.in | ~41 standards | As notified |
| US GAAP (ASC) | fasb.org | ~90 topics | As updated |
| CBDT Circulars | incometaxindia.gov.in | ~2000+ | Daily check |
| GST Circulars | cbic.gov.in | ~200+ | Daily check |
| ITAT Judgments | itat.gov.in | Thousands | Weekly |
| ICAI Guidance Notes | icai.org | ~30+ | Annually |
| SEBI Regulations | sebi.gov.in | ~50+ regulations | As amended |

**Chunking strategy:** Header-aware chunking (500 tokens per chunk, 100 token overlap). Each chunk tagged with: source, section number, effective date, jurisdiction, domain.

**Embedding model:** OpenAI `text-embedding-3-small` (1536 dimensions, $0.02/1M tokens). Estimated: ~100K chunks × $0.002 = $0.20 for initial indexing.

### Phase 3: Caching Architecture

```
Query Arrives
  ↓
Step 1: Embed query → 1536-dim vector
  ↓
Step 2: Search pgvector for similar past queries (cosine > 0.92)
  ↓
  ├── HIT → Return cached answer (cost: $0)
  └── MISS →
      ↓
      Step 3: Search local knowledge base (pgvector RAG)
      ↓
      ├── CONFIDENT (similarity > 0.85, multiple chunks agree) → Answer from KB only
      └── LOW CONFIDENCE → Augment with live web search (Perplexity)
          ↓
          Step 4: Cache the new answer for future similar queries
```

**Scaling math (370K+ Indian CAs, ~50 queries/user/month = 18M queries/month):**
- 70% from local KB: 12.6M × $0 = $0
- 20% cache hits: 3.6M × $0 = $0
- 10% live Perplexity: 1.8M × $0.001 = $1,800/month
- Embedding costs: ~$50/month
- **Total: ~$1,850/month** vs $630K/month if all queries hit Perplexity

### Phase 4: Cross-Referencing Engine

When a query touches multiple regulatory domains:
1. **Parallel retrieval**: Pull relevant sections from each applicable source
2. **Comparison matrix**: Align provisions across jurisdictions/standards
3. **Conflict detection**: Flag where sources disagree or where recent amendments create ambiguity
4. **Confidence scoring**: Rate each claim as Settled (direct statute), Interpreted (tribunal/court), Advisory (professional guidance), or Uncertain (ambiguous/contested)
5. **Amendment tracking**: Check if any cited section was recently amended and flag the change

### Phase 5: Search-to-Action Bridges

| User action | What happens |
|-------------|-------------|
| "Create Memo" | Search answer → professional memo template (letterhead, opinion structure, caveats) |
| "Generate Checklist" | Regulatory search → compliance checklist with deadlines |
| "Calculate" | Numeric query detected → route to financial solver (NPV, IRR, TDS, depreciation) |
| "Share" | Search result → shareable link with team annotations |
| "Deep Dive" | Search → full chat conversation with deep-research mode |

---

## 3. Codebase Audit

### What We Already Had (Reusable — ~60-70%)

| Component | Location | Reuse |
|-----------|----------|-------|
| Perplexity Provider | `server/services/aiProviders/perplexityProvider.ts` | Direct — already extracts `citations` from response metadata |
| Provider Registry | `server/services/aiProviders/registry.ts` | Direct — `hasProvider()`, `getProvider()`, singleton pattern |
| Health Monitor | `server/services/aiProviders/healthMonitor.ts` | Direct — `recordSuccess()`, `recordFailure()`, `getBestProvider()` |
| Query Triage | `server/services/queryTriage.ts` | Partial — has `requiresResearch` / `requiresRealTimeData` flags, could enhance domain detection |
| RAG Pipeline | `server/services/ragPipeline.ts` | Phase 2 — vector store exists with pgvector, chunking utilities present |
| SSE Streaming | `server/routes.ts` + `client/src/hooks/useSSEStream.ts` | Phase 1B — could add streaming to search (currently blocking HTTP) |
| Auth Middleware | `server/middleware/auth.ts` | Direct — `requireAuth`, `getCurrentUserId()` |
| Feature Flags | `server/config/featureFlags.ts` | Direct — added `AI_SEARCH` flag |
| Chat Mode Normalizer | `server/services/chatModeNormalizer.ts` | Direct — added `'web-search'` mode |
| Deep Research Agents | `server/services/deepResearchAgents.ts` | Phase 4 — `SourceValidator`, `CitationGenerator`, `RegulationSearcher` exist |
| Regulatory Intelligence | `server/services/regulatoryIntelligence.ts` | Partial — has direct Perplexity API usage, closest to search engine pattern |

### What We Needed to Build

| Component | Status |
|-----------|--------|
| Search orchestration service | ✅ Built (searchEngine.ts) |
| Search REST API | ✅ Built (searchRoutes.ts) |
| Search UI (page, bar, cards) | ✅ Built (4 components + 1 page) |
| Search React hook | ✅ Built (useSearch.ts) |
| DB table for history | ✅ Built (searchHistory in schema.ts) |
| SSE streaming for search | ❌ Not built (blocking HTTP) |
| Navigation entry point | ❌ Not built (no link to /search) |
| Knowledge base ingestion | ❌ Phase 2 |
| Vector embedding + RAG | ❌ Phase 2 (infrastructure exists) |
| Query caching layer | ❌ Phase 3 |
| Cross-referencing engine | ❌ Phase 4 |
| Search-to-action bridges | ❌ Phase 5 |

---

## 4. Revised Architecture Plan

### Phase 1 Implementation Decision — Files

**Created (7 files):**
1. `server/services/searchEngine.ts` — Core search engine service
2. `server/routes/searchRoutes.ts` — REST API endpoints
3. `client/src/hooks/useSearch.ts` — React search hook
4. `client/src/components/search/SearchBar.tsx` — Search input + domain chips
5. `client/src/components/search/SourceCard.tsx` — Citation display cards
6. `client/src/components/search/RelatedQuestions.tsx` — Follow-up questions
7. `client/src/pages/Search.tsx` — Full search page

**Modified (5 files):**
1. `shared/schema.ts` — Added `searchHistory` table + types
2. `server/services/chatModeNormalizer.ts` — Added `'web-search'` mode
3. `server/config/featureFlags.ts` — Added `AI_SEARCH` flag
4. `server/routes.ts` — Mounted search routes at `/api/search`
5. `client/src/App.tsx` — Added `/search` route

**Provider chain decision:**
- Primary: Perplexity Sonar `llama-3.1-sonar-large-128k-online` (real-time web search with native citations)
- Fallback: Azure OpenAI (no web search, knowledge-cutoff, but always available)
- Last resort: OpenAI direct

**Deferred from Phase 1:**
- Gemini + Google Search Grounding (not needed until Phase 3 scaling)
- RAG pipeline integration (Phase 2)
- Redis caching (Phase 3)
- Search analytics dashboard (Phase 3)
- SSE streaming (Phase 1B — should be added soon)
- Navigation entry point (Phase 1B — no link to /search from main UI)

---

## 5. What Was Built (Phase 1)

### Total: ~1,822 lines across 12 files

| File | Lines | Purpose |
|------|-------|---------|
| `server/services/searchEngine.ts` | ~450 | Domain detection (keyword matching), jurisdiction detection, domain-specific system prompts, provider chain (Perplexity → Azure → OpenAI), 3-layer citation extraction, related question parsing, history persistence |
| `server/routes/searchRoutes.ts` | ~174 | 5 REST endpoints + in-memory rate limiter (30/min/user) + Zod validation |
| `client/src/pages/Search.tsx` | ~420 | Full page — collapsible sidebar (history with pin/delete), branding header, search bar, suggestions, loading skeleton, markdown answer, source cards grid, related questions, "Deep Dive in Chat" button |
| `client/src/hooks/useSearch.ts` | ~185 | TanStack Query for history/suggestions, manual state for search execution, mutations for pin/delete |
| `client/src/components/search/SearchBar.tsx` | ~120 | Auto-expanding textarea, 6 domain filter chips, Enter to search, clear button |
| `client/src/components/search/SourceCard.tsx` | ~90 | Citation card with favicon, title, external link, authoritative domain badges (15 recognized domains: incometaxindia.gov.in, icai.org, ifrs.org, fasb.org, irs.gov, sec.gov, etc.) |
| `client/src/components/search/RelatedQuestions.tsx` | ~40 | Clickable follow-up question buttons |
| `shared/schema.ts` (addition) | ~30 | `searchHistory` pgTable with 4 indexes |
| `server/config/featureFlags.ts` (mod) | ~5 | `AI_SEARCH` flag |
| `server/services/chatModeNormalizer.ts` (mod) | ~3 | `'web-search'` mode |
| `server/routes.ts` (mod) | ~2 | Mount search routes |
| `client/src/App.tsx` (mod) | ~3 | `/search` route |

### What Each Component Actually Does

**searchEngine.ts** — This is NOT a search engine. It is an **API orchestration wrapper**:
- Takes a query string
- Matches keywords to detect domain (e.g., "tax", "audit")
- Matches keywords to detect jurisdiction (e.g., "India", "US")
- Selects a domain-specific system prompt (hardcoded strings)
- Sends query + system prompt to Perplexity Sonar API
- Parses citations from the response using regex
- Saves everything to PostgreSQL
- Returns structured JSON

**searchRoutes.ts** — Standard Express CRUD with:
- In-memory rate limiter (no cleanup — known memory leak)
- Feature flag gate (503 if AI_SEARCH disabled)
- Zod validation on search input

**Search.tsx** — Single-page layout mimicking research tool UX:
- Left sidebar: search history list with time-ago, domain badges, pin/delete
- Center: search bar (centered when empty, top when results shown)
- Results: markdown rendering via ReactMarkdown, source cards in a grid

### Environment Requirements

```env
# Required for search to work (at least one):
PERPLEXITY_API_KEY=pplx-xxx        # Primary — real-time web search
AZURE_OPENAI_API_KEY=xxx           # Fallback — no web search
ENABLE_PERPLEXITY=true             # Must be set to enable Perplexity provider

# Feature flag auto-enables if either key is present
# AI_SEARCH = !!(PERPLEXITY_API_KEY || AZURE_OPENAI_API_KEY)
```

### Database

Table: `search_history`
```sql
id              VARCHAR PK (gen_random_uuid)
user_id         VARCHAR NOT NULL → users.id (CASCADE)
query           TEXT NOT NULL
domain          VARCHAR(50) DEFAULT 'general'
jurisdiction    VARCHAR(50)
answer          TEXT NOT NULL
citations       JSONB DEFAULT '[]'
related_questions JSONB DEFAULT '[]'
model_used      VARCHAR(100)
provider_used   VARCHAR(50)
tokens_used     INTEGER
processing_time_ms INTEGER
pinned          BOOLEAN DEFAULT false
created_at      TIMESTAMP DEFAULT now()

Indexes: user_id, domain, (user_id + created_at), pinned
```

---

## 6. What Remains (Phases 2–5)

### Phase 1B — Immediate Gaps (should fix before Phase 2)

| Gap | Severity | Description |
|-----|----------|-------------|
| No navigation link | High | No way to reach `/search` from the main UI — users must type URL manually |
| No SSE streaming | Medium | Search is blocking HTTP (5-15s wait). Rest of app uses SSE. |
| Rate limiter memory leak | Low | In-memory Map never cleans expired entries. Grows per user. |
| Duplicate types | Low | `SearchCitation`, `SearchDomain` etc. defined in both backend and frontend |
| SearchBar prop sync | Medium | `initialQuery` prop ignored after mount — stale text when replaying history |

### Phase 2 — Knowledge Base (Estimated: 2-4 weeks)

- Content acquisition: Scrape/download authoritative sources (see Phase 2 table above)
- Document parsing: PDF/HTML → structured text with section metadata
- Chunking pipeline: Header-aware, 500 tokens per chunk, section/date/jurisdiction tagged
- Embedding generation: OpenAI `text-embedding-3-small`, store in pgvector
- RAG integration: Modify searchEngine.ts to query local KB first, web search for gaps
- Content update scheduler: Cron jobs for daily (circulars), weekly (judgments), quarterly (statutes)

### Phase 3 — Caching & Scale (Estimated: 2-3 weeks)

- Query embedding on every search
- Similarity search against past queries (cosine > 0.92 = cache hit)
- Redis layer for hot queries (top 1000 by volume)
- Trending pre-computation: deadline-aware (ITR filing, GST due dates, audit report deadlines)
- Analytics: track query volume, cache hit rate, cost per query, popular domains

### Phase 4 — Expert Reasoning (Estimated: 3-4 weeks)

- Multi-source retrieval: parallel pull from KB + web + case law
- Cross-referencing matrix: compare provisions across jurisdictions
- Conflict detection: flag disagreements between sources
- Confidence scoring: Settled / Interpreted / Advisory / Uncertain
- Amendment tracking: flag recently changed provisions
- Integration with existing deep research agents

### Phase 5 — Workflow Integration (Estimated: 2-3 weeks)

- Search → Memo generator (professional template)
- Search → Compliance checklist (with deadlines)
- Search → Financial calculator routing
- Collaborative annotations
- Export (PDF, DOCX)

---

## 7. Honest Assessment

### What Phase 1 is:
A **proof-of-concept API proxy** with good prompt engineering and clean UI scaffolding. It proves the flow works: query → AI → citations → render. The domain-specific prompts produce reasonable-looking results.

### What Phase 1 is NOT:
- Not a search engine (no index, no crawling, no ranking)
- Not a knowledge base (no ingested content, every query hits paid API)
- Not scalable (no caching, no local retrieval, no cost optimization)
- Not sophisticated (keyword matching for domain detection, regex for citation parsing)

### Why Phase 1 still matters:
1. The UI pattern is established and validated
2. The provider chain architecture supports graceful fallback
3. The database schema captures rich metadata for future analytics
4. The feature flag system allows gradual rollout
5. 60-70% of existing infrastructure (RAG pipeline, vector store, provider registry) was reused rather than duplicated

### Cost at current state:
Every search query = 1 Perplexity API call (~$0.001) or 1 Azure OpenAI call (~$0.01-0.03). At 1,000 queries/day = ~$30-900/month. No optimization layer exists yet.

### Timeline to "sophisticated":
With Phases 2-5 complete: ~10-14 weeks of focused development to reach a production-grade, cost-optimized, knowledge-backed search engine with expert reasoning capabilities.
