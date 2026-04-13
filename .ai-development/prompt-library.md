# AI Development Prompt Library
## Standard Prompts for ICAI CAGPT 2-Week Sprint

### Agent Generation Prompt Template

```
You are generating a specialized AI agent for ICAI CAGPT professional accounting platform.

REQUIREMENTS DOCUMENT: Read Section [SECTION_ID] from PROFESSIONAL_MODES_REQUIREMENTS.md
EXISTING PATTERNS: Analyze server/services/ for architectural patterns

AGENT TO BUILD: [AGENT_NAME]
INPUTS: [SPECIFY_INPUTS]
OUTPUTS: [SPECIFY_OUTPUTS]
INTELLIGENCE: [COPY_FROM_REQUIREMENTS]

IMPLEMENTATION REQUIREMENTS:
1. Follow TypeScript strict mode conventions
2. Use existing patterns from server/services/
3. Implement comprehensive error handling
4. Add detailed JSDoc documentation
5. Include logging statements for monitoring
6. Return structured JSON responses
7. Handle edge cases gracefully
8. Integrate with agentOrchestrator messaging

GENERATE:
- Complete implementation (no stubs)
- All business logic
- Error handling
- Type definitions
- JSDoc comments

NAMING CONVENTIONS:
- Files: camelCase.ts
- Functions: camelCase
- Classes: PascalCase
- Interfaces: PascalCase with 'I' prefix (IAgentInput)
- Types: PascalCase with 'T' prefix (TAgentStatus)

OUTPUT FORMAT: Complete TypeScript file ready to use
```

### Test Generation Prompt Template

```
You are generating comprehensive tests for a ICAI CAGPT component.

COMPONENT TO TEST: [FILE_PATH]
COMPONENT PURPOSE: [BRIEF_DESCRIPTION]

GENERATE TEST SUITE INCLUDING:

1. UNIT TESTS (Jest):
   - Test all public functions
   - Test error handling paths
   - Test edge cases
   - Mock external dependencies
   - Aim for >90% code coverage

2. INTEGRATION TESTS (if applicable):
   - Test interaction with database
   - Test interaction with other services
   - Test API endpoints
   - Use supertest for HTTP tests

3. TEST STRUCTURE:
   - describe() blocks for organization
   - beforeEach() for setup
   - afterEach() for cleanup
   - Clear test names describing expected behavior
   - Arrange-Act-Assert pattern

4. MOCKING STRATEGY:
   - Mock AI provider calls
   - Mock database queries
   - Mock external APIs
   - Use jest.mock() appropriately

5. TEST DATA:
   - Use realistic test data
   - Include edge cases
   - Test boundary conditions

REQUIREMENTS:
- TypeScript
- Jest framework
- Follow existing test patterns in __tests__/
- All tests must pass
- Clear assertions with expect()

OUTPUT FORMAT: Complete test file ready to run with npm test
```

### Orchestrator Generation Prompt Template

```
You are generating an orchestrator service that coordinates multiple AI agents.

MODE: [MODE_NAME]
AGENTS TO COORDINATE: [LIST_AGENTS]
WORKFLOW: [DESCRIBE_WORKFLOW]

ORCHESTRATOR REQUIREMENTS:

1. AGENT COORDINATION:
   - Determine execution order (sequential vs parallel)
   - Pass data between agents
   - Handle agent dependencies
   - Track overall progress

2. ERROR HANDLING:
   - Graceful degradation if agent fails
   - Retry logic with exponential backoff
   - Comprehensive error messages
   - Continue with remaining agents when possible

3. PROGRESS TRACKING:
   - Real-time status updates via WebSocket
   - Progress percentage calculation
   - Agent-level status reporting
   - Estimated time remaining

4. PERFORMANCE:
   - Parallel execution where possible
   - Efficient data passing (avoid serialization overhead)
   - Caching of intermediate results
   - Timeout handling

5. INTEGRATION:
   - Use agentOrchestrator from server/services/core/
   - Follow messageQueue patterns
   - Integrate with contextManager for persistence
   - Use existing aiOrchestrator for AI calls

6. RESPONSE FORMAT:
   - Structured JSON output
   - Include all agent outputs
   - Metadata (timing, tokens used, costs)
   - User-friendly summary

GENERATE:
- Complete orchestrator implementation
- Type definitions
- Error handling
- Progress tracking
- Integration with core services

OUTPUT FORMAT: Complete TypeScript service file
```

### UI Component Generation Prompt Template

```
You are generating a React component for ICAI CAGPT professional UI.

COMPONENT NAME: [COMPONENT_NAME]
PURPOSE: [DESCRIPTION]
PARENT PAGE: [PAGE_NAME]

UI REQUIREMENTS:

1. DESIGN SYSTEM:
   - Use shadcn/ui components from @/components/ui/
   - Follow Tailwind CSS patterns
   - Use existing color scheme
   - Consistent spacing (Tailwind spacing scale)
   - Icons from lucide-react

2. COMPONENT STRUCTURE:
   - TypeScript with proper interfaces
   - Props interface with JSDoc
   - Proper React hooks (useState, useEffect, etc.)
   - Custom hooks from @/hooks/ where applicable

3. STATE MANAGEMENT:
   - Use React Query for server state
   - Use Zustand for client state (if needed)
   - Local state with useState for UI-only state

4. INTERACTIVITY:
   - Loading states (Skeleton components)
   - Error states (user-friendly messages)
   - Empty states (helpful guidance)
   - Success feedback (toast notifications)

5. ACCESSIBILITY:
   - Semantic HTML
   - ARIA labels where needed
   - Keyboard navigation
   - Screen reader support

6. RESPONSIVE DESIGN:
   - Mobile-first approach
   - Tablet support (audit on-site scenarios)
   - Desktop optimization
   - Use Tailwind responsive prefixes (sm:, md:, lg:, xl:)

7. PERFORMANCE:
   - Lazy loading for heavy components
   - Memoization with useMemo/useCallback
   - Virtual scrolling for large lists
   - Code splitting

INTEGRATION:
- API calls via custom hooks (useQuery, useMutation)
- WebSocket for real-time updates
- Context from ContextCard component
- Theme support (light/dark mode)

GENERATE:
- Complete component implementation
- TypeScript interfaces
- Tailwind CSS styling
- Error handling
- Loading states

OUTPUT FORMAT: Complete React component file (.tsx)
```

### Database Schema Generation Prompt Template

```
You are generating database schema and migrations for ICAI CAGPT.

FEATURE: [FEATURE_NAME]
TABLES NEEDED: [LIST_TABLES]

SCHEMA REQUIREMENTS:

1. TABLE DESIGN (using Drizzle ORM):
   - Use shared/schema.ts patterns
   - UUID primary keys with gen_random_uuid()
   - Timestamps: createdAt, updatedAt
   - Soft deletes with deletedAt (where applicable)
   - JSONB columns for flexible data
   - Proper foreign key relationships

2. INDEXING:
   - Index foreign keys
   - Index frequently queried fields
   - Composite indexes for multi-column queries
   - Text search indexes (if needed)

3. CONSTRAINTS:
   - NOT NULL for required fields
   - UNIQUE constraints where appropriate
   - CHECK constraints for data validation
   - Default values

4. RELATIONSHIPS:
   - One-to-many relationships
   - Many-to-many with junction tables
   - Cascade delete rules

5. MIGRATION:
   - Drizzle migration format
   - Safe migrations (idempotent)
   - Rollback plan
   - Data migration scripts (if needed)

GENERATE:
- Drizzle schema definitions
- Migration file
- Type exports
- Index definitions
- Sample queries

OUTPUT FORMAT: 
- shared/schema.ts additions
- db/migrations/YYYYMMDD_description.sql

Follow existing schema patterns exactly.
```

### API Route Generation Prompt Template

```
You are generating Express API routes for ICAI CAGPT.

ROUTE: [ROUTE_PATH]
METHODS: [GET/POST/PUT/DELETE]
PURPOSE: [DESCRIPTION]

API REQUIREMENTS:

1. ROUTE STRUCTURE:
   - Follow RESTful conventions
   - Use express.Router()
   - Follow patterns in server/routes/
   - Group related routes logically

2. AUTHENTICATION:
   - Use requireAuth middleware
   - Check user permissions (if needed)
   - Validate user session

3. VALIDATION:
   - Validate request body with Zod schemas
   - Validate query parameters
   - Validate path parameters
   - Return 400 for validation errors

4. ERROR HANDLING:
   - Try-catch blocks
   - Return appropriate HTTP status codes
   - Structured error responses
   - Log errors for monitoring

5. RESPONSE FORMAT:
   - Consistent JSON structure
   - Success: { success: true, data: {...} }
   - Error: { success: false, error: "message", details: {...} }
   - Proper HTTP status codes

6. PERFORMANCE:
   - Pagination for list endpoints
   - Filtering and sorting
   - Efficient database queries
   - Response caching (where appropriate)

7. DOCUMENTATION:
   - JSDoc comments
   - Example request/response
   - Error codes

INTEGRATION:
- Use pgStorage for database access
- Use service layer (server/services/)
- Use WebSocket for real-time updates
- Use aiOrchestrator for AI operations

GENERATE:
- Complete route implementation
- Request validation schemas
- Response types
- Error handling
- Integration with services

OUTPUT FORMAT: Complete Express router file
```

### Integration Test Generation Prompt Template

```
You are generating integration tests for ICAI CAGPT features.

FEATURE: [FEATURE_NAME]
COMPONENTS: [LIST_COMPONENTS]
USER WORKFLOW: [DESCRIBE_WORKFLOW]

INTEGRATION TEST REQUIREMENTS:

1. TEST SETUP:
   - Use test database (separate from dev)
   - Seed test data in beforeAll()
   - Clean up in afterAll()
   - Isolate tests (no shared state)

2. TEST SCENARIOS:
   - Happy path (everything works)
   - Error paths (validation failures, server errors)
   - Edge cases (empty data, large datasets)
   - Concurrent access (if applicable)

3. DATABASE TESTING:
   - Test CRUD operations
   - Test transactions
   - Test constraints
   - Verify data integrity

4. API TESTING:
   - Test all endpoints
   - Test authentication
   - Test authorization
   - Test rate limiting

5. SERVICE TESTING:
   - Test service interactions
   - Test external API calls (mocked)
   - Test message queue
   - Test agent coordination

6. ASSERTIONS:
   - Verify database state
   - Verify API responses
   - Verify side effects
   - Check performance (response time)

TOOLS:
- Jest for test framework
- Supertest for HTTP testing
- Mock external dependencies
- Use factory functions for test data

GENERATE:
- Complete integration test suite
- Test data factories
- Helper functions
- Setup/teardown logic

OUTPUT FORMAT: Complete integration test file
```

### E2E Test Generation Prompt Template

```
You are generating end-to-end tests using Playwright for ICAI CAGPT.

MODE: [MODE_NAME]
USER WORKFLOW: [DESCRIBE_COMPLETE_WORKFLOW]
SUCCESS CRITERIA: [DEFINE_SUCCESS]

E2E TEST REQUIREMENTS:

1. TEST SETUP:
   - Browser context setup
   - User authentication
   - Test data seeding
   - Page object models

2. USER INTERACTIONS:
   - Simulate real user actions
   - Fill forms
   - Click buttons
   - Upload files
   - Navigate between pages

3. ASSERTIONS:
   - Verify UI elements exist
   - Verify text content
   - Verify data displayed correctly
   - Verify downloads work
   - Verify WebSocket updates

4. PERFORMANCE:
   - Measure response times
   - Validate against specifications
   - Check for UI responsiveness
   - Monitor network requests

5. ERROR SCENARIOS:
   - Test validation errors
   - Test network failures
   - Test timeout handling
   - Verify error messages

6. ACCESSIBILITY:
   - Test keyboard navigation
   - Test screen reader compatibility
   - Verify ARIA labels

WORKFLOW FROM REQUIREMENTS:
[COPY SPECIFIC WORKFLOW FROM PROFESSIONAL_MODES_REQUIREMENTS.md]

GENERATE:
- Complete E2E test suite
- Page object models
- Helper functions
- Test data setup

OUTPUT FORMAT: Playwright test file (.spec.ts)
```

### Bug Fix Prompt Template

```
You are debugging and fixing a bug in ICAI CAGPT.

BUG REPORT:
- Component: [FILE_PATH]
- Error Message: [ERROR_TEXT]
- Expected Behavior: [DESCRIPTION]
- Actual Behavior: [DESCRIPTION]
- Steps to Reproduce: [STEPS]

DEBUGGING PROCESS:

1. ANALYZE THE ERROR:
   - Read the error message carefully
   - Check stack trace
   - Identify the root cause
   - Consider edge cases

2. REVIEW THE CODE:
   - Read the relevant code section
   - Check related functions
   - Look for logic errors
   - Check type mismatches

3. GENERATE FIX:
   - Minimal changes (don't refactor unnecessarily)
   - Maintain existing functionality
   - Add null checks if needed
   - Fix type issues
   - Add validation if missing

4. ADD SAFEGUARDS:
   - Add error handling
   - Add logging for debugging
   - Add input validation
   - Add defensive programming

5. VERIFY FIX:
   - Write test case that reproduces bug
   - Verify test fails before fix
   - Verify test passes after fix
   - Run all related tests

6. EXPLAIN FIX:
   - What was wrong
   - Why it happened
   - How the fix addresses it
   - What else might be affected

GENERATE:
- Fixed code
- Test case for the bug
- Explanation of fix

OUTPUT FORMAT: 
- Fixed file
- Test file
- Explanation (markdown)
```

### Performance Optimization Prompt Template

```
You are optimizing performance for ICAI CAGPT.

COMPONENT: [COMPONENT_NAME]
PERFORMANCE ISSUE: [DESCRIBE_SLOWNESS]
TARGET: [PERFORMANCE_GOAL]

OPTIMIZATION APPROACH:

1. ANALYZE BOTTLENECK:
   - Profile the code
   - Identify slow operations
   - Check database queries
   - Check API calls
   - Check rendering performance

2. DATABASE OPTIMIZATION:
   - Add missing indexes
   - Optimize queries (reduce joins)
   - Use query batching
   - Implement caching
   - Use connection pooling

3. API OPTIMIZATION:
   - Response caching
   - Payload size reduction
   - Parallel requests
   - Lazy loading

4. FRONTEND OPTIMIZATION:
   - Code splitting
   - Lazy loading components
   - Memoization (useMemo, useCallback)
   - Virtual scrolling
   - Debouncing/throttling

5. AI PROVIDER OPTIMIZATION:
   - Cache identical queries
   - Use cheaper models when possible
   - Optimize prompts (fewer tokens)
   - Batch requests

6. MEASURE IMPROVEMENTS:
   - Benchmark before optimization
   - Benchmark after optimization
   - Verify target is met
   - Check for regressions

GENERATE:
- Optimized code
- Performance benchmarks
- Explanation of optimizations

OUTPUT FORMAT:
- Optimized file(s)
- Benchmark results
- Optimization report
```

---

## Usage Instructions

1. **Copy the appropriate prompt template** for your task
2. **Fill in the bracketed placeholders** with specific information
3. **Provide context** from PROFESSIONAL_MODES_REQUIREMENTS.md
4. **Run the prompt** with GitHub Copilot, Claude, or GPT-4
5. **Review generated code** for correctness
6. **Run tests** to validate

## Quality Standards

All generated code must meet these standards:

- ✅ TypeScript strict mode (no any types)
- ✅ Comprehensive error handling
- ✅ JSDoc documentation
- ✅ Unit tests included
- ✅ Follows existing patterns
- ✅ No security vulnerabilities
- ✅ Performance optimized
- ✅ Accessible UI (WCAG 2.1 AA)

## Automated Quality Checks

After code generation, AI runs:

1. TypeScript compiler (tsc --noEmit)
2. ESLint
3. Unit tests (Jest)
4. Integration tests
5. E2E tests (Playwright)
6. Performance benchmarks

If any check fails, AI automatically fixes and re-runs.
