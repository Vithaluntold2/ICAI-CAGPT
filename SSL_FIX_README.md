# 🔒 Fix SSL Certificate Error - README

## Your Current Error

```
Your connection is not private
net::ERR_CERT_COMMON_NAME_INVALID
Certificate is from *.up.railway.app (should be cagpt.icai.org)
```

## 🚀 Quick Fix (5 Minutes)

### Prerequisites

1. **Install Railway CLI:**
```powershell
npm install -g @railway/cli
```

2. **Login to Railway:**
```powershell
railway login
```

### Run the Fix

```powershell
# Check current status
npm run check:ssl

# Fix SSL certificate issue
npm run fix:ssl
```

### Wait for DNS + SSL

- **DNS Propagation:** 10-30 minutes
- **SSL Certificate:** 5-10 minutes after DNS
- **Total Time:** 15-40 minutes

### Verify It Works

```powershell
# After 30 minutes, check again
npm run check:ssl

# Test in browser
# Go to: https://cagpt.icai.org
# Should show: "Connection is secure" 🔒
```

---

## 📚 Documentation

| Guide | Purpose |
|-------|---------|
| [QUICK_SSL_FIX.md](docs/QUICK_SSL_FIX.md) | Start here - simple steps |
| [SSL_CERTIFICATE_FIX_GUIDE.md](docs/SSL_CERTIFICATE_FIX_GUIDE.md) | Detailed troubleshooting |

---

## 🛠️ Available Commands

```powershell
# Diagnose current SSL/DNS status
npm run check:ssl

# Automated SSL fix (recommended)
npm run fix:ssl

# Manual DNS update only
npm run setup:domain
```

---

## ⚡ What the Script Does

1. ✅ Checks Railway CLI installation
2. ✅ Verifies Railway login
3. ✅ Adds `cagpt.icai.org` and `www.cagpt.icai.org` to Railway
4. ✅ Updates GoDaddy DNS records (CNAME)
5. ✅ Configures environment variables
6. ✅ Shows you exactly when SSL will be ready

---

## 🔍 Troubleshooting

### "Railway CLI not found"

```powershell
npm install -g @railway/cli
railway --version  # Verify installation
```

### "Not logged into Railway"

```powershell
railway login  # Opens browser to authenticate
railway whoami  # Verify login
```

### "GoDaddy API credentials not found"

1. Get API keys: https://developer.godaddy.com/keys
2. Add to `.env`:
   ```
   GODADDY_API_KEY=your_key_here
   GODADDY_API_SECRET=your_secret_here
   ```

### "DNS not propagating"

```powershell
# Flush local DNS cache
ipconfig /flushdns

# Check global propagation
# Visit: https://dnschecker.org/#CNAME/www.cagpt.icai.org
```

### "SSL certificate not issued after 2 hours"

```powershell
# Remove and re-add domain
railway domain remove cagpt.icai.org
railway domain add cagpt.icai.org

# Check Railway logs
railway logs
```

---

## 📊 Expected Results

### After running `npm run check:ssl`:

```
✅ Railway Configuration
   ✓ cagpt.icai.org configured
   ✓ www.cagpt.icai.org configured

✅ DNS Check: www.cagpt.icai.org
   ✓ Points to Railway

✅ SSL Check: www.cagpt.icai.org
   ✓ Certificate matches domain
   ✓ Valid certificate
```

---

## 🎯 Success Checklist

- [ ] Railway CLI installed (`railway --version`)
- [ ] Logged into Railway (`railway whoami`)
- [ ] Ran `npm run fix:ssl`
- [ ] Waited 30-60 minutes
- [ ] `npm run check:ssl` shows all green ✅
- [ ] Browser shows https://cagpt.icai.org with valid SSL 🔒

---

## 📞 Get Help

- **Quick Guide:** [docs/QUICK_SSL_FIX.md](docs/QUICK_SSL_FIX.md)
- **Detailed Guide:** [docs/SSL_CERTIFICATE_FIX_GUIDE.md](docs/SSL_CERTIFICATE_FIX_GUIDE.md)
- **Railway Support:** https://railway.app/help
- **Railway Status:** https://status.railway.app

---

## 💡 Alternative: Cloudflare (Optional)

For instant SSL and better performance:

1. Add site to Cloudflare: https://dash.cloudflare.com
2. Change GoDaddy nameservers to Cloudflare
3. Set DNS in Cloudflare (proxied)
4. SSL works immediately!

See detailed guide: [SSL_CERTIFICATE_FIX_GUIDE.md](docs/SSL_CERTIFICATE_FIX_GUIDE.md#alternative-use-cloudflare-recommended-for-production)

---

**Last Updated:** January 1, 2026  
**Estimated Fix Time:** 5 minutes + 30 minutes waiting
