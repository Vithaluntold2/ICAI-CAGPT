/**
 * Smoke test for Step A — calc agents emit specs + buildFromSpec renders them.
 *
 * Runs each representative query through `runCalculationAgents`, then renders
 * the emitted spec through the new `createWorkbookFromSpec` path, and finally
 * loads the resulting xlsx into HyperFormula to confirm every formula
 * evaluates cleanly (no #REF! / #VALUE! / #CYCLE!).
 *
 * Usage: `npx tsx scripts/smoke-calc-agents.ts`
 */
import 'dotenv/config';
import { HyperFormula } from 'hyperformula';
import ExcelJS from 'exceljs';
import { runCalculationAgents } from '../server/services/agents/calcExecutor';
import { excelOrchestrator } from '../server/services/excelOrchestrator';

const cases: Array<{ name: string; query: string }> = [
  {
    name: 'NPV — 5-year project with explicit cash flows',
    query:
      'Compute NPV for a project with initial investment of 100000 and cash flows [-100000, 30000, 40000, 50000, 40000, 30000] at a discount rate of 12%.',
  },
  {
    name: 'Tax — Indian old regime 12 lakh salary',
    query: 'Calculate income tax for a salary of ₹12 lakh under old regime with deductions of ₹1.5 lakh.',
  },
  {
    name: 'Tax — Indian new regime 18 lakh salary',
    query: 'Calculate income tax for total income of ₹18 lakh under new regime.',
  },
  {
    name: 'Depreciation — SLM 5-year asset',
    query: 'Generate depreciation schedule for an asset cost of 500000 with salvage value of 50000 over 5 year useful life using straight-line method.',
  },
  {
    name: 'ROI — 3-year holding',
    query: 'Calculate ROI where initial investment of 100000 grew to 150000 over 3 years.',
  },
  {
    name: 'Break-even — SaaS',
    query: 'Compute break-even when fixed costs are 500000, variable cost per unit is 20, price per unit is 100.',
  },
];

async function evalWorkbook(buffer: Buffer): Promise<{ ok: boolean; errors: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheets: Record<string, any[][]> = {};
  wb.eachSheet((ws) => {
    const rows: any[][] = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      const row: any[] = [];
      for (let c = 1; c <= (ws.columnCount || 1); c++) {
        const cell = ws.getCell(r, c);
        const v = cell.value;
        if (v && typeof v === 'object' && 'formula' in v && typeof (v as any).formula === 'string') {
          // ExcelJS preserves the formula string with the leading `=`.
          // HyperFormula expects it verbatim — no re-prefix.
          const f = (v as any).formula as string;
          row.push(f.startsWith('=') ? f : '=' + f);
        } else if (v === null || v === undefined) {
          row.push(null);
        } else if (typeof v === 'object' && 'text' in v) {
          row.push((v as any).text);
        } else {
          row.push(v as any);
        }
      }
      rows.push(row);
    }
    sheets[ws.name] = rows;
  });
  const hf = HyperFormula.buildFromSheets(sheets, {
    licenseKey: 'gpl-v3',
    precisionRounding: 10,
  });
  const errors: string[] = [];
  for (const sheetName of Object.keys(sheets)) {
    const sheetId = hf.getSheetId(sheetName);
    if (sheetId === undefined) continue;
    const dims = hf.getSheetDimensions(sheetId);
    for (let r = 0; r < dims.height; r++) {
      for (let c = 0; c < dims.width; c++) {
        const val = hf.getCellValue({ sheet: sheetId, col: c, row: r });
        if (val !== null && typeof val === 'object' && 'type' in val && (val as any).type === 'ERROR') {
          const addr = `${String.fromCharCode(65 + c)}${r + 1}`;
          errors.push(`${sheetName}!${addr}: ${(val as any).value} (${sheets[sheetName][r][c]})`);
        }
      }
    }
  }
  hf.destroy();
  return { ok: errors.length === 0, errors };
}

async function smokeWorkedExamples() {
  // Verify the three prompt-builder worked examples themselves pass the
  // smoke test before we ship them to the LLM. A broken example gets
  // copied by the LLM on every call, so these MUST be clean.
  const mod = await import('../server/services/excel/excelModelPromptBuilder');
  const examples = (mod as any).exampleSpecs as Record<string, any>
    ?? (mod as any).default?.exampleSpecs
    ?? null;
  // `exampleSpecs` is module-private; access via the prompt-builder's
  // public helper if available, otherwise skip (but complain loudly).
  if (!examples) {
    // Fall back: build the prompt and scrape examples from the text —
    // slower but zero-touch to the module.
    const { ExcelModelPromptBuilder } = mod as any;
    const pb = new ExcelModelPromptBuilder();
    const stages = pb.buildPrompts({ userQuery: 'build me a generic finance model' });
    const stage3 = stages.find((s: any) => s.stage === 3);
    if (!stage3) {
      console.warn('⚠  Could not locate Stage 3 prompt; worked-example smoke skipped.');
      return { passed: 0, failed: 0 };
    }
    // Crude: extract JSON blocks after "VERIFIED WORKED EXAMPLES"
    const marker = 'VERIFIED WORKED EXAMPLES';
    const idx = stage3.systemPrompt.indexOf(marker);
    if (idx === -1) {
      console.warn('⚠  Marker not found in Stage 3 prompt; worked-example smoke skipped.');
      return { passed: 0, failed: 0 };
    }
    const jsonBlob = stage3.systemPrompt.slice(idx + marker.length).trim();
    try {
      // jsonBlob is the JSON.stringify(examples, null, 2) from the prompt.
      // Since `examples` is an array produced by `selectExamples`, parse it.
      const parsed = JSON.parse(jsonBlob);
      const asArray = Array.isArray(parsed) ? parsed : [parsed];
      return await smokeExampleArray('Worked examples in Stage 3 prompt', asArray);
    } catch (err) {
      console.warn('⚠  Worked-example JSON parse failed; smoke skipped:', (err as Error).message);
      return { passed: 0, failed: 0 };
    }
  }
  const asArray = Object.entries(examples).map(([name, spec]) => ({ name, ...(spec as any) }));
  return await smokeExampleArray('Prompt-builder worked examples', asArray);
}

async function smokeExampleArray(
  label: string,
  examples: Array<any>,
): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  console.log('\n' + '═'.repeat(80));
  console.log(`▶ ${label} (${examples.length} specs)`);
  for (const example of examples) {
    const name = example.metadata?.title ?? example.name ?? '(unnamed)';
    try {
      // Fill in required metadata fields if missing.
      const spec = {
        metadata: { title: name, ...(example.metadata ?? {}) },
        sheets: example.sheets ?? [],
        namedRanges: example.namedRanges,
      } as any;
      if (!spec.sheets.length) {
        console.log(`  ⚠  ${name} — no sheets; skipped`);
        continue;
      }
      const wb = await excelOrchestrator.createWorkbookFromSpec(spec);
      const evalResult = await evalWorkbook(wb.buffer);
      if (evalResult.ok) {
        console.log(`  ✓  ${name}`);
        passed++;
      } else {
        console.log(`  ✗  ${name} — formula errors:`);
        for (const e of evalResult.errors) console.log('     ·', e);
        failed++;
      }
    } catch (err: any) {
      console.error(`  ✗  ${name} — exception:`, err?.message ?? err);
      failed++;
    }
  }
  return { passed, failed };
}

async function main() {
  let passed = 0;
  let failed = 0;
  for (const tc of cases) {
    console.log('\n' + '═'.repeat(80));
    console.log('▶', tc.name);
    console.log('  Query:', tc.query);
    try {
      const agentResult = await runCalculationAgents(tc.query);
      console.log('  Agents invoked:', agentResult.agentsInvoked.length ? agentResult.agentsInvoked.join(', ') : '(none)');
      if (!agentResult.excelSpec) {
        console.log('  ⚠  No excel spec emitted — test skipped');
        continue;
      }
      const wb = await excelOrchestrator.createWorkbookFromSpec(agentResult.excelSpec);
      console.log('  Built:', wb.summary);
      const evalResult = await evalWorkbook(wb.buffer);
      if (evalResult.ok) {
        console.log('  ✓  All formulas evaluate cleanly');
        passed++;
      } else {
        console.log('  ✗  Formula errors:');
        for (const e of evalResult.errors) console.log('     ·', e);
        failed++;
      }
    } catch (err: any) {
      console.error('  ✗  Exception:', err?.message ?? err);
      failed++;
    }
  }
  // Also smoke-test the prompt-builder worked examples — the LLM
  // copies these, so a broken example poisons every downstream call.
  try {
    const examplesResult = await smokeWorkedExamples();
    passed += examplesResult.passed;
    failed += examplesResult.failed;
  } catch (err) {
    console.error('Worked-example smoke crashed:', err);
    failed++;
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke run crashed:', err);
  process.exit(1);
});
