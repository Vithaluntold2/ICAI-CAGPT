# OSS Infrastructure Upgrade Plan
## Moving ICAI-CAGPT from API Wrapper to Owned Platform

**Date:** April 2026  
**Scope:** Full codebase audit + OSS replacement strategy  
**Goal:** Own compute, retrieval, orchestration, and knowledge layers — not depend on any single closed API.

---

## 1. What Is Currently a Genuine Moat

These components are custom-built and provide real competitive differentiation.  
They should be preserved and extended, not replaced.

| Component | File(s) | Why It's Custom |
|---|---|---|
| Deterministic financial solvers | `server/services/financialSolvers.ts` | Real formula logic for NPV, IRR, GST, TDS, depreciation across jurisdictions. No LLM arithmetic — compliant with the Excel-first rule. |
| Two-agent calculation pipeline | `server/services/agents/twoAgentSolver.ts` | Decomposes multi-part queries → deterministic solver per sub-question → merges to one workbook. Max 2 LLM calls regardless of query complexity. |
| Multi-stage Excel workbook builder | `server/services/excel/` (15 files) | Spec schema, AI formula generator, VBA generator, formula pattern library, workbook smoke-test + self-heal loop. ExcelJS-native — no dependency on Excel or Google Sheets API. |
| Boardroom relevance loop | `server/services/roundtable/roundtableRuntime.ts` | Phase-gated multi-agent orchestration — proposeTurn → moderator selection → agent turn with KB-isolation per agent, tool calls (ask_panelist, start_side_thread, cede_floor), cost guardrails, AbortController per turn. |
| ICAI regulatory scraper | `server/services/core/regulatoryScraper.ts` | Live structured pulls from ICAI, CBDT, SEBI, MCA, RBI, GST Council. Embeds and stores to pgvector so the RAG pipeline has fresh regulation data automatically. |
| Compliance Sentinel | `server/services/complianceSentinel.ts` | Post-generation validation layer — hallucination check, numeric consistency, GAAP/IRS compliance. Finance-specific, not generic. |
| Continuous learning pipeline | `server/services/core/continuousLearning.ts` | Feedback → quality scoring → fine-tuning dataset curation. Research-backed quality thresholds. Currently pointed at OpenAI fine-tune (see problem below). |

---

## 2. What Is Currently a Thin Wrapper (Problems)

These components provide no real moat — they depend entirely on closed APIs. If any API changes pricing, rate limits, or availability, the product breaks.

### 2a. AI Provider Layer — Full Closed-API Dependency
**Files:** `server/services/aiProviders/` (7 provider files)  
**Problem:** Every inference call in every agent goes through `getAIResponse()` → `AIProviderRegistry` → Azure/OpenAI/Claude/Gemini/Perplexity. The product collapses without at least one of these API keys configured.  
**Specific risk:** `server/services/agents/roundtableAgents.ts` — all 100+ boardroom agent turns call the closed API even for simple domain reasoning that a 7B finance model handles better. Costs $0.00x per turn at scale.

### 2b. Knowledge Graph — In-Memory, Resets on Restart
**File:** `server/services/core/knowledgeGraph.ts`  
**Problem:** The entire knowledge graph is `Map<string, KnowledgeNode>` and `Map<string, KnowledgeEdge>` — fully in-memory. The regulatory scraper builds a rich ICAI → CBDT → SEBI relationship graph on startup and every restart throws it away. This is institutional knowledge that should persist.

### 2c. Embeddings — Single Azure Dependency
**File:** `server/services/embeddingService.ts`  
**Problem:** Every RAG lookup requires a round-trip to Azure `text-embedding-3-large`. If the Azure endpoint is down, the entire retrieval layer (boardroom KB, regulatory search, document ingestion) fails. Also costs money per query.

### 2d. Fine-Tuning Pipeline — Training a Competitor's Model
**File:** `server/services/core/finetuningOrchestrator.ts`  
**Problem:** The continuous learning pipeline captures user feedback and curates high-quality CA-GPT training examples — then sends them to OpenAI to fine-tune GPT-3.5. You are improving OpenAI's model with your users' data, not building a proprietary model.

### 2e. Vector Store — Embedding Generation Coupled to Azure
**File:** `server/services/core/pgVectorStore.ts`  
**Problem:** `generateEmbedding()` calls `openai.embeddings.create()` inline. Even though storage is pgvector (good), embedding generation will fail if `OPENAI_API_KEY` is absent, regardless of whether Azure credentials are available separately.

---

## 3. Recommended OSS Replacements

### 3.1 LlamaIndex — Replace the RAG Pipeline

**Replaces:**
- `server/services/core/ragPipeline.ts`
- `server/services/core/pgVectorStore.ts`
- `server/services/embeddingService.ts`

**Why:**
Your current RAG uses flat `vectorTopK: 10` similarity search. Accounting standards are hierarchical — IAS 36 has sub-paragraphs, GST rules have circulars that override sections. LlamaIndex's recursive retrieval handles this natively.

**Key capabilities for this codebase:**
- **FinanceBench-aware document parsers** — understands balance sheet structure, income statement rows, note disclosures.
- **Metadata filtering at retrieval time** — filter by jurisdiction, effective date, standard number without a separate pre-filter step.
- **Provider-agnostic embeddings** — swap Azure to `nomic-embed-text` (free, 768d, runs locally) and embedding cost drops to zero.
- **pgvector integration built-in** — `PgvectorDocumentStore` plugs into your existing Postgres schema.

**Integration point:** `server/services/core/ragPipeline.ts` → replace `retrieveContext()` with a LlamaIndex `QueryEngine` that wraps the existing `pgvector` store.

---

### 3.2 LangGraph — Replace the Boardroom Relevance Loop

**Replaces:** The hand-rolled state machine inside `server/services/roundtable/roundtableRuntime.ts` (specifically `scheduleRelevanceLoop` and the `proposeTurn → moderator picks → runAgentTurn` chain).

**Why:**
The current relevance loop is an implicit state machine. Phase transitions (Opening → Independent Views → Cross-Examination etc.) are managed by string comparisons in `if` blocks. If an agent tool call fails mid-turn, there is no checkpoint — the thread just goes silent.

**Key capabilities:**
- **Explicit state machine nodes** — each boardroom phase is a named graph node with typed inputs/outputs. Phase transitions are edges with conditions.
- **Built-in checkpointing** — if a turn crashes, the graph resumes from the last successfully committed state. No more silent failures.
- **Parallel node execution** — all agents' `proposeTurn` calls can fire simultaneously. Currently they're sequential. On 6 agents this is a 6x latency reduction for moderator selection.
- **Still uses your AIProviderRegistry** — LangGraph is orchestration, not inference. You keep all your providers.

**Integration point:** New file `server/services/roundtable/boardroomGraph.ts` containing the LangGraph state machine. `roundtableRuntime.ts` calls `boardroomGraph.run()` instead of the manual loop.

---

### 3.3 Qwen2.5-Finance / FinTral on SGLang — Own the Boardroom Inference

**Replaces:** `getAIResponse()` calls inside `server/services/agents/roundtableAgents.ts` and `roundtableRuntime.ts` for boardroom turns.

**Why:**
Every boardroom agent turn (Tax Bot, Audit Bot, IFRS Bot, Forensic Bot, Compliance Bot) calls a closed API for reasoning that is firmly within the finance domain. A 7B finance-tuned model handles these turns correctly and costs zero per call.

**Models to evaluate:**
- `Qwen2.5-Finance-7B` — Alibaba's finance-specific model, outperforms GPT-4o on FinBench benchmarks for financial reasoning tasks.
- `FinTral-7B` — Meta's Llama-based finance-tuned model.

**Infrastructure note:** Your H200 server (164.92.148.221) already runs SGLang on port 30050 with `AudCor/cpa-qwen3-8b-v0` for Indra. The GPU is already provisioned. A second SGLang instance for ICAI-CAGPT finance models is a config change, not new infrastructure.

**Integration point:**
1. Add `AIProviderName.OLLAMA` (or `AIProviderName.SGLANG_LOCAL`) to `server/services/aiProviders/types.ts`
2. Add a new provider `server/services/aiProviders/sglang.provider.ts` pointing to the H200 endpoint
3. In `roundtableRuntime.ts`, set `PROVIDER_ORDER[0] = AIProviderName.SGLANG_LOCAL` for boardroom turns
4. Keep Azure/OpenAI only for Excel spec generation, document OCR, and structured JSON output where reliability matters more than cost

**Result:** Boardroom sessions become offline-capable and zero-API-cost. This is the core differentiator — neither Claude for Finance nor any closed product can offer this.

---

### 3.4 FalkorDB or Apache AGE — Persist the Knowledge Graph

**Replaces:** `server/services/core/knowledgeGraph.ts` (in-memory `Map`)

**Why:**
The regulatory scraper builds a rich directed graph: ICAI standards → CBDT circulars → SEBI notifications → applicable sections → referenced case law. This graph is discarded on every restart. Persisting it enables graph queries like:

```
"Find all ICAI standards that supersede IAS 17 and apply to an Indian listed entity with a reporting date after March 2024"
```

This is not possible with flat vector search alone.

**Option A — Apache AGE**  
Graph extension that runs on top of your existing PostgreSQL. No new database to operate. Adds Cypher query support to Postgres. Best if you want minimal infrastructure change.

**Option B — FalkorDB**  
Redis-compatible graph database. Docker image available. Faster for traversal-heavy queries. Better if the knowledge graph grows beyond 100k nodes.

**Integration point:** `server/services/core/knowledgeGraph.ts` — replace the in-memory `Map` operations with AGE/FalkorDB queries. The existing `KnowledgeNode` and `KnowledgeEdge` types map directly to graph node/edge schemas.

---

### 3.5 Haystack + MinerU — Local Document Ingestion Pipeline

**Replaces:** The Azure Document Intelligence dependency in `server/services/agents/documentAnalyzer.ts` and document ingestion in `server/services/core/documentIngestion.ts`.

**Why:**
Azure Document Intelligence is called for every uploaded document (financial statements, audit reports, tax filings). This is an additional per-page cost and a dependency that makes offline demonstrations impossible.

**Why MinerU over alternatives:**  
MinerU (open-sourced by Shanghai AI Lab, the team behind InternLM) is purpose-built for high-fidelity extraction from complex academic and financial documents. Compared to alternatives:
- **Table extraction quality** — MinerU's layout model correctly identifies multi-row header tables, merged cells, and footnotes in financial statements. This directly feeds into the Excel pipeline.
- **Formula recognition** — MinerU extracts inline mathematical expressions (e.g., from audit notes or tax computation sheets) as structured text, not as garbled OCR strings.
- **Output format** — emits structured Markdown + JSON with bounding boxes, paragraph classification, and table objects. Haystack's document store ingests this natively.
- **GPU acceleration** — runs on CUDA; your H200 server handles this trivially alongside SGLang.
- **No page-count billing** — unlike Azure Doc Intelligence which charges per page analysed.

**Deployment on H200 server:**  
MinerU runs as a Python service. Port 7071 is available (7070 is Docling which is already running for Cyloid/Indra — do not displace it). Deploy as a separate service:
```bash
pip install magic-pdf[full] --extra-index-url https://wheels.myhloli.com
# Run as API wrapper (FastAPI thin layer over magic_pdf.pipe.UNIPipe)
```

**Integration point:**
1. Add a `MinerUProvider` to `server/services/agents/documentAnalyzer.ts` that POSTs PDFs/DOCX to the MinerU API wrapper on port 7071
2. Use Haystack's `PDFConverter → TextSplitter → Embedder → DocumentStore` pipeline for structured ingestion, with MinerU as the converter backend
3. Route financial statement uploads (balance sheets, P&L, audit reports) through MinerU for table-aware extraction; use MinerU output directly as input to the Excel workbook builder

**Result:** Document ingestion becomes free and fully local. MinerU's table extraction from financial statements produces structured data the Excel pipeline can use directly — no intermediate OCR cleanup step.

---

### 3.6 LoRA Fine-Tuning on Your Own Model — Stop Training Competitors

**Replaces:** `server/services/core/finetuningOrchestrator.ts` (currently pipes fine-tuning data to OpenAI)

**Why:**
Your continuous learning pipeline captures CA-GPT interaction data and curates high-quality training examples from user feedback. Currently these are uploaded to OpenAI to fine-tune GPT-3.5 — you are enriching OpenAI's models with domain expertise your users created.

**Target:**
- Export the `finetuningDataset` table as JSONL in the OpenAI fine-tune format (already done — the schema matches)
- Run LoRA fine-tuning on `Qwen2.5-Finance-7B` using the H200 GPU (144GB VRAM supports 7B fine-tuning comfortably)
- Deploy the fine-tuned adapter via SGLang — same infrastructure, new model weights
- The continuous learning loop now improves **your** model, not OpenAI's

**Tools:** `axolotl` (fine-tuning framework), `peft` (LoRA), `vllm` or `sglang` for serving.

---

## 4. What Dify Is Good For Here (and What It Isn't)

**Do not** replace the backend with Dify. That makes you a Dify wrapper, which is worse than an OpenAI wrapper because Dify adds another layer of indirection without adding moat.

**The one legitimate use:** Dify's visual workflow builder DSL can be used as the **panel configuration UI** — instead of a CA building agent panels via JSON config forms, they drag-and-drop a workflow that compiles to your existing `RoundtableAgentTemplate` schema. You'd either embed the Dify workflow editor as an iFrame or replicate its DSL parser (it's open source). This is purely a UI concern; none of the backend changes.

---

## 5. Prioritised Implementation Order

| Priority | Change | Impact | Effort |
|---|---|---|---|
| 1 | SGLang provider for boardroom inference (Qwen2.5-Finance) | Eliminates per-turn API cost, offline-capable boardroom | Medium — new provider file + model deployment |
| 2 | MinerU integration for document ingestion | Eliminates Azure Doc Intelligence cost, GPU-accelerated table extraction for financial statements | Low-Medium — deploy FastAPI wrapper on H200, add MinerUProvider |
| 3 | Apache AGE for knowledge graph persistence | Graph survives restarts, enables Cypher traversal | Medium — schema migration + query rewrite |
| 4 | LlamaIndex for hierarchical RAG | Better retrieval quality for standards/case law, local embeddings | Medium-High — RAG pipeline rewrite |
| 5 | LangGraph for boardroom state machine | Checkpointing, parallelism, explicit phase graph | High — significant orchestration rewrite |
| 6 | LoRA fine-tuning pipeline on H200 | Proprietary model trained on your data | High — requires fine-tuning infrastructure setup |

---

## 6. What This Makes ICAI-CAGPT vs. Competitors

| Capability | Claude for Finance | Claude in Excel | ICAI-CAGPT (current) | ICAI-CAGPT (after OSS upgrade) |
|---|---|---|---|---|
| Deterministic financial solvers | No — LLM computes numbers (wrong) | Partial | Yes | Yes |
| Multi-agent boardroom with phase structure | No | No | Yes | Yes + LangGraph checkpointing |
| Excel spec → .xlsx with smoke-test | No | Partial | Yes | Yes |
| Offline-capable boardroom | No | No | No | Yes (local model) |
| Jurisdiction-aware live regulation ingestion | No | No | Yes (scraper) | Yes (persisted graph) |
| Proprietary fine-tuned model | No | No | No | Yes (LoRA on H200) |
| Cost per boardroom session | API cost | API cost | API cost | Near-zero (local inference) |
| Data privacy (user queries leave your server) | No | No | No | Yes (local boardroom inference) |

The boardroom + deterministic solvers + local inference combination is what no closed product can replicate. That is the moat.
