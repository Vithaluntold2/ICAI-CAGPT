/**
 * Mermaid Source Sanitiser
 *
 * LLMs frequently emit mermaid diagrams with node / edge labels that contain
 * parentheses, commas, colons, #, or quotes — all of which trip Mermaid's
 * parser unless the label is wrapped in double quotes. Teaching the model to
 * always quote is unreliable; sanitising the output server-side is.
 *
 * This pass walks every ```mermaid``` block in an assistant message and:
 *
 *   1. Wraps unquoted node labels in `[…]`, `{…}`, `(…)`, `[[…]]`, `{{…}}`
 *      that contain any of `( ) , : # "` in double quotes.
 *   2. Wraps unquoted edge labels (`-->|…|`, `==>|…|`, `---|…|`, `...|…|`)
 *      the same way.
 *
 * Already-quoted labels are left alone. Shapes with existing JS-identifier
 * payloads (`A(fn)`) that don't contain special chars stay untouched.
 *
 * Non-destructive: on any match failure the original text is preserved.
 */

const MERMAID_FENCE_RE = /```mermaid\s*\n([\s\S]*?)\n```/g;

// Any character that the mermaid lexer treats specially inside a label.
// If the label's inner text contains ANY of these and isn't already quoted,
// wrap it so the lexer sees one opaque string.
const SPECIAL_CHAR_RE = /[(),:#]/;

function needsQuoting(inner: string): boolean {
  const trimmed = inner.trim();
  if (trimmed.length === 0) return false;
  if (/^".*"$/.test(trimmed)) return false; // already quoted
  return SPECIAL_CHAR_RE.test(inner);
}

function quote(inner: string): string {
  // Escape any stray " so the resulting mermaid source stays well-formed.
  return `"${inner.replace(/"/g, '\\"')}"`;
}

function sanitizeBlock(source: string): string {
  let out = source;

  // 1. Rectangle node: A[label]  and subroutine: A[[label]]
  //    Capture opening-depth so we re-emit the same shape.
  out = out.replace(
    /(^|[\s;])([A-Za-z_][\w]*)(\[{1,2})([^\[\]\n]+?)(\]{1,2})/g,
    (match, pre, id, open, label, close) => {
      if (open.length !== close.length) return match;
      if (!needsQuoting(label)) return match;
      return `${pre}${id}${open}${quote(label)}${close}`;
    }
  );

  // 2. Diamond: A{label}   hexagon: A{{label}}
  out = out.replace(
    /(^|[\s;])([A-Za-z_][\w]*)(\{{1,2})([^{}\n]+?)(\}{1,2})/g,
    (match, pre, id, open, label, close) => {
      if (open.length !== close.length) return match;
      if (!needsQuoting(label)) return match;
      return `${pre}${id}${open}${quote(label)}${close}`;
    }
  );

  // 3. Rounded rect: A(label) and circle: A((label))
  //    Must require `id(` immediately together to avoid matching arithmetic.
  out = out.replace(
    /(^|[\s;])([A-Za-z_][\w]*)(\({1,2})([^()\n]+?)(\){1,2})/g,
    (match, pre, id, open, label, close) => {
      if (open.length !== close.length) return match;
      if (!needsQuoting(label)) return match;
      return `${pre}${id}${open}${quote(label)}${close}`;
    }
  );

  // 4. Edge labels:  -->|text|   ==>|text|   ---|text|   -.->|text|
  out = out.replace(
    /(-->|==>|---|\.->|-\.->|-\.-|~~~)\|([^|\n]+?)\|/g,
    (match, arrow, label) => {
      if (!needsQuoting(label)) return match;
      return `${arrow}|${quote(label)}|`;
    }
  );

  return out;
}

export interface SanitizeResult {
  content: string;
  blocksSanitized: number;
  labelsQuoted: number;
}

export function sanitizeMermaidInText(content: string): SanitizeResult {
  if (!content) return { content: '', blocksSanitized: 0, labelsQuoted: 0 };

  let blocksSanitized = 0;
  let labelsQuoted = 0;

  const rewritten = content.replace(MERMAID_FENCE_RE, (match, src: string) => {
    const before = src;
    const after = sanitizeBlock(src);
    if (before === after) return match;
    blocksSanitized++;
    // Rough count of added quote pairs
    labelsQuoted += (after.match(/"/g)?.length ?? 0) - (before.match(/"/g)?.length ?? 0);
    return '```mermaid\n' + after + '\n```';
  });

  return { content: rewritten, blocksSanitized, labelsQuoted: Math.floor(labelsQuoted / 2) };
}
