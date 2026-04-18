/**
 * Build an xlsx Buffer from the same SpreadsheetData shape that OutputPane /
 * SpreadsheetViewer consume on the client. Used by the message-level Excel
 * download endpoint when the AI emitted a ```sheet``` block (which populates
 * metadata.spreadsheetData) rather than going through the full
 * excelModelGenerator pipeline (which populates metadata.excelCacheKey).
 *
 * No formulas are re-evaluated here — the cell values are already evaluated
 * numbers / strings produced by sheetBlockParser, so we just lay them into an
 * ExcelJS workbook with basic formatting and return the Buffer.
 */

import ExcelJS from 'exceljs';

export interface SheetInput {
  name: string;
  data: (string | number | null)[][];
  formulas?: string[];
}

export interface SpreadsheetInput {
  sheets: SheetInput[];
  metadata?: {
    title?: string;
    description?: string;
    calculations?: string[];
  };
}

export async function buildXlsxFromSpreadsheetData(
  input: SpreadsheetInput
): Promise<{ buffer: Buffer; filename: string }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CA GPT';
  wb.created = new Date();
  if (input.metadata?.title) {
    wb.title = input.metadata.title;
  }
  if (input.metadata?.description) {
    wb.description = input.metadata.description;
  }

  // Create each sheet
  const sheets = input.sheets?.length ? input.sheets : [{ name: 'Sheet1', data: [] }];
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sanitiseSheetName(sheet.name));
    const rows = sheet.data ?? [];
    if (rows.length === 0) continue;

    const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);

    // Header row
    const header = rows[0] ?? [];
    const headerValues = new Array(maxCols).fill(null).map((_, i) => header[i] ?? '');
    ws.addRow(headerValues);
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }, // slate-100
    };
    headerRow.border = {
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
    headerRow.alignment = { vertical: 'middle' };

    // Data rows
    for (let r = 1; r < rows.length; r++) {
      const padded = new Array(maxCols).fill(null).map((_, i) => rows[r][i] ?? null);
      ws.addRow(padded);
    }

    // Light grid borders on every cell in the used range
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'hair', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
          left: { style: 'hair', color: { argb: 'FFE2E8F0' } },
          right: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    // Right-align numeric cells (skip header row)
    ws.eachRow({ includeEmpty: false }, (row, rowIdx) => {
      if (rowIdx === 1) return;
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (typeof cell.value === 'number') {
          cell.alignment = { horizontal: 'right' };
          if (Number.isInteger(cell.value)) {
            cell.numFmt = '#,##0';
          } else {
            cell.numFmt = '#,##0.00';
          }
        }
      });
    });

    // Auto-size columns based on content width (clamped)
    for (let c = 1; c <= maxCols; c++) {
      const col = ws.getColumn(c);
      let maxLen = 10;
      col.eachCell({ includeEmpty: false }, (cell) => {
        const s = cell.value == null ? '' : String(cell.value);
        if (s.length > maxLen) maxLen = s.length;
      });
      col.width = Math.min(Math.max(maxLen + 2, 10), 48);
    }

    // If the sheet has a non-empty formulas list, tuck it into a footer block
    // so the user sees which formulas produced the evaluated cells above.
    if (sheet.formulas && sheet.formulas.length > 0) {
      ws.addRow([]);
      const label = ws.addRow(['Formulas']);
      label.font = { bold: true, color: { argb: 'FF059669' } };
      for (const f of sheet.formulas.slice(0, 50)) {
        const row = ws.addRow([f]);
        row.font = { name: 'Consolas', size: 10, color: { argb: 'FF047857' } };
      }
    }
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = buildFilename(input.metadata?.title);
  return { buffer, filename };
}

function sanitiseSheetName(name: string | undefined): string {
  const safe = (name || 'Sheet1').replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31).trim();
  return safe.length > 0 ? safe : 'Sheet1';
}

function buildFilename(title: string | undefined): string {
  const base = (title || 'CA-GPT-Spreadsheet')
    .replace(/[^a-zA-Z0-9\-_ ]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'CA-GPT-Spreadsheet';
  const ts = new Date().toISOString().slice(0, 10);
  return `${base}-${ts}.xlsx`;
}
