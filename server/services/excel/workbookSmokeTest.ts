/**
 * Whole-workbook smoke-test.
 *
 * Takes an `ExcelWorkbookSpec` (the LLM's or an agent's output),
 * evaluates every formula via HyperFormula, and returns a typed
 * error report. Used by the Excel generation pipeline to catch
 * structural defects — #REF!, #VALUE!, #NAME?, #CYCLE!, wrong arity,
 * forward references, cross-sheet mismatches — BEFORE the workbook
 * is written to a buffer and shipped to the user.
 *
 * Also runs a set of lightweight structural lints that are cheaper
 * to check directly against the spec than via HyperFormula:
 *   • DUPLICATE_CELL        — same address emitted twice
 *   • LABEL_IN_NUMERIC_RANGE — numeric function references a label/header cell
 *   • FUNCTION_WRONG_ARITY  — IRR/NPV etc. with the wrong number of arguments
 *   • FORWARD_REFERENCE     — col-C formula references col-B cell defined later
 *   • SHEET_NOT_FOUND       — cross-sheet ref points at a missing sheet
 *   • SELF_REF              — cell formula references its own address
 *
 * Lint errors are returned alongside evaluation errors so the caller
 * (self-heal retry) can hand them back to the LLM as focused feedback.
 */

import { HyperFormula } from 'hyperformula';
import type { CellSpec, ExcelWorkbookSpec, SheetSpec } from './excelWorkbookBuilder';

export type SmokeTestErrorCode =
  | 'DUPLICATE_CELL'
  | 'LABEL_IN_NUMERIC_RANGE'
  | 'FUNCTION_WRONG_ARITY'
  | 'FORWARD_REFERENCE'
  | 'SHEET_NOT_FOUND'
  | 'SELF_REF'
  | 'EVAL_ERROR';

export interface SmokeTestError {
  code: SmokeTestErrorCode;
  sheet: string;
  cell: string;
  formula?: string;
  message: string;
  /** For EVAL_ERROR, the underlying HyperFormula error code
   *  (#REF!, #VALUE!, #NAME?, #CYCLE!, etc.). */
  evalCode?: string;
  /** Suggested replacement / fix hint, when we can compute one. */
  suggestion?: string;
}

export interface SmokeTestResult {
  ok: boolean;
  errors: SmokeTestError[];
  /** Cells that evaluated to a numeric value. Useful for cross-
   *  checking the agent-computed number against the in-workbook
   *  formula result at assertion time. */
  values: Record<string, number | string | boolean | null>;
}

// Functions that take ONE contiguous range as their first argument.
// If the spec emits e.g. `=IRR(B2, C3:C7)` we flag it.
const SINGLE_RANGE_FUNCTIONS = new Set([
  'SUM', 'AVERAGE', 'PRODUCT', 'STDEV', 'VAR', 'SUMPRODUCT',
  'IRR', 'XIRR', 'NPV', 'XNPV',
  'MIN', 'MAX', 'COUNT', 'COUNTA',
]);

// Functions that take cell/range args which MUST be numeric. A label
// in any range ref they read → #VALUE!.
const NUMERIC_RANGE_FUNCTIONS = new Set([
  'SUM', 'AVERAGE', 'PRODUCT', 'STDEV', 'VAR', 'SUMPRODUCT',
  'IRR', 'XIRR', 'NPV', 'XNPV',
  'PMT', 'IPMT', 'PPMT', 'FV', 'PV', 'RATE',
  'MIN', 'MAX', 'MEDIAN',
]);

// Known arities for strict-arity functions. Key: function name,
// value: { min, max } where max=Infinity means variadic. Arguments
// are counted as top-level comma-separated tokens inside the outer
// parens (respecting nested parens).
const FUNCTION_ARITY: Record<string, { min: number; max: number }> = {
  IRR: { min: 1, max: 2 },       // values, [guess]
  XIRR: { min: 2, max: 3 },      // values, dates, [guess]
  NPV: { min: 2, max: 255 },     // rate, value1, [value2, …]
  XNPV: { min: 3, max: 3 },      // rate, values, dates
  PMT: { min: 3, max: 5 },
  IPMT: { min: 4, max: 6 },
  PPMT: { min: 4, max: 6 },
  RATE: { min: 3, max: 6 },
  FV: { min: 3, max: 5 },
  PV: { min: 3, max: 5 },
};

/** Parse an A1 cell reference into { col, row }, 1-based. */
function parseA1(ref: string): { col: string; row: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  return { col: m[1].toUpperCase(), row: parseInt(m[2], 10) };
}

/** A1 → 0-based { col, row } for HyperFormula's coordinate system. */
function parseA1ZeroBased(ref: string): { col: number; row: number } | null {
  const parsed = parseA1(ref);
  if (!parsed) return null;
  let col = 0;
  for (const c of parsed.col) col = col * 26 + (c.charCodeAt(0) - 64);
  return { col: col - 1, row: parsed.row - 1 };
}

/** Split a function's argument list at top-level commas. */
function splitTopLevelArgs(argsString: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of argsString) {
    if (ch === '(' || ch === '{') depth++;
    else if (ch === ')' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim().length > 0) out.push(cur.trim());
  return out;
}

/** Extract every top-level function call from a formula string.
 *  Returns array of { name, args, rawCall } tuples. */
function extractFunctionCalls(formula: string): Array<{ name: string; args: string[]; rawCall: string }> {
  const calls: Array<{ name: string; args: string[]; rawCall: string }> = [];
  const re = /([A-Z][A-Z0-9_]*)\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    const name = m[1];
    const openParen = m.index + m[0].length - 1;
    let depth = 1;
    let i = openParen + 1;
    while (i < formula.length && depth > 0) {
      const ch = formula[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      i++;
    }
    if (depth !== 0) continue; // unmatched parens — let eval catch it
    const inner = formula.slice(openParen + 1, i - 1);
    calls.push({
      name: name.toUpperCase(),
      args: splitTopLevelArgs(inner),
      rawCall: formula.slice(m.index, i),
    });
  }
  return calls;
}

/** Extract every bare cell / range reference in a formula. Returns
 *  { sheet?, ref } tuples. */
function extractCellRefs(formula: string): Array<{ sheet?: string; ref: string }> {
  const refs: Array<{ sheet?: string; ref: string }> = [];
  // Sheet-qualified first.
  const re = /(?:([A-Za-z_][A-Za-z0-9_ ]*?)!)?([A-Z]+\d+(?::[A-Z]+\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    refs.push({ sheet: m[1]?.trim(), ref: m[2] });
  }
  return refs;
}

/** Run all lightweight structural lints against a spec. */
function runLints(spec: ExcelWorkbookSpec): SmokeTestError[] {
  const errors: SmokeTestError[] = [];
  const knownSheets = new Set(spec.sheets.map((s) => s.name));

  for (const sheet of spec.sheets) {
    // Build a map of cell address → cell for O(1) lookup
    const byAddr = new Map<string, CellSpec>();
    for (const cell of sheet.cells) {
      if (byAddr.has(cell.cell)) {
        errors.push({
          code: 'DUPLICATE_CELL',
          sheet: sheet.name,
          cell: cell.cell,
          message: `Cell ${cell.cell} is assigned more than once. Labels belong in column A; values in column B; formulas in column C. Emit each cell exactly once.`,
          suggestion: `Remove the duplicate entry. Keep the one whose type matches the column (A=label, B=input, C=formula).`,
        });
      }
      byAddr.set(cell.cell, cell);
    }

    for (const cell of sheet.cells) {
      if (cell.type !== 'formula' || !cell.formula) continue;
      const formula = cell.formula.replace(/^=/, '');
      const cellParsed = parseA1(cell.cell);

      // SELF_REF
      const selfRefRe = new RegExp(`(?<![A-Z])${cell.cell}(?![0-9])`, 'i');
      if (selfRefRe.test(formula)) {
        errors.push({
          code: 'SELF_REF',
          sheet: sheet.name,
          cell: cell.cell,
          formula: cell.formula,
          message: `Formula at ${cell.cell} references itself — will produce #CYCLE!.`,
          suggestion: `Reference the input cell (typically in column B of the same row) instead.`,
        });
      }

      // FUNCTION_WRONG_ARITY + IRR/XIRR semantic check.
      const calls = extractFunctionCalls(formula);
      for (const call of calls) {
        const arity = FUNCTION_ARITY[call.name];
        if (arity && (call.args.length < arity.min || call.args.length > arity.max)) {
          const expected = arity.max === arity.min
            ? `${arity.min}`
            : arity.max === Infinity
              ? `${arity.min}+`
              : `${arity.min}-${arity.max}`;
          errors.push({
            code: 'FUNCTION_WRONG_ARITY',
            sheet: sheet.name,
            cell: cell.cell,
            formula: cell.formula,
            message: `${call.name} in ${cell.cell} was called with ${call.args.length} argument(s); expected ${expected}.`,
            suggestion: call.name === 'IRR' || call.name === 'XIRR'
              ? `${call.name} takes a SINGLE contiguous range, not multiple args. Lay out the cash-flow stream in a contiguous column (e.g. B6:B11) and call ${call.name}(B6:B11).`
              : `Check the argument count for ${call.name} and adjust.`,
          });
        }
        // Semantic check for IRR/XIRR: the first argument (values)
        // MUST be a range (contain ":") OR an inline array. A single
        // cell ref here is the classic LLM mistake where the user
        // intended to pass initial_investment + cash_flows as two
        // separate args — Excel interprets it as values=single_cell,
        // guess=range, which is semantically nonsense and returns an
        // error. Catch it before HyperFormula does, with a clearer
        // suggestion.
        if ((call.name === 'IRR' || call.name === 'XIRR') && call.args.length >= 2) {
          const firstArg = call.args[0].trim();
          const firstArgIsRange = firstArg.includes(':') || firstArg.startsWith('{');
          if (!firstArgIsRange) {
            errors.push({
              code: 'FUNCTION_WRONG_ARITY',
              sheet: sheet.name,
              cell: cell.cell,
              formula: cell.formula,
              message: `${call.name} in ${cell.cell} was called as \`${call.name}(${call.args.join(', ')})\`. The first argument must be a contiguous RANGE of cash flows, not a single cell. Excel treats the second argument as a guess scalar, so this fails.`,
              suggestion: `Lay out the cash-flow stream (initial outflow + subsequent inflows) in one contiguous column — e.g. put Year 0 in B6 and Years 1..N in B7:B11, then call ${call.name}(B6:B11).`,
            });
          }
        }
      }

      // LABEL_IN_NUMERIC_RANGE — check each range ref inside a
      // numeric function against byAddr.
      for (const call of calls) {
        if (!NUMERIC_RANGE_FUNCTIONS.has(call.name)) continue;
        for (const arg of call.args) {
          const refs = extractCellRefs(arg);
          for (const r of refs) {
            // Cross-sheet ref — handled by SHEET_NOT_FOUND below.
            if (r.sheet && r.sheet !== sheet.name) continue;
            const parts = r.ref.split(':');
            // Expand range → list of addresses (bounded to avoid
            // pathological O(N²) on huge ranges — cap at 200 cells
            // per range; specs are small enough that this is fine).
            const addrs: string[] = [];
            if (parts.length === 1) {
              addrs.push(parts[0]);
            } else {
              const a = parseA1(parts[0]);
              const b = parseA1(parts[1]);
              if (a && b && a.col === b.col) {
                const lo = Math.min(a.row, b.row);
                const hi = Math.min(Math.max(a.row, b.row), lo + 200);
                for (let row = lo; row <= hi; row++) addrs.push(`${a.col}${row}`);
              }
            }
            for (const addr of addrs) {
              const target = byAddr.get(addr);
              if (!target) continue; // empty cell — eval will surface if needed
              const isNumeric =
                target.type === 'input' ||
                target.type === 'formula' ||
                (target.type === 'value' && typeof target.value === 'number');
              if (!isNumeric) {
                errors.push({
                  code: 'LABEL_IN_NUMERIC_RANGE',
                  sheet: sheet.name,
                  cell: cell.cell,
                  formula: cell.formula,
                  message: `${call.name} at ${cell.cell} references ${addr} which is type="${target.type}" — not numeric. This produces #VALUE!.`,
                  suggestion: `Move the label out of ${addr}, or narrow the range to skip it.`,
                });
              }
            }
          }
        }
      }

      // FORWARD_REFERENCE — col-C formula referencing col-B cell
      // with row strictly greater than the formula's row.
      if (cellParsed && cellParsed.col === 'C') {
        const refs = extractCellRefs(formula);
        for (const r of refs) {
          if (r.sheet && r.sheet !== sheet.name) continue;
          const parts = r.ref.split(':');
          for (const part of parts) {
            const p = parseA1(part);
            if (!p) continue;
            if (p.col === 'B' && p.row > cellParsed.row) {
              errors.push({
                code: 'FORWARD_REFERENCE',
                sheet: sheet.name,
                cell: cell.cell,
                formula: cell.formula,
                message: `Formula at ${cell.cell} forward-references ${part} (row ${p.row} > formula row ${cellParsed.row}). The layout convention forbids this.`,
                suggestion: `Move the input cell ${part} to a row above ${cell.cell}, or restructure so the formula is below its inputs.`,
              });
              break;
            }
          }
        }
      }

      // SHEET_NOT_FOUND — any cross-sheet ref to a missing sheet.
      const refs = extractCellRefs(formula);
      for (const r of refs) {
        if (!r.sheet) continue;
        if (r.sheet === sheet.name) continue;
        if (!knownSheets.has(r.sheet)) {
          // Try fuzzy match for a suggestion.
          const normalised = r.sheet.toLowerCase().replace(/\s+/g, '');
          const candidate = spec.sheets.find(
            (s) => s.name.toLowerCase().replace(/\s+/g, '') === normalised,
          );
          errors.push({
            code: 'SHEET_NOT_FOUND',
            sheet: sheet.name,
            cell: cell.cell,
            formula: cell.formula,
            message: `Cross-sheet reference to "${r.sheet}" but no sheet by that name exists in the spec.`,
            suggestion: candidate
              ? `Did you mean "${candidate.name}"? Change ${r.sheet}!… to ${candidate.name}!…`
              : `Remove the reference or add a sheet named "${r.sheet}" to the spec.`,
          });
        }
      }
    }
  }

  return errors;
}

/** Convert a spec to the sheet-array form HyperFormula expects. */
function specToSheetArrays(spec: ExcelWorkbookSpec): Record<string, any[][]> {
  const sheets: Record<string, any[][]> = {};
  for (const sheet of spec.sheets) {
    const grid: any[][] = [];
    for (const cell of sheet.cells) {
      const p = parseA1(cell.cell);
      if (!p) continue;
      const colIdx = (() => {
        let n = 0;
        for (const c of p.col) n = n * 26 + (c.charCodeAt(0) - 64);
        return n - 1;
      })();
      const rowIdx = p.row - 1;
      while (grid.length <= rowIdx) grid.push([]);
      const row = grid[rowIdx];
      while (row.length <= colIdx) row.push(null);
      if (cell.type === 'formula' && cell.formula) {
        row[colIdx] = cell.formula.startsWith('=') ? cell.formula : `=${cell.formula}`;
      } else if (cell.value !== undefined) {
        row[colIdx] = cell.value;
      } else {
        row[colIdx] = null;
      }
    }
    sheets[sheet.name] = grid;
  }
  return sheets;
}

/**
 * Run the full smoke test: lints first (fast, cheap), then full
 * HyperFormula evaluation to catch anything the lints missed.
 */
export async function workbookSmokeTest(spec: ExcelWorkbookSpec): Promise<SmokeTestResult> {
  const errors: SmokeTestError[] = [];
  const values: SmokeTestResult['values'] = {};

  // 1) Lints
  errors.push(...runLints(spec));

  // 2) Full HyperFormula evaluation
  let hf: HyperFormula | null = null;
  try {
    const sheets = specToSheetArrays(spec);
    hf = HyperFormula.buildFromSheets(sheets, {
      licenseKey: 'gpl-v3',
      precisionRounding: 10,
    });
    for (const sheet of spec.sheets) {
      const sheetId = hf.getSheetId(sheet.name);
      if (sheetId === undefined) continue;
      for (const cell of sheet.cells) {
        if (cell.type !== 'formula') continue;
        const coord = parseA1ZeroBased(cell.cell);
        if (!coord) continue;
        const val = hf.getCellValue({ sheet: sheetId, col: coord.col, row: coord.row });
        if (val !== null && typeof val === 'object' && 'type' in val && (val as any).type === 'ERROR') {
          const evalCode = (val as any).value ?? 'unknown';
          errors.push({
            code: 'EVAL_ERROR',
            sheet: sheet.name,
            cell: cell.cell,
            formula: cell.formula,
            evalCode,
            message: `${cell.cell} evaluated to ${evalCode}.`,
            suggestion: evalCode === '#CYCLE!'
              ? 'Cell references a cycle; check for self-reference or circular dependency.'
              : evalCode === '#VALUE!'
                ? 'A referenced cell is text or empty where a number was expected. Check the range does not include a label row.'
                : evalCode === '#REF!'
                  ? 'A referenced cell/sheet does not exist. Check sheet names and addresses.'
                  : evalCode === '#NAME?'
                    ? 'An unknown function or named range was used. Check spelling.'
                    : 'See Excel docs for this error code.',
          });
        } else if (typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean' || val === null) {
          values[`${sheet.name}!${cell.cell}`] = val;
        }
      }
    }
  } catch (err: any) {
    errors.push({
      code: 'EVAL_ERROR',
      sheet: '(workbook)',
      cell: '(n/a)',
      message: `HyperFormula failed to build the workbook: ${err?.message ?? err}`,
    });
  } finally {
    try {
      hf?.destroy();
    } catch {
      /* hf may already be disposed */
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    values,
  };
}

/**
 * Format the smoke-test errors into the focused natural-language
 * feedback we send back to the LLM for the self-heal retry. Each
 * error becomes one bullet keyed by cell address.
 */
export function formatErrorsForLLMRetry(errors: SmokeTestError[]): string {
  if (errors.length === 0) return '';
  const lines: string[] = [];
  for (const e of errors.slice(0, 10)) {
    const addr = e.sheet === '(workbook)' ? '(workbook)' : `${e.sheet}!${e.cell}`;
    let line = `- ${addr} [${e.code}] ${e.message}`;
    if (e.suggestion) line += ` FIX: ${e.suggestion}`;
    lines.push(line);
  }
  if (errors.length > 10) {
    lines.push(`- …and ${errors.length - 10} more errors of similar kinds.`);
  }
  return lines.join('\n');
}
