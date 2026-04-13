# ICAI CAGPT AI Coding Instructions

## ⚠️ CRITICAL: Excel-First Computation Rule

**ALL FINANCIAL CALCULATIONS MUST USE EXCEL FORMULAS - NO LLM ARITHMETIC**

When the AI responds to calculation queries (NPV, IRR, tax, ratios, depreciation, etc.):
- ❌ **NEVER** compute numeric values (e.g., "NPV = $5,251,123.64")
- ❌ **NEVER** perform arithmetic operations (multiplication, division, summation)
- ❌ **NEVER** calculate present values, tax amounts, or ratios yourself
- ✅ **ALWAYS** provide Excel formulas (=NPV(), =IRR(), =SUM(), etc.)
- ✅ **ALWAYS** set up input data with cell references (A1, B2, etc.)
- ✅ **ALWAYS** let Excel compute the final values

**Example Correct Response:**
```
| Metric | Excel Formula | Cell |
|--------|---------------|------|
| NPV    | =NPV(B1,C3:C7)+B2 | D1 |
| IRR    | =IRR(B2:C7)   | D2 |

Download the Excel file to see computed values.
```

**Example WRONG Response:**
```
NPV = $5,251,123.64  ← WRONG: LLM computed the value
Year 1 PV = $1,141,552.51 ← WRONG: LLM did the math
```

## Architecture Overview

ICAI CAGPT is a full-stack TypeScript application providing intelligent accounting/tax advisory services. Key components:

- **Frontend**: React + Vite, TailwindCSS, Radix UI components, Wouter routing
- **Backend**: Express.js with TypeScript, PostgreSQL + Drizzle ORM, WebSocket for real-time chat
- **AI Services**: Multi-provider orchestration (OpenAI, Azure OpenAI, Anthropic, Google Gemini) with intelligent routing
- **Security**: Military-grade encryption, rate limiting, session management, file virus scanning

## Core Patterns & Conventions

### Service-Oriented Architecture
Services in `server/services/` follow single responsibility principle:
```typescript
// Example: aiOrchestrator.ts coordinates multiple AI providers and solvers
export class AIOrchestrator {
  async processQuery(query: string, history: Message[], userTier: string): Promise<OrchestrationResult>
}
```

### Database Schema Pattern
All tables use consistent patterns in `shared/schema.ts`:
- UUID primary keys with `gen_random_uuid()`
- Timestamps: `createdAt`, `updatedAt` (auto-managed)
- Soft deletes with `deletedAt` where applicable
- JSONB columns for flexible metadata
- Proper indexing on foreign keys and query patterns

### Chat Mode Normalization
Always use `normalizeChatMode()` from `server/services/chatModeNormalizer.ts`:
```typescript
const chatMode = normalizeChatMode(options?.chatMode); // 'research' → 'deep-research'
```

### AI Provider Orchestration
The system automatically routes queries through health-aware provider chains:
1. **Query Triage** (`queryTriage.ts`) - Classifies domain, jurisdiction, complexity
2. **Model Routing** - Selects optimal AI model based on classification
3. **Health Monitoring** - Tracks provider health and implements failover
4. **Solver Integration** - Triggers financial calculators when needed

## Critical Workflows

### Development Commands
```bash
# Development (runs both client and server with hot reload)
npm run dev

# Database migrations
npm run db:push

# Type checking
npm run check

# Production build
npm run build && npm start
```

### File Upload Processing
Files go through a security pipeline:
1. **Multer** validation (MIME type, size limits)
2. **Virus scanning** (ClamAV or cloud providers)
3. **Encryption** before storage using AES-256-GCM
4. **Document analysis** (Azure Document Intelligence for text extraction)

### Authentication Flow
Session-based authentication with security features:
- Rate limiting on auth endpoints
- MFA support with TOTP and backup codes
- Account lockout after failed attempts
- GDPR compliance tracking

## Service Boundaries

### AI Orchestration Layer
- **aiOrchestrator.ts**: Main coordination service
- **queryTriage.ts**: Query classification and routing
- **chatModeNormalizer.ts**: Ensures consistent mode naming
- **reasoningGovernor.ts**: Chain-of-thought enhancement
- **complianceSentinel.ts**: Response validation

### Financial Services
- **financialSolvers.ts**: Tax calculations, NPV, IRR, depreciation
- **accountingIntegrations.ts**: QuickBooks, Xero, etc.
- **scenarioSolver.ts**: Regulatory scenario simulations

### Document Services
- **documentAnalyzer.ts**: OCR and text extraction
- **deliverableGenerator.ts**: Professional document creation
- **forensicAnalyzer.ts**: Document intelligence for audits

### Security Services
- **virusScanService.ts**: File security scanning
- **keyVaultService.ts**: Encryption key management
- **mfaService.ts**: Multi-factor authentication

## Key Integration Points

### AI Provider Registry
All AI providers implement consistent interface in `server/services/aiProviders/`:
```typescript
interface AIProvider {
  generateCompletion(params: CompletionParams): Promise<CompletionResponse>
}
```

### Database Access Pattern
Use storage service (`server/pgStorage.ts`) not direct Drizzle calls:
```typescript
// Correct
const user = await storage.getUserById(id);

// Avoid direct queries except in storage service
const user = await db.select().from(users).where(eq(users.id, id));
```

### Real-time Communication
WebSocket connections in `server/websocket.ts` for chat streaming:
- Session-based authentication for WS connections
- Message chunking for large responses
- Automatic reconnection handling

## Development Guidelines

### Error Handling
Use structured error responses:
```typescript
return res.status(400).json({ 
  error: "Validation failed",
  details: validationErrors 
});
```

### Environment Configuration
Required environment variables documented in `CONFIGURATION_GUIDE.md`:
- `DATABASE_URL`: PostgreSQL connection
- `OPENAI_API_KEY`, `AZURE_OPENAI_*`: AI provider credentials
- `ENCRYPTION_KEY`: File encryption (auto-generated if missing)
- `SESSION_SECRET`: Session encryption

### Type Safety
Leverage Zod schemas from `shared/schema.ts` for validation:
```typescript
const validatedData = insertConversationSchema.parse(req.body);
```

### Frontend State Management
- **React Query** for server state caching
- **Zustand** for client state (auth, UI preferences)
- **Context providers** for cross-component data

## Code Organization

### Monorepo Structure
- `client/`: React frontend with path aliases (`@/` → `client/src/`)
- `server/`: Express backend with services architecture
- `shared/`: Common types, schemas, utilities
- `attached_assets/`: Uploaded documents and generated assets

### Import Patterns
```typescript
// Shared utilities
import { normalizeChatMode } from '@shared/utils';

// Internal services  
import { aiOrchestrator } from './services/aiOrchestrator';

// Frontend components
import { Button } from '@/components/ui/button';
```

### Component Architecture
- **UI components** in `client/src/components/ui/` (Radix-based)
- **Feature components** in `client/src/components/`
- **Page components** in `client/src/pages/`
- **Custom hooks** in `client/src/hooks/`

## Testing & Quality

### File Processing Pipeline
When working with file uploads:
1. Always validate MIME types in multer config
2. Use virus scanning before processing
3. Encrypt files before disk storage
4. Extract text with document analyzer before AI processing

### AI Response Quality
The system includes quality monitoring:
- **Compliance Sentinel**: Validates responses against professional standards
- **Validation Agent**: Checks factual accuracy and calculations
- **Quality Scoring**: Numerical assessment of response quality

### Performance Considerations
- AI provider health monitoring prevents cascade failures
- Database queries use proper indexing (see schema indexes)
- File uploads stream through memory to avoid disk bottlenecks
- WebSocket connections pool for scalability

When extending ICAI CAGPT, maintain these architectural patterns and leverage the existing service abstractions for consistency and reliability.