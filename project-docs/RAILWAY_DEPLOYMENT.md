# Railway Deployment Guide for ICAI CAGPT

## 🚀 Quick Start

### 1. Install Railway CLI (Already Done ✅)
```bash
# Railway CLI is installed at: /usr/local/bin/railway
railway --version
```

### 2. Login to Railway
```bash
railway login
```
This will open your browser to authenticate with Railway.

### 3. Initialize Project
```bash
# Link to existing Railway project
railway link

# OR create new project
railway init
```

### 4. Configure Environment Variables
Railway will automatically use your local `.env` file, but you should also set them in Railway dashboard:

```bash
railway variables set DATABASE_URL="your-postgres-url"
railway variables set OPENAI_API_KEY="your-key"
railway variables set AZURE_OPENAI_API_KEY="your-key"
# ... add all other variables
```

Or use the Railway dashboard: https://railway.app/dashboard

### 5. Deploy
```bash
railway up
```

### 6. Get Deployment URL
```bash
railway status
# Or open in browser
railway open
```

---

## 🌐 Custom Domain Setup (GoDaddy + Railway)

### Option A: Automated Setup (Recommended)
Use the programmatic GoDaddy DNS service:

```typescript
import { godaddyDNS } from './server/services/godaddyDNS';

// Get your Railway URL first
// Example: luca-production.up.railway.app

await godaddyDNS.setupRailwaySubdomain(
  'askluca.io',           // Your GoDaddy domain
  'app',                   // Subdomain (creates app.askluca.io)
  'luca-production.up.railway.app'  // Your Railway URL
);
```

### Option B: Manual Setup

1. **Get Railway Domain**
   ```bash
   railway status
   # Note the public URL
   ```

2. **Add CNAME in GoDaddy Dashboard**
   - Go to GoDaddy DNS Management
   - Add CNAME record:
     - Name: `app` (or `www`, `api`, etc.)
     - Value: `your-project.up.railway.app`
     - TTL: 600

3. **Configure Custom Domain in Railway**
   ```bash
   railway domain
   # Enter: app.askluca.io
   ```

   Or in Railway Dashboard:
   - Go to Settings > Networking
   - Add Custom Domain: `app.askluca.io`
   - Railway will provision SSL certificate automatically

---

## 📊 Railway Commands Cheat Sheet

### Deployment
```bash
railway up              # Deploy current directory
railway up --detach     # Deploy without streaming logs
railway redeploy        # Redeploy last deployment
```

### Monitoring
```bash
railway logs            # Stream logs
railway logs --follow   # Follow logs continuously
railway status          # Check deployment status
```

### Environment Variables
```bash
railway variables                    # List all variables
railway variables set KEY=VALUE      # Set variable
railway variables delete KEY         # Delete variable
```

### Database
```bash
railway run psql           # Connect to PostgreSQL
railway db                 # Database management
```

### Domains
```bash
railway domain             # Manage custom domains
railway open               # Open deployment in browser
```

---

## 🔐 Environment Variables for Railway

Required variables (already in `.env`):

```bash
# Database
DATABASE_URL=postgresql://...

# AI Providers
OPENAI_API_KEY=sk-...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
GOOGLE_AI_API_KEY=...

# Azure Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=...
AZURE_DOCUMENT_INTELLIGENCE_KEY=...

# Redis
REDIS_URL=redis://...

# GoDaddy (for DNS automation)
GODADDY_API_KEY=...
GODADDY_API_SECRET=...

# Session Security
SESSION_SECRET=...
ENCRYPTION_KEY=...

# Production Settings
NODE_ENV=production
PORT=3000
```

---

## 🎯 Available Domains from GoDaddy

Your active domains that can be used:
- ✅ **askluca.io** (Primary - Expires 2026-04-07)
- ✅ accademy.in (Expires 2027-09-30)
- ✅ audric.io (Expires 2026-06-25)
- ✅ clozit.io (Expires 2026-12-20)
- ✅ cyloid.io (Expires 2026-12-10)
- ✅ ep-iq.io (Expires 2026-12-20)

- ✅ finaid.io (Expires 2026-09-22)
- ✅ finaidhub.io (Expires 2026-03-27)
- ✅ mycabinet.ai (Expires 2026-05-19)

---

## 🔧 Troubleshooting

### Build Fails
```bash
# Check build logs
railway logs --build

# Test build locally
npm run build
```

### Domain Not Working
1. Check CNAME propagation:
   ```bash
   dig app.askluca.io
   ```
2. Verify Railway custom domain is added
3. Wait for DNS propagation (up to 24 hours, usually 5-10 minutes)

### Environment Variables Missing
```bash
# List all variables
railway variables

# Copy from local .env
railway variables set $(cat .env | grep -v '^#' | xargs)
```

---

## 📝 Example Deployment Workflow

```bash
# 1. Make changes locally
git add .
git commit -m "feat: add new feature"

# 2. Test locally
npm run dev

# 3. Deploy to Railway
railway up

# 4. Monitor deployment
railway logs --follow

# 5. Check status
railway status

# 6. Open in browser
railway open

# 7. Setup custom domain (if first time)
railway domain
# Enter: app.askluca.io

# 8. Configure DNS (automated)
npx tsx -e "
import { godaddyDNS } from './server/services/godaddyDNS';
await godaddyDNS.setupRailwaySubdomain('askluca.io', 'app', 'YOUR_RAILWAY_URL');
"
```

---

## 🎉 Post-Deployment Checklist

- [ ] Deployment successful (`railway status`)
- [ ] Application accessible at Railway URL
- [ ] Custom domain configured in Railway
- [ ] DNS CNAME record added in GoDaddy
- [ ] SSL certificate provisioned (automatic)
- [ ] Environment variables set
- [ ] Database connected
- [ ] Redis cache connected
- [ ] AI providers working
- [ ] Document upload/analysis working
- [ ] WebSocket connections working

---

## 🔗 Useful Links

- **Railway Dashboard**: https://railway.app/dashboard
- **GoDaddy DNS Management**: https://dcc.godaddy.com/manage/dns
- **Railway Docs**: https://docs.railway.app
- **GoDaddy API Docs**: https://developer.godaddy.com

---

## 💡 Pro Tips

1. **Use Railway for staging & production**
   ```bash
   railway environment # Switch environments
   ```

2. **Database backups**
   Railway automatically backs up PostgreSQL

3. **Monitor costs**
   Check Railway dashboard for usage metrics

4. **Scale horizontally**
   Railway supports horizontal scaling for increased traffic

5. **CI/CD Integration**
   Connect GitHub for automatic deployments on push
