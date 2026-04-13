# Luca - Accounting Superintelligence

## Overview
Luca is a pan-global accounting superintelligence platform designed to surpass traditional tax and accounting software. It integrates specialized AI models with advanced financial solvers to offer comprehensive expertise across tax, audit, financial reporting, compliance, and financial analysis. The platform provides actual calculations, multi-domain expertise, global coverage, advanced financial modeling, and real-time processing, aiming to be a superior alternative to existing tools.

## User Preferences
I prefer that you communicate in a clear and concise manner. When providing explanations, please prioritize simplicity and avoid overly technical jargon where possible. I value an iterative development approach, so please propose changes and discuss them with me before implementing major modifications to the codebase. Ensure that any changes you make are well-documented and align with the existing code style. Please do not make changes to files in the `server/services` directory.

## System Architecture

### UI/UX Decisions
The user interface features a 3-pane resizable layout: a left pane for conversations, a middle chat interface with markdown rendering, and a right output pane for professional features like formatted views, search, and export options. It includes a multi-profile system for managing business, personal, and family accounting contexts, with a profile filter dropdown in the conversations sidebar. The design uses a pink-to-purple brand gradient theme. Mathematical formulas are rendered using LaTeX. Chat messages include avatars for both assistant and user. The UI features a glassmorphic design system with gradient mesh backgrounds and premium animations. A prominent horizontal mode selector ribbon (ModeDockRibbon) showcases all 6 professional modes. Legal pages are implemented with a glassmorphic design matching branding.

### Technical Implementations
Luca employs a multi-provider AI architecture with a provider abstraction layer and a health monitoring system for dynamic selection and intelligent failover among LLMs. A Professional Requirement Clarification System ensures tailored, jurisdiction-specific advice by detecting context, analyzing missing details, and recognizing accounting nuances. The Query Processing Pipeline uses an Intelligent Query Triage System to classify questions and route them to optimal AI models and advanced financial solvers. Server-Sent Events (SSE) enable real-time streaming chat responses. The platform includes file upload capabilities with a robust document processing pipeline using Azure Document Intelligence (primary) with fallback to pdf-parse text extraction.

**Advanced AI Reasoning System (NEW)**: Luca now implements a sophisticated reasoning architecture designed to surpass ChatGPT quality:
- **Reasoning Governor**: Orchestrates five reasoning profiles (fast, cot, analytical, multi-agent, parallel) based on query complexity and chat mode
- **Chain-of-Thought (CoT) Reasoning**: Research ('deep-research') and Calculate ('calculation') modes ALWAYS use explicit step-by-step reasoning prompts (enabled by default for paid tiers), with mode-specific templates guiding systematic problem-solving
- **Cognitive Monitoring**: Compliance Sentinel validates responses for hallucinations via claim verification, source grounding, and contradiction detection; Validation Agent checks rule compliance and numeric accuracy
- **Feature Flags**: Gradual rollout controlled via ENABLE_COT_REASONING (default ON), ENABLE_COMPLIANCE_MONITORING, ENABLE_VALIDATION_AGENT, ENABLE_MULTI_AGENT (all opt-in)
- **Provider Capability Mapping**: Dynamic detection of which AI models support advanced reasoning; provider IDs align with AIProviderName enum ('claude', 'gemini', 'openai', etc.)
- **Quality Scoring**: Every response gets a quality score (0-1) based on compliance checks and validation confidence, with auto-repair hooks for low-quality responses
- **Reasoning Metadata**: All governor decisions, CoT traces, and monitoring results stored in message metadata for auditability and continuous improvement
- **Architecture**: Backward compatible design - reasoning governor sits as optional middleware, preserves existing triage/routing, fails gracefully if disabled
- **Chat Mode Normalization**: Centralized normalization at request boundary ensures consistent mode naming throughout the system; supports legacy mode names ('research' → 'deep-research', 'calculate' → 'calculation', 'audit' → 'audit-plan') for backward compatibility

**Critical Bug Fixes (Nov 19, 2025)**:
- Fixed chat mode name mismatches: Backend now correctly recognizes 'deep-research', 'calculation', 'audit-plan' instead of legacy names
- Fixed provider capability registry: Provider IDs now match AIProviderName enum ('claude', 'gemini' instead of 'anthropic', 'google')
- Fixed metadata persistence: Reasoning metadata (including CoT traces, quality scores, cognitive monitoring) now properly saved to database for all chat endpoints
- Implemented chat mode normalizer (server/services/chatModeNormalizer.ts) for consistent mode handling across all code paths

The Output Pane features a comprehensive export system with industry-grade financial visualizations and document generation in six formats: TXT, CSV, DOCX, PDF, PPTX, and XLSX. Visualizations are powered by Apache ECharts for advanced charts (Combo, Waterfall, Gauge, KPI Card, DataTable) and Recharts for legacy types (line, bar, pie, area, workflow). Visualization data is stored in `messages.metadata.visualization`. The DocumentExporter service converts markdown and chart data. The system includes search functionality, copy-to-clipboard, and formatted/code view modes.

AI responses are designed for accessibility, starting with plain-language summaries, defining technical terms, using analogies, and structuring information clearly. This applies to all 6 chat modes (Standard, Research, Checklist, Workflow, Audit, Calculate).

### Feature Specifications
Luca offers three unique features:
1.  **Regulatory Scenario Simulator**: For "what-if" stress-testing of tax and audit positions across jurisdictions and time periods, with side-by-side comparisons.
2.  **Client Deliverable Composer**: One-click generation of professional-grade documents (e.g., audit plans, tax memos) with AI assistance, template variables, and export options.
3.  **Forensic Document Intelligence**: Proactive anomaly detection and cross-document reconciliation for financial discrepancies, providing risk scoring and supporting evidence extraction.

The platform supports full conversation history, token usage tracking, and a comprehensive subscription tier system with Razorpay payment integration. There are 4 subscription tiers: Free, Pay-as-you-go, Plus, Professional, and Enterprise, with regional pricing across 6 markets and PPP-adjusted pricing. The subscription system includes usage quota tracking, payment verification, and webhook handling. Conversations are profile-aware. An Admin Module provides subscription and coupon management. A production-ready user feedback and analytics system captures user ratings and resolution status, displayed in an analytics dashboard.

### System Design Choices
The backend uses Express.js with a PostgreSQL database and Drizzle ORM. Security features include bcrypt for password hashing, AES-256-GCM encryption, Helmet middleware, and rate limiting. File uploads utilize a secure system with per-file encryption, key wrapping, SHA-256 checksums, and virus scanning. The `conversations` table includes `profileId` for efficient filtering, enforcing profile ownership. Authentication uses a two-step redirect pattern. Express body size limits are set to 10MB. Payment processing uses Razorpay SDK with signature validation, webhook verification, and idempotency constraints. Database tables include `subscriptions`, `payments`, and `usageQuotas`.

## External Dependencies

-   **AI Providers**:
    -   Anthropic Claude (`claude-3-5-sonnet-20241022`)
    -   Google Gemini (`gemini-2.0-flash-exp`)
    -   Perplexity AI (`llama-3.1-sonar-large-128k-online`)
    -   Azure OpenAI (`gpt-4o`)
    -   OpenAI API (`gpt-4o`, `gpt-4o-mini`)
    -   Azure Document Intelligence
-   **Accounting Software (OAuth 2.0)**:
    -   QuickBooks Online
    -   Xero
    -   Zoho Books
    -   ADP Workforce Now
-   **Tax Software (Secure File Upload)**:
    -   Drake Tax
    -   TurboTax
    -   H&R Block
-   **Payment Processing**:
    -   Razorpay
-   **External Virus Scanning Service**