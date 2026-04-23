import type { Tool } from "./types";
import { runCalculationAgents } from "../agents/calcExecutor";
import { putSolverRun } from "./solverRunCache";

export interface RunSolverInput {
  /**
   * The natural-language calculation query to hand to the registered
   * financial-calculation agents. The agents regex-match against this
   * text to decide which of them (NPV, Tax, Depreciation, ROI, Break-Even)
   * should fire. Callers should pass the verbatim user query or a
   * decomposed sub-question from Agent 1 of the Two-Agent Solver —
   * NOT a paraphrase that drops numbers.
   */
  query: string;
}

export interface RunSolverOutput {
  /** Short ids of agents that actually fired (e.g. ['npv-calculator']). */
  agentsInvoked: string[];
  /** Compact numeric outputs keyed by short agent name. Suitable to
   *  quote inline in the chat narrative. */
  results: Record<string, unknown>;
  /**
   * Handle the model passes to `build_spreadsheet` to render the
   * workbook. Null when no agent fired or none produced a spec. Must
   * be treated as opaque — its format is an internal implementation
   * detail.
   */
  solver_run_id: string | null;
}

/**
 * Runs the financial-calculation agents against a query and stashes the
 * resulting `ExcelWorkbookSpec` under an ephemeral handle. Paired with
 * `build_spreadsheet`, which consumes the handle to render the `.xlsx`.
 *
 * Why a handle instead of inlining the spec: an ExcelWorkbookSpec for a
 * multi-sheet workbook routinely exceeds 8–15 KB of JSON. Forcing the
 * LLM to relay that through a tool-call round-trip wastes tokens and
 * risks truncation/whitespace damage. The cache lets Agent 2 of the
 * Two-Agent Solver stay under the 24-round-trip ceiling.
 */
export const runSolverTool: Tool<RunSolverInput, RunSolverOutput> = {
  name: "run_solver",
  description:
    "Invoke the financial-calculation agents (NPV, IRR, corporate/personal tax, depreciation schedule, ROI, break-even) on a calculation query. Returns the numeric results plus a `solver_run_id` handle. Pass that handle to `build_spreadsheet` to render the workbook — the model MUST NOT compute numbers itself. If `agentsInvoked` is empty, no agent matched the query: fall back to asking the user for missing inputs, do not fabricate numbers.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "The calculation question in natural language, with all numeric inputs the user provided preserved verbatim (amounts, rates, years, dates).",
      },
    },
    required: ["query"],
  },
  handler: async ({ query }, ctx) => {
    const run = await runCalculationAgents(query);
    if (run.agentsInvoked.length === 0 || !run.excelSpec) {
      return {
        agentsInvoked: run.agentsInvoked,
        results: run.results,
        solver_run_id: null,
      };
    }
    const id = putSolverRun(ctx.conversationId, run.excelSpec, run.results, run.agentsInvoked);
    return {
      agentsInvoked: run.agentsInvoked,
      results: run.results,
      solver_run_id: id,
    };
  },
};
