# SSL Certificate Fix Guide for cagpt.icai.org

## Problem
Your domain shows: `net::ERR_CERT_COMMON_NAME_INVALID` because Railway is serving its default SSL certificate (`*.up.railway.app`) instead of one for `cagpt.icai.org`.

## Solution Overview
1. Install Railway CLI
2. Configure custom domain in Railway
3. Update GoDaddy DNS records
4. Wait for SSL certificate provisioning

---

## Step 1: Install Railway CLI

```powershell
# Install Railway CLI using npm
npm install -g @railway/cli

# Or using Scoop (Windows package manager)
# scoop install railway

# Verify installation
railway --version
```

---

## Step 2: Login to Railway

```powershell
# Login to Railway (opens browser)
railway login

# Link to your project
cd "path/to/luca-agent"
railway link

# Select your project from the list (luca-agent)
```

---

## Step 3: Add Custom Domain via Railway CLI

```powershell
# Add your custom domain
railway domain add cagpt.icai.org

# Add www subdomain
railway domain add www.cagpt.icai.org

# List all domains
railway domain list
```

**Alternative: Use Railway Dashboard**
1. Go to https://railway.app/dashboard
2. Select your `luca-agent` project
3. Click **Settings** → **Domains**
4. Click **+ Add Domain**
5. Enter: `cagpt.icai.org`
6. Click **+ Add Domain** again
7. Enter: `www.cagpt.icai.org`

---

## Step 4: Get Railway DNS Configuration

After adding domains, Railway will provide DNS instructions. Typically:

```powershell
# Check your Railway service URL
railway status
```

Railway will show the target CNAME, usually something like:
- `luca-agent-production.up.railway.app`

---

## Step 5: Update GoDaddy DNS Records

### Option A: Use Our Automated Script

```powershell
# Set environment variables if not already in .env
$env:GODADDY_API_KEY="your_godaddy_api_key"
$env:GODADDY_API_SECRET="your_godaddy_secret"

# Run the DNS update script
npm run setup:domain
```

### Option B: Manual Configuration via GoDaddy

1. **Login to GoDaddy**
   - Go to https://dcc.godaddy.com/
   - Navigate to **My Products** → **Domains**
   - Click on `cagpt.icai.org`
   - Click **DNS** → **Manage DNS**

2. **Update DNS Records**

   **For Root Domain (cagpt.icai.org):**
   - Delete existing A records with name `@`
   - Add new **A Record**:
     - Type: `A`
     - Name: `@`
     - Value: Get from Railway dashboard or use Railway's recommended approach
     - TTL: `600 seconds`

   **For WWW Subdomain:**
   - Delete existing CNAME record for `www` (if any)
   - Add new **CNAME Record**:
     - Type: `CNAME`
     - Name: `www`
     - Value: `luca-agent-production.up.railway.app` (your Railway service URL)
     - TTL: `600 seconds`

3. **Save Changes**

---

## Step 6: Configure Railway for Root Domain Redirect

Since GoDaddy doesn't support CNAME at root, configure Railway to handle both:

```powershell
# In Railway dashboard, under Domains:
# 1. Set www.cagpt.icai.org as primary
# 2. Enable "Redirect apex to www" option
```

**Or via CLI:**
```powershell
railway variables set CUSTOM_DOMAIN=cagpt.icai.org
railway variables set WWW_DOMAIN=www.cagpt.icai.org
```

---

## Step 7: Update Environment Variables

```powershell
# Set production URL
railway variables set CLIENT_URL=https://cagpt.icai.org
railway variables set VITE_API_URL=https://cagpt.icai.org

# If needed, update session cookie domain
railway variables set COOKIE_DOMAIN=.cagpt.icai.org
```

---

## Step 8: Verify DNS Propagation

```powershell
# Check DNS records (may take 5-60 minutes to propagate)
nslookup cagpt.icai.org
nslookup www.cagpt.icai.org

# Check if pointing to Railway
# Expected: www.cagpt.icai.org should resolve to Railway's servers
```

---

## Step 9: Wait for SSL Certificate Provisioning

Railway automatically provisions SSL certificates via Let's Encrypt:

1. **Check Certificate Status:**
   - Railway Dashboard → Your Project → Domains
   - Look for green checkmark next to domain
   - Status should show: "Active" with SSL enabled

2. **Typical Timeline:**
   - DNS propagation: 5-60 minutes
   - SSL provisioning: 1-10 minutes after DNS propagates
   - Total time: Usually 10-70 minutes

---

## Step 10: Test Your Site

```powershell
# Test HTTPS connections
curl -I https://cagpt.icai.org
curl -I https://www.cagpt.icai.org

# Both should return 200 OK with valid SSL certificate
```

**Browser Test:**
1. Open https://cagpt.icai.org
2. Click padlock icon in address bar
3. Verify certificate is issued for `cagpt.icai.org`
4. Should show: "Certificate is valid"

---

## Troubleshooting

### Issue: DNS Not Propagating

```powershell
# Force DNS cache flush (Windows)
ipconfig /flushdns

# Check DNS from multiple locations
# Use: https://dnschecker.org/#A/cagpt.icai.org
```

### Issue: SSL Certificate Not Provisioning

**Reasons:**
- DNS not fully propagated yet
- Railway hasn't started SSL provisioning
- CAA records blocking Let's Encrypt

**Solutions:**

1. **Check CAA Records:**
```powershell
# Check if CAA records exist
nslookup -type=CAA cagpt.icai.org
```

If CAA records exist and don't include Let's Encrypt, add via GoDaddy:
- Type: `CAA`
- Name: `@`
- Value: `0 issue "letsencrypt.org"`

2. **Force SSL Regeneration:**
```powershell
# Remove and re-add domain
railway domain remove cagpt.icai.org
railway domain add cagpt.icai.org
```

3. **Check Railway Logs:**
```powershell
railway logs
# Look for SSL/certificate errors
```

### Issue: Mixed Content Warnings

If you see mixed content warnings after SSL is working:

**Update your code to force HTTPS:**

1. **Add to server/index.ts:**
```typescript
// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

2. **Update Vite config:**
```typescript
// vite.config.ts
server: {
  https: process.env.NODE_ENV === 'production'
}
```

### Issue: Certificate for Wrong Domain

If certificate shows `*.up.railway.app`:
1. Domain not properly added to Railway
2. Accessing via Railway URL instead of custom domain
3. DNS still pointing to old Railway service

**Fix:**
```powershell
# Verify domain configuration
railway domain list

# Should show:
# ✓ cagpt.icai.org
# ✓ www.cagpt.icai.org
```

---

## Alternative: Use Cloudflare (Recommended for Production)

For better performance and instant SSL:

1. **Add Site to Cloudflare:**
   - Go to https://dash.cloudflare.com
   - Add `cagpt.icai.org`
   - Follow nameserver instructions

2. **Update GoDaddy Nameservers:**
   - GoDaddy Dashboard → Domain → Nameservers
   - Change to Custom
   - Add Cloudflare nameservers (provided during setup)

3. **Configure Cloudflare DNS:**
   ```
   Type    Name    Content                            Proxy
   A       @       [Railway IP]                       Proxied (Orange)
   CNAME   www     luca-agent-production.up.railway.app   Proxied (Orange)
   ```

4. **SSL Settings in Cloudflare:**
   - SSL/TLS → Overview → Full (strict)
   - Edge Certificates → Always Use HTTPS: On
   - Automatic HTTPS Rewrites: On

5. **Benefits:**
   - Instant SSL (Cloudflare's certificate)
   - CDN and caching
   - DDoS protection
   - Better performance globally

---

## Quick Command Reference

```powershell
# Railway CLI Commands
railway login                    # Login to Railway
railway link                     # Link to project
railway domain add cagpt.icai.org    # Add custom domain
railway domain list              # List domains
railway status                   # Check deployment status
railway logs                     # View application logs
railway variables                # List environment variables

# DNS Testing
nslookup cagpt.icai.org             # Check A records
nslookup www.cagpt.icai.org         # Check CNAME
ipconfig /flushdns              # Flush DNS cache

# SSL Testing
curl -I https://cagpt.icai.org      # Test HTTPS
openssl s_client -connect cagpt.icai.org:443 -servername cagpt.icai.org
```

---

## Expected Timeline

| Step | Time | Status Check |
|------|------|--------------|
| Railway domain added | Instant | `railway domain list` |
| GoDaddy DNS updated | Instant | GoDaddy dashboard |
| DNS propagation | 5-60 min | `nslookup cagpt.icai.org` |
| SSL certificate issued | 1-10 min after DNS | Railway dashboard |
| Site accessible with SSL | Total: 10-70 min | Browser test |

---

## Support

If issues persist after 2 hours:

1. **Check Railway Status:** https://status.railway.app
2. **Railway Support:** https://railway.app/help
3. **Contact:** support@railway.app

**Include in support request:**
- Project ID
- Domain name
- DNS records (screenshot)
- Error messages
- Railway logs

---

## Final Checklist

- [ ] Railway CLI installed
- [ ] Logged into Railway
- [ ] Custom domain added to Railway
- [ ] GoDaddy DNS updated (CNAME for www)
- [ ] DNS propagated (test with nslookup)
- [ ] SSL certificate issued (check Railway dashboard)
- [ ] Site accessible via HTTPS
- [ ] No certificate warnings
- [ ] Environment variables updated
- [ ] Both cagpt.icai.org and www.cagpt.icai.org work

---

**Last Updated:** January 1, 2026  
**Estimated Total Time:** 15 minutes active + 30-60 minutes waiting
