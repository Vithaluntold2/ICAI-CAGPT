/**
 * Agent Registry Bootstrap
 * Registers all agents with the orchestrator
 */

import { agentOrchestrator } from '../core/agentOrchestrator';
import { agentRegistry } from '../core/agentRegistry';
import { deepResearchAgents } from './deepResearchAgents';
import { financialCalculationAgents } from './financialCalculationAgents';
import { workflowVisualizationAgents } from './workflowVisualizationAgents';
import { auditPlanningAgents } from './auditPlanningAgents';
import { scenarioSimulatorAgents } from './scenarioSimulatorAgents';
import { deliverableComposerPart1Agents } from './deliverableComposerPart1';
import { deliverableComposerPart2Agents } from './deliverableComposerPart2';
import { forensicIntelligenceAgents } from './forensicIntelligenceAgents';
import { roundtableAgents } from './roundtableAgents';

/**
 * Helper: register agent in both registry AND orchestrator
 */
function registerAgent(agent: any): void {
  agentRegistry.register(agent);
  agentOrchestrator.registerAgent(agent);
}

/**
 * Initialize and register all agents
 */
export async function initializeAgents(): Promise<void> {
  console.log('[AgentBootstrap] Initializing agents...');

  // Register Deep Research agents (8 agents)
  for (const agent of deepResearchAgents) {
    registerAgent(agent);
    console.log(`[AgentBootstrap] Registered: ${agent.name} (${agent.id})`);
  }

  // Register Financial Calculation agents (5 agents)
  for (const agent of financialCalculationAgents) {
    registerAgent(agent);
    console.log(`[AgentBootstrap] Registered: ${agent.name} (${agent.id})`);
  }

  // Register Workflow Visualization agents (5 agents)
  for (const agent of workflowVisualizationAgents) {
    registerAgent(agent);
    console.log(`[AgentBootstrap] Registered: ${agent.name} (${agent.id})`);
  }

  // Register Audit Planning agents (14 agents)
  for (const agent of auditPlanningAgents) {
    registerAgent(agent);
    console.log(`[AgentBootstrap] Registered: ${agent.name} (${agent.id})`);
  }

  // Register Scenario Simulator agents (12 agents)
  for (const agent of scenarioSimulatorAgents) {
    registerAgent(agent);
    console.log(`[AgentBootstrap] Registered: ${agent.name} (${agent.id})`);
  }

  // Register Deliverable Composer agents - Part 1 (18 agents)
  for (const agent of deliverableComposerPart1Agents) {
    registerAgent(agent);
    console.log(`[AgentBootstrap] Registered: ${agent.name} (${agent.id})`);
  }

  // Register Deliverable Composer agents - Part 2 (27 agents)
  for (const agent of deliverableComposerPart2Agents) {
    registerAgent(agent);
    console.log(`[AgentBootstrap] Registered: ${agent.name} (${agent.id})`);
  }

  // Register Forensic Intelligence agents (8 agents)
  for (const agent of forensicIntelligenceAgents) {
    registerAgent(agent);
    console.log(`[AgentBootstrap] Registered: ${agent.name} (${agent.id})`);
  }

  // Register Roundtable agents (6 agents)
  for (const agent of roundtableAgents) {
    registerAgent(agent);
    console.log(`[AgentBootstrap] Registered: ${agent.name} (${agent.id})`);
  }

  // Log summary
  const stats = agentRegistry.getStatistics();
  console.log(`[AgentBootstrap] ========================================`);
  console.log(`[AgentBootstrap] 🎉 INITIALIZATION COMPLETE!`);
  console.log(`[AgentBootstrap] ========================================`);
  console.log(`[AgentBootstrap] Total agents registered: ${stats.totalAgents}`);
  console.log(`[AgentBootstrap] Agents by mode:`);
  console.log(`[AgentBootstrap]   - Deep Research: 8 agents`);
  console.log(`[AgentBootstrap]   - Financial Calculation: 5 agents`);
  console.log(`[AgentBootstrap]   - Workflow Visualization: 5 agents`);
  console.log(`[AgentBootstrap]   - Audit Planning: 14 agents`);
  console.log(`[AgentBootstrap]   - Scenario Simulator: 12 agents`);
  console.log(`[AgentBootstrap]   - Deliverable Composer: 45 agents`);
  console.log(`[AgentBootstrap]   - Forensic Intelligence: 8 agents`);
  console.log(`[AgentBootstrap]   - Roundtable: 6 agents`);
  console.log(`[AgentBootstrap] Health status: ${stats.healthStatus.healthy} healthy, ${stats.healthStatus.degraded} degraded`);
  console.log(`[AgentBootstrap] ========================================`);
}

/**
 * Get agent execution template for a mode
 * Uses a function to define templates to avoid duplicate key issues
 */
export function getAgentExecutionTemplate(mode: string): any {
  // Define base templates (canonical names)
  const financialCalculationTemplate = {
    sequence: [
      'npv-calculator',
      'tax-liability-calculator',
      'depreciation-scheduler',
      'roi-calculator',
      'break-even-analyzer',
    ],
    parallel: [
      ['npv-calculator', 'roi-calculator'],
      ['tax-liability-calculator', 'break-even-analyzer'],
    ],
    dependencies: {},
  };

  const workflowVisualizationTemplate = {
    sequence: [
      'workflow-parser',
      'node-generator',
      'edge-generator',
      'layout-optimizer',
      'workflow-validator',
    ],
    parallel: [
      ['node-generator', 'edge-generator'],
    ],
    dependencies: {
      'layout-optimizer': ['node-generator', 'edge-generator'],
      'workflow-validator': ['layout-optimizer'],
    },
  };

  const auditPlanningTemplate = {
    sequence: [
      'scope-definer',
      'risk-assessor',
      'materiality-calculator',
      'control-evaluator',
      'sampling-planner',
      'evidence-planner',
      'team-allocator',
      'timeline-planner',
      'budget-estimator',
      'procedure-designer',
      'testing-strategy-designer',
      'documentation-planner',
      'communication-planner',
      'audit-plan-finalizer',
    ],
    parallel: [
      ['risk-assessor', 'materiality-calculator'],
      ['sampling-planner', 'evidence-planner'],
      ['timeline-planner', 'budget-estimator'],
    ],
    dependencies: {
      'control-evaluator': ['risk-assessor'],
      'procedure-designer': ['control-evaluator', 'sampling-planner'],
      'audit-plan-finalizer': ['procedure-designer', 'timeline-planner', 'budget-estimator'],
    },
  };

  const deepResearchTemplate = {
    sequence: [
      'research-coordinator',
      'regulation-searcher',
      'case-law-analyzer',
      'tax-code-navigator',
      'cross-reference-builder',
      'source-validator',
      'citation-generator',
      'summary-generator',
    ],
    parallel: [
      ['regulation-searcher', 'case-law-analyzer', 'tax-code-navigator'],
      ['cross-reference-builder', 'source-validator'],
    ],
    dependencies: {
      'source-validator': ['regulation-searcher', 'case-law-analyzer'],
      'citation-generator': ['source-validator'],
      'summary-generator': ['citation-generator', 'cross-reference-builder'],
    },
  };

  const scenarioSimulatorTemplate = {
    sequence: [
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
      'recommendation-synthesizer',
    ],
    parallel: [
      ['tax-impact-modeler', 'financial-projector'],
      ['sensitivity-analyzer', 'monte-carlo-simulator'],
    ],
    dependencies: {
      'what-if-analyzer': ['assumption-validator'],
      'scenario-comparator': ['outcome-predictor'],
      'recommendation-synthesizer': ['scenario-comparator', 'risk-modeler'],
    },
  };

  const deliverableComposerTemplate = {
    sequence: [
      // Audit Reports
      'executive-summary-generator',
      'findings-reporter',
      'recommendation-writer',
      'management-response-collector',
      'appendix-assembler',
      'opinion-formatter',
      'scope-describer',
      'methodology-documenter',
      'audit-report-finalizer',
      // Tax Opinions
      'tax-position-analyzer',
      'legal-citation-builder',
      'precedent-analyzer',
      'risk-assessment-writer',
      'conclusion-drafter',
      'disclaimer-generator',
      'qualification-lister',
      'alternative-position-explorer',
      'tax-opinion-finalizer',
      // Advisory Letters
      'situation-summarizer',
      'options-generator',
      'pro-con-analyzer',
      'recommendation-formulator',
      'action-plan-developer',
      'timeline-creator',
      'risk-mitigation-planner',
      'cost-benefit-analyzer',
      'advisory-letter-finalizer',
      // Compliance
      'requirement-mapper',
      'checklist-generator',
      'form-preparation-guide',
      'deadline-tracker',
      'documentation-assembler',
      'compliance-certificate-generator',
      'filing-instruction-writer',
      'audit-trail-documenter',
      'compliance-report-finalizer',
      // Financial Models
      'assumption-definer',
      'revenue-modeler',
      'expense-forecaster',
      'cash-flow-projector',
      'valuation-calculator',
      'sensitivity-table-builder',
      'scenario-comparison-builder',
      'chart-data-preparation',
      'financial-model-finalizer',
    ],
    parallel: [
      ['findings-reporter', 'recommendation-writer'],
      ['tax-position-analyzer', 'legal-citation-builder'],
      ['revenue-modeler', 'expense-forecaster'],
    ],
    dependencies: {
      'audit-report-finalizer': ['findings-reporter', 'opinion-formatter'],
      'tax-opinion-finalizer': ['conclusion-drafter', 'disclaimer-generator'],
      'financial-model-finalizer': ['valuation-calculator', 'sensitivity-table-builder'],
    },
  };

  const forensicIntelligenceTemplate = {
    sequence: [
      'pattern-detector',
      'anomaly-identifier',
      'transaction-tracer',
      'entity-relationship-mapper',
      'timeline-constructor',
      'evidence-linker',
      'suspicion-scorer',
      'investigation-reporter',
    ],
    parallel: [
      ['pattern-detector', 'anomaly-identifier'],
      ['transaction-tracer', 'entity-relationship-mapper'],
    ],
    dependencies: {
      'evidence-linker': ['timeline-constructor'],
      'suspicion-scorer': ['evidence-linker', 'pattern-detector'],
      'investigation-reporter': ['suspicion-scorer'],
    },
  };

  const roundtableTemplate = {
    sequence: [
      'expert-assembler',
      'discussion-moderator',
      'perspective-collector',
      'argument-analyzer',
      'consensus-synthesizer',
      'recommendation-finalizer',
    ],
    parallel: [],
    dependencies: {
      'argument-analyzer': ['perspective-collector'],
      'consensus-synthesizer': ['argument-analyzer'],
      'recommendation-finalizer': ['consensus-synthesizer'],
    },
  };

  // Use Map for mode lookups (avoids duplicate key issues)
  const templateMap = new Map<string, any>([
    // Canonical names
    ['financial-calculation', financialCalculationTemplate],
    ['workflow-visualization', workflowVisualizationTemplate],
    ['audit-planning', auditPlanningTemplate],
    ['deep-research', deepResearchTemplate],
    ['scenario-simulator', scenarioSimulatorTemplate],
    ['deliverable-composer', deliverableComposerTemplate],
    ['forensic-intelligence', forensicIntelligenceTemplate],
    ['roundtable', roundtableTemplate],
    // Aliases (frontend sends these)
    ['calculation', financialCalculationTemplate],
    ['workflow', workflowVisualizationTemplate],
    ['audit-plan', auditPlanningTemplate],
    ['research', deepResearchTemplate],
  ]);

  return templateMap.get(mode) || { sequence: [], parallel: [], dependencies: {} };
}

/**
 * Execute a complete agent workflow for a mode
 * Waits for all agents to complete before returning results
 */
export async function executeWorkflow(
  mode: string,
  input: any,
  userId: string
): Promise<any> {
  console.log(`[AgentBootstrap] Executing workflow for mode: ${mode}`);

  const template = getAgentExecutionTemplate(mode);

  if (!template.sequence || template.sequence.length === 0) {
    console.warn(`[AgentBootstrap] No agents defined for mode: ${mode}`);
    return { analysis: null, agentResults: {} };
  }

  // Build proper AgentInput from the raw input
  const agentInput = {
    conversationId: input.conversationId || 'unknown',
    query: input.query || '',
    context: {
      history: input.history || [],
      attachment: input.attachment || null,
    },
    data: {
      query: input.query || '',
      baseCase: input.baseCase || { income: 1000000, expenses: 600000 },
      variables: input.variables || ['income', 'expenses', 'taxRate'],
      context: input.query || '',
    },
    userTier: input.userTier || 'professional',
    timestamp: Date.now(),
    options: {},
  };

  // Create orchestration job (starts async execution)
  const job = await agentOrchestrator.executeAgents(
    agentInput.conversationId,
    userId,
    mode,
    template.sequence,
    agentInput
  );

  console.log(`[AgentBootstrap] Workflow job created: ${job.jobId}, waiting for completion...`);

  // Wait for the job to actually complete (with timeout)
  const WORKFLOW_TIMEOUT_MS = 180000; // 3 minutes max
  const completedJob = await new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      console.error(`[AgentBootstrap] Workflow timed out after ${WORKFLOW_TIMEOUT_MS}ms for job ${job.jobId}`);
      // Return whatever results we have so far
      resolve(job);
    }, WORKFLOW_TIMEOUT_MS);

    const onComplete = (completedJob: any) => {
      if (completedJob.jobId === job.jobId) {
        cleanup();
        resolve(completedJob);
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      agentOrchestrator.removeListener('job:completed', onComplete);
    };

    // If job already completed (e.g. no agents found), resolve immediately
    if (job.status === 'completed' || job.status === 'failed') {
      cleanup();
      resolve(job);
      return;
    }

    agentOrchestrator.on('job:completed', onComplete);
  });

  // Convert Map results to a plain object for consumption
  const agentResults: Record<string, any> = {};
  const analysisFragments: string[] = [];

  if (completedJob.results instanceof Map) {
    for (const [agentId, output] of completedJob.results) {
      agentResults[agentId] = output;
      if (output?.data?.analysis) {
        analysisFragments.push(`[${agentId}]: ${output.data.analysis}`);
      } else if (output?.data?.summary) {
        analysisFragments.push(`[${agentId}]: ${output.data.summary}`);
      } else if (typeof output?.data === 'string') {
        analysisFragments.push(`[${agentId}]: ${output.data}`);
      }
    }
  }

  const result = {
    jobId: completedJob.jobId,
    status: completedJob.status,
    mode,
    analysis: analysisFragments.length > 0 ? analysisFragments.join('\n\n') : null,
    agentResults,
    progress: completedJob.progress,
    errors: completedJob.errors,
  };

  console.log(`[AgentBootstrap] Workflow completed: ${completedJob.status}, ${completedJob.progress?.completed || 0}/${completedJob.progress?.total || 0} agents`);

  return result;
}

/**
 * Get agent capabilities for a mode
 */
export function getAgentCapabilities(mode: string): {
  agents: string[];
  capabilities: string[];
  totalAgents: number;
} {
  const agents = agentRegistry.getByMode(mode as any);

  const allCapabilities = new Set<string>();
  agents.forEach(agent => {
    agent.capabilities.forEach(cap => allCapabilities.add(cap));
  });

  return {
    agents: agents.map(a => a.name),
    capabilities: Array.from(allCapabilities),
    totalAgents: agents.length,
  };
}

/**
 * Health check for all agents
 */
export async function healthCheckAll(): Promise<{
  healthy: number;
  degraded: number;
  unhealthy: number;
  details: Array<{ id: string; name: string; status: string; successRate: number }>;
}> {
  const stats = agentRegistry.getStatistics();
  const allAgents = agentRegistry.getAll();

  const details = allAgents.map((agent: any) => {
    const metrics = agent.metrics || { totalExecutions: 0, successfulExecutions: 0 };
    const successRate = metrics.totalExecutions > 0
      ? metrics.successfulExecutions / metrics.totalExecutions
      : 1.0;

    return {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      successRate,
    };
  });

  return {
    healthy: stats.healthStatus.healthy,
    degraded: stats.healthStatus.degraded,
    unhealthy: stats.healthStatus.unhealthy,
    details,
  };
}
