import { db } from "../db";
import { scenarioRuns, scenarioMetrics, scenarioComparisons, scenarioVariants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { aiOrchestrator } from "./aiOrchestrator";
import { agentRegistry } from "./core/agentRegistry";

/**
 * ScenarioSolver - Runs financial simulations for tax and audit scenarios
 * 
 * This service performs sophisticated tax calculations comparing different entity structures,
 * deduction strategies, and jurisdictions to help CPAs advise clients on optimal tax positions.
 * Now with integrated 12-agent scenario simulation pipeline.
 */
export class ScenarioSolver {
  
  /**
   * Get the sequence of agents for scenario simulation
   */
  static getAgentSequence(): string[] {
    return [
      'scenario-designer',
      'assumption-validator', 
      'tax-impact-modeler',
      'financial-projector',
      'regulatory-simulator',
      'what-if-analyzer',
      'sensitivity-analyzer',
      'monte-carlo-simulator',
      'scenario-comparator',
      'risk-modeler',
      'outcome-predictor',
      'recommendation-synthesizer'
    ];
  }

  /**
   * Run agent-based comprehensive scenario simulation
   * Executes all 12 scenario agents in sequence with real AI
   */
  static async runAgentSimulation(
    config: {
      baseCase: any;
      variables: string[];
      scenarios?: any[];
      context?: string;
      jurisdiction?: string;
    },
    progressCallback?: (agentId: string, status: 'started' | 'completed', output?: any) => void
  ) {
    const startTime = Date.now();
    const agentSequence = this.getAgentSequence();
    const agentOutputs: Record<string, any> = {};
    
    console.log('[ScenarioSolver] Starting agent-based simulation with', agentSequence.length, 'agents');

    for (const agentId of agentSequence) {
      const agent = agentRegistry.get(agentId);
      if (!agent) {
        console.warn(`[ScenarioSolver] Agent ${agentId} not found, skipping`);
        continue;
      }

      progressCallback?.(agentId, 'started');

      try {
        // Build input based on agent requirements
        const input = this.buildAgentInput(agentId, config, agentOutputs);
        
        const output = await agent.execute(input);
        agentOutputs[agentId] = output;
        
        progressCallback?.(agentId, 'completed', output);
        console.log(`[ScenarioSolver] Agent ${agentId} completed:`, output.success);
      } catch (error) {
        console.error(`[ScenarioSolver] Agent ${agentId} failed:`, error);
        agentOutputs[agentId] = {
          success: false,
          data: { error: error instanceof Error ? error.message : 'Unknown error' },
          metadata: { agentId, executionTime: 0, confidence: 0 }
        };
        progressCallback?.(agentId, 'completed', agentOutputs[agentId]);
      }
    }

    const totalTime = Date.now() - startTime;

    return {
      success: true,
      agentOutputs,
      summary: this.buildSimulationSummary(agentOutputs),
      processingTimeMs: totalTime,
      agentsExecuted: Object.keys(agentOutputs).length
    };
  }

  /**
   * Build input for each agent based on its requirements
   */
  private static buildAgentInput(
    agentId: string, 
    config: any, 
    previousOutputs: Record<string, any>
  ): any {
    const baseInput = {
      timestamp: Date.now(),
      previousOutputs,
      data: {} as any
    };

    switch (agentId) {
      case 'scenario-designer':
        baseInput.data = {
          baseCase: config.baseCase,
          variables: config.variables || ['income', 'deductions', 'growthRate'],
          context: config.context || ''
        };
        break;

      case 'assumption-validator':
        const assumptions = Object.entries(config.baseCase || {}).map(([name, value]) => ({
          name, value, unit: typeof value === 'number' ? 'currency' : 'text'
        }));
        baseInput.data = { assumptions, context: config.context };
        break;

      case 'tax-impact-modeler':
        baseInput.data = {
          scenarios: previousOutputs['scenario-designer']?.data?.scenarios || [{ id: 'base', parameters: config.baseCase }],
          jurisdiction: config.jurisdiction || config.baseCase?.jurisdiction || 'california',
          entityType: config.baseCase?.entityType || 'llc'
        };
        break;

      case 'financial-projector':
        baseInput.data = {
          scenario: previousOutputs['scenario-designer']?.data?.scenarios?.[0] || { parameters: config.baseCase },
          years: 5,
          industry: config.industry || 'general'
        };
        break;

      case 'regulatory-simulator':
        baseInput.data = {
          currentRegime: config.jurisdiction || 'standard',
          proposedChanges: config.regulatoryChanges || [
            { id: 'change1', name: 'Tax Rate Adjustment', mandatory: true, complexity: 1.5 }
          ],
          jurisdiction: config.jurisdiction
        };
        break;

      case 'what-if-analyzer':
        baseInput.data = {
          baseScenario: { parameters: config.baseCase, outcome: config.baseCase?.income || 100000 },
          variations: (config.variables || ['income', 'deductions']).map((v: string) => ({
            variable: v,
            values: [
              (config.baseCase?.[v] || 100000) * 0.8,
              (config.baseCase?.[v] || 100000) * 0.9,
              (config.baseCase?.[v] || 100000) * 1.1,
              (config.baseCase?.[v] || 100000) * 1.2
            ]
          }))
        };
        break;

      case 'sensitivity-analyzer':
        baseInput.data = {
          model: config.baseCase || { revenue: 1000000, costs: 700000, taxRate: 0.3 },
          variables: config.variables || ['revenue', 'costs', 'taxRate']
        };
        break;

      case 'monte-carlo-simulator':
        baseInput.data = {
          model: config.baseCase || { revenue: 1000000, costs: 700000 },
          iterations: 1000,
          variables: [
            { name: 'revenue', mean: config.baseCase?.income || 1000000, stdDev: 100000 },
            { name: 'costs', mean: config.baseCase?.deductions || 300000, stdDev: 50000 }
          ]
        };
        break;

      case 'scenario-comparator':
        baseInput.data = {
          scenarios: previousOutputs['scenario-designer']?.data?.scenarios || [config.baseCase],
          criteria: ['revenue', 'risk', 'growth']
        };
        break;

      case 'risk-modeler':
        baseInput.data = {
          scenarios: previousOutputs['scenario-designer']?.data?.scenarios || [config.baseCase],
          confidenceLevel: 95
        };
        break;

      case 'outcome-predictor':
        baseInput.data = {
          scenario: previousOutputs['scenario-designer']?.data?.scenarios?.[0] || { parameters: config.baseCase },
          historicalData: [],
          horizon: '1 year'
        };
        break;

      case 'recommendation-synthesizer':
        baseInput.data = {
          analyses: Object.values(previousOutputs).filter(o => o?.success),
          previousOutputs,
          context: config.context || 'Tax strategy optimization'
        };
        break;

      default:
        baseInput.data = config;
    }

    return baseInput;
  }

  /**
   * Build a summary from all agent outputs
   */
  private static buildSimulationSummary(agentOutputs: Record<string, any>) {
    return {
      scenariosDesigned: agentOutputs['scenario-designer']?.data?.count || 0,
      assumptionsValid: agentOutputs['assumption-validator']?.data?.allValid ?? true,
      optimalScenario: agentOutputs['tax-impact-modeler']?.data?.optimalScenario?.scenarioId || 'baseline',
      projectedCAGR: agentOutputs['financial-projector']?.data?.cagr || 0,
      riskLevel: agentOutputs['risk-modeler']?.data?.aiInsights?.overallRiskLevel || 'medium',
      recommendations: agentOutputs['recommendation-synthesizer']?.data?.recommendations || [],
      executiveSummary: agentOutputs['recommendation-synthesizer']?.data?.executiveSummary || 'Analysis complete.'
    };
  }

  /**
   * Run a complete simulation comparing baseline scenario against variants
   */
  static async runSimulation(playbook: any, variantIds: string[], userId?: string) {
    const startTime = Date.now();
    
    try {
      // First, get or create a baseline variant for this playbook
      let baselineVariant = await db
        .select()
        .from(scenarioVariants)
        .where(eq(scenarioVariants.playbookId, playbook.id))
        .then(rows => rows.find(r => r.isBaseline));
      
      if (!baselineVariant) {
        // Create baseline variant if it doesn't exist
        [baselineVariant] = await db.insert(scenarioVariants).values({
          playbookId: playbook.id,
          name: 'Baseline',
          description: 'Original scenario configuration',
          isBaseline: true,
          assumptions: playbook.baselineConfig || {}
        }).returning();
      }
      
      // Create a run record for the baseline using correct schema (variantId + userId)
      const effectiveUserId = userId || playbook.userId;
      const [baselineRun] = await db.insert(scenarioRuns).values({
        variantId: baselineVariant.id,
        userId: effectiveUserId,
        status: 'running',
        solversUsed: ['tax-calculator', 'qbi-calculator', 'audit-risk-scorer'],
        modelUsed: 'gpt-4o',
        providerUsed: 'azure-openai'
      }).returning();
      
      // Calculate baseline metrics
      const baselineMetrics = await this.calculateTaxMetrics(playbook.baselineConfig);
      
      // Store baseline metrics (linked to baseline run)
      await db.insert(scenarioMetrics).values({
        runId: baselineRun.id,
        metricKey: 'tax_liability',
        metricCategory: 'tax',
        currencyValue: Math.round(baselineMetrics.taxLiability * 100)
      });
      
      await db.insert(scenarioMetrics).values({
        runId: baselineRun.id,
        metricKey: 'effective_tax_rate',
        metricCategory: 'tax',
        percentageValue: Math.round(baselineMetrics.effectiveTaxRate * 100)
      });
      
      await db.insert(scenarioMetrics).values({
        runId: baselineRun.id,
        metricKey: 'qbi_deduction',
        metricCategory: 'tax',
        currencyValue: Math.round(baselineMetrics.qbiDeduction * 100)
      });
      
      await db.insert(scenarioMetrics).values({
        runId: baselineRun.id,
        metricKey: 'audit_risk_score',
        metricCategory: 'risk',
        numericValue: Math.round(baselineMetrics.auditRiskScore)
      });
      
      // Mark baseline run as completed
      const baselineProcessingTime = Date.now() - startTime;
      await db.update(scenarioRuns)
        .set({ 
          status: 'completed',
          completedAt: new Date(),
          processingTimeMs: baselineProcessingTime,
          resultsSnapshot: baselineMetrics
        })
        .where(eq(scenarioRuns.id, baselineRun.id));
      
      // Calculate each variant
      const variantResults = [];
      
      if (variantIds.length > 0) {
        const variants = await db
          .select()
          .from(scenarioVariants)
          .where(eq(scenarioVariants.playbookId, playbook.id));
        
        for (const variant of variants) {
          if (variantIds.includes(variant.id) && !variant.isBaseline) {
            const variantStartTime = Date.now();
            
            // Create a run record for this variant
            const [variantRun] = await db.insert(scenarioRuns).values({
              variantId: variant.id,
              userId: effectiveUserId,
              status: 'running',
              solversUsed: ['tax-calculator', 'qbi-calculator', 'audit-risk-scorer'],
              modelUsed: 'gpt-4o',
              providerUsed: 'azure-openai'
            }).returning();
            
            const variantMetrics = await this.calculateTaxMetrics({
              ...playbook.baselineConfig,
              ...(variant.assumptions as any)
            });
            
            // Store variant metrics (linked to variant run)
            await db.insert(scenarioMetrics).values({
              runId: variantRun.id,
              metricKey: 'tax_liability',
              metricCategory: 'tax',
              currencyValue: Math.round(variantMetrics.taxLiability * 100)
            });
            
            await db.insert(scenarioMetrics).values({
              runId: variantRun.id,
              metricKey: 'effective_tax_rate',
              metricCategory: 'tax',
              percentageValue: Math.round(variantMetrics.effectiveTaxRate * 100)
            });
            
            await db.insert(scenarioMetrics).values({
              runId: variantRun.id,
              metricKey: 'qbi_deduction',
              metricCategory: 'tax',
              currencyValue: Math.round(variantMetrics.qbiDeduction * 100)
            });
            
            await db.insert(scenarioMetrics).values({
              runId: variantRun.id,
              metricKey: 'audit_risk_score',
              metricCategory: 'risk',
              numericValue: Math.round(variantMetrics.auditRiskScore)
            });
            
            // Mark variant run as completed
            const variantProcessingTime = Date.now() - variantStartTime;
            await db.update(scenarioRuns)
              .set({ 
                status: 'completed',
                completedAt: new Date(),
                processingTimeMs: variantProcessingTime,
                resultsSnapshot: variantMetrics
              })
              .where(eq(scenarioRuns.id, variantRun.id));
            
            // Create comparison with AI-powered advisory insights
            const savings = baselineMetrics.taxLiability - variantMetrics.taxLiability;
            
            // Generate CPA-level advisory insights using AI
            const aiAdvisory = await this.generateAdvisoryInsights({
              baseline: baselineMetrics,
              variant: variantMetrics,
              variantName: variant.name,
              config: { ...playbook.baselineConfig, ...(variant.assumptions as any) },
              savings
            });
            
            // Create scenarioComparisons record (baseline vs variant)
            await db.insert(scenarioComparisons).values({
              playbookId: playbook.id,
              userId: effectiveUserId,
              leftRunId: baselineRun.id,
              rightRunId: variantRun.id,
              comparisonSnapshot: {
                baselineMetrics,
                variantMetrics,
                savings,
                savingsPercentage: baselineMetrics.taxLiability > 0 
                  ? ((savings / baselineMetrics.taxLiability) * 100).toFixed(2) + '%'
                  : '0%',
                aiAdvisory,
                comparedAt: new Date().toISOString()
              },
              title: `${variant.name} vs Baseline`,
              notes: aiAdvisory
            });
            
            variantResults.push({
              variant,
              metrics: variantMetrics,
              savings,
              aiAdvisory,
              runId: variantRun.id
            });
          }
        }
      }
      
      const totalProcessingTime = Date.now() - startTime;
      
      return {
        runId: baselineRun.id,
        baseline: baselineMetrics,
        baselineRunId: baselineRun.id,
        variants: variantResults,
        processingTimeMs: totalProcessingTime
      };
    } catch (error) {
      console.error('[ScenarioSolver] Simulation failed:', error);
      throw error;
    }
  }
  
  /**
   * Calculate tax metrics for a given scenario configuration
   */
  private static async calculateTaxMetrics(config: any) {
    const { 
      jurisdiction, 
      entityType, 
      taxYear, 
      homeOfficeMethod 
    } = config;
    
    // Normalize: frontend sends 'income', solver expects 'grossIncome'
    const grossIncome = config.grossIncome || config.income || 0;
    
    // Normalize: frontend sends 'deductionStrategy', solver expects numeric 'deductions'
    let deductions = config.deductions || 0;
    if (!deductions && config.deductionStrategy) {
      // Convert strategy to approximate deduction amount
      const strategies: Record<string, number> = {
        'standard': 14600,
        'itemized': Math.round(grossIncome * 0.25),
        'qbi': Math.round(grossIncome * 0.20),
        'home_office_actual': 14600 + 5000,
        'home_office_simplified': 14600 + 1500
      };
      deductions = strategies[config.deductionStrategy] || 14600;
    }
    
    // Base federal tax calculation
    let taxableIncome = grossIncome - deductions;
    
    // QBI Deduction (20% for pass-through entities)
    let qbiDeduction = 0;
    if (['llc', 's-corp', 'partnership'].includes(entityType.toLowerCase())) {
      qbiDeduction = Math.min(taxableIncome * 0.20, 50000); // Simplified
    }
    
    taxableIncome -= qbiDeduction;
    
    // Federal tax brackets (2024 simplified)
    let federalTax = 0;
    if (taxableIncome <= 11600) {
      federalTax = taxableIncome * 0.10;
    } else if (taxableIncome <= 47150) {
      federalTax = 1160 + (taxableIncome - 11600) * 0.12;
    } else if (taxableIncome <= 100525) {
      federalTax = 5426 + (taxableIncome - 47150) * 0.22;
    } else if (taxableIncome <= 191950) {
      federalTax = 17168.50 + (taxableIncome - 100525) * 0.24;
    } else if (taxableIncome <= 243725) {
      federalTax = 39110.50 + (taxableIncome - 191950) * 0.32;
    } else if (taxableIncome <= 609350) {
      federalTax = 55678.50 + (taxableIncome - 243725) * 0.35;
    } else {
      federalTax = 183647.25 + (taxableIncome - 609350) * 0.37;
    }
    
    // State tax (simplified by jurisdiction)
    const stateTaxRates: Record<string, number> = {
      'california': 0.093,
      'delaware': 0.066,
      'texas': 0,
      'new-york': 0.0685,
      'florida': 0
    };
    
    const stateTax = taxableIncome * (stateTaxRates[jurisdiction.toLowerCase()] || 0);
    
    // Self-employment tax for certain entities
    let selfEmploymentTax = 0;
    if (['llc', 'sole-proprietorship'].includes(entityType.toLowerCase())) {
      selfEmploymentTax = grossIncome * 0.1413; // 14.13% simplified
    }
    
    const totalTax = federalTax + stateTax + selfEmploymentTax;
    const effectiveTaxRate = (totalTax / grossIncome) * 100;
    
    // Audit risk scoring (simplified heuristic)
    let auditRiskScore = 0;
    
    // Higher deduction percentage increases risk
    const deductionPercentage = (deductions / grossIncome) * 100;
    if (deductionPercentage > 50) auditRiskScore += 30;
    else if (deductionPercentage > 30) auditRiskScore += 15;
    
    // Home office deduction adds risk
    if (homeOfficeMethod === 'actual') auditRiskScore += 20;
    else if (homeOfficeMethod === 'simplified') auditRiskScore += 10;
    
    // High QBI deduction adds scrutiny
    if (qbiDeduction > 30000) auditRiskScore += 15;
    
    // Entity type risk factors
    if (entityType.toLowerCase() === 's-corp') auditRiskScore += 10; // IRS watches S-corp salary distributions
    if (entityType.toLowerCase() === 'c-corp') auditRiskScore += 5;
    
    return {
      taxLiability: Math.round(totalTax),
      effectiveTaxRate: Math.round(effectiveTaxRate * 100) / 100,
      qbiDeduction: Math.round(qbiDeduction),
      auditRiskScore: Math.min(auditRiskScore, 100) // Cap at 100
    };
  }
  
  /**
   * Generate CPA-level advisory insights using AI
   * This elevates CA GPT from a tax calculator to a strategic advisory platform
   */
  private static async generateAdvisoryInsights(evidencePack: {
    baseline: any;
    variant: any;
    variantName: string;
    config: any;
    savings: number;
  }) {
    const { baseline, variant, variantName, config, savings } = evidencePack;
    
    const prompt = `You are a seasoned CPA/CA advising a client on tax strategy optimization. Analyze this tax scenario comparison and provide strategic advisory insights.

**Scenario Comparison:**
- Variant: ${variantName}
- Annual Tax Savings: $${savings.toLocaleString()} (${savings > 0 ? 'favorable' : 'unfavorable'})
- Entity Type: ${config.entityType}
- Jurisdiction: ${config.jurisdiction}
- Tax Year: ${config.taxYear}
- Gross Income: $${config.grossIncome?.toLocaleString() || 'N/A'}

**Baseline Metrics:**
- Tax Liability: $${baseline.taxLiability.toLocaleString()}
- Effective Tax Rate: ${baseline.effectiveTaxRate}%
- QBI Deduction: $${baseline.qbiDeduction.toLocaleString()}
- Audit Risk Score: ${baseline.auditRiskScore}/100

**${variantName} Metrics:**
- Tax Liability: $${variant.taxLiability.toLocaleString()}
- Effective Tax Rate: ${variant.effectiveTaxRate}%
- QBI Deduction: $${variant.qbiDeduction.toLocaleString()}
- Audit Risk Score: ${variant.auditRiskScore}/100

Provide a concise CPA-level advisory recommendation (max 3-4 sentences) that includes:
1. Strategic assessment of the variant vs baseline
2. Jurisdiction-specific considerations for ${config.jurisdiction}
3. Risk/benefit tradeoff analysis
4. One actionable next step or documentation requirement

Focus on professional accounting advisory value, not just number recitation.`;

    try {
      const response = await aiOrchestrator.processQuery(
        prompt,
        [],
        'premium'
      );
      
      return response.response;
    } catch (error) {
      console.error('[ScenarioSolver] AI advisory generation failed:', error);
      // Fallback to basic recommendation if AI fails
      return savings > 0 
        ? `${variantName} provides $${savings.toLocaleString()} in annual tax savings compared to baseline. Consider implementing this strategy for ${config.taxYear} and consult with a tax professional for jurisdiction-specific compliance in ${config.jurisdiction}.`
        : `Baseline strategy remains more favorable by $${Math.abs(savings).toLocaleString()}. Current structure is optimized for ${config.jurisdiction} tax regulations.`;
    }
  }
}
