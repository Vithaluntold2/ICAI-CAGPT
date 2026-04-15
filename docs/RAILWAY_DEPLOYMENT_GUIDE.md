# Railway Deployment Guide for ICAI-CAGPT

## Quick Start

### 1. Install Railway CLI

**macOS/Linux:**
```bash
curl -fsSL https://railway.app/install.sh | sh
```

**via npm:**
```bash
npm install -g @railway/cli
```

**Verify installation:**
```bash
railway --version
```

### 2. Run Automated Setup

```bash
npm run railway:setup
```

This script will:
- ✅ Authenticate with Railway
- ✅ Link to your Railway project
- ✅ Pull all environment variables
- ✅ Create `.env` file with Railway config
- ✅ Test database and Redis connections

### 3. Manual Setup (Alternative)

If you prefer manual setup:

#### Step 1: Login to Railway
```bash
railway login
```

#### Step 2: Link Project
```bash
railway link
```

#### Step 3: Get All Variables
```bash
# List all variables
railway variables

# Save to .env file
railway variables --json > railway-vars.json
```

#### Step 4: Set Environment
```bash
railway environment
# Choose: production, staging, or development
```

---

## Railway Project Setup

### Required Services

Your Railway project should have these services:

1. **PostgreSQL Database**
   - Railway provides managed PostgreSQL
   - Automatically sets `DATABASE_URL`
   - SSL enabled by default

2. **Redis (Optional)**
   - Add Redis from Railway marketplace
   - Automatically sets `REDIS_URL`
   - Used for caching and sessions

3. **Main Application**
   - Node.js environment
   - Automatically builds from `package.json`

### Adding Services

```bash
# Add PostgreSQL
railway add postgres

# Add Redis
railway add redis
```

---

## Environment Variables

### Required Variables

Set these in Railway dashboard or CLI:

```bash
# AI Providers (at least one required)
railway variables set OPENAI_API_KEY="sk-..."
railway variables set ANTHROPIC_API_KEY="sk-ant-..."
railway variables set GOOGLE_AI_API_KEY="..."

# Security
railway variables set SESSION_SECRET="$(openssl rand -hex 64)"
railway variables set ADMIN_SETUP_KEY="$(openssl rand -hex 32)"

# AWS (for file uploads and encryption)
railway variables set AWS_ACCESS_KEY_ID="..."
railway variables set AWS_SECRET_ACCESS_KEY="..."
railway variables set AWS_REGION="ap-south-1"
railway variables set AWS_S3_BUCKET="icai-cagpt-uploads"
```

### Optional Variables

```bash
# Payments
railway variables set RAZORPAY_KEY_ID="..."
railway variables set RAZORPAY_KEY_SECRET="..."

# OAuth
railway variables set GOOGLE_CLIENT_ID="..."
railway variables set GOOGLE_CLIENT_SECRET="..."

# Monitoring
railway variables set SENTRY_DSN="..."

# Feature Flags
railway variables set ENABLE_DEEP_RESEARCH="true"
railway variables set ENABLE_EXPERT_ROUNDTABLE="true"
```

### Auto-Set Variables

These are automatically set by Railway:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PORT` - Application port (Railway provides this)
- `RAILWAY_ENVIRONMENT` - Current environment name

---

## Deployment Commands

### Deploy Current Branch
```bash
railway up
```

### Deploy with Build Logs
```bash
railway up --detach
railway logs
```

### Deploy Specific Branch
```bash
git checkout production
railway up
```

---

## Database Management

### Run Migrations
```bash
# Push schema to Railway database
npm run db:push

# Or run in Railway context
railway run npm run db:push
```

### Connect to Database
```bash
# Open PostgreSQL shell
railway connect postgres

# Or use connection string
railway variables get DATABASE_URL
psql "$(railway variables get DATABASE_URL)"
```

### Database Backup
```bash
# Get database URL
DB_URL=$(railway variables get DATABASE_URL)

# Create backup
pg_dump "$DB_URL" > backup-$(date +%Y%m%d).sql

# Restore backup
psql "$DB_URL" < backup-20260414.sql
```

---

## Monitoring & Debugging

### View Logs
```bash
# Real-time logs
railway logs

# Follow logs
railway logs --follow

# Filter by service
railway logs --service web
```

### Check Status
```bash
railway status
```

### Open Dashboard
```bash
railway open
```

### Execute Commands in Railway Context
```bash
# Run any command with Railway env vars
railway run node scripts/create-admin.js

# Start development server with Railway DB
railway run npm run dev
```

---

## Testing Connections

### Test All Connections
```bash
npm run railway:test
```

This will verify:
- ✅ PostgreSQL database connection
- ✅ Redis connection (if configured)
- ✅ All environment variables are set
- ✅ Database schema exists

### Test Database Only
```bash
npm run db:test
```

---

## Environment Management

### List Environments
```bash
railway environment
```

### Switch Environment
```bash
railway environment production
railway environment staging
```

### Create New Environment
```bash
railway environment create staging
```

### Pull Variables from Specific Environment
```bash
railway variables --environment production
railway variables --environment staging
```

---

## Common Issues & Solutions

### Issue: `DATABASE_URL` not set

**Solution:**
```bash
# Add PostgreSQL service
railway add postgres

# Verify it's set
railway variables | grep DATABASE_URL
```

### Issue: Connection timeout

**Solution:**
```bash
# Check service status
railway status

# Check logs for errors
railway logs --service postgres

# Restart service
railway restart
```

### Issue: Build fails

**Solution:**
```bash
# Check build logs
railway logs --build

# Clear build cache
railway restart --clear-cache

# Verify Node version matches
node --version  # Should match engine in package.json
```

### Issue: Environment variables not loading

**Solution:**
```bash
# Re-pull variables
npm run railway:setup

# Or manually
railway variables > .env
```

### Issue: SSL certificate error with PostgreSQL

**Solution:**
Add to `drizzle.config.ts`:
```typescript
ssl: {
  rejectUnauthorized: false
}
```

---

## CI/CD with Railway

### GitHub Integration

1. Connect repository in Railway dashboard
2. Set up automatic deployments:
   - `main` branch → production
   - `develop` branch → staging

### Manual Deploy Hook

```bash
# Get deploy hook URL from Railway dashboard
curl -X POST https://api.railway.app/project/PROJECT_ID/deploy
```

---

## Performance Optimization

### Enable Connection Pooling

Railway PostgreSQL includes PgBouncer. Use pooled connection:

```bash
# Get pooled connection URL
railway variables get DATABASE_PRIVATE_URL
```

### Redis Caching

Add Redis service for improved performance:

```bash
railway add redis
```

Then update your code to use `REDIS_URL`.

### Health Checks

Railway uses `railway.toml` for health checks:

```toml
[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 300
```

---

## Security Best Practices

### 1. Use Railway Secrets
Never commit secrets to Git. Set them via Railway:

```bash
railway variables set SECRET_KEY="..."
```

### 2. Enable SSL
PostgreSQL SSL is enabled by default on Railway.

### 3. Restrict Access
Use Railway's private networking for database:

```bash
# Use private URL instead of public
railway variables get DATABASE_PRIVATE_URL
```

### 4. Rotate Secrets Regularly

```bash
# Generate new session secret
railway variables set SESSION_SECRET="$(openssl rand -hex 64)"

# Update API keys when needed
railway variables set OPENAI_API_KEY="sk-new-key"
```

---

## Scaling

### Horizontal Scaling
```bash
# Scale to multiple instances
railway scale --replicas 3
```

### Vertical Scaling
```bash
# Upgrade plan in Railway dashboard
railway open
# Go to Settings → Plan
```

---

## Useful Railway Commands Reference

| Command | Description |
|---------|-------------|
| `railway login` | Authenticate with Railway |
| `railway link` | Link local project to Railway |
| `railway up` | Deploy current directory |
| `railway logs` | View application logs |
| `railway status` | Check deployment status |
| `railway open` | Open Railway dashboard |
| `railway variables` | List all environment variables |
| `railway variables set KEY=VALUE` | Set a variable |
| `railway run <cmd>` | Run command with Railway env |
| `railway connect postgres` | Open database shell |
| `railway environment` | List/switch environments |
| `railway restart` | Restart service |
| `railway delete` | Delete service |

---

## Support & Resources

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Railway Status:** https://status.railway.app

---

## Next Steps After Setup

1. ✅ Run `npm run railway:setup` to configure Railway
2. ✅ Run `npm run railway:test` to verify connections
3. ✅ Run `npm run db:push` to create database schema
4. ✅ Deploy with `railway up`
5. ✅ Monitor with `railway logs --follow`

Your ICAI-CAGPT application should now be running on Railway! 🚂
