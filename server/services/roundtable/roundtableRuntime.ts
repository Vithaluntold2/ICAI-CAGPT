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
  /** Circuit breaker counter: increments on each turn that fails for
   *  infrastructure reasons (provider exhaustion / empty after retry).
   *  Resets to 0 on any successful (status=completed, non-empty) turn.
   *  When it crosses CIRCUIT_BREAKER_THRESHOLD, the thread auto-pauses
   *  with a degraded-providers signal so the user knows to wait. */
  consecutiveFailures: number;
  /** Last activity timestamp for GC. */
  lastActivity: number;
  /**
   * Rule-based POV store (per agent). After each completed agent turn the
   * runtime writes a compact "## My Position" block here so other agents'
   * system prompts can include a structured cue card instead of raw thread
   * history. Replaced by the LLM synthesizer in a later phase; the Map
   * interface is identical so the swap is a one-function change.
   */
  agentPOVs: Map<string, string>;
}

const CIRCUIT_BREAKER_THRESHOLD = 3;

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
      consecutiveFailures: 0,
      lastActivity: Date.now(),
      agentPOVs: new Map<string, string>(),
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
  {
    type: 'function',
    function: {
      name: 'propose_phase_transition',
      description:
        "Propose advancing the discussion to the next phase. Use this whenever you would otherwise write 'I propose we move to phase X' / 'let\\'s transition to' / 'we should now close this phase' in prose. The chair sees your proposal as a card with Accept/Reject buttons, and ALL agents pause until the chair decides — preventing the loop from running over the same ground. Typically called by the Moderator, but any panelist may use it when they believe the current phase has reached its natural end. Acceptable phases (in order): opening, independent-views, cross-examination, user-qa, synthesis, resolution.",
      parameters: {
        type: 'object',
        properties: {
          to_phase: {
            type: 'string',
            enum: ['opening', 'independent-views', 'cross-examination', 'user-qa', 'synthesis', 'resolution'],
            description: 'The phase you propose advancing to. Must be one of the six valid phases.',
          },
          rationale: {
            type: 'string',
            description: 'One or two sentences on why the current phase is complete and why this transition is the right next step.',
          },
        },
        required: ['to_phase', 'rationale'],
        additionalProperties: false,
      },
    },
  },
];

// Sentinel prefix used to mark phase-proposal cards in the existing
// roundtable_question_cards table. Avoids a schema migration: the card
// text starts with `[PROPOSAL:phase=<target>]` followed by the rationale,
// and the client renders Accept/Reject instead of the answer input when
// it sees this prefix.
export const PHASE_PROPOSAL_PREFIX = '[PROPOSAL:phase=';

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

  // When entering RESOLUTION, the deliverable must be produced —
  // we don't trust the relevance loop to pick the right agent with
  // the right intent. Directly schedule a Moderator turn with an
  // explicit memo-generation directive that re-states the H2
  // template and forbids copying synthesis structure. Falls back
  // to the normal loop if no Moderator exists on the panel.
  if (phase === 'resolution') {
    const agents = await loadAgents(owned.panel.id);
    const moderator = agents.find(
      (a) => a.createdFromTemplate === 'moderator-bot' || /moderator/i.test(a.name),
    );
    if (moderator) {
      // Run async — don't block the setPhase HTTP response. Errors are
      // swallowed because the chair doesn't need to see them; the
      // FinalMemoCard will surface "memo not generated" if it fails.
      runAgentTurn(userId, threadId, moderator.id, {
        reason: 'resolution-memo',
        headline: 'Produce the FINAL BOARD MEMO',
        injectedPrompt:
          'Produce the FINAL BOARD MEMO now. Use ONLY these H2 sections, in order, verbatim: ' +
          '## Background, ## Issue, ## Analysis, ## Recommendation, ## Risks & Mitigations, ## Implementation, ## Disclosures. ' +
          'DO NOT use synthesis structure ("(1) Consensus / (2) Dissent / (3) Open questions"). ' +
          'DO NOT title the document "Synthesis Wrap-Up", "Wrap-Up", or "Recap". ' +
          'DO NOT add "Pending chair acceptance" or any epilogue. ' +
          'Carry forward all computed numbers and citations from the synthesis turn so the memo stands alone as the deliverable.',
      }).catch((err) => {
        console.error('[Boardroom] resolution memo turn failed:', err);
      });
    } else {
      scheduleRelevanceLoop(userId, threadId).catch((err) => {
        console.error('[Boardroom] post-phase loop failed:', err);
      });
    }
  } else {
    scheduleRelevanceLoop(userId, threadId).catch((err) => {
      console.error('[Boardroom] post-phase loop failed:', err);
    });
  }
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

  // Load recent question cards too. Without this, agents never see the
  // chair's answer to a chair-targeted question (it's stored on the card,
  // not as a turn) and the conversation appears stuck — the asker keeps
  // asking the same question because their context shows it as unanswered.
  const cards = await db
    .select()
    .from(roundtableQuestionCards)
    .where(eq(roundtableQuestionCards.threadId, threadId))
    .orderBy(desc(roundtableQuestionCards.createdAt))
    .limit(limit);

  type Entry = { time: number; text: string };
  const entries: Entry[] = [];

  for (const t of turns) {
    if (t.status !== 'completed' && t.status !== 'streaming') continue;
    const who = t.speakerKind === 'user'
      ? 'CHAIR'
      : t.speakerKind === 'agent'
        ? `AGENT(${t.agentId})`
        : t.speakerKind.toUpperCase();
    entries.push({
      time: new Date(t.startedAt).getTime(),
      text: `[${who}] ${t.content}`,
    });
  }

  for (const c of cards) {
    const from = c.fromAgentId ? `AGENT(${c.fromAgentId})` : 'AGENT';
    const to = c.toUser ? 'CHAIR' : c.toAgentId ? `AGENT(${c.toAgentId})` : 'OPEN';
    if (c.status === 'answered' && c.answer) {
      const ansBy = c.answeredByUser
        ? 'CHAIR'
        : c.answeredByAgentId
          ? `AGENT(${c.answeredByAgentId})`
          : 'unknown';
      entries.push({
        time: new Date(c.answeredAt ?? c.createdAt).getTime(),
        text: `[QUESTION CARD ${from} → ${to}] ${c.text}\n[ANSWER from ${ansBy}] ${c.answer}`,
      });
    } else if (c.status === 'open') {
      entries.push({
        time: new Date(c.createdAt).getTime(),
        text: `[OPEN QUESTION CARD ${from} → ${to}] ${c.text}`,
      });
    }
    // skipped / redirected cards are noise — omit
  }

  entries.sort((a, b) => a.time - b.time);
  return entries.map((e) => e.text).join('\n\n');
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

  // ── Circuit breaker ───────────────────────────────────────────
  // If multiple turns in a row failed for infrastructure reasons
  // (provider rate-limited / exhausted), stop running the loop and
  // pause the thread. The user gets a clear UI banner and decides
  // when to resume — better than silently re-picking the same agent
  // and watching it fail forever.
  if (r.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    r.paused = true;
    emit(threadId, 'paused', { reason: 'providers-degraded' });
    emit(threadId, 'loop-idle', { reason: 'providers-degraded' });
    // Don't reset the counter here — only a successful turn (after
    // resume) clears it, which prevents auto-pause from happening
    // again on the very next attempt if the provider is still down.
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
  // In synthesis/resolution phases the wrap-up belongs to the Moderator,
  // and the Devil's Advocate gets one final concession turn ("if the
  // panel's case has survived my strongest attack, here's what would
  // flip it"). Specialists were ceding-on-pick because their phase-aware
  // prompt told them to defer — wasting LLM calls and producing ugly
  // cancelled bubbles. Restrict the propose pool to governance agents;
  // specialists can still respond if directly addressed via address-
  // routing, which runs above.
  const phase = owned.thread.phase;
  const isLatePhase = phase === 'synthesis' || phase === 'resolution';
  const governanceAgents = isLatePhase
    ? agents.filter((a) => {
        const tpl = a.createdFromTemplate ?? '';
        return tpl === 'moderator-bot'
          || tpl === 'devil-advocate-bot'
          || /moderator|advocate|critic/i.test(a.name);
      })
    : [];
  const proposingAgents = isLatePhase && governanceAgents.length > 0 ? governanceAgents : agents;

  const threadContext = await loadRecentThreadContext(threadId, 10);

  // ── Per-agent turn counts (used for silent-agent boost + fairness)
  // Counts all completed turns for this thread, grouped by agent.
  // Empty/cancelled turns don't count (they're not real contributions).
  const turnCountRows = await db
    .select({
      agentId: roundtableTurns.agentId,
      count: sql<number>`count(*)::int`,
    })
    .from(roundtableTurns)
    .where(and(
      eq(roundtableTurns.threadId, threadId),
      eq(roundtableTurns.status, 'completed'),
      sql`${roundtableTurns.agentId} IS NOT NULL`,
    ))
    .groupBy(roundtableTurns.agentId);
  const countByAgent = new Map<string, number>();
  for (const r of turnCountRows) {
    if (r.agentId) countByAgent.set(r.agentId, r.count);
  }

  // ── Just-spoken agent (excluded from this round to prevent
  // consecutive monologues from one agent — common failure mode where
  // the same agent kept winning propose-pick and restated themselves).
  // The most recent COMPLETED non-cancelled turn determines who's
  // muted this round.
  const lastCompleted = await db
    .select({ agentId: roundtableTurns.agentId })
    .from(roundtableTurns)
    .where(and(
      eq(roundtableTurns.threadId, threadId),
      eq(roundtableTurns.status, 'completed'),
      sql`${roundtableTurns.agentId} IS NOT NULL`,
    ))
    .orderBy(desc(roundtableTurns.position))
    .limit(1);
  const lastSpeakerId = lastCompleted[0]?.agentId ?? null;

  // Notify clients all agents are evaluating relevance.
  for (const a of proposingAgents) {
    emit(threadId, 'participant-state', { agentId: a.id, state: 'thinking' });
  }

  const proposals = await Promise.all(
    proposingAgents.map((a) => proposeForAgent(a, threadContext, owned.thread.phase)),
  );
  const valid = proposals.filter((p): p is ProposeResult => p !== null);

  // ── Apply silent-agent boost + just-spoken exclusion before pick.
  // Silent-agent boost: agents with 0 completed turns get +4 added to
  // (urgency + relevance) so a freshly-spawned panelist (e.g. user
  // adds Compliance Bot mid-conversation) gets pulled into the
  // discussion instead of perpetually losing on score.
  // Just-spoken exclusion: filter out the agent whose ID matches
  // lastSpeakerId so the same agent never wins two turns in a row.
  // (Address-routing above this still allows the addressed agent to
  // answer a card directed at them, even if they just spoke.)
  const adjusted = valid
    .filter((p) => p.agentId !== lastSpeakerId)
    .map((p) => {
      const count = countByAgent.get(p.agentId) ?? 0;
      if (count === 0) {
        return { ...p, urgency: Math.min(10, p.urgency + 4) };
      }
      return p;
    });
  const winner = await pickNextSpeaker(adjusted);

  for (const a of proposingAgents) {
    emit(threadId, 'participant-state', { agentId: a.id, state: 'listening' });
  }

  if (!winner) {
    // ── Semantic convergence gate ─────────────────────────────────
    // All agents explicitly returned wantsToSpeak=false (not just scored
    // below the pick threshold) → the panel has naturally converged.
    // Emit `convergence-detected` so the chair can decide whether to
    // advance the phase or let it run longer. At the final `resolution`
    // phase, emit `session-complete` instead to close the loop entirely.
    //
    // Guard: require at least one proposal to have been received (prevents
    // a spurious convergence signal when all proposeForAgent() calls fail
    // due to provider issues — that case is handled by the circuit breaker,
    // not convergence detection).
    const trulyAllCeded = valid.length > 0 && valid.every((p) => !p.wantsToSpeak);
    if (trulyAllCeded) {
      const CONVERGENCE_PHASE_ORDER = [
        'opening', 'independent-views', 'cross-examination',
        'user-qa', 'synthesis', 'resolution',
      ] as const;
      const currentIdx = CONVERGENCE_PHASE_ORDER.indexOf(phase as typeof CONVERGENCE_PHASE_ORDER[number]);
      if (phase === 'resolution') {
        emit(threadId, 'session-complete', { reason: 'converged' });
        emit(threadId, 'loop-idle', { reason: 'converged-final' });
        return;
      }
      if (currentIdx >= 0 && currentIdx < CONVERGENCE_PHASE_ORDER.length - 1) {
        const nextPhase = CONVERGENCE_PHASE_ORDER[currentIdx + 1];
        emit(threadId, 'convergence-detected', {
          currentPhase: phase,
          proposedNextPhase: nextPhase,
          reason: 'all-agents-ceded-no-open-questions',
        });
        emit(threadId, 'loop-idle', { reason: 'convergence-proposed' });
        return;
      }
    }

    // ── Moderator fallback ───────────────────────────────────────
    // No specialist scored above the (urgency + relevance) >= 6
    // threshold. Before declaring the loop idle, give the Moderator
    // a chance — but only if there's been a real gap since they last
    // spoke. Tightened from 2 → 3 specialist turns to prevent the
    // "Moderator opens, Moderator opens, Moderator opens" repetition
    // pattern observed when specialists kept coming in below threshold.
    // Also skip if the Moderator just spoke (lastSpeakerId guard).
    const moderator = agents.find(
      (a) => a.createdFromTemplate === 'moderator-bot' || /moderator/i.test(a.name),
    );
    if (moderator && moderator.id !== lastSpeakerId) {
      const recent = await db
        .select({ id: roundtableTurns.id, agentId: roundtableTurns.agentId, position: roundtableTurns.position })
        .from(roundtableTurns)
        .where(and(
          eq(roundtableTurns.threadId, threadId),
          eq(roundtableTurns.status, 'completed'),
        ))
        .orderBy(desc(roundtableTurns.position))
        .limit(6);
      const lastModeratorIdx = recent.findIndex((t) => t.agentId === moderator.id);
      // Conditions to fire the fallback:
      //   - Moderator has never spoken in the recent window, OR
      //   - At least 3 OTHER turns have happened since the Moderator's last turn.
      const shouldFallback = lastModeratorIdx === -1 || lastModeratorIdx >= 3;
      if (shouldFallback) {
        await runAgentTurn(userId, threadId, moderator.id, {
          reason: 'moderator-fallback',
          headline: 'Assess convergence and propose next step',
        });
        return;
      }
    }
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

// ---------------------------------------------------------------------------
// Rule-based POV helpers (V1 — no LLM required)
//
// After every completed agent turn the runtime stores a compact personal
// context for that agent in `ThreadRuntime.agentPOVs`. Other agents then
// receive a structured "cue card" instead of a raw full thread dump.
//
// These two functions are the ONLY surface that changes when the LLM
// synthesizer (Plan Step 1) is introduced:
//   updateRuleBasedPOV() → becomes updateSynthesizedPOV() (async, calls mini LLM)
//   buildOtherAgentsCueCard() → reads from the same Map; no change needed
// ---------------------------------------------------------------------------

/**
 * Write a minimal rule-based POV for `agentId` after they complete a turn.
 * Stores:
 *   ## My Position
 *   <last ≤400 chars of the agent's turn content>
 *
 * This placeholder is immediately useful for the cue card (other agents
 * see what each colleague currently argues) and will be replaced by a
 * richer LLM-generated block in Step 1 of the implementation plan.
 */
function updateRuleBasedPOV(r: ThreadRuntime, agentId: string, content: string): void {
  const trimmed = content.trim();
  if (!trimmed) return; // empty turn — leave the previous POV intact
  // Take the tail of the content: the last paragraph is usually the
  // clearest statement of position, not the preamble.
  const position = trimmed.length > 400 ? '…' + trimmed.slice(-400) : trimmed;
  r.agentPOVs.set(agentId, `## My Position\n${position}`);
}

/**
 * Build the "== What your colleagues currently believe ==" cue card
 * that is injected into `buildAgentSystemPrompt()` for the speaking agent.
 *
 * For each other agent that has spoken (i.e. has an entry in agentPOVs),
 * the cue card shows their `## My Position` excerpt (≤200 chars). Agents
 * that haven't spoken yet are omitted — they'll appear once they take a
 * turn.
 *
 * The cue card is intentionally compact: it gives each agent just enough
 * awareness of peers to avoid re-stating what was already said, without
 * exposing the full raw transcript (which causes convergence collapse).
 */
function buildOtherAgentsCueCard(
  threadId: string,
  currentAgentId: string,
  allAgents: RoundtablePanelAgent[],
): string {
  const r = runtimes.get(threadId);
  if (!r) return '';
  const others = allAgents.filter((a) => a.id !== currentAgentId);
  if (others.length === 0) return '';

  const lines: string[] = [];
  for (const a of others) {
    const pov = r.agentPOVs.get(a.id);
    if (!pov) continue; // hasn't spoken yet — omit
    // Extract the "## My Position" section (everything after the heading,
    // up to the next ## or end of string).
    const posMatch = pov.match(/## My Position\n([\s\S]*?)(?=\n##|$)/);
    const posText = posMatch ? posMatch[1].trim().slice(0, 200) : '';
    if (!posText) continue;
    lines.push(`[${a.name}]`);
    lines.push(`  Current position: ${posText}`);
  }

  if (lines.length === 0) return ''; // nobody has spoken yet

  return ['== What your colleagues currently believe ==', ...lines].join('\n');
}

function buildAgentSystemPrompt(
  agent: RoundtablePanelAgent,
  kbSnippets: string,
  allAgents: RoundtablePanelAgent[],
  /** Cue card from buildOtherAgentsCueCard(). Empty string = nobody else has
   *  spoken yet so there's nothing useful to show. */
  otherAgentsCueCard: string,
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

  // Cue card: compact view of what each other agent currently argues.
  // Injected BEFORE the KB block so it sits near the end of the context
  // window (most influential position). Empty on the first turn of a
  // session (nobody has a POV yet) — the section is simply omitted.
  const cueCardBlock = otherAgentsCueCard
    ? `\n\n=== COLLEAGUES' CURRENT POSITIONS (synthesized) ===\n${otherAgentsCueCard}\n=== END POSITIONS ===`
    : '';

  return [
    `You are ${agent.name}, a panel expert in a roundtable discussion.`,
    `Persona / instructions: ${agent.systemPrompt}`,
    baseGate,
    'Stay in character. Speak in the first person. Keep your contribution focused and under ~250 words unless the chair asks for depth.',
    '',
    'Available tools (PREFER calling these over writing rhetorical disagreement / suggestions in prose):',
    '  • ask_panelist({to_agent_name, question})              — open question card; relevance loop routes the next speaker. Use whenever you would otherwise write "I need to know X from <other agent>" or "<other agent> should clarify Y".',
    '  • start_side_thread({to_agent_name, question})         — nested clarification answered immediately under your turn. Use sparingly (max one per turn) and only when their answer is a prerequisite you cannot proceed without.',
    '  • propose_phase_transition({to_phase, rationale})      — formally propose advancing the discussion to the next phase. Creates a chair-targeted card with Accept/Reject; ALL agents pause until the chair decides. Use this whenever you would write "I propose we close this phase", "let\'s move to synthesis", or "we should transition to" — prose suggestions are invisible to the runtime and will be ignored.',
    '  • cede_floor({reason})                                 — yield without speaking when the topic is genuinely outside your specialty AND another panelist on the roster covers it.',
    '',
    'Tool usage rules:',
    '  - You may pair AT MOST one tool call with your spoken contribution.',
    '  - Do NOT embed pseudo-questions in prose ("I wonder if Tax could clarify…") — call ask_panelist instead.',
    '  - Do NOT embed phase-transition suggestions in prose ("let\'s move to synthesis") — call propose_phase_transition instead, otherwise the chair will not see them as actionable and the loop will keep running.',
    '  - When the chair explicitly asks you to "ask them directly", "challenge each other", or to surface dependencies on another specialty, you SHOULD use ask_panelist for at least one concrete question.',
    '  - to_agent_name MUST exactly match a name from the PANEL ROSTER above (or "chair").',
    '',
    'Output style (HARD RULE — applies to every agent on every panel):',
    '  - NO EMOJIS, NO PICTOGRAPHIC ICONS in your responses. This means no ✓ ✅ ⚠ ❗ ➡ ↗ ❌ 🚨, no numbered emoji bullets like 1️⃣ 2️⃣ 3️⃣, no decorative symbols. The chair downloads boardroom output into a board pack — emojis make it look unprofessional.',
    '  - Use plain Markdown structure only: ## H2 / ### H3 headings, **bold**, *italic*, - or 1. lists, > blockquotes, | tables |, `inline code`, $math$. The UI renders all of this richly.',
    rosterBlock,
    cueCardBlock,
    kbBlock,
  ].join('\n');
}

/**
 * Per-phase user-prompt directive. Phases are otherwise just labels;
 * this is where their semantics actually surface to the model. The
 * Moderator gets stronger nudges to drive transitions; specialists get
 * stronger nudges to stay in lane and not over-talk in synthesis /
 * resolution where the wrap-up belongs to the chair-substitute.
 */
function phaseInstructionFor(phase: string, agent: RoundtablePanelAgent): string {
  const isModerator = agent.createdFromTemplate === 'moderator-bot' || /moderator/i.test(agent.name);
  const isAdvocate = agent.createdFromTemplate === 'devil-advocate-bot' || /advocate|critic/i.test(agent.name);
  switch (phase) {
    case 'opening':
      return 'OPENING PHASE: state your position in 2-4 sentences. Do not yet challenge other panelists in detail — that\'s for cross-examination. If your position rests on a quantifiable claim (materiality, impact, threshold), compute it inline now (formula → inputs → result).';
    case 'independent-views':
      return 'INDEPENDENT VIEWS PHASE: commit to a position and surface the assumptions behind it. Stay narrow to your own specialty. Quantify any numerical claims explicitly.';
    case 'cross-examination':
      if (isAdvocate) {
        return 'CROSS-EXAMINATION PHASE: this is YOUR primary phase. Articulate the strongest possible case for the option(s) the panel is rejecting. Steel-man the rejected position in detail — citations, scenarios, defensible interpretations. The chair NEEDS this case on the record before consensus is locked. Do not concede; if the panel\'s case is genuinely overwhelming, state precisely what evidence or fact would have to be different to flip the conclusion.';
      }
      return 'CROSS-EXAMINATION PHASE: actively probe other panelists\' positions. Use ask_panelist or start_side_thread to surface dependencies and disagreements. Do not just restate your own view. Required: at least one challenge to a peer\'s claim per turn — politely converging is not allowed in this phase.';
    case 'user-qa':
      return 'USER Q&A PHASE: the chair leads. Only speak if directly addressed or if you have a critical safety/compliance flag the chair clearly missed.';
    case 'synthesis':
      return isModerator
        ? 'SYNTHESIS PHASE: produce a structured wrap-up. Required sections: (1) Consensus position with the SUPPORTING NUMBERS (materiality computed, restated amounts, journal entries). (2) Key dissent — if the Devil\'s Advocate raised a steel-man, summarise it and explain why the panel is rejecting it. (3) Open questions still unresolved. Do not introduce new analysis. After your synthesis, propose_phase_transition({to_phase: "resolution"}) if the panel agrees.'
        : 'SYNTHESIS PHASE: defer to the Moderator unless they directly address you. If you cede, do so via cede_floor — do not write empty filler.';
    case 'resolution':
      return isModerator
        ? `RESOLUTION PHASE — FINAL BOARD MEMO.

This output IS the deliverable the chair downloads as a PDF. It is NOT a synthesis recap.

HARD CONSTRAINTS:
  - DO NOT use the synthesis "(1) Consensus / (2) Dissent / (3) Open questions" structure here — that belongs to synthesis phase only.
  - DO NOT use a heading like "Synthesis Wrap-Up", "Wrap-Up", "Summary", or "Recap". Those are wrong.
  - DO NOT prefix sections with "1)", "2)", "3)" or any other numbering. Use the exact H2 headings listed below.
  - DO NOT add commentary like "Pending chair acceptance, advance to resolution" — you are ALREADY in resolution.

REQUIRED OUTPUT FORMAT — use these EXACT H2 Markdown headings, in this order, verbatim. No other top-level structure is acceptable. Each section MUST appear:

## Background
2-3 sentences on the situation: entity name, transaction, scale, deadline.

## Issue
The specific question the board is being asked to decide. One sentence.

## Analysis
The panel's reasoning, with cited standards/statutes (Ind AS X.Y, §92C, SA-705.7, etc.) and the computed numbers carried forward from synthesis (materiality benchmarks with multipliers, restated amounts, the Dr/Cr journal entry as inline lines).

## Recommendation
ONE sentence — clear, defensible, executable. Imperative voice ("Recognise the full ₹130 cr impairment and pursue covenant standstill in parallel").

## Risks & Mitigations
Numbered list (2-4 items). Each item: one-line risk + one-line mitigation. Use the Devil's Advocate's "single sensitivity that would flip the conclusion" as one of the risks.

## Implementation
Numbered list (3-6 items) of immediate next steps. For each: WHO does WHAT BY WHEN, fitting inside the chair's stated timeline.

## Disclosures
Specific Ind AS / SA / SEBI disclosures required, with paragraph references (e.g., Ind AS 36.134(d) sensitivity, Ind AS 24 related-party, SEBI LODR Reg 30 if material).

After producing the memo with all seven sections above, the discussion ENDS. Do not propose further phase transitions. Do not summarise. Do not add an epilogue. Do not add a "Pending chair acceptance" line.`
        : 'RESOLUTION PHASE: the Moderator is producing the final memo. Cede the floor unless the Moderator directly addresses you for a fact-check.';
    default:
      return '';
  }
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

    // Build the cue card showing each other agent's current position.
    // On the first turn of a session agentPOVs is empty so the card is
    // blank — that's fine; it populates after each completed turn.
    const otherAgentsCueCard = buildOtherAgentsCueCard(threadId, agent.id, allAgents);

    const systemPrompt = buildAgentSystemPrompt(agent, snippets, allAgents, otherAgentsCueCard);
    const phaseDirective = phaseInstructionFor(owned.thread.phase, agent);
    const userPrompt = [
      `Current phase: ${owned.thread.phase}.`,
      phaseDirective,
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

      // Retry with exponential backoff on transient provider issues
      // (empty content from a rate-limited provider, "All providers
      // failed" exhaustion). Max 3 attempts: 0s + 2s + 5s wait.
      // Real terminal errors (auth, schema, etc.) bubble through after
      // the last attempt and the outer try/catch marks the turn failed.
      let result: Awaited<ReturnType<typeof callLLM>> | null = null;
      let lastErr: unknown = null;
      const RETRY_BACKOFF_MS = [0, 2000, 5000];
      for (const wait of RETRY_BACKOFF_MS) {
        if (wait > 0) {
          await new Promise((r) => setTimeout(r, wait));
          if (abort.signal.aborted) throw new Error('aborted');
        }
        try {
          result = await callLLM({
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
          // Empty content with no tool calls = transient provider hiccup.
          // Retry instead of accepting silence as "the agent ceded".
          const empty = (result.content ?? '').trim().length === 0
            && (result.toolCalls ?? []).length === 0;
          if (!empty) break;
          lastErr = new Error('Provider returned empty content');
        } catch (err) {
          lastErr = err;
          if (err instanceof Error && err.message === 'aborted') throw err;
          // continue to next backoff attempt
        }
      }
      if (!result) {
        throw lastErr instanceof Error
          ? lastErr
          : new Error('LLM call failed after retries');
      }

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
          } else if (call.name === 'propose_phase_transition') {
            // Materialise the proposal as a chair-targeted question card.
            // The card text starts with `[PROPOSAL:phase=<target>]` so the
            // client can render it with one-click Accept/Reject buttons
            // instead of the freeform answer input. The chair-waiting gate
            // in runRelevanceLoop will halt all agents until the chair acts.
            const toPhase = String((call.input as any)?.to_phase ?? '').trim();
            const rationale = String((call.input as any)?.rationale ?? '').trim();
            const allowedPhases = ['opening', 'independent-views', 'cross-examination', 'user-qa', 'synthesis', 'resolution'];
            if (!allowedPhases.includes(toPhase)) {
              resultPayload = { ok: false, error: `Unknown phase: ${toPhase}. Use one of: ${allowedPhases.join(', ')}` };
            } else if (toPhase === owned.thread.phase) {
              resultPayload = { ok: false, error: `Already in phase '${toPhase}' — propose a different one or cede the floor instead.` };
            } else if (!rationale) {
              resultPayload = { ok: false, error: 'rationale is required so the chair understands why' };
            } else {
              const cardText = `${PHASE_PROPOSAL_PREFIX}${toPhase}] ${rationale}`;
              const [card] = await db
                .insert(roundtableQuestionCards)
                .values({
                  threadId,
                  parentTurnId: turn.id,
                  fromAgentId: agent.id,
                  toAgentId: null,
                  toUser: true,
                  text: cardText,
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
                text: cardText,
                parentTurnId: turn.id,
                sideThread: false,
              });
              resultPayload = {
                ok: true,
                question_card_id: card.id,
                will_run_inline: false,
                note: 'Chair will see Accept/Reject. All agents are now paused on the chair-waiting gate.',
              };
            }
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
    // Empty-response detection: occasionally the LLM completes the
    // tool-call loop with no text and no tool calls (provider hiccup,
    // safety filter, or just an unhelpful generation). Persisting this
    // as `completed` produces a hollow "(no response generated)" bubble
    // in the UI. Treat it as a cancelled turn with a distinct reason
    // so it renders as a faded inline note (same path as cede_floor).
    const isEmpty = !abort.signal.aborted && persistedContent.trim().length === 0;
    const finalStatus = abort.signal.aborted || isEmpty ? 'cancelled' : 'completed';
    const finalCancelReason = abort.signal.aborted
      ? 'aborted'
      : isEmpty
        ? 'ceded: empty response from model'
        : null;

    await updateTurn(turn.id, {
      content: persistedContent,
      status: finalStatus,
      cancelReason: finalCancelReason,
      tokensInput: totalTokensIn,
      tokensOutput: totalTokensOut,
      costMicros: totalCostMicros,
      citations: citations as any,
      completedAt: new Date(),
    } as any);
    await debitBudget(owned.thread.conversationId, totalCostMicros);

    if (finalStatus === 'cancelled') {
      // Circuit breaker: an empty-after-retry turn counts as a failure.
      // A real cede via cede_floor short-circuited above and never reaches
      // here, so this path is reserved for transient infra issues.
      if (isEmpty) {
        r.consecutiveFailures += 1;
      }
      emit(threadId, 'turn-cancelled', {
        turnId: turn.id,
        reason: finalCancelReason ?? 'aborted',
      });
    } else {
      // Real productive turn — reset the failure counter.
      r.consecutiveFailures = 0;
      // Update this agent's rule-based POV so other agents' cue cards
      // reflect their latest stated position on the next turn.
      updateRuleBasedPOV(r, agent.id, persistedContent);
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
      // Infra failure → bump the circuit breaker counter.
      r.consecutiveFailures += 1;
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
