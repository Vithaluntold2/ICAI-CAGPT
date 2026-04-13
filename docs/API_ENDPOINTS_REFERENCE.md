# ICAI CAGPT API Endpoints Reference

> **Document Version:** 1.0  
> **Last Updated:** December 28, 2025  
> **Category:** API Reference

---

## Table of Contents

1. [Overview](#overview)
2. [Base Configuration](#base-configuration)
3. [Authentication Endpoints](#authentication-endpoints)
4. [MFA/2FA Endpoints](#mfa2fa-endpoints)
5. [Profile Endpoints](#profile-endpoints)
6. [Conversation Endpoints](#conversation-endpoints)
7. [Chat Endpoints](#chat-endpoints)
8. [File Upload Endpoints](#file-upload-endpoints)
9. [Export Endpoints](#export-endpoints)
10. [Excel API Endpoints](#excel-api-endpoints)
11. [Payment Endpoints](#payment-endpoints)
12. [Subscription Endpoints](#subscription-endpoints)
13. [Integration Endpoints](#integration-endpoints)
14. [Analytics Endpoints](#analytics-endpoints)
15. [Admin Endpoints](#admin-endpoints)
16. [System Monitoring Endpoints](#system-monitoring-endpoints)
17. [GDPR Compliance Endpoints](#gdpr-compliance-endpoints)
18. [Support Ticket Endpoints](#support-ticket-endpoints)
19. [Health Check Endpoints](#health-check-endpoints)

---

## Overview

ICAI CAGPT exposes a comprehensive REST API with **120+ endpoints** organized by domain:

| Domain | Endpoints | Auth Required | Rate Limited |
|--------|-----------|---------------|--------------|
| Authentication | 10 | Partial | Yes |
| Profiles | 8 | Yes | No |
| Conversations | 12 | Yes | No |
| Chat | 3 | Yes | Yes |
| Files | 6 | Yes | Yes |
| Payments | 8 | Partial | No |
| Admin | 20+ | Yes + Admin | No |
| System | 15 | Yes + SuperAdmin | No |

---

## Base Configuration

### API Base URL

```
Development: http://localhost:5000/api
Production:  https://cagpt.icai.org/api
```

### Authentication

All authenticated endpoints require a session cookie:

```
Cookie: luca.sid=s%3A<session-id>.<signature>
```

### Common Response Formats

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "details": { ... }
}
```

---

## Authentication Endpoints

### POST /api/auth/register

Register a new user account.

**Rate Limited:** Yes (authRateLimiter)

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "username": "johndoe"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "subscriptionTier": "free",
    "isAdmin": false,
    "createdAt": "2025-12-28T00:00:00Z"
  }
}
```

**Error Responses:**
- `400` - Validation failed / Email already registered
- `503` - Database connection issue

---

### POST /api/auth/login

Authenticate user and establish session.

**Rate Limited:** Yes (authRateLimiter)

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200) - MFA Not Enabled:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "subscriptionTier": "free"
  }
}
```

**Response (200) - MFA Required:**
```json
{
  "mfaRequired": true,
  "userId": "uuid",
  "message": "Please enter your 2FA code"
}
```

**Error Responses:**
- `401` - Invalid credentials
- `423` - Account locked (too many failed attempts)
- `503` - Database connection issue

---

### POST /api/auth/logout

Destroy user session.

**Response (200):**
```json
{
  "success": true
}
```

---

### GET /api/auth/me

Get current authenticated user.

**Auth Required:** Yes

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "subscriptionTier": "free",
    "mfaEnabled": false
  }
}
```

---

## MFA/2FA Endpoints

### POST /api/mfa/setup

Initialize MFA setup for authenticated user.

**Auth Required:** Yes

**Response (200):**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,...",
  "message": "Scan this QR code with your authenticator app"
}
```

---

### POST /api/mfa/enable

Enable MFA after verifying TOTP token.

**Auth Required:** Yes

**Request Body:**
```json
{
  "token": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "backupCodes": ["ABC123", "DEF456", ...],
  "message": "MFA enabled successfully"
}
```

---

### POST /api/mfa/disable

Disable MFA (requires password confirmation).

**Auth Required:** Yes

**Request Body:**
```json
{
  "password": "currentPassword"
}
```

---

### POST /api/mfa/verify

Verify MFA token during login.

**Request Body:**
```json
{
  "userId": "uuid",
  "token": "123456",
  "useBackupCode": false
}
```

---

## Profile Endpoints

### GET /api/profiles

Get all profiles for current user.

**Auth Required:** Yes

**Response (200):**
```json
{
  "profiles": [
    {
      "id": "uuid",
      "userId": "uuid",
      "name": "Personal",
      "type": "personal",
      "isDefault": true
    }
  ]
}
```

---

### POST /api/profiles

Create a new profile.

**Auth Required:** Yes

**Request Body:**
```json
{
  "name": "My Business",
  "type": "business",
  "description": "Main business profile",
  "isDefault": false
}
```

**Valid Profile Types:** `personal`, `business`, `family`

---

### GET /api/profiles/:id

Get a specific profile.

**Auth Required:** Yes

---

### PATCH /api/profiles/:id

Update a profile.

**Auth Required:** Yes

---

### DELETE /api/profiles/:id

Delete a profile (cannot delete default profile).

**Auth Required:** Yes

---

### GET /api/profiles/:profileId/members

Get members of a family profile.

**Auth Required:** Yes

---

### POST /api/profiles/:profileId/members

Add member to a family profile.

**Auth Required:** Yes

**Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "relationship": "spouse",
  "role": "member"
}
```

---

## Conversation Endpoints

### GET /api/conversations

Get all conversations for current user.

**Auth Required:** Yes

**Query Parameters:**
- `profileId` (optional) - Filter by profile ID or `null` for unassigned

**Response (200):**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "title": "Tax Question",
      "preview": "What are the...",
      "pinned": false,
      "createdAt": "2025-12-28T00:00:00Z",
      "updatedAt": "2025-12-28T00:00:00Z"
    }
  ]
}
```

---

### POST /api/conversations

Create a new conversation.

**Auth Required:** Yes

**Request Body:**
```json
{
  "title": "Tax Planning 2025",
  "preview": "Initial question...",
  "profileId": "uuid"
}
```

---

### GET /api/conversations/:id/messages

Get all messages in a conversation.

**Auth Required:** Yes

**Response (200):**
```json
{
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "What is depreciation?",
      "createdAt": "2025-12-28T00:00:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "Depreciation is...",
      "modelUsed": "gpt-4o",
      "createdAt": "2025-12-28T00:00:01Z"
    }
  ]
}
```

---

### PATCH /api/conversations/:id/pin

Toggle pin status of a conversation.

**Auth Required:** Yes

---

### PATCH /api/conversations/:id/rename

Rename a conversation.

**Auth Required:** Yes

**Request Body:**
```json
{
  "title": "New Title"
}
```

---

### PATCH /api/conversations/:id/feedback

Update conversation feedback (rating, resolved status).

**Auth Required:** Yes

**Request Body:**
```json
{
  "qualityScore": 5,
  "resolved": true,
  "userFeedback": "Very helpful!"
}
```

---

### POST /api/conversations/:id/share

Generate a shareable link for a conversation.

**Auth Required:** Yes

**Response (200):**
```json
{
  "success": true,
  "shareUrl": "https://cagpt.icai.org/shared/abc123",
  "sharedToken": "abc123"
}
```

---

### DELETE /api/conversations/:id/share

Remove sharing from a conversation.

**Auth Required:** Yes

---

### DELETE /api/conversations/:id

Delete a conversation.

**Auth Required:** Yes

---

### POST /api/conversations/:id/auto-title

Auto-generate title using AI.

**Auth Required:** Yes

---

### GET /api/conversations/:conversationId/messages/:messageId/excel

Download Excel file attached to a message.

**Auth Required:** Yes

**Response:** Binary Excel file (`.xlsx`)

---

## Chat Endpoints

### POST /api/chat

Send a message and get AI response (non-streaming).

**Auth Required:** Yes  
**Rate Limited:** Yes (chatRateLimiter)

**Request Body:**
```json
{
  "conversationId": "uuid",
  "message": "What is FIFO inventory?",
  "profileId": "uuid",
  "chatMode": "standard",
  "documentAttachment": {
    "data": "base64...",
    "type": "application/pdf",
    "filename": "invoice.pdf"
  }
}
```

**Valid Chat Modes:**
- `standard` - General accounting questions
- `deep-research` - Comprehensive research mode
- `calculation` - Financial calculations
- `forensic` - Forensic analysis
- `regulatory` - Regulatory compliance
- `cot-research` - Chain-of-thought research
- `cot-calculation` - Chain-of-thought calculations

**Response (200):**
```json
{
  "conversationId": "uuid",
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "FIFO (First In, First Out) is...",
    "timestamp": "2025-12-28T00:00:00Z"
  },
  "metadata": {
    "modelUsed": "gpt-4o",
    "classification": { ... },
    "tokensUsed": 450,
    "processingTimeMs": 2500
  }
}
```

---

### POST /api/chat/stream

Send a message with Server-Sent Events streaming response.

**Auth Required:** Yes  
**Rate Limited:** Yes (chatRateLimiter)

**Request Body:** Same as `/api/chat`

**Response:** SSE stream

```
data: {"type":"start","conversationId":"uuid","messageId":"uuid"}

data: {"type":"chunk","content":"FIFO "}

data: {"type":"chunk","content":"stands for "}

data: {"type":"end","messageId":"uuid","metadata":{"tokensUsed":450}}
```

---

### POST /api/chat/upload-file

Upload a file for chat context.

**Auth Required:** Yes  
**Rate Limited:** Yes (chatRateLimiter)

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file` - The file to upload

**Allowed MIME Types:**
- `application/pdf`
- `image/png`, `image/jpeg`, `image/tiff`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `application/vnd.ms-excel`
- `text/csv`, `text/plain`

**Response (200):**
```json
{
  "success": true,
  "file": {
    "name": "invoice.pdf",
    "size": 125000,
    "type": "application/pdf",
    "base64Data": "...",
    "documentType": "invoice"
  }
}
```

---

## File Upload Endpoints

### POST /api/tax-files/upload

Upload a tax file from tax software vendors.

**Auth Required:** Yes  
**Rate Limited:** Yes (fileUploadRateLimiter)

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file` - The tax file
- `vendor` - One of: `drake`, `turbotax`, `hrblock`, `adp`
- `formType` (optional) - Form type identifier

**Response (200):**
```json
{
  "success": true,
  "file": {
    "id": "uuid",
    "filename": "w2-2024.pdf",
    "vendor": "turbotax",
    "size": 50000,
    "scanStatus": "pending"
  }
}
```

---

### GET /api/tax-files

List all uploaded tax files.

**Auth Required:** Yes

**Query Parameters:**
- `vendor` (optional) - Filter by vendor

---

### GET /api/tax-files/:id/download

Download an uploaded tax file.

**Auth Required:** Yes

**Response:** Binary file with original content

---

### DELETE /api/tax-files/:id

Delete an uploaded tax file.

**Auth Required:** Yes

---

## Export Endpoints

### POST /api/export

Export content to various formats.

**Auth Required:** Yes

**Request Body:**
```json
{
  "content": "# Report\n\nContent here...",
  "visualization": {
    "type": "bar",
    "data": [...]
  },
  "format": "pdf",
  "title": "Financial Report"
}
```

**Supported Formats:**
- `docx` - Microsoft Word
- `pdf` - PDF document
- `pptx` - PowerPoint
- `xlsx` - Excel
- `csv` - CSV file
- `txt` - Plain text

**Response:** Binary file download

---

## Excel API Endpoints

### POST /api/excel/generate-formula

Generate Excel formula from natural language.

**Auth Required:** Yes  
**Rate Limited:** Yes

**Request Body:**
```json
{
  "prompt": "Calculate compound interest with monthly compounding",
  "context": {
    "principal": "B2",
    "rate": "B3",
    "periods": "B4"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "formula": "=B2*(1+B3/12)^(B4*12)",
  "timestamp": "2025-12-28T00:00:00Z"
}
```

---

### POST /api/excel/generate-vba

Generate VBA macro from natural language.

**Auth Required:** Yes

**Request Body:**
```json
{
  "prompt": "Create a macro that formats all currency cells",
  "macroType": "subroutine"
}
```

---

### POST /api/excel/generate-model

Generate a complete financial model.

**Auth Required:** Yes

**Request Body:**
```json
{
  "modelType": "dcf",
  "params": {
    "projectionYears": 5,
    "wacc": 0.10
  }
}
```

**Valid Model Types:** `dcf`, `lbo`, `3-statement`, `budget`

**Response:** Binary Excel file

---

### POST /api/excel/generate-custom-template

Generate an ad-hoc custom Excel template.

**Auth Required:** Yes

**Request Body:**
```json
{
  "description": "Monthly expense tracker for small business",
  "industry": "retail",
  "purpose": "expense-tracking",
  "dataFields": ["date", "category", "amount", "vendor"],
  "calculationNeeds": ["monthly totals", "category breakdown"],
  "numberOfRows": 100,
  "reportingFrequency": "monthly"
}
```

---

### POST /api/excel/parse

Upload and parse an Excel file.

**Auth Required:** Yes

**Content-Type:** `multipart/form-data`

**Response (200):**
```json
{
  "success": true,
  "data": [["Header1", "Header2"], ["Value1", "Value2"]],
  "rows": 100,
  "columns": 5
}
```

---

### POST /api/excel/generate-from-prompt

Generate Excel from AI prompt.

**Auth Required:** Yes

**Request Body:**
```json
{
  "prompt": "Create a budget tracker with expense categories",
  "uploadedData": null
}
```

---

## Payment Endpoints

### GET /api/payments/plans

Get all available subscription plans.

**Response (200):**
```json
{
  "plans": [
    {
      "id": "plus-monthly",
      "name": "Plus",
      "tier": "plus",
      "price": 1999,
      "currency": "INR",
      "duration": "monthly"
    }
  ]
}
```

---

### POST /api/payments/create-order

Create a payment order.

**Auth Required:** Yes

**Request Body:**
```json
{
  "plan": "professional",
  "billingCycle": "annual",
  "currency": "USD"
}
```

**Response (200):**
```json
{
  "orderId": "order_xxx",
  "amount": 14999,
  "currency": "USD",
  "razorpayKeyId": "rzp_xxx"
}
```

---

### POST /api/payments/verify

Verify payment and activate subscription.

**Auth Required:** Yes

**Request Body:**
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "sig_xxx"
}
```

---

### GET /api/payments/history

Get payment history.

**Auth Required:** Yes

---

### POST /api/webhooks/razorpay

Razorpay webhook handler.

**Auth Required:** No (signature verified)

---

## Subscription Endpoints

### GET /api/subscription

Get current user's subscription and usage quota.

**Auth Required:** Yes

**Response (200):**
```json
{
  "subscription": {
    "plan": "professional",
    "status": "active",
    "currentPeriodEnd": "2026-01-28T00:00:00Z"
  },
  "quota": {
    "queriesUsed": 150,
    "queriesLimit": 1000,
    "documentsUsed": 25,
    "documentsLimit": 100
  }
}
```

---

### POST /api/subscription/upgrade

Upgrade subscription tier.

**Auth Required:** Yes

**Request Body:**
```json
{
  "tier": "enterprise"
}
```

---

### POST /api/subscription/cancel

Cancel subscription.

**Auth Required:** Yes

---

### GET /api/pricing

Get pricing for all plans.

**Query Parameters:**
- `currency` - One of: `USD`, `INR`, `AED`, `CAD`, `IDR`, `TRY`

---

### GET /api/pricing/:currency

Get pricing for specific currency (path parameter version).

---

## Integration Endpoints

### GET /api/integrations

Get all connected integrations.

**Auth Required:** Yes

---

### POST /api/integrations/:provider/initiate

Initiate OAuth flow for an integration.

**Auth Required:** Yes

**Valid Providers:** `quickbooks`, `xero`, `zoho`, `adp`

**Response (200):**
```json
{
  "authUrl": "https://appcenter.intuit.com/connect/oauth2?...",
  "provider": "quickbooks"
}
```

---

### GET /api/integrations/callback

OAuth callback handler.

---

### DELETE /api/integrations/:id

Disconnect an integration.

**Auth Required:** Yes

---

## Analytics Endpoints

### GET /api/analytics

Get user analytics and insights.

**Auth Required:** Yes

**Response (200):**
```json
{
  "behavior": { ... },
  "conversations": [ ... ],
  "sentimentTrends": [ ... ],
  "summary": {
    "totalConversations": 50,
    "averageQualityScore": 85,
    "topTopics": [...]
  },
  "userFeedback": {
    "resolvedCount": 45,
    "resolutionRate": 90,
    "averageUserRating": "4.5"
  }
}
```

---

### GET /api/usage

Get current month's usage.

**Auth Required:** Yes

**Response (200):**
```json
{
  "usage": {
    "queriesUsed": 75,
    "documentsAnalyzed": 10,
    "tokensUsed": 50000
  }
}
```

---

## Admin Endpoints

### GET /api/admin/dashboard

Get admin dashboard KPIs.

**Auth Required:** Yes + Admin

---

### GET /api/admin/users

Get all users.

**Auth Required:** Yes + Admin

---

### PATCH /api/admin/users/:id

Update user settings.

**Auth Required:** Yes + Admin

**Request Body:**
```json
{
  "subscriptionTier": "professional",
  "isAdmin": true
}
```

---

### PATCH /api/admin/users/:id/tier

Update user subscription tier.

**Auth Required:** Yes + Admin

---

### PATCH /api/admin/users/:id/toggle-admin

Toggle admin status.

**Auth Required:** Yes + Admin

---

### GET /api/admin/tickets

Get all support tickets.

**Auth Required:** Yes + Admin

---

### PATCH /api/admin/tickets/:id

Update ticket status.

**Auth Required:** Yes + Admin

---

### GET /api/admin/audit-logs

Get audit logs.

**Auth Required:** Yes + Admin

**Query Parameters:**
- `limit` (default: 100)

---

### GET /api/admin/analytics/overview

Get analytics overview.

**Auth Required:** Yes + Admin

---

### GET /api/admin/analytics/users/:userId

Get user-specific analytics.

**Auth Required:** Yes + Admin

---

### GET /api/admin/analytics/churn-risks

Get high churn risk users.

**Auth Required:** Yes + Admin

---

### POST /api/admin/analytics/batch-process

Trigger batch analytics processing.

**Auth Required:** Yes + Admin

---

### GET /api/admin/ai-providers/health

Get AI provider health status.

**Auth Required:** Yes + Admin

---

### POST /api/admin/ai-providers/:provider/reset-health

Reset health metrics for a provider.

**Auth Required:** Yes + Admin

---

### GET /api/admin/coupons

Get all coupons.

**Auth Required:** Yes + Admin

---

### POST /api/admin/coupons

Create a coupon.

**Auth Required:** Yes + Admin

---

### GET /api/admin/subscriptions

Get all subscriptions with user info.

**Auth Required:** Yes + Admin

---

## System Monitoring Endpoints

### GET /api/admin/system/health

Get system health metrics.

**Auth Required:** Yes + SuperAdmin

---

### GET /api/admin/system/threats

Get security threats.

**Auth Required:** Yes + SuperAdmin

---

### GET /api/admin/system/routes

Get route health.

**Auth Required:** Yes + SuperAdmin

---

### GET /api/admin/system/integrations

Check integration health.

**Auth Required:** Yes + SuperAdmin

---

### GET /api/admin/system/alerts

Get active alerts.

**Auth Required:** Yes + SuperAdmin

---

### POST /api/admin/system/alerts/:id/resolve

Resolve an alert.

**Auth Required:** Yes + SuperAdmin

---

### GET /api/admin/system/maintenance

Get scheduled maintenances.

**Auth Required:** Yes + SuperAdmin

---

### POST /api/admin/system/maintenance/schedule

Schedule maintenance window.

**Auth Required:** Yes + SuperAdmin

---

### POST /api/admin/system/deployments/start

Start a deployment.

**Auth Required:** Yes + SuperAdmin

---

### POST /api/admin/system/deployments/:id/rollback

Rollback a deployment.

**Auth Required:** Yes + SuperAdmin

---

## GDPR Compliance Endpoints

### POST /api/gdpr/consent

Record GDPR consent.

**Auth Required:** Yes

**Request Body:**
```json
{
  "consentType": "analytics",
  "consented": true
}
```

---

### GET /api/gdpr/export

Export all user data (GDPR data portability).

**Auth Required:** Yes

---

### DELETE /api/gdpr/delete-account

Delete user account and all data (GDPR right to erasure).

**Auth Required:** Yes

---

## Support Ticket Endpoints

### GET /api/tickets

Get user's support tickets.

**Auth Required:** Yes

---

### POST /api/tickets

Create a support ticket.

**Auth Required:** Yes

**Request Body:**
```json
{
  "subject": "Issue with calculations",
  "category": "bug",
  "priority": "high",
  "message": "Detailed description..."
}
```

---

### GET /api/tickets/:id

Get ticket details with messages.

**Auth Required:** Yes

---

### POST /api/tickets/:id/messages

Add message to ticket.

**Auth Required:** Yes

---

## Health Check Endpoints

### GET /api/health

Basic health check (no auth).

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-28T00:00:00Z",
  "uptime": 86400,
  "checks": {
    "database": { "status": "ok", "latency": 5 },
    "aiProviders": { "status": "ok" }
  },
  "responseTime": 15
}
```

---

### GET /api/health/azure

Check Azure services health.

**Response (200):**
```json
[
  {
    "service": "Azure OpenAI",
    "status": "healthy",
    "message": "Deployment: gpt-4"
  },
  {
    "service": "Azure Document Intelligence",
    "status": "healthy"
  }
]
```

---

### GET /api/features

Get available feature flags.

**Response (200):**
```json
{
  "features": {
    "DOCUMENT_ANALYSIS": true,
    "KNOWLEDGE_GRAPH": false,
    "ADVANCED_REASONING": true
  },
  "environment": {
    "nodeEnv": "production",
    "hasDatabase": true
  }
}
```

---

### GET /api/agents/capabilities/:mode

Get capabilities for a specific agent mode.

**Auth Required:** Yes

---

## Rate Limiting

| Limiter | Endpoints | Window | Max Requests |
|---------|-----------|--------|--------------|
| authRateLimiter | /auth/* | 15 min | 10 |
| chatRateLimiter | /chat/* | 1 min | 20 |
| fileUploadRateLimiter | File uploads | 15 min | 20 |
| integrationRateLimiter | OAuth flows | 15 min | 5 |

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 423 | Locked - Account locked |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable - Database/service down |

---

*This document is auto-generated from the routes.ts file and should be updated when endpoints change.*
