/**
 * Roundtable Boardroom Runtime — Phase 2.
 *
 * Implements the public-thread / relevance-loop / chair-override model
 * described in /memories/repo/icai-cagpt-roundtable-spec.md (Layer 4).
 *
 * Responsibilities:
 *  - Persist threads / turns / question cards.
 *  - Run a "relevance loop" on every public-thread mutation: every panel
 *    agent runs a cheap proposeTurn() in parallel; the moderator picks
 *    one (or zero) next speaker.
 *  - Execute a streaming turn for the selected agent. Streaming is
 *    SIMULATED on top of the provider's non-streaming completion so we
 *    don't have to retrofit every adapter — content is split into
 *    word-level chunks and emitted as `turn-token` SSE events.
 *  - Wrap the agent's system prompt with a hard base-knowledge gate
 *    when the agent has `useBaseKnowledge=false`.
 *  - Inject panel-KB context retrieved per agent's attached docs.
 *  - AbortController per active turn so chair "stop" or relevance
 *    collapse can interrupt cleanly.
 *
 * What this module does NOT do:
 *  - Real per-token streaming from the provider. Providers don't expose
 *    that uniformly and v1 doesn't need it.
 *
 * Phase 3 additions (no remaining deferrals):
 *  - Tool calling inside agent turns: agents can emit `ask_panelist`,
 *    `start_side_thread`, or `cede_floor` structured tool calls. The
 *    runtime executes them locally (no provider round-trips beyond the
 *    standard tool-use loop, capped at MAX_AGENT_TOOL_ITERATIONS).
 *  - Side-thread parentTurnId wiring: `start_side_thread` schedules a
 *    follow-up agent turn whose `parentTurnId` points at the calling
 *    turn so the UI can render it as a nested clarification.
 *  - Cost guardrail: per-LLM-call spend is computed from a per-provider
 *    pricing table, written to `roundtable_turns.cost_micros`, debited
 *    from `conversation_budgets.spent_usd_cents`, and refused
 *    pre-flight when the budget is enforced and exhausted.
 */

import { EventEmitter } from 'events';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  roundtableThreads,
  roundtableTurns,
  roundtableQuestionCards,
  roundtablePanels,
  roundtablePanelAgents,
  roundtablePanelAgentKbDocs,
  roundtableKbChunks,
  conversationBudgets,
  type RoundtableThread,
  type RoundtableTurn,
  type RoundtableQuestionCard,
  type RoundtablePanel,
  type RoundtablePanelAgent,
} from '@shared/schema';
import { aiProviderRegistry } from '../aiProviders/registry';
import { AIProviderName } from '../aiProviders/types';
import { embeddingService } from '../embeddingService';

// ---------------------------------------------------------------------------
// Provider helper (mirrors roundtableAgents.ts; non-streaming completion)
// ---------------------------------------------------------------------------

const STRONG_MODELS: Partial<Record<AIProviderName, string>> = {
  [AIProviderName.AZURE_OPENAI]: 'gpt-4o',
  [AIProviderName.OPENAI]: 'gpt-4o',
  [AIProviderName.CLAUDE]: 'claude-3-5-sonnet-20241022',
  [AIProviderName.GEMINI]: 'gemini-1.5-pro',
};
const MINI_MODELS: Partial<Record<AIProviderName, string>> = {
  [AIProviderName.AZURE_OPENAI]: 'gpt-4o-mini',
  [AIProviderName.OPENAI]: 'gpt-4o-mini',
  [AIProviderName.CLAUDE]: 'claude-3-5-haiku-20241022',
  [AIProviderName.GEMINI]: 'gemini-1.5-flash',
};

const PROVIDER_ORDER: AIProviderName[] = [
  AIProviderName.AZURE_OPENAI,
  AIProviderName.OPENAI,
  AIProviderName.CLAUDE,
  AIProviderName.GEMINI,
];

interface CompletionResult {
  content: string;
  tokensInput: number;
  tokensOutput: number;
  provider: AIProviderName | null;
  model: string | null;
  finishReason?: string;
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
}

// ---------------------------------------------------------------------------
// Pricing (per 1k tokens, USD cents). Conservative defaults so unknown
// providers don't under-charge the budget. Used to compute cost_micros
// (1 cent = 100 micros) for every roundtable LLM call.
// ---------------------------------------------------------------------------

const STRONG_PRICE_USDC_PER_1K: Partial<Record<AIProviderName, { in: number; out: number }>> = {
  [AIProviderName.AZURE_OPENAI]: { in: 0.25, out: 1.0 },
  [AIProviderName.OPENAI]: { in: 0.25, out: 1.0 },
  [AIProviderName.CLAUDE]: { in: 0.30, out: 1.5 },
  [AIProviderName.GEMINI]: { in: 0.10, out: 0.40 },
};
const MINI_PRICE_USDC_PER_1K: Partial<Record<AIProviderName, { in: number; out: number }>> = {
  [AIProviderName.AZURE_OPENAI]: { in: 0.015, out: 0.06 },
  [AIProviderName.OPENAI]: { in: 0.015, out: 0.06 },
  [AIProviderName.CLAUDE]: { in: 0.08, out: 0.40 },
  [AIProviderName.GEMINI]: { in: 0.008, out: 0.03 },
};

function computeCostMicros(
  provider: AIProviderName | null,
  tier: 'strong' | 'mini',
  tokensIn: number,
  tokensOut: number,
): number {
  if (!provider) return 0;
  const table = tier === 'mini' ? MINI_PRICE_USDC_PER_1K : STRONG_PRICE_USDC_PER_1K;
  const p = table[provider];
  if (!p) return 0;
  // (tokens / 1000 * cents) * 100 micros-per-cent
  const cents = (tokensIn / 1000) * p.in + (tokensOut / 1000) * p.out;
  return Math.max(0, Math.round(cents * 100));
}

async function callLLM(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
  modelTier: 'strong' | 'mini';
  signal?: AbortSignal;
  tools?: any[];
  toolChoice?: 'auto' | 'required' | 'none';
  /** When provided, lets callers thread additional history (e.g. tool-call
   *  echo + tool_result) between the system and user prompts. */
  extraMessages?: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    toolCallId?: string;
    toolName?: string;
    toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  }>;
}): Promise<CompletionResult> {
  const errors: string[] = [];
  for (const providerName of PROVIDER_ORDER) {
    if (opts.signal?.aborted) {
      throw new Error('aborted');
    }
    try {
      const provider = aiProviderRegistry.getProvider(providerName);
      if (!provider) continue;
      const map = opts.modelTier === 'mini' ? MINI_MODELS : STRONG_MODELS;
      const model = map[providerName] || 'gpt-4o';
      const messages: any[] = [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
        ...(opts.extraMessages ?? []),
      ];
      const req: any = {
        model,
        messages,
        maxTokens: opts.maxTokens,
        temperature: opts.temperature ?? 0.6,
      };
      if (opts.tools && opts.tools.length > 0) {
        req.tools = opts.tools;
        req.toolChoice = opts.toolChoice ?? 'auto';
      }
      const res = await provider.generateCompletion(req);
      return {
        content: res.content,
        tokensInput: res.tokensUsed?.input ?? 0,
        tokensOutput: res.tokensUsed?.output ?? 0,
        provider: providerName,
        model,
        finishReason: res.finishReason,
        toolCalls: (res.metadata?.toolCalls as any[] | undefined) as
          | Array<{ id: string; name: string; input: Record<string, unknown> }>
          | undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${providerName}: ${msg}`);
    }
  }
  throw new Error(`All providers failed: ${errors.join(' | ')}`);
}

// ---------------------------------------------------------------------------
// Per-thread runtime state (in-memory)
// ---------------------------------------------------------------------------

interface ThreadRuntime {
  emitter: EventEmitter;
  /** Currently streaming turn id, if any. */
  activeTurnId: string | null;
  /** AbortController for the active turn (for "stop" / relevance collapse). */
  activeAbort: AbortController | null;
  /** Lock so we don't run two relevance loops simultaneously per thread. */
  loopRunning: boolean;
  /** Queue of pending loop triggers (compressed to a single re-run). */
  loopPending: boolean;
  /** When true, the relevance loop is suspended — agents do not speak
   *  until the user explicitly resumes (or answers a pending chair
   *  question if that's what triggered the pause). */
  paused: boolean;
  /** Last activity timestamp for GC. */
  lastActivity: number;
}

const runtimes = new Map<string, ThreadRuntime>();
const RUNTIME_TTL_MS = 2 * 60 * 60 * 1000;

function getRuntime(threadId: string): ThreadRuntime {
  let r = runtimes.get(threadId);
  if (!r) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(50);
    r = {
      emitter,
      activeTurnId: null,
      activeAbort: null,
      loopRunning: false,
      loopPending: false,
      paused: false,
      lastActivity: Date.now(),
    };
    runtimes.set(threadId, r);
  }
  r.lastActivity = Date.now();
  return r;
}

setInterval(() => {
  const cutoff = Date.now() - RUNTIME_TTL_MS;
  for (const [id, r] of runtimes.entries()) {
    if (r.lastActivity < cutoff && !r.loopRunning && !r.activeTurnId) {
      r.emitter.removeAllListeners();
      runtimes.delete(id);
    }
  }
}, 10 * 60 * 1000).unref();

export function subscribe(threadId: string, listener: (event: string, data: any) => void): () => void {
  const r = getRuntime(threadId);
  const onAny = (event: string, data: any) => listener(event, data);
  r.emitter.on('event', onAny);
  return () => r.emitter.off('event', onAny);
}

function emit(threadId: string, event: string, data: any): void {
  const r = getRuntime(threadId);
  r.emitter.emit('event', event, data);
}

// ---------------------------------------------------------------------------
// Budget guardrail
// ---------------------------------------------------------------------------

export class BudgetExceededError extends Error {
  constructor(public conversationId: string, public spent: number, public budget: number) {
    super(`Conversation budget exhausted (${spent}/${budget} USD cents)`);
    this.name = 'BudgetExceededError';
  }
}

/**
 * Refuse to start a paid op if the conversation has an enforced budget
 * and the spent + reserved spend already meets/exceeds the cap.
 * Conversations without a budget row, with budget = 0 (unlimited), or
 * with `enforce = false` are always allowed.
 */
async function enforceBudgetOrThrow(conversationId: string | null | undefined): Promise<void> {
  if (!conversationId) return;
  const [row] = await db
    .select()
    .from(conversationBudgets)
    .where(eq(conversationBudgets.conversationId, conversationId))
    .limit(1);
  if (!row) return;
  if (!row.enforce) return;
  if ((row.budgetUsdCents ?? 0) <= 0) return;
  if ((row.spentUsdCents ?? 0) + (row.reservedUsdCents ?? 0) >= row.budgetUsdCents) {
    throw new BudgetExceededError(conversationId, row.spentUsdCents ?? 0, row.budgetUsdCents);
  }
}

/**
 * Debit a successful LLM call against the conversation's budget. Always
 * an upsert because callers may not have pre-created a budget row;
 * unenforced rows (the default) still receive accurate spend totals so
 * the cost dashboard is meaningful even without enforcement.
 */
async function debitBudget(conversationId: string | null | undefined, costMicros: number): Promise<void> {
  if (!conversationId || costMicros <= 0) return;
  const usdCents = Math.max(1, Math.ceil(costMicros / 100));
  try {
    await db
      .insert(conversationBudgets)
      .values({
        conversationId,
        budgetUsdCents: 0,
        spentUsdCents: usdCents,
        reservedUsdCents: 0,
        enforce: false,
        displayCurrency: 'INR',
      })
      .onConflictDoUpdate({
        target: conversationBudgets.conversationId,
        set: {
          spentUsdCents: sql`${conversationBudgets.spentUsdCents} + ${usdCents}`,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.warn('[Boardroom] debitBudget failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Agent tool schemas (OpenAI/Anthropic/Gemini-compatible JSON-schema shape)
// ---------------------------------------------------------------------------

const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'ask_panelist',
      description:
        'Post a structured question to another panelist. The question becomes an open question card on the thread; the relevance loop will route the next turn to the addressed agent. Use this when you want clarification but do NOT need an immediate inline reply nested under your turn.',
      parameters: {
        type: 'object',
        properties: {
          to_agent_name: {
            type: 'string',
            description: 'Display name of the panelist you are addressing (must be a current panel member).',
          },
          question: {
            type: 'string',
            description: 'The question text. One sentence preferred.',
          },
        },
        required: ['to_agent_name', 'question'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_side_thread',
      description:
        'Open a side-thread: ask a panelist for a tightly-scoped clarification that should be answered NOW and rendered nested under your current turn. Use when their answer is a prerequisite for your point. Limit to one side-thread per turn.',
      parameters: {
        type: 'object',
        properties: {
          to_agent_name: {
            type: 'string',
            description: 'Display name of the panelist (must be a current panel member).',
          },
          question: {
            type: 'string',
            description: 'The clarifying question. Keep it narrow and answerable in one paragraph.',
          },
        },
        required: ['to_agent_name', 'question'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cede_floor',
      description:
        'Explicitly yield the floor without contributing. Use only if the latest exchange does not actually require your specialty.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'One short sentence on why you have nothing to add.' },
        },
        additionalProperties: false,
      },
    },
  },
];

const MAX_AGENT_TOOL_ITERATIONS = 3;
const MAX_SIDE_THREADS_PER_TURN = 1;

// ---------------------------------------------------------------------------
// Thread / turn / question DB CRUD
// ---------------------------------------------------------------------------

async function ownedPanel(userId: string, panelId: string): Promise<RoundtablePanel | null> {
  const rows = await db
    .select()
    .from(roundtablePanels)
    .where(and(eq(roundtablePanels.id, panelId), eq(roundtablePanels.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

async function ownedThread(userId: string, threadId: string): Promise<{ thread: RoundtableThread; panel: RoundtablePanel } | null> {
  const rows = await db
    .select({ thread: roundtableThreads, panel: roundtablePanels })
    .from(roundtableThreads)
    .innerJoin(roundtablePanels, eq(roundtablePanels.id, roundtableThreads.panelId))
    .where(and(eq(roundtableThreads.id, threadId), eq(roundtablePanels.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createThread(
  userId: string,
  panelId: string,
  data: { title?: string; conversationId?: string | null },
): Promise<RoundtableThread> {
  const panel = await ownedPanel(userId, panelId);
  if (!panel) throw new Error('Panel not found');
  const [thread] = await db
    .insert(roundtableThreads)
    .values({
      panelId,
      conversationId: data.conversationId ?? panel.conversationId ?? null,
      title: data.title ?? 'Boardroom session',
      phase: 'opening',
    })
    .returning();
  return thread;
}

export async function listThreads(userId: string, panelId: string): Promise<RoundtableThread[]> {
  const panel = await ownedPanel(userId, panelId);
  if (!panel) return [];
  return db
    .select()
    .from(roundtableThreads)
    .where(eq(roundtableThreads.panelId, panelId))
    .orderBy(desc(roundtableThreads.createdAt));
}

export async function getThread(userId: string, threadId: string): Promise<RoundtableThread | null> {
  const owned = await ownedThread(userId, threadId);
  return owned?.thread ?? null;
}

export async function listTurns(userId: string, threadId: string): Promise<RoundtableTurn[]> {
  const owned = await ownedThread(userId, threadId);
  if (!owned) return [];
  return db
    .select()
    .from(roundtableTurns)
    .where(eq(roundtableTurns.threadId, threadId))
    .orderBy(asc(roundtableTurns.position));
}

export async function listQuestionCards(userId: string, threadId: string): Promise<RoundtableQuestionCard[]> {
  const owned = await ownedThread(userId, threadId);
  if (!owned) return [];
  return db
    .select()
    .from(roundtableQuestionCards)
    .where(eq(roundtableQuestionCards.threadId, threadId))
    .orderBy(asc(roundtableQuestionCards.createdAt));
}

async function nextPosition(threadId: string): Promise<number> {
  const rows = await db
    .select({ position: roundtableTurns.position })
    .from(roundtableTurns)
    .where(eq(roundtableTurns.threadId, threadId))
    .orderBy(desc(roundtableTurns.position))
    .limit(1);
  return (rows[0]?.position ?? -1) + 1;
}

async function insertTurn(input: {
  threadId: string;
  panelId: string;
  speakerKind: 'agent' | 'user' | 'system' | 'moderator';
  agentId?: string | null;
  parentTurnId?: string | null;
  content: string;
  status: 'queued' | 'streaming' | 'completed' | 'cancelled' | 'failed';
}): Promise<RoundtableTurn> {
  const position = await nextPosition(input.threadId);
  const [turn] = await db
    .insert(roundtableTurns)
    .values({
      threadId: input.threadId,
      panelId: input.panelId,
      speakerKind: input.speakerKind,
      agentId: input.agentId ?? null,
      parentTurnId: input.parentTurnId ?? null,
      content: input.content,
      status: input.status,
      position,
    })
    .returning();
  return turn;
}

async function updateTurn(turnId: string, patch: Partial<RoundtableTurn>): Promise<void> {
  await db.update(roundtableTurns).set(patch).where(eq(roundtableTurns.id, turnId));
}

// ---------------------------------------------------------------------------
// Public mutations (chair-driven)
// ---------------------------------------------------------------------------

export async function chairInterject(
  userId: string,
  threadId: string,
  text: string,
): Promise<RoundtableTurn> {
  const owned = await ownedThread(userId, threadId);
  if (!owned) throw new Error('Thread not found');
  const turn = await insertTurn({
    threadId,
    panelId: owned.panel.id,
    speakerKind: 'user',
    content: text,
    status: 'completed',
  });
  await updateTurn(turn.id, { completedAt: new Date() } as any);
  emit(threadId, 'turn-completed', {
    turnId: turn.id,
    speakerKind: 'user',
    content: text,
    position: turn.position,
  });
  // Trigger relevance loop with chair directive as the latest mutation.
  scheduleRelevanceLoop(userId, threadId).catch((err) => {
    console.error('[Boardroom] relevance loop failed:', err);
  });
  return turn;
}

export async function chairTagAgent(
  userId: string,
  threadId: string,
  agentId: string,
  text: string,
): Promise<RoundtableTurn> {
  const owned = await ownedThread(userId, threadId);
  if (!owned) throw new Error('Thread not found');
  const userTurn = await insertTurn({
    threadId,
    panelId: owned.panel.id,
    speakerKind: 'user',
    content: `@${agentId}: ${text}`,
    status: 'completed',
  });
  await updateTurn(userTurn.id, { completedAt: new Date() } as any);
  emit(threadId, 'turn-completed', {
    turnId: userTurn.id,
    speakerKind: 'user',
    content: userTurn.content,
    position: userTurn.position,
  });
  // Skip the loop — chair @-tag dominates routing precedence.
  await runAgentTurn(userId, threadId, agentId, { reason: 'chair-tag' }).catch((err) => {
    console.error('[Boardroom] tagged agent turn failed:', err);
  });
  return userTurn;
}

export async function cancelTurn(
  userId: string,
  threadId: string,
  turnId: string,
  reason: string = 'chair-stop',
): Promise<void> {
  const owned = await ownedThread(userId, threadId);
  if (!owned) throw new Error('Thread not found');
  const r = getRuntime(threadId);
  if (r.activeTurnId === turnId && r.activeAbort) {
    r.activeAbort.abort();
  }
  await updateTurn(turnId, {
    status: 'cancelled',
    cancelReason: reason,
    completedAt: new Date(),
  } as any);
  emit(threadId, 'turn-cancelled', { turnId, reason });
}

export async function setPhase(
  userId: string,
  threadId: string,
  phase: string,
): Promise<RoundtableThread> {
  const owned = await ownedThread(userId, threadId);
  if (!owned) throw new Error('Thread not found');
  const allowed = ['opening', 'independent-views', 'cross-examination', 'user-qa', 'synthesis', 'resolution'];
  if (!allowed.includes(phase)) throw new Error(`Unknown phase: ${phase}`);
  const [updated] = await db
    .update(roundtableThreads)
    .set({ phase, updatedAt: new Date() })
    .where(eq(roundtableThreads.id, threadId))
    .returning();
  emit(threadId, 'phase-changed', { phase });
  scheduleRelevanceLoop(userId, threadId).catch((err) => {
    console.error('[Boardroom] post-phase loop failed:', err);
  });
  return updated;
}

/**
 * Pause the boardroom for this thread. Any active streaming turn is
 * aborted; the relevance loop bails on its next pass and stays idle
 * until `resumeThread` is called. Idempotent.
 */
export async function pauseThread(userId: string, threadId: string): Promise<void> {
  const owned = await ownedThread(userId, threadId);
  if (!owned) throw new Error('Thread not found');
  const r = getRuntime(threadId);
  if (r.paused) return;
  r.paused = true;
  // Abort the active stream so the user's "stop everything" is immediate.
  if (r.activeAbort) {
    try { r.activeAbort.abort(); } catch { /* already aborted */ }
  }
  emit(threadId, 'paused', { reason: 'user' });
}

/**
 * Resume after a prior pause. Re-schedules the relevance loop so the
 * conversation picks up where it left off. Idempotent.
 */
export async function resumeThread(userId: string, threadId: string): Promise<void> {
  const owned = await ownedThread(userId, threadId);
  if (!owned) throw new Error('Thread not found');
  const r = getRuntime(threadId);
  if (!r.paused) return;
  r.paused = false;
  emit(threadId, 'resumed', {});
  scheduleRelevanceLoop(userId, threadId).catch((err) => {
    console.error('[Boardroom] post-resume loop failed:', err);
  });
}

// ---------------------------------------------------------------------------
// Question cards
// ---------------------------------------------------------------------------

export async function answerQuestion(
  userId: string,
  threadId: string,
  qid: string,
  answer: string,
): Promise<RoundtableQuestionCard> {
  const owned = await ownedThread(userId, threadId);
  if (!owned) throw new Error('Thread not found');
  const [card] = await db
    .update(roundtableQuestionCards)
    .set({
      status: 'answered',
      answer,
      answeredByUser: true,
      answeredAt: new Date(),
    })
    .where(and(
      eq(roundtableQuestionCards.id, qid),
      eq(roundtableQuestionCards.threadId, threadId),
    ))
    .returning();
  if (!card) throw new Error('Question card not found');
  emit(threadId, 'question-answered', {
    qid,
    answer,
    byUser: true,
  });
  scheduleRelevanceLoop(userId, threadId).catch(() => {});
  return card;
}

export async function redirectQuestion(
  userId: string,
  threadId: string,
  qid: string,
  newToAgentId: string,
): Promise<RoundtableQuestionCard> {
  const owned = await ownedThread(userId, threadId);
  if (!owned) throw new Error('Thread not found');
  const [card] = await db
    .update(roundtableQuestionCards)
    .set({ toAgentId: newToAgentId, toUser: false, status: 'open' })
    .where(and(
      eq(roundtableQuestionCards.id, qid),
      eq(roundtableQuestionCards.threadId, threadId),
    ))
    .returning();
  if (!card) throw new Error('Question card not found');
  emit(threadId, 'question-redirected', { qid, newToAgentId });
  scheduleRelevanceLoop(userId, threadId).catch(() => {});
  return card;
}

export async function skipQuestion(
  userId: string,
  threadId: string,
  qid: string,
): Promise<RoundtableQuestionCard> {
  const owned = await ownedThread(userId, threadId);
  if (!owned) throw new Error('Thread not found');
  const [card] = await db
    .update(roundtableQuestionCards)
    .set({ status: 'skipped' })
    .where(and(
      eq(roundtableQuestionCards.id, qid),
      eq(roundtableQuestionCards.threadId, threadId),
    ))
    .returning();
  if (!card) throw new Error('Question card not found');
  emit(threadId, 'question-skipped', { qid });
  return card;
}

// ---------------------------------------------------------------------------
// Relevance loop + agent turn execution
// ---------------------------------------------------------------------------

interface ProposeResult {
  agentId: string;
  agentName: string;
  wantsToSpeak: boolean;
  urgency: number;       // 0-10
  relevance: number;     // 0-10
  draftHeadline: string;
}

async function loadAgents(panelId: string): Promise<RoundtablePanelAgent[]> {
  return db
    .select()
    .from(roundtablePanelAgents)
    .where(eq(roundtablePanelAgents.panelId, panelId))
    .orderBy(asc(roundtablePanelAgents.position));
}

async function loadRecentThreadContext(threadId: string, limit = 12): Promise<string> {
  const turns = await db
    .select()
    .from(roundtableTurns)
    .where(eq(roundtableTurns.threadId, threadId))
    .orderBy(desc(roundtableTurns.position))
    .limit(limit);
  const ordered = turns.reverse().filter((t) => t.status === 'completed' || t.status === 'streaming');
  return ordered
    .map((t) => {
      const who = t.speakerKind === 'user' ? 'CHAIR' : t.speakerKind === 'agent' ? `AGENT(${t.agentId})` : t.speakerKind.toUpperCase();
      return `[${who}] ${t.content}`;
    })
    .join('\n\n');
}

function parseProposeResponse(raw: string, agent: RoundtablePanelAgent): ProposeResult {
  // Try strict JSON first.
  let parsed: any = null;
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try { parsed = JSON.parse(match[0]); } catch { /* fall through */ }
  }
  const wants = parsed?.wantsToSpeak ?? parsed?.wants_to_speak ?? false;
  const urgency = Number(parsed?.urgency ?? 0);
  const relevance = Number(parsed?.relevance ?? 0);
  const draft = String(parsed?.draftHeadline ?? parsed?.draft_headline ?? '').slice(0, 200);
  return {
    agentId: agent.id,
    agentName: agent.name,
    wantsToSpeak: Boolean(wants),
    urgency: isFinite(urgency) ? Math.max(0, Math.min(10, urgency)) : 0,
    relevance: isFinite(relevance) ? Math.max(0, Math.min(10, relevance)) : 0,
    draftHeadline: draft,
  };
}

async function proposeForAgent(
  agent: RoundtablePanelAgent,
  threadContext: string,
  phase: string,
): Promise<ProposeResult | null> {
  const systemPrompt = [
    `You are ${agent.name}, an expert participant in a roundtable discussion.`,
    `Persona / instructions: ${agent.systemPrompt}`,
    'You are deciding ONLY whether you should speak next, NOT speaking yet.',
    'Be honest about relevance. If your specialty is not relevant to the latest exchange, return wantsToSpeak=false.',
    'Output STRICT JSON: {"wantsToSpeak": boolean, "urgency": 0-10, "relevance": 0-10, "draftHeadline": "one short sentence"}.',
  ].join('\n');
  const userPrompt = [
    `Current phase: ${phase}.`,
    'Recent thread (most recent last):',
    threadContext || '(empty)',
    '',
    'Decide now. Output ONLY the JSON object.',
  ].join('\n');
  try {
    const res = await callLLM({
      systemPrompt,
      userPrompt,
      maxTokens: 160,
      temperature: 0.2,
      modelTier: 'mini',
    });
    return parseProposeResponse(res.content, agent);
  } catch (err) {
    console.warn(`[Boardroom] proposeTurn failed for ${agent.name}:`, err);
    return null;
  }
}

async function pickNextSpeaker(proposals: ProposeResult[]): Promise<ProposeResult | null> {
  const candidates = proposals.filter((p) => p.wantsToSpeak && (p.urgency + p.relevance) >= 6);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.urgency + b.relevance) - (a.urgency + a.relevance));
  return candidates[0];
}

/**
 * Schedule a relevance loop iteration. Deduplicates: if one is already
 * running, marks pending so a single re-run happens after the active
 * one finishes (instead of N concurrent loops trampling each other).
 */
async function scheduleRelevanceLoop(userId: string, threadId: string): Promise<void> {
  const r = getRuntime(threadId);
  if (r.loopRunning) {
    r.loopPending = true;
    return;
  }
  r.loopRunning = true;
  try {
    do {
      r.loopPending = false;
      await runRelevanceLoop(userId, threadId);
    } while (r.loopPending);
  } finally {
    r.loopRunning = false;
  }
}

async function runRelevanceLoop(userId: string, threadId: string): Promise<void> {
  const owned = await ownedThread(userId, threadId);
  if (!owned) return;

  // ── Pause guard ────────────────────────────────────────────────
  // Honour an explicit user-initiated pause. The loop bails immediately;
  // resumeThread() clears the flag and re-schedules.
  const r = getRuntime(threadId);
  if (r.paused) {
    emit(threadId, 'loop-idle', { reason: 'paused' });
    return;
  }

  const agents = await loadAgents(owned.panel.id);
  if (agents.length === 0) return;

  // ── Address routing ────────────────────────────────────────────
  // If there's an open question card addressed to a specific panelist,
  // they get the next turn directly — skip propose-and-pick. This matches
  // the contract advertised in the ask_panelist tool description and stops
  // questions from piling up unanswered while agents repeat themselves.
  // FIFO across cards so the oldest unanswered question is handled first.
  const openCards = await db
    .select()
    .from(roundtableQuestionCards)
    .where(and(
      eq(roundtableQuestionCards.threadId, threadId),
      eq(roundtableQuestionCards.status, 'open'),
    ))
    .orderBy(asc(roundtableQuestionCards.createdAt));

  // ── Chair-question gate ───────────────────────────────────────
  // If any open card is addressed to the chair (toUser=true), agents
  // must NOT speak over a pending chair question. Stop the loop here;
  // answerQuestion / skipQuestion / redirectQuestion already schedule
  // the loop again, so it'll resume naturally when the user acts.
  const chairWaiting = openCards.find((c) => c.toUser);
  if (chairWaiting) {
    emit(threadId, 'loop-idle', { reason: 'awaiting-chair', cardId: chairWaiting.id });
    return;
  }

  const directable = openCards.find((c) => c.toAgentId && !c.toUser);
  if (directable && directable.toAgentId) {
    const target = agents.find((a) => a.id === directable.toAgentId);
    if (target) {
      // Run the addressed agent with the question injected. Mark the card
      // answered ONLY if the turn produced real content — if the agent
      // ceded or failed, leave the card open so the user can re-route
      // (or another agent can pick it up).
      const beforePos = await nextPosition(threadId);
      await runAgentTurn(userId, threadId, target.id, {
        reason: 'answer-question',
        headline: directable.text.slice(0, 80),
        injectedPrompt: `Another panelist asked you: "${directable.text}"\n\nAnswer this directly first; add any further analysis after.`,
      });
      const [completedTurn] = await db
        .select()
        .from(roundtableTurns)
        .where(and(
          eq(roundtableTurns.threadId, threadId),
          eq(roundtableTurns.agentId, target.id),
          sql`${roundtableTurns.position} >= ${beforePos}`,
        ))
        .orderBy(desc(roundtableTurns.position))
        .limit(1);
      const answered = completedTurn
        && completedTurn.status === 'completed'
        && (completedTurn.content?.trim().length ?? 0) > 0;
      if (answered) {
        await db
          .update(roundtableQuestionCards)
          .set({ status: 'answered', answeredByAgentId: target.id, answeredAt: new Date() })
          .where(eq(roundtableQuestionCards.id, directable.id));
        emit(threadId, 'question-answered', { qid: directable.id, byAgentId: target.id });
      }
      // runAgentTurn's finally block already schedules the next loop pass,
      // which will pick up the next open card (or fall through to propose).
      return;
    }
  }

  // ── Normal propose-and-pick path ───────────────────────────────
  const threadContext = await loadRecentThreadContext(threadId, 10);

  // Notify clients all agents are evaluating relevance.
  for (const a of agents) {
    emit(threadId, 'participant-state', { agentId: a.id, state: 'thinking' });
  }

  const proposals = await Promise.all(
    agents.map((a) => proposeForAgent(a, threadContext, owned.thread.phase)),
  );
  const valid = proposals.filter((p): p is ProposeResult => p !== null);
  const winner = await pickNextSpeaker(valid);

  for (const a of agents) {
    emit(threadId, 'participant-state', { agentId: a.id, state: 'listening' });
  }

  if (!winner) {
    emit(threadId, 'loop-idle', { reason: 'no agent wanted floor' });
    return;
  }
  await runAgentTurn(userId, threadId, winner.agentId, { reason: 'relevance-pick', headline: winner.draftHeadline });
}

async function gatherKbContext(agentId: string, query: string): Promise<{ snippets: string; citations: Array<{ docId: string; chunkIndex: number }> }> {
  const links = await db
    .select({ docId: roundtablePanelAgentKbDocs.docId })
    .from(roundtablePanelAgentKbDocs)
    .where(eq(roundtablePanelAgentKbDocs.agentId, agentId));
  if (links.length === 0) return { snippets: '', citations: [] };

  const docIds = links.map((l: { docId: string }) => l.docId);
  const chunks = await db
    .select()
    .from(roundtableKbChunks)
    .where(inArray(roundtableKbChunks.docId, docIds));
  if (chunks.length === 0) return { snippets: '', citations: [] };

  let queryEmbedding: number[] | null = null;
  try {
    if (!embeddingService['initialized']) embeddingService.initialize();
    if (embeddingService.isAvailable && embeddingService.isAvailable()) {
      const result = await embeddingService.generateEmbedding(query);
      queryEmbedding = result?.embedding ?? null;
    }
  } catch {
    queryEmbedding = null;
  }

  function cosine(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  const scored = chunks.map((c) => {
    let score = 0;
    if (queryEmbedding && c.embedding) {
      try {
        const v = JSON.parse(c.embedding) as number[];
        score = cosine(queryEmbedding, v);
      } catch { score = 0; }
    } else {
      // Fallback: cheap keyword overlap.
      const q = query.toLowerCase();
      const t = c.text.toLowerCase();
      const tokens = q.split(/\W+/).filter((w) => w.length > 3);
      score = tokens.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    }
    return { chunk: c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5).filter((s) => s.score > 0);
  const snippets = top
    .map((s, i) => `[${i + 1}] ${s.chunk.text.slice(0, 800)}`)
    .join('\n\n');
  const citations = top.map((s) => ({ docId: s.chunk.docId, chunkIndex: s.chunk.chunkIndex }));
  return { snippets, citations };
}

function buildAgentSystemPrompt(
  agent: RoundtablePanelAgent,
  kbSnippets: string,
  allAgents: RoundtablePanelAgent[],
): string {
  const baseGate = agent.useBaseKnowledge
    ? `You may use your training knowledge in addition to any provided context.`
    : `STRICT BASE-KNOWLEDGE GATE: You MUST answer only from the provided KB context below. If the context does not contain the answer, reply exactly "No source in panel KB" and stop. Do NOT use your training knowledge.`;
  const kbBlock = kbSnippets
    ? `\n\n=== PANEL KB CONTEXT (for retrieval-grounded answers) ===\n${kbSnippets}\n=== END KB ===`
    : (agent.useBaseKnowledge ? '' : '\n\n(No KB context retrieved for this turn.)');

  // Roster: every OTHER member, by name + template/category, so the agent
  // knows who actually exists on this panel and can address them by their
  // real display name. Without this, agents hallucinate roles ("defer to
  // governance and funding agents") that aren't on the panel.
  const others = allAgents.filter((a) => a.id !== agent.id);
  const rosterBlock = others.length === 0
    ? `\n\n=== PANEL ROSTER ===\nYou are the only panelist. There are no other agents to address — direct any clarifying questions to the chair (the user) using ask_panelist with to_agent_name="chair".\n=== END ROSTER ===`
    : `\n\n=== PANEL ROSTER (other members you may address) ===\n${others
        .map((a) => {
          const tag = a.createdFromTemplate ? ` [${a.createdFromTemplate}]` : '';
          return `  • "${a.name}"${tag}`;
        })
        .join('\n')}\nThe chair (the user) can also be addressed as to_agent_name="chair".\nIMPORTANT: If a question requires a specialty NOT represented above, address the chair — do NOT invent panelists ("Governance Bot", "Legal Counsel") that don't exist.\n=== END ROSTER ===`;

  return [
    `You are ${agent.name}, a panel expert in a roundtable discussion.`,
    `Persona / instructions: ${agent.systemPrompt}`,
    baseGate,
    'Stay in character. Speak in the first person. Keep your contribution focused and under ~250 words unless the chair asks for depth.',
    '',
    'Available tools (PREFER calling these over writing rhetorical disagreement in prose):',
    '  • ask_panelist({to_agent_name, question})       — open question card; relevance loop routes the next speaker. Use whenever you would otherwise write "I need to know X from <other agent>" or "<other agent> should clarify Y".',
    '  • start_side_thread({to_agent_name, question})  — nested clarification answered immediately under your turn. Use sparingly (max one per turn) and only when their answer is a prerequisite you cannot proceed without.',
    '  • cede_floor({reason})                          — yield without speaking when the topic is genuinely outside your specialty AND another panelist on the roster covers it.',
    '',
    'Tool usage rules:',
    '  - You may pair AT MOST one tool call with your spoken contribution.',
    '  - Do NOT embed pseudo-questions in prose ("I wonder if Tax could clarify…") — call ask_panelist instead.',
    '  - When the chair explicitly asks you to "ask them directly", "challenge each other", or to surface dependencies on another specialty, you SHOULD use ask_panelist for at least one concrete question.',
    '  - to_agent_name MUST exactly match a name from the PANEL ROSTER above (or "chair").',
    rosterBlock,
    kbBlock,
  ].join('\n');
}

/**
 * Tokenizer-free chunking used to simulate streaming. Splits content
 * into ~5-word groups so the UI gets visible incremental tokens.
 */
function chunkContentForStreaming(content: string): string[] {
  const words = content.split(/(\s+)/);
  const chunks: string[] = [];
  let buf = '';
  let count = 0;
  for (const w of words) {
    buf += w;
    if (!/^\s+$/.test(w)) count++;
    if (count >= 5) {
      chunks.push(buf);
      buf = '';
      count = 0;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

async function runAgentTurn(
  userId: string,
  threadId: string,
  agentId: string,
  meta: { reason: string; headline?: string; parentTurnId?: string | null; injectedPrompt?: string },
): Promise<void> {
  const owned = await ownedThread(userId, threadId);
  if (!owned) return;

  const r = getRuntime(threadId);
  if (r.activeTurnId) {
    // Spec: only abort if chair says stop or relevance collapses. A new
    // pick during an active stream means we yield gracefully; the new
    // pick will be re-evaluated when the active turn finishes.
    return;
  }

  const [agent] = await db
    .select()
    .from(roundtablePanelAgents)
    .where(and(eq(roundtablePanelAgents.id, agentId), eq(roundtablePanelAgents.panelId, owned.panel.id)))
    .limit(1);
  if (!agent) return;

  // Phase 3: refuse the turn pre-flight if the conversation budget is
  // enforced and exhausted. Surface as a system event so the UI can
  // explain why the boardroom went idle.
  try {
    await enforceBudgetOrThrow(owned.thread.conversationId);
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      emit(threadId, 'budget-exhausted', {
        conversationId: owned.thread.conversationId,
        spent: err.spent,
        budget: err.budget,
      });
      emit(threadId, 'loop-idle', { reason: 'budget-exhausted' });
      return;
    }
    throw err;
  }

  const turn = await insertTurn({
    threadId,
    panelId: owned.panel.id,
    speakerKind: 'agent',
    agentId: agent.id,
    parentTurnId: meta.parentTurnId ?? null,
    content: '',
    status: 'streaming',
  });

  const abort = new AbortController();
  r.activeTurnId = turn.id;
  r.activeAbort = abort;

  await db
    .update(roundtableThreads)
    .set({ currentTurnId: turn.id, updatedAt: new Date() })
    .where(eq(roundtableThreads.id, threadId));

  emit(threadId, 'turn-started', {
    turnId: turn.id,
    agentId: agent.id,
    agentName: agent.name,
    reason: meta.reason,
    headline: meta.headline ?? null,
    position: turn.position,
    parentTurnId: meta.parentTurnId ?? null,
  });
  emit(threadId, 'participant-state', { agentId: agent.id, state: 'speaking' });

  // Side-threads scheduled by tool calls during this turn. Executed AFTER
  // the parent turn is persisted so they nest correctly in render order.
  const pendingSideThreads: Array<{ targetAgentId: string; question: string; cardId: string }> = [];

  try {
    const threadContext = await loadRecentThreadContext(threadId, 12);
    const lastUserish = threadContext.split('\n').filter((l) => l.startsWith('[CHAIR]')).pop() ?? threadContext;
    const queryForKb = (meta.injectedPrompt ?? lastUserish.replace('[CHAIR]', '')).trim() || agent.name;
    const { snippets, citations } = await gatherKbContext(agent.id, queryForKb);

    // Load roster early so it can be injected into the system prompt and
    // also used by the tool-call resolver below.
    const allAgents = await loadAgents(owned.panel.id);
    const findAgentByName = (raw: string): RoundtablePanelAgent | null => {
      const norm = raw.trim().toLowerCase();
      if (!norm) return null;
      return (
        allAgents.find((a) => a.id === raw) ??
        allAgents.find((a) => a.name.toLowerCase() === norm) ??
        allAgents.find((a) => a.name.toLowerCase().includes(norm)) ??
        null
      );
    };

    const systemPrompt = buildAgentSystemPrompt(agent, snippets, allAgents);
    const userPrompt = [
      `Current phase: ${owned.thread.phase}.`,
      'Recent thread (most recent last):',
      threadContext || '(empty)',
      '',
      meta.injectedPrompt ? `Direct request to you: ${meta.injectedPrompt}` : '',
      meta.headline ? `Your draft headline (refine if needed): ${meta.headline}` : '',
      'Now contribute your turn. Use tools where appropriate; otherwise respond in plain text.',
    ].filter(Boolean).join('\n');

    // -- Tool-call loop -------------------------------------------------

    const extraMessages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string;
      toolCallId?: string;
      toolName?: string;
      toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
    }> = [];

    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let totalCostMicros = 0;
    let lastProvider: AIProviderName | null = null;
    let lastModel: string | null = null;
    let finalContent = '';
    let cededReason: string | null = null;
    const cardIds: string[] = [];
    let questionId: string | null = null;
    let sideThreadCount = 0;

    for (let iter = 0; iter < MAX_AGENT_TOOL_ITERATIONS; iter++) {
      if (abort.signal.aborted) throw new Error('aborted');
      const result = await callLLM({
        systemPrompt,
        userPrompt,
        maxTokens: agent.model === 'mini' ? 600 : 1200,
        temperature: 0.6,
        modelTier: agent.model === 'mini' ? 'mini' : 'strong',
        signal: abort.signal,
        tools: AGENT_TOOLS,
        toolChoice: 'auto',
        extraMessages: extraMessages.length > 0 ? extraMessages : undefined,
      });

      totalTokensIn += result.tokensInput;
      totalTokensOut += result.tokensOutput;
      totalCostMicros += computeCostMicros(
        result.provider,
        agent.model === 'mini' ? 'mini' : 'strong',
        result.tokensInput,
        result.tokensOutput,
      );
      lastProvider = result.provider;
      lastModel = result.model;
      finalContent = result.content ?? '';

      const toolCalls = result.toolCalls ?? [];
      const wantsTools = result.finishReason === 'tool_calls' && toolCalls.length > 0;
      if (!wantsTools) break;

      // Execute each tool call locally and append a tool_result message.
      extraMessages.push({
        role: 'assistant',
        content: finalContent,
        toolCalls,
      });
      for (const call of toolCalls) {
        let resultPayload: Record<string, unknown> = { ok: false };
        try {
          if (call.name === 'cede_floor') {
            cededReason = String((call.input as any)?.reason ?? '').slice(0, 240) || 'no specialty match';
            resultPayload = { ok: true };
          } else if (call.name === 'ask_panelist' || call.name === 'start_side_thread') {
            const targetName = String((call.input as any)?.to_agent_name ?? '').trim();
            const question = String((call.input as any)?.question ?? '').trim();
            const isChair = /^chair$|^the chair$|^user$|^you$/i.test(targetName);
            if (!question) {
              resultPayload = { ok: false, error: 'question is required' };
            } else if (isChair) {
              // Chair-targeted card: question stays open in the right rail
              // until the user answers it. Side-thread variant doesn't make
              // sense here (no auto-reply from chair) — downgrade to ask.
              const [card] = await db
                .insert(roundtableQuestionCards)
                .values({
                  threadId,
                  parentTurnId: turn.id,
                  fromAgentId: agent.id,
                  toAgentId: null,
                  toUser: true,
                  text: question,
                  status: 'open',
                })
                .returning();
              cardIds.push(card.id);
              if (!questionId) questionId = card.id;
              emit(threadId, 'question-card', {
                qid: card.id,
                fromAgentId: agent.id,
                toAgentId: null,
                toUser: true,
                text: question,
                parentTurnId: turn.id,
                sideThread: false,
              });
              resultPayload = { ok: true, question_card_id: card.id, will_run_inline: false };
            } else {
              const target = findAgentByName(targetName);
              if (!target) {
                resultPayload = { ok: false, error: `unknown panelist: ${targetName}` };
              } else if (target.id === agent.id) {
                resultPayload = { ok: false, error: 'cannot address yourself' };
              } else {
                const isSide = call.name === 'start_side_thread';
                if (isSide && sideThreadCount >= MAX_SIDE_THREADS_PER_TURN) {
                  resultPayload = {
                    ok: false,
                    error: `at most ${MAX_SIDE_THREADS_PER_TURN} side-thread per turn`,
                  };
                } else {
                  const [card] = await db
                    .insert(roundtableQuestionCards)
                    .values({
                      threadId,
                      parentTurnId: turn.id,
                      fromAgentId: agent.id,
                      toAgentId: target.id,
                      toUser: false,
                      text: question,
                      status: 'open',
                    })
                    .returning();
                  cardIds.push(card.id);
                  if (!questionId) questionId = card.id;
                  emit(threadId, 'question-card', {
                    qid: card.id,
                    fromAgentId: agent.id,
                    toAgentId: target.id,
                    toUser: false,
                    text: question,
                    parentTurnId: turn.id,
                    sideThread: isSide,
                  });
                  if (isSide) {
                    sideThreadCount++;
                    pendingSideThreads.push({
                      targetAgentId: target.id,
                      question,
                      cardId: card.id,
                    });
                  }
                  resultPayload = {
                    ok: true,
                    question_card_id: card.id,
                    will_run_inline: isSide,
                  };
                }
              }
            }
          } else {
            resultPayload = { ok: false, error: `unknown tool: ${call.name}` };
          }
        } catch (e: any) {
          resultPayload = { ok: false, error: e?.message ?? String(e) };
        }
        extraMessages.push({
          role: 'tool',
          content: JSON.stringify(resultPayload),
          toolCallId: call.id,
          toolName: call.name,
        });
      }
      // Loop: re-call so the agent can respond after seeing the tool results.
    }

    if (abort.signal.aborted) {
      throw new Error('aborted');
    }

    // Cede-floor short-circuit: drop the turn entirely so it doesn't
    // pollute the transcript with empty bubbles. The card list (if any)
    // still applies because the model may have asked questions before
    // ceding — preserve them.
    if (cededReason && finalContent.trim().length === 0 && cardIds.length === 0) {
      await updateTurn(turn.id, {
        status: 'cancelled',
        cancelReason: `ceded: ${cededReason}`.slice(0, 120),
        completedAt: new Date(),
        tokensInput: totalTokensIn,
        tokensOutput: totalTokensOut,
        costMicros: totalCostMicros,
      } as any);
      await debitBudget(owned.thread.conversationId, totalCostMicros);
      emit(threadId, 'turn-cancelled', { turnId: turn.id, reason: `ceded: ${cededReason}` });
      emit(threadId, 'participant-state', { agentId: agent.id, state: 'listening' });
      return;
    }

    // Simulate streaming — replay the final text to the UI in chunks.
    const chunks = chunkContentForStreaming(finalContent);
    let accumulated = '';
    for (const piece of chunks) {
      if (abort.signal.aborted) break;
      accumulated += piece;
      emit(threadId, 'turn-token', { turnId: turn.id, token: piece });
      await new Promise((res) => setTimeout(res, 30));
    }

    const persistedContent = abort.signal.aborted ? accumulated : finalContent;
    const finalStatus = abort.signal.aborted ? 'cancelled' : 'completed';

    await updateTurn(turn.id, {
      content: persistedContent,
      status: finalStatus,
      cancelReason: abort.signal.aborted ? 'aborted' : null,
      tokensInput: totalTokensIn,
      tokensOutput: totalTokensOut,
      costMicros: totalCostMicros,
      citations: citations as any,
      completedAt: new Date(),
    } as any);
    await debitBudget(owned.thread.conversationId, totalCostMicros);

    if (finalStatus === 'cancelled') {
      emit(threadId, 'turn-cancelled', { turnId: turn.id, reason: 'aborted' });
    } else {
      emit(threadId, 'turn-completed', {
        turnId: turn.id,
        agentId: agent.id,
        speakerKind: 'agent',
        content: persistedContent,
        citations,
        position: turn.position,
        questionId,
        parentTurnId: meta.parentTurnId ?? null,
      });
    }
    emit(threadId, 'participant-state', { agentId: agent.id, state: 'listening' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateTurn(turn.id, {
      status: msg === 'aborted' ? 'cancelled' : 'failed',
      cancelReason: msg.slice(0, 120),
      completedAt: new Date(),
    } as any);
    if (msg === 'aborted') {
      emit(threadId, 'turn-cancelled', { turnId: turn.id, reason: 'aborted' });
    } else {
      emit(threadId, 'turn-failed', { turnId: turn.id, error: msg });
    }
    emit(threadId, 'participant-state', { agentId: agent.id, state: 'listening' });
  } finally {
    r.activeTurnId = null;
    r.activeAbort = null;
    await db
      .update(roundtableThreads)
      .set({ currentTurnId: null, updatedAt: new Date() })
      .where(eq(roundtableThreads.id, threadId));

    // Run any side-threads serialised after the parent turn so they
    // appear nested in render order. Each side-thread becomes a child
    // agent turn with parentTurnId=parent.id and answers the question
    // card opened during the tool call.
    for (const side of pendingSideThreads) {
      try {
        await runAgentTurn(userId, threadId, side.targetAgentId, {
          reason: 'side-thread',
          parentTurnId: turn.id,
          injectedPrompt: side.question,
        });
        // Mark the question card as answered (the side-thread turn IS
        // the answer; we keep the card row for audit but flip status).
        await db
          .update(roundtableQuestionCards)
          .set({ status: 'answered', answeredByAgentId: side.targetAgentId, answeredAt: new Date() })
          .where(eq(roundtableQuestionCards.id, side.cardId));
        emit(threadId, 'question-answered', { qid: side.cardId, byAgentId: side.targetAgentId });
      } catch (e) {
        console.error('[Boardroom] side-thread failed:', e);
      }
    }

    // Continue the relevance loop after the turn (and any side-threads)
    // finish.
    scheduleRelevanceLoop(userId, threadId).catch((err) => {
      console.error('[Boardroom] post-turn loop failed:', err);
    });
  }
}

/**
 * Convenience: kick off the very first relevance pass on a new thread,
 * usually right after the chair posts their opening prompt.
 */
export async function kickoff(userId: string, threadId: string): Promise<void> {
  await scheduleRelevanceLoop(userId, threadId);
}

// ---------------------------------------------------------------------------
// Test-only exports. Module-private helpers exposed under a single
// namespace so unit tests can exercise pure logic (cost math, tool
// schemas, streaming chunker, JSON parser) without standing up the DB
// or provider stack. Do NOT import from production code.
// ---------------------------------------------------------------------------

export const __testInternals = {
  computeCostMicros,
  chunkContentForStreaming,
  parseProposeResponse,
  pickNextSpeaker,
  AGENT_TOOLS,
  MAX_AGENT_TOOL_ITERATIONS,
  MAX_SIDE_THREADS_PER_TURN,
  STRONG_PRICE_USDC_PER_1K,
  MINI_PRICE_USDC_PER_1K,
};
