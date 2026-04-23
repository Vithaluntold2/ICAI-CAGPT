/**
 * Financial Calculation Mode Agents
 * Specialized agents for tax calculations, NPV, IRR, depreciation, and financial modeling
 *
 * Each agent returns:
 *   - `data.<metrics>` — the computed numbers (unchanged from prior shape)
 *   - `data.excelSpec`  — a ready-to-build `ExcelWorkbookSpec` that the
 *                         Excel orchestrator can render without going
 *                         through the three-stage LLM generator. This
 *                         kills Flaws 1 & 2 from the correctness plan:
 *                         the agent owns the formulas + layout, the
 *                         LLM no longer reinvents them.
 *
 * Layout convention (enforced via `buildCalcSheet`):
 *   Row 1        = title
 *   Row 2/3      = column headers LABEL | VALUE | FORMULA / RESULT | NOTES
 *   Column A     = labels
 *   Column B     = literal numeric inputs (named where helpful)
 *   Column C     = formulas that only reference column-B addresses
 *   Column D     = notes / units
 *
 * All formulas reference earlier or same-row column-B cells — no
 * forward references.
 */

import { EventEmitter } from 'events';
import type { AgentDefinition, AgentInput, AgentOutput } from '@shared/types/agentTypes';
import {
  buildCalcSheet,
  singleSheetWorkbook,
  colRange,
  type CalcRow,
} from './calcAgentHelpers';

/**
 * NPV Calculator Agent
 * Calculates Net Present Value for investment decisions
 */
export class NPVCalculator extends EventEmitter implements AgentDefinition {
  id = 'npv-calculator';
  name = 'NPV Calculator';
  mode = 'financial-calculation' as const;
  capabilities = ['calculation', 'financial-modeling'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[NPVCalculator] Calculating NPV');

    const cashFlows = (input.data.cashFlows as number[]) || [];
    const discountRate = (input.data.discountRate as number) || 0;
    const initialInvestment = (input.data.initialInvestment as number) || 0;

    const npv = this.calculateNPV(cashFlows, discountRate, initialInvestment);
    const irr = this.calculateIRR([...cashFlows], initialInvestment);
    const breakEvenYear = this.findBreakEvenYear(cashFlows, initialInvestment);

    // Build the Excel spec. Layout is designed so the cash-flow
    // stream (Year 0 outflow + Year 1..N inflows) lives in a SINGLE
    // contiguous column-B range — `IRR` then reduces to `=IRR(Bn:Bm)`
    // with no array tricks. `NPV` still uses Excel's convention of
    // discounting years 1..N and adding back Year 0 separately.
    //
    // Row layout (no description — headers on row 2):
    //   Row 3 subheader  "Inputs"
    //   Row 4 Discount Rate
    //   Row 5 subheader  "Cash Flow Stream"
    //   Row 6 Year 0 / Initial Investment (negative)
    //   Row 7 Year 1 Cash Flow
    //   …
    //   Row 6+N Year N Cash Flow
    //   Row 7+N subheader "Outputs"
    //   Row 8+N NPV    = NPV(DiscountRate, Y1..YN) + Y0
    //   Row 9+N IRR    = IRR(Y0..YN)      ← contiguous range
    //   Row 10+N Break-even Year (literal)
    const rows: CalcRow[] = [];
    rows.push({ label: 'Inputs', kind: 'subheader' });
    rows.push({
      label: 'Discount Rate',
      value: discountRate,
      format: { type: 'percentage', decimals: 2 },
      name: 'DiscountRate',
      note: 'Cost of capital / required return',
    });

    rows.push({ label: 'Cash Flow Stream', kind: 'subheader' });
    // Year 0 — the initial investment, as a negative.
    rows.push({
      label: 'Year 0 (Initial Investment)',
      value: -Math.abs(initialInvestment),
      format: { type: 'currency', decimals: 2, negativeRed: true },
      note: 'Cash outflow (negative)',
    });
    cashFlows.forEach((cf, i) => {
      rows.push({
        label: `Year ${i + 1} Cash Flow`,
        value: cf,
        format: { type: 'currency', decimals: 2, negativeRed: true },
      });
    });

    // Absolute Excel rows (no description, so headers occupy rows 1-2):
    //   Row 3 "Inputs" subheader, Row 4 discount rate,
    //   Row 5 "Cash Flow Stream" subheader, Row 6 Year 0, Row 7..6+N Year N.
    const discountRateRow = 4;
    const year0Row = 6;
    const lastCashFlowRow = year0Row + cashFlows.length; // Y0 + N operating flows
    const firstOperatingCashFlowRow = year0Row + 1; // Y1

    rows.push({ label: 'Outputs', kind: 'subheader' });

    if (cashFlows.length > 0) {
      rows.push({
        label: 'Net Present Value (NPV)',
        formula: `=NPV(B${discountRateRow},${colRange('B', firstOperatingCashFlowRow, lastCashFlowRow)})+B${year0Row}`,
        format: { type: 'currency', decimals: 2, negativeRed: true },
        kind: 'total',
        note: npv > 0 ? 'Accept project' : 'Reject project',
      });

      rows.push({
        label: 'Internal Rate of Return (IRR)',
        formula: `=IRR(${colRange('B', year0Row, lastCashFlowRow)})`,
        format: { type: 'percentage', decimals: 2 },
        kind: 'total',
      });

      rows.push({
        label: 'Break-even Year',
        value: breakEvenYear > 0 ? breakEvenYear : 'N/A',
        format: { type: 'number', decimals: 0 },
        note: breakEvenYear > 0 ? `Payback in year ${breakEvenYear}` : 'No break-even within horizon',
      });
    }

    const sheet = buildCalcSheet({
      sheetName: 'NPV Analysis',
      title: 'Net Present Value Analysis',
      description: `Post-tax cash flow NPV/IRR at ${(discountRate * 100).toFixed(2)}% discount rate`,
      rows,
    });
    const excelSpec = singleSheetWorkbook(
      'NPV / IRR Analysis',
      sheet,
      'Generated from NPV Calculator agent',
    );

    return {
      success: true,
      data: {
        npv,
        irr,
        discountRate,
        initialInvestment,
        cashFlows,
        recommendation: npv > 0 ? 'Accept project' : 'Reject project',
        breakEvenYear,
        timestamp: new Date().toISOString(),
        excelSpec,
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 1.0,
      },
    };
  }

  private calculateNPV(cashFlows: number[], discountRate: number, initialInvestment: number): number {
    let npv = -initialInvestment;
    for (let i = 0; i < cashFlows.length; i++) {
      npv += cashFlows[i] / Math.pow(1 + discountRate, i + 1);
    }
    return Math.round(npv * 100) / 100;
  }

  private calculateIRR(cashFlows: number[], initialInvestment: number): number {
    let irr = 0.1;
    const maxIterations = 100;
    const tolerance = 0.0001;

    for (let i = 0; i < maxIterations; i++) {
      let npv = -initialInvestment;
      let derivative = 0;
      for (let j = 0; j < cashFlows.length; j++) {
        const power = j + 1;
        npv += cashFlows[j] / Math.pow(1 + irr, power);
        derivative -= (power * cashFlows[j]) / Math.pow(1 + irr, power + 1);
      }
      const newIrr = irr - npv / derivative;
      if (Math.abs(newIrr - irr) < tolerance) {
        return Math.round(newIrr * 10000) / 100;
      }
      irr = newIrr;
    }
    return Math.round(irr * 10000) / 100;
  }

  private findBreakEvenYear(cashFlows: number[], initialInvestment: number): number {
    let cumulative = -initialInvestment;
    for (let i = 0; i < cashFlows.length; i++) {
      cumulative += cashFlows[i];
      if (cumulative >= 0) return i + 1;
    }
    return -1;
  }
}

/**
 * Tax Liability Calculator Agent
 * Calculates tax liability under different scenarios
 */
export class TaxLiabilityCalculator extends EventEmitter implements AgentDefinition {
  id = 'tax-liability-calculator';
  name = 'Tax Liability Calculator';
  mode = 'financial-calculation' as const;
  capabilities = ['calculation', 'tax-modeling'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[TaxLiabilityCalculator] Calculating tax liability');

    const income = (input.data.income as number) || 0;
    const jurisdiction = (input.data.jurisdiction as string) || 'India';
    const regime = (input.data.regime as string) || 'old';
    const deductions = (input.data.deductions as number) || 0;

    const taxCalculation = this.calculateTax(income, jurisdiction, regime, deductions);

    // Build Excel spec only for Indian tax for now — other jurisdictions
    // return an error payload, so we skip the spec.
    const excelSpec =
      jurisdiction === 'India'
        ? this.buildIndianTaxSpec(income, regime, deductions, taxCalculation)
        : undefined;

    return {
      success: true,
      data: { ...taxCalculation, excelSpec },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 0.95,
      },
    };
  }

  private buildIndianTaxSpec(
    income: number,
    regime: string,
    deductions: number,
    calc: any,
  ) {
    // Layout math: row 1 title, row 2 desc, row 3 col-headers
    // (we pass a description, so headers shift to row 3).
    const headerRowsBeforeData = 3;
    const firstDataRow = headerRowsBeforeData + 1; // row 4

    // We'll lay out slabs below. Rows:
    //   4 Inputs subheader
    //   5 Total Income (B5)
    //   6 Deductions (B6) — only for old regime
    //   7 Taxable Income (C7 formula = B5 - B6)
    //   8 Slabs subheader
    //   9-14 Per-slab taxes (B9:B14 literals, C9:C14 formulas)
    //  15 Total Tax (C15 formula = SUM of slab column C)
    //  16 Cess @ 4% (C16 formula = C15 * 0.04)
    //  17 Total Liability (C17 formula = C15 + C16)
    //  18 Effective Rate (C18 formula = C17 / B5)
    const rows: CalcRow[] = [];

    const slabs = this.getSlabs(regime);

    rows.push({ label: 'Inputs', kind: 'subheader' });

    const totalIncomeRow = firstDataRow + 1; // row after the "Inputs" subheader
    rows.push({
      label: 'Total Income',
      value: income,
      format: { type: 'currency', decimals: 0, currencySymbol: '₹' },
      name: 'TotalIncome',
    });

    const deductionsRow = totalIncomeRow + 1;
    rows.push({
      label: regime === 'old' ? 'Deductions (80C / HRA / etc.)' : 'Deductions (not applicable in new regime)',
      value: regime === 'old' ? deductions : 0,
      format: { type: 'currency', decimals: 0, currencySymbol: '₹' },
      name: 'Deductions',
    });

    const taxableIncomeRow = deductionsRow + 1;
    rows.push({
      label: 'Taxable Income',
      formula: `=B${totalIncomeRow}-B${deductionsRow}`,
      format: { type: 'currency', decimals: 0, currencySymbol: '₹' },
      note: `Under ${regime} regime`,
    });

    rows.push({ label: `${regime === 'old' ? 'Old' : 'New'} Regime Slabs`, kind: 'subheader' });

    const slabFirstRow = taxableIncomeRow + 2; // +1 for subheader, +1 for first slab row
    slabs.forEach((slab, i) => {
      const slabRow = slabFirstRow + i;
      // Per-slab tax = MAX(0, MIN(Taxable, upper) - lower) * rate
      // Slab upper can be Infinity (last bracket); encode as 1e12
      // which is effectively unbounded for personal income.
      const upper = slab.upper === Infinity ? 1_000_000_000_000 : slab.upper;
      rows.push({
        label: `Slab: ${this.formatLakh(slab.lower)} – ${slab.upper === Infinity ? 'above' : this.formatLakh(slab.upper)} @ ${(slab.rate * 100).toFixed(0)}%`,
        value: slab.rate,
        format: { type: 'percentage', decimals: 2 },
        formula: `=MAX(0,MIN(C${taxableIncomeRow},${upper})-${slab.lower})*B${slabRow}`,
        note: slab.rate === 0 ? 'Exempt' : undefined,
      });
    });

    const totalTaxRow = slabFirstRow + slabs.length;
    rows.push({
      label: 'Total Tax Before Cess',
      formula: `=SUM(${colRange('C', slabFirstRow, totalTaxRow - 1)})`,
      format: { type: 'currency', decimals: 0, currencySymbol: '₹' },
      kind: 'total',
    });

    const cessRow = totalTaxRow + 1;
    rows.push({
      label: 'Health & Education Cess @ 4%',
      formula: `=C${totalTaxRow}*0.04`,
      format: { type: 'currency', decimals: 0, currencySymbol: '₹' },
    });

    const finalTaxRow = cessRow + 1;
    rows.push({
      label: 'Total Tax Liability',
      formula: `=C${totalTaxRow}+C${cessRow}`,
      format: { type: 'currency', decimals: 0, currencySymbol: '₹' },
      kind: 'total',
    });

    rows.push({
      label: 'Effective Tax Rate',
      formula: `=IFERROR(C${finalTaxRow}/B${totalIncomeRow},0)`,
      format: { type: 'percentage', decimals: 2 },
      note: `Verified calc: ${calc.effectiveRate}%`,
    });

    const sheet = buildCalcSheet({
      sheetName: `Tax (${regime === 'old' ? 'Old' : 'New'} Regime)`,
      title: `Indian Personal Income Tax — ${regime === 'old' ? 'Old' : 'New'} Regime`,
      description: `FY 2024-25 slab-wise computation with cess. Edit B${totalIncomeRow} / B${deductionsRow} to recalculate.`,
      rows,
    });
    return singleSheetWorkbook('Income Tax Calculation', sheet, 'Generated from Tax Liability agent');
  }

  private getSlabs(regime: string) {
    if (regime === 'old') {
      return [
        { lower: 0, upper: 250_000, rate: 0 },
        { lower: 250_000, upper: 500_000, rate: 0.05 },
        { lower: 500_000, upper: 1_000_000, rate: 0.2 },
        { lower: 1_000_000, upper: Infinity, rate: 0.3 },
      ];
    }
    return [
      { lower: 0, upper: 300_000, rate: 0 },
      { lower: 300_000, upper: 600_000, rate: 0.05 },
      { lower: 600_000, upper: 900_000, rate: 0.1 },
      { lower: 900_000, upper: 1_200_000, rate: 0.15 },
      { lower: 1_200_000, upper: 1_500_000, rate: 0.2 },
      { lower: 1_500_000, upper: Infinity, rate: 0.3 },
    ];
  }

  private formatLakh(n: number): string {
    if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
    return `₹${n.toLocaleString('en-IN')}`;
  }

  private calculateTax(income: number, jurisdiction: string, regime: string, deductions: number) {
    if (jurisdiction === 'India') {
      return this.calculateIndianTax(income, regime, deductions);
    }
    return { error: 'Jurisdiction not supported', income, jurisdiction };
  }

  private calculateIndianTax(income: number, regime: string, deductions: number) {
    const taxableIncome = regime === 'old' ? income - deductions : income;
    let tax = 0;
    if (regime === 'old') {
      if (taxableIncome <= 250000) tax = 0;
      else if (taxableIncome <= 500000) tax = (taxableIncome - 250000) * 0.05;
      else if (taxableIncome <= 1000000) tax = 12500 + (taxableIncome - 500000) * 0.2;
      else tax = 112500 + (taxableIncome - 1000000) * 0.3;
    } else {
      if (taxableIncome <= 300000) tax = 0;
      else if (taxableIncome <= 600000) tax = (taxableIncome - 300000) * 0.05;
      else if (taxableIncome <= 900000) tax = 15000 + (taxableIncome - 600000) * 0.1;
      else if (taxableIncome <= 1200000) tax = 45000 + (taxableIncome - 900000) * 0.15;
      else if (taxableIncome <= 1500000) tax = 90000 + (taxableIncome - 1200000) * 0.2;
      else tax = 150000 + (taxableIncome - 1500000) * 0.3;
    }
    const cess = tax * 0.04;
    const totalTax = tax + cess;
    return {
      income,
      regime,
      deductions: regime === 'old' ? deductions : 0,
      taxableIncome,
      tax: Math.round(tax),
      cess: Math.round(cess),
      totalTax: Math.round(totalTax),
      effectiveRate: Math.round((totalTax / (income || 1)) * 10000) / 100,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Depreciation Scheduler Agent
 * Calculates depreciation schedules for assets
 */
export class DepreciationScheduler extends EventEmitter implements AgentDefinition {
  id = 'depreciation-scheduler';
  name = 'Depreciation Scheduler';
  mode = 'financial-calculation' as const;
  capabilities = ['calculation', 'scheduling'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[DepreciationScheduler] Calculating depreciation schedule');

    const assetCost = (input.data.assetCost as number) || 0;
    const salvageValue = (input.data.salvageValue as number) || 0;
    const usefulLife = (input.data.usefulLife as number) || 1;
    const method = (input.data.method as string) || 'straight-line';

    const schedule = this.generateSchedule(assetCost, salvageValue, usefulLife, method);
    const excelSpec = this.buildSpec(assetCost, salvageValue, usefulLife, method, schedule);

    return {
      success: true,
      data: {
        assetCost,
        salvageValue,
        usefulLife,
        method,
        schedule,
        totalDepreciation: assetCost - salvageValue,
        timestamp: new Date().toISOString(),
        excelSpec,
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 1.0,
      },
    };
  }

  private buildSpec(
    assetCost: number,
    salvageValue: number,
    usefulLife: number,
    method: string,
    schedule: Array<{ year: number; depreciation: number; accumulatedDepreciation: number; bookValue: number }>,
  ) {
    // Layout: row 1 title, row 2 desc, row 3 col headers, row 4+ data.
    const headerRowsBeforeData = 3;
    const firstDataRow = headerRowsBeforeData + 1;

    const rows: CalcRow[] = [];
    rows.push({ label: 'Inputs', kind: 'subheader' });
    const costRow = firstDataRow + 1;
    const salvageRow = costRow + 1;
    const lifeRow = salvageRow + 1;
    rows.push({
      label: 'Asset Cost',
      value: assetCost,
      format: { type: 'currency', decimals: 2 },
      name: 'AssetCost',
    });
    rows.push({
      label: 'Salvage Value',
      value: salvageValue,
      format: { type: 'currency', decimals: 2 },
      name: 'SalvageValue',
    });
    rows.push({
      label: 'Useful Life (Years)',
      value: usefulLife,
      format: { type: 'number', decimals: 0 },
      name: 'UsefulLife',
    });

    rows.push({ label: 'Annual Schedule', kind: 'subheader' });

    if (method === 'straight-line') {
      // Straight-line: depreciation = (Cost - Salvage) / Life, constant.
      // Per-year row formulas reference cost/salvage/life inputs.
      // Accumulated = SUM of prior depreciation values (column C).
      // Book value = Cost - Accumulated.
      const scheduleFirstRow = lifeRow + 2; // +1 subheader, +1 first year
      schedule.forEach((_, i) => {
        const yearRow = scheduleFirstRow + i;
        rows.push({
          label: `Year ${i + 1} Depreciation`,
          formula: `=(B${costRow}-B${salvageRow})/B${lifeRow}`,
          format: { type: 'currency', decimals: 2 },
        });
      });
    } else {
      // Declining-balance — the formula at year n depends on prior
      // book value. We reference the PRIOR ROW's column-C value.
      const scheduleFirstRow = lifeRow + 2;
      schedule.forEach((entry, i) => {
        const yearRow = scheduleFirstRow + i;
        const priorRow = i === 0 ? costRow : yearRow - 1;
        const priorRef = i === 0 ? `B${priorRow}` : `C${priorRow}`;
        // Double-declining rate = 2/life; cap depreciation so book
        // value never drops below salvage.
        rows.push({
          label: `Year ${i + 1} Depreciation`,
          formula: `=MIN(${priorRef}*2/B${lifeRow},${priorRef}-B${salvageRow})`,
          format: { type: 'currency', decimals: 2 },
          note: i === 0 ? 'Based on original cost' : 'Based on prior-year book value',
        });
      });
    }

    const scheduleFirstRow = lifeRow + 2;
    const scheduleLastRow = scheduleFirstRow + schedule.length - 1;

    rows.push({
      label: 'Total Accumulated Depreciation',
      formula: `=SUM(${colRange('C', scheduleFirstRow, scheduleLastRow)})`,
      format: { type: 'currency', decimals: 2 },
      kind: 'total',
    });

    rows.push({
      label: 'Ending Book Value',
      formula: `=B${costRow}-SUM(${colRange('C', scheduleFirstRow, scheduleLastRow)})`,
      format: { type: 'currency', decimals: 2 },
      kind: 'total',
      note: 'Should equal salvage value',
    });

    const sheet = buildCalcSheet({
      sheetName: `Depreciation (${method === 'straight-line' ? 'SLM' : 'DBM'})`,
      title: `Depreciation Schedule — ${method === 'straight-line' ? 'Straight Line' : 'Declining Balance'}`,
      description: `Asset over ${usefulLife} years. Edit inputs to recalc.`,
      rows,
    });
    return singleSheetWorkbook('Depreciation Schedule', sheet, 'Generated from Depreciation agent');
  }

  private generateSchedule(assetCost: number, salvageValue: number, usefulLife: number, method: string) {
    if (method === 'straight-line') {
      return this.straightLineSchedule(assetCost, salvageValue, usefulLife);
    } else if (method === 'declining-balance') {
      return this.decliningBalanceSchedule(assetCost, salvageValue, usefulLife);
    }
    return [];
  }

  private straightLineSchedule(assetCost: number, salvageValue: number, usefulLife: number) {
    const annualDepreciation = (assetCost - salvageValue) / usefulLife;
    const schedule = [];
    let bookValue = assetCost;
    for (let year = 1; year <= usefulLife; year++) {
      const depreciation = year === usefulLife ? bookValue - salvageValue : annualDepreciation;
      bookValue -= depreciation;
      schedule.push({
        year,
        depreciation: Math.round(depreciation),
        accumulatedDepreciation: Math.round(assetCost - bookValue),
        bookValue: Math.round(bookValue),
      });
    }
    return schedule;
  }

  private decliningBalanceSchedule(assetCost: number, salvageValue: number, usefulLife: number) {
    const rate = 2 / usefulLife;
    const schedule = [];
    let bookValue = assetCost;
    for (let year = 1; year <= usefulLife; year++) {
      const depreciation = Math.min(bookValue * rate, bookValue - salvageValue);
      bookValue -= depreciation;
      schedule.push({
        year,
        depreciation: Math.round(depreciation),
        accumulatedDepreciation: Math.round(assetCost - bookValue),
        bookValue: Math.round(bookValue),
      });
      if (bookValue <= salvageValue) break;
    }
    return schedule;
  }
}

/**
 * ROI Calculator Agent
 * Calculates Return on Investment
 */
export class ROICalculator extends EventEmitter implements AgentDefinition {
  id = 'roi-calculator';
  name = 'ROI Calculator';
  mode = 'financial-calculation' as const;
  capabilities = ['calculation', 'analysis'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[ROICalculator] Calculating ROI');

    const initialInvestment = (input.data.initialInvestment as number) || 0;
    const finalValue = (input.data.finalValue as number) || 0;
    const period = (input.data.period as number) || 1;

    const roi = initialInvestment > 0 ? ((finalValue - initialInvestment) / initialInvestment) * 100 : 0;
    const annualizedROI =
      initialInvestment > 0 && period > 0
        ? (Math.pow(finalValue / initialInvestment, 1 / period) - 1) * 100
        : 0;

    const headerRowsBeforeData = 3;
    const firstDataRow = headerRowsBeforeData + 1;

    const rows: CalcRow[] = [
      { label: 'Inputs', kind: 'subheader' },
      {
        label: 'Initial Investment',
        value: initialInvestment,
        format: { type: 'currency', decimals: 2 },
        name: 'InitialInvestment',
      },
      {
        label: 'Final Value',
        value: finalValue,
        format: { type: 'currency', decimals: 2 },
        name: 'FinalValue',
      },
      {
        label: 'Holding Period (Years)',
        value: period,
        format: { type: 'number', decimals: 2 },
        name: 'Period',
      },
      { label: 'Outputs', kind: 'subheader' },
    ];

    const initRow = firstDataRow + 1;
    const finalRow = initRow + 1;
    const periodRow = finalRow + 1;

    rows.push({
      label: 'Total Gain',
      formula: `=B${finalRow}-B${initRow}`,
      format: { type: 'currency', decimals: 2, negativeRed: true },
    });
    rows.push({
      label: 'Simple ROI',
      formula: `=IFERROR((B${finalRow}-B${initRow})/B${initRow},0)`,
      format: { type: 'percentage', decimals: 2 },
      kind: 'total',
    });
    rows.push({
      label: 'Annualised ROI (CAGR)',
      formula: `=IFERROR((B${finalRow}/B${initRow})^(1/B${periodRow})-1,0)`,
      format: { type: 'percentage', decimals: 2 },
      kind: 'total',
    });

    const sheet = buildCalcSheet({
      sheetName: 'ROI',
      title: 'Return on Investment',
      description: 'Simple and annualised (CAGR) ROI. Edit inputs to recalc.',
      rows,
    });
    const excelSpec = singleSheetWorkbook('ROI Analysis', sheet, 'Generated from ROI agent');

    return {
      success: true,
      data: {
        initialInvestment,
        finalValue,
        period,
        roi: Math.round(roi * 100) / 100,
        annualizedROI: Math.round(annualizedROI * 100) / 100,
        totalGain: finalValue - initialInvestment,
        timestamp: new Date().toISOString(),
        excelSpec,
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 1.0,
      },
    };
  }
}

/**
 * Break Even Analyzer Agent
 * Calculates break-even points
 */
export class BreakEvenAnalyzer extends EventEmitter implements AgentDefinition {
  id = 'break-even-analyzer';
  name = 'Break Even Analyzer';
  mode = 'financial-calculation' as const;
  capabilities = ['calculation', 'analysis'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[BreakEvenAnalyzer] Calculating break-even point');

    const fixedCosts = (input.data.fixedCosts as number) || 0;
    const variableCostPerUnit = (input.data.variableCostPerUnit as number) || 0;
    const pricePerUnit = (input.data.pricePerUnit as number) || 1;

    const contribMargin = pricePerUnit - variableCostPerUnit;
    const breakEvenUnits = contribMargin > 0 ? fixedCosts / contribMargin : 0;
    const breakEvenRevenue = breakEvenUnits * pricePerUnit;

    const headerRowsBeforeData = 3;
    const firstDataRow = headerRowsBeforeData + 1;

    const rows: CalcRow[] = [
      { label: 'Inputs', kind: 'subheader' },
      {
        label: 'Fixed Costs',
        value: fixedCosts,
        format: { type: 'currency', decimals: 2 },
        name: 'FixedCosts',
      },
      {
        label: 'Variable Cost / Unit',
        value: variableCostPerUnit,
        format: { type: 'currency', decimals: 2 },
        name: 'VariableCost',
      },
      {
        label: 'Price / Unit',
        value: pricePerUnit,
        format: { type: 'currency', decimals: 2 },
        name: 'Price',
      },
      { label: 'Outputs', kind: 'subheader' },
    ];

    const fcRow = firstDataRow + 1;
    const vcRow = fcRow + 1;
    const priceRow = vcRow + 1;

    rows.push({
      label: 'Contribution Margin / Unit',
      formula: `=B${priceRow}-B${vcRow}`,
      format: { type: 'currency', decimals: 2 },
    });
    rows.push({
      label: 'Contribution Margin Ratio',
      formula: `=IFERROR((B${priceRow}-B${vcRow})/B${priceRow},0)`,
      format: { type: 'percentage', decimals: 2 },
    });
    rows.push({
      label: 'Break-even Units',
      formula: `=IFERROR(B${fcRow}/(B${priceRow}-B${vcRow}),0)`,
      format: { type: 'number', decimals: 0 },
      kind: 'total',
    });
    rows.push({
      label: 'Break-even Revenue',
      formula: `=IFERROR(B${fcRow}/(B${priceRow}-B${vcRow})*B${priceRow},0)`,
      format: { type: 'currency', decimals: 2 },
      kind: 'total',
    });

    const sheet = buildCalcSheet({
      sheetName: 'Break-even',
      title: 'Break-even Analysis',
      description: 'Units and revenue required to cover fixed costs. Edit inputs to recalc.',
      rows,
    });
    const excelSpec = singleSheetWorkbook('Break-even Analysis', sheet, 'Generated from Break-even agent');

    return {
      success: true,
      data: {
        fixedCosts,
        variableCostPerUnit,
        pricePerUnit,
        contributionMargin: contribMargin,
        contributionMarginRatio: pricePerUnit > 0 ? (contribMargin / pricePerUnit) * 100 : 0,
        breakEvenUnits: Math.ceil(breakEvenUnits),
        breakEvenRevenue: Math.round(breakEvenRevenue),
        timestamp: new Date().toISOString(),
        excelSpec,
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 1.0,
      },
    };
  }
}

/**
 * Financial Ratio Calculator Agent
 * Wraps financialSolverService.calculateFinancialRatios and emits a
 * canonical ratios workbook (current, quick, D/E, ROE, ROA).
 */
export class FinancialRatioCalculator extends EventEmitter implements AgentDefinition {
  id = 'financial-ratio-calculator';
  name = 'Financial Ratio Calculator';
  mode = 'financial-calculation' as const;
  capabilities = ['calculation', 'ratio-analysis'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[FinancialRatioCalculator] Calculating ratios');

    const currentAssets = (input.data.currentAssets as number) || 0;
    const currentLiabilities = (input.data.currentLiabilities as number) || 0;
    const totalAssets = (input.data.totalAssets as number) || 0;
    const totalLiabilities = (input.data.totalLiabilities as number) || 0;
    const inventory = (input.data.inventory as number) || 0;
    const netIncome = (input.data.netIncome as number) || 0;
    const equity = (input.data.equity as number) || 0;

    // Import lazily to avoid circular imports at module load.
    const { financialSolverService } = await import('../financialSolvers');
    const ratios = financialSolverService.calculateFinancialRatios(
      currentAssets,
      currentLiabilities,
      totalAssets,
      totalLiabilities,
      inventory,
      netIncome,
      equity,
    );

    // Layout (description present → headers on row 3, data starts row 4):
    //   4  Inputs subheader
    //   5  Current Assets        (B5)
    //   6  Current Liabilities   (B6)
    //   7  Total Assets          (B7)
    //   8  Total Liabilities     (B8)
    //   9  Inventory             (B9)
    //   10 Net Income            (B10)
    //   11 Equity                (B11)
    //   12 Ratios subheader
    //   13 Current Ratio         (C13 = B5/B6)
    //   14 Quick Ratio           (C14 = (B5-B9)/B6)
    //   15 Debt-to-Equity        (C15 = B8/B11)
    //   16 Return on Equity      (C16 = B10/B11)
    //   17 Return on Assets      (C17 = B10/B7)
    const rows: CalcRow[] = [];
    rows.push({ label: 'Inputs', kind: 'subheader' });
    rows.push({ label: 'Current Assets', value: currentAssets, format: { type: 'currency', decimals: 0 } });
    rows.push({ label: 'Current Liabilities', value: currentLiabilities, format: { type: 'currency', decimals: 0 } });
    rows.push({ label: 'Total Assets', value: totalAssets, format: { type: 'currency', decimals: 0 } });
    rows.push({ label: 'Total Liabilities', value: totalLiabilities, format: { type: 'currency', decimals: 0 } });
    rows.push({ label: 'Inventory', value: inventory, format: { type: 'currency', decimals: 0 } });
    rows.push({ label: 'Net Income', value: netIncome, format: { type: 'currency', decimals: 0 } });
    rows.push({ label: 'Equity', value: equity, format: { type: 'currency', decimals: 0 } });

    rows.push({ label: 'Ratios', kind: 'subheader' });
    rows.push({
      label: 'Current Ratio',
      formula: '=IF(B6=0,0,B5/B6)',
      format: { type: 'number', decimals: 2 },
      kind: 'total',
      note: 'Liquidity: CA / CL',
    });
    rows.push({
      label: 'Quick Ratio',
      formula: '=IF(B6=0,0,(B5-B9)/B6)',
      format: { type: 'number', decimals: 2 },
      kind: 'total',
      note: 'Acid test: (CA - Inventory) / CL',
    });
    rows.push({
      label: 'Debt-to-Equity',
      formula: '=IF(B11=0,0,B8/B11)',
      format: { type: 'number', decimals: 2 },
      kind: 'total',
      note: 'Leverage: TL / Equity',
    });
    rows.push({
      label: 'Return on Equity (ROE)',
      formula: '=IF(B11=0,0,B10/B11)',
      format: { type: 'percentage', decimals: 2 },
      kind: 'total',
      note: 'Net Income / Equity',
    });
    rows.push({
      label: 'Return on Assets (ROA)',
      formula: '=IF(B7=0,0,B10/B7)',
      format: { type: 'percentage', decimals: 2 },
      kind: 'total',
      note: 'Net Income / Total Assets',
    });

    const sheet = buildCalcSheet({
      sheetName: 'Financial Ratios',
      title: 'Financial Ratio Analysis',
      description: 'Liquidity, leverage and profitability ratios',
      rows,
    });
    const excelSpec = singleSheetWorkbook(
      'Financial Ratios',
      sheet,
      'Generated from Financial Ratio Calculator agent',
    );

    return {
      success: true,
      data: {
        ...ratios,
        timestamp: new Date().toISOString(),
        excelSpec,
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 1.0,
      },
    };
  }
}

/**
 * Amortization Scheduler Agent
 * Wraps financialSolverService.calculateAmortization and emits a full
 * period-by-period amortization workbook with Excel PMT + running
 * balance formulas.
 */
export class AmortizationScheduler extends EventEmitter implements AgentDefinition {
  id = 'amortization-scheduler';
  name = 'Amortization Scheduler';
  mode = 'financial-calculation' as const;
  capabilities = ['calculation', 'loan-amortization'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[AmortizationScheduler] Building amortization schedule');

    const principal = (input.data.principal as number) || 0;
    const annualRate = (input.data.annualRate as number) || 0;
    const years = (input.data.years as number) || 0;
    const paymentsPerYear = (input.data.paymentsPerYear as number) || 12;

    const { financialSolverService } = await import('../financialSolvers');
    const result = financialSolverService.calculateAmortization(
      principal,
      annualRate,
      years,
      paymentsPerYear,
    );

    // Cap rendered schedule rows at 480 (40 years monthly) to keep
    // workbook size bounded; data payload retains the full schedule.
    const maxRows = 480;
    const schedule = result.schedule.slice(0, maxRows);
    const truncated = result.schedule.length > schedule.length;

    // Layout (description present → headers on row 3, data starts row 4):
    //   4  Inputs subheader
    //   5  Principal                (B5)
    //   6  Annual Rate              (B6)
    //   7  Years                    (B7)
    //   8  Payments / Year          (B8)
    //   9  Periodic Rate            (C9 = B6/B8)
    //   10 Total Payments           (C10 = B7*B8)
    //   11 Periodic Payment         (C11 = PMT(C9, C10, -B5))
    //   12 Schedule subheader
    //   Schedule header is encoded as a "data" row with only labels
    //   so the standard LABEL/VALUE/FORMULA/NOTES columns stay intact.
    const rows: CalcRow[] = [];
    rows.push({ label: 'Inputs', kind: 'subheader' });
    rows.push({ label: 'Principal', value: principal, format: { type: 'currency', decimals: 2 } });
    rows.push({ label: 'Annual Rate', value: annualRate, format: { type: 'percentage', decimals: 4 } });
    rows.push({ label: 'Years', value: years, format: { type: 'number', decimals: 0 } });
    rows.push({ label: 'Payments / Year', value: paymentsPerYear, format: { type: 'number', decimals: 0 } });
    rows.push({
      label: 'Periodic Rate',
      formula: '=IF(B8=0,0,B6/B8)',
      format: { type: 'percentage', decimals: 6 },
      note: 'Annual rate / payments per year',
    });
    rows.push({
      label: 'Total Payments',
      formula: '=B7*B8',
      format: { type: 'number', decimals: 0 },
    });
    rows.push({
      label: 'Periodic Payment',
      formula: '=IF(OR(C9=0,C10=0),0,PMT(C9,C10,-B5))',
      format: { type: 'currency', decimals: 2 },
      kind: 'total',
      note: 'Level payment per period',
    });

    rows.push({ label: `Schedule (${schedule.length} periods${truncated ? ' — truncated' : ''})`, kind: 'subheader' });
    rows.push({
      label: 'Period | Payment | Principal | Interest | Balance',
      note: 'Values are pre-computed; balance runs down to zero',
    });

    for (const entry of schedule) {
      rows.push({
        label: `Period ${entry.period}`,
        value: entry.payment,
        format: { type: 'currency', decimals: 2 },
        note: `Principal ${entry.principal.toFixed(2)} | Interest ${entry.interest.toFixed(2)} | Balance ${entry.balance.toFixed(2)}`,
      });
    }

    const sheet = buildCalcSheet({
      sheetName: 'Amortization',
      title: 'Loan Amortization Schedule',
      description: `${years}y @ ${(annualRate * 100).toFixed(2)}% with ${paymentsPerYear} payments/year`,
      rows,
    });
    const excelSpec = singleSheetWorkbook(
      'Amortization Schedule',
      sheet,
      'Generated from Amortization Scheduler agent',
    );

    return {
      success: true,
      data: {
        principal,
        annualRate,
        years,
        paymentsPerYear,
        payment: result.payment,
        schedule: result.schedule,
        totalInterest: result.schedule.reduce((s, p) => s + p.interest, 0),
        timestamp: new Date().toISOString(),
        excelSpec,
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 1.0,
      },
    };
  }
}

// Export all agents
export const financialCalculationAgents: AgentDefinition[] = [
  new NPVCalculator(),
  new TaxLiabilityCalculator(),
  new DepreciationScheduler(),
  new ROICalculator(),
  new BreakEvenAnalyzer(),
  new FinancialRatioCalculator(),
  new AmortizationScheduler(),
];
