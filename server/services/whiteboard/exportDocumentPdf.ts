import MarkdownIt from "markdown-it";
import katex from "katex";
import puppeteer, { type Browser } from "puppeteer";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Markdown → HTML
// ---------------------------------------------------------------------------
// The goal is to match what the DocumentArtifact renders in the browser:
// GFM tables, fenced code, inline + block math via KaTeX. We pre-render math
// server-side so we don't need to ship KaTeX's auto-render JS into the
// Puppeteer page (faster + more deterministic).

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
});

// $$block$$ and $inline$ math substitution. Applied to the raw markdown
// BEFORE markdown-it tokenises, using markers that survive the parser.
function renderMath(source: string): string {
  // Block math: $$ ... $$ (can span multiple lines). Render first so inline
  // regex doesn't eat the delimiters.
  let out = source.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
    try {
      return katex.renderToString(expr.trim(), {
        displayMode: true,
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      return `<pre>${escapeHtml(expr)}</pre>`;
    }
  });
  // Inline math: $...$ but not currency like "$10,000". Require the opener
  // NOT to be followed by whitespace/digit-only-comma-digit patterns.
  out = out.replace(/(^|[^\\$])\$([^\s$][^$]*?[^\s$])\$(?!\d)/g, (_m, pre, expr) => {
    try {
      return (
        pre +
        katex.renderToString(expr, {
          displayMode: false,
          throwOnError: false,
          strict: "ignore",
        })
      );
    } catch {
      return `${pre}<code>${escapeHtml(expr)}</code>`;
    }
  });
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

// Read KaTeX's shipped stylesheet from node_modules so the Puppeteer page
// can inline it — avoids a network hop during PDF generation.
let katexCssCache: string | null = null;
function loadKatexCss(): string {
  if (katexCssCache !== null) return katexCssCache;
  try {
    const cssPath = path.join(
      process.cwd(),
      "node_modules",
      "katex",
      "dist",
      "katex.min.css",
    );
    katexCssCache = fs.readFileSync(cssPath, "utf8");
  } catch (err) {
    console.warn("[exportDocumentPdf] katex css not found, math may be unstyled:", err);
    katexCssCache = "";
  }
  return katexCssCache;
}

function buildHtml(title: string, markdownSource: string, mode?: string): string {
  const mathRendered = renderMath(markdownSource);
  const body = md.render(mathRendered);
  const katexCss = loadKatexCss();

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${katexCss}</style>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  html, body { background: #fff; color: #111; }
  body {
    font-family: "Inter", -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc-title { font-size: 20pt; font-weight: 700; margin: 0 0 4pt; }
  .doc-meta { font-size: 9pt; color: #666; margin-bottom: 14pt; border-bottom: 1px solid #ddd; padding-bottom: 8pt; }
  .doc-body { font-size: 11pt; line-height: 1.55; }
  .doc-body h1 { font-size: 17pt; margin: 18pt 0 6pt; page-break-after: avoid; }
  .doc-body h2 { font-size: 14pt; margin: 14pt 0 5pt; page-break-after: avoid; }
  .doc-body h3 { font-size: 12pt; margin: 10pt 0 4pt; page-break-after: avoid; }
  .doc-body p { margin: 0 0 8pt; }
  .doc-body ul, .doc-body ol { margin: 0 0 8pt 20pt; }
  .doc-body li { margin-bottom: 3pt; }
  .doc-body table { border-collapse: collapse; width: 100%; margin: 8pt 0; page-break-inside: auto; }
  .doc-body thead { display: table-header-group; }
  .doc-body tr { page-break-inside: avoid; }
  .doc-body th, .doc-body td { border: 1px solid #ccc; padding: 5pt 7pt; text-align: left; font-size: 10pt; vertical-align: top; }
  .doc-body th { background: #f4f4f4; font-weight: 600; }
  .doc-body pre { background: #f6f8fa; border: 1px solid #e5e7eb; padding: 8pt 10pt; border-radius: 4pt; page-break-inside: avoid; white-space: pre-wrap; word-break: break-word; font-size: 9.5pt; overflow: visible; }
  .doc-body code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9.5pt; }
  .doc-body :not(pre) > code { background: #f1f1f1; padding: 1pt 4pt; border-radius: 3pt; }
  .doc-body blockquote { border-left: 3px solid #9ca3af; padding: 2pt 10pt; margin: 6pt 0; color: #374151; background: #f9fafb; }
  .doc-body img { max-width: 100%; page-break-inside: avoid; }
  .doc-body .katex-display { margin: 8pt 0; }
  .doc-body a { color: #1a56db; text-decoration: none; }
  /* Checklist rendering — GFM task list items */
  .doc-body input[type="checkbox"] { margin-right: 6pt; }
</style>
</head>
<body>
  <div class="doc-title">${escapeHtml(title)}</div>
  <div class="doc-meta">${mode ? escapeHtml(mode) + " &middot; " : ""}Generated ${new Date().toLocaleDateString()}</div>
  <div class="doc-body">${body}</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Puppeteer — shared browser instance
// ---------------------------------------------------------------------------
// Launching Chrome is the slow part (~1-2s cold). Keep one instance alive and
// reuse it across requests; re-launch only if the process has died. The
// pattern mirrors what Vercel / Next.js do for on-demand ISR with headless
// Chrome.

let sharedBrowser: Browser | null = null;
let launching: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser && sharedBrowser.connected) return sharedBrowser;
  if (launching) return launching;
  launching = puppeteer
    .launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    })
    .then((b) => {
      sharedBrowser = b;
      launching = null;
      b.on("disconnected", () => {
        if (sharedBrowser === b) sharedBrowser = null;
      });
      return b;
    })
    .catch((err) => {
      launching = null;
      throw err;
    });
  return launching;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DocumentExportInput {
  title: string;
  content: string;        // raw markdown
  mode?: string;          // e.g. "deliverable-composer" — shown in meta line
}

export async function buildDocumentPdfBuffer(input: DocumentExportInput): Promise<Buffer> {
  const html = buildHtml(input.title || "Document", input.content || "", input.mode);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfUint8 = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    });
    return Buffer.from(pdfUint8);
  } finally {
    await page.close().catch(() => {});
  }
}
