/**
 * Normalises math delimiters emitted by LLMs into the delimiters that
 * `remark-math` understands ($ for inline, $$ for display).
 *
 * Problem: LLMs frequently output math in styles that remark-math ignores:
 *   - `[ \boxed{...} ]`  (square-bracket-with-spaces block math)
 *   - `\[ ... \]`        (LaTeX display delimiter)
 *   - `\( ... \)`        (LaTeX inline delimiter)
 *   - `\begin{equation} ... \end{equation}` (LaTeX environments)
 *
 * remark-math recognises only `$...$` and `$$...$$`, so we convert.
 *
 * Heuristics are conservative: we only convert `[ ... ]` → `$$...$$` when the
 * content contains at least one LaTeX command token (`\word`). Plain text
 * brackets like `[Attached: foo.pdf]` or `[1, 2, 3]` remain untouched.
 */

const LATEX_CMD_HINT = /\\[a-zA-Z]+/;

export function normalizeMath(raw: string | null | undefined): string {
  if (!raw) return '';
  let text = raw;

  // 1. `\[ ... \]` → `$$ ... $$` (may span multiple lines)
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => `$$${inner}$$`);

  // 2. `\( ... \)` → `$ ... $`
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner) => `$${inner}$`);

  // 3. `\begin{equation} ... \end{equation}` (and equation*, align, align*) → `$$ ... $$`
  text = text.replace(
    /\\begin\{(equation\*?|align\*?|gather\*?|multline\*?)\}([\s\S]+?)\\end\{\1\}/g,
    (_m, _env, inner) => `$$${inner}$$`
  );

  // 4. `[ ... ]` on its own line(s), where inner looks like LaTeX (has \word token).
  //    Captures both single-line `[ \boxed{...} ]` and multi-line blocks.
  //    Require leading whitespace/newline to avoid touching `[attachment]` etc.
  text = text.replace(
    /(^|\n)[ \t]*\[[ \t]+([^\[\]]*?)[ \t]+\][ \t]*(?=\n|$)/g,
    (match, pre, inner) => {
      return LATEX_CMD_HINT.test(inner) ? `${pre}$$${inner.trim()}$$` : match;
    }
  );

  return text;
}
