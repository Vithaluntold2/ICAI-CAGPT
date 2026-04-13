/**
 * Advanced Reasoning and Cognitive Architecture Types
 * Supporting chain-of-thought, multi-agent orchestration, and cognitive monitoring
 */

// Reasoning Profile Types
export type ReasoningProfile = 
  | 'fast'           // Standard quick responses
  | 'cot'            // Chain-of-thought reasoning
  | 'multi-agent'    // Multiple specialized agents
  | 'parallel';      // Concurrent reasoning streams

export type ReasoningCapability =
  | 'chain-of-thought'
  | 'long-context'
  | 'multi-modal'
  | 'structured-output'
  | 'function-calling';

// Provider Capability Registry
export interface ProviderCapabilities {
  providerId: string;
  modelId: string;
  capabilities: ReasoningCapability[];
  maxContextTokens: number;
  supportsStreaming: boolean;
  optimalFor: string[]; // ['research', 'calculation', 'audit', etc.]
}

// Chain-of-Thought Trace
export interface ChainOfThoughtStep {
  stepNumber: number;
  reasoning: string;
  conclusion?: string;
  confidence?: number;
}

export interface ChainOfThoughtTrace {
  steps: ChainOfThoughtStep[];
  finalConclusion: string;
  overallConfidence: number;
  reasoning_time_ms: number;
}

// Agent Types
export type AgentType = 
  | 'research'      // Tax code/GAAP research with evidence
  | 'audit'         // Control testing and risk assessment
  | 'calculation'   // Financial solvers with error bounds
  | 'compliance'    // Rule validation and verification
  | 'validation';   // Cross-check and quality assurance

export interface AgentOutput {
  agentType: AgentType;
  conclusion: string;
  evidence: string[];
  confidence: number;
  metadata?: Record<string, any>;
  warnings?: string[];
}

export interface MergedAgentOutput {
  finalResponse: string;
  agentContributions: AgentOutput[];
  reconciliationMethod: 'confidence-weighted' | 'vote' | 'consensus';
  overallConfidence: number;
  conflicts?: string[];
}

// Cognitive Monitoring
export interface ComplianceCheck {
  checkType: 'hallucination' | 'gaap-compliance' | 'irs-compliance' | 'numeric-consistency';
  passed: boolean;
  confidence: number;
  issues?: string[];
  evidence?: string[];
}

export interface CognitiveMonitorResult {
  checks: ComplianceCheck[];
  overallStatus: 'pass' | 'warning' | 'fail';
  requiresHumanReview: boolean;
  autoRepairAttempted: boolean;
  autoRepairSuccessful?: boolean;
}

// Parallel Reasoning Stream
export interface ReasoningStream {
  streamId: string;
  type: 'calculation' | 'narrative' | 'evidence' | 'validation';
  result: any;
  completionTimeMs: number;
  tokensUsed?: number;
}

export interface ParallelReasoningResult {
  streams: ReasoningStream[];
  merged: any;
  consistencyChecks: {
    numericalConsistency: boolean;
    logicalConsistency: boolean;
    evidenceAlignment: boolean;
  };
  totalTimeMs: number;
}

// Enhanced Routing Decision with Reasoning Profile
export interface EnhancedRoutingDecision {
  selectedModel: string;
  reasoning: string;
  fallbackModels: string[];
  reasoningProfile: ReasoningProfile;
  enableChainOfThought: boolean;
  enableMultiAgent: boolean;
  agentsToInvoke?: AgentType[];
  enableCognitiveMonitoring: boolean;
  enableParallelReasoning: boolean;
  costTier: 'free' | 'payg' | 'plus' | 'professional' | 'enterprise';
}

// Reasoning Governor Configuration
export interface ReasoningGovernorConfig {
  enableCoT: boolean;
  enableMultiAgent: boolean;
  enableCognitiveMonitoring: boolean;
  enableParallelReasoning: boolean;
  allowedAgents: AgentType[];
  maxConcurrentStreams: number;
  autoRepairEnabled: boolean;
  humanReviewThreshold: number; // confidence below this requires review
}

// Complete Reasoning Metadata (stored with message)
export interface ReasoningMetadata {
  profile: ReasoningProfile;
  chainOfThought?: ChainOfThoughtTrace;
  agentOutputs?: MergedAgentOutput;
  cognitiveMonitoring?: CognitiveMonitorResult;
  parallelReasoning?: ParallelReasoningResult;
  governorDecisions: string[];
  totalProcessingTimeMs: number;
  totalTokensUsed: number;
}
