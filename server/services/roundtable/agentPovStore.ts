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

  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  );

  const updated = await db
    .update(agentPovDocuments)
    .set({
      ...cleanPatch,
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

function isObjectEmpty(obj: Record<string, any>): boolean {
  return !obj || Object.keys(obj).length === 0;
}

export function renderForPrompt(doc: AgentPovDocument): string {
  const lines: string[] = [];
  const synced = doc.lastSynthesizedTurnId
    ? `synced through turn ${doc.lastSynthesizedTurnId}`
    : "no prior perspective; this is your first time speaking";

  lines.push(`=== YOUR PERSPECTIVE (${synced}) ===`);

  const sp = (doc.selfPosition ?? {}) as { stance?: string; conclusions?: string[] };
  if (sp.stance || (sp.conclusions && sp.conclusions.length > 0)) {
    lines.push("\nYOUR POSITION:");
    if (sp.stance) lines.push(sp.stance);
    if (sp.conclusions && sp.conclusions.length > 0) {
      for (const c of sp.conclusions) lines.push(`- ${c}`);
    }
  }

  const others = (doc.othersSummary ?? {}) as Record<string, string>;
  if (!isObjectEmpty(others)) {
    lines.push("\nWHAT OTHERS HAVE SAID:");
    for (const [name, summary] of Object.entries(others)) {
      lines.push(`- ${name}: ${summary}`);
    }
  }

  const outgoing = (doc.outgoingQa ?? []) as Array<{ to: string; question: string; answer: string }>;
  if (outgoing.length > 0) {
    lines.push("\nQUESTIONS YOU ASKED OTHERS:");
    for (const qa of outgoing) lines.push(`- To ${qa.to}: "${qa.question}" → "${qa.answer}"`);
  }

  const incoming = (doc.incomingQa ?? []) as Array<{ from: string; question: string; answer: string }>;
  if (incoming.length > 0) {
    lines.push("\nQUESTIONS ASKED OF YOU:");
    for (const qa of incoming) lines.push(`- From ${qa.from}: "${qa.question}" → You: "${qa.answer}"`);
  }

  const chair = (doc.chairQa ?? []) as Array<{ direction: "to" | "from"; text: string; answer: string }>;
  if (chair.length > 0) {
    lines.push("\nCHAIR Q&A:");
    for (const qa of chair) {
      if (qa.direction === "from") {
        lines.push(`- Chair → You: "${qa.text}" → You: "${qa.answer}"`);
      } else {
        lines.push(`- You → Chair: "${qa.text}" → Chair: "${qa.answer}"`);
      }
    }
  }

  const open = (doc.openThreads ?? []) as Array<{ description: string; awaitingFrom?: string }>;
  if (open.length > 0) {
    lines.push("\nOPEN THREADS:");
    for (const o of open) {
      const awaitingNote = o.awaitingFrom ? ` (awaiting ${o.awaitingFrom})` : "";
      lines.push(`- ${o.description}${awaitingNote}`);
    }
  }

  const glossary = (doc.glossary ?? {}) as Record<string, string>;
  if (!isObjectEmpty(glossary)) {
    lines.push("\nKEY FACTS:");
    for (const [term, def] of Object.entries(glossary)) {
      lines.push(`- ${term}: ${def}`);
    }
  }

  if (lines.length === 1) {
    // Only the header — empty doc.
    lines.push("\n(no prior perspective; this is your first time speaking)");
  }

  lines.push("\n=== END YOUR PERSPECTIVE ===");
  return lines.join("\n");
}
