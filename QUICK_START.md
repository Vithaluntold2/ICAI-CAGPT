# 🚀 Quick Start Guide - Local Development

## ✅ Setup Complete - Ready for Development

All Railway services are connected and verified. You can now start local development.

---

## 🎯 Start Development Server

### Recommended: Use Railway Environment Directly
```bash
railway run npm run dev
```
This runs with all Railway variables automatically loaded.

### Alternative: Use Local .env File
```bash
npm run dev:local
```
This uses `.env.local` with external Railway proxy endpoints.

**Server will start at**: http://localhost:5000

---

## 🔍 Verify Connections

### Test All Railway Services
```bash
npm run test:railway:local
```

Expected output:
```
✅ Passed:   26
❌ Failed:   0
⏱️  Duration: ~7s
```

---

## 🗄️ Database Operations

### View Database Studio (Drizzle)
```bash
npm run db:studio
```

### Connect with psql
```bash
psql "postgresql://postgres:icai_cagpt_2024_secure@mainline.proxy.rlwy.net:10014/icai_cagpt"
```

### Run Migrations (ASK FIRST!)
```bash
# DO NOT RUN without permission
# railway run npm run db:push
```

---

## 🔴 Redis Operations

### Connect with redis-cli
```bash
redis-cli -h mainline.proxy.rlwy.net -p 14275
```

### Test Redis
```bash
redis-cli -h mainline.proxy.rlwy.net -p 14275 PING
# Should return: PONG
```

---

## 📊 Railway CLI Commands

### View Service Logs
```bash
railway logs -f
```

### Check Service Status
```bash
railway status
```

### View Variables
```bash
railway variables
```

### Switch Services
```bash
railway service PostgreSQL  # Database
railway service Redis       # Cache
railway service web        # Web app
```

---

## 🔒 What's LOCKED (Until Activation)

❌ Git commits  
❌ Git push  
❌ Railway deployments  
❌ Production builds  
❌ CI/CD triggers  

**Activation phrase**: "You can now connect and deploy to Railway"

---

## ✅ What's ALLOWED Now

✅ Run local development server  
✅ Make code changes (with approval for critical logic)  
✅ Test locally  
✅ Use Railway PostgreSQL (61 tables)  
✅ Use Railway Redis (4 keys)  
✅ Access all Azure AI services  
✅ Read logs and monitor services  

---

## 🛠️ Development Workflow

### 1. Start Development
```bash
railway run npm run dev
```

### 2. Make Changes
- Edit code in your IDE
- Changes auto-reload (hot reload)

### 3. Test Changes
- Visit http://localhost:5000
- Test features locally

### 4. Check for Errors
```bash
npm run check  # TypeScript check
```

### 5. When Ready (After Activation Only)
```bash
# These are DISABLED for now
# git add .
# git commit -m "description"
# git push
# railway up
```

---

## 📁 Key Files

- `.env.local` - Local development config (external Railway URLs)
- `.env.railway` - Production config (internal Railway URLs)
- `.development-workflow.md` - Full workflow documentation
- `RAILWAY_CONNECTION_GUIDE.md` - Complete Railway reference
- `test-railway-connections.ts` - Connection test suite

---

## 🆘 Troubleshooting

### Can't connect to database
```bash
npm run test:railway:local
```
Should show all services as `[PASS]`.

### Port already in use
```bash
# Find and kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

### Environment variables not loading
```bash
# Verify Railway connection
railway whoami
railway status
```

### Need fresh environment variables
```bash
# Re-fetch from Railway
npm run test:railway:local
```

---

## 🎨 Development Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL 16.13 (Railway)
- **Cache**: Redis 7.4.8 (Railway)
- **AI Services**: Azure OpenAI, Anthropic, Google Gemini
- **Hot Reload**: ✅ Enabled

---

**Status**: 🟢 Ready for Development  
**Mode**: 🔒 Local Only  
**Deployment**: ❌ Locked
