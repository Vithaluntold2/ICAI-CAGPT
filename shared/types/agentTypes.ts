/**
 * Shared Agent Type Definitions
 * Central location for all agent-related types used across the system
 */

/**
 * Agent lifecycle status
 */
export type AgentStatus = 
  | 'idle'        // Agent is registered but not executing
  | 'queued'      // Agent is queued for execution
  | 'running'     // Agent is currently executing
  | 'completed'   // Agent finished successfully
  | 'failed'      // Agent execution failed
  | 'retrying';   // Agent is retrying after failure

/**
 * Professional mode types
 */
export type ProfessionalMode =
  | 'deep-research'
  | 'financial-calculation'
  | 'workflow-visualization'
  | 'audit-planning'
  | 'scenario-simulator'
  | 'deliverable-composer'
  | 'forensic-intelligence'
  | 'roundtable'
  | 'spreadsheet';

/**
 * Agent capability types
 */
export type AgentCapability =
  | 'research'
  | 'calculation'
  | 'validation'
  | 'analysis'
  | 'generation'
  | 'visualization'
  | 'coordination'
  | 'orchestration'
  | 'planning'
  | 'synthesis'
  | 'citation'
  | 'formatting'
  | 'search'
  | 'retrieval'
  | 'legal-reasoning'
  | 'navigation'
  | 'structure-analysis'
  | 'linking'
  | 'relationship-mapping'
  | 'summarization'
  | 'quality-assessment'
  | 'financial-modeling'
  | 'document-generation'
  | 'audit-planning'
  | 'risk-assessment'
  | 'pattern-recognition'
  | 'data-mining'
  | 'statistical-analysis'
  | 'anomaly-detection'
  | 'outlier-analysis'
  | 'transaction-tracing'
  | 'flow-analysis'
  | 'link-detection'
  | 'network-analysis'
  | 'entity-mapping'
  | 'relationship-detection'
  | 'chronology'
  | 'timeline-analysis'
  | 'event-sequencing'
  | 'evidence-correlation'
  | 'link-analysis'
  | 'case-building'
  | 'risk-scoring'
  | 'suspicion-assessment'
  | 'red-flag-detection'
  | 'report-generation'
  | 'executive-summary'
  | 'findings-documentation'
  | 'expert-selection'
  | 'team-assembly'
  | 'moderation'
  | 'facilitation'
  | 'agenda-management'
  | 'perspective-gathering'
  | 'opinion-synthesis'
  | 'argument-analysis'
  | 'logic-evaluation'
  | 'consensus-building'
  | 'finalization'
  | 'documentation'
  | 'professional-writing'
  | 'business-writing'
  | 'option-development'
  | 'comparison'
  | 'recommendation'
  | 'strategic-advisory'
  | 'project-management'
  | 'scheduling'
  | 'risk-management'
  | 'mitigation-planning'
  | 'cba'
  | 'mapping'
  | 'compliance-analysis'
  | 'checklist-creation'
  | 'process-documentation'
  | 'guide-creation'
  | 'instruction-writing'
  | 'tracking'
  | 'calendar-management'
  | 'assembly'
  | 'organization'
  | 'certificate-generation'
  | 'attestation'
  | 'audit-trail'
  | 'report-assembly'
  | 'modeling'
  | 'assumption-setting'
  | 'revenue-projection'
  | 'forecasting'
  | 'expense-modeling'
  | 'cash-flow-analysis'
  | 'projection'
  | 'valuation'
  | 'dcf-analysis'
  | 'sensitivity-analysis'
  | 'table-creation'
  | 'scenario-analysis'
  | 'data-preparation'
  | 'visualization-ready'
  | 'model-assembly'
  | 'parsing'
  | 'enrichment'
  | 'connection-building'
  | 'optimization'
  | 'layout'
  | 'quality-assurance'
  | 'tax-modeling';

/**
 * Base agent definition
 */
export interface AgentDefinition {
  id: string;
  name: string;
  description?: string; // Optional for simpler agents
  mode: ProfessionalMode;
  capabilities: readonly string[]; // Accepts any string array - no type inference issues
  version: string;
  dependencies?: string[]; // Optional, defaults to []
  timeout?: number; // Execution timeout in milliseconds
  retryConfig?: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelayMs: number;
  };
  allowParallel?: boolean; // Can run in parallel with other agents
  execute: (input: AgentInput) => Promise<AgentOutput>;
}

/**
 * Agent execution input
 */
export interface AgentInput {
  conversationId: string;
  query: string;
  context: Record<string, any>;
  data: Record<string, any>; // Agent-specific input data
  previousAgentOutputs?: AgentOutput[];
  userTier: string;
  timestamp: number; // Execution timestamp for metrics
  options?: Record<string, any>;
}

/**
 * Agent execution output
 */
export interface AgentOutput {
  agentId?: string; // Optional for compatibility
  agentName?: string; // Optional for compatibility
  success: boolean;
  data: Record<string, any>;
  error?: string;
  metadata?: {
    agentId?: string;
    executionTime: number;
    duration?: number; // For backwards compatibility
    tokensUsed?: number;
    cost?: number;
    confidence?: number;
    timestamp?: Date;
    startTime?: Date;
    endTime?: Date;
  };
}

/**
 * Agent execution context
 */
export interface AgentExecutionContext {
  conversationId: string;
  userId: string;
  userTier: string;
  query: string;
  mode: ProfessionalMode;
  options?: Record<string, any>;
  startTime: Date;
}

/**
 * Agent metrics
 */
export interface AgentMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  lastExecuted?: Date;
  successRate: number;
  totalTokensUsed?: number;
  totalCost?: number;
}

/**
 * Registered agent (includes registration metadata)
 */
export interface RegisteredAgent extends AgentDefinition {
  registeredAt: Date;
  metrics: AgentMetrics;
  status: AgentStatus;
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

/**
 * Agent orchestration job
 */
export interface OrchestrationJob {
  id: string;
  conversationId: string;
  mode: ProfessionalMode;
  agents: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  results: AgentOutput[];
  error?: string;
}

/**
 * Agent status update
 */
export interface AgentStatusUpdate {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  timestamp: Date;
  details?: Record<string, any>;
}

/**
 * System health status
 */
export interface SystemHealth {
  timestamp: Date;
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  failedAgents: number;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  metrics: {
    averageSuccessRate: number;
    totalExecutions: number;
    activeExecutions: number;
  };
}

/**
 * Inter-agent message
 */
export interface AgentMessage {
  id: string;
  fromAgent: string;
  toAgent: string;
  conversationId: string;
  type: 'data' | 'command' | 'status' | 'error';
  payload: Record<string, any>;
  timestamp: Date;
  priority: number;
  ttl?: number;
}

/**
 * Agent discovery query
 */
export interface AgentQuery {
  mode?: ProfessionalMode;
  capabilities?: AgentCapability[];
  minSuccessRate?: number;
  maxAverageDuration?: number;
  excludeUnhealthy?: boolean;
}

/**
 * Agent execution plan
 */
export interface ExecutionPlan {
  jobId: string;
  agents: Array<{
    agentId: string;
    order: number;
    dependencies: string[];
    estimatedDuration: number;
  }>;
  estimatedTotalDuration: number;
  parallelizable: boolean;
}
