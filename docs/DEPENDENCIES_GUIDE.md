# ICAI CAGPT Dependencies Guide

> **Document Version:** 1.0  
> **Last Updated:** December 28, 2025  
> **Category:** Technical Reference

---

## Table of Contents

1. [Overview](#overview)
2. [Installation Commands](#installation-commands)
3. [Core Dependencies](#core-dependencies)
4. [AI/ML Dependencies](#aiml-dependencies)
5. [Database & ORM](#database--orm)
6. [Security Dependencies](#security-dependencies)
7. [Frontend Dependencies](#frontend-dependencies)
8. [File Processing Dependencies](#file-processing-dependencies)
9. [Development Dependencies](#development-dependencies)
10. [Environment Variables Required](#environment-variables-required)

---

## Overview

ICAI CAGPT is a full-stack TypeScript application with **130+ dependencies** organized into the following categories:

| Category | Count | Purpose |
|----------|-------|---------|
| AI/ML Providers | 12 | Multi-provider AI orchestration |
| Database | 5 | PostgreSQL + Drizzle ORM |
| Security | 10 | Authentication, encryption, rate limiting |
| Frontend UI | 35+ | React, Radix UI, Tailwind |
| File Processing | 8 | PDF, Excel, Document handling |
| Payments | 2 | Cashfree, Razorpay |

---

## Installation Commands

### Fresh Installation

```bash
# Clone repository
git clone https://github.com/vithaluntold/luca-agent.git
cd luca-agent

# Install all dependencies
npm install

# Setup environment variables
npm run setup:env

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Development Commands

```bash
# Start development server (hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run check

# Database migrations
npm run db:push

# Create test users
npm run create-users
```

### Quick Start Checklist

- [ ] Node.js 20+ installed
- [ ] PostgreSQL database provisioned
- [ ] `DATABASE_URL` environment variable set
- [ ] At least one AI provider API key configured
- [ ] `npm install` completed successfully
- [ ] `npm run db:push` completed successfully

---

## Core Dependencies

### Server Framework

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.21.2 | HTTP server framework |
| `express-session` | ^1.18.1 | Session management |
| `express-rate-limit` | ^8.2.1 | Rate limiting middleware |
| `cors` | ^2.8.5 | Cross-origin resource sharing |
| `helmet` | ^8.1.0 | HTTP security headers |
| `ws` | ^8.18.0 | WebSocket server |
| `axios` | ^1.13.2 | HTTP client |

### Session Storage

| Package | Version | Purpose |
|---------|---------|---------|
| `memorystore` | ^1.6.7 | Memory session store (dev) |
| `connect-redis` | ^7.1.1 | Redis session store (prod) |
| `ioredis` | ^5.8.2 | Redis client |
| `connect-pg-simple` | ^10.0.0 | PostgreSQL session store |

### Validation & Utilities

| Package | Version | Purpose |
|---------|---------|---------|
| `zod` | ^3.24.2 | Schema validation |
| `zod-validation-error` | ^3.4.0 | Human-readable validation errors |
| `dotenv` | ^17.2.3 | Environment variable loading |
| `date-fns` | ^3.6.0 | Date manipulation |
| `lru-cache` | ^11.2.4 | In-memory caching |
| `node-cache` | ^5.1.2 | Simple caching |
| `memoizee` | ^0.4.17 | Function memoization |

---

## AI/ML Dependencies

### Primary AI Providers

| Package | Version | Provider | Purpose |
|---------|---------|----------|---------|
| `openai` | ^6.8.1 | OpenAI | GPT-4, GPT-4o models |
| `@anthropic-ai/sdk` | ^0.68.0 | Anthropic | Claude models |
| `@google/generative-ai` | ^0.24.1 | Google | Gemini models |
| `@azure/identity` | ^4.13.0 | Azure | Azure authentication |

### LangChain Framework

| Package | Version | Purpose |
|---------|---------|---------|
| `@langchain/core` | ^1.1.8 | Core LangChain functionality |
| `@langchain/openai` | ^1.2.0 | OpenAI integration |
| `@langchain/anthropic` | ^1.3.3 | Anthropic integration |
| `@langchain/community` | ^1.1.1 | Community integrations |

### Azure AI Services

| Package | Version | Purpose |
|---------|---------|---------|
| `@azure/ai-form-recognizer` | ^5.1.0 | Document Intelligence/OCR |
| `@azure/keyvault-secrets` | ^4.10.0 | Key Vault integration |

---

## Database & ORM

### PostgreSQL Stack

| Package | Version | Purpose |
|---------|---------|---------|
| `pg` | ^8.16.3 | PostgreSQL driver |
| `drizzle-orm` | ^0.39.1 | TypeScript ORM |
| `drizzle-kit` | ^0.31.8 | Migration tool |
| `drizzle-zod` | ^0.7.0 | Zod schema generation |

### Supabase Integration

| Package | Version | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` | ^2.83.0 | Supabase client (optional) |

### Database Configuration

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

---

## Security Dependencies

### Authentication & Encryption

| Package | Version | Purpose |
|---------|---------|---------|
| `bcryptjs` | ^3.0.3 | Password hashing |
| `speakeasy` | ^2.0.0 | TOTP 2FA |
| `qrcode` | ^1.5.4 | QR code generation for MFA |
| `passport` | ^0.7.0 | Authentication middleware |
| `passport-local` | ^1.0.0 | Local authentication strategy |
| `openid-client` | ^6.8.1 | OAuth 2.0 / OpenID Connect |

### Session & Cookie Security

| Package | Version | Purpose |
|---------|---------|---------|
| `cookie` | ^1.0.2 | Cookie parsing |
| `cookie-signature` | ^1.2.2 | Cookie signing |

### Cloud Security

| Package | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-kms` | ^3.953.0 | AWS Key Management |
| `@aws-sdk/client-s3` | ^3.953.0 | AWS S3 storage |
| `node-vault` | ^0.10.9 | HashiCorp Vault |

### Application Performance Monitoring

| Package | Version | Purpose |
|---------|---------|---------|
| `@sentry/node` | ^10.32.1 | Error tracking |
| `@sentry/profiling-node` | ^10.32.1 | Performance profiling |
| `pino` | ^10.1.0 | Logging |
| `pino-pretty` | ^13.1.3 | Log formatting |

---

## Frontend Dependencies

### React Core

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI library |
| `react-dom` | ^18.3.1 | DOM rendering |
| `wouter` | ^3.3.5 | Client-side routing |
| `@tanstack/react-query` | ^5.60.5 | Server state management |

### UI Component Library (Radix UI)

| Package | Version | Purpose |
|---------|---------|---------|
| `@radix-ui/react-dialog` | ^1.1.7 | Modal dialogs |
| `@radix-ui/react-dropdown-menu` | ^2.1.7 | Dropdown menus |
| `@radix-ui/react-tabs` | ^1.1.4 | Tab navigation |
| `@radix-ui/react-select` | ^2.1.7 | Select inputs |
| `@radix-ui/react-tooltip` | ^1.2.0 | Tooltips |
| `@radix-ui/react-toast` | ^1.2.7 | Toast notifications |
| `@radix-ui/react-accordion` | ^1.2.4 | Accordions |
| `@radix-ui/react-checkbox` | ^1.1.5 | Checkboxes |
| `@radix-ui/react-switch` | ^1.1.4 | Toggle switches |
| `@radix-ui/react-slider` | ^1.2.4 | Range sliders |
| `@radix-ui/react-progress` | ^1.1.3 | Progress bars |
| `@radix-ui/react-avatar` | ^1.1.4 | User avatars |
| `@radix-ui/react-scroll-area` | ^1.2.4 | Custom scrollbars |
| `@radix-ui/react-popover` | ^1.1.7 | Popovers |
| `@radix-ui/react-label` | ^2.1.3 | Form labels |
| `@radix-ui/react-radio-group` | ^1.2.4 | Radio buttons |
| `@radix-ui/react-separator` | ^1.1.3 | Visual separators |
| `@radix-ui/react-collapsible` | ^1.1.4 | Collapsible sections |
| `@radix-ui/react-context-menu` | ^2.2.7 | Context menus |
| `@radix-ui/react-hover-card` | ^1.1.7 | Hover cards |
| `@radix-ui/react-menubar` | ^1.1.7 | Menu bars |
| `@radix-ui/react-navigation-menu` | ^1.2.6 | Navigation menus |
| `@radix-ui/react-slot` | ^1.2.0 | Slot composition |
| `@radix-ui/react-toggle` | ^1.1.3 | Toggle buttons |
| `@radix-ui/react-toggle-group` | ^1.1.3 | Toggle groups |
| `@radix-ui/react-alert-dialog` | ^1.1.7 | Alert dialogs |
| `@radix-ui/react-aspect-ratio` | ^1.1.3 | Aspect ratio containers |

### Styling

| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | ^3.4.17 | Utility-first CSS |
| `tailwind-merge` | ^2.6.0 | Class name merging |
| `tailwindcss-animate` | ^1.0.7 | Animation utilities |
| `tw-animate-css` | ^1.2.5 | CSS animations |
| `class-variance-authority` | ^0.7.1 | Component variants |
| `clsx` | ^2.1.1 | Conditional classes |

### Animation & Motion

| Package | Version | Purpose |
|---------|---------|---------|
| `framer-motion` | ^11.13.1 | Animation library |
| `@react-spring/web` | ^10.0.3 | Spring animations |

### Data Visualization

| Package | Version | Purpose |
|---------|---------|---------|
| `recharts` | ^2.15.2 | Chart library |
| `echarts` | ^6.0.0 | Enterprise charts |
| `echarts-for-react` | ^3.0.5 | ECharts React wrapper |
| `@xyflow/react` | ^12.9.2 | Flow diagrams |
| `dagre` | ^0.8.5 | Graph layout |

### Form & Input

| Package | Version | Purpose |
|---------|---------|---------|
| `react-hook-form` | ^7.55.0 | Form state management |
| `@hookform/resolvers` | ^3.10.0 | Form validation |
| `input-otp` | ^1.4.2 | OTP input |
| `react-day-picker` | ^8.10.1 | Date picker |
| `cmdk` | ^1.1.1 | Command palette |

### Content Display

| Package | Version | Purpose |
|---------|---------|---------|
| `react-markdown` | ^10.1.0 | Markdown rendering |
| `react-syntax-highlighter` | ^16.1.0 | Code highlighting |
| `rehype-katex` | ^7.0.1 | Math equations |
| `remark-math` | ^6.0.0 | Math parsing |
| `lucide-react` | ^0.453.0 | Icon library |
| `react-icons` | ^5.4.0 | Icon library |

---

## File Processing Dependencies

### Document Generation

| Package | Version | Purpose |
|---------|---------|---------|
| `pdfkit` | ^0.17.2 | PDF generation |
| `docx` | ^9.5.1 | Word document generation |
| `pptxgenjs` | ^4.0.1 | PowerPoint generation |
| `exceljs` | ^4.4.0 | Excel file handling |

### Document Parsing

| Package | Version | Purpose |
|---------|---------|---------|
| `pdf-parse` | ^2.4.5 | PDF text extraction |
| `multer` | ^2.0.2 | File upload handling |

---

## Development Dependencies

### Build Tools

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^7.3.0 | Build tool & dev server |
| `@vitejs/plugin-react` | ^4.7.0 | React plugin |
| `esbuild` | ^0.25.0 | JavaScript bundler |
| `tsx` | ^4.20.5 | TypeScript execution |
| `typescript` | 5.6.3 | TypeScript compiler |

### Type Definitions

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/express` | 4.17.21 | Express types |
| `@types/react` | ^18.3.11 | React types |
| `@types/node` | 20.16.11 | Node.js types |
| `@types/ws` | ^8.5.13 | WebSocket types |
| `@types/bcryptjs` | ^2.4.6 | bcrypt types |
| `@types/multer` | ^2.0.0 | Multer types |
| `@types/pg` | ^8.16.0 | PostgreSQL types |

### Testing

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^4.0.13 | Test runner |
| `@vitest/ui` | ^4.0.13 | Test UI |

---

## Environment Variables Required

### Required Variables

```bash
# Database (Required)
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# Session Security (Required)
SESSION_SECRET="your-secure-session-secret-min-32-chars"
```

### AI Provider Keys (At least one required)

```bash
# OpenAI
OPENAI_API_KEY="sk-..."

# Azure OpenAI
AZURE_OPENAI_API_KEY="..."
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
AZURE_OPENAI_DEPLOYMENT="gpt-4"

# Anthropic Claude
ANTHROPIC_API_KEY="sk-ant-..."

# Google Gemini
GOOGLE_API_KEY="..."

# Perplexity (optional)
PERPLEXITY_API_KEY="pplx-..."
```

### Optional Services

```bash
# Azure Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_KEY="..."
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="..."

# Payment Gateways
RAZORPAY_KEY_ID="rzp_..."
RAZORPAY_KEY_SECRET="..."
CASHFREE_APP_ID="..."
CASHFREE_SECRET_KEY="..."

# Accounting Integrations
QUICKBOOKS_CLIENT_ID="..."
QUICKBOOKS_CLIENT_SECRET="..."
XERO_CLIENT_ID="..."
XERO_CLIENT_SECRET="..."

# Redis (for production sessions)
REDIS_URL="redis://..."

# Sentry (error tracking)
SENTRY_DSN="..."
```

---

## Dependency Version Matrix

| Node.js Version | Status | Notes |
|-----------------|--------|-------|
| 20.x | ✅ Recommended | Full support |
| 22.x | ✅ Supported | May require --experimental flags |
| 18.x | ⚠️ Limited | Some features may not work |

| PostgreSQL Version | Status | Notes |
|--------------------|--------|-------|
| 15.x | ✅ Recommended | Full support |
| 14.x | ✅ Supported | Full support |
| 13.x | ⚠️ Limited | Missing some JSON features |

---

## Troubleshooting Common Issues

### Installation Issues

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Fix peer dependency issues
npm install --legacy-peer-deps
```

### Database Connection Issues

```bash
# Test database connection
npm run test-db-connection

# Check SSL requirements
# Ensure DATABASE_URL includes ?sslmode=require
```

### Build Issues

```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Rebuild
npm run build
```

---

*This document is auto-generated and should be updated when dependencies change.*
