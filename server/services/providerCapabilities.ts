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
    supportsForcedToolCall: true,
    optimalFor: ['research', 'audit', 'complex-reasoning', 'multi-step-analysis']
  },
  
  // Google Gemini (CRITICAL: providerId must match AIProviderName.GEMINI = 'gemini')
  {
    providerId: 'gemini',
    modelId: 'gemini-2.0-flash-exp',
    capabilities: ['chain-of-thought', 'long-context', 'multi-modal', 'function-calling'],
    maxContextTokens: 128000,
    supportsStreaming: true,
    // Gemini adapter does not currently plumb tools through. Until that
    // lands, the router must not pick Gemini for any request that
    // forces a tool call.
    supportsForcedToolCall: false,
    optimalFor: ['calculation', 'document-analysis', 'quick-reasoning']
  },
  
  // Perplexity (Online Research)
  {
    providerId: 'perplexity',
    modelId: 'llama-3.1-sonar-large-128k-online',
    capabilities: ['long-context', 'structured-output'],
    maxContextTokens: 128000,
    supportsStreaming: true,
    supportsForcedToolCall: false,
    optimalFor: ['research', 'current-events', 'regulation-lookup']
  },
  
  // Azure OpenAI
  {
    providerId: 'azure-openai',
    modelId: 'gpt-4o',
    capabilities: ['chain-of-thought', 'long-context', 'structured-output', 'function-calling'],
    maxContextTokens: 128000,
    supportsStreaming: true,
    supportsForcedToolCall: true,
    optimalFor: ['general', 'calculation', 'structured-output']
  },
  
  // OpenAI
  {
    providerId: 'openai',
    modelId: 'gpt-4o',
    capabilities: ['chain-of-thought', 'long-context', 'structured-output', 'function-calling'],
    maxContextTokens: 128000,
    supportsStreaming: true,
    supportsForcedToolCall: true,
    optimalFor: ['general', 'calculation', 'structured-output']
  },
  {
    providerId: 'openai',
    modelId: 'gpt-4o-mini',
    capabilities: ['chain-of-thought', 'structured-output', 'function-calling'],
    maxContextTokens: 128000,
    supportsStreaming: true,
    supportsForcedToolCall: true,
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

/**
 * Check if provider supports forced tool calls (tool_choice: 'required' or
 * pinning to a specific tool). Used by the router to filter out providers
 * that cannot guarantee deterministic tool invocation when the caller
 * explicitly requests it (e.g. Spreadsheet Mode, Two-Agent Solver Agent 2).
 */
export function supportsForcedToolCall(providerId: string, modelId: string): boolean {
  const provider = PROVIDER_CAPABILITIES.find(
    p => p.providerId === providerId && p.modelId === modelId
  );
  return provider?.supportsForcedToolCall === true;
}

/**
 * Router filter: given a candidate list of provider ids, return only those
 * that have at least one model capable of forced tool calls. Callers that
 * need deterministic tool invocation (Spreadsheet Mode, Two-Agent Solver
 * Agent 2) should pass their ordered preference list through this before
 * dispatch so Gemini/Perplexity are skipped cleanly instead of failing at
 * the adapter boundary with UNSUPPORTED_TOOL_CHOICE.
 */
export function filterProvidersWithForcedToolCall(providerIds: string[]): string[] {
  return providerIds.filter(id =>
    PROVIDER_CAPABILITIES.some(p => p.providerId === id && p.supportsForcedToolCall === true)
  );
}
