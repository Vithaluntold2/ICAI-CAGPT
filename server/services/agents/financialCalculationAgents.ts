/**
 * Financial Calculation Mode Agents
 * Specialized agents for tax calculations, NPV, IRR, depreciation, and financial modeling
 */

import { EventEmitter } from 'events';
import type { AgentDefinition, AgentInput, AgentOutput } from '@shared/types/agentTypes';

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

    // Calculate NPV
    const npv = this.calculateNPV(cashFlows, discountRate, initialInvestment);

    // Calculate IRR for additional insight
    const irr = this.calculateIRR([...cashFlows], initialInvestment);

    return {
      success: true,
      data: {
        npv,
        irr,
        discountRate,
        initialInvestment,
        cashFlows,
        recommendation: npv > 0 ? 'Accept project' : 'Reject project',
        breakEvenYear: this.findBreakEvenYear(cashFlows, initialInvestment),
        timestamp: new Date().toISOString(),
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
    // Newton-Raphson method for IRR calculation
    let irr = 0.1; // Initial guess
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
        return Math.round(newIrr * 10000) / 100; // Return as percentage
      }

      irr = newIrr;
    }

    return Math.round(irr * 10000) / 100;
  }

  private findBreakEvenYear(cashFlows: number[], initialInvestment: number): number {
    let cumulative = -initialInvestment;

    for (let i = 0; i < cashFlows.length; i++) {
      cumulative += cashFlows[i];
      if (cumulative >= 0) {
        return i + 1;
      }
    }

    return -1; // No break-even within period
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

    return {
      success: true,
      data: taxCalculation,
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 0.95,
      },
    };
  }

  private calculateTax(income: number, jurisdiction: string, regime: string, deductions: number) {
    if (jurisdiction === 'India') {
      return this.calculateIndianTax(income, regime, deductions);
    }

    return {
      error: 'Jurisdiction not supported',
      income,
      jurisdiction,
    };
  }

  private calculateIndianTax(income: number, regime: string, deductions: number) {
    const taxableIncome = regime === 'old' ? income - deductions : income;

    let tax = 0;

    if (regime === 'old') {
      // Old regime slabs (2024-25)
      if (taxableIncome <= 250000) tax = 0;
      else if (taxableIncome <= 500000) tax = (taxableIncome - 250000) * 0.05;
      else if (taxableIncome <= 1000000) tax = 12500 + (taxableIncome - 500000) * 0.2;
      else tax = 112500 + (taxableIncome - 1000000) * 0.3;
    } else {
      // New regime slabs (2024-25)
      if (taxableIncome <= 300000) tax = 0;
      else if (taxableIncome <= 600000) tax = (taxableIncome - 300000) * 0.05;
      else if (taxableIncome <= 900000) tax = 15000 + (taxableIncome - 600000) * 0.1;
      else if (taxableIncome <= 1200000) tax = 45000 + (taxableIncome - 900000) * 0.15;
      else if (taxableIncome <= 1500000) tax = 90000 + (taxableIncome - 1200000) * 0.2;
      else tax = 150000 + (taxableIncome - 1500000) * 0.3;
    }

    // Add cess (4%)
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
      effectiveRate: Math.round((totalTax / income) * 10000) / 100,
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
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 1.0,
      },
    };
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
    const rate = 2 / usefulLife; // Double declining balance
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
    const period = (input.data.period as number) || 1; // in years

    const roi = ((finalValue - initialInvestment) / initialInvestment) * 100;
    const annualizedROI = (Math.pow(finalValue / initialInvestment, 1 / period) - 1) * 100;

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

    const breakEvenUnits = fixedCosts / (pricePerUnit - variableCostPerUnit);
    const breakEvenRevenue = breakEvenUnits * pricePerUnit;

    return {
      success: true,
      data: {
        fixedCosts,
        variableCostPerUnit,
        pricePerUnit,
        contributionMargin: pricePerUnit - variableCostPerUnit,
        contributionMarginRatio: ((pricePerUnit - variableCostPerUnit) / pricePerUnit) * 100,
        breakEvenUnits: Math.ceil(breakEvenUnits),
        breakEvenRevenue: Math.round(breakEvenRevenue),
        timestamp: new Date().toISOString(),
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
];
