/**
 * Sheet Block Parser
 *
 * Extracts AI-emitted spreadsheet blocks from chat messages, evaluates any
 * embedded formulas server-side with HyperFormula, and produces a
 * SpreadsheetData payload that the OutputPane + SpreadsheetViewer already know
 * how to render. The block in the chat text is then replaced with a short
 * pointer so the chat body stays readable while the sheet appears on the right.
 *
 * AI contract — expected format:
 *
 *     ```sheet
 *     title: NPV at 10% (3-year cashflow)
 *     description: Present value of year-by-year inflows
 *     ---
 *     Year,Cashflow,Discount Factor,PV
 *     1,400,=1/(1+0.1)^A2,=B2*C2
 *     2,500,=1/(1+0.1)^A3,=B3*C3
 *     3,600,=1/(1+0.1)^A4,=B4*C4
 *     Total,=SUM(B2:B4),,=SUM(D2:D4)
 *     ```
 *
 * Rules:
 *   - Language tag is `sheet` or `spreadsheet`
 *   - Optional front-matter (title/description) followed by `---` separator
 *   - Body is CSV; formulas start with `=` and reference cells (A1, B2:B4…)
 *   - Row 1 of the body is the header row
 *   - Data + formulas live in rows 2..N
 *
 * Output:
 *   - `SpreadsheetData` with rendered values (formulas evaluated) in `data`
 *   - Formulas also collected into `formulas[]` for display
 *   - Placeholder inline in text pointing the user at the output panel
 */

import { evaluateSheet } from './formulaEvaluator';

const SHEET_BLOCK_RE = /```(?:sheet|spreadsheet)\s*\n([\s\S]*?)\n```/g;

export interface SheetData {
  name: string;
  data: (string | number | null)[][];
  formulas?: string[];
}

export interface SpreadsheetData {
  sheets: SheetData[];
  metadata?: {
    title?: string;
    description?: string;
    calculations?: string[];
  };
}

interface ExtractResult {
  text: string;                        // content with sheet blocks replaced
  spreadsheetData: SpreadsheetData | null;
  blockCount: number;
}

export function extractAndEvaluateSheetBlocks(content: string): ExtractResult {
  if (!content) return { text: '', spreadsheetData: null, blockCount: 0 };

  const sheets: SheetData[] = [];
  const titles: string[] = [];
  const descriptions: string[] = [];
  const allFormulas: string[] = [];

  const rewritten = content.replace(SHEET_BLOCK_RE, (_match, body: string) => {
    const parsed = parseSheetBlock(body);
    if (!parsed) return _match; // couldn't parse — leave original
    sheets.push(parsed.sheet);
    if (parsed.title) titles.push(parsed.title);
    if (parsed.description) descriptions.push(parsed.description);
    allFormulas.push(...(parsed.sheet.formulas ?? []));

    const label = parsed.title ? ` — ${parsed.title}` : '';
    return `> 📊 **Spreadsheet${label}** rendered in the output panel →`;
  });

  if (sheets.length === 0) {
    return { text: content, spreadsheetData: null, blockCount: 0 };
  }

  return {
    text: rewritten,
    blockCount: sheets.length,
    spreadsheetData: {
      sheets,
      metadata: {
        title: titles[0],
        description: descriptions.join(' · ') || undefined,
        calculations: allFormulas.length > 0 ? dedupe(allFormulas).slice(0, 20) : undefined,
      },
    },
  };
}

interface ParsedBlock {
  sheet: SheetData;
  title?: string;
  description?: string;
}

function parseSheetBlock(body: string): ParsedBlock | null {
  // Split optional front-matter on first --- separator
  const sepIdx = body.indexOf('\n---');
  let header: Record<string, string> = {};
  let csvPart = body;
  if (sepIdx !== -1) {
    const headerPart = body.slice(0, sepIdx).trim();
    csvPart = body.slice(sepIdx + 4).replace(/^\n+/, '');
    for (const line of headerPart.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_ -]*?)\s*:\s*(.+?)\s*$/);
      if (m) header[m[1].toLowerCase().trim()] = m[2];
    }
  }

  // Parse CSV body
  const lines = csvPart.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0);
  if (lines.length < 2) return null; // need header + at least one row

  const parsedRows = lines.map(splitCsvLine);
  if (parsedRows.length === 0) return null;

  // Strip section-header rows — rows where only column 1 has content and all
  // other columns are empty (e.g. "Slab-wise Tax Calculation,,"). The AI
  // emits these as visual headings inside sheet blocks, but its formula cell
  // references skip them in its mental row numbering. The parser used to
  // include them as full grid rows, which shifted every downstream cell-ref
  // by one row — producing #ERR totals, slab-2 tax appearing in slab-3's
  // cell, etc. We drop them here (with a warning) so the grid indexing
  // matches what the AI intended. The prompt in promptBuilder.ts also
  // forbids these explicitly, but this stays as a defensive backstop.
  const rows = parsedRows.filter((r, i) => {
    if (i === 0) return true; // keep the header row
    const hasDataBeyondCol0 = r.slice(1).some(c => c && c.trim() !== '');
    if (!hasDataBeyondCol0 && r[0] && r[0].trim() !== '') {
      console.warn(`[sheetBlockParser] Dropped section-header row at input line ${i + 1}: "${r[0]}"`);
      return false;
    }
    return true;
  });
  if (rows.length === 0) return null;

  // Build the raw grid
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const grid: (string | number | null)[][] = rows.map(r => {
    const padded = [...r];
    while (padded.length < maxCols) padded.push('');
    return padded.map(coerceCell);
  });

  // Evaluate formulas: collect (addr → formula) and (addr → literal value)
  // starting from row 1 (0-indexed) because row 0 is the header.
  const cellLiterals: Record<string, any> = {};
  const cellFormulas: Record<string, string> = {};
  const formulaList: string[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < maxCols; c++) {
      const v = grid[r][c];
      if (v === '' || v === null) continue;
      const addr = cellAddress(r, c);
      if (typeof v === 'string' && v.trim().startsWith('=')) {
        cellFormulas[addr] = v.trim();
        formulaList.push(v.trim());
      } else {
        cellLiterals[addr] = v;
      }
    }
  }

  // Evaluate (if there are any formulas); leave raw values in data otherwise
  if (Object.keys(cellFormulas).length > 0) {
    const evalResult = evaluateSheet({ cells: cellLiterals, formulas: cellFormulas });
    for (const [addr, computed] of Object.entries(evalResult.values)) {
      const parsed = parseAddr(addr);
      if (parsed) grid[parsed.row][parsed.col] = coerceCell(computed);
    }
    for (const [addr, _err] of Object.entries(evalResult.errors)) {
      const parsed = parseAddr(addr);
      if (parsed) grid[parsed.row][parsed.col] = '#ERR';
    }
  }

  return {
    title: header['title'],
    description: header['description'],
    sheet: {
      name: (header['name'] || header['title'] || 'Sheet 1').slice(0, 40),
      data: grid,
      formulas: formulaList.length > 0 ? dedupe(formulaList).slice(0, 30) : undefined,
    },
  };
}

/* ───────────────────────── helpers ───────────────────────── */

/**
 * Grouped-number patterns that the AI emits with commas INSIDE the number
 * (Indian lakhs `₹3,00,000`, US/Western `$1,000,000`). The CSV splitter
 * used to break on those commas and turn one cell into 3-4 fragments,
 * wrecking row layouts and making formulas point to the wrong cells.
 *
 * We protect them by replacing internal commas with a unit separator (\x1F)
 * before splitting, then restoring after. Pattern: currency/Rs/INR prefix
 * OR a digit-followed-by-comma-followed-by-digits sequence long enough to
 * look like a grouped number (not `a, b` in a formula).
 *
 * Match is intentionally conservative:
 *   ✓ ₹3,00,000    ✓ ₹1,500,000   ✓ $1,234,567.89
 *   ✓ 3,00,000     ✓ 1,000,000    ✓ 75,000
 *   ✗ a, b         ✗ name, dept   ✗ hello, world
 *
 * Two-digit trailing group (`3,00`) wouldn't match — those are too
 * ambiguous to disambiguate from prose commas, so the AI needs to quote
 * those cells. The common cases (lakhs and millions) are handled.
 */
// Lookbehind/ahead guards keep the match on complete numbers only. Without
// them, a plain comma-separated number pair like "400000,20000" would get
// partially matched (e.g. the "0,200" slice of it) and its internal comma
// protected — fusing two real cells into one. The guards require:
//   - no digit immediately before the start (so we don't pick up a
//     fragment of a longer number)
//   - no digit immediately after the end (ditto for trailing)
const PROTECT_NUMBER_RE =
  /(?<![0-9])(?:[₹$€£]|Rs\.?\s*|INR\s*)?\d{1,3}(?:,\d{2,3})+(?:\.\d+)?(?![0-9])/g;
const COMMA_PLACEHOLDER = '\x1F';

function protectGroupedNumbers(line: string): string {
  return line.replace(PROTECT_NUMBER_RE, match => match.replace(/,/g, COMMA_PLACEHOLDER));
}

function restoreGroupedNumbers(cell: string): string {
  return cell.replace(new RegExp(COMMA_PLACEHOLDER, 'g'), ',');
}

/**
 * CSV splitter that respects BOTH quoted fields AND formula paren depth.
 * The AI doesn't reliably quote cells containing commas inside Excel formulas,
 * so when we're inside a formula's parentheses (e.g. `=IF(a, b, c)`,
 * `=NPV(rate, range)`, `=LAMBDA(a, b, a+b)`), commas are literal, not
 * separators. Same protection for grouped numbers like `₹3,00,000`.
 */
function splitCsvLine(line: string): string[] {
  // Shield grouped-number commas before we look for delimiters.
  const protectedLine = protectGroupedNumbers(line);
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  let parenDepth = 0;
  for (let i = 0; i < protectedLine.length; i++) {
    const ch = protectedLine[i];
    if (inQuotes) {
      if (ch === '"' && protectedLine[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === '(') { parenDepth++; cur += ch; }
      else if (ch === ')') { if (parenDepth > 0) parenDepth--; cur += ch; }
      else if (ch === ',' && parenDepth === 0) { out.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out.map(s => restoreGroupedNumbers(s).trim());
}

function coerceCell(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  const s = String(v).trim();
  if (s === '') return null;
  // formulas stay as strings until evaluated
  if (s.startsWith('=')) return s;
  // numeric literals (incl. negatives, decimals, grouping)
  const cleaned = s.replace(/[,₹$€£]/g, '').replace(/%$/, '');
  const n = Number(cleaned);
  if (!isNaN(n) && cleaned !== '' && /^[+-]?\d/.test(cleaned)) {
    return s.endsWith('%') ? n / 100 : n;
  }
  return s;
}

function cellAddress(row: number, col: number): string {
  let letters = '';
  let n = col;
  while (true) {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return `${letters}${row + 1}`;
}

function parseAddr(addr: string): { row: number; col: number } | null {
  const m = addr.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: parseInt(m[2], 10) - 1, col: col - 1 };
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
