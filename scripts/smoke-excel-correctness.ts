/**
 * End-to-end smoke test for the Excel correctness stack.
 *
 * Covers:
 *   • `workbookSmokeTest` lints — each lint code triggers on the
 *     appropriate synthetic broken spec.
 *   • Addressable-JSON sheet blocks — round-trip through
 *     `extractAndEvaluateSheetBlocks` produces a clean grid.
 *   • Legacy-CSV under-celled rows — now logged (backstop) while the
 *     addressable path handles empty middles cleanly.
 *
 * Usage: `npx tsx scripts/smoke-excel-correctness.ts`
 */
import 'dotenv/config';
import { workbookSmokeTest, formatErrorsForLLMRetry } from '../server/services/excel/workbookSmokeTest';
import { extractAndEvaluateSheetBlocks } from '../server/services/excel/sheetBlockParser';
import type { ExcelWorkbookSpec } from '../server/services/excel/excelWorkbookBuilder';

let passed = 0;
let failed = 0;

function section(label: string) {
  console.log('\n' + '═'.repeat(80));
  console.log('▶ ' + label);
}

function expect(cond: boolean, msg: string) {
  if (cond) {
    console.log('  ✓  ' + msg);
    passed++;
  } else {
    console.log('  ✗  ' + msg);
    failed++;
  }
}

async function run() {
  // ==========================================================================
  // 1. Lint: DUPLICATE_CELL
  // ==========================================================================
  section('Lint — DUPLICATE_CELL');
  const dup: ExcelWorkbookSpec = {
    metadata: { title: 'dup test' },
    sheets: [
      {
        name: 'Sheet1',
        purpose: 'calculations',
        cells: [
          { cell: 'A1', type: 'label', value: 'Label' },
          { cell: 'A1', type: 'input', value: 100 },
        ],
      },
    ],
  };
  {
    const res = await workbookSmokeTest(dup);
    expect(!res.ok, 'detects duplicate cell');
    expect(
      res.errors.some((e) => e.code === 'DUPLICATE_CELL' && e.cell === 'A1'),
      'error code = DUPLICATE_CELL @ A1',
    );
  }

  // ==========================================================================
  // 2. Lint: FUNCTION_WRONG_ARITY (the real NPV-project bug)
  // ==========================================================================
  section('Lint — FUNCTION_WRONG_ARITY (IRR two-arg)');
  const badIRR: ExcelWorkbookSpec = {
    metadata: { title: 'bad-irr' },
    sheets: [
      {
        name: 'Sheet1',
        purpose: 'calculations',
        cells: [
          { cell: 'A1', type: 'label', value: 'Initial' },
          { cell: 'B1', type: 'input', value: -100000 },
          { cell: 'A2', type: 'label', value: 'Y1' },
          { cell: 'B2', type: 'input', value: 30000 },
          { cell: 'A3', type: 'label', value: 'Y2' },
          { cell: 'B3', type: 'input', value: 40000 },
          { cell: 'A4', type: 'label', value: 'IRR' },
          { cell: 'C4', type: 'formula', formula: '=IRR(B1, B2:B3)' },
        ],
      },
    ],
  };
  {
    const res = await workbookSmokeTest(badIRR);
    expect(!res.ok, 'detects IRR wrong arity');
    expect(
      res.errors.some((e) => e.code === 'FUNCTION_WRONG_ARITY' && /IRR/i.test(e.message)),
      'error code = FUNCTION_WRONG_ARITY for IRR',
    );
  }

  // ==========================================================================
  // 3. Lint: LABEL_IN_NUMERIC_RANGE
  // ==========================================================================
  section('Lint — LABEL_IN_NUMERIC_RANGE');
  const labelInRange: ExcelWorkbookSpec = {
    metadata: { title: 'label-in-range' },
    sheets: [
      {
        name: 'Sheet1',
        purpose: 'calculations',
        cells: [
          { cell: 'A1', type: 'label', value: 'Values' },
          { cell: 'B1', type: 'header', value: 'Year 1 Cashflow' }, // LABEL inside numeric range
          { cell: 'B2', type: 'input', value: 400 },
          { cell: 'B3', type: 'input', value: 500 },
          { cell: 'B4', type: 'input', value: 600 },
          { cell: 'C5', type: 'formula', formula: '=SUM(B1:B4)' },
        ],
      },
    ],
  };
  {
    const res = await workbookSmokeTest(labelInRange);
    expect(!res.ok, 'detects label-in-range');
    expect(
      res.errors.some((e) => e.code === 'LABEL_IN_NUMERIC_RANGE' && e.cell === 'C5'),
      'error code = LABEL_IN_NUMERIC_RANGE @ C5',
    );
  }

  // ==========================================================================
  // 4. Lint: SELF_REF
  // ==========================================================================
  section('Lint — SELF_REF');
  const selfRef: ExcelWorkbookSpec = {
    metadata: { title: 'self-ref' },
    sheets: [
      {
        name: 'Sheet1',
        purpose: 'calculations',
        cells: [
          { cell: 'B5', type: 'formula', formula: '=B5*1.05' },
        ],
      },
    ],
  };
  {
    const res = await workbookSmokeTest(selfRef);
    expect(!res.ok, 'detects self-reference');
    expect(
      res.errors.some((e) => e.code === 'SELF_REF' && e.cell === 'B5'),
      'error code = SELF_REF @ B5',
    );
  }

  // ==========================================================================
  // 5. Lint: FORWARD_REFERENCE
  // ==========================================================================
  section('Lint — FORWARD_REFERENCE');
  const fwdRef: ExcelWorkbookSpec = {
    metadata: { title: 'fwd-ref' },
    sheets: [
      {
        name: 'Sheet1',
        purpose: 'calculations',
        cells: [
          { cell: 'A3', type: 'label', value: 'Total' },
          { cell: 'C3', type: 'formula', formula: '=B8+B9' }, // forward ref to B8/B9
          { cell: 'A8', type: 'label', value: 'Item 1' },
          { cell: 'B8', type: 'input', value: 100 },
          { cell: 'A9', type: 'label', value: 'Item 2' },
          { cell: 'B9', type: 'input', value: 200 },
        ],
      },
    ],
  };
  {
    const res = await workbookSmokeTest(fwdRef);
    expect(!res.ok, 'detects forward reference');
    expect(
      res.errors.some((e) => e.code === 'FORWARD_REFERENCE' && e.cell === 'C3'),
      'error code = FORWARD_REFERENCE @ C3',
    );
  }

  // ==========================================================================
  // 6. Lint: SHEET_NOT_FOUND
  // ==========================================================================
  section('Lint — SHEET_NOT_FOUND');
  const missingSheet: ExcelWorkbookSpec = {
    metadata: { title: 'missing-sheet' },
    sheets: [
      {
        name: 'Summary',
        purpose: 'calculations',
        cells: [
          { cell: 'A1', type: 'label', value: 'Ref' },
          { cell: 'C1', type: 'formula', formula: '=TotallyAbsent!B1' },
        ],
      },
    ],
  };
  {
    const res = await workbookSmokeTest(missingSheet);
    expect(!res.ok, 'detects missing sheet');
    expect(
      res.errors.some((e) => e.code === 'SHEET_NOT_FOUND'),
      'error code = SHEET_NOT_FOUND',
    );
  }

  // ==========================================================================
  // 7. Clean spec — no errors expected
  // ==========================================================================
  section('Lint — clean spec (baseline)');
  const clean: ExcelWorkbookSpec = {
    metadata: { title: 'clean' },
    sheets: [
      {
        name: 'NPV',
        purpose: 'calculations',
        cells: [
          { cell: 'A1', type: 'header', value: 'NPV' },
          { cell: 'A3', type: 'label', value: 'Rate' },
          { cell: 'B3', type: 'input', value: 0.1 },
          { cell: 'A4', type: 'label', value: 'Y0' },
          { cell: 'B4', type: 'input', value: -100000 },
          { cell: 'A5', type: 'label', value: 'Y1' },
          { cell: 'B5', type: 'input', value: 30000 },
          { cell: 'A6', type: 'label', value: 'Y2' },
          { cell: 'B6', type: 'input', value: 40000 },
          { cell: 'A7', type: 'label', value: 'Y3' },
          { cell: 'B7', type: 'input', value: 50000 },
          { cell: 'A8', type: 'total', value: 'NPV' },
          { cell: 'C8', type: 'formula', formula: '=NPV(B3,B5:B7)+B4' },
          { cell: 'A9', type: 'total', value: 'IRR' },
          { cell: 'C9', type: 'formula', formula: '=IRR(B4:B7)' },
        ],
      },
    ],
  };
  {
    const res = await workbookSmokeTest(clean);
    if (!res.ok) {
      console.log('  Errors unexpectedly present:', formatErrorsForLLMRetry(res.errors));
    }
    expect(res.ok, 'no lint errors');
    expect(typeof res.values['NPV!C8'] === 'number', 'NPV cell evaluates to a number');
    expect(typeof res.values['NPV!C9'] === 'number', 'IRR cell evaluates to a number');
  }

  // ==========================================================================
  // 8. Addressable-JSON sheet block
  // ==========================================================================
  section('Sheet block — addressable JSON format');
  const chatWithJsonBlock = `Here is the NPV analysis:

\`\`\`sheet
{
  "title": "NPV at 10%",
  "description": "Three-year cashflow",
  "cells": [
    {"cell": "A1", "value": "Year", "type": "header"},
    {"cell": "B1", "value": "Cashflow", "type": "header"},
    {"cell": "C1", "value": "PV", "type": "header"},
    {"cell": "A2", "value": 1},
    {"cell": "B2", "value": 400},
    {"cell": "C2", "formula": "=B2/(1+0.1)^A2"},
    {"cell": "A3", "value": 2},
    {"cell": "B3", "value": 500},
    {"cell": "C3", "formula": "=B3/(1+0.1)^A3"},
    {"cell": "A4", "value": 3},
    {"cell": "B4", "value": 600},
    {"cell": "C4", "formula": "=B4/(1+0.1)^A4"},
    {"cell": "A5", "value": "Total"},
    {"cell": "B5", "formula": "=SUM(B2:B4)"},
    {"cell": "C5", "formula": "=SUM(C2:C4)"}
  ]
}
\`\`\`

Done.`;
  {
    const res = extractAndEvaluateSheetBlocks(chatWithJsonBlock);
    expect(res.blockCount === 1, 'parsed exactly one sheet block');
    expect(res.spreadsheetData != null, 'produced SpreadsheetData');
    expect(res.spreadsheetData?.metadata?.title === 'NPV at 10%', 'title carried through');
    const grid = res.spreadsheetData?.sheets[0]?.data ?? [];
    // Row 2 (index 1) should have Year=1, Cashflow=400, PV ≈ 363.64
    const pvYear1 = grid[1]?.[2];
    expect(
      typeof pvYear1 === 'number' && Math.abs((pvYear1 as number) - 400 / 1.1) < 0.01,
      `C2 (Year 1 PV) evaluates to ~363.64, got ${pvYear1}`,
    );
    // Total row: B5 should be 1500, C5 should be the PV sum (~1328.40)
    const totalCashflow = grid[4]?.[1];
    expect(totalCashflow === 1500, `B5 (Total Cashflow) = 1500, got ${totalCashflow}`);
    // No #ERR cells anywhere
    const hasErr = grid.some((row) => row.some((c) => c === '#ERR'));
    expect(!hasErr, 'no #ERR cells in the rendered grid');
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Smoke run crashed:', err);
  process.exit(1);
});
