/**
 * Per-agent POV document store. Cache-layered (Redis → Postgres) with
 * optimistic locking via `version` column. Used by the synthesizer subworker
 * (write) and by buildAgentSystemPrompt (read).
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { agentPovDocuments, type AgentPovDocument } from "@shared/schema";
import { CacheService } from "../hybridCache";

const CACHE_TTL_SECONDS = 60;

function cacheKey(threadId: string, agentId: string): string {
  return `roundtable:pov:${threadId}:${agentId}`;
}

export async function get(threadId: string, agentId: string): Promise<AgentPovDocument | null> {
  const cached = await CacheService.get<AgentPovDocument>(cacheKey(threadId, agentId));
  if (cached) return cached;

  const rows = await db
    .select()
    .from(agentPovDocuments)
    .where(and(eq(agentPovDocuments.threadId, threadId), eq(agentPovDocuments.agentId, agentId)))
    .limit(1);

  const doc = rows[0] ?? null;
  if (doc) {
    await CacheService.set(cacheKey(threadId, agentId), doc, CACHE_TTL_SECONDS);
  }
  return doc;
}

export async function getOrInit(threadId: string, agentId: string): Promise<AgentPovDocument> {
  const existing = await get(threadId, agentId);
  if (existing) return existing;

  const inserted = await db
    .insert(agentPovDocuments)
    .values({ threadId, agentId })
    .onConflictDoNothing({ target: [agentPovDocuments.threadId, agentPovDocuments.agentId] })
    .returning();

  if (inserted[0]) {
    await CacheService.set(cacheKey(threadId, agentId), inserted[0], CACHE_TTL_SECONDS);
    return inserted[0];
  }

  // Conflict: someone else inserted concurrently. Re-fetch.
  const reread = await get(threadId, agentId);
  if (!reread) {
    throw new Error(`Failed to init POV doc for ${threadId}/${agentId}`);
  }
  return reread;
}

export class StaleVersionError extends Error {
  constructor(threadId: string, agentId: string, expectedVersion: number) {
    super(
      `StaleVersionError: POV doc for ${threadId}/${agentId} expected version ${expectedVersion} but DB version differed`,
    );
    this.name = "StaleVersionError";
  }
}

export interface PovPatch {
  selfPosition?: Record<string, any>;
  othersSummary?: Record<string, any>;
  outgoingQa?: any[];
  incomingQa?: any[];
  chairQa?: any[];
  openThreads?: any[];
  glossary?: Record<string, any>;
  lastSynthesizedTurnId?: string | null;
  tokenCount?: number;
}

export async function upsert(args: {
  threadId: string;
  agentId: string;
  expectedVersion: number;
  patch: PovPatch;
}): Promise<AgentPovDocument> {
  const { threadId, agentId, expectedVersion, patch } = args;

  const updated = await db
    .update(agentPovDocuments)
    .set({
      ...patch,
      version: sql`${agentPovDocuments.version} + 1`,
      lastUpdatedAt: new Date(),
    })
    .where(
      and(
        eq(agentPovDocuments.threadId, threadId),
        eq(agentPovDocuments.agentId, agentId),
        eq(agentPovDocuments.version, expectedVersion),
      ),
    )
    .returning();

  if (updated.length === 0) {
    throw new StaleVersionError(threadId, agentId, expectedVersion);
  }

  // Invalidate cache so next read sees the new version.
  await CacheService.del(cacheKey(threadId, agentId));
  return updated[0];
}
