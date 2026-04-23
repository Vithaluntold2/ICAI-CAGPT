/**
 * Calculation-mode executor.
 *
 * Routes a natural-language calculation query through the registered
 * financial-calculation agents (`NPVCalculator`, `TaxLiabilityCalculator`,
 * `DepreciationScheduler`, `ROICalculator`, `BreakEvenAnalyzer`). Each
 * detected agent is invoked with parameters extracted from the query;
 * the agent returns its normal numeric output plus an `excelSpec`.
 *
 * This module REPLACES the previous regex-+-JS-math path in
 * `aiOrchestrator.executeCalculations`, which bypassed the registered
 * agents entirely. The agents were orphan code; this wires them up.
 *
 * Output shape:
 *   {
 *     results: { npv?, tax?, depreciation?, roi?, breakEven? },
 *     excelSpec: ExcelWorkbookSpec | null,   // merged multi-sheet workbook
 *     agentsInvoked: string[],
 *   }
 *
 * The caller (aiOrchestrator.ts) uses `results` to enrich the LLM prompt
 * (chat narrative) and `excelSpec` to render the `.xlsx` directly —
 * no LLM round-trip for the workbook.
 */

import type { ExcelWorkbookSpec, SheetSpec } from '../excel/excelWorkbookBuilder';
import {
  NPVCalculator,
  TaxLiabilityCalculator,
  DepreciationScheduler,
  ROICalculator,
  BreakEvenAnalyzer,
  FinancialRatioCalculator,
  AmortizationScheduler,
} from './financialCalculationAgents';
import { buildCalcWorkbook } from './calcAgentHelpers';

export interface CalcExecutorResult {
  /** Per-agent numeric outputs — keyed by short name so the chat
   *  prompt can reference them cleanly. */
  results: Record<string, any>;
  /** Merged workbook ready to hand to the Excel builder. Null if
   *  nothing matched. */
  excelSpec: ExcelWorkbookSpec | null;
  /** Which agents actually ran. Useful for logging + response
   *  metadata. */
  agentsInvoked: string[];
}

// Agent singletons — these are already registered in agentBootstrap,
// but we hold our own instances here for direct invocation so we
// don't need to touch the registry plumbing for Step A. Moving to
// registry-based execution is a cleanup follow-up.
const npvAgent = new NPVCalculator();
const taxAgent = new TaxLiabilityCalculator();
const depreciationAgent = new DepreciationScheduler();
const roiAgent = new ROICalculator();
const breakEvenAgent = new BreakEvenAnalyzer();
const ratioAgent = new FinancialRatioCalculator();
const amortizationAgent = new AmortizationScheduler();

/**
 * Main entry point. Inspects the query text, runs whichever agents
 * it matches, and returns combined results + merged workbook spec.
 */
export async function runCalculationAgents(query: string): Promise<CalcExecutorResult> {
  const q = query.toLowerCase();
  const results: Record<string, any> = {};
  const sheets: SheetSpec[] = [];
  const agentsInvoked: string[] = [];
  const now = Date.now();

  // --- NPV / IRR ----------------------------------------------------
  if (q.includes('npv') || q.includes('net present value') || q.includes('irr') || q.includes('internal rate of return')) {
    const cashFlows = parseCashFlows(query);
    const discountRate = parseDiscountRate(query) ?? 0.1; // default 10% if omitted
    const initialInvestment = parseInitialInvestment(query) ?? (cashFlows[0] && cashFlows[0] < 0 ? -cashFlows[0] : 0);
    // If the first element of cashFlows is the initial outflow, drop
    // it from the operating stream (the agent adds it separately).
    const operatingFlows =
      cashFlows.length > 0 && cashFlows[0] < 0 ? cashFlows.slice(1) : cashFlows;

    if (operatingFlows.length > 0) {
      const out = await npvAgent.execute({
        query,
        data: {
          cashFlows: operatingFlows,
          discountRate,
          initialInvestment,
        },
        conversationId: 'calc',
        context: {},
        timestamp: now,
        userTier: 'free',
      });
      if (out.success && out.data) {
        results.npv = out.data;
        if (out.data.excelSpec) sheets.push(...out.data.excelSpec.sheets);
        agentsInvoked.push('npv-calculator');
      }
    }
  }

  // --- Tax ----------------------------------------------------------
  const taxHit = /(income tax|tax liability|tax slab|old regime|new regime|compute tax|calculate.*tax)/i.test(query);
  if (taxHit) {
    const income = parseIncomeAmount(query);
    const regime: 'old' | 'new' = /new regime/i.test(query) ? 'new' : 'old';
    const deductions = parseDeductions(query);
    if (income > 0) {
      const out = await taxAgent.execute({
        query,
        data: {
          income,
          jurisdiction: 'India',
          regime,
          deductions,
        },
        conversationId: 'calc',
        context: {},
        timestamp: now,
        userTier: 'free',
      });
      if (out.success && out.data) {
        results.tax = out.data;
        if (out.data.excelSpec) sheets.push(...out.data.excelSpec.sheets);
        agentsInvoked.push('tax-liability-calculator');
      }
    }
  }

  // --- Depreciation ------------------------------------------------
  if (q.includes('depreciation') || q.includes('depreciate')) {
    const params = parseDepreciationParams(query);
    if (params) {
      const out = await depreciationAgent.execute({
        query,
        data: {
          assetCost: params.cost,
          salvageValue: params.salvage,
          usefulLife: params.life,
          method: params.method,
        },
        conversationId: 'calc',
        context: {},
        timestamp: now,
        userTier: 'free',
      });
      if (out.success && out.data) {
        results.depreciation = out.data;
        if (out.data.excelSpec) sheets.push(...out.data.excelSpec.sheets);
        agentsInvoked.push('depreciation-scheduler');
      }
    }
  }

  // --- ROI ---------------------------------------------------------
  if (/return on investment|\broi\b/i.test(query)) {
    const params = parseROIParams(query);
    if (params) {
      const out = await roiAgent.execute({
        query,
        data: params,
        conversationId: 'calc',
        context: {},
        timestamp: now,
        userTier: 'free',
      });
      if (out.success && out.data) {
        results.roi = out.data;
        if (out.data.excelSpec) sheets.push(...out.data.excelSpec.sheets);
        agentsInvoked.push('roi-calculator');
      }
    }
  }

  // --- Break-even --------------------------------------------------
  if (/break[- ]?even|contribution margin/i.test(query)) {
    const params = parseBreakEvenParams(query);
    if (params) {
      const out = await breakEvenAgent.execute({
        query,
        data: params,
        conversationId: 'calc',
        context: {},
        timestamp: now,
        userTier: 'free',
      });
      if (out.success && out.data) {
        results.breakEven = out.data;
        if (out.data.excelSpec) sheets.push(...out.data.excelSpec.sheets);
        agentsInvoked.push('break-even-analyzer');
      }
    }
  }

  // --- Financial Ratios --------------------------------------------
  if (/\bratio(s)?\b|current\s*ratio|quick\s*ratio|debt[- ]to[- ]equity|\broe\b|\broa\b|liquidity|leverage/i.test(query)) {
    const params = parseRatioParams(query);
    if (params) {
      const out = await ratioAgent.execute({
        query,
        data: params,
        conversationId: 'calc',
        context: {},
        timestamp: now,
        userTier: 'free',
      });
      if (out.success && out.data) {
        results.ratios = out.data;
        if (out.data.excelSpec) sheets.push(...out.data.excelSpec.sheets);
        agentsInvoked.push('financial-ratio-calculator');
      }
    }
  }

  // --- Amortization ------------------------------------------------
  if (/amortization|amortisation|loan\s*schedule|emi|mortgage/i.test(query)) {
    const params = parseAmortizationParams(query);
    if (params) {
      const out = await amortizationAgent.execute({
        query,
        data: params,
        conversationId: 'calc',
        context: {},
        timestamp: now,
        userTier: 'free',
      });
      if (out.success && out.data) {
        results.amortization = out.data;
        if (out.data.excelSpec) sheets.push(...out.data.excelSpec.sheets);
        agentsInvoked.push('amortization-scheduler');
      }
    }
  }

  const excelSpec =
    sheets.length > 0
      ? buildCalcWorkbook(
          deriveWorkbookTitle(agentsInvoked),
          sheets,
          `Generated by ${agentsInvoked.length} calculation agent(s)`,
        )
      : null;

  return { results, excelSpec, agentsInvoked };
}

// -------------------------------------------------------------------
// Query parsing helpers. These intentionally mirror (but don't reuse)
// the private extraction helpers in aiOrchestrator so this module is
// self-contained. If/when both paths converge, we'll merge them.
// -------------------------------------------------------------------

function parseNumberWithSuffix(raw: string): number {
  const clean = raw.replace(/,/g, '').trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  if (/k$/i.test(clean)) return num * 1_000;
  if (/m$/i.test(clean)) return num * 1_000_000;
  if (/cr/i.test(raw)) return num * 10_000_000;
  if (/lakh|lac/i.test(raw)) return num * 100_000;
  return num;
}

function parseCashFlows(query: string): number[] {
  // [-1000, 400, 500, 600] form
  const bracket = query.match(/\[([0-9,.\s\-+₹$]+)\]/);
  if (bracket) {
    return bracket[1]
      .split(/[,\s]+/)
      .map((s) => parseFloat(s.replace(/[₹$,]/g, '')))
      .filter((n) => !isNaN(n));
  }
  // "-100k, 40k, 40k, 40k, 40k" inline
  const inline = query.match(/(?:cash\s*flows?|flows?)\s*(?:of|are|:)?\s*([-0-9.,\s$₹kKmMcrlLakh]+)(?=[.;]|\s(?:at|with|over|for))/i);
  if (inline) {
    const chunks = inline[1].split(/[,\s]+/).filter(Boolean);
    const nums = chunks.map(parseNumberWithSuffix).filter((n) => !isNaN(n) && n !== 0);
    if (nums.length >= 2) return nums;
  }
  return [];
}

function parseDiscountRate(query: string): number | null {
  const m = query.match(/(?:discount rate|cost of capital|required return|wacc|hurdle rate)\s*(?:of|is|=|:)?\s*([0-9.]+)\s*%?/i);
  if (m) {
    const v = parseFloat(m[1]);
    return v > 1 ? v / 100 : v;
  }
  return null;
}

function parseInitialInvestment(query: string): number | null {
  const m = query.match(/(?:initial investment|capex|capital expenditure|outlay)\s*(?:of|is|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i);
  if (m) return parseNumberWithSuffix(m[1]);
  return null;
}

function parseIncomeAmount(query: string): number {
  const m =
    query.match(/(?:annual income|total income|gross income|income)\s*(?:of|is|=|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i) ||
    query.match(/₹\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i);
  return m ? parseNumberWithSuffix(m[1]) : 0;
}

function parseDeductions(query: string): number {
  const m = query.match(/(?:deduction|80c|hra|section\s*80)\s*(?:of|is|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i);
  return m ? parseNumberWithSuffix(m[1]) : 0;
}

function parseDepreciationParams(query: string): { cost: number; salvage: number; life: number; method: 'straight-line' | 'declining-balance' } | null {
  const costMatch = query.match(/(?:asset\s*cost|cost|price)\s*(?:of|is|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i);
  const salvageMatch = query.match(/(?:salvage|residual|scrap)\s*(?:value)?\s*(?:of|is|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i);
  const lifeMatch = query.match(/(?:(?:useful\s*)?life|over)\s*(?:of|is|:)?\s*([0-9]+)\s*(?:year|yr)/i);
  if (!costMatch || !lifeMatch) return null;
  const method = /declining|double.*declining|ddb/i.test(query) ? 'declining-balance' : 'straight-line';
  return {
    cost: parseNumberWithSuffix(costMatch[1]),
    salvage: salvageMatch ? parseNumberWithSuffix(salvageMatch[1]) : 0,
    life: parseInt(lifeMatch[1], 10),
    method,
  };
}

function parseROIParams(query: string): { initialInvestment: number; finalValue: number; period: number } | null {
  // "initial investment of X" / "initial value X" / "invested X" / "bought for X" / "paid X"
  const init = query.match(
    /(?:initial(?:\s+(?:investment|value|cost|price))?|invested|bought(?:\s+for)?|paid)\s*(?:of|is|at|:|for)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i,
  );
  // "grew to X" / "final value X" / "sold for X" / "exit at X" / "worth X"
  const final =
    query.match(
      /(?:final(?:\s+(?:value|price))?|sold(?:\s+for)?|exit(?:\s+at)?|current(?:\s+value)?|grew\s+to|worth|ending(?:\s+value)?)\s*(?:of|is|at|:|to)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i,
    ) ||
    // fallback: explicit "to X" AFTER an init match
    (init ? query.match(/\s+to\s+\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i) : null);
  const period = query.match(/(?:over|in|after)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:year|yr)/i);
  if (!init || !final) return null;
  return {
    initialInvestment: parseNumberWithSuffix(init[1]),
    finalValue: parseNumberWithSuffix(final[1]),
    period: period ? parseFloat(period[1]) : 1,
  };
}

function parseBreakEvenParams(query: string): { fixedCosts: number; variableCostPerUnit: number; pricePerUnit: number } | null {
  // "fixed costs are X" / "fixed cost of X" / "fixed costs: X"
  const fc = query.match(
    /(?:fixed\s*costs?)\s*(?:are|of|is|=|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i,
  );
  // "variable cost per unit is X" / "variable cost of X" / "variable cost: X"
  const vc = query.match(
    /(?:variable\s*cost(?:\s*per\s*unit)?)\s*(?:are|of|is|=|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i,
  );
  // "price per unit is X" / "selling price of X" / "price: X"
  const price = query.match(
    /(?:price\s*per\s*unit|selling\s*price|unit\s*price|price)\s*(?:are|of|is|=|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i,
  );
  if (!fc || !vc || !price) return null;
  return {
    fixedCosts: parseNumberWithSuffix(fc[1]),
    variableCostPerUnit: parseNumberWithSuffix(vc[1]),
    pricePerUnit: parseNumberWithSuffix(price[1]),
  };
}

function parseRatioParams(query: string): {
  currentAssets: number;
  currentLiabilities: number;
  totalAssets: number;
  totalLiabilities: number;
  inventory: number;
  netIncome: number;
  equity: number;
} | null {
  const pick = (re: RegExp) => {
    const m = query.match(re);
    return m ? parseNumberWithSuffix(m[1]) : 0;
  };
  const currentAssets = pick(/current\s*assets?\s*(?:of|is|are|=|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i);
  const currentLiabilities = pick(/current\s*liabilities?\s*(?:of|is|are|=|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i);
  const totalAssets = pick(/total\s*assets?\s*(?:of|is|are|=|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i);
  const totalLiabilities = pick(/total\s*liabilities?\s*(?:of|is|are|=|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i);
  const inventory = pick(/inventory\s*(?:of|is|=|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i);
  const netIncome = pick(/(?:net\s*income|net\s*profit|profit\s*after\s*tax|pat)\s*(?:of|is|=|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i);
  const equity = pick(/(?:shareholders?\s*equity|equity|net\s*worth)\s*(?:of|is|=|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i);

  // Need at least one pair of inputs to produce a meaningful ratio.
  const hasLiquidity = currentAssets > 0 && currentLiabilities > 0;
  const hasProfitability = netIncome !== 0 && (equity > 0 || totalAssets > 0);
  const hasLeverage = totalLiabilities > 0 && equity > 0;
  if (!hasLiquidity && !hasProfitability && !hasLeverage) return null;

  return {
    currentAssets,
    currentLiabilities,
    totalAssets,
    totalLiabilities,
    inventory,
    netIncome,
    equity,
  };
}

function parseAmortizationParams(query: string): {
  principal: number;
  annualRate: number;
  years: number;
  paymentsPerYear: number;
} | null {
  const principalMatch =
    query.match(/(?:principal|loan(?:\s*amount)?|borrowed)\s*(?:of|is|=|:)?\s*\$?₹?\s*([0-9,.]+\s*(?:k|m|cr|lakh|lac)?)/i);
  const rateMatch = query.match(/(?:interest\s*rate|rate|apr)\s*(?:of|is|=|:|at)?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i);
  const yearsMatch = query.match(/(?:over|for|term\s*of|tenure\s*of)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:year|yr)/i);
  if (!principalMatch || !rateMatch || !yearsMatch) return null;

  let paymentsPerYear = 12;
  if (/annually|per\s*year|yearly/i.test(query)) paymentsPerYear = 1;
  else if (/quarterly/i.test(query)) paymentsPerYear = 4;
  else if (/semi[- ]?annual|half[- ]?yearly/i.test(query)) paymentsPerYear = 2;
  else if (/weekly/i.test(query)) paymentsPerYear = 52;

  const annualRateRaw = parseFloat(rateMatch[1]);
  const annualRate = annualRateRaw > 1 ? annualRateRaw / 100 : annualRateRaw;

  return {
    principal: parseNumberWithSuffix(principalMatch[1]),
    annualRate,
    years: parseFloat(yearsMatch[1]),
    paymentsPerYear,
  };
}

function deriveWorkbookTitle(agentsInvoked: string[]): string {
  if (agentsInvoked.length === 0) return 'Financial Calculations';
  if (agentsInvoked.length === 1) {
    const labels: Record<string, string> = {
      'npv-calculator': 'NPV / IRR Analysis',
      'tax-liability-calculator': 'Income Tax Calculation',
      'depreciation-scheduler': 'Depreciation Schedule',
      'roi-calculator': 'ROI Analysis',
      'break-even-analyzer': 'Break-even Analysis',
      'financial-ratio-calculator': 'Financial Ratios',
      'amortization-scheduler': 'Amortization Schedule',
    };
    return labels[agentsInvoked[0]] ?? 'Financial Calculations';
  }
  return 'Financial Calculation Bundle';
}
