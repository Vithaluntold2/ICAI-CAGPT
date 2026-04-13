# AI Roundtable Implementation Plan

## Executive Summary

The AI Roundtable feature is **35% complete** — backend agents are production-ready, but zero API connectivity exists. This plan outlines the exact steps needed to make it functional.

---

## Current State Assessment

| Component | Completion | Status |
|-----------|------------|--------|
| Backend Agents (6) | 100% | ✅ Ready in `server/services/agents/roundtableAgents.ts` |
| Agent Registration | 100% | ✅ Registered in `serve[
  {
    "Particulars": "At 1 January 2023",
    "_originalIndex": 0,
    "Share_Capital": 10,
    "Share_Premium": 0,
    "Other_Reserves": 11355,
    "Contribution_From_Shareholders": 4016,
    "Statutory_Reserve": 14,
    "Retained_Earnings": 82182,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 9019,
    "Total_Equity": 106596,
    "notes": "",
    "_rowType": "opening",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2023"
  },
  {
    "Particulars": "Profit for the year",
    "_originalIndex": 1,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 207780,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 207780,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "Total comprehensive income for the year"
  },
  {
    "Particulars": "Other comprehensive income",
    "_originalIndex": 2,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 13156,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 0,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 13156,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "Total comprehensive income for the year"
  },
  {
    "Particulars": "Total comprehensive income for the year",
    "_originalIndex": 3,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 13156,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 207780,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 220936,
    "notes": "",
    "_rowType": "subtotal",
    "Is Sub-total/total?": "subtotal",
    "_cascadesTo": "At 31 December 2023"
  },
  {
    "Particulars": "Repayment of capital contribution",
    "_originalIndex": 4,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": -49272,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 0,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": -49272,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2023"
  },
  {
    "Particulars": "New share issue",
    "_originalIndex": 5,
    "Share_Capital": 40,
    "Share_Premium": 0,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 0,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 40,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2023"
  },
  {
    "Particulars": "Contribution received from shareholders",
    "_originalIndex": 6,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": 57251,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 0,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 4,
    "Total_Equity": 57251,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2023"
  },
  {
    "Particulars": "Dividend",
    "_originalIndex": 7,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": 13000,
    "Statutory_Reserve": 0,
    "Retained_Earnings": -13000,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 0,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2023"
  },
  {
    "Particulars": "Funds paid",
    "_originalIndex": 8,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 0,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": -9019,
    "Total_Equity": -9019,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2023"
  },
  {
    "Particulars": "Capitalisation of retained earnings",
    "_originalIndex": 9,
    "Share_Capital": 139950,
    "Share_Premium": 0,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": -139950,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 0,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2023"
  },
  {
    "Particulars": "Public share issue",
    "_originalIndex": 10,
    "Share_Capital": 24706,
    "Share_Premium": 345882,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 0,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 370588,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2023"
  },
  {
    "Particulars": "At 31 December 2023",
    "_originalIndex": 11,
    "Share_Capital": 164706,
    "Share_Premium": 345882,
    "Other_Reserves": 24511,
    "Contribution_From_Shareholders": 24995,
    "Statutory_Reserve": 14,
    "Retained_Earnings": 137012,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 697120,
    "notes": "",
    "_rowType": "closing",
    "Is Sub-total/total?": "total",
    "_cascadesTo": ""
  },
  {
    "Particulars": "At 1 January 2024",
    "_originalIndex": 12,
    "Share_Capital": 164706,
    "Share_Premium": 345882,
    "Other_Reserves": 24511,
    "Contribution_From_Shareholders": 24995,
    "Statutory_Reserve": 14,
    "Retained_Earnings": 137012,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 697120,
    "notes": "",
    "_rowType": "opening",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2024"
  },
  {
    "Particulars": "Profit for the year",
    "_originalIndex": 13,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 167372,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 167372,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "Total comprehensive income for the year"
  },
  {
    "Particulars": "Other comprehensive income",
    "_originalIndex": 14,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 51460,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 0,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 51460,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "Total comprehensive income for the year"
  },
  {
    "Particulars": "Total comprehensive income for the year",
    "_originalIndex": 15,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 51460,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 167372,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 218832,
    "notes": "",
    "_rowType": "subtotal",
    "Is Sub-total/total?": "subtotal",
    "_cascadesTo": "At 31 December 2024"
  },
  {
    "Particulars": "Repayment of capital contribution (Note 15)",
    "_originalIndex": 16,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": -24995,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 0,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": -24995,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2024"
  },
  {
    "Particulars": "Own shares purchased (net)",
    "_originalIndex": 17,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 0,
    "Own_Shares": -263,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": -263,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2024"
  },
  {
    "Particulars": "Depreciation on revalued asset",
    "_originalIndex": 18,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": -584,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 584,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 0,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2024"
  },
  {
    "Particulars": "Realized gain transferred to retained earnings (Note 14 (ii) (c))",
    "_originalIndex": 19,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": -56863,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 56863,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 0,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2024"
  },
  {
    "Particulars": "Capital contribution through interest-free",
    "_originalIndex": 20,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 2734,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 2734,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2024"
  },
  {
    "Particulars": "loan from shareholder (Note 20)",
    "_originalIndex": 21,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": 2734,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 2734,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2024"
  },
  {
    "Particulars": "Loss on sale of own shares",
    "_originalIndex": 22,
    "Share_Capital": 0,
    "Share_Premium": 0,
    "Other_Reserves": 0,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 0,
    "Retained_Earnings": -1667,
    "Own_Shares": 0,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": -1667,
    "notes": "",
    "_rowType": "movement",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": "At 31 December 2024"
  },
  {
    "Particulars": "At 31 December 2024",
    "_originalIndex": 23,
    "Share_Capital": 164706,
    "Share_Premium": 345882,
    "Other_Reserves": 18524,
    "Contribution_From_Shareholders": 0,
    "Statutory_Reserve": 14,
    "Retained_Earnings": 362898,
    "Own_Shares": -263,
    "Shareholders'_Current_Account": 0,
    "Total_Equity": 891761,
    "notes": "",
    "_rowType": "closing",
    "Is Sub-total/total?": "total",
    "_cascadesTo": ""
  },
  {
    "Particulars": "_columnType",
    "Share_Capital": "lineItem",
    "Share_Premium": "lineItem",
    "Other_Reserves": "lineItem",
    "Contribution_From_Shareholders": "lineItem",
    "Statutory_Reserve": "lineItem",
    "Retained_Earnings": "lineItem",
    "Own_Shares": "lineItem",
    "Shareholders'_Current_Account": "lineItem",
    "Total_Equity": "total",
    "notes": "lineItem",
    "_rowType": "lineItem",
    "Is Sub-total/total?": "lineItem",
    "_cascadesTo": ""
  },
  {
    "Particulars": "_columnCascadesTo",
    "_rowType": "metadata",
    "Share_Capital": "Total_Equity",
    "Share_Premium": "Total_Equity",
    "Other_Reserves": "Total_Equity",
    "Contribution_From_Shareholders": "Total_Equity",
    "Statutory_Reserve": "Total_Equity",
    "Retained_Earnings": "Total_Equity",
    "Own_Shares": "Total_Equity",
    "Shareholders'_Current_Account": "Total_Equity",
    "Total_Equity": "",
    "notes": ""
  }
]r/services/agents/agentBootstrap.ts` |
| Execution Template | 100% | ✅ `roundtableTemplate` with 6-agent sequence defined |
| Chat Mode Recognition | 100% | ✅ 'roundtable' is canonical in `server/services/chatModeNormalizer.ts` |
| API Endpoint | 0% | ❌ No route exists in `server/routes.ts` |
| Frontend Integration | 0% | ❌ Uses fake `simulateWorkflow()` with `setTimeout()` |
| Query Input | 0% | ❌ No input field for user queries |
| Real-time Streaming | 0% | ❌ Not implemented |
| Results Display | 20% | ⚠️ UI exists but never receives data |
| Error Handling | 0% | ❌ No try/catch, no user feedback |
| Database Persistence | 0% | ❌ Workflow results not saved |

---

## Implementation Phases

### Phase 1: API Layer (Priority: CRITICAL)

**File to Create:** `server/routes/roundtableRoutes.ts`

**Endpoints Required:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/roundtable/execute` | Start workflow execution |
| GET | `/api/roundtable/status/:sessionId` | Poll execution status |
| GET | `/api/roundtable/results/:sessionId` | Fetch final results |

**Implementation Notes:**
- Import `executeWorkflow` from `agentBootstrap.ts` (line 337)
- Session ID generation for tracking async execution
- Rate limiting: 5 requests/minute per user
- Authentication required (use existing session middleware)

**Route Registration:**
- Add to `server/routes.ts` imports section (line 1-50)
- Register with `app.use('/api/roundtable', roundtableRoutes)`

---

### Phase 2: Frontend-Backend Connection (Priority: CRITICAL)

**File to Modify:** `client/src/pages/Roundtable.tsx`

**Current Problem (Lines 118-140):**
```typescript
// FAKE - Uses setTimeout, never calls API
const simulateWorkflow = async (workflowId: string) => {
  setIsRunning(true);
  for (let i = 0; i <= 100; i += 10) {
    await new Promise(resolve => setTimeout(resolve, 500)); // FAKE
    setProgress(i);
  }
};
```

**Required Changes:**

1. **Replace `simulateWorkflow` with real API call:**
   - `fetch('/api/roundtable/execute', { method: 'POST', body: JSON.stringify({ query, workflowId }) })`
   - Handle response with session ID
   - Poll `/api/roundtable/status/:sessionId` for progress updates

2. **Add Query Input Field:**
   - New `<Input>` component above workflow cards
   - State: `const [query, setQuery] = useState('')`
   - Validation: Minimum 10 characters
   - Placeholder: "Ask a complex question requiring multiple expert perspectives..."

3. **Wire Results Display:**
   - Currently empty UI at bottom of page
   - Map API response to existing result card components
   - Show each agent's contribution with timestamps

---

### Phase 3: Real-Time Progress (Priority: HIGH)

**Options (Choose One):**

| Approach | Complexity | User Experience |
|----------|------------|-----------------|
| Polling | Low | Acceptable (500ms intervals) |
| Server-Sent Events | Medium | Good (real-time updates) |
| WebSocket | High | Best (bidirectional) |

**Recommended:** Server-Sent Events (SSE)

**Implementation Location:**
- Backend: Add SSE endpoint `/api/roundtable/stream/:sessionId`
- Frontend: Use `EventSource` API in Roundtable.tsx
- Emit events: `agent-started`, `agent-completed`, `workflow-finished`, `error`

---

### Phase 4: Backend Cleanup (Priority: MEDIUM)

**File:** `server/services/agents/roundtableAgents.ts`

**11 Unused Variables to Fix:**

| Line | Variable | Fix |
|------|----------|-----|
| 66 | `query` | Pass to agent.process() |
| 141 | `query` | Use in prompts |
| 204, 211, 416, 420, 429, 442, 455 | `perspectives` | Chain to ArgumentAnalyzer |
| 533 | `actionItems` | Include in final output |
| 553 | `consensus` | Pass to RecommendationFinalizer |

**Root Cause:** Agents extract data but don't pass it downstream. The `dependencies` map in `agentBootstrap.ts` defines the flow, but agents ignore received context.

---

### Phase 5: Error Handling (Priority: HIGH)

**Backend Error Types:**
- `RoundtableTimeoutError` - Agent takes >30 seconds
- `AgentExecutionError` - Individual agent fails
- `OrchestratorError` - Workflow coordination fails
- `QuotaExceededError` - API rate limits hit

**Frontend Error States:**
- Add `error` state to component
- Display error card with retry button
- Show which agent failed (partial results if possible)
- Toast notification for transient errors

---

### Phase 6: Persistence (Priority: LOW)

**Database Schema Addition:**

```sql
CREATE TABLE roundtable_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  query TEXT NOT NULL,
  workflow_id VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  agent_outputs JSONB,
  final_result JSONB,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT
);
```

**Benefits:**
- Resume interrupted workflows
- History of past roundtable sessions
- Analytics on agent performance

---

## Dependency Graph

```
Phase 1 (API) ──┬──> Phase 2 (Frontend Integration)
                │
                └──> Phase 3 (Streaming)
                          │
                          ▼
                     Phase 5 (Errors)

Phase 4 (Backend Cleanup) ──> Independent, can parallel

Phase 6 (Persistence) ──> After MVP is working
```

---

## Effort Estimates

| Phase | Hours | Skills Needed |
|-------|-------|---------------|
| Phase 1: API Layer | 2-3h | Express.js, TypeScript |
| Phase 2: Frontend Connection | 2-3h | React, fetch API |
| Phase 3: Real-Time Streaming | 2h | SSE or WebSocket |
| Phase 4: Backend Cleanup | 1h | Agent architecture |
| Phase 5: Error Handling | 1.5h | Full-stack |
| Phase 6: Persistence | 2h | PostgreSQL, Drizzle |
| **Total MVP (Phases 1-3, 5)** | **7-9h** | |
| **Total Complete** | **10-12h** | |

---

## Key Files Reference

| Purpose | File | Lines of Interest |
|---------|------|-------------------|
| Agent Definitions | `server/services/agents/roundtableAgents.ts` | 1-946 (all 6 agents) |
| Execution Engine | `server/services/agents/agentBootstrap.ts` | 337-353 (`executeWorkflow`) |
| Workflow Template | `server/services/agents/agentBootstrap.ts` | 220-280 (`roundtableTemplate`) |
| Frontend UI | `client/src/pages/Roundtable.tsx` | 118-140 (fake simulation) |
| Route Registration | `server/routes.ts` | 1-50 (imports), 5600+ (registration) |
| Chat Mode | `server/services/chatModeNormalizer.ts` | Full file |

---

## Testing Checklist

- [ ] Execute workflow with valid query → All 6 agents complete
- [ ] Execute workflow with empty query → Validation error
- [ ] Kill backend mid-workflow → Frontend shows error, allows retry
- [ ] Agent timeout (mock slow response) → Graceful degradation
- [ ] Rate limit exceeded → User-friendly message
- [ ] 10 concurrent workflows → No race conditions
- [ ] Refresh page during execution → Reconnect to session
- [ ] Mobile viewport → Responsive UI maintained

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI provider rate limits | High | Queue system, retry with backoff |
| Agent execution timeout | Medium | 30s timeout per agent, partial results |
| Large response payloads | Medium | Streaming, pagination |
| Session state loss | Low | Database persistence in Phase 6 |

---

## Document Info

- **Created:** January 15, 2026
- **Status:** Planning Phase
- **Feature Completion:** 35%
- **Next Step:** Begin Phase 1 (API Layer) when ready to implement
