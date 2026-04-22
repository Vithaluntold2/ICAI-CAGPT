/**
 * Calculation-agent Excel layout helpers.
 *
 * Every financial calculation agent (NPV, IRR, Tax, Depreciation, ROI,
 * Break-even, Amortisation) emits its results as an `ExcelWorkbookSpec`
 * using these helpers. That spec is what ultimately gets rendered into
 * the `.xlsx` file — bypassing the three-stage LLM Excel generator
 * entirely for calculation-mode requests.
 *
 * Goal: kill Flaws 1 & 2 from the Excel correctness plan by having the
 * agents emit CANONICAL formulas and layout, not just numbers. The
 * Excel pipeline stops being "the LLM invents a workbook that produces
 * this number" and becomes "render the known-correct spec".
 *
 * Enforced layout convention (matches Plan Step B):
 *   Row 1         — sheet title (merged across cols A-D, bold, large)
 *   Row 2         — column headers: LABEL | VALUE | FORMULA | NOTES
 *   Row 3+        — one per CalcRow
 *   Column A      — label text only           (type: 'label')
 *   Column B      — numeric or date inputs    (type: 'input')
 *   Column C      — formulas or derived vals  (type: 'formula' | 'value')
 *   Column D      — notes / units / comments  (type: 'label')
 *
 * A formula row MUST reference column-B addresses of EARLIER or
 * SAME-row cells — never a forward reference. The helper produces
 * layouts that respect this by construction.
 *
 * Subheader rows (e.g. section dividers like "Cash Flows", "Outputs")
 * get row type `subheader` and span A-D merged.
 *
 * Result rows — the final computed outputs — get the `total` type
 * which the workbook builder renders with bold + top-border.
 */

import type { SheetSpec, CellSpec, ExcelWorkbookSpec } from '../excel/excelWorkbookBuilder';

/**
 * A single row of a calc-agent workbook. Exactly one of `value` or
 * `formula` should be set for data rows; `subheader` rows use only
 * `label`; `header` is the top title row (auto-emitted). If both
 * `value` and `formula` are provided, `formula` wins (value is used
 * as the pre-computed number for validation).
 */
export interface CalcRow {
  /** Column A text. Required for every row except the title row. */
  label: string;
  /** Column B — literal numeric / date input. Omit for formula-only
   *  or subheader rows. */
  value?: number | string;
  /** Column C — Excel formula. Must reference column B of earlier or
   *  same-row cells. The helper will not validate this; that's the
   *  smoke-test's job. */
  formula?: string;
  /** Column D — optional units / notes. */
  note?: string;
  /** Row kind. `data` is the default for value / formula rows.
   *  `subheader` spans A-D and is used as a section divider.
   *  `total` applies bold + top-border to highlight a result. */
  kind?: 'data' | 'subheader' | 'total';
  /** Cell format applied to column B and column C. */
  format?: CellSpec['format'];
  /** Optional named range to give column B. If set, the named range
   *  name must be unique within the spec. Agents use this when their
   *  formulas want to reference by name (e.g. `=NPV(DiscountRate, …)`). */
  name?: string;
}

export interface BuildCalcSheetInput {
  /** Sheet tab name (max 31 chars enforced by Excel). */
  sheetName: string;
  /** Sheet title shown in row 1. Defaults to sheetName. */
  title?: string;
  /** Optional description shown under the title in row 2. */
  description?: string;
  /** Data rows. Order is preserved. */
  rows: CalcRow[];
  /** Purpose tag used by the existing builder for tab colour etc.
   *  Defaults to `calculations`. */
  purpose?: SheetSpec['purpose'];
}

/**
 * Build an `ExcelWorkbookSpec.sheets[n]` entry from a flat row list,
 * applying the enforced layout convention. Column headers, title
 * merge, and the `total` / `subheader` styling are all inserted here
 * — agents only need to think about rows.
 */
export function buildCalcSheet(input: BuildCalcSheetInput): SheetSpec {
  const title = input.title ?? input.sheetName;
  const cells: CellSpec[] = [];
  const mergedCells: string[] = [];

  // Row 1 — title, merged A1:D1.
  cells.push({
    cell: 'A1',
    type: 'header',
    value: title,
    style: {
      font: { bold: true, size: 14, color: 'FFFFFFFF' },
      fill: { type: 'solid', color: 'FF1F4E78' },
      alignment: { horizontal: 'center', vertical: 'middle' },
    },
  });
  mergedCells.push('A1:D1');

  // Row 2 — optional description (merged) OR column headers.
  let colHeaderRow = 2;
  if (input.description) {
    cells.push({
      cell: 'A2',
      type: 'subheader',
      value: input.description,
      style: {
        font: { italic: true, size: 10, color: 'FF666666' },
        alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      },
    });
    mergedCells.push('A2:D2');
    colHeaderRow = 3;
  }

  // Column header row.
  const headerStyle: CellSpec['style'] = {
    font: { bold: true, size: 11 },
    fill: { type: 'solid', color: 'FFE7E6E6' },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: { style: 'thin', color: 'FFBFBFBF', sides: ['bottom'] },
  };
  cells.push({ cell: `A${colHeaderRow}`, type: 'header', value: 'LABEL', style: headerStyle });
  cells.push({ cell: `B${colHeaderRow}`, type: 'header', value: 'VALUE', style: headerStyle });
  cells.push({ cell: `C${colHeaderRow}`, type: 'header', value: 'FORMULA / RESULT', style: headerStyle });
  cells.push({ cell: `D${colHeaderRow}`, type: 'header', value: 'NOTES', style: headerStyle });

  // Data rows start right after the column-header row.
  let rowIdx = colHeaderRow + 1;
  for (const row of input.rows) {
    const kind = row.kind ?? 'data';

    if (kind === 'subheader') {
      // Section divider spanning A-D.
      cells.push({
        cell: `A${rowIdx}`,
        type: 'subheader',
        value: row.label,
        style: {
          font: { bold: true, size: 11, color: 'FF1F4E78' },
          fill: { type: 'solid', color: 'FFF2F2F2' },
          alignment: { horizontal: 'left', vertical: 'middle' },
        },
      });
      mergedCells.push(`A${rowIdx}:D${rowIdx}`);
      rowIdx++;
      continue;
    }

    const cellStyle: CellSpec['style'] =
      kind === 'total'
        ? {
            font: { bold: true },
            border: { style: 'thin', sides: ['top'] },
          }
        : undefined as any;

    // Column A — label
    cells.push({
      cell: `A${rowIdx}`,
      type: 'label',
      value: row.label,
      style: cellStyle,
    });

    // Column B — numeric / date input (may be absent for formula-only
    // rows, kept empty so the layout stays grid-aligned).
    if (row.value !== undefined && row.value !== null && row.value !== '') {
      cells.push({
        cell: `B${rowIdx}`,
        type: 'input',
        value: row.value,
        format: row.format,
        name: row.name,
        style: cellStyle,
      });
    } else if (row.name) {
      // A named-range anchor with no value yet — still emit the cell so
      // the name binds to a real address. Emits as an empty input.
      cells.push({
        cell: `B${rowIdx}`,
        type: 'input',
        value: '',
        format: row.format,
        name: row.name,
        style: cellStyle,
      });
    }

    // Column C — formula OR pre-computed value when there's no formula
    // (e.g. pure label+value rows would leave C empty; rows that are
    // computed but expressible inline as a number get `type: value`).
    if (row.formula) {
      cells.push({
        cell: `C${rowIdx}`,
        type: 'formula',
        formula: row.formula,
        format: row.format,
        style: cellStyle,
      });
    }

    // Column D — notes
    if (row.note) {
      cells.push({
        cell: `D${rowIdx}`,
        type: 'label',
        value: row.note,
        style: { font: { italic: true, size: 9, color: 'FF666666' } },
      });
    }

    rowIdx++;
  }

  return {
    name: input.sheetName.slice(0, 31),
    purpose: input.purpose ?? 'calculations',
    cells,
    mergedCells,
    columnWidths: { A: 32, B: 18, C: 28, D: 30 },
    freezePanes: { row: colHeaderRow, col: 0 },
  };
}

/**
 * Compose a one-sheet workbook from a single calc agent's output. Use
 * `buildCalcWorkbook` if the agent produces multiple sheets.
 */
export function singleSheetWorkbook(
  metadataTitle: string,
  sheet: SheetSpec,
  description?: string,
): ExcelWorkbookSpec {
  return {
    metadata: {
      title: metadataTitle,
      description: description,
      author: 'CA-GPT Calculation Agent',
      created: new Date(),
    },
    sheets: [sheet],
  };
}

/**
 * Compose a multi-sheet workbook. Named ranges flow through unchanged.
 * Sheet names must be unique; duplicate names are deduped by appending
 * ` (2)`, ` (3)`, … (Excel rejects duplicates).
 */
export function buildCalcWorkbook(
  metadataTitle: string,
  sheets: SheetSpec[],
  description?: string,
): ExcelWorkbookSpec {
  const seen = new Map<string, number>();
  const dedupedSheets = sheets.map((s) => {
    const base = s.name;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? s : { ...s, name: `${base} (${n})`.slice(0, 31) };
  });

  return {
    metadata: {
      title: metadataTitle,
      description,
      author: 'CA-GPT Calculation Agent',
      created: new Date(),
    },
    sheets: dedupedSheets,
  };
}

/**
 * Convenience — build a single A1-notation range from a column letter
 * and two 1-based row indexes. Used by agents to reference a column-B
 * range in formulas without hand-crafting strings.
 */
export function colRange(col: string, fromRow: number, toRow: number): string {
  return `${col}${fromRow}:${col}${toRow}`;
}
