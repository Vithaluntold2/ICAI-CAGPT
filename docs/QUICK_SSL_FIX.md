# Quick SSL Fix - Start Here! 🚀

## Your Error
```
Your connection is not private
net::ERR_CERT_COMMON_NAME_INVALID
Certificate is from *.up.railway.app
```

## The Fix (3 Simple Steps)

### Step 1: Install Railway CLI

Open PowerShell and run:

```powershell
npm install -g @railway/cli
```

### Step 2: Login to Railway

```powershell
railway login
```

This opens your browser - click "Authorize"

### Step 3: Run Our Automated Fix Script

```powershell
cd "path/to/luca-agent"
npm run fix:ssl
```

That's it! The script will:
- ✅ Add your custom domain to Railway
- ✅ Update GoDaddy DNS records
- ✅ Configure environment variables
- ✅ Tell you when SSL will be ready

---

## Expected Timeline

| What | When |
|------|------|
| Script runs | 2 minutes |
| DNS propagates | 10-30 minutes |
| SSL certificate issued | 5-10 minutes after DNS |
| **Your site works** | **15-40 minutes total** |

---

## While You Wait...

### Check DNS Propagation
```powershell
nslookup www.cagpt.icai.org
```

Should show: `railway.app` in the response

### Check Global DNS
Visit: https://dnschecker.org/#CNAME/www.cagpt.icai.org

All checkmarks = Ready for SSL!

### Check SSL Certificate
1. Go to https://railway.app/dashboard
2. Click your project → Settings → Domains
3. Look for green checkmark next to `cagpt.icai.org`

---

## Test When Ready

```powershell
# Test your domain
curl -I https://cagpt.icai.org
curl -I https://www.cagpt.icai.org
```

Both should return `200 OK` with no certificate errors.

**Browser Test:**
1. Go to https://cagpt.icai.org
2. Click padlock 🔒 in address bar
3. Should say "Connection is secure"

---

## Troubleshooting

### If DNS not updating after 30 minutes:

```powershell
# Flush your DNS cache
ipconfig /flushdns

# Check again
nslookup www.cagpt.icai.org
```

### If SSL certificate not issued after 1 hour:

```powershell
# Re-add the domain
railway domain remove cagpt.icai.org
railway domain add cagpt.icai.org

# Check logs
railway logs
```

### If you see errors in the script:

**Missing GoDaddy API Keys:**
1. Go to https://developer.godaddy.com/keys
2. Create Production API Key
3. Add to your `.env` file:
   ```
   GODADDY_API_KEY=your_key_here
   GODADDY_API_SECRET=your_secret_here
   ```
4. Run `npm run fix:ssl` again

---

## Manual Alternative

If the script doesn't work, follow these manual steps:

### 1. Add Domain to Railway
```powershell
railway domain add cagpt.icai.org
railway domain add www.cagpt.icai.org
```

### 2. Update DNS in GoDaddy
1. Login to https://dcc.godaddy.com/
2. Go to your domain → DNS Management
3. Add CNAME record:
   - **Type:** CNAME
   - **Name:** www
   - **Points to:** luca-agent-production.up.railway.app
   - **TTL:** 600 seconds

### 3. Wait & Test
- Wait 30-60 minutes for DNS + SSL
- Test: https://www.cagpt.icai.org

---

## Need Help?

📖 **Full Guide:** [docs/SSL_CERTIFICATE_FIX_GUIDE.md](SSL_CERTIFICATE_FIX_GUIDE.md)

🐛 **Railway Issues:** https://railway.app/help

🌐 **DNS Issues:** Check https://dnschecker.org

---

## Success Checklist

- [ ] Railway CLI installed
- [ ] Logged into Railway (`railway login`)
- [ ] Ran fix script (`npm run fix:ssl`)
- [ ] DNS propagated (test with `nslookup`)
- [ ] SSL certificate active (Railway dashboard shows green ✓)
- [ ] Site accessible via HTTPS
- [ ] No certificate warnings in browser
- [ ] Both cagpt.icai.org and www.cagpt.icai.org work

---

**Estimated Time:** 5 minutes work + 30 minutes waiting = 35 minutes total

**Questions?** Check the detailed guide: [SSL_CERTIFICATE_FIX_GUIDE.md](SSL_CERTIFICATE_FIX_GUIDE.md)
