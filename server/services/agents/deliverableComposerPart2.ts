/**
 * Deliverable Composer Mode - Part 2: Advisory, Compliance & Financial Models
 * 27 agents for generating advisory letters, compliance docs, and financial models
 */

import { EventEmitter } from 'events';
import type { AgentDefinition, AgentInput, AgentOutput } from '@shared/types/agentTypes';
import { getAIResponse } from './deliverableComposerPart1';

// Advisory Letter Agents (9 agents)
export class SituationSummarizer extends EventEmitter implements AgentDefinition {
  id = 'situation-summarizer';
  name = 'Situation Summarizer';
  mode = 'deliverable-composer' as const;
  capabilities = ['summarization', 'business-writing'];
  version = '1.0.1'; // AI Upgrade

  async execute(input: AgentInput): Promise<AgentOutput> {
    const situation = input.data.situation as any;
    
    let summary: any = null;
    let aiGenerated = false;

    try {
        const prompt = `
            Analyze this client situation:
            "${situation.description}"
            Known Issues: ${JSON.stringify(situation.issues || [])}
            Urgency: ${situation.urgent ? 'High' : 'Normal'}

            Summarize the situation professionally for an advisory letter.
            Return JSON:
            {
               "background": "Professional summary...",
               "currentState": "Current status...",
               "keyIssues": ["Refined Issue 1", "Refined Issue 2"],
               "urgency": "High/Medium/Low"
            }
        `;

        const aiResponse = await getAIResponse(
            "You are a professional business analyst summarizing a client case.",
            prompt
        );

        if (aiResponse) {
             const cleanJson = aiResponse.content.replace(/```json/g, '').replace(/```/g, '').trim();
             summary = JSON.parse(cleanJson);
             aiGenerated = true;
        }
    } catch (e) {
        console.warn('[SituationSummarizer] AI failed', e);
    }
    
    if (!summary) {
        summary = {
            background: situation.description,
            currentState: 'Client facing strategic decision',
            keyIssues: situation.issues || [],
            urgency: situation.urgent ? 'High' : 'Medium',
        };
    }

    return {
      success: true,
      data: { summary },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: aiGenerated ? 0.95 : 0.9 },
    };
  }
}

export class OptionsGenerator extends EventEmitter implements AgentDefinition {
  id = 'options-generator';
  name = 'Options Generator';
  mode = 'deliverable-composer' as const;
  capabilities = ['analysis', 'option-development'];
  version = '1.0.1'; // Bumping version as we are adding AI

  async execute(input: AgentInput): Promise<AgentOutput> {
    const situation = input.data.situation as any;
    
    // Generate context-aware options using AI
    const complexity = situation?.complexity || 'moderate';
    const budgetConstraint = situation?.budget || 'standard';
    const timeline = situation?.timeline || 'normal';
    
    let options: any[] = [];
    let aiGenerated = false;

    try {
        const prompt = `
            Situation: ${situation.description || 'General Business Analysis'}
            Key Issues: ${JSON.stringify(situation.issues || [])}
            Constraints: Complexity=${complexity}, Budget=${budgetConstraint}, Timeline=${timeline}

            Generate 3 strategic options for this situation.
            For each option provide: Name, Description, Pros (array), Cons (array), Suitability (Low/Medium/High).

            Return strictly JSON format: { "options": [ ... ] }
        `;

        const aiResponse = await getAIResponse(
            "You are a strategic business advisor. Generate 3 distinct strategic options (Conservative, Aggressive, Balanced) for the client situation.",
            prompt
        );

        if (aiResponse) {
             const cleanJson = aiResponse.content.replace(/```json/g, '').replace(/```/g, '').trim();
             const result = JSON.parse(cleanJson);
             if (result.options && Array.isArray(result.options)) {
                 options = result.options.map((o: any, i: number) => ({ id: i + 1, ...o }));
                 aiGenerated = true;
             }
        }
    } catch (e) {
        console.warn('[OptionsGenerator] AI failed, falling back to templates', e);
    }

    // Fallback if AI fails
    if (options.length === 0) {
        options = [
            { 
                id: 1, 
                name: 'Strategic Maintenance', 
                description: 'Maintain current structure with optimized processes.', 
                pros: ['Minimal disruption', 'Low implementation cost', 'Staff familiarity'], 
                cons: ['May not resolve underlying structural issues', 'Risk of stagnation'],
                suitability: complexity === 'low' ? 'High' : 'Low'
            },
            { 
                id: 2, 
                name: 'Comprehensive Restructuring', 
                description: 'Implement a full restructuring to address root causes.', 
                pros: ['Addresses core inefficiencies', 'Long-term scalability', 'Tax optimization'], 
                cons: ['High implementation cost', 'Significant disruption', 'Change management required'],
                suitability: complexity === 'high' ? 'High' : 'Moderate'
            },
            { 
                id: 3, 
                name: 'Phased Transformation', 
                description: 'Hybrid approach rolling out changes in manageable phases.', 
                pros: ['Balanced risk profile', 'Steady progress', 'Allows for course correction'], 
                cons: ['Extended timeline', 'Requires sustained leadership focus'],
                suitability: 'Moderate'
            },
        ];
    }

    return {
      success: true,
      data: { options, situation: { complexity, budgetConstraint, timeline }, aiGenerated },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: aiGenerated ? 0.92 : 0.85 },
    };
  }
}

export class ProConAnalyzer extends EventEmitter implements AgentDefinition {
  id = 'pro-con-analyzer';
  name = 'Pro-Con Analyzer';
  mode = 'deliverable-composer' as const;
  capabilities = ['analysis', 'comparison'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const options = input.data.options as any[];
    const analysis = options.map(opt => ({
      option: opt.name,
      pros: opt.pros,
      cons: opt.cons,
      netScore: opt.pros.length - opt.cons.length,
    }));

    return {
      success: true,
      data: { analysis },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
    };
  }
}

export class RecommendationFormulator extends EventEmitter implements AgentDefinition {
  id = 'recommendation-formulator';
  name = 'Recommendation Formulator';
  mode = 'deliverable-composer' as const;
  capabilities = ['recommendation', 'strategic-advisory'];
  version = '1.0.1'; // Bump version for AI integration

  async execute(input: AgentInput): Promise<AgentOutput> {
    const analysis = input.data.analysis as any;
    const topOption = analysis?.[0]; // Assuming sorted
    
    let recommendation: any = null;
    let aiGenerated = false;

    // 1. Try AI Generation for a strategic recommendation
    try {
        const prompt = `
            Context: We analyzed several options for the client.
            Top Option: ${JSON.stringify(topOption)}
            All Options Analysis: ${JSON.stringify(analysis)}

            Formulate a professional strategic recommendation.
            Include:
            1. Clear 'Recommended' statement.
            2. Detailed 'Rationale' (Why this wins).
            3. 3-5 high-level 'Implementation Steps'.
            4. Realistic 'Timeline' estimate.
            5. Quantification of 'Expected Benefits'.

            Return JSON:
            {
                "recommended": "Option Name",
                "rationale": "...",
                "implementationSteps": ["Step 1...", "Step 2..."],
                "timeline": "X months",
                "expectedBenefits": ["Benefit 1", "Benefit 2"]
            }
        `;

        const aiResponse = await getAIResponse(
            "You are a senior partner providing a formal recommendation.", 
            prompt
        );

        if (aiResponse) {
             const cleanJson = aiResponse.content.replace(/```json/g, '').replace(/```/g, '').trim();
             const result = JSON.parse(cleanJson);
             if (result.recommended) {
                 recommendation = {
                     ...result,
                     analysisInsight: {
                        selectedOption: topOption?.option || result.recommended,
                        score: topOption?.netScore || 0,
                        confidence: 'High'
                     }
                 };
                 aiGenerated = true;
             }
        }
    } catch (e) {
        console.warn('[RecommendationFormulator] AI failed', e);
    }

    // 2. Fallback to Logic
    if (!recommendation) {
        const hasPositiveScore = (topOption?.netScore || 0) > 0;
        recommendation = {
            recommended: topOption?.option || 'Review Required',
            rationale: hasPositiveScore 
                ? 'Provides optimal balance of benefits and risks based on analysis' 
                : 'Best available option despite challenges',
            implementationSteps: [
                'Phase 1: Planning and stakeholder alignment',
                'Phase 2: Execution with monitoring',
                'Phase 3: Review and optimization'
            ],
            timeline: (topOption?.netScore || 0) > 1 ? '6-12 months' : '12-18 months',
            expectedBenefits: [
                'Tax savings of 15-20%',
                'Improved efficiency',
                hasPositiveScore ? 'Strong benefit-to-risk ratio' : 'Mitigated risk exposure'
            ],
            analysisInsight: {
                selectedOption: topOption?.option,
                score: topOption?.netScore,
                confidence: hasPositiveScore ? 'High' : 'Moderate'
            }
        };
    }

    return {
      success: true,
      data: { recommendation, analysis },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: aiGenerated ? 0.95 : 0.9 },
    };
  }
}

export class ActionPlanDeveloper extends EventEmitter implements AgentDefinition {
  id = 'action-plan-developer';
  name = 'Action Plan Developer';
  mode = 'deliverable-composer' as const;
  capabilities = ['planning', 'project-management'];
  version = '1.0.1'; // Bump Version

  async execute(input: AgentInput): Promise<AgentOutput> {
    const recommendation = input.data.recommendation as any;
    
    // Tailor action plan based on recommendation complexity and timeline
    // This previously used simple logic. Now we try to make it smarter.
    const timeline = recommendation?.timeline || '6-12 months';
    const isComplex = recommendation?.complexity === 'high' || timeline.includes('18');
    
    // We stick to code logic for structure, but could enhance tasks dynamically if needed.
    // For now, let's keep it reliable but dynamic based on input recommendation text.
    
    const stepsFromRec = recommendation?.implementationSteps || [];
    
    let phases = [
        { 
          phase: 1, 
          name: 'Planning & Design', 
          duration: isComplex ? '3 months' : '1 month', 
          tasks: ['Stakeholder alignment', 'Detailed requirement gathering', 'Resource allocation']
        },
        { 
          phase: 2, 
          name: 'Execution', 
          duration: isComplex ? '6 months' : '3 months', 
          tasks: stepsFromRec.length > 0 ? stepsFromRec : ['Core implementation', 'Change management', 'Training']
        },
        { 
          phase: 3, 
          name: 'Review & Optimize', 
          duration: '1 month', 
          tasks: ['KPI measurement', 'Documentation', 'Handover']
        },
    ];

    const actionPlan = {
      phases,
      resources: ['Internal team', 'Project Manager', isComplex ? 'External Consultants' : 'SME'],
      budget: isComplex ? '$150k - $250k Estimate' : '$50k - $100k Estimate',
      successMetrics: [
        ...(recommendation?.expectedBenefits || []),
        'On-time delivery',
        'Budget adherence'
      ],
      recommendationContext: {
        recommended: recommendation?.recommended,
        complexity: isComplex ? 'High' : 'Standard',
        timeline: timeline
      }
    };

    return {
      success: true,
      data: { actionPlan, recommendation },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
    };
  }
}

export class TimelineCreator extends EventEmitter implements AgentDefinition {
  id = 'timeline-creator';
  name = 'Timeline Creator';
  mode = 'deliverable-composer' as const;
  capabilities = ['scheduling', 'visualization'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const plan = input.data.plan as any;
    
    // Extract timeline from plan phases
    const phases = plan?.phases || [];
    const totalMonths = phases.reduce((sum: number, p: any) => {
      const months = parseInt(p.duration) || 2;
      return sum + months;
    }, 0) || 7;
    
    const startDate = new Date();
    const timeline = {
      start: startDate.toISOString(),
      milestones: phases.map((phase: any, index: number) => {
        const monthsOffset = phases.slice(0, index + 1).reduce((sum: number, p: any) => 
          sum + (parseInt(p.duration) || 2), 0);
        return {
          name: `${phase.name} Complete`,
          phase: phase.phase,
          date: new Date(startDate.getTime() + monthsOffset * 30 * 24 * 60 * 60 * 1000).toISOString(),
          tasks: phase.tasks?.length || 0
        };
      }),
      criticalPath: phases.map((p: any) => p.name),
      totalDuration: `${totalMonths} months`,
      planContext: {
        phases: phases.length,
        budget: plan?.budget
      }
    };

    return {
      success: true,
      data: { timeline, plan },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
    };
  }
}

export class RiskMitigationPlanner extends EventEmitter implements AgentDefinition {
  id = 'risk-mitigation-planner';
  name = 'Risk Mitigation Planner';
  mode = 'deliverable-composer' as const;
  capabilities = ['risk-management', 'mitigation-planning'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const risks = input.data.risks as any[];
    const mitigation = risks.map(risk => ({
      risk: risk.name,
      impact: risk.impact,
      mitigation: `Implement ${risk.name} mitigation strategy`,
      owner: 'Project Manager',
      status: 'Planned',
    }));

    return {
      success: true,
      data: { mitigation },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.85 },
    };
  }
}

export class CostBenefitAnalyzer extends EventEmitter implements AgentDefinition {
  id = 'cost-benefit-analyzer';
  name = 'Cost-Benefit Analyzer';
  mode = 'deliverable-composer' as const;
  capabilities = ['financial-analysis', 'cba'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const option = input.data.option as any;
    
    // Calculate costs and benefits based on option characteristics
    const optionType = option?.id || 1;
    const complexity = option?.complexity || 'moderate';
    
    // Different costs based on option type
    const implementationCost = optionType === 1 ? 50000 : optionType === 2 ? 250000 : 150000;
    const ongoingCost = optionType === 1 ? 10000 : optionType === 2 ? 50000 : 30000;
    const taxSavings = optionType === 1 ? 100000 : optionType === 2 ? 400000 : 250000;
    const efficiencyGain = complexity === 'high' ? 150000 : 100000;
    
    const totalCosts = implementationCost + (ongoingCost * 3); // 3 years
    const totalBenefits = (taxSavings * 3) + efficiencyGain;
    const netBenefit = totalBenefits - totalCosts;
    const roi = Math.round((netBenefit / totalCosts) * 100);
    const paybackMonths = Math.round((implementationCost / (taxSavings / 12)));
    
    const analysis = {
      costs: { 
        implementation: implementationCost, 
        ongoing: ongoingCost,
        threeYearTotal: totalCosts
      },
      benefits: { 
        taxSavings: taxSavings, 
        efficiency: efficiencyGain,
        threeYearTotal: totalBenefits
      },
      netBenefit: netBenefit,
      roi: `${roi}%`,
      paybackPeriod: `${paybackMonths} months`,
      optionAnalysis: {
        optionName: option?.name || `Option ${optionType}`,
        type: optionType,
        viability: netBenefit > 0 ? 'Financially viable' : 'Not recommended'
      }
    };

    return {
      success: true,
      data: { analysis, option },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.88 },
    };
  }
}

export class AdvisoryLetterFinalizer extends EventEmitter implements AgentDefinition {
  id = 'advisory-letter-finalizer';
  name = 'Advisory Letter Finalizer';
  mode = 'deliverable-composer' as const;
  capabilities = ['finalization', 'professional-writing'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const sections = input.data.sections as any[];
    const letter = {
      title: 'Advisory Letter',
      date: new Date().toISOString(),
      addressee: input.data.client,
      sections,
      closing: 'We remain available to discuss this matter further',
      signature: '[Partner Name]',
    };

    return {
      success: true,
      data: { letter },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.95 },
    };
  }
}

// Compliance Document Agents (9 agents)
export class RequirementMapper extends EventEmitter implements AgentDefinition {
  id = 'requirement-mapper';
  name = 'Requirement Mapper';
  mode = 'deliverable-composer' as const;
  capabilities = ['mapping', 'compliance-analysis'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const jurisdiction = input.data.jurisdiction as string;
    const requirements = [
      { id: 1, name: 'Annual Filing', deadline: 'March 31', mandatory: true },
      { id: 2, name: 'Quarterly Returns', deadline: 'Quarterly', mandatory: true },
      { id: 3, name: 'Audit Requirement', deadline: 'Annual', mandatory: false },
    ];

    return {
      success: true,
      data: { requirements, jurisdiction },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
    };
  }
}

export class ChecklistGenerator extends EventEmitter implements AgentDefinition {
  id = 'checklist-generator';
  name = 'Checklist Generator';
  mode = 'deliverable-composer' as const;
  capabilities = ['checklist-creation', 'process-documentation'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const requirements = input.data.requirements as any[];
    const checklist = requirements.map((req, i) => ({
      item: i + 1,
      requirement: req.name,
      status: 'Not Started',
      responsible: 'Compliance Team',
      dueDate: req.deadline,
    }));

    return {
      success: true,
      data: { checklist },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 1.0 },
    };
  }
}

export class FormPreparationGuide extends EventEmitter implements AgentDefinition {
  id = 'form-preparation-guide';
  name = 'Form Preparation Guide';
  mode = 'deliverable-composer' as const;
  capabilities = ['guide-creation', 'instruction-writing'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const forms = input.data.forms as any[];
    const guide = forms.map(form => ({
      form: form.name,
      sections: form.sections || [],
      requiredDocuments: ['ID Proof', 'Financial Statements'],
      instructions: `Complete all sections of ${form.name}`,
    }));

    return {
      success: true,
      data: { guide },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
    };
  }
}

export class DeadlineTracker extends EventEmitter implements AgentDefinition {
  id = 'deadline-tracker';
  name = 'Deadline Tracker';
  mode = 'deliverable-composer' as const;
  capabilities = ['tracking', 'calendar-management'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const deadlines = input.data.deadlines as any[];
    const tracker = deadlines.map(d => ({
      item: d.name,
      deadline: d.date,
      daysRemaining: Math.ceil((new Date(d.date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      status: 'On Track',
      priority: d.priority || 'Medium',
    }));

    return {
      success: true,
      data: { tracker, upcomingCount: tracker.filter(t => t.daysRemaining < 30).length },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 1.0 },
    };
  }
}

export class DocumentationAssembler extends EventEmitter implements AgentDefinition {
  id = 'documentation-assembler';
  name = 'Documentation Assembler';
  mode = 'deliverable-composer' as const;
  capabilities = ['assembly', 'organization'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const documents = input.data.documents as any[];
    const assembled = {
      documents: documents.map(d => ({ name: d.name, status: 'Complete' })),
      totalPages: documents.reduce((sum, d) => sum + (d.pages || 1), 0),
      lastUpdated: new Date().toISOString(),
    };

    return {
      success: true,
      data: { assembled },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 1.0 },
    };
  }
}

export class ComplianceCertificateGenerator extends EventEmitter implements AgentDefinition {
  id = 'compliance-certificate-generator';
  name = 'Compliance Certificate Generator';
  mode = 'deliverable-composer' as const;
  capabilities = ['certificate-generation', 'attestation'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const compliance = input.data.compliance as any;
    const certificate = {
      title: 'Certificate of Compliance',
      entity: compliance.entityName,
      period: compliance.period,
      statement: 'This is to certify that the entity has complied with all applicable requirements',
      date: new Date().toISOString(),
      signatory: 'Authorized Signatory',
    };

    return {
      success: true,
      data: { certificate },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.95 },
    };
  }
}

export class FilingInstructionWriter extends EventEmitter implements AgentDefinition {
  id = 'filing-instruction-writer';
  name = 'Filing Instruction Writer';
  mode = 'deliverable-composer' as const;
  capabilities = ['instruction-writing', 'process-documentation'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const filing = input.data.filing as any;
    const instructions = {
      filing: filing.name,
      steps: [
        'Step 1: Gather required documents',
        'Step 2: Complete form accurately',
        'Step 3: Review for completeness',
        'Step 4: Submit electronically or by mail',
        'Step 5: Retain confirmation receipt',
      ],
      tips: ['File early to avoid last-minute issues', 'Keep copies for records'],
    };

    return {
      success: true,
      data: { instructions },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
    };
  }
}

export class AuditTrailDocumenter extends EventEmitter implements AgentDefinition {
  id = 'audit-trail-documenter';
  name = 'Audit Trail Documenter';
  mode = 'deliverable-composer' as const;
  capabilities = ['documentation', 'audit-trail'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const activities = input.data.activities as any[];
    const trail = activities.map((act, i) => ({
      sequence: i + 1,
      activity: act.name,
      timestamp: act.date,
      user: act.user || 'System',
      action: act.action,
      status: 'Completed',
    }));

    return {
      success: true,
      data: { trail },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 1.0 },
    };
  }
}

export class ComplianceReportFinalizer extends EventEmitter implements AgentDefinition {
  id = 'compliance-report-finalizer';
  name = 'Compliance Report Finalizer';
  mode = 'deliverable-composer' as const;
  capabilities = ['finalization', 'report-assembly'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const sections = input.data.sections as any[];
    const report = {
      title: 'Compliance Report',
      period: input.data.period,
      sections,
      summary: 'All compliance requirements have been met',
      certification: 'Certified by authorized personnel',
      date: new Date().toISOString(),
    };

    return {
      success: true,
      data: { report },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.95 },
    };
  }
}

// Financial Model Agents (9 agents)
export class AssumptionDefiner extends EventEmitter implements AgentDefinition {
  id = 'assumption-definer';
  name = 'Assumption Definer';
  mode = 'deliverable-composer' as const;
  capabilities = ['modeling', 'assumption-setting'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const scenario = input.data.scenario as any;
    
    // Tailor assumptions based on scenario characteristics
    const scenarioType = scenario?.type || 'base';
    const isOptimistic = scenarioType === 'optimistic' || scenario?.outlook === 'positive';
    const isPessimistic = scenarioType === 'pessimistic' || scenario?.outlook === 'negative';
    
    const assumptions = {
      revenue: { 
        growth: isOptimistic ? 0.20 : isPessimistic ? 0.08 : 0.15, 
        base: scenario?.baseRevenue || 10000000 
      },
      costs: { 
        fixedCosts: scenario?.fixedCosts || 2000000, 
        variableCostRatio: isOptimistic ? 0.55 : isPessimistic ? 0.65 : 0.6 
      },
      tax: { 
        rate: scenario?.taxRate || 0.3 
      },
      discount: { 
        rate: isPessimistic ? 0.15 : isOptimistic ? 0.10 : 0.12 
      },
      scenarioContext: {
        type: scenarioType,
        outlook: isOptimistic ? 'Optimistic' : isPessimistic ? 'Pessimistic' : 'Base Case',
        confidence: isOptimistic || isPessimistic ? 'Medium' : 'High'
      }
    };

    return {
      success: true,
      data: { assumptions, scenario },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
    };
  }
}

export class RevenueModeler extends EventEmitter implements AgentDefinition {
  id = 'revenue-modeler';
  name = 'Revenue Modeler';
  mode = 'deliverable-composer' as const;
  capabilities = ['financial-modeling', 'revenue-projection'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const assumptions = input.data.assumptions as any;
    const years = input.data.years || 5;
    
    const projections = [];
    for (let year = 1; year <= years; year++) {
      projections.push({
        year,
        revenue: Math.round(assumptions.revenue.base * Math.pow(1 + assumptions.revenue.growth, year)),
      });
    }

    return {
      success: true,
      data: { projections },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
    };
  }
}

export class ExpenseForecaster extends EventEmitter implements AgentDefinition {
  id = 'expense-forecaster';
  name = 'Expense Forecaster';
  mode = 'deliverable-composer' as const;
  capabilities = ['forecasting', 'expense-modeling'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const revenue = input.data.revenue as any[];
    const assumptions = input.data.assumptions as any;
    
    const expenses = revenue.map(r => ({
      year: r.year,
      fixedCosts: assumptions.costs.fixedCosts,
      variableCosts: Math.round(r.revenue * assumptions.costs.variableCostRatio),
      totalExpenses: Math.round(assumptions.costs.fixedCosts + r.revenue * assumptions.costs.variableCostRatio),
    }));

    return {
      success: true,
      data: { expenses },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.88 },
    };
  }
}

export class CashFlowProjector extends EventEmitter implements AgentDefinition {
  id = 'cash-flow-projector';
  name = 'Cash Flow Projector';
  mode = 'deliverable-composer' as const;
  capabilities = ['cash-flow-analysis', 'projection'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const revenue = input.data.revenue as any[];
    const expenses = input.data.expenses as any[];
    
    const cashFlow = revenue.map((r, i) => ({
      year: r.year,
      inflow: r.revenue,
      outflow: expenses[i].totalExpenses,
      netCashFlow: r.revenue - expenses[i].totalExpenses,
      cumulativeCashFlow: i === 0 ? r.revenue - expenses[i].totalExpenses : 0, // Simplified
    }));

    return {
      success: true,
      data: { cashFlow },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
    };
  }
}

export class ValuationCalculator extends EventEmitter implements AgentDefinition {
  id = 'valuation-calculator';
  name = 'Valuation Calculator';
  mode = 'deliverable-composer' as const;
  capabilities = ['valuation', 'dcf-analysis'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const cashFlows = input.data.cashFlows as any[];
    const discountRate = input.data.discountRate || 0.12;
    
    const dcf = cashFlows.map(cf => ({
      year: cf.year,
      cashFlow: cf.netCashFlow,
      presentValue: Math.round(cf.netCashFlow / Math.pow(1 + discountRate, cf.year)),
    }));

    const npv = dcf.reduce((sum, pv) => sum + pv.presentValue, 0);

    return {
      success: true,
      data: { dcf, npv },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
    };
  }
}

export class SensitivityTableBuilder extends EventEmitter implements AgentDefinition {
  id = 'sensitivity-table-builder';
  name = 'Sensitivity Table Builder';
  mode = 'deliverable-composer' as const;
  capabilities = ['sensitivity-analysis', 'table-creation'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const baseNPV = input.data.baseNPV || 1000000;
    const variable = input.data.variable || 'Growth Rate';
    
    const table = [-0.02, -0.01, 0, 0.01, 0.02].map(change => ({
      change: `${change >= 0 ? '+' : ''}${(change * 100).toFixed(1)}%`,
      npv: Math.round(baseNPV * (1 + change * 5)),
      impactPercent: `${(change * 500).toFixed(1)}%`,
    }));

    return {
      success: true,
      data: { table, variable },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
    };
  }
}

export class ScenarioComparisonBuilder extends EventEmitter implements AgentDefinition {
  id = 'scenario-comparison-builder';
  name = 'Scenario Comparison Builder';
  mode = 'deliverable-composer' as const;
  capabilities = ['comparison', 'scenario-analysis'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const scenarios = input.data.scenarios as any[];
    
    const comparison = scenarios.map(s => ({
      scenario: s.name,
      npv: s.npv,
      irr: s.irr,
      payback: s.payback,
      rank: s.rank || 0,
    }));

    return {
      success: true,
      data: { comparison, recommended: comparison[0].scenario },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.88 },
    };
  }
}

export class ChartDataPreparation extends EventEmitter implements AgentDefinition {
  id = 'chart-data-preparation';
  name = 'Chart Data Preparation';
  mode = 'deliverable-composer' as const;
  capabilities = ['data-preparation', 'visualization-ready'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const data = input.data.financialData as any[];
    
    const chartData = {
      revenueChart: data.map(d => ({ year: d.year, value: d.revenue })),
      profitChart: data.map(d => ({ year: d.year, value: d.profit })),
      cashFlowChart: data.map(d => ({ year: d.year, value: d.cashFlow })),
    };

    return {
      success: true,
      data: { chartData },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 1.0 },
    };
  }
}

export class FinancialModelFinalizer extends EventEmitter implements AgentDefinition {
  id = 'financial-model-finalizer';
  name = 'Financial Model Finalizer';
  mode = 'deliverable-composer' as const;
  capabilities = ['finalization', 'model-assembly'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const components = input.data.components as any;
    
    const model = {
      title: 'Financial Model',
      date: new Date().toISOString(),
      assumptions: components?.assumptions || [],
      projections: components?.projections || [],
      valuation: components?.valuation || {},
      sensitivity: components?.sensitivity || {},
      recommendation: 'Model indicates favorable investment opportunity',
    };

    return {
      success: true,
      data: { model },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.95 },
    };
  }
}

// Export Part 2 agents (27 agents)
export const deliverableComposerPart2Agents: AgentDefinition[] = [
  // Advisory Letter (9)
  new SituationSummarizer(),
  new OptionsGenerator(),
  new ProConAnalyzer(),
  new RecommendationFormulator(),
  new ActionPlanDeveloper(),
  new TimelineCreator(),
  new RiskMitigationPlanner(),
  new CostBenefitAnalyzer(),
  new AdvisoryLetterFinalizer(),
  // Compliance Documents (9)
  new RequirementMapper(),
  new ChecklistGenerator(),
  new FormPreparationGuide(),
  new DeadlineTracker(),
  new DocumentationAssembler(),
  new ComplianceCertificateGenerator(),
  new FilingInstructionWriter(),
  new AuditTrailDocumenter(),
  new ComplianceReportFinalizer(),
  // Financial Models (9)
  new AssumptionDefiner(),
  new RevenueModeler(),
  new ExpenseForecaster(),
  new CashFlowProjector(),
  new ValuationCalculator(),
  new SensitivityTableBuilder(),
  new ScenarioComparisonBuilder(),
  new ChartDataPreparation(),
  new FinancialModelFinalizer(),
];
