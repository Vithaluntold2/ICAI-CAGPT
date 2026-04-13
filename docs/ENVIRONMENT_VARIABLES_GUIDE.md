# ICAI CAGPT Environment Variables Guide

Complete reference for all environment variables used in the ICAI CAGPT application.

---

## Table of Contents

1. [Critical Variables (Required)](#1-critical-variables-required)
2. [AI Provider API Keys](#2-ai-provider-api-keys)
3. [Azure Services](#3-azure-services)
4. [Database & Cache](#4-database--cache)
5. [Payment Integrations](#5-payment-integrations)
6. [OAuth & Social Login](#6-oauth--social-login)
7. [Accounting Integrations](#7-accounting-integrations)
8. [Security & Encryption](#8-security--encryption)
9. [AWS Services](#9-aws-services)
10. [Monitoring & Logging](#10-monitoring--logging)
11. [Feature Flags](#11-feature-flags)
12. [Server Configuration](#12-server-configuration)
13. [External Services](#13-external-services)
14. [Sample .env File](#14-sample-env-file)

---

## 1. Critical Variables (Required)

These variables are **required** for the application to start.

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ Yes | None | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Session encryption secret (min 32 chars) | ✅ Yes | `luca-session-secret-change-in-production` | `your-random-secret-key-min-32-chars` |

### Usage Locations:
- `server/db.ts` - Database connection
- `server/index.ts` - Session management
- `drizzle.config.ts` - Database migrations

---

## 2. AI Provider API Keys

At least **one** AI provider is required for chat functionality.

### OpenAI
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `OPENAI_API_KEY` | OpenAI API key | ⚡ One required | None | `sk-...` |

**Capabilities:** GPT-4o, GPT-4-turbo, embeddings, chat completion

### Anthropic (Claude)
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | ⚡ One required | None | `sk-ant-...` |

**Capabilities:** Claude 3.5 Sonnet, Claude 3 Opus, long-context support

### Google AI (Gemini)
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `GOOGLE_AI_API_KEY` | Google AI API key | ⚡ One required | None | `AIza...` |
| `GOOGLE_GEMINI_API_KEY` | Alternative Google Gemini key | ⚡ One required | None | `AIza...` |

**Capabilities:** Gemini Pro, multimodal support

### Perplexity
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `PERPLEXITY_API_KEY` | Perplexity API key for research | ⚡ One required | None | `pplx-...` |

**Capabilities:** Deep research, regulatory intelligence, real-time data

### Azure OpenAI
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint | Optional | None | `https://your-resource.openai.azure.com` |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | Optional | None | `abc123...` |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name | Optional | `gpt-4o` | `gpt-4o-deployment` |

**Capabilities:** Enterprise-grade AI, compliance features

### Usage Locations:
- `server/services/aiProviders/registry.ts` - Provider registration
- `server/services/aiProviders/azureOpenAI.provider.ts` - Azure provider
- `server/services/langchain/chainOrchestrator.ts` - LangChain integration
- `server/services/embeddingService.ts` - Embeddings
- `server/services/core/pgVectorStore.ts` - Vector store

---

## 3. Azure Services

### Azure Document Intelligence (Form Recognizer)
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Document Intelligence endpoint | Optional | None | `https://your-resource.cognitiveservices.azure.com` |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | Document Intelligence API key | Optional | None | `abc123...` |

**Features Enabled:** OCR, document analysis, invoice processing

### Azure Key Vault
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `AZURE_KEYVAULT_URL` | Key Vault URL | Optional | None | `https://your-vault.vault.azure.net` |
| `AZURE_KEYVAULT_SECRET_NAME` | Secret name for encryption key | Optional | `luca-encryption-key` | `my-encryption-key` |
| `AZURE_CLIENT_ID` | Azure AD client ID | Optional | None | `00000000-0000-0000-0000-000000000000` |
| `AZURE_TENANT_ID` | Azure AD tenant ID | Optional | None | `00000000-0000-0000-0000-000000000000` |

### Usage Locations:
- `server/services/aiProviders/registry.ts` - Document intelligence registration
- `server/routes/health.ts` - Health checks
- `server/services/keyVaultService.ts` - Key management

---

## 4. Database & Cache

### PostgreSQL
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `DATABASE_URL` | Full PostgreSQL connection string | ✅ Yes | None | `postgresql://user:pass@localhost:5432/luca` |

### Redis
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `REDIS_URL` | Redis connection URL | Optional | `redis://localhost:6379` | `redis://user:pass@host:6379` |

**Features Enabled:** Rate limiting, caching, job queues

### Supabase (Alternative)
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `SUPABASE_URL` | Supabase project URL | Optional | None | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Optional | None | `eyJhbG...` |

### Usage Locations:
- `server/db.ts` - Database pool
- `server/utils/redisClient.ts` - Redis client
- `server/services/jobQueue.ts` - Bull job queues
- `server/services/cache/multiLayerCache.ts` - Multi-layer caching
- `server/supabase.ts` - Supabase client

---

## 5. Payment Integrations

### Razorpay
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `RAZORPAY_KEY_ID` | Razorpay key ID | Optional | None | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret | Optional | None | `abc123...` |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature secret | Optional | None | `whsec_...` |

### Cashfree
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `CASHFREE_APP_ID` | Cashfree app ID | Optional | None | `your_app_id` |
| `CASHFREE_SECRET_KEY` | Cashfree secret key | Optional | None | `your_secret_key` |

**Features Enabled:** Subscription management, payment processing

### Usage Locations:
- `server/services/subscriptionService.ts` - Razorpay integration
- `server/services/cashfreeService.ts` - Cashfree integration
- `server/routes.ts` - Payment endpoints

---

## 6. OAuth & Social Login

### Google OAuth
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Optional | None | `xxxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Optional | None | `GOCSPX-...` |

**Features Enabled:** Google social login

### Usage Locations:
- `server/config/featureFlags.ts` - Feature toggle
- `server/utils/envValidator.ts` - Validation

---

## 7. Accounting Integrations

### QuickBooks
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `QUICKBOOKS_CLIENT_ID` | QuickBooks OAuth client ID | Optional | `DEMO_QB_CLIENT_ID` | `ABc...` |
| `QUICKBOOKS_CLIENT_SECRET` | QuickBooks OAuth client secret | Optional | `DEMO_QB_SECRET` | `xyz...` |
| `QUICKBOOKS_ENV` | Environment (sandbox/production) | Optional | `sandbox` | `production` |

### Xero
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `XERO_CLIENT_ID` | Xero OAuth client ID | Optional | `DEMO_XERO_CLIENT_ID` | `ABC...` |
| `XERO_CLIENT_SECRET` | Xero OAuth client secret | Optional | `DEMO_XERO_SECRET` | `xyz...` |

### Zoho Books
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `ZOHO_CLIENT_ID` | Zoho OAuth client ID | Optional | `DEMO_ZOHO_CLIENT_ID` | `1000.ABC...` |
| `ZOHO_CLIENT_SECRET` | Zoho OAuth client secret | Optional | `DEMO_ZOHO_SECRET` | `abc...` |
| `ZOHO_DATA_CENTER` | Zoho data center location | Optional | `com` | `in` / `eu` / `com` |

### ADP (Payroll)
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `ADP_CLIENT_ID` | ADP OAuth client ID | Optional | `demo-adp-client-id` | `abc123...` |
| `ADP_CLIENT_SECRET` | ADP OAuth client secret | Optional | `demo-adp-client-secret` | `xyz789...` |

### Usage Locations:
- `server/routes.ts` - OAuth callback endpoints
- `server/services/accountingIntegrations.ts` - Integration service

---

## 8. Security & Encryption

### Encryption Keys
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `ENCRYPTION_KEY` | AES-256 encryption key (64 hex chars) | Optional | Auto-generated | `a1b2c3d4...` (64 chars) |
| `KEY_VAULT_PROVIDER` | Key vault provider type | Optional | `env` | `env` / `aws-kms` / `azure-keyvault` / `hashicorp-vault` |

### HashiCorp Vault
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `VAULT_ADDR` | Vault server address | Optional | None | `https://vault.example.com:8200` |
| `VAULT_TOKEN` | Vault authentication token | Optional | None | `hvs.xxx...` |
| `VAULT_SECRET_PATH` | Path to encryption key secret | Optional | `secret/data/luca/encryption-key` | `secret/data/myapp/key` |
| `VAULT_NAMESPACE` | Vault namespace (Enterprise) | Optional | None | `admin` |

### Super Admin Access
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `SUPER_ADMIN_EMAILS` | Comma-separated super admin emails | Optional | None | `admin@example.com,owner@example.com` |

### Usage Locations:
- `server/utils/encryption.ts` - Field encryption
- `server/utils/fileEncryption.ts` - File encryption
- `server/services/keyVaultService.ts` - Key management
- `server/middleware/superAdmin.ts` - Admin access control

---

## 9. AWS Services

### AWS Credentials
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key | Optional | None | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Optional | None | `wJal...` |
| `AWS_REGION` | AWS region | Optional | `us-east-1` | `ap-south-1` |

### S3 Storage
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `AWS_S3_BUCKET` | S3 bucket name for file storage | Optional | None | `luca-uploads` |

### KMS (Key Management)
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `AWS_KMS_KEY_ID` | KMS key ID for encryption | Optional | None | `arn:aws:kms:...` |
| `AWS_ENCRYPTED_KEY` | KMS-encrypted key (base64) | Optional | None | `AQICAHg...` |

### Virus Scanning (AWS)
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `AWS_VIRUS_SCAN_BUCKET` | S3 bucket for virus scan quarantine | Optional | None | `luca-quarantine` |

### Usage Locations:
- `server/services/keyVaultService.ts` - AWS KMS integration
- `server/services/virusScanService.ts` - AWS-based scanning
- `server/utils/envValidator.ts` - Storage validation

---

## 10. Monitoring & Logging

### Sentry (Error Tracking)
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `SENTRY_DSN` | Sentry data source name | Optional | None | `https://xxx@xxx.ingest.sentry.io/xxx` |
| `RELEASE_VERSION` | Release/version identifier | Optional | `dev` | `1.0.0` |

### LangChain Tracing
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `LANGCHAIN_API_KEY` | LangSmith API key | Optional | None | `ls__...` |
| `LANGCHAIN_TRACING_V2` | Enable tracing | Auto-set | `true` when API key present | `true` |
| `LANGCHAIN_PROJECT` | LangSmith project name | Auto-set | `lucaagent` | `lucaagent` |

### Logging
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `LOG_LEVEL` | Log level | Optional | `debug` (dev) / `info` (prod) | `debug` / `info` / `warn` / `error` |
| `DEBUG` | Enable debug mode | Optional | `false` | `true` |

### Usage Locations:
- `server/services/sentry.ts` - Error tracking
- `server/services/langchain/chainOrchestrator.ts` - LangChain tracing
- `server/services/logger.ts` - Logging configuration

---

## 11. Feature Flags

Enable/disable specific features.

| Variable | Description | Default | Values |
|----------|-------------|---------|--------|
| `ENABLE_DEEP_RESEARCH` | Enable deep research mode | `false` | `true` / `false` |
| `ENABLE_EXPERT_ROUNDTABLE` | Enable multi-expert discussions | `false` | `true` / `false` |
| `ENABLE_KNOWLEDGE_GRAPH` | Enable knowledge graph features | `false` | `true` / `false` |
| `ENABLE_EXPERIMENTAL_AGENTS` | Enable experimental AI agents | `false` | `true` / `false` |
| `ENABLE_COT_REASONING` | Enable chain-of-thought reasoning | `true` | `true` / `false` |
| `ENABLE_MULTI_AGENT` | Enable multi-agent coordination | `false` | `true` / `false` |
| `ENABLE_COMPLIANCE_MONITORING` | Enable compliance monitoring | `false` | `true` / `false` |
| `ENABLE_VALIDATION_AGENT` | Enable response validation | `false` | `true` / `false` |
| `ENABLE_PARALLEL_REASONING` | Enable parallel reasoning | `false` | `true` / `false` |

### Usage Locations:
- `server/config/featureFlags.ts` - Feature flag configuration
- `server/services/reasoningGovernor.ts` - AI reasoning features
- `server/services/aiOrchestrator.ts` - Orchestration features

---

## 12. Server Configuration

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `PORT` | Server port | Optional | `5000` | `3000` |
| `NODE_ENV` | Node environment | Optional | `development` | `production` / `development` |
| `APP_URL` | Application base URL | Optional | Auto-detected | `https://luca.example.com` |
| `REPLIT_DEV_DOMAIN` | Replit development domain | Optional | None | `xxxxx.repl.co` |

### Usage Locations:
- `server/index.ts` - Server startup
- `server/services/cashfreeService.ts` - Webhook URLs
- `server/routes.ts` - OAuth redirect URLs
- `server/middleware/security.ts` - Security policies

---

## 13. External Services

### Virus Scanning
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `VIRUS_SCAN_PROVIDER` | Virus scan provider | Optional | `clamav` | `clamav` / `virustotal` / `aws` |
| `VIRUS_SCAN_INTERVAL` | Scan interval (minutes) | Optional | `15` | `30` |
| `VIRUSTOTAL_API_KEY` | VirusTotal API key | Optional | None | `abc123...` |
| `QUARANTINE_DIR` | Quarantine directory path | Optional | `./quarantine` | `/var/quarantine` |

### GoDaddy DNS
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `GODADDY_API_KEY` | GoDaddy API key | Optional | None | `abc123...` |
| `GODADDY_API_SECRET` | GoDaddy API secret | Optional | None | `xyz789...` |

### HuggingFace (Optional)
| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `HUGGINGFACE_TOKEN` | HuggingFace API token | Optional | `hf_free_tier` | `hf_...` |

### Usage Locations:
- `server/services/virusScanService.ts` - Virus scanning
- `server/services/godaddyDNS.ts` - DNS management
- `server/index.ts` - Scan interval configuration

---

## 14. Sample .env File

```bash
# ============================================
# LUCA AGENT - Environment Variables
# ============================================

# ---- CRITICAL (Required) ----
DATABASE_URL=postgresql://postgres:password@localhost:5432/luca_db
SESSION_SECRET=your-super-secret-session-key-minimum-32-characters

# ---- AI Providers (At least one required) ----
OPENAI_API_KEY=sk-your-openai-api-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_AI_API_KEY=AIza-your-google-key
PERPLEXITY_API_KEY=pplx-your-perplexity-key

# ---- Azure OpenAI (Optional - Enterprise) ----
# AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
# AZURE_OPENAI_API_KEY=your-azure-openai-key
# AZURE_OPENAI_DEPLOYMENT=gpt-4o

# ---- Azure Document Intelligence (Optional) ----
# AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com
# AZURE_DOCUMENT_INTELLIGENCE_KEY=your-document-intelligence-key

# ---- Redis (Recommended for Production) ----
# REDIS_URL=redis://localhost:6379

# ---- Payments (Optional) ----
# RAZORPAY_KEY_ID=rzp_test_xxxxx
# RAZORPAY_KEY_SECRET=your-razorpay-secret
# RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# CASHFREE_APP_ID=your-cashfree-app-id
# CASHFREE_SECRET_KEY=your-cashfree-secret

# ---- Google OAuth (Optional) ----
# GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# ---- Accounting Integrations (Optional) ----
# QUICKBOOKS_CLIENT_ID=ABxxxxxxxx
# QUICKBOOKS_CLIENT_SECRET=xxxxxx
# QUICKBOOKS_ENV=sandbox

# XERO_CLIENT_ID=xxxxxxxx
# XERO_CLIENT_SECRET=xxxxxxxx

# ZOHO_CLIENT_ID=1000.xxxxxxxx
# ZOHO_CLIENT_SECRET=xxxxxxxx
# ZOHO_DATA_CENTER=com

# ---- Security (Optional) ----
# ENCRYPTION_KEY=your-64-character-hex-encryption-key
# SUPER_ADMIN_EMAILS=admin@example.com,owner@example.com

# ---- AWS Services (Optional) ----
# AWS_ACCESS_KEY_ID=AKIA...
# AWS_SECRET_ACCESS_KEY=wJal...
# AWS_REGION=us-east-1
# AWS_S3_BUCKET=luca-uploads

# ---- Monitoring (Optional) ----
# SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
# LANGCHAIN_API_KEY=ls__xxxxx
# LOG_LEVEL=info

# ---- Feature Flags (Optional) ----
# ENABLE_DEEP_RESEARCH=false
# ENABLE_EXPERT_ROUNDTABLE=false
# ENABLE_KNOWLEDGE_GRAPH=false
# ENABLE_EXPERIMENTAL_AGENTS=false

# ---- Server Configuration ----
PORT=5000
NODE_ENV=development
# APP_URL=https://luca.example.com
```

---

## Quick Reference Table

### By Feature

| Feature | Required Variables |
|---------|-------------------|
| **Basic Startup** | `DATABASE_URL`, `SESSION_SECRET` |
| **AI Chat** | At least one of: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY` |
| **Document Analysis** | `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `AZURE_DOCUMENT_INTELLIGENCE_KEY` |
| **Payments** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` OR `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` |
| **Social Login** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Cloud Storage** | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` |
| **Rate Limiting (Production)** | `REDIS_URL` |
| **Error Tracking** | `SENTRY_DSN` |

### By Priority

| Priority | Variables |
|----------|-----------|
| 🔴 **Critical** | `DATABASE_URL`, `SESSION_SECRET` |
| 🟠 **High** | AI Provider keys (one required) |
| 🟡 **Medium** | `REDIS_URL`, `ENCRYPTION_KEY` |
| 🟢 **Optional** | All other variables |

---

## Validation

The application validates environment variables at startup using `server/utils/envValidator.ts`:

```bash
# Check configured variables
npm run dev

# Output includes:
# [Environment] ⚠️ Configuration warnings:
#   - Document analysis disabled - Azure Document Intelligence not configured
#   - Using in-memory rate limiting - Redis not configured
```

---

## Total Variables: 70+

| Category | Count |
|----------|-------|
| Critical | 2 |
| AI Providers | 10 |
| Azure Services | 8 |
| Database & Cache | 4 |
| Payments | 5 |
| OAuth | 2 |
| Accounting | 9 |
| Security | 8 |
| AWS | 6 |
| Monitoring | 5 |
| Feature Flags | 9 |
| Server Config | 4 |
| External Services | 6 |

---

*Document generated on: December 28, 2025*
*ICAI CAGPT Version: 1.0.0*
