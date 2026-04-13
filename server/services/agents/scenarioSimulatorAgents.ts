/**
 * Scenario Simulator Mode Agents (Tracks 12-13)
 * 12 specialized agents for regulatory scenario modeling and simulation
 * Now with AI integration for intelligent analysis
 */

import { EventEmitter } from 'events';
import type { AgentDefinition, AgentInput, AgentOutput } from '@shared/types/agentTypes';
import { aiProviderRegistry } from '../aiProviders/registry';
import { AIProviderName } from '../aiProviders/types';

// Provider-specific model mapping (same as roundtable agents)
const PROVIDER_MODELS: Partial<Record<AIProviderName, string>> = {
  [AIProviderName.AZURE_OPENAI]: 'gpt-4o',
  [AIProviderName.OPENAI]: 'gpt-4o',
  [AIProviderName.CLAUDE]: 'claude-3-5-sonnet-20241022',
  [AIProviderName.GEMINI]: 'gemini-1.5-pro',
};

// Helper function to get AI-generated response with retry logic
async function getAIResponse(
  systemPrompt: string, 
  userPrompt: string, 
  maxTokens: number = 1000
): Promise<string> {
  const providerOrder = [
    AIProviderName.AZURE_OPENAI,
    AIProviderName.OPENAI,
    AIProviderName.CLAUDE,
    AIProviderName.GEMINI,
  ];
  
  const errors: string[] = [];
  
  for (const providerName of providerOrder) {
    try {
      const provider = aiProviderRegistry.getProvider(providerName);
      if (!provider) continue;
      
      const model = PROVIDER_MODELS[providerName] || 'gpt-4o';
      const response = await provider.generateCompletion({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens,
        temperature: 0.7,
      });
      return response.content;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${providerName}: ${errMsg}`);
      console.warn(`[ScenarioAgents] Provider ${providerName} failed, trying next:`, errMsg);
    }
  }
  
  console.error('[ScenarioAgents] All AI providers failed:', errors);
  return `Analysis pending: ${userPrompt.substring(0, 100)}...`;
}

/**
 * Scenario Designer Agent
 * Designs comprehensive scenario parameters with AI-powered insights
 */
export class ScenarioDesigner extends EventEmitter implements AgentDefinition {
  id = 'scenario-designer';
  name = 'Scenario Designer';
  mode = 'scenario-simulator' as const;
  capabilities = ['scenario-design', 'parameter-definition'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[ScenarioDesigner] Designing scenario');

    const baseCase = input.data.baseCase as any;
    const variables = input.data.variables as string[];
    const context = input.data.context as string || '';

    try {
      // Use AI to generate intelligent scenario designs
      const systemPrompt = `You are a financial scenario design expert. Create realistic optimistic, pessimistic, and most likely scenarios based on the base case provided. Consider market conditions, regulatory environments, and business factors.`;
      
      const userPrompt = `Design scenarios for this base case:
${JSON.stringify(baseCase, null, 2)}

Variables to adjust: ${variables.join(', ')}
Context: ${context}

Return a JSON object with this structure:
{
  "scenarios": [
    {"id": "base", "name": "Base Case", "type": "baseline", "adjustments": {}, "rationale": "..."},
    {"id": "optimistic", "name": "Optimistic", "type": "optimistic", "adjustments": {...}, "rationale": "..."},
    {"id": "pessimistic", "name": "Pessimistic", "type": "pessimistic", "adjustments": {...}, "rationale": "..."},
    {"id": "likely", "name": "Most Likely", "type": "likely", "adjustments": {...}, "rationale": "..."}
  ]
}`;

      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 1500);
      
      // Try to parse AI response
      let scenarios;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          scenarios = parsed.scenarios || this.designScenariosFallback(baseCase, variables);
        } else {
          scenarios = this.designScenariosFallback(baseCase, variables);
        }
      } catch {
        scenarios = this.designScenariosFallback(baseCase, variables);
      }

      return {
        success: true,
        data: {
          scenarios,
          count: scenarios.length,
          baseCase,
          aiGenerated: true,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.9,
        },
      };
    } catch (error) {
      console.error('[ScenarioDesigner] Error:', error);
      const scenarios = this.designScenariosFallback(baseCase, variables);
      
      return {
        success: true,
        data: {
          scenarios,
          count: scenarios.length,
          baseCase,
          aiGenerated: false,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.7,
        },
      };
    }
  }

  private designScenariosFallback(baseCase: any, variables: string[]) {
    return [
      {
        id: 'base',
        name: 'Base Case',
        description: 'Current scenario with no changes',
        parameters: { ...baseCase },
        type: 'baseline',
        rationale: 'Starting point for comparison'
      },
      {
        id: 'optimistic',
        name: 'Optimistic Scenario',
        description: 'Best case with favorable conditions',
        parameters: this.adjustParameters(baseCase, variables, 1.2),
        type: 'optimistic',
        rationale: 'Assumes favorable market conditions and execution'
      },
      {
        id: 'pessimistic',
        name: 'Pessimistic Scenario',
        description: 'Worst case with unfavorable conditions',
        parameters: this.adjustParameters(baseCase, variables, 0.8),
        type: 'pessimistic',
        rationale: 'Accounts for potential headwinds and risks'
      },
      {
        id: 'likely',
        name: 'Most Likely Scenario',
        description: 'Realistic scenario based on trends',
        parameters: this.adjustParameters(baseCase, variables, 1.05),
        type: 'likely',
        rationale: 'Based on historical trends and current trajectory'
      },
    ];
  }

  private adjustParameters(baseCase: any, variables: string[], multiplier: number) {
    const adjusted = { ...baseCase };
    
    for (const variable of variables) {
      if (typeof baseCase[variable] === 'number') {
        adjusted[variable] = Math.round(baseCase[variable] * multiplier);
      }
    }

    return adjusted;
  }
}

/**
 * Assumption Validator Agent
 * Validates scenario assumptions for reasonableness with AI-powered analysis
 */
export class AssumptionValidator extends EventEmitter implements AgentDefinition {
  id = 'assumption-validator';
  name = 'Assumption Validator';
  mode = 'scenario-simulator' as const;
  capabilities = ['validation', 'reasonableness-check'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[AssumptionValidator] Validating assumptions');

    const assumptions = input.data.assumptions as Array<{ name: string; value: any; unit?: string }>;
    const context = input.data.context as string || '';
    
    try {
      const systemPrompt = `You are a financial modeling expert who validates assumptions for reasonableness. Analyze each assumption considering industry benchmarks, economic conditions, and logical consistency.`;
      
      const userPrompt = `Validate these financial assumptions:
${JSON.stringify(assumptions, null, 2)}

Context: ${context}

For each assumption, assess:
1. Is the value reasonable for the industry/context?
2. Are there any red flags or concerns?
3. What's the confidence level (high/medium/low)?

Return JSON:
{
  "validations": [
    {"assumption": "name", "valid": true/false, "confidence": "high/medium/low", "concerns": [], "recommendation": "..."}
  ],
  "overallAssessment": "...",
  "criticalIssues": []
}`;

      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 1000);
      
      let validations;
      let overallAssessment = '';
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          validations = parsed.validations || this.validateAssumptionsFallback(assumptions);
          overallAssessment = parsed.overallAssessment || '';
        } else {
          validations = this.validateAssumptionsFallback(assumptions);
        }
      } catch {
        validations = this.validateAssumptionsFallback(assumptions);
      }

      const allValid = validations.every((v: any) => v.valid !== false);

      return {
        success: allValid,
        data: {
          validations,
          allValid,
          overallAssessment,
          warningCount: validations.filter((v: any) => v.concerns && v.concerns.length > 0).length,
          aiGenerated: true,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.85,
        },
      };
    } catch (error) {
      console.error('[AssumptionValidator] Error:', error);
      const validations = this.validateAssumptionsFallback(assumptions);
      const allValid = validations.every(v => v.valid);

      return {
        success: allValid,
        data: {
          validations,
          allValid,
          warningCount: validations.filter(v => v.warnings && v.warnings.length > 0).length,
          aiGenerated: false,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.7,
        },
      };
    }
  }

  private validateAssumptionsFallback(assumptions: Array<{ name: string; value: any; unit?: string }>) {
    return assumptions.map(assumption => this.validateAssumption(assumption));
  }

  private validateAssumption(assumption: { name: string; value: any; unit?: string }) {
    const warnings: string[] = [];
    let valid = true;

    if (typeof assumption.value === 'number') {
      if (assumption.value < 0 && !assumption.name.toLowerCase().includes('loss')) {
        warnings.push('Negative value detected');
      }

      if (assumption.name.toLowerCase().includes('rate') && (assumption.value > 1 || assumption.value < 0)) {
        warnings.push('Rate should be between 0 and 1');
        valid = false;
      }

      if (assumption.name.toLowerCase().includes('growth') && Math.abs(assumption.value) > 0.5) {
        warnings.push('Growth rate seems unusually high');
      }
    }

    return {
      assumption: assumption.name,
      value: assumption.value,
      valid,
      warnings,
      reasonableness: warnings.length === 0 ? 'reasonable' : 'questionable',
    };
  }
}

/**
 * Tax Impact Modeler Agent
 * Models tax implications across scenarios with AI-powered insights
 */
export class TaxImpactModeler extends EventEmitter implements AgentDefinition {
  id = 'tax-impact-modeler';
  name = 'Tax Impact Modeler';
  mode = 'scenario-simulator' as const;
  capabilities = ['tax-modeling', 'impact-analysis'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[TaxImpactModeler] Modeling tax impact');

    const scenarios = input.data.scenarios as any[];
    const jurisdiction = (input.data.jurisdiction as string) || 'India';
    const entityType = input.data.entityType as string || '';

    try {
      // Calculate base impacts first
      const impacts = scenarios.map(scenario => 
        this.modelTaxImpact(scenario, jurisdiction)
      );

      // Get AI-powered strategic insights
      const systemPrompt = `You are a tax strategy expert. Analyze tax scenarios and provide strategic optimization recommendations considering jurisdiction-specific regulations, entity structures, and timing strategies.`;
      
      const userPrompt = `Analyze these tax scenarios for ${jurisdiction}:
${JSON.stringify(impacts, null, 2)}

Entity Type: ${entityType}

Provide:
1. Optimal scenario recommendation with rationale
2. Tax optimization opportunities
3. Compliance considerations
4. Risk factors

Return JSON:
{
  "optimalScenario": "scenario_id",
  "rationale": "...",
  "optimizations": ["..."],
  "complianceNotes": ["..."],
  "riskFactors": ["..."]
}`;

      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 1000);
      
      let aiInsights = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiInsights = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Use fallback
      }

      return {
        success: true,
        data: {
          impacts,
          jurisdiction,
          optimalScenario: this.identifyOptimalScenario(impacts),
          aiInsights,
          aiGenerated: true,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.88,
        },
      };
    } catch (error) {
      console.error('[TaxImpactModeler] Error:', error);
      const impacts = scenarios.map(scenario => 
        this.modelTaxImpact(scenario, jurisdiction)
      );

      return {
        success: true,
        data: {
          impacts,
          jurisdiction,
          optimalScenario: this.identifyOptimalScenario(impacts),
          aiGenerated: false,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.75,
        },
      };
    }
  }

  private modelTaxImpact(scenario: any, jurisdiction: string) {
    const income = scenario.parameters?.income || scenario.income || 0;
    const deductions = scenario.parameters?.deductions || scenario.deductions || 0;
    
    const taxableIncome = Math.max(0, income - deductions);
    const taxRate = this.getTaxRate(taxableIncome, jurisdiction);
    const taxLiability = taxableIncome * taxRate;

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      income,
      deductions,
      taxableIncome,
      effectiveRate: Math.round(taxRate * 10000) / 100,
      taxLiability: Math.round(taxLiability),
      afterTaxIncome: Math.round(income - taxLiability),
    };
  }

  private getTaxRate(income: number, jurisdiction: string): number {
    const jurisdictionLower = jurisdiction.toLowerCase();
    
    // US jurisdictions
    if (jurisdictionLower === 'california') {
      if (income <= 50000) return 0.22;
      if (income <= 150000) return 0.28;
      return 0.35;
    }
    if (['texas', 'florida', 'nevada'].includes(jurisdictionLower)) {
      if (income <= 50000) return 0.15;
      if (income <= 150000) return 0.22;
      return 0.30;
    }
    if (jurisdictionLower === 'new-york' || jurisdictionLower === 'new york') {
      if (income <= 50000) return 0.24;
      if (income <= 150000) return 0.30;
      return 0.38;
    }
    
    // India
    if (jurisdictionLower === 'india') {
      if (income <= 500000) return 0.05;
      if (income <= 1000000) return 0.2;
      return 0.3;
    }
    
    // Default
    if (income <= 50000) return 0.20;
    if (income <= 150000) return 0.25;
    return 0.30;
  }

  private identifyOptimalScenario(impacts: any[]) {
    if (impacts.length === 0) return null;
    return impacts.reduce((best, current) => 
      current.afterTaxIncome > best.afterTaxIncome ? current : best
    , impacts[0]);
  }
}

/**
 * Financial Projector Agent
 * Projects financial outcomes across scenarios with AI-powered forecasting
 */
export class FinancialProjector extends EventEmitter implements AgentDefinition {
  id = 'financial-projector';
  name = 'Financial Projector';
  mode = 'scenario-simulator' as const;
  capabilities = ['financial-projection', 'forecasting'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[FinancialProjector] Projecting financials');

    const scenario = input.data.scenario as any;
    const years = (input.data.years as number) || 5;
    const industry = input.data.industry as string || '';

    try {
      const projections = this.projectFinancials(scenario, years);
      const cagr = this.calculateCAGR(projections);

      // Get AI-powered forecast insights
      const systemPrompt = `You are a financial forecasting expert. Analyze projections and provide insights on growth sustainability, risk factors, and strategic recommendations.`;
      
      const userPrompt = `Analyze these financial projections:
${JSON.stringify(projections, null, 2)}

CAGR: ${cagr}%
Industry: ${industry}

Provide:
1. Growth sustainability assessment
2. Key assumptions to monitor
3. Potential headwinds/tailwinds
4. Strategic recommendations

Return JSON:
{
  "sustainability": "high/medium/low",
  "keyAssumptions": ["..."],
  "headwinds": ["..."],
  "tailwinds": ["..."],
  "recommendations": ["..."]
}`;

      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 800);
      
      let aiInsights = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiInsights = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Use fallback
      }

      return {
        success: true,
        data: {
          projections,
          years,
          cagr,
          aiInsights,
          aiGenerated: true,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.8,
        },
      };
    } catch (error) {
      console.error('[FinancialProjector] Error:', error);
      const projections = this.projectFinancials(scenario, years);

      return {
        success: true,
        data: {
          projections,
          years,
          cagr: this.calculateCAGR(projections),
          aiGenerated: false,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.7,
        },
      };
    }
  }

  private projectFinancials(scenario: any, years: number) {
    const growthRate = scenario.parameters?.growthRate || scenario.growthRate || 0.1;
    const baseRevenue = scenario.parameters?.revenue || scenario.revenue || 1000000;
    const expenseRatio = scenario.parameters?.expenseRatio || 0.7;

    const projections = [];
    for (let year = 1; year <= years; year++) {
      const revenue = baseRevenue * Math.pow(1 + growthRate, year);
      const expenses = revenue * expenseRatio;
      const profit = revenue - expenses;

      projections.push({
        year,
        revenue: Math.round(revenue),
        expenses: Math.round(expenses),
        profit: Math.round(profit),
        profitMargin: Math.round((profit / revenue) * 100),
      });
    }

    return projections;
  }

  private calculateCAGR(projections: any[]): number {
    if (projections.length < 2) return 0;

    const first = projections[0].revenue;
    const last = projections[projections.length - 1].revenue;
    const years = projections.length;

    if (first <= 0) return 0;
    return Math.round((Math.pow(last / first, 1 / years) - 1) * 10000) / 100;
  }
}

/**
 * Regulatory Simulator Agent
 * Simulates regulatory changes and their impact with AI-powered analysis
 */
export class RegulatorySimulator extends EventEmitter implements AgentDefinition {
  id = 'regulatory-simulator';
  name = 'Regulatory Simulator';
  mode = 'scenario-simulator' as const;
  capabilities = ['regulatory-simulation', 'compliance-modeling'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[RegulatorySimulator] Simulating regulatory changes');

    const currentRegime = input.data.currentRegime as string;
    const proposedChanges = input.data.proposedChanges as any[];
    const jurisdiction = input.data.jurisdiction as string || '';

    try {
      const simulations = proposedChanges.map(change => 
        this.simulateChange(currentRegime, change)
      );

      // Get AI-powered regulatory insights
      const systemPrompt = `You are a regulatory compliance expert. Analyze proposed regulatory changes and assess their impact on business operations, compliance requirements, and strategic positioning.`;
      
      const userPrompt = `Analyze these regulatory changes for ${jurisdiction}:
Current Regime: ${currentRegime}
Proposed Changes:
${JSON.stringify(proposedChanges, null, 2)}

Simulation Results:
${JSON.stringify(simulations, null, 2)}

Provide:
1. Overall regulatory risk assessment
2. Priority actions for compliance
3. Timeline considerations
4. Strategic recommendations

Return JSON:
{
  "riskLevel": "high/medium/low",
  "priorityActions": ["..."],
  "timelineNotes": "...",
  "recommendations": ["..."],
  "complianceCost": "estimated range"
}`;

      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 1000);
      
      let aiInsights = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiInsights = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Use fallback
      }

      return {
        success: true,
        data: {
          simulations,
          impactedAreas: this.identifyImpactedAreas(simulations),
          aiInsights,
          aiGenerated: true,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.85,
        },
      };
    } catch (error) {
      console.error('[RegulatorySimulator] Error:', error);
      const simulations = proposedChanges.map(change => 
        this.simulateChange(currentRegime, change)
      );

      return {
        success: true,
        data: {
          simulations,
          impactedAreas: this.identifyImpactedAreas(simulations),
          aiGenerated: false,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.75,
        },
      };
    }
  }

  private simulateChange(currentRegime: string, change: any) {
    return {
      changeId: change.id,
      changeName: change.name,
      currentState: currentRegime,
      proposedState: change.proposedValue,
      impactLevel: this.assessImpact(change),
      affectedEntities: change.scope || 'all',
      estimatedCost: this.estimateComplianceCost(change),
      timeline: change.effectiveDate || 'TBD',
    };
  }

  private assessImpact(change: any): 'high' | 'medium' | 'low' {
    if (change.mandatory && change.penaltyAmount > 100000) return 'high';
    if (change.mandatory) return 'medium';
    return 'low';
  }

  private estimateComplianceCost(change: any): number {
    const baseCost = 50000;
    const multiplier = change.complexity || 1;
    return Math.round(baseCost * multiplier);
  }

  private identifyImpactedAreas(simulations: any[]): string[] {
    const areas = new Set<string>();
    simulations.forEach(sim => {
      if (sim.affectedEntities !== 'all') {
        areas.add(sim.affectedEntities);
      }
    });
    return Array.from(areas);
  }
}

/**
 * What-If Analyzer Agent
 * Analyzes "what-if" scenarios with AI-powered insights
 */
export class WhatIfAnalyzer extends EventEmitter implements AgentDefinition {
  id = 'what-if-analyzer';
  name = 'What-If Analyzer';
  mode = 'scenario-simulator' as const;
  capabilities = ['what-if-analysis', 'scenario-comparison'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[WhatIfAnalyzer] Analyzing what-if scenarios');

    const baseScenario = input.data.baseScenario as any;
    const variations = input.data.variations as Array<{ variable: string; values: number[] }>;

    try {
      const analyses = variations.map(variation => 
        this.analyzeVariation(baseScenario, variation)
      );
      
      const mostSensitive = this.findMostSensitive(analyses);

      // Get AI-powered what-if insights
      const systemPrompt = `You are a scenario analysis expert. Analyze what-if variations and provide strategic insights on which variables matter most and what actions to take.`;
      
      const userPrompt = `Analyze these what-if scenarios:
Base Scenario: ${JSON.stringify(baseScenario, null, 2)}

Variation Analyses:
${JSON.stringify(analyses, null, 2)}

Most Sensitive Variable: ${mostSensitive?.variable}

Provide:
1. Key insights from the variations
2. Recommended focus areas
3. Risk mitigation strategies
4. Optimization opportunities

Return JSON:
{
  "keyInsights": ["..."],
  "focusAreas": ["..."],
  "riskMitigation": ["..."],
  "optimizations": ["..."]
}`;

      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 800);
      
      let aiInsights = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiInsights = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Use fallback
      }

      return {
        success: true,
        data: {
          analyses,
          mostSensitiveVariable: mostSensitive,
          aiInsights,
          aiGenerated: true,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.9,
        },
      };
    } catch (error) {
      console.error('[WhatIfAnalyzer] Error:', error);
      const analyses = variations.map(variation => 
        this.analyzeVariation(baseScenario, variation)
      );

      return {
        success: true,
        data: {
          analyses,
          mostSensitiveVariable: this.findMostSensitive(analyses),
          aiGenerated: false,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.8,
        },
      };
    }
  }

  private analyzeVariation(baseScenario: any, variation: { variable: string; values: number[] }) {
    const baseValue = baseScenario.parameters?.[variation.variable] || baseScenario[variation.variable] || 0;
    const baseOutcome = baseScenario.outcome || baseScenario.parameters?.outcome || 0;

    const results = variation.values.map(value => {
      const percentChange = baseValue !== 0 ? ((value - baseValue) / baseValue) * 100 : 0;
      const estimatedOutcome = baseOutcome * (1 + percentChange / 100);

      return {
        value,
        percentChange: Math.round(percentChange * 100) / 100,
        estimatedOutcome: Math.round(estimatedOutcome),
        impactOnOutcome: baseOutcome !== 0 
          ? Math.round(((estimatedOutcome - baseOutcome) / baseOutcome) * 10000) / 100
          : 0,
      };
    });

    return {
      variable: variation.variable,
      baseValue,
      results,
      sensitivity: this.calculateSensitivity(results),
    };
  }

  private calculateSensitivity(results: any[]): number {
    if (results.length < 2) return 0;
    
    const impacts = results.map(r => Math.abs(r.impactOnOutcome));
    return Math.max(...impacts);
  }

  private findMostSensitive(analyses: any[]) {
    if (analyses.length === 0) return null;
    return analyses.reduce((most, current) => 
      current.sensitivity > most.sensitivity ? current : most
    , analyses[0]);
  }
}

/**
 * Sensitivity Analyzer Agent
 * Performs sensitivity analysis on key variables with AI insights
 */
export class SensitivityAnalyzer extends EventEmitter implements AgentDefinition {
  id = 'sensitivity-analyzer';
  name = 'Sensitivity Analyzer';
  mode = 'scenario-simulator' as const;
  capabilities = ['sensitivity-analysis', 'variance-analysis'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[SensitivityAnalyzer] Performing sensitivity analysis');

    const model = input.data.model as any;
    const variables = input.data.variables as string[];

    try {
      const sensitivities = variables.map(variable => 
        this.analyzeSensitivity(model, variable)
      );

      const rankedByImpact = [...sensitivities].sort((a, b) => b.impact - a.impact);

      // Get AI-powered sensitivity insights
      const systemPrompt = `You are a financial modeling expert specializing in sensitivity analysis. Analyze variable sensitivities and provide actionable insights for risk management and optimization.`;
      
      const userPrompt = `Analyze this sensitivity analysis:
Model: ${JSON.stringify(model, null, 2)}

Sensitivities (ranked by impact):
${JSON.stringify(rankedByImpact, null, 2)}

Provide:
1. Critical variables to monitor
2. Risk management recommendations
3. Optimization opportunities
4. Model robustness assessment

Return JSON:
{
  "criticalVariables": ["..."],
  "riskManagement": ["..."],
  "optimizations": ["..."],
  "robustness": "high/medium/low",
  "robustnessExplanation": "..."
}`;

      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 800);
      
      let aiInsights = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiInsights = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Use fallback
      }

      return {
        success: true,
        data: {
          sensitivities,
          rankedByImpact,
          aiInsights,
          aiGenerated: true,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.9,
        },
      };
    } catch (error) {
      console.error('[SensitivityAnalyzer] Error:', error);
      const sensitivities = variables.map(variable => 
        this.analyzeSensitivity(model, variable)
      );

      return {
        success: true,
        data: {
          sensitivities,
          rankedByImpact: sensitivities.sort((a, b) => b.impact - a.impact),
          aiGenerated: false,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.8,
        },
      };
    }
  }

  private analyzeSensitivity(model: any, variable: string) {
    const baseValue = model[variable] || 0;
    const delta = baseValue * 0.1 || 1; // 10% change or 1 if zero

    const baseOutcome = this.evaluateModel(model);
    const upOutcome = this.evaluateModel({ ...model, [variable]: baseValue + delta });
    const downOutcome = this.evaluateModel({ ...model, [variable]: baseValue - delta });

    const impact = delta !== 0 ? Math.abs(upOutcome - downOutcome) / (2 * delta) : 0;

    return {
      variable,
      baseValue,
      impact: Math.round(impact * 100) / 100,
      elasticity: baseOutcome !== 0 ? Math.round((impact / baseOutcome) * 10000) / 100 : 0,
      upside: Math.round(upOutcome - baseOutcome),
      downside: Math.round(downOutcome - baseOutcome),
    };
  }

  private evaluateModel(model: any): number {
    const revenue = model.revenue || 0;
    const costs = model.costs || 0;
    const taxRate = model.taxRate || 0.3;

    return (revenue - costs) * (1 - taxRate);
  }
}

/**
 * Monte Carlo Simulator Agent
 * Runs Monte Carlo simulations for probabilistic outcomes with AI interpretation
 */
export class MonteCarloSimulator extends EventEmitter implements AgentDefinition {
  id = 'monte-carlo-simulator';
  name = 'Monte Carlo Simulator';
  mode = 'scenario-simulator' as const;
  capabilities = ['monte-carlo', 'probabilistic-simulation'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[MonteCarloSimulator] Running Monte Carlo simulation');

    const model = input.data.model as any;
    const iterations = (input.data.iterations as number) || 1000;
    const variables = input.data.variables as Array<{ name: string; mean: number; stdDev: number }>;

    try {
      const results = this.runSimulation(model, variables, iterations);

      // Get AI-powered Monte Carlo interpretation
      const systemPrompt = `You are a quantitative finance expert specializing in Monte Carlo analysis. Interpret simulation results and provide actionable insights for decision-making under uncertainty.`;
      
      const userPrompt = `Interpret this Monte Carlo simulation:
Iterations: ${iterations}
Results:
${JSON.stringify(results, null, 2)}

Provide:
1. Risk assessment based on distribution
2. Probability of key outcomes
3. Recommendations for risk management
4. Confidence level in projections

Return JSON:
{
  "riskAssessment": "...",
  "keyProbabilities": {"profit": "X%", "loss": "Y%"},
  "recommendations": ["..."],
  "confidenceLevel": "high/medium/low",
  "interpretation": "..."
}`;

      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 800);
      
      let aiInsights = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiInsights = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Use fallback
      }

      return {
        success: true,
        data: {
          results,
          iterations,
          aiInsights,
          aiGenerated: true,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.95,
        },
      };
    } catch (error) {
      console.error('[MonteCarloSimulator] Error:', error);
      const results = this.runSimulation(model, variables, iterations);

      return {
        success: true,
        data: {
          results,
          iterations,
          aiGenerated: false,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0.9,
        },
      };
    }
  }

  private runSimulation(model: any, variables: any[], iterations: number) {
    const outcomes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const scenario = { ...model };
      
      for (const variable of variables) {
        scenario[variable.name] = this.normalRandom(variable.mean, variable.stdDev);
      }

      const outcome = this.evaluateScenario(scenario);
      outcomes.push(outcome);
    }

    outcomes.sort((a, b) => a - b);

    return {
      mean: Math.round(this.mean(outcomes)),
      median: Math.round(this.median(outcomes)),
      stdDev: Math.round(this.stdDev(outcomes)),
      min: Math.round(Math.min(...outcomes)),
      max: Math.round(Math.max(...outcomes)),
      percentile5: Math.round(this.percentile(outcomes, 5)),
      percentile25: Math.round(this.percentile(outcomes, 25)),
      percentile75: Math.round(this.percentile(outcomes, 75)),
      percentile95: Math.round(this.percentile(outcomes, 95)),
      distribution: this.createHistogram(outcomes),
    };
  }

  private normalRandom(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  private evaluateScenario(scenario: any): number {
    const revenue = scenario.revenue || 0;
    const costs = scenario.costs || 0;
    return revenue - costs;
  }

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private median(sortedValues: number[]): number {
    if (sortedValues.length === 0) return 0;
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
  }

  private stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private createHistogram(values: number[], bins: number = 10) {
    if (values.length === 0) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binSize = max !== min ? (max - min) / bins : 1;

    const histogram = Array(bins).fill(0);
    for (const value of values) {
      const binIndex = Math.min(Math.floor((value - min) / binSize), bins - 1);
      histogram[binIndex]++;
    }

    return histogram.map((count, i) => ({
      range: `${Math.round(min + i * binSize)}-${Math.round(min + (i + 1) * binSize)}`,
      count,
      probability: Math.round((count / Math.max(values.length, 1)) * 10000) / 100,
    }));
  }
}

/**
 * Scenario Comparator Agent
 * Compares and ranks scenarios with AI-powered analysis
 */
export class ScenarioComparator extends EventEmitter implements AgentDefinition {
  id = 'scenario-comparator';
  name = 'Scenario Comparator';
  mode = 'scenario-simulator' as const;
  capabilities = ['comparison', 'ranking'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[ScenarioComparator] Comparing scenarios');
    
    const scenarios = input.data.scenarios as any[];
    const criteria = input.data.criteria as string[] || [];
    
    if (scenarios.length === 0) {
      return {
        success: true,
        data: { comparison: [], aiGenerated: false, timestamp: new Date().toISOString() },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.5 },
      };
    }

    try {
      // Calculate scores for each scenario
      const comparison = scenarios.map((s, i) => {
        const score = this.calculateScenarioScore(s);
        return { id: s.id || `scenario_${i + 1}`, name: s.name, score, details: s };
      });
      
      comparison.sort((a, b) => b.score - a.score);
      comparison.forEach((item, index) => {
        (item as any).rank = index + 1;
      });

      // Get AI-powered comparison insights
      const systemPrompt = `You are a strategic decision-making expert. Analyze scenario comparisons and provide insights on the optimal choice and tradeoffs between alternatives.`;
      
      const userPrompt = `Compare these scenarios:
${JSON.stringify(comparison, null, 2)}

Evaluation Criteria: ${criteria.length > 0 ? criteria.join(', ') : 'revenue, cost efficiency, risk, growth'}

Provide:
1. Recommended scenario with justification
2. Key tradeoffs between top scenarios
3. Scenario-specific considerations
4. Decision framework

Return JSON:
{
  "recommended": "scenario_id",
  "justification": "...",
  "tradeoffs": ["..."],
  "considerations": {"scenario_id": "..."},
  "decisionFramework": "..."
}`;

      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 1000);
      
      let aiInsights = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiInsights = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Use fallback
      }

      return {
        success: true,
        data: { 
          comparison, 
          winner: comparison[0],
          aiInsights,
          aiGenerated: true,
          timestamp: new Date().toISOString() 
        },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
      };
    } catch (error) {
      console.error('[ScenarioComparator] Error:', error);
      const comparison = scenarios.map((s, i) => {
        const score = this.calculateScenarioScore(s);
        return { id: s.id || `scenario_${i + 1}`, score };
      });
      
      comparison.sort((a, b) => b.score - a.score);
      comparison.forEach((item, index) => {
        (item as any).rank = index + 1;
      });

      return {
        success: true,
        data: { comparison, aiGenerated: false, timestamp: new Date().toISOString() },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.8 },
      };
    }
  }

  private calculateScenarioScore(scenario: any): number {
    let score = 0.5;

    const revenue = scenario.revenue || scenario.parameters?.revenue || 0;
    score += Math.min(revenue / 1000000, 0.2);

    const costs = scenario.costs || scenario.parameters?.costs || 0;
    const efficiency = revenue > 0 ? (revenue - costs) / revenue : 0;
    score += Math.max(0, efficiency * 0.15);

    const risk = scenario.risk || scenario.riskLevel || 'medium';
    const riskScores: Record<string, number> = { 'low': 0.1, 'medium': 0.05, 'high': 0 };
    score += riskScores[risk] || 0.05;

    const growth = scenario.growth || scenario.growthRate || 0;
    score += Math.min(growth * 0.1, 0.1);

    return Math.min(score, 1.0);
  }
}

/**
 * Risk Modeler Agent
 * Models risk metrics with AI-powered analysis
 */
export class RiskModeler extends EventEmitter implements AgentDefinition {
  id = 'risk-modeler';
  name = 'Risk Modeler';
  mode = 'scenario-simulator' as const;
  capabilities = ['risk-modeling', 'var-calculation'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[RiskModeler] Modeling risk metrics');
    
    const scenarios = input.data.scenarios as any[];
    const confidenceLevel = (input.data.confidenceLevel as number) || 95;

    try {
      // Calculate risk metrics
      const varMetrics = this.calculateVaR(scenarios, confidenceLevel);

      // Get AI-powered risk insights
      const systemPrompt = `You are a risk management expert. Analyze Value at Risk and other risk metrics to provide actionable insights for portfolio and business risk management.`;
      
      const userPrompt = `Analyze these risk metrics:
VaR Metrics:
${JSON.stringify(varMetrics, null, 2)}

Scenarios Analyzed: ${scenarios.length}
Confidence Level: ${confidenceLevel}%

Provide:
1. Risk assessment summary
2. Key risk drivers
3. Mitigation recommendations
4. Stress testing suggestions

Return JSON:
{
  "riskSummary": "...",
  "riskDrivers": ["..."],
  "mitigations": ["..."],
  "stressTests": ["..."],
  "overallRiskLevel": "high/medium/low"
}`;

      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 800);
      
      let aiInsights = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiInsights = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Use fallback
      }

      return {
        success: true,
        data: { 
          varMetrics, 
          scenarios: scenarios.length,
          aiInsights,
          aiGenerated: true,
          timestamp: new Date().toISOString()
        },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.85 },
      };
    } catch (error) {
      console.error('[RiskModeler] Error:', error);
      const varMetrics = this.calculateVaR(scenarios, confidenceLevel);

      return {
        success: true,
        data: { varMetrics, scenarios: scenarios.length, aiGenerated: false, timestamp: new Date().toISOString() },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.75 },
      };
    }
  }

  private calculateVaR(scenarios: any[], confidenceLevel: number) {
    if (scenarios.length === 0) {
      return { var95: 0, var99: 0, cvar95: 0, maxDrawdown: 0 };
    }

    // Extract outcomes from scenarios
    const outcomes = scenarios.map(s => {
      const revenue = s.revenue || s.parameters?.revenue || 0;
      const costs = s.costs || s.parameters?.costs || 0;
      return revenue - costs;
    }).sort((a, b) => a - b);

    const percentile = (arr: number[], p: number) => {
      if (arr.length === 0) return 0;
      const idx = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, idx)];
    };

    const mean = outcomes.length > 0 
      ? outcomes.reduce((a, b) => a + b, 0) / outcomes.length 
      : 0;

    // VaR as potential loss from mean
    const var95 = Math.abs(mean - percentile(outcomes, 5));
    const var99 = Math.abs(mean - percentile(outcomes, 1));
    
    // CVaR (Expected Shortfall) - average of losses beyond VaR
    const tailIndex = Math.floor(outcomes.length * 0.05);
    const tailValues = outcomes.slice(0, Math.max(tailIndex, 1));
    const cvar95 = tailValues.length > 0 
      ? Math.abs(mean - (tailValues.reduce((a, b) => a + b, 0) / tailValues.length))
      : 0;

    // Max drawdown
    const maxDrawdown = Math.abs(Math.min(...outcomes) - Math.max(...outcomes));

    return {
      var95: Math.round(var95),
      var99: Math.round(var99),
      cvar95: Math.round(cvar95),
      maxDrawdown: Math.round(maxDrawdown),
    };
  }
}

/**
 * Outcome Predictor Agent
 * Predicts outcomes with AI-powered forecasting
 */
export class OutcomePredictor extends EventEmitter implements AgentDefinition {
  id = 'outcome-predictor';
  name = 'Outcome Predictor';
  mode = 'scenario-simulator' as const;
  capabilities = ['prediction', 'forecasting'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[OutcomePredictor] Predicting outcomes');
    
    const scenario = input.data.scenario as any;
    const historicalData = input.data.historicalData as any[] || [];
    const horizon = input.data.horizon as string || '1 year';

    try {
      // Calculate base prediction
      const prediction = this.calculatePrediction(scenario, historicalData);

      // Get AI-powered prediction insights
      const systemPrompt = `You are a predictive analytics expert. Analyze scenario data and provide forecasts with confidence intervals and key drivers of uncertainty.`;
      
      const userPrompt = `Generate predictions for this scenario:
${JSON.stringify(scenario, null, 2)}

Historical Data Points: ${historicalData.length}
Forecast Horizon: ${horizon}

Base Prediction:
${JSON.stringify(prediction, null, 2)}

Provide:
1. Enhanced prediction with AI insights
2. Key uncertainty factors
3. Confidence level assessment
4. Recommendations for improving forecast accuracy

Return JSON:
{
  "enhancedPrediction": {
    "expectedValue": number,
    "confidenceInterval": [low, high],
    "probability": number
  },
  "uncertaintyFactors": ["..."],
  "confidenceLevel": "high/medium/low",
  "accuracyRecommendations": ["..."]
}`;

      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 800);
      
      let aiInsights: any = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiInsights = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Use fallback
      }

      // Use AI-enhanced prediction if available
      const finalPrediction = aiInsights.enhancedPrediction || prediction;

      return {
        success: true,
        data: { 
          prediction: finalPrediction, 
          scenario: scenario.id,
          aiInsights,
          aiGenerated: true,
          timestamp: new Date().toISOString()
        },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.8 },
      };
    } catch (error) {
      console.error('[OutcomePredictor] Error:', error);
      const prediction = this.calculatePrediction(scenario, historicalData);

      return {
        success: true,
        data: { prediction, scenario: scenario.id, aiGenerated: false, timestamp: new Date().toISOString() },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.7 },
      };
    }
  }

  private calculatePrediction(scenario: any, historicalData: any[]) {
    const revenue = scenario.revenue || scenario.parameters?.revenue || 1000000;
    const growthRate = scenario.growthRate || scenario.parameters?.growthRate || 0.1;
    
    const expectedValue = Math.round(revenue * (1 + growthRate));
    const variance = expectedValue * 0.2; // 20% variance estimate

    return {
      expectedValue,
      confidenceInterval: [Math.round(expectedValue - variance), Math.round(expectedValue + variance)],
      probability: 0.75,
    };
  }
}

/**
 * Recommendation Synthesizer Agent
 * Synthesizes recommendations from all analyses with AI-powered insights
 */
export class RecommendationSynthesizer extends EventEmitter implements AgentDefinition {
  id = 'recommendation-synthesizer';
  name = 'Recommendation Synthesizer';
  mode = 'scenario-simulator' as const;
  capabilities = ['synthesis', 'recommendation'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[RecommendationSynthesizer] Synthesizing recommendations');
    
    const analyses = input.data.analyses as any[];
    // Get previous outputs from data or from previousAgentOutputs array
    const previousOutputs = input.data.previousOutputs || 
      (input.previousAgentOutputs?.reduce((acc: any, out: any) => {
        if (out.agentId) acc[out.agentId] = out;
        return acc;
      }, {}) || {});
    const context = input.data.context as string || '';

    try {
      // Collect insights from previous agents
      const agentInsights = Object.entries(previousOutputs).map(([agentId, output]: [string, any]) => ({
        agent: agentId,
        insights: output?.data?.aiInsights || output?.data || {},
        success: output?.success
      }));

      // Get AI-powered synthesis
      const systemPrompt = `You are a strategic advisory expert. Synthesize insights from multiple financial analyses to provide clear, actionable recommendations prioritized by impact and feasibility.`;
      
      const userPrompt = `Synthesize recommendations from these analyses:
${JSON.stringify(agentInsights, null, 2)}

Direct Analyses Provided:
${JSON.stringify(analyses, null, 2)}

Context: ${context}

Provide:
1. Executive summary (2-3 sentences)
2. Top 3-5 prioritized recommendations
3. Implementation roadmap
4. Risk considerations
5. Success metrics

Return JSON:
{
  "executiveSummary": "...",
  "recommendations": [
    {"priority": 1, "action": "...", "impact": "high/medium/low", "effort": "high/medium/low", "timeline": "..."}
  ],
  "roadmap": ["Phase 1: ...", "Phase 2: ..."],
  "risks": ["..."],
  "successMetrics": ["..."]
}`;

      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 1500);
      
      let aiSynthesis: any = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiSynthesis = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Use fallback
      }

      // Extract recommendations
      const recommendations = aiSynthesis.recommendations?.map((r: any) => r.action) || this.generateFallbackRecommendations(analyses, previousOutputs);

      return {
        success: true,
        data: { 
          recommendations, 
          executiveSummary: aiSynthesis.executiveSummary || 'Analysis complete. Review recommendations for next steps.',
          roadmap: aiSynthesis.roadmap || [],
          risks: aiSynthesis.risks || [],
          successMetrics: aiSynthesis.successMetrics || [],
          fullSynthesis: aiSynthesis,
          basedOn: analyses.length + Object.keys(previousOutputs).length,
          aiGenerated: true,
          timestamp: new Date().toISOString()
        },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
      };
    } catch (error) {
      console.error('[RecommendationSynthesizer] Error:', error);
      const recommendations = this.generateFallbackRecommendations(analyses, previousOutputs);

      return {
        success: true,
        data: { 
          recommendations, 
          basedOn: analyses.length,
          aiGenerated: false,
          timestamp: new Date().toISOString()
        },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.75 },
      };
    }
  }

  private generateFallbackRecommendations(analyses: any[], previousOutputs: any) {
    const recommendations = [
      'Review scenario comparison results and select optimal strategy',
      'Implement risk mitigation measures for identified vulnerabilities',
      'Monitor key sensitivity variables identified in the analysis',
      'Schedule quarterly review of assumptions and projections',
      'Consult with tax/legal advisors for jurisdiction-specific guidance'
    ];

    // Add context-specific recommendations if available
    if (previousOutputs['tax-impact-modeler']?.data?.optimalScenario) {
      recommendations.unshift(`Consider implementing ${previousOutputs['tax-impact-modeler'].data.optimalScenario.scenarioName} for optimal tax efficiency`);
    }

    return recommendations.slice(0, 5);
  }
}

// Export all scenario simulator agents
export const scenarioSimulatorAgents: AgentDefinition[] = [
  new ScenarioDesigner(),
  new AssumptionValidator(),
  new TaxImpactModeler(),
  new FinancialProjector(),
  new RegulatorySimulator(),
  new WhatIfAnalyzer(),
  new SensitivityAnalyzer(),
  new MonteCarloSimulator(),
  new ScenarioComparator(),
  new RiskModeler(),
  new OutcomePredictor(),
  new RecommendationSynthesizer(),
];
