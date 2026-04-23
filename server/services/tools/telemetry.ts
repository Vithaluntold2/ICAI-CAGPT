/**
 * Tool-call telemetry recorder.
 *
 * Fire-and-forget writer for the `tool_call_telemetry` table (see
 * shared/schema.ts + migrations/0004_cost_budget_telemetry.sql).
 * Every paid path — runSolver / buildSpreadsheet / quoteCost /
 * twoAgentSolver / calcExecutor / read_whiteboard — calls
 * `recordToolCall` exactly once per invocation so we can answer:
 *
 *   - "Why did conversation X cost $Y?"
 *   - "Which agent is slowest / most failure-prone?"
 *   - "How often does twoAgentSolver take > 3 round-trips?"
 *
 * DB failures are swallowed (logged but NEVER thrown) so telemetry
 * can never break a user-visible request. This is deliberate: the
 * tool call itself has already completed before we record, and a
 * failed INSERT shouldn't poison the response.
 *
 * Storage units:
 *   - costUsdCents   — integer USD cents (aligns with quoteCost)
 *   - durationMs     — integer milliseconds
 *   - {prompt,completion}Tokens — integer token counts
 *
 * `meta` is a JSONB catch-all for per-tool extras (cache-hit flags,
 * sheet counts, agent IDs invoked downstream, error messages, etc).
 * Keep values small — this table gets chatty.
 */

import { db } from '../../db';
import { toolCallTelemetry, type InsertToolCallTelemetry } from '@shared/schema';

export type ToolCallOutcome = 'ok' | 'error' | 'refused' | 'short_circuit';

export interface ToolCallRecord {
  conversationId: string;
  messageId?: string | null;
  toolName: string;
  agentId?: string | null;
  outcome: ToolCallOutcome;
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  costUsdCents?: number;
  roundTrips?: number;
  meta?: Record<string, unknown>;
}

/**
 * Write one telemetry row. Never throws.
 *
 * Pass `conversationId` as the empty string to opt out of recording
 * (useful for unit tests and ad-hoc solver calls that aren't tied to
 * a real conversation).
 */
export async function recordToolCall(record: ToolCallRecord): Promise<void> {
  if (!record.conversationId) {
    return;
  }

  try {
    const row: InsertToolCallTelemetry = {
      conversationId: record.conversationId,
      messageId: record.messageId ?? null,
      toolName: record.toolName.slice(0, 64),
      agentId: record.agentId ? record.agentId.slice(0, 64) : null,
      outcome: record.outcome,
      durationMs: Math.max(0, Math.round(record.durationMs ?? 0)),
      promptTokens: Math.max(0, Math.round(record.promptTokens ?? 0)),
      completionTokens: Math.max(0, Math.round(record.completionTokens ?? 0)),
      costUsdCents: Math.max(0, Math.round(record.costUsdCents ?? 0)),
      roundTrips: Math.max(1, Math.round(record.roundTrips ?? 1)),
      meta: record.meta ?? {},
    };

    await db.insert(toolCallTelemetry).values(row);
  } catch (err) {
    console.warn('[telemetry] recordToolCall failed:', (err as Error).message);
  }
}

/**
 * Wrap an async operation with automatic telemetry. The wrapped
 * function receives no arguments — capture them via closure. Any
 * thrown error is re-thrown AFTER the telemetry row is written as
 * `outcome: 'error'`, so callers see the original error unchanged.
 *
 * Usage:
 *   const result = await withToolTelemetry(
 *     { conversationId, toolName: 'runSolver', agentId: 'npv-calculator' },
 *     async () => runSolverTool.execute(args),
 *   );
 */
export async function withToolTelemetry<T>(
  base: Omit<ToolCallRecord, 'outcome' | 'durationMs'>,
  fn: () => Promise<T>,
  options?: {
    /** Derive the cost / meta fields from the result after a successful call. */
    onResult?: (result: T) => Partial<Pick<ToolCallRecord, 'costUsdCents' | 'promptTokens' | 'completionTokens' | 'roundTrips' | 'meta' | 'agentId'>>;
  },
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const extras = options?.onResult ? options.onResult(result) : {};
    await recordToolCall({
      ...base,
      ...extras,
      outcome: 'ok',
      durationMs: Date.now() - start,
    });
    return result;
  } catch (err) {
    await recordToolCall({
      ...base,
      outcome: 'error',
      durationMs: Date.now() - start,
      meta: {
        ...(base.meta ?? {}),
        errorMessage: (err as Error).message?.slice(0, 500),
      },
    });
    throw err;
  }
}
