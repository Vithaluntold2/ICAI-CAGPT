/**
 * Provider Capability Registry
 * Tracks which AI providers support advanced reasoning features
 */

import type { ProviderCapabilities, ReasoningCapability } from '../../shared/types/reasoning';

export const PROVIDER_CAPABILITIES: ProviderCapabilities[] = [
  // Anthropic Claude (CRITICAL: providerId must match AIProviderName.CLAUDE = 'claude')
  {
    providerId: 'claude',
    modelId: 'claude-3-5-sonnet-20241022',
    capabilities: ['chain-of-thought', 'long-context', 'structured-output', 'function-calling'],
    maxContextTokens: 200000,
    supportsStreaming: true,
    optimalFor: ['research', 'audit', 'complex-reasoning', 'multi-step-analysis']
  },
  
  // Google Gemini (CRITICAL: providerId must match AIProviderName.GEMINI = 'gemini')
  {
    providerId: 'gemini',
    modelId: 'gemini-2.0-flash-exp',
    capabilities: ['chain-of-thought', 'long-context', 'multi-modal', 'function-calling'],
    maxContextTokens: 128000,
    supportsStreaming: true,
    optimalFor: ['calculation', 'document-analysis', 'quick-reasoning']
  },
  
  // Perplexity (Online Research)
  {
    providerId: 'perplexity',
    modelId: 'llama-3.1-sonar-large-128k-online',
    capabilities: ['long-context', 'structured-output'],
    maxContextTokens: 128000,
    supportsStreaming: true,
    optimalFor: ['research', 'current-events', 'regulation-lookup']
  },
  
  // Azure OpenAI
  {
    providerId: 'azure-openai',
    modelId: 'gpt-4o',
    capabilities: ['chain-of-thought', 'long-context', 'structured-output', 'function-calling'],
    maxContextTokens: 128000,
    supportsStreaming: true,
    optimalFor: ['general', 'calculation', 'structured-output']
  },
  
  // OpenAI
  {
    providerId: 'openai',
    modelId: 'gpt-4o',
    capabilities: ['chain-of-thought', 'long-context', 'structured-output', 'function-calling'],
    maxContextTokens: 128000,
    supportsStreaming: true,
    optimalFor: ['general', 'calculation', 'structured-output']
  },
  {
    providerId: 'openai',
    modelId: 'gpt-4o-mini',
    capabilities: ['chain-of-thought', 'structured-output', 'function-calling'],
    maxContextTokens: 128000,
    supportsStreaming: true,
    optimalFor: ['quick-queries', 'simple-calculations']
  }
];

/**
 * Check if a provider supports a specific capability
 */
export function providerHasCapability(
  providerId: string,
  modelId: string,
  capability: ReasoningCapability
): boolean {
  const provider = PROVIDER_CAPABILITIES.find(
    p => p.providerId === providerId && p.modelId === modelId
  );
  return provider?.capabilities.includes(capability) ?? false;
}

/**
 * Get optimal providers for a specific use case
 */
export function getOptimalProvidersFor(useCase: string): ProviderCapabilities[] {
  return PROVIDER_CAPABILITIES.filter(p => 
    p.optimalFor.includes(useCase)
  );
}

/**
 * Check if provider supports chain-of-thought reasoning
 */
export function supportsChainOfThought(providerId: string, modelId: string): boolean {
  return providerHasCapability(providerId, modelId, 'chain-of-thought');
}

/**
 * Check if provider supports long context
 */
export function supportsLongContext(providerId: string, modelId: string): boolean {
  return providerHasCapability(providerId, modelId, 'long-context');
}

/**
 * Get maximum context tokens for provider
 */
export function getMaxContextTokens(providerId: string, modelId: string): number {
  const provider = PROVIDER_CAPABILITIES.find(
    p => p.providerId === providerId && p.modelId === modelId
  );
  return provider?.maxContextTokens ?? 8000; // Default fallback
}
