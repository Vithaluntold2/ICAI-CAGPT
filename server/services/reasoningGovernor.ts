/**
 * Reasoning Governor
 * Orchestrates advanced AI reasoning capabilities: CoT, multi-agent, cognitive monitoring
 * 
 * IMPORTANT: This service is opt-in via feature flags and preserves existing routing behavior
 */

import type {
  ReasoningProfile,
  EnhancedRoutingDecision,
  ReasoningGovernorConfig,
  ReasoningMetadata,
  ChainOfThoughtTrace,
  AgentType
} from '../../shared/types/reasoning';
import { supportsChainOfThought } from './providerCapabilities';

// Feature flags - aligned with documented names
// CoT is enabled by default (just better prompting, no extra cost)
// Monitoring and multi-agent are opt-in (require extra API calls)
const FEATURE_FLAGS = {
  ENABLE_CHAIN_OF_THOUGHT: process.env.ENABLE_COT_REASONING !== 'false', // Default ON
  ENABLE_MULTI_AGENT: process.env.ENABLE_MULTI_AGENT === 'true' || false,
  ENABLE_COGNITIVE_MONITORING: process.env.ENABLE_COMPLIANCE_MONITORING === 'true' || 
                              process.env.ENABLE_VALIDATION_AGENT === 'true' || false,
  ENABLE_PARALLEL_REASONING: process.env.ENABLE_PARALLEL_REASONING === 'true' || false,
};

export class ReasoningGovernor {
  private config: ReasoningGovernorConfig;

  constructor(config?: Partial<ReasoningGovernorConfig>) {
    this.config = {
      enableCoT: config?.enableCoT ?? FEATURE_FLAGS.ENABLE_CHAIN_OF_THOUGHT,
      enableMultiAgent: config?.enableMultiAgent ?? FEATURE_FLAGS.ENABLE_MULTI_AGENT,
      enableCognitiveMonitoring: config?.enableCognitiveMonitoring ?? FEATURE_FLAGS.ENABLE_COGNITIVE_MONITORING,
      enableParallelReasoning: config?.enableParallelReasoning ?? FEATURE_FLAGS.ENABLE_PARALLEL_REASONING,
      allowedAgents: config?.allowedAgents ?? ['research', 'audit', 'calculation', 'compliance', 'validation'],
      maxConcurrentStreams: config?.maxConcurrentStreams ?? 3,
      autoRepairEnabled: config?.autoRepairEnabled ?? true,
      humanReviewThreshold: config?.humanReviewThreshold ?? 0.7,
    };
  }

  /**
   * Determine reasoning profile based on query classification and chat mode
   * This is the main decision point that doesn't break existing routing
   * 
   * CRITICAL: Research and Calculate modes ALWAYS use CoT (when enabled)
   * regardless of complexity - this is how we surpass ChatGPT quality
   */
  determineReasoningProfile(
    classification: any,
    chatMode: string,
    subscriptionTier: string
  ): ReasoningProfile {
    // Free tier always uses fast reasoning (preserves current behavior)
    if (subscriptionTier === 'free') {
      return 'fast';
    }

    // CRITICAL FIX: Research and Calculate modes ALWAYS benefit from CoT (not just complex)
    // This is the key quality improvement - explicit step-by-step reasoning
    // Frontend sends 'deep-research' and 'calculation' as mode names
    if ((chatMode === 'deep-research' || chatMode === 'calculation')) {
      if (this.config.enableCoT) {
        return 'cot';
      }
    }

    // Audit mode can benefit from multi-agent approach for complex cases
    if (chatMode === 'audit-plan' && classification.complexity === 'complex') {
      if (this.config.enableMultiAgent) {
        return 'multi-agent';
      }
    }

    // High-stakes financial calculations can use parallel reasoning
    if (chatMode === 'calculation' && 
        (subscriptionTier === 'professional' || subscriptionTier === 'enterprise')) {
      if (this.config.enableParallelReasoning) {
        return 'parallel';
      }
    }

    // Default: standard fast reasoning (current behavior)
    return 'fast';
  }

  /**
   * Enhance routing decision with reasoning profile
   * This wraps the existing router output without modifying it
   */
  enhanceRoutingDecision(
    existingDecision: any,
    classification: any,
    chatMode: string,
    subscriptionTier: string
  ): EnhancedRoutingDecision {
    const profile = this.determineReasoningProfile(classification, chatMode, subscriptionTier);
    
    // Determine which agents to invoke based on chat mode and profile
    const agentsToInvoke: AgentType[] = [];
    if (profile === 'multi-agent' && chatMode === 'audit-plan') {
      agentsToInvoke.push('audit', 'compliance');
    }
    if (profile === 'multi-agent' && chatMode === 'deep-research') {
      agentsToInvoke.push('research', 'validation');
    }

    // Check if selected model supports CoT
    // CRITICAL FIX: Normalize routing decision fields with fallbacks
    const provider = existingDecision.preferredProvider || 'azure-openai'; // Default to azure-openai
    const modelName = existingDecision.primaryModel || existingDecision.selectedModel || 'gpt-4o-mini';
    const modelSupportsCoT = supportsChainOfThought(provider, modelName);

    return {
      selectedModel: modelName,
      reasoning: existingDecision.reasoning,
      fallbackModels: existingDecision.fallbackProviders || existingDecision.fallbackModels || [],
      reasoningProfile: profile,
      enableChainOfThought: profile === 'cot' && modelSupportsCoT && this.config.enableCoT,
      enableMultiAgent: profile === 'multi-agent' && this.config.enableMultiAgent,
      agentsToInvoke: agentsToInvoke.length > 0 ? agentsToInvoke : undefined,
      enableCognitiveMonitoring: this.shouldEnableCognitiveMonitoring(chatMode, subscriptionTier),
      enableParallelReasoning: profile === 'parallel' && this.config.enableParallelReasoning,
      costTier: subscriptionTier as any,
    };
  }

  /**
   * Determine if cognitive monitoring should be enabled
   * Always enable for paid tiers in regulated modes
   */
  private shouldEnableCognitiveMonitoring(chatMode: string, subscriptionTier: string): boolean {
    if (!this.config.enableCognitiveMonitoring) {
      return false;
    }

    // Always monitor in Calculate, Audit, and Research modes for paid tiers
    const regulatedModes = ['calculation', 'audit-plan', 'deep-research'];
    const paidTiers = ['payg', 'plus', 'professional', 'enterprise'];
    
    return regulatedModes.includes(chatMode) && paidTiers.includes(subscriptionTier);
  }

  /**
   * Build reasoning metadata object (stored with message)
   * This is backward compatible - existing code ignores these fields
   */
  buildReasoningMetadata(
    profile: ReasoningProfile,
    processingTimeMs: number,
    tokensUsed: number,
    governorDecisions: string[]
  ): Partial<ReasoningMetadata> {
    return {
      profile,
      governorDecisions,
      totalProcessingTimeMs: processingTimeMs,
      totalTokensUsed: tokensUsed,
      // Other fields (chainOfThought, agentOutputs, etc.) added by respective services
    };
  }

  /**
   * Get Chain-of-Thought prompt enhancement
   * Returns additional system prompt to inject
   * CRITICAL: Frontend sends 'calculation', 'deep-research', 'audit-plan' as mode names
   */
  getCoTPromptEnhancement(chatMode: string): string {
    if (chatMode === 'calculation') {
      return `

IMPORTANT REASONING INSTRUCTIONS:
Before providing your final answer, think through the problem step-by-step:

1. **Problem Analysis**: What is being asked? What are the key variables?
2. **Relevant Rules**: Which tax codes, GAAP principles, or financial regulations apply?
3. **Calculation Steps**: Show each mathematical operation clearly
4. **Verification**: Double-check your math and logic
5. **Final Answer**: State your conclusion with confidence level

Use this format:
🧮 **Step-by-Step Analysis:**
[Your reasoning here]

📊 **Final Answer:**
[Your conclusion here]`;
    }

    if (chatMode === 'deep-research') {
      return `

IMPORTANT REASONING INSTRUCTIONS:
Conduct thorough research with explicit reasoning:

1. **Query Understanding**: Restate the question in your own words
2. **Source Identification**: What authoritative sources will you consult?
3. **Evidence Gathering**: List key findings from each source
4. **Synthesis**: How do these sources relate to each other?
5. **Conclusion**: What is the best answer based on the evidence?

Cite sources and show confidence levels for each claim.`;
    }

    if (chatMode === 'audit-plan') {
      return `

IMPORTANT REASONING INSTRUCTIONS:
Apply systematic audit thinking:

1. **Risk Assessment**: What could go wrong? What are the material risks?
2. **Control Evaluation**: What controls exist? Are they effective?
3. **Testing Strategy**: How would you test these controls?
4. **Evidence Requirements**: What documentation would you need?
5. **Conclusion**: Overall assessment and recommendations

Think like a CPA conducting an audit.`;
    }

    // Default: encourage clear reasoning for all modes
    return `

Think through your response systematically before answering. Show your reasoning clearly.`;
  }

  /**
   * Check if governor is enabled for this request
   * Allows gradual rollout without breaking existing functionality
   */
  isEnabled(): boolean {
    return this.config.enableCoT || 
           this.config.enableMultiAgent || 
           this.config.enableCognitiveMonitoring || 
           this.config.enableParallelReasoning;
  }

  /**
   * Get configuration for debugging/monitoring
   */
  getConfig(): ReasoningGovernorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime (for A/B testing)
   */
  updateConfig(updates: Partial<ReasoningGovernorConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
    };
  }
}

// Export singleton instance
export const reasoningGovernor = new ReasoningGovernor();
