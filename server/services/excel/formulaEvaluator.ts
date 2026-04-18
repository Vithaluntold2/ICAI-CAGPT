/**
 * Formula Evaluator
 *
 * Evaluates Excel-style formulas server-side using HyperFormula so the chat
 * agent can return actual computed values instead of unresolved formula text.
 *
 * Two public entry points:
 *   - evaluateStandalone(formula): evaluate a formula that has no cell refs
 *     or whose cell refs are all literal numbers inlined into the formula.
 *     Fast path for single-line formulas like `=SUM(1, 2, 3)` or
 *     `=NPV(0.09, -1000, 400, 500, 600)`.
 *   - evaluateSheet({ cells, formulas }): build a mini-sheet from a dict of
 *     cell → value and cell → formula, compute, and return every computed cell.
 *     Use when the AI produces a table of inputs and dependent formulas.
 *
 * Both paths are sandboxed by HyperFormula (no eval, no JS execution — only
 * the spreadsheet function set). Results are plain JS values.
 */

import { HyperFormula } from 'hyperformula';

export interface EvaluateResult {
  ok: boolean;
  value?: string | number | boolean;
  error?: string;
  formatted?: string; // human-friendly display, e.g. "₹ 13,382.25"
}

export interface SheetInput {
  // Cell address ("A1") → literal value
  cells?: Record<string, string | number | boolean | null>;
  // Cell address ("B1") → formula string starting with "="
  formulas: Record<string, string>;
}

export interface SheetResult {
  ok: boolean;
  values: Record<string, string | number | boolean | null>;
  errors: Record<string, string>;
}

const HF_OPTIONS = {
  licenseKey: 'gpl-v3',
  // Accept enough precision for financial work; HyperFormula rounds to 10 decimals by default.
  precisionRounding: 10,
  // Don't attach to the DOM; server-side use only.
  useColumnIndex: true,
};

/**
 * Format a numeric result for display in chat.
 *  - large numbers with grouping separators
 *  - plain numbers otherwise
 *  - detects percentages if the formula hints at a rate
 */
function formatValue(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const abs = Math.abs(v);
    if (Number.isInteger(v)) return v.toLocaleString('en-IN');
    // Show 2 decimals for money-sized numbers, more for tiny ones
    const decimals = abs >= 1 ? 2 : 6;
    return v.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

/**
 * Evaluate a single standalone formula.
 * If the formula has cell refs (A1, Sheet1!B3, etc.), this will return an error;
 * use evaluateSheet for that case.
 */
export function evaluateStandalone(formula: string): EvaluateResult {
  if (!formula) return { ok: false, error: 'empty formula' };
  const f = formula.trim();
  if (!f.startsWith('=')) {
    return { ok: false, error: 'formula must start with "="' };
  }
  // HyperFormula needs a cell to hold the formula; build a 1-cell sheet.
  let hf: HyperFormula | null = null;
  try {
    hf = HyperFormula.buildFromArray([[f]], HF_OPTIONS);
    const cellValue = hf.getCellValue({ sheet: 0, col: 0, row: 0 });
    if (cellValue && typeof cellValue === 'object' && 'value' in (cellValue as any)) {
      // DetailedCellError
      const err: any = cellValue;
      return {
        ok: false,
        error: `${err.value} — ${err.message || 'formula error'}`,
      };
    }
    return {
      ok: true,
      value: cellValue as any,
      formatted: formatValue(cellValue),
    };
  } catch (err: any) {
    return { ok: false, error: err.message || 'evaluation failed' };
  } finally {
    try { hf?.destroy(); } catch { /* ignore */ }
  }
}

/**
 * Evaluate a mini-sheet: inputs + dependent formulas. Returns every cell
 * the caller asked for (both plain inputs and computed formulas).
 * Assumes all addresses are on sheet 0.
 */
export function evaluateSheet(input: SheetInput): SheetResult {
  const cells = input.cells ?? {};
  const formulas = input.formulas ?? {};
  if (Object.keys(formulas).length === 0) {
    return { ok: false, values: {}, errors: { _: 'no formulas provided' } };
  }

  // Collect every address referenced so we can size the 2D array correctly.
  const addresses = [...Object.keys(cells), ...Object.keys(formulas)];
  let maxRow = 0;
  let maxCol = 0;
  const parsedAddresses: Array<{ addr: string; row: number; col: number }> = [];
  for (const addr of addresses) {
    const parsed = parseCellAddress(addr);
    if (!parsed) {
      return { ok: false, values: {}, errors: { [addr]: `unparseable address` } };
    }
    parsedAddresses.push({ addr, ...parsed });
    if (parsed.row > maxRow) maxRow = parsed.row;
    if (parsed.col > maxCol) maxCol = parsed.col;
  }

  // Build the 2D array; undefined cells stay null
  const grid: Array<Array<any>> = [];
  for (let r = 0; r <= maxRow; r++) {
    grid.push(new Array(maxCol + 1).fill(null));
  }
  for (const { addr, row, col } of parsedAddresses) {
    if (formulas[addr]) grid[row][col] = formulas[addr];
    else if (addr in cells) grid[row][col] = cells[addr];
  }

  let hf: HyperFormula | null = null;
  try {
    hf = HyperFormula.buildFromArray(grid, HF_OPTIONS);

    const values: Record<string, any> = {};
    const errors: Record<string, string> = {};

    for (const addr of Object.keys(formulas)) {
      const parsed = parseCellAddress(addr)!;
      const v = hf.getCellValue({ sheet: 0, col: parsed.col, row: parsed.row });
      if (v && typeof v === 'object' && 'value' in (v as any)) {
        errors[addr] = `${(v as any).value} — ${(v as any).message || 'formula error'}`;
      } else {
        values[addr] = v;
      }
    }

    // Also return pass-through input cells for convenience
    for (const [addr, v] of Object.entries(cells)) {
      if (!(addr in values)) values[addr] = v;
    }

    return { ok: Object.keys(errors).length === 0, values, errors };
  } catch (err: any) {
    return { ok: false, values: {}, errors: { _: err.message || 'evaluation failed' } };
  } finally {
    try { hf?.destroy(); } catch { /* ignore */ }
  }
}

function parseCellAddress(addr: string): { row: number; col: number } | null {
  // A1, B12, AA3, etc. We ignore sheet qualifiers for simplicity.
  const m = addr.trim().match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  const letters = m[1].toUpperCase();
  let col = 0;
  for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
  col -= 1; // 0-based
  const row = parseInt(m[2], 10) - 1;
  if (row < 0 || col < 0) return null;
  return { row, col };
}

export const formulaEvaluator = { evaluateStandalone, evaluateSheet };
