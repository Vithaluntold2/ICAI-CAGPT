# Railway Services Connection Guide
**ICAI-CAGPT Production Environment**

## 📋 Overview

This document provides connection details for all Railway services in the ICAI-CAGPT project.

### Project Information
- **Project Name**: ICAI-CAGPT
- **Project ID**: `74bf1b14-0160-4853-ae52-1a9d708ef2ce`
- **Environment**: production
- **Public URL**: https://ca-gpt.up.railway.app

---

## 🗄️ PostgreSQL Database

### Service Details
- **Service Name**: PostgreSQL
- **Service ID**: `40e312cf-5ce9-4557-8dff-21a67260931e`
- **Internal Domain**: `postgresql.railway.internal`
- **Port**: 5432

### Connection Information

**Internal Connection (from Railway services):**
```
postgresql://postgres:icai_cagpt_2024_secure@PostgreSQL.railway.internal:5432/icai_cagpt
```

**External Connection (from local/external):**
```
Host: mainline.proxy.rlwy.net
Port: 10014
User: postgres
Password: icai_cagpt_2024_secure
Database: icai_cagpt
```

**psql command:**
```bash
psql "postgresql://postgres:icai_cagpt_2024_secure@mainline.proxy.rlwy.net:10014/icai_cagpt"
```

### Environment Variables
```env
DATABASE_URL=postgresql://postgres:icai_cagpt_2024_secure@PostgreSQL.railway.internal:5432/icai_cagpt
POSTGRES_USER=postgres
POSTGRES_PASSWORD=icai_cagpt_2024_secure
POSTGRES_DB=icai_cagpt
DB_SSL=false
```

---

## 🔴 Redis Cache

### Service Details
- **Service Name**: Redis
- **Service ID**: `8ac0df85-aba7-42e8-8942-751f8b56e33b`
- **Internal Domain**: `redis.railway.internal`
- **Port**: 6379

### Connection Information

**Internal Connection (from Railway services):**
```
redis://Redis.railway.internal:6379
```

**External Connection (from local/external):**
```
Host: mainline.proxy.rlwy.net
Port: 14275
```

**redis-cli command:**
```bash
redis-cli -h mainline.proxy.rlwy.net -p 14275
```

### Environment Variables
```env
REDIS_URL=redis://Redis.railway.internal:6379
```

---

## 🌐 Web Service

### Service Details
- **Service Name**: web
- **Service ID**: `c8039701-316e-46fc-a596-aa78256d90e0`
- **Internal Domain**: `web.railway.internal`
- **Public Domain**: `ca-gpt.up.railway.app`

### Environment Variables
```env
PORT=5000
NODE_ENV=production
BASE_URL=https://ca-gpt.up.railway.app
RAILWAY_PUBLIC_DOMAIN=ca-gpt.up.railway.app
RAILWAY_STATIC_URL=ca-gpt.up.railway.app
```

---

## 🔑 AI Services Configuration

### Azure OpenAI (Primary)
```env
AZURE_OPENAI_ENDPOINT=https://finac-mkkjixif-eastus2.services.ai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-5.2-chat
AZURE_OPENAI_API_VERSION=2024-12-01-preview
```

### Azure OpenAI (Fallback)
```env
AZURE_OPENAI_FALLBACK_ENDPOINT=https://finac-mkkjixif-eastus2.services.ai.azure.com/
AZURE_OPENAI_FALLBACK_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_FALLBACK_API_VERSION=2024-02-15-preview
```

### Azure Embeddings
```env
AZURE_EMBEDDING_ENDPOINT=https://finaceverse5.openai.azure.com/
AZURE_EMBEDDING_DEPLOYMENT=text-embedding-3-large
```

### Azure Document Intelligence
```env
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://raicentral.cognitiveservices.azure.com/
```

### Azure Cognitive Search
```env
AZURE_SEARCH_ENDPOINT=https://raicentral.search.windows.net
AZURE_SEARCH_INDEX_NAME=financial-docs-index
```

---

## 🔐 Security & Authentication

### Encryption Keys
```env
ENCRYPTION_KEY=44277bb7444483d64420645d4900e56ecce9cf950869e0b8b421094fac3b287b
SESSION_SECRET=3604b6b9d6a25a31a8988b7668e38bfe025294961aef9aa8e161e2c35d74e6d4
```

### Microsoft Graph / SSO
```env
MICROSOFT_CLIENT_ID=217f8431342fea43
MICROSOFT_TENANT_ID=27177bb6f7fa9f25
MS_GRAPH_CLIENT_ID=217f8431342fea43
MS_GRAPH_TENANT_ID=27177bb6f7fa9f25
```

---

## 🛠️ Connection Testing

### Test All Services
```bash
npm run test:railway
```

This will:
- ✅ Verify all environment variables
- ✅ Test PostgreSQL connection and list tables
- ✅ Test Redis connection and perform write/read
- ✅ Validate Azure service configurations
- ✅ Generate detailed test report

### Manual Testing

**Test PostgreSQL:**
```bash
npx tsx -e "
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()').then(r => console.log(r.rows)).finally(() => pool.end());
"
```

**Test Redis:**
```bash
npx tsx -e "
import { createClient } from 'redis';
const client = createClient({ url: process.env.REDIS_URL });
client.connect().then(() => client.ping()).then(console.log).finally(() => client.disconnect());
"
```

---

## 📦 Railway CLI Commands

### Switch Services
```bash
railway service PostgreSQL  # Switch to database
railway service Redis       # Switch to Redis
railway service web        # Switch to web service
```

### View Variables
```bash
railway variables           # Show current service variables
```

### View Logs
```bash
railway logs                # View current service logs
railway logs -f             # Follow logs in real-time
```

### Deploy
```bash
railway up                  # Deploy current service
```

### Link Project
```bash
railway link                # Link to Railway project
```

---

## 🔄 Local Development Setup

1. **Copy Railway environment to local:**
   ```bash
   cp .env.railway .env
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Test connections:**
   ```bash
   npm run test:railway
   ```

4. **Run migrations:**
   ```bash
   npm run db:push
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

---

## 📊 Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│          Public Internet                                │
│          ca-gpt.up.railway.app                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │   Web Service   │
            │   (Node.js)     │
            │   Port: 5000    │
            └────────┬────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
    ┌──────────┐         ┌──────────┐
    │PostgreSQL│         │  Redis   │
    │Port: 5432│         │Port: 6379│
    └──────────┘         └──────────┘
```

---

## 🚨 Troubleshooting

### Can't connect to PostgreSQL
1. Check service is running: `railway status`
2. Verify DATABASE_URL is set correctly
3. Test with: `railway run psql $DATABASE_URL`

### Can't connect to Redis
1. Check service is running: `railway status`
2. Verify REDIS_URL is set correctly
3. Test with: `railway run redis-cli -u $REDIS_URL ping`

### Environment variables not loading
1. Ensure you're using correct service: `railway service`
2. Pull latest variables: `railway variables`
3. Check .env.railway file exists

---

## 📝 Notes

- **Internal domains** (*.railway.internal) only work between Railway services
- **Proxy ports** (10014, 14275) are for external connections
- All services are in the **production** environment
- Database has persistent volume mounted at `/var/lib/postgresql/data`
- Redis data is ephemeral (no persistent volume)

---

**Last Updated**: April 14, 2026
**Generated by**: Railway CLI Connection Script
