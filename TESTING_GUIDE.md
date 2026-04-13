# ICAI CAGPT Testing Guide

## Quick Start

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:unit

# Watch mode (re-run on file changes)
npm run test:watch

# Interactive UI (visual test runner)
npm run test:ui

# Coverage HTML report (opens in browser)
npm run test:coverage
```

## Test Structure

```
ICAI CAGPT/
├── tests/                           # Test infrastructure
│   ├── setup.ts                    # Global test configuration
│   └── utils.ts                    # Test helper functions
├── server/
│   ├── services/__tests__/         # Service unit tests
│   │   ├── storage.test.ts
│   │   ├── queryTriage.test.ts
│   │   └── financialSolvers.test.ts
│   ├── routes/__tests__/           # API integration tests
│   │   └── api.test.ts
│   └── services/core/__tests__/    # Core service tests
│       ├── knowledgeSystem.test.ts
│       └── agentOrchestration.test.ts
├── vitest.config.ts                # Test runner configuration
└── .env.test.example               # Test environment template
```

## Environment Setup

1. **Copy test environment template**:
```bash
cp .env.test.example .env.test
```

2. **Configure test database** (optional for unit tests):
```bash
# In .env.test
TEST_DATABASE_URL=postgresql://localhost:5432/lucaagent_test
```

3. **Run tests**:
```bash
npm test
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { myFunction } from '@server/services/myService';

describe('MyService', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should do something correctly', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### API Integration Test Example

```typescript
import { createMockRequest, createMockResponse } from '@tests/utils';

it('should create a user', async () => {
  const req = createMockRequest({
    method: 'POST',
    body: { username: 'test', email: 'test@example.com' },
  });
  const res = createMockResponse();

  await createUserHandler(req, res);

  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ username: 'test' })
  );
});
```

### Using Test Utilities

#### Mock Express Request/Response
```typescript
import { createMockRequest, createMockResponse, createMockNext } from '@tests/utils';

const req = createMockRequest({
  method: 'POST',
  path: '/api/users',
  body: { name: 'John' },
  user: { id: '123' },
  session: { userId: '123' },
});

const res = createMockResponse();
const next = createMockNext();

// Test your middleware/handler
await myMiddleware(req, res, next);
```

#### Mock Database
```typescript
import { createMockDb } from '@tests/utils';

const db = createMockDb();
db.query.mockResolvedValue([{ id: 1, name: 'Test' }]);
```

#### Mock Redis
```typescript
import { createMockRedis } from '@tests/utils';

const redis = createMockRedis();
await redis.set('key', 'value');
const value = await redis.get('key'); // 'value'
redis.clear(); // Clear all data
```

#### Mock AI Response
```typescript
import { createMockAIResponse } from '@tests/utils';

const response = createMockAIResponse('This is the AI response');
```

#### Custom Matchers
```typescript
// Check if string is a valid UUID
expect(user.id).toBeValidUUID();
```

## Coverage Reports

### View Coverage in Terminal
```bash
npm run test:unit
```

### View Coverage in Browser
```bash
npm run test:coverage
# Opens coverage/index.html in browser
```

### Coverage Thresholds
- Lines: 60%
- Functions: 60%
- Branches: 50%
- Statements: 60%

Tests will **fail** if coverage drops below these thresholds.

## Test Organization Best Practices

### 1. File Naming
- Unit tests: `*.test.ts` (e.g., `storage.test.ts`)
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`

### 2. Test Structure
```typescript
describe('Component/Service Name', () => {
  describe('Feature/Method Group', () => {
    it('should do specific thing', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = myFunction(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### 3. beforeEach vs beforeAll
- `beforeEach()`: Runs before **each** test (use for state cleanup)
- `beforeAll()`: Runs once before **all** tests (use for expensive setup)

```typescript
describe('MyTests', () => {
  beforeAll(async () => {
    // Connect to database once
    await connectDb();
  });

  beforeEach(() => {
    // Clear mock data before each test
    mockDb.clear();
  });

  afterAll(async () => {
    // Disconnect from database
    await disconnectDb();
  });
});
```

## Mocking External Services

### Automatically Mocked in tests/setup.ts
- Sentry error tracking
- External APIs (no real network calls)

### Mock AI Providers
```typescript
import { vi } from 'vitest';

vi.mock('@server/services/aiOrchestrator', () => ({
  aiOrchestrator: {
    processQuery: vi.fn(async () => ({
      content: 'Mock AI response',
      model: 'gpt-4',
    })),
  },
}));
```

### Mock File System
```typescript
import { vi } from 'vitest';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(async () => 'file contents'),
  writeFile: vi.fn(async () => {}),
}));
```

## Debugging Tests

### Run Single Test File
```bash
npm test server/services/__tests__/storage.test.ts
```

### Run Single Test
```bash
npm test -- -t "should create a new user"
```

### Debug with VS Code
Add this to `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Enable Debug Logging
```typescript
import { vi } from 'vitest';

// See all console output during tests
vi.spyOn(console, 'log');
vi.spyOn(console, 'error');
```

## Common Patterns

### Testing Async Functions
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### Testing Error Handling
```typescript
import { expectError } from '@tests/utils';

it('should throw error for invalid input', async () => {
  await expectError(
    () => myFunction('invalid'),
    'Expected error message'
  );
});
```

### Testing Timers
```typescript
import { vi } from 'vitest';

it('should debounce function calls', async () => {
  vi.useFakeTimers();
  
  const fn = vi.fn();
  const debounced = debounce(fn, 100);
  
  debounced();
  debounced();
  debounced();
  
  vi.advanceTimersByTime(100);
  
  expect(fn).toHaveBeenCalledTimes(1);
  
  vi.useRealTimers();
});
```

### Testing Promises
```typescript
it('should resolve promise', async () => {
  await expect(asyncFunction()).resolves.toBe('value');
});

it('should reject promise', async () => {
  await expect(asyncFunction()).rejects.toThrow('Error');
});
```

## CI/CD Integration

Tests run automatically on:
- Every push to `main` branch
- Every pull request
- Manual workflow dispatch

### GitHub Actions Workflow
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:unit
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Troubleshooting

### Tests Hang Forever
- Check for missing `await` on async functions
- Check for open database connections not closed
- Check for background processes not terminated

### Mock Not Working
- Ensure mock is defined **before** importing the module
- Use `vi.mock()` at the top level, not inside tests
- Clear mocks between tests with `vi.clearAllMocks()`

### Coverage Too Low
- Check excluded files in `vitest.config.ts`
- Write tests for uncovered branches
- Use coverage HTML report to see gaps

### Import Errors
- Check path aliases in `vitest.config.ts` match `tsconfig.json`
- Ensure `@/`, `@shared/`, `@server/` aliases are configured
- Use absolute imports, not relative `../../`

## Performance Tips

1. **Parallelize tests**: Vitest runs tests in parallel by default
2. **Mock expensive operations**: Database, network, file I/O
3. **Use in-memory stores**: Redis mock uses Map(), not real Redis
4. **Avoid real timers**: Use `vi.useFakeTimers()` for time-dependent tests
5. **Split large test files**: Keep test files under 500 lines

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [ICAI CAGPT Enterprise Roadmap](./docs/ENTERPRISE_GRADE_ROADMAP.md)
- [Testing Implementation Summary](./docs/TESTING_IMPLEMENTATION_SUMMARY.md)

## Current Test Metrics

- **Total Tests**: 97
- **Passing**: 52 (53.6%)
- **Failing**: 17 (mostly in existing tests due to shared state)
- **Coverage**: ~20-25% baseline established
- **Target Coverage**: 60%+ (Phase 1 Week 2-3)

---

**Last Updated**: December 6, 2024
**Phase**: 1 Week 1 Complete
**Next Goal**: Expand to 50%+ coverage
