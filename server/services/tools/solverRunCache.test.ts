import { describe, it, expect } from 'vitest';
import { putSolverRun, getSolverRun } from './solverRunCache';
import type { ExcelWorkbookSpec } from '../excel/excelWorkbookBuilder';

const dummySpec: ExcelWorkbookSpec = {
  metadata: { title: 'dummy' },
  sheets: [{ name: 'S1', purpose: 'calculations', cells: [] }],
};

describe('solverRunCache', () => {
  it('round-trips a spec under the same conversation id', () => {
    const id = putSolverRun('conv-A', dummySpec, { npv: 42 }, ['npv-calculator']);
    const got = getSolverRun(id, 'conv-A');
    expect(got).not.toBeNull();
    expect(got?.spec).toBe(dummySpec);
    expect(got?.results).toEqual({ npv: 42 });
    expect(got?.agentsInvoked).toEqual(['npv-calculator']);
  });

  it('returns null when accessed from a different conversation', () => {
    const id = putSolverRun('conv-A', dummySpec, {}, []);
    expect(getSolverRun(id, 'conv-B')).toBeNull();
  });

  it('returns null for unknown handle', () => {
    expect(getSolverRun('sr_doesnotexist', 'conv-A')).toBeNull();
  });
});
