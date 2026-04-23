/**
 * Smoke tests for FinancialRatioCalculator, AmortizationScheduler, and
 * their calcExecutor routing. Validates:
 *   - Agents produce the expected numeric data fields.
 *   - Agents emit a non-empty ExcelWorkbookSpec (formulas present).
 *   - calcExecutor detects + dispatches on natural-language queries.
 */

import { describe, it, expect } from 'vitest';
import {
  FinancialRatioCalculator,
  AmortizationScheduler,
} from '../financialCalculationAgents';
import { runCalculationAgents } from '../calcExecutor';

const baseInput = {
  query: '',
  conversationId: 'test',
  context: {},
  timestamp: Date.now(),
  userTier: 'free' as const,
};

describe('FinancialRatioCalculator', () => {
  it('computes liquidity, leverage, and profitability ratios', async () => {
    const agent = new FinancialRatioCalculator();
    const out = await agent.execute({
      ...baseInput,
      data: {
        currentAssets: 500000,
        currentLiabilities: 250000,
        totalAssets: 1_000_000,
        totalLiabilities: 400000,
        inventory: 100000,
        netIncome: 80000,
        equity: 600000,
      },
    });

    expect(out.success).toBe(true);
    expect(out.data.currentRatio).toBeCloseTo(2, 4);
    expect(out.data.quickRatio).toBeCloseTo((500000 - 100000) / 250000, 4);
    expect(out.data.debtToEquity).toBeCloseTo(400000 / 600000, 4);
    expect(out.data.roe).toBeCloseTo(80000 / 600000, 4);
    expect(out.data.roa).toBeCloseTo(80000 / 1_000_000, 4);
    expect(out.data.excelSpec).toBeDefined();
    expect(out.data.excelSpec.sheets.length).toBeGreaterThan(0);

    // Workbook must contain at least one Excel formula cell.
    const cells = out.data.excelSpec.sheets[0].cells;
    const hasFormula = cells.some((c: any) => c.type === 'formula' && typeof c.formula === 'string' && c.formula.startsWith('='));
    expect(hasFormula).toBe(true);
  });

  it('handles zero denominators safely', async () => {
    const agent = new FinancialRatioCalculator();
    const out = await agent.execute({
      ...baseInput,
      data: {
        currentAssets: 100,
        currentLiabilities: 0,
        totalAssets: 0,
        totalLiabilities: 0,
        inventory: 0,
        netIncome: 0,
        equity: 0,
      },
    });

    expect(out.success).toBe(true);
    expect(out.data.currentRatio).toBe(0);
    expect(out.data.debtToEquity).toBe(0);
    expect(out.data.roa).toBe(0);
  });
});

describe('AmortizationScheduler', () => {
  it('produces a schedule whose final balance is ~zero', async () => {
    const agent = new AmortizationScheduler();
    const out = await agent.execute({
      ...baseInput,
      data: {
        principal: 100000,
        annualRate: 0.06,
        years: 5,
        paymentsPerYear: 12,
      },
    });

    expect(out.success).toBe(true);
    expect(out.data.schedule.length).toBe(60);
    // Standard PMT for 100k @ 6%/12 over 60 months ≈ 1933.28
    expect(out.data.payment).toBeGreaterThan(1930);
    expect(out.data.payment).toBeLessThan(1940);
    const finalBalance = out.data.schedule[out.data.schedule.length - 1].balance;
    expect(finalBalance).toBeLessThan(0.01);
    expect(out.data.excelSpec).toBeDefined();
    // PMT formula must exist somewhere.
    const cells = out.data.excelSpec.sheets[0].cells;
    const hasPmt = cells.some((c: any) => typeof c.formula === 'string' && c.formula.includes('PMT('));
    expect(hasPmt).toBe(true);
  });
});

describe('calcExecutor routing for new agents', () => {
  it('routes a ratios query to FinancialRatioCalculator', async () => {
    const res = await runCalculationAgents(
      'Compute liquidity ratios: current assets of 500000, current liabilities of 250000, inventory of 100000, total assets 1000000, total liabilities 400000, net income 80000, equity 600000',
    );
    expect(res.agentsInvoked).toContain('financial-ratio-calculator');
    expect(res.results.ratios).toBeDefined();
    expect(res.excelSpec).not.toBeNull();
  });

  it('routes an amortization query to AmortizationScheduler', async () => {
    const res = await runCalculationAgents(
      'Build an amortization schedule for a principal of 100000 at interest rate 6% over 5 years',
    );
    expect(res.agentsInvoked).toContain('amortization-scheduler');
    expect(res.results.amortization).toBeDefined();
    expect(res.excelSpec).not.toBeNull();
  });

  it('returns no agents when ratios query has no inputs', async () => {
    const res = await runCalculationAgents('What are financial ratios?');
    expect(res.agentsInvoked).not.toContain('financial-ratio-calculator');
  });
});
