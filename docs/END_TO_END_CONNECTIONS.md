# ICAI CAGPT End-to-End Connection Guide

> **Document Version:** 1.0  
> **Last Updated:** December 28, 2025  
> **Category:** Quick Reference

---

## Quick Navigation

| Document | Description |
|----------|-------------|
| [DEPENDENCIES_GUIDE.md](DEPENDENCIES_GUIDE.md) | All npm packages, installation commands |
| [API_ENDPOINTS_REFERENCE.md](API_ENDPOINTS_REFERENCE.md) | 120+ REST API endpoints |
| [SERVICE_ARCHITECTURE.md](SERVICE_ARCHITECTURE.md) | Service layer design, data flows |

---

## 🚀 Quick Start Commands

```bash
# Install dependencies
npm install

# Setup environment (interactive)
npm run setup:env

# Push database schema
npm run db:push

# Start development
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## 📦 Essential Dependencies Summary

### Backend Core
| Package | Purpose |
|---------|---------|
| express | HTTP server |
| pg + drizzle-orm | PostgreSQL ORM |
| express-session | Session management |
| helmet + cors | Security |

### AI Providers
| Package | Provider |
|---------|----------|
| openai | GPT-4/4o |
| @anthropic-ai/sdk | Claude |
| @google/generative-ai | Gemini |
| Azure SDKs | Azure OpenAI/DocIntel |

### Frontend
| Package | Purpose |
|---------|---------|
| react + react-dom | UI framework |
| @tanstack/react-query | Data fetching |
| @radix-ui/* | UI components |
| tailwindcss | Styling |

---

## 🔗 API Endpoint Categories

| Category | Prefix | Auth | Count |
|----------|--------|------|-------|
| Authentication | `/api/auth/*` | No/Yes | 5 |
| MFA | `/api/mfa/*` | Yes | 4 |
| Profiles | `/api/profiles/*` | Yes | 8 |
| Conversations | `/api/conversations/*` | Yes | 12 |
| Chat | `/api/chat/*` | Yes | 3 |
| Files | `/api/tax-files/*` | Yes | 4 |
| Excel | `/api/excel/*` | Yes | 6 |
| Payments | `/api/payments/*` | Yes | 5 |
| Subscriptions | `/api/subscription/*` | Yes | 3 |
| Integrations | `/api/integrations/*` | Yes | 4 |
| Analytics | `/api/analytics/*` | Yes | 2 |
| Admin | `/api/admin/*` | Yes+Admin | 20+ |
| System | `/api/admin/system/*` | SuperAdmin | 15 |
| GDPR | `/api/gdpr/*` | Yes | 3 |
| Support | `/api/tickets/*` | Yes | 4 |
| Health | `/api/health/*` | No | 3 |

---

## 🔄 Key Data Flows

### Chat Message Flow
```
Browser → POST /api/chat/stream → Express Server
                                      ↓
                              requireAuth middleware
                                      ↓
                              aiOrchestrator.processQuery()
                                      ↓
                      ┌───────────────┼───────────────┐
                      ↓               ↓               ↓
              Query Triage    AI Provider     Financial Solvers
                      ↓               ↓               ↓
                      └───────────────┼───────────────┘
                                      ↓
                              SSE Stream Response
                                      ↓
                                  Browser
```

### Authentication Flow
```
Login Request → Validate Credentials → Check MFA → Establish Session → Return User
                      ↓                    ↓
              If invalid           If enabled
                      ↓                    ↓
              401 Error         Return mfaRequired: true
                                           ↓
                              Verify TOTP → Establish Session
```

### File Upload Flow
```
File → Multer Validation → Virus Scan → Encryption → Database → Response
         (MIME, size)       (ClamAV)    (AES-256)    (metadata)
```

---

## 🔌 External Service Connections

### Required Connections
| Service | Purpose | Required |
|---------|---------|----------|
| PostgreSQL | Primary database | ✅ Yes |
| At least 1 AI Provider | Chat responses | ✅ Yes |

### Optional Connections
| Service | Purpose | Config Key |
|---------|---------|------------|
| Redis | Production sessions | `REDIS_URL` |
| Azure OpenAI | AI provider | `AZURE_OPENAI_*` |
| Azure Document Intelligence | OCR/Document analysis | `AZURE_DOCUMENT_INTELLIGENCE_*` |
| Razorpay | Payments (India) | `RAZORPAY_*` |
| Cashfree | Payments (India) | `CASHFREE_*` |
| QuickBooks | Accounting integration | `QUICKBOOKS_*` |
| Xero | Accounting integration | `XERO_*` |
| Zoho | Accounting integration | `ZOHO_*` |
| Sentry | Error tracking | `SENTRY_DSN` |
| AWS S3 | File storage | `AWS_*` |
| AWS KMS | Key management | `AWS_KMS_*` |

---

## 🛡️ Security Layer Stack

```
1. Helmet (HTTP headers, CSP, HSTS)
        ↓
2. CORS (origin whitelist)
        ↓
3. Rate Limiting (per-endpoint)
        ↓
4. Session Middleware (signed cookies)
        ↓
5. Auth Middleware (requireAuth, requireAdmin)
        ↓
6. Input Validation (Zod schemas)
        ↓
7. Business Logic
```

---

## 📊 Service Architecture Layers

```
┌──────────────────────────────────────────────────────────┐
│                    Client (React)                         │
│  Pages → Components → Hooks → API Client → React Query   │
└──────────────────────────────────────────────────────────┘
                            ↓ HTTP/SSE
┌──────────────────────────────────────────────────────────┐
│                 API Layer (Express)                       │
│  routes.ts → routes/* → middleware/* → Security          │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                Service Layer (Business Logic)             │
│  aiOrchestrator → queryTriage → aiProviders → solvers    │
│  documentAnalyzer → excelOrchestrator → subscriptionSvc  │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                 Data Layer (Persistence)                  │
│  pgStorage.ts → Drizzle ORM → PostgreSQL                 │
│  Redis (sessions) → File Storage (encrypted)              │
└──────────────────────────────────────────────────────────┘
```

---

## 🔧 Environment Variables Checklist

### Minimum Required
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
SESSION_SECRET=your-32-char-secret
OPENAI_API_KEY=sk-...  # Or another AI provider
```

### Full Production Setup
```bash
# Database
DATABASE_URL=...

# Security
SESSION_SECRET=...
ENCRYPTION_KEY=...  # Auto-generated if missing

# AI Providers (at least one)
OPENAI_API_KEY=...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_DEPLOYMENT=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...

# Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_KEY=...
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=...

# Sessions (production)
REDIS_URL=...

# Payments
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Integrations
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...

# Monitoring
SENTRY_DSN=...
```

---

## 📁 Project Structure Reference

```
luca-agent/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # API clients, utils
│   │   ├── pages/         # Page components
│   │   └── utils/         # Helper functions
│   └── index.html
│
├── server/                 # Express backend
│   ├── middleware/        # Auth, security
│   ├── routes/            # Route handlers
│   ├── services/          # Business logic
│   │   ├── aiProviders/   # AI provider implementations
│   │   ├── agents/        # Specialized AI agents
│   │   └── *.ts           # Individual services
│   ├── utils/             # Helper functions
│   ├── index.ts           # Entry point
│   ├── routes.ts          # Main route definitions
│   ├── pgStorage.ts       # Database abstraction
│   └── db.ts              # Database connection
│
├── shared/                 # Shared code
│   ├── schema.ts          # Database schema (Drizzle)
│   └── types/             # TypeScript types
│
├── docs/                   # Documentation
│   ├── DEPENDENCIES_GUIDE.md
│   ├── API_ENDPOINTS_REFERENCE.md
│   ├── SERVICE_ARCHITECTURE.md
│   └── END_TO_END_CONNECTIONS.md (this file)
│
└── package.json           # Dependencies
```

---

## 🧪 Testing Connections

### Test Database Connection
```bash
npm run test-db-connection
```

### Test AI Providers
```bash
curl http://localhost:5000/api/health/azure
```

### Test Authentication
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -c cookies.txt

# Verify session
curl http://localhost:5000/api/auth/me -b cookies.txt
```

### Test Chat Endpoint
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"message":"What is FIFO?"}'
```

---

## 📈 Monitoring & Health

### Health Check Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Overall system health |
| `GET /api/health/azure` | Azure services status |
| `GET /api/features` | Feature flags |
| `GET /api/admin/ai-providers/health` | AI provider status (admin) |
| `GET /api/admin/system/health` | System metrics (superadmin) |

### Key Metrics to Monitor
- Database connection pool utilization
- AI provider response latency
- Session store memory usage
- Rate limit hit rates
- Error rates by endpoint

---

## 🔍 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Database connection failed | Check `DATABASE_URL`, SSL settings |
| Session not persisting | Check `SESSION_SECRET`, cookie settings |
| AI provider timeout | Check provider health, increase timeout |
| CORS errors | Verify allowed origins in security.ts |
| Rate limited | Reduce request frequency, check limits |

### Debug Endpoints (Development Only)
```bash
# Check session status
curl http://localhost:5000/api/debug/session -b cookies.txt
```

---

## 📚 Related Documentation

- [Setup and Deployment](4_SETUP_AND_DEPLOYMENT.md)
- [Security Guide](5_SECURITY_GUIDE.md)
- [Integrations Guide](6_INTEGRATIONS_GUIDE.md)
- [Technical Architecture](2_TECHNICAL_ARCHITECTURE.md)

---

*This document provides a consolidated quick reference. For detailed information, see the linked documents.*
