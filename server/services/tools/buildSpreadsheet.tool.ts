import type { Tool } from "./types";
import { excelWorkbookBuilder, type ExcelWorkbookSpec } from "../excel/excelWorkbookBuilder";
import { getSolverRun } from "./solverRunCache";

export interface BuildSpreadsheetInput {
  /**
   * Handle returned by `run_solver`. Preferred path: agents already
   * produced a validated spec, Agent 2 just wires the render.
   */
  solver_run_id?: string;
  /**
   * Inline workbook spec. Only use when a solver run isn't available
   * (e.g. hand-crafted template from a pattern library). The spec is
   * validated by the builder before render.
   */
  spec?: ExcelWorkbookSpec;
  /**
   * Optional filename override (without extension). Defaults to the
   * workbook's metadata title slug, or "workbook".
   */
  filename?: string;
}

export interface BuildSpreadsheetOutput {
  /** Base64-encoded `.xlsx` bytes. The calling layer persists/streams
   *  this to the client; the tool handler is stateless w.r.t. storage. */
  xlsx_base64: string;
  /** Intended filename including `.xlsx` extension. */
  filename: string;
  /** Size of the decoded bytes, useful for cost/quota tracking. */
  size_bytes: number;
  /** Build stats surfaced for telemetry (cells, formulas, sheets). */
  stats: Record<string, number>;
  /** Non-fatal warnings from the builder (e.g. formula coerced). */
  warnings: string[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "workbook";
}

/**
 * Renders an `ExcelWorkbookSpec` to an actual `.xlsx` buffer via
 * `excelWorkbookBuilder.build`. This is the ONLY tool that produces
 * workbook bytes — runtime always funnels through the builder so
 * validation, styling defaults, and formula-safety checks apply
 * uniformly (Spreadsheet Mode's "LLM never computes" invariant).
 */
export const buildSpreadsheetTool: Tool<BuildSpreadsheetInput, BuildSpreadsheetOutput> = {
  name: "build_spreadsheet",
  description:
    "Render a workbook specification (from `run_solver` or an inline spec) into a `.xlsx` file. Returns base64-encoded bytes plus stats. Use this immediately after `run_solver` whenever the user asked for a calculation — never claim numbers in prose without also rendering the workbook. If both `solver_run_id` and `spec` are provided, `solver_run_id` wins.",
  inputSchema: {
    type: "object",
    properties: {
      solver_run_id: {
        type: "string",
        description: "Handle returned by a previous `run_solver` call.",
      },
      spec: {
        type: "object",
        description:
          "Inline ExcelWorkbookSpec — only when no solver run is available. Must include metadata and at least one sheet.",
      },
      filename: {
        type: "string",
        description:
          "Optional filename stem without extension. Defaults to the workbook title slug.",
      },
    },
  },
  handler: async ({ solver_run_id, spec, filename }, ctx) => {
    let workbookSpec: ExcelWorkbookSpec | undefined;

    if (solver_run_id) {
      const entry = getSolverRun(solver_run_id, ctx.conversationId);
      if (!entry) throw new Error("solver_run_not_found_or_expired");
      workbookSpec = entry.spec;
    } else if (spec) {
      workbookSpec = spec;
    } else {
      throw new Error("must_provide_solver_run_id_or_spec");
    }

    const result = await excelWorkbookBuilder.build(workbookSpec);
    if (!result.success || !result.buffer) {
      throw new Error(
        `spreadsheet_build_failed: ${(result.errors ?? ["unknown"]).join("; ")}`,
      );
    }

    const stem = filename?.trim() || slugify(workbookSpec.metadata.title);
    return {
      xlsx_base64: result.buffer.toString("base64"),
      filename: `${stem}.xlsx`,
      size_bytes: result.buffer.byteLength,
      stats: result.stats as unknown as Record<string, number>,
      warnings: result.warnings ?? [],
    };
  },
};
