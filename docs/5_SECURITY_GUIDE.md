# ICAI CAGPT - Security Implementation Guide
## Complete Security Architecture & Authentication System

**Document Version**: 1.0  
**Last Updated**: December 23, 2025  
**Consolidated from**: SECURITY_IMPLEMENTATION.md, AUTHENTICATION_DEBUGGING_GUIDE.md, AUTHENTICATION_USER_GUIDE.md, SUPER_ADMIN_SETUP.md

---

## Table of Contents
1. [Security Overview](#1-security-overview)
2. [Authentication System](#2-authentication-system)
3. [Multi-Factor Authentication (MFA)](#3-multi-factor-authentication-mfa)
4. [Encryption Architecture](#4-encryption-architecture)
5. [Key Vault Integration](#5-key-vault-integration)
6. [Session Security](#6-session-security)
7. [File Upload Security](#7-file-upload-security)
8. [Virus Scanning Pipeline](#8-virus-scanning-pipeline)
9. [OAuth Token Protection](#9-oauth-token-protection)
10. [HTTP Security Hardening](#10-http-security-hardening)
11. [Rate Limiting](#11-rate-limiting)
12. [Admin & Super Admin Access](#12-admin--super-admin-access)
13. [Audit Logging](#13-audit-logging)
14. [GDPR Compliance](#14-gdpr-compliance)
15. [Security Testing](#15-security-testing)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Security Overview

### Architecture Summary

ICAI CAGPT implements **military-grade security** with multiple layers:

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Encryption** | AES-256-GCM | Data at rest protection |
| **Hashing** | bcrypt (10 rounds) | Password security |
| **Session** | Express Session + PostgreSQL | Secure session management |
| **MFA** | TOTP (RFC 6238) | Two-factor authentication |
| **HTTP** | Helmet + CSP + HSTS | Request/response hardening |
| **Rate Limiting** | Express Rate Limit | Abuse prevention |

### Security Certifications (Planned)

| Certification | Target Date | Status |
|--------------|-------------|--------|
| SOC 2 Type II | Q2 2025 | Planned |
| ISO 27001 | Q3 2025 | Planned |
| GDPR | Current | ✅ Compliant |

---

## 2. Authentication System

### 2.1 Password Requirements

**All passwords must meet:**
- ✅ **Minimum 12 characters**
- ✅ **At least one uppercase letter** (A-Z)
- ✅ **At least one lowercase letter** (a-z)
- ✅ **At least one number** (0-9)
- ✅ **At least one special character** (!@#$%^&*...)

**Backend Validation (Zod):**
```typescript
const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must contain uppercase letter")
  .regex(/[a-z]/, "Password must contain lowercase letter")
  .regex(/[0-9]/, "Password must contain number")
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Password must contain special character");
```

**Security Benefits:**
- Prevents weak passwords
- Resistant to dictionary attacks
- Complies with NIST SP 800-63B
- Estimated entropy: ~50+ bits

### 2.2 Account Lockout Protection

| Setting | Value |
|---------|-------|
| Maximum failed attempts | 5 |
| Lockout duration | 30 minutes |
| Warning threshold | 2 remaining |
| Reset trigger | Successful login |

**Database Schema:**
```typescript
failedLoginAttempts: integer("failed_login_attempts").default(0),
lockedUntil: timestamp("locked_until"),
lastFailedLogin: timestamp("last_failed_login")
```

**Lockout Flow:**
```typescript
if (failedAttempts < 4) {
  failedAttempts++;
  if (remainingAttempts <= 2) {
    return "Warning: X attempts remaining";
  }
} else {
  lockedUntil = now + 30 minutes;
  return "Account temporarily locked";
}
```

### 2.3 Test Accounts

| Role | Email | Password | Tier |
|------|-------|----------|------|
| Demo User | `demo@luca.com` | `DemoUser123!` | Free |
| Test User | `test@luca.com` | `TestUser123!` | Professional |
| Admin User | `admin@luca.com` | `Admin123!` | Enterprise |

### 2.4 Error Messages

**Login Errors:**

| Scenario | Message |
|----------|---------|
| Email not found | "No account found with this email address" |
| Wrong password | "Incorrect password. Please try again." |
| Account locked | "Account locked due to too many failed attempts..." |
| Password too short | "Password must be at least 8 characters long" |

---

## 3. Multi-Factor Authentication (MFA)

### 3.1 Technology

**TOTP** (Time-based One-Time Password) per RFC 6238

**Supported Authenticator Apps:**
- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password
- Bitwarden

### 3.2 MFA Setup Flow

1. **Generate Secret**: `/api/mfa/setup`
   ```typescript
   const secret = speakeasy.generateSecret({
     name: `Luca (${user.email})`,
     issuer: 'Luca'
   });
   const qrCode = await qrcode.toDataURL(secret.otpauth_url);
   ```

2. **Display QR Code**: User scans with authenticator app

3. **Verify Code**: User enters 6-digit code via `/api/mfa/enable`

4. **Generate Backup Codes**: 10 single-use bcrypt-hashed codes
   ```typescript
   const backupCodes = Array.from({ length: 10 }, () => 
     crypto.randomBytes(4).toString('hex')
   );
   ```

5. **Activate MFA**: Secret encrypted with AES-256-GCM

### 3.3 MFA Login Flow

1. User enters email + password
2. If MFA enabled → prompt for 6-digit code
3. Verify via `speakeasy.totp.verify()`
4. Accept backup code as alternative
5. Grant access on success

### 3.4 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mfa/setup` | POST | Generate QR code + secret |
| `/api/mfa/enable` | POST | Verify code, activate MFA |
| `/api/mfa/disable` | POST | Deactivate MFA |
| `/api/mfa/verify` | POST | Verify TOTP code |
| `/api/mfa/backup-codes` | POST | Regenerate backup codes |

### 3.5 Database Schema

```typescript
mfaEnabled: boolean("mfa_enabled").default(false),
mfaSecret: text("mfa_secret"), // AES-256-GCM encrypted
mfaBackupCodes: text("mfa_backup_codes").array() // bcrypt hashed
```

---

## 4. Encryption Architecture

### 4.1 Master Key Configuration

**AES-256-GCM** encryption for all sensitive data.

```bash
# Must be exactly 64 hex characters (32 bytes)
ENCRYPTION_KEY=eb5fa4bb41ef958a7ffb4320042c026c1cf0c2e8670a1b145fcda1f391292dbf
```

**Generate New Key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4.2 Per-File Encryption

1. **Random File Key**: Each file gets unique 32-byte AES-256-GCM key
2. **File Encryption**: File encrypted with random key
3. **Key Wrapping**: File key wrapped using master ENCRYPTION_KEY
4. **Metadata Storage**: Only wrapped key stored in database
5. **Nonce Storage**: Unique nonce (12 bytes) per file

**Security Properties:**
- ✅ Each file has unique encryption key
- ✅ Master key compromise doesn't expose file keys
- ✅ Database breach doesn't expose file contents
- ✅ Tamper detection via SHA-256 checksums

### 4.3 Encryption Implementation

```typescript
// Encryption
const encrypted = encrypt(accessToken, ENCRYPTION_KEY);
// Database stores: { data, iv, authTag }

// Decryption  
const plaintext = decrypt(encrypted, ENCRYPTION_KEY);
```

---

## 5. Key Vault Integration

### 5.1 Supported Providers

| Provider | Use Case | Security Level |
|----------|----------|----------------|
| Environment Variables | Development | ⚠️ Low |
| AWS KMS | Production (AWS) | ✅ HSM-backed |
| Azure Key Vault | Production (Azure) | ✅ HSM-backed |
| HashiCorp Vault | Multi-cloud | ✅ High |

### 5.2 Configuration

**Development:**
```bash
KEY_VAULT_PROVIDER=env
ENCRYPTION_KEY=your_64_hex_character_key
```

**AWS KMS:**
```bash
KEY_VAULT_PROVIDER=aws-kms
AWS_KMS_KEY_ID=arn:aws:kms:region:account:key/key-id
AWS_REGION=us-east-1
```

**Azure Key Vault:**
```bash
KEY_VAULT_PROVIDER=azure-keyvault
AZURE_KEYVAULT_URL=https://your-vault.vault.azure.net/
AZURE_KEYVAULT_SECRET_NAME=encryption-key
```

**HashiCorp Vault:**
```bash
KEY_VAULT_PROVIDER=hashicorp-vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=your-vault-token
VAULT_SECRET_PATH=secret/data/encryption-key
```

### 5.3 Key Rotation

**Procedure:**
1. Generate new `ENCRYPTION_KEY_NEW`
2. Deploy code supporting both keys
3. Re-encrypt all OAuth tokens
4. Re-wrap all file encryption keys
5. Update `ENCRYPTION_KEY` to new value
6. Remove old key

**Downtime:** Zero (dual-key support)

---

## 6. Session Security

### 6.1 Configuration

```typescript
session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
})
```

### 6.2 Security Flags

| Flag | Purpose | Attack Prevented |
|------|---------|------------------|
| `httpOnly: true` | Blocks JS cookie access | XSS |
| `secure: true` | HTTPS-only | MITM |
| `sameSite: 'strict'` | No cross-site requests | CSRF |
| `rolling: true` | Auto-extend on activity | Session fixation |

### 6.3 Session Debugging

**Debug Endpoint (Development Only):**
```
GET /api/debug/session
```

**Enhanced Logging:**
```typescript
console.log('[Auth] Login attempt:', { 
  email: isDev ? email : email.substring(0, 3) + '***',
  sessionID: req.sessionID,
  cookies: req.headers.cookie ? 'present' : 'missing',
  environment: process.env.NODE_ENV
});
```

---

## 7. File Upload Security

### 7.1 Security Controls

**File Size Limits:**
```typescript
if (fileSize > 50 * 1024 * 1024) {
  throw new Error('File too large'); // 50MB max
}
```

**Allowed MIME Types:**
- `text/csv`
- `application/vnd.ms-excel`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `text/plain`

**Allowed Vendors:**
- `drake`, `turbotax`, `hrblock`, `adp`

### 7.2 Upload Process

1. User uploads via multipart/form-data
2. Calculate SHA-256 checksum
3. Generate random 32-byte encryption key
4. Encrypt file with AES-256-GCM
5. Wrap file key with master key
6. Store encrypted file on disk
7. Store metadata in database
8. Trigger virus scan (status: "pending")

### 7.3 Download Protection

Files can only download if:
- ✅ User owns the file (`userId` match)
- ✅ File not soft-deleted
- ✅ Scan status is `clean`
- ✅ Checksum verification passes

### 7.4 Secure Deletion (DOD 5220.22-M)

```typescript
async function secureDeleteFile(storageKey: string) {
  const filepath = path.join(UPLOAD_DIR, storageKey);
  
  // Pass 1: Write 0x00
  await fs.writeFile(filepath, Buffer.alloc(size, 0x00));
  
  // Pass 2: Write 0xFF
  await fs.writeFile(filepath, Buffer.alloc(size, 0xFF));
  
  // Pass 3: Write random data
  await fs.writeFile(filepath, crypto.randomBytes(size));
  
  // Final: Zero fill and delete
  await fs.writeFile(filepath, Buffer.alloc(size, 0x00));
  await fs.unlink(filepath);
}
```

---

## 8. Virus Scanning Pipeline

### 8.1 Scan States

| State | Description |
|-------|-------------|
| `pending` | Awaiting scan |
| `scanning` | Currently being scanned |
| `clean` | Safe to download |
| `infected` | Quarantined |

### 8.2 Supported Providers

```bash
# ClamAV (Self-hosted)
VIRUS_SCAN_PROVIDER=clamav
CLAMAV_HOST=localhost
CLAMAV_PORT=3310

# VirusTotal (Cloud)
VIRUS_SCAN_PROVIDER=virustotal
VIRUSTOTAL_API_KEY=your-api-key

# AWS GuardDuty
VIRUS_SCAN_PROVIDER=aws-guardduty
AWS_GUARDDUTY_ENABLED=true
```

### 8.3 Background Scanning

```typescript
setInterval(async () => {
  const pendingFiles = await storage.getTaxFilesByStatus('pending');
  
  for (const file of pendingFiles) {
    const scanResult = await virusScanService.scanFile(file);
    await storage.updateTaxFileStatus(
      file.id,
      scanResult.isClean ? 'clean' : 'infected',
      scanResult.details
    );
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

---

## 9. OAuth Token Protection

### 9.1 CSRF Protection

```typescript
// Generate state
const state = crypto.randomBytes(32).toString('hex');
req.session.oauthState = state;

// Validate callback
if (req.query.state !== req.session.oauthState) {
  throw new Error('CSRF validation failed');
}
```

### 9.2 Token Encryption

```typescript
// Never store plaintext tokens
const encryptedAccessToken = encrypt(accessToken, ENCRYPTION_KEY);
const encryptedRefreshToken = encrypt(refreshToken, ENCRYPTION_KEY);

await db.insert(accountingIntegrations).values({
  accessToken: encryptedAccessToken,
  refreshToken: encryptedRefreshToken,
});
```

**Protected Tokens:**
- QuickBooks OAuth 2.0
- Xero OAuth 2.0
- Zoho Books OAuth 2.0
- ADP OAuth 2.0

---

## 10. HTTP Security Hardening

### 10.1 Helmet Configuration

```typescript
helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  },
  frameguard: { action: 'deny' },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
})
```

### 10.2 Protection Summary

| Attack | Protection |
|--------|------------|
| Clickjacking | X-Frame-Options: DENY |
| XSS | CSP + X-XSS-Protection |
| MIME sniffing | X-Content-Type-Options: nosniff |
| Protocol downgrade | HSTS |
| Referrer leakage | Referrer-Policy |

---

## 11. Rate Limiting

### 11.1 Endpoint Limits

| Endpoint | Window | Max Requests |
|----------|--------|--------------|
| `/api/auth/*` | 15 min | 10 |
| `/api/chat` | 1 min | 10 |
| `/api/integrations/*` | 15 min | 5 |
| `/api/tax-files/upload` | 1 hour | 20 |

### 11.2 Implementation

```typescript
app.post("/api/auth/login", authRateLimiter, handler);
app.post("/api/chat", chatRateLimiter, handler);
app.post("/api/integrations/:provider/initiate", integrationRateLimiter, handler);
```

---

## 12. Admin & Super Admin Access

### 12.1 Access Levels

| Role | Access |
|------|--------|
| **Super Admin** | System Monitoring, Deployment, Security, All admin features |
| **Regular Admin** | Users, Subscriptions, Coupons, Analytics |
| **Enterprise Users** | ❌ No admin access |
| **Regular Users** | ❌ No admin access |

### 12.2 Super Admin Setup

**Environment Variable:**
```bash
SUPER_ADMIN_EMAILS=cto@company.com,devops@company.com
```

**Database Promotion:**
```sql
UPDATE users SET "isAdmin" = true WHERE email = 'your-email@example.com';
```

### 12.3 Access Control Logic

```typescript
// server/middleware/superAdmin.ts
const SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS.split(',');
if (!SUPER_ADMIN_EMAILS.includes(user.email)) {
  return res.status(403).json({ error: 'Super admin access required' });
}
```

### 12.4 Super Admin Capabilities

- ✅ System health dashboard
- ✅ Security threat logs
- ✅ APM metrics and alerts
- ✅ Deployment management
- ✅ Maintenance mode controls
- ✅ Rollback deployments

---

## 13. Audit Logging

### 13.1 Logged Events

**Authentication:**
- `LOGIN`, `LOGOUT`, `REGISTER`

**Integrations:**
- `CONNECT_INTEGRATION`, `DELETE_INTEGRATION`

**Files:**
- `UPLOAD_TAX_FILE`, `DOWNLOAD_TAX_FILE`, `DELETE_TAX_FILE`

**Admin:**
- `UPDATE_API_KEYS`

### 13.2 Log Schema

```typescript
{
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details: object,
  ipAddress: string,
  userAgent: string,
  createdAt: timestamp
}
```

---

## 14. GDPR Compliance

### 14.1 Right to Access

```sql
SELECT * FROM users WHERE id = $userId;
SELECT * FROM audit_logs WHERE user_id = $userId;
SELECT * FROM tax_file_uploads WHERE user_id = $userId;
SELECT * FROM accounting_integrations WHERE user_id = $userId;
```

### 14.2 Right to Deletion

```sql
BEGIN;
UPDATE tax_file_uploads SET deleted_at = NOW() WHERE user_id = $userId;
DELETE FROM accounting_integrations WHERE user_id = $userId;
UPDATE audit_logs SET user_id = 'DELETED', details = '{}' WHERE user_id = $userId;
DELETE FROM users WHERE id = $userId;
COMMIT;
```

### 14.3 Right to Portability

Export encrypted files + metadata in JSON format.

---

## 15. Security Testing

### 15.1 Encryption Tests

```bash
node -e "const { encrypt, decrypt } = require('./server/utils/encryption');
const key = process.env.ENCRYPTION_KEY;
const original = 'sensitive data';
const enc = encrypt(original, key);
const dec = decrypt(enc, key);
console.assert(dec === original, 'Encryption failed');"
```

### 15.2 Rate Limiter Tests

```bash
for i in {1..15}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
# Expect: 429 after 10 requests
```

### 15.3 File Upload Tests

```bash
dd if=/dev/zero of=large.bin bs=1M count=51
curl -X POST http://localhost:5000/api/tax-files/upload \
  -F "file=@large.bin" \
  -F "vendor=drake"
# Expect: 400 File too large
```

### 15.4 CSRF Tests

```bash
curl "http://localhost:5000/api/integrations/quickbooks/callback?code=abc&state=wrong"
# Expect: Redirect with error
```

---

## 16. Troubleshooting

### 16.1 Session Issues

| Issue | Solution |
|-------|----------|
| Sessions not persisting | Check `sameSite` and `secure` settings |
| Login failures | Verify PostgreSQL session store |
| Cookies not set | Ensure HTTPS in production |

### 16.2 Authentication Debugging

**Enable Debug Logging:**
```typescript
console.log('[Auth] Session save:', {
  sessionID: req.sessionID,
  userId: user.id,
  error: err?.message
});
```

**Check Session Store:**
```sql
SELECT * FROM sessions WHERE sess->'userId' IS NOT NULL;
```

### 16.3 Common Fixes

```bash
# Clear browser data
Developer Tools → Application → Clear Storage

# Test with demo account
demo@luca.com / DemoUser123!

# Check server logs
npm run dev 2>&1 | grep '\[Auth\]'
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Generate production `ENCRYPTION_KEY` (64 hex chars)
- [ ] Set all OAuth credentials
- [ ] Configure `SESSION_SECRET` (64+ chars random)
- [ ] Set `SUPER_ADMIN_EMAILS` (1-3 people max)
- [ ] Configure virus scanning solution
- [ ] Test all OAuth flows

### Post-Deployment
- [ ] Monitor rate limiter effectiveness
- [ ] Review audit logs
- [ ] Test file upload/download
- [ ] Verify HTTPS/HSTS
- [ ] Confirm CSP headers

---

## Security Contact

For security issues: security@luca.example.com

**Vulnerability Disclosure:**
- Responsible disclosure encouraged
- 90-day timeline
- Bug bounty program (planned)

---

*This document consolidates: SECURITY_IMPLEMENTATION.md, AUTHENTICATION_DEBUGGING_GUIDE.md, AUTHENTICATION_USER_GUIDE.md, SUPER_ADMIN_SETUP.md*
