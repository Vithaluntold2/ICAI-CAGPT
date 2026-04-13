# ICAI CAGPT - Setup, Configuration & Deployment Guide
## Complete Installation and Production Deployment

**Document Version**: 1.0  
**Last Updated**: December 23, 2025  
**Consolidated from**: SETUP.md, CONFIGURATION_GUIDE.md, REDIS_SETUP_GUIDE.md, OAUTH_SETUP_GUIDE.md, SUPABASE_MIGRATION.md, PRODUCTION_OPTIMIZATION_GUIDE.md

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Quick Start](#2-quick-start)
3. [Environment Variables](#3-environment-variables)
4. [Database Setup (Supabase)](#4-database-setup-supabase)
5. [Redis Configuration](#5-redis-configuration)
6. [AI Provider Configuration](#6-ai-provider-configuration)
7. [OAuth Integration Setup](#7-oauth-integration-setup)
8. [Production Optimization](#8-production-optimization)
9. [Deployment Options](#9-deployment-options)
10. [Monitoring & Health Checks](#10-monitoring--health-checks)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

### System Requirements
- **Node.js**: 18+ (LTS recommended)
- **npm**: 8+ or pnpm
- **PostgreSQL**: 14+ (via Supabase or self-hosted)
- **Redis**: 6+ (for caching/queues)

### Required Accounts
- **Supabase** - Database hosting (free tier available)
- **OpenAI** - Primary AI provider
- **Azure** - Document Intelligence + OpenAI

### Optional Accounts
- **Redis Cloud** - Managed Redis (free 30MB tier)
- **Anthropic** - Claude API
- **Google AI** - Gemini API
- **QuickBooks/Xero/Zoho** - Accounting integrations

---

## 2. Quick Start

### Step 1: Clone & Install

```bash
cd "/Users/apple/Downloads/20 NOV 2025/ICAI CAGPT"
npm install
```

### Step 2: Create Environment File

```bash
cp .env.example .env
# Edit .env with your values
```

### Step 3: Database Setup

```bash
npm run db:push
```

### Step 4: Start Development Server

```bash
npm run dev
```

Application runs at: `http://localhost:5000`

---

## 3. Environment Variables

### Complete Environment Template

```env
# ═══════════════════════════════════════════════════════════════
# SECURITY (Required)
# ═══════════════════════════════════════════════════════════════
SESSION_SECRET=your-64-char-random-string
ENCRYPTION_KEY=your-32-byte-hex-key

# ═══════════════════════════════════════════════════════════════
# DATABASE (Required)
# ═══════════════════════════════════════════════════════════════
DATABASE_URL=postgresql://postgres:[password]@[project-ref].supabase.co:5432/postgres
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=your-anon-key

# ═══════════════════════════════════════════════════════════════
# AI PROVIDERS (At least one required)
# ═══════════════════════════════════════════════════════════════

# OpenAI (Primary)
OPENAI_API_KEY=sk-...

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Azure Document Intelligence (OCR)
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your-key

# Google AI (Gemini)
GOOGLE_AI_API_KEY=AIza...

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Perplexity (Research)
PERPLEXITY_API_KEY=pplx-...

# ═══════════════════════════════════════════════════════════════
# CACHING & QUEUES (Production)
# ═══════════════════════════════════════════════════════════════
REDIS_URL=redis://localhost:6379
# For Redis Cloud:
# REDIS_URL=redis://default:password@host:port

# ═══════════════════════════════════════════════════════════════
# OAUTH INTEGRATIONS (Optional)
# ═══════════════════════════════════════════════════════════════

# QuickBooks
QUICKBOOKS_CLIENT_ID=your-client-id
QUICKBOOKS_CLIENT_SECRET=your-client-secret
QUICKBOOKS_ENV=sandbox

# Xero
XERO_CLIENT_ID=your-client-id
XERO_CLIENT_SECRET=your-client-secret

# Zoho Books
ZOHO_CLIENT_ID=your-client-id
ZOHO_CLIENT_SECRET=your-client-secret
ZOHO_DATA_CENTER=com

# ═══════════════════════════════════════════════════════════════
# PAYMENTS (Production)
# ═══════════════════════════════════════════════════════════════
CASHFREE_APP_ID=your-app-id
CASHFREE_SECRET_KEY=your-secret
CASHFREE_ENV=sandbox

# ═══════════════════════════════════════════════════════════════
# APPLICATION
# ═══════════════════════════════════════════════════════════════
NODE_ENV=development
PORT=5000
```

### Generating Secure Keys

```bash
# Generate SESSION_SECRET (64 chars base64)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# Generate ENCRYPTION_KEY (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Database Setup (Supabase)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and region
4. Set a strong database password
5. Wait for project provisioning (~2 minutes)

### Step 2: Get Connection Details

1. Navigate to **Settings → Database**
2. Copy the **Connection String** (URI format)
3. Replace `[YOUR-PASSWORD]` with your actual password

### Step 3: Configure Application

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

### Step 4: Run Migrations

```bash
npm run db:push
```

### Database Connection Details

- **Driver**: `postgres` (node-postgres)
- **ORM**: Drizzle ORM with full TypeScript support
- **Pooling**: 10 connections max
- **Schema**: 30 tables (see Technical Architecture doc)

### New Indexes Created

| Index | Purpose |
|-------|---------|
| `conversations_metadata_idx` | Fast metadata JSONB search |
| `conversations_user_created_idx` | Pagination by creation |
| `messages_conversation_created_idx` | Message history |
| `messages_role_created_idx` | Analytics queries |

---

## 5. Redis Configuration

### Option A: Redis Cloud (Recommended for Production)

**Free Tier**: 30MB - Sufficient for 10,000+ users

1. Sign up at [redis.io/cloud](https://redis.io/cloud/)
2. Create a free database
3. Copy the connection URL

```env
REDIS_URL=redis://default:password@host:port
```

### Option B: Local Redis (Development)

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

**Verify Connection:**
```bash
redis-cli ping
# Should return: PONG
```

### Option C: Managed Redis

| Service | Free Tier | Paid |
|---------|-----------|------|
| Redis Cloud | 30MB | $5/mo (250MB) |
| Render Redis | 25MB | $7/mo (1GB) |
| Railway Redis | 512MB | $5/mo (1GB) |
| AWS ElastiCache | 750hrs/mo (1yr) | $13/mo |
| Heroku Redis | 25MB | $15/mo |

---

## 6. AI Provider Configuration

### 6.1 Model Routing Architecture

The system automatically routes queries to optimal providers:

| Domain | Free/Pro Tier | Enterprise | Solvers |
|--------|--------------|------------|---------|
| **Tax** | gpt-4o | luca-tax-expert | tax-calculator |
| **Audit** | gpt-4o | luca-audit-expert | materiality-calc |
| **Financial Reporting** | gpt-4o | gpt-4o | standards-lookup |
| **Compliance** | gpt-4o | gpt-4o | regulatory-check |
| **General** | gpt-4o | gpt-4o | financial-calc |

### 6.2 Provider-Specific Setup

#### OpenAI

```env
OPENAI_API_KEY=sk-...
```

**Models Used:**
- `gpt-4o` - Primary model
- `gpt-4o-mini` - Fallback

#### Azure OpenAI

```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

#### Google Gemini

```env
GOOGLE_AI_API_KEY=AIza...
```

**Models Used:**
- `gemini-1.5-pro` - Primary
- `gemini-1.5-flash` - Fast operations

#### Anthropic Claude

```env
ANTHROPIC_API_KEY=sk-ant-...
```

**Models Used:**
- `claude-3-5-sonnet-20241022` - Primary
- `claude-3-haiku-20240307` - Fast operations

### 6.3 Fine-Tuned Model Configuration

When you create fine-tuned models, update the model mapping:

```typescript
// server/services/aiOrchestrator.ts (line ~188)
const modelMap: Record<string, string> = {
  'luca-tax-expert': 'ft:gpt-4o-2024-08-06:your-org::model-id',
  'luca-audit-expert': 'ft:gpt-4o-2024-08-06:your-org::model-id',
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini'
};
```

### 6.4 Fine-Tuning Guide

**Training Data Format (JSONL):**
```jsonl
{"messages": [{"role": "system", "content": "You are a tax expert..."}, {"role": "user", "content": "Question"}, {"role": "assistant", "content": "Expert answer with citations"}]}
```

**Recommended Dataset Sizes:**
- Minimum: 500 examples
- Optimal: 2,000-5,000 examples
- Coverage: Include edge cases

**Fine-Tuning Commands:**
```python
# Upload training data
file = client.files.create(
  file=open("training_data.jsonl", "rb"),
  purpose="fine-tune"
)

# Create fine-tuning job
job = client.fine_tuning.jobs.create(
  training_file=file.id,
  model="gpt-4o-2024-08-06",
  suffix="luca-tax-expert"
)
```

---

## 7. OAuth Integration Setup

### 7.1 QuickBooks

1. Create app at [developer.intuit.com](https://developer.intuit.com/)
2. Select "QuickBooks Online API"
3. Set Redirect URI: `https://YOUR-DOMAIN/api/integrations/callback`

```env
QUICKBOOKS_CLIENT_ID=your-client-id
QUICKBOOKS_CLIENT_SECRET=your-client-secret
QUICKBOOKS_ENV=sandbox  # or "production"
```

### 7.2 Xero

1. Create app at [developer.xero.com](https://developer.xero.com/app/manage)
2. Set Redirect URI: `https://YOUR-DOMAIN/api/integrations/callback`

```env
XERO_CLIENT_ID=your-client-id
XERO_CLIENT_SECRET=your-client-secret
```

### 7.3 Zoho Books

1. Create app at [api-console.zoho.com](https://api-console.zoho.com/)
2. Select "Server-based Applications"
3. Set Redirect URI: `https://YOUR-DOMAIN/api/integrations/callback`

```env
ZOHO_CLIENT_ID=your-client-id
ZOHO_CLIENT_SECRET=your-client-secret
ZOHO_DATA_CENTER=com  # or "eu", "in", "au"
```

### 7.4 Security Features

- ✅ **AES-256-GCM** - Token encryption at rest
- ✅ **CSRF Protection** - State parameter validation
- ✅ **Secure Storage** - Never exposed in logs
- ✅ **Auto-Refresh** - Tokens refreshed on expiry

---

## 8. Production Optimization

### 8.1 Features Overview

| Feature | Technology | Purpose |
|---------|------------|---------|
| Background Jobs | Bull + Redis | Async processing |
| Caching | Redis + Memory | Response speed |
| Circuit Breakers | Opossum | Failure protection |
| Rate Limiting | Express middleware | API protection |

### 8.2 Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Response Time | 2,500ms | 800ms | **68% faster** |
| DB Queries/Request | 8-12 | 2-4 | **67% reduction** |
| AI Costs (1M users) | $10,000 | $2,000 | **80% savings** |
| Concurrent Users | ~1,000 | ~10,000 | **10x scale** |

### 8.3 Cache Configuration

```typescript
import CacheService from './services/cache';

// Set with TTL (seconds)
await CacheService.set('key', data, 300);

// Get cached data
const data = await CacheService.get('key');

// Invalidate
await CacheService.del('key');
```

### 8.4 Circuit Breaker Configuration

```typescript
import { getAIProviderBreaker } from './services/circuitBreaker';

const breaker = getAIProviderBreaker('openai');
const result = await breaker.fire(async () => {
  return await aiCall();
});
```

### 8.5 Job Queue Configuration

```typescript
import { titleGenerationQueue } from './services/jobQueue';

await titleGenerationQueue.add({
  conversationId: 'id',
  query: 'user query'
}, { priority: 1 });
```

---

## 9. Deployment Options

### 9.1 Render.com (Recommended)

1. Connect GitHub repository
2. Set environment variables
3. Add Redis from Render marketplace
4. Deploy

**Build Command:** `npm install && npm run build`
**Start Command:** `npm start`

### 9.2 Railway

```bash
railway login
railway init
railway add
railway up
```

### 9.3 Fly.io

```bash
flyctl launch
flyctl secrets set DATABASE_URL=...
flyctl secrets set OPENAI_API_KEY=...
flyctl deploy
```

### 9.4 Vercel + Separate Backend

Frontend only (use with separate Express backend):

```bash
vercel --prod
```

### 9.5 Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

```bash
docker build -t lucaagent .
docker run -p 5000:5000 --env-file .env lucaagent
```

---

## 10. Monitoring & Health Checks

### 10.1 Queue Statistics

```typescript
import { getQueueStats } from './services/jobQueue';

const stats = await getQueueStats();
// {
//   titleGeneration: { waiting: 0, active: 1, completed: 523, failed: 2 },
//   analytics: { waiting: 0, active: 0, completed: 1024, failed: 0 },
//   redis: { status: 'ready', ready: true }
// }
```

### 10.2 Circuit Breaker Stats

```typescript
import { getCircuitBreakerStats } from './services/circuitBreaker';

const stats = getCircuitBreakerStats();
// {
//   database: { state: 'closed', stats: {...} },
//   aiProviders: {
//     'AI-openai': { state: 'closed', stats: {...} },
//     'AI-gemini': { state: 'open', stats: {...} }
//   }
// }
```

### 10.3 Cache Performance

```typescript
import CacheService from './services/cache';

const stats = CacheService.getStats();
// {
//   memory: { hits: 1234, misses: 56, keys: 23 },
//   redis: { status: 'ready', ready: true }
// }
```

### 10.4 Health Check Endpoint

```
GET /api/health
```

```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "uptime": 123456
}
```

---

## 11. Troubleshooting

### Database Connection Issues

```bash
# Test connection
node -e "const { Pool } = require('pg'); const pool = new Pool({connectionString: process.env.DATABASE_URL}); pool.query('SELECT NOW()').then(r => console.log('Connected:', r.rows[0])).finally(() => pool.end())"
```

**Common Fixes:**
- Check DATABASE_URL format
- Verify password encoding (special characters)
- Check Supabase IP allowlist
- Ensure SSL is enabled

### Redis Connection Issues

```bash
# Test connection
redis-cli -u $REDIS_URL ping
```

**Common Fixes:**
- Verify REDIS_URL format
- Check firewall rules (port 6379)
- Ensure Redis is running

### OAuth Callback Errors

| Error | Solution |
|-------|----------|
| "Invalid state parameter" | Session expired - retry connection |
| "OAuth callback error" | Check credentials and redirect URI |
| "Failed to initiate integration" | Verify ENCRYPTION_KEY is set |

### TypeScript Compilation Errors

```bash
# Check for errors
npm run check

# Common fixes
npm install
npm run db:push
```

### Application Not Starting

1. Check all required environment variables
2. Verify database connection
3. Check port availability (5000)
4. Review logs: `npm run dev 2>&1 | tee app.log`

---

## Production Checklist

### Before Launch

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Redis connected and tested
- [ ] AI providers verified
- [ ] OAuth callbacks tested (if used)
- [ ] SSL certificate configured
- [ ] Monitoring dashboards set up
- [ ] Backup strategy in place
- [ ] Rate limiting configured
- [ ] Error tracking enabled

### Rollback Plan

```bash
# 1. Disable optional features
export DISABLE_QUEUES=true
export DISABLE_CACHE=true

# 2. Revert to previous version
git revert HEAD
git push origin main

# 3. Clear Redis if needed
redis-cli FLUSHALL

# 4. Restore database backup
pg_restore -d $DATABASE_URL backup.dump
```

---

## Current Status

✅ **Dependencies**: Installed  
✅ **Database**: Supabase migration complete  
✅ **Environment**: Template ready  
✅ **AI Providers**: Configured  
✅ **Redis**: Optional (graceful fallback)  
✅ **OAuth**: Demo credentials included  

---

*This document consolidates: SETUP.md, CONFIGURATION_GUIDE.md, REDIS_SETUP_GUIDE.md, OAUTH_SETUP_GUIDE.md, SUPABASE_MIGRATION.md, PRODUCTION_OPTIMIZATION_GUIDE.md*
