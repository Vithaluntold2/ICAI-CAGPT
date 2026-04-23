/**
 * In-memory cache of calculation-agent run outputs, keyed by a short
 * solver_run_id. Used to hand an `ExcelWorkbookSpec` from `run_solver`
 * to `build_spreadsheet` without forcing the LLM to relay a large
 * workbook JSON through the tool-call chain (which it would truncate
 * or mangle).
 *
 * Scope-checked by conversationId: a cache entry can only be read
 * from the same conversation that wrote it, preventing cross-tenant
 * access if two conversations happen to race a id collision.
 *
 * Entries expire after TTL_MS (10 minutes) to avoid unbounded memory
 * growth. This cache is deliberately process-local — Spreadsheet Mode
 * currently runs a single request through a single worker, so we
 * don't need cross-worker durability. If the server is horizontally
 * scaled later, move to Redis.
 */

import type { ExcelWorkbookSpec } from "../excel/excelWorkbookBuilder";

interface Entry {
  spec: ExcelWorkbookSpec;
  conversationId: string;
  expiresAt: number;
  results: Record<string, unknown>;
  agentsInvoked: string[];
}

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, Entry>();

function sweep(): void {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) store.delete(id);
  }
}

function newId(): string {
  // 12 bytes of random base36 is enough for ephemeral ids.
  return `sr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function putSolverRun(
  conversationId: string,
  spec: ExcelWorkbookSpec,
  results: Record<string, unknown>,
  agentsInvoked: string[],
): string {
  sweep();
  const id = newId();
  store.set(id, {
    spec,
    conversationId,
    results,
    agentsInvoked,
    expiresAt: Date.now() + TTL_MS,
  });
  return id;
}

export function getSolverRun(
  id: string,
  conversationId: string,
): Entry | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(id);
    return null;
  }
  if (entry.conversationId !== conversationId) return null;
  return entry;
}
