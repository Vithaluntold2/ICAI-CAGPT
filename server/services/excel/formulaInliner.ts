/**
 * Formula Inliner
 *
 * Scans an assistant message for Excel-style formulas, evaluates each one with
 * HyperFormula, and rewrites the text to show the computed value alongside the
 * formula. Only evaluates STANDALONE formulas (no cell references) — references
 * would require the cell inputs to be parsed out of the surrounding prose,
 * which is a much harder extraction problem.
 *
 * Patterns matched (in order of specificity):
 *   1.  Markdown code-span:   `=FUNC(args)`   → `=FUNC(args) → **value**`
 *   2.  Bare formula line:    =FUNC(args)     → =FUNC(args) → **value**
 *       (only when the formula contains no cell refs and sits on its own line
 *        or after a phrase like "formula is" / "equals")
 *
 * Formulas that contain cell references (A1, B3, Sheet1!C2) are left as-is,
 * because evaluating them would need the input cells and there's no reliable
 * way to infer them from free-form prose. The LLM is still free to state such
 * formulas; we just don't try to compute them here.
 *
 * Never throws — on any evaluation error the original text is returned
 * unchanged.
 */

import { evaluateStandalone } from './formulaEvaluator';

// Cell reference anywhere inside formula (A1, AA12, Sheet!B3) — if present, skip.
// Word-boundary-tight so it doesn't match "4Q" or "v1" etc.
const CELL_REF_RE = /(?<![A-Za-z0-9_])[A-Z]{1,3}\d+(?![A-Za-z0-9_])|\b[A-Za-z_][\w]*![A-Z]+\d+\b/;

// Formula in markdown inline-code: `=...anything-not-backtick...`.
// Inside a code span the formula content can be arbitrary; the closing backtick
// is the terminator, so this is the easy case.
const CODESPAN_FORMULA_RE = /`(=[^`\n]+?)`/g;

// Formula as bare text on its own line (start-of-line through EOL). We allow
// any content starting with `=` so expressions like `=10000 * (1+0.06)^5` or
// `=FV(...) - 5000` are captured. Post-capture we still rely on the evaluator
// to reject non-formulas (it returns ok=false).
// Require at least one Excel-ish operator or function marker to reduce noise.
const BARE_LINE_FORMULA_RE =
  /(^|\n)([ \t]*(?:[-*>•·] +)?)(=(?=[^\n]*[()+\-*/^])[^\n]+?)([ \t]*)(?=\n|$)/g;

interface InlineStats {
  attempted: number;
  succeeded: number;
  failed: number;
}

export function inlineFormulaResults(
  content: string,
  maxFormulas = 30
): { content: string; stats: InlineStats } {
  if (!content) return { content: '', stats: { attempted: 0, succeeded: 0, failed: 0 } };

  const stats: InlineStats = { attempted: 0, succeeded: 0, failed: 0 };
  let remaining = maxFormulas;

  // We cache by formula text so the same formula in multiple places evaluates once.
  const cache = new Map<string, string | null>();

  const tryEvaluate = (formula: string): string | null => {
    if (cache.has(formula)) return cache.get(formula)!;
    stats.attempted++;
    if (CELL_REF_RE.test(formula)) {
      cache.set(formula, null);
      return null;
    }
    try {
      const r = evaluateStandalone(formula);
      if (r.ok && r.formatted !== undefined) {
        stats.succeeded++;
        cache.set(formula, r.formatted);
        return r.formatted;
      }
    } catch {
      // fall through
    }
    stats.failed++;
    cache.set(formula, null);
    return null;
  };

  // 1. Inline code spans: `=FUNC(...)` → `=FUNC(...)` → **value**
  let out = content.replace(CODESPAN_FORMULA_RE, (match, formula) => {
    if (remaining <= 0) return match;
    const result = tryEvaluate(formula);
    if (result === null) return match;
    remaining--;
    return `\`${formula}\` → **${result}**`;
  });

  // 2. Bare formula lines, only if not already decorated (avoid double processing).
  out = out.replace(BARE_LINE_FORMULA_RE, (match, pre, prefix, formula, trailing) => {
    if (remaining <= 0) return match;
    // Skip if the formula is immediately followed/preceded by an arrow — probably
    // already inlined (e.g., by a previous pass or the AI itself).
    if (/→|=>|=\s*\*\*/.test(trailing)) return match;
    const result = tryEvaluate(formula);
    if (result === null) return match;
    remaining--;
    return `${pre}${prefix}\`${formula}\` → **${result}**${trailing}`;
  });

  return { content: out, stats };
}
