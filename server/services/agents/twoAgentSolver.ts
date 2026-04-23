/**
 * Two-Agent Solver — skeleton.
 *
 * Spreadsheet Mode's calculation pipeline splits into two agents:
 *
 *   Agent 1 (LLM, optional): receives the raw user query and emits a
 *   structured list of numbered sub-questions, each a self-contained
 *   calculation the deterministic solver can run. The prompt forces
 *   JSON output so the server doesn't need a regex parser. If the
 *   query is already a single concrete calculation the LLM may
 *   return a single-element list — that's still correct.
 *
 *   Agent 2 (deterministic, this module): takes each sub-question
 *   and runs `runCalculationAgents` directly, without a second LLM
 *   round-trip. Excel specs from every sub-question are merged into
 *   ONE workbook (one sheet per sub-question). This bypass is the
 *   reason the per-query round-trip count stays bounded at
 *   Agent 1 (1 call) + final narrative call (1 call) = 2 total,
 *   instead of the 60-worst-case you'd get by routing every
 *   sub-question through `completeWithToolLoop`.
 *
 * This module is intentionally decoupled from any Express route or
 * SSE plumbing. Spreadsheet Mode's request handler will wire it up
 * in a later step (plan §7 step 10). Here we expose the pure
 * transformation: `(query, optional decomposer) → aggregated
 * calc-results + workbook`.
 */

import type { AIProvider } from '../aiProviders/base';
import type { CompletionRequest } from '../aiProviders/types';
import type { ExcelWorkbookSpec, SheetSpec } from '../excel/excelWorkbookBuilder';
import { runCalculationAgents } from './calcExecutor';
import { recordToolCall } from '../tools/telemetry';

export interface SubQuestion {
  /** 1-based index matching Agent 1's output order. */
  index: number;
  /** Self-contained calculation question. Must retain all numeric
   *  inputs verbatim — no paraphrases that drop numbers. */
  question: string;
  /** Short kebab-case slug used as the workbook sheet name when
   *  agents produce a spec. Auto-derived when Agent 1 omits it. */
  slug?: string;
}

export interface SolverSubResult {
  subQuestion: SubQuestion;
  /** Which agents fired for this sub-question. Empty when none
   *  matched — the caller should surface a "need more inputs"
   *  clarification instead of fabricating numbers. */
  agentsInvoked: string[];
  /** Raw per-agent numeric outputs, keyed by short agent name. */
  results: Record<string, unknown>;
}

export interface TwoAgentSolverOutput {
  subQuestions: SubQuestion[];
  subResults: SolverSubResult[];
  /** Merged workbook spec. Null when NO sub-question produced any
   *  agent output (i.e. every sub-question needs clarification). */
  workbookSpec: ExcelWorkbookSpec | null;
  /** Unique set of agent short names invoked across all sub-questions. */
  agentsInvokedUnion: string[];
}

export interface Decomposer {
  /**
   * Returns the list of sub-questions for a raw user query. Receives
   * the provider so implementations can decide between a single
   * prompt or a JSON-constrained call.
   */
  decompose: (provider: AIProvider, query: string) => Promise<SubQuestion[]>;
}

/**
 * Default pass-through decomposer: returns the input query as a
 * single sub-question. Used when Spreadsheet Mode is toggled on a
 * query that's already one concrete calculation (the common case).
 * Agent 1 (LLM decomposition) is only worth its cost for
 * multi-question prompts — see `llmJsonDecomposer` below for when
 * it kicks in.
 */
export const passThroughDecomposer: Decomposer = {
  async decompose(_provider, query) {
    return [{ index: 1, question: query, slug: 'q1' }];
  },
};

const DECOMPOSER_SYSTEM_PROMPT = `You are Agent 1 of a two-agent calculation pipeline for Chartered Accountants. Your ONLY job is to split the user's query into one or more self-contained, numerically-complete sub-questions.

Rules:
1. Preserve every number from the original query verbatim. Do NOT round, paraphrase, or drop figures.
2. Each sub-question must be answerable by ONE financial calculator: NPV, IRR, corporate/personal tax, depreciation schedule, ROI, or break-even.
3. If the query is already a single calculation, return a single-element list.
4. If inputs are missing for any calculator, still produce the sub-question — the deterministic solver will flag what's missing downstream.
5. Never perform arithmetic yourself. You are a splitter, not a solver.

Return ONLY a JSON object with shape:
{ "sub_questions": [ { "index": 1, "question": "...", "slug": "short-kebab" }, ... ] }`;

/**
 * LLM-backed decomposer. Issues a JSON-mode call to the provider and
 * parses the `sub_questions` array. On any parse failure falls back
 * to the pass-through decomposer so Spreadsheet Mode still succeeds
 * — a non-ideal split is always better than a blocked request.
 */
export const llmJsonDecomposer: Decomposer = {
  async decompose(provider, query) {
    const req: CompletionRequest = {
      messages: [
        { role: 'system', content: DECOMPOSER_SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      temperature: 0,
      maxTokens: 800,
      responseFormat: 'json',
    };
    try {
      const response = await provider.generateCompletion(req);
      const text = (response.content ?? '').trim();
      if (!text) return passThroughDecomposer.decompose(provider, query);
      const parsed = JSON.parse(text);
      const raw = Array.isArray(parsed?.sub_questions) ? parsed.sub_questions : null;
      if (!raw || raw.length === 0) return passThroughDecomposer.decompose(provider, query);
      const subQuestions: SubQuestion[] = raw
        .map((r: any, i: number): SubQuestion | null => {
          const q = typeof r?.question === 'string' ? r.question.trim() : '';
          if (!q) return null;
          return {
            index: typeof r?.index === 'number' ? r.index : i + 1,
            question: q,
            slug: typeof r?.slug === 'string' && r.slug ? r.slug : `q${i + 1}`,
          };
        })
        .filter((x: SubQuestion | null): x is SubQuestion => x !== null);
      return subQuestions.length > 0 ? subQuestions : passThroughDecomposer.decompose(provider, query);
    } catch {
      return passThroughDecomposer.decompose(provider, query);
    }
  },
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 28) || 'sheet';
}

/**
 * Agent 2 core loop: run the deterministic solver for each sub-question
 * and merge the resulting sheets into a single workbook. Sheet names
 * are prefixed with the sub-question index so a multi-sheet agent
 * (depreciation produces Schedule + Summary) stays grouped.
 */
export async function runTwoAgentSolver(
  provider: AIProvider,
  query: string,
  options: {
    decomposer?: Decomposer;
    /** Optional telemetry context. When provided, a single
     *  `twoAgentSolver` telemetry row is written with round-trip count
     *  = number of sub-questions processed. */
    telemetry?: { conversationId: string; messageId?: string | null };
  } = {},
): Promise<TwoAgentSolverOutput> {
  const decomposer = options.decomposer ?? passThroughDecomposer;
  const start = Date.now();
  const subQuestions = await decomposer.decompose(provider, query);

  const subResults: SolverSubResult[] = [];
  const mergedSheets: SheetSpec[] = [];
  const agentsSet = new Set<string>();
  let workbookMeta: ExcelWorkbookSpec['metadata'] | null = null;

  for (const sq of subQuestions) {
    const run = await runCalculationAgents(sq.question);
    subResults.push({
      subQuestion: sq,
      agentsInvoked: run.agentsInvoked,
      results: run.results,
    });
    run.agentsInvoked.forEach(a => agentsSet.add(a));

    if (run.excelSpec) {
      // Use the first produced spec's metadata as the workbook-level
      // metadata; later sheets only contribute their sheet entries.
      if (!workbookMeta) workbookMeta = run.excelSpec.metadata;
      const prefix = subQuestions.length > 1
        ? `Q${sq.index}-${sq.slug ?? slugify(sq.question)}`
        : '';
      for (const sheet of run.excelSpec.sheets) {
        const name = prefix
          ? `${prefix}-${sheet.name}`.slice(0, 31)
          : sheet.name.slice(0, 31);
        mergedSheets.push({ ...sheet, name });
      }
    }
  }

  const workbookSpec: ExcelWorkbookSpec | null = mergedSheets.length > 0 && workbookMeta
    ? {
        metadata: {
          ...workbookMeta,
          title: subQuestions.length > 1
            ? `${workbookMeta.title} — ${subQuestions.length} calculations`
            : workbookMeta.title,
        },
        sheets: mergedSheets,
      }
    : null;

  const output: TwoAgentSolverOutput = {
    subQuestions,
    subResults,
    workbookSpec,
    agentsInvokedUnion: Array.from(agentsSet),
  };

  if (options.telemetry?.conversationId) {
    await recordToolCall({
      conversationId: options.telemetry.conversationId,
      messageId: options.telemetry.messageId ?? null,
      toolName: 'twoAgentSolver',
      outcome: output.agentsInvokedUnion.length > 0 ? 'ok' : 'refused',
      durationMs: Date.now() - start,
      roundTrips: subQuestions.length,
      meta: {
        subQuestionCount: subQuestions.length,
        sheetCount: mergedSheets.length,
        agentsInvoked: output.agentsInvokedUnion,
      },
    });
  }

  return output;
}
