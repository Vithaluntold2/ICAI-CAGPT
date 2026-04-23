/**
 * Smoke tests for the tool-call telemetry recorder.
 *
 * We mock the `../../db` module so the tests don't require a live
 * Postgres connection. The goal is to validate:
 *   - recordToolCall inserts a correctly-shaped row
 *   - withToolTelemetry wraps success / error paths and still writes one row each
 *   - DB failures are swallowed (never thrown)
 *   - empty conversationId is an opt-out (no insert)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertSpy = vi.fn();

vi.mock('../../db', () => ({
  db: {
    insert: () => ({
      values: (row: unknown) => {
        insertSpy(row);
        return Promise.resolve(undefined);
      },
    }),
  },
}));

// Import AFTER the mock so telemetry.ts picks up the stub.
const { recordToolCall, withToolTelemetry } = await import('./telemetry');

beforeEach(() => {
  insertSpy.mockClear();
});

describe('recordToolCall', () => {
  it('inserts a row with normalised numeric defaults', async () => {
    await recordToolCall({
      conversationId: 'conv-1',
      toolName: 'runSolver',
      agentId: 'npv-calculator',
      outcome: 'ok',
      durationMs: 42.7,
      costUsdCents: 3.9,
      meta: { hit: true },
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const row = insertSpy.mock.calls[0][0];
    expect(row.conversationId).toBe('conv-1');
    expect(row.toolName).toBe('runSolver');
    expect(row.agentId).toBe('npv-calculator');
    expect(row.outcome).toBe('ok');
    expect(row.durationMs).toBe(43); // rounded
    expect(row.costUsdCents).toBe(4); // rounded
    expect(row.roundTrips).toBe(1); // default
    expect(row.meta).toEqual({ hit: true });
  });

  it('skips inserting when conversationId is empty', async () => {
    await recordToolCall({
      conversationId: '',
      toolName: 'x',
      outcome: 'ok',
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('does not throw when DB fails', async () => {
    // Force the insert().values() chain to reject once.
    const failingDb = await import('../../db');
    const originalInsert = failingDb.db.insert;
    (failingDb.db as any).insert = () => ({
      values: () => Promise.reject(new Error('boom')),
    });

    await expect(
      recordToolCall({ conversationId: 'c', toolName: 'x', outcome: 'ok' }),
    ).resolves.toBeUndefined();

    (failingDb.db as any).insert = originalInsert;
  });
});

describe('withToolTelemetry', () => {
  it('records a successful call with derived extras', async () => {
    const result = await withToolTelemetry(
      { conversationId: 'conv-2', toolName: 'twoAgentSolver' },
      async () => ({ sheets: 3, agents: ['a', 'b'] }),
      {
        onResult: (r) => ({
          roundTrips: r.agents.length,
          meta: { sheetCount: r.sheets },
        }),
      },
    );

    expect(result).toEqual({ sheets: 3, agents: ['a', 'b'] });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const row = insertSpy.mock.calls[0][0];
    expect(row.outcome).toBe('ok');
    expect(row.roundTrips).toBe(2);
    expect(row.meta).toEqual({ sheetCount: 3 });
    expect(row.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records an error row and re-throws the original error', async () => {
    await expect(
      withToolTelemetry(
        { conversationId: 'conv-3', toolName: 'runSolver' },
        async () => {
          throw new Error('solver blew up');
        },
      ),
    ).rejects.toThrow('solver blew up');

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const row = insertSpy.mock.calls[0][0];
    expect(row.outcome).toBe('error');
    expect(row.meta.errorMessage).toBe('solver blew up');
  });
});
