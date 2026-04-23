import { describe, it, expect, vi } from 'vitest';

// Mock calcExecutor so we don't drag in financial agents for a unit test.
vi.mock('../agents/calcExecutor', () => ({
  runCalculationAgents: vi.fn(async (query: string) => {
    if (query.includes('nomatch')) {
      return { results: {}, excelSpec: null, agentsInvoked: [] };
    }
    return {
      results: { npv: { npv: 1234 } },
      excelSpec: {
        metadata: { title: 'NPV Workbook' },
        sheets: [{ name: 'NPV', purpose: 'calculations' as const, cells: [] }],
      },
      agentsInvoked: ['npv-calculator'],
    };
  }),
}));

import { runSolverTool } from './runSolver.tool';
import { buildSpreadsheetTool } from './buildSpreadsheet.tool';

describe('run_solver + build_spreadsheet', () => {
  const ctx = { conversationId: 'conv-solver', userId: 'u1' };

  it('run_solver returns a handle that build_spreadsheet can consume', async () => {
    const runOut = await runSolverTool.handler(
      { query: 'compute NPV with 10% discount' },
      ctx,
    );
    expect(runOut.agentsInvoked).toEqual(['npv-calculator']);
    expect(runOut.solver_run_id).toBeTruthy();

    const buildOut = await buildSpreadsheetTool.handler(
      { solver_run_id: runOut.solver_run_id! },
      ctx,
    );
    expect(buildOut.xlsx_base64.length).toBeGreaterThan(100);
    expect(buildOut.filename).toMatch(/\.xlsx$/);
    expect(buildOut.size_bytes).toBeGreaterThan(100);
  });

  it('run_solver returns null handle when no agent matches', async () => {
    const out = await runSolverTool.handler({ query: 'nomatch query' }, ctx);
    expect(out.agentsInvoked).toEqual([]);
    expect(out.solver_run_id).toBeNull();
  });

  it('build_spreadsheet rejects expired/unknown handle', async () => {
    await expect(
      buildSpreadsheetTool.handler(
        { solver_run_id: 'sr_missing' },
        ctx,
      ),
    ).rejects.toThrow('solver_run_not_found_or_expired');
  });

  it('build_spreadsheet rejects when neither handle nor spec supplied', async () => {
    await expect(
      buildSpreadsheetTool.handler({} as any, ctx),
    ).rejects.toThrow('must_provide_solver_run_id_or_spec');
  });

  it('build_spreadsheet enforces conversation scope on handle', async () => {
    const runOut = await runSolverTool.handler(
      { query: 'compute NPV' },
      { conversationId: 'conv-A', userId: 'u1' },
    );
    await expect(
      buildSpreadsheetTool.handler(
        { solver_run_id: runOut.solver_run_id! },
        { conversationId: 'conv-B', userId: 'u1' },
      ),
    ).rejects.toThrow('solver_run_not_found_or_expired');
  });
});
