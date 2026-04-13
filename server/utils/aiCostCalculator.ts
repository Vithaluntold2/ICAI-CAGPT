/**
 * AI Provider Cost Calculator
 * Calculates token usage costs for different AI providers
 * All costs are returned in cents (USD)
 * 
 * ⚠️  CRITICAL WARNINGS:
 * 1. Pricing data is hardcoded as of 2024 - WILL BECOME STALE
 * 2. Provider pricing changes frequently - verify against actual bills
 * 3. Token counting methods vary by provider
 * 4. TODO: Move pricing to database table with effective dates
 * 5. TODO: Add pricing update notification system
 */

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface CostResult {
  tokensUsed: number;
  costUsd: number; // in cents
}

// Pricing as of January 2026 (in USD per 1M tokens)
// Last updated: 2026-01-05
// TODO: Implement database-backed pricing with effective dates and automatic staleness alerts
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI (verified Jan 2026)
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-2024-11-20': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4-turbo-2024-04-09': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-4-0613': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'gpt-3.5-turbo-0125': { input: 0.50, output: 1.50 },
  'o1-preview': { input: 15.00, output: 60.00 },
  'o1-mini': { input: 3.00, output: 12.00 },
  
  // Anthropic Claude (verified Jan 2026)
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20240620': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  
  // Azure OpenAI (same pricing as OpenAI)
  'azure-gpt-4o': { input: 2.50, output: 10.00 },
  'azure-gpt-4-turbo': { input: 10.00, output: 30.00 },
  'azure-gpt-35-turbo': { input: 0.50, output: 1.50 },
  
  // Google Gemini (verified Jan 2026)
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash-8b': { input: 0.0375, output: 0.15 },
  'gemini-pro': { input: 0.50, output: 1.50 },
};

/**
 * Calculate cost for AI API call
 * @param provider AI provider name (openai, anthropic, azure, google)
 * @param model Model identifier
 * @param usage Token usage object
 * @returns Cost in cents and total tokens
 */
export function calculateAICost(
  provider: string,
  model: string,
  usage: TokenUsage
): CostResult {
  const normalizedModel = normalizeModelName(provider, model);
  const pricing = PRICING[normalizedModel];
  
  if (!pricing) {
    console.warn(`[AI Cost] No pricing data for ${provider}/${model}, using default`);
    // Default fallback pricing
    return {
      tokensUsed: usage.totalTokens,
      costUsd: Math.round((usage.totalTokens / 1_000_000) * 5.00 * 100) // $5 per 1M tokens
    };
  }
  
  // Validation: Check for invalid token counts
  if (usage.totalTokens < 0 || usage.promptTokens < 0 || usage.completionTokens < 0) {
    console.warn(`[AI Cost] Invalid token counts: prompt=${usage.promptTokens}, completion=${usage.completionTokens}`);
    return { tokensUsed: 0, costUsd: 0 };
  }
  
  if (usage.totalTokens > 1_000_000) {
    console.warn(`[AI Cost] Unusually high token count: ${usage.totalTokens} - possible error`);
  }
  
  // Calculate cost: (tokens / 1M) * price_per_1M
  const inputCost = (usage.promptTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.output;
  const totalCostUsd = inputCost + outputCost;
  
  // Validation: Check for calculation errors
  if (isNaN(totalCostUsd) || !isFinite(totalCostUsd)) {
    console.error(`[AI Cost] Invalid cost calculation: ${totalCostUsd}`);
    return { tokensUsed: usage.totalTokens, costUsd: 0 };
  }
  
  return {
    tokensUsed: usage.totalTokens,
    costUsd: Math.round(totalCostUsd * 100) // Convert to cents
  };
}

/**
 * Normalize model names to match pricing table
 */
function normalizeModelName(provider: string, model: string): string {
  const lower = model.toLowerCase();
  
  // Handle provider-specific prefixes
  if (provider === 'azure') {
    if (lower.includes('gpt-4o')) return 'azure-gpt-4o';
    if (lower.includes('gpt-4')) return 'azure-gpt-4-turbo';
    if (lower.includes('gpt-35') || lower.includes('gpt-3.5')) return 'azure-gpt-35-turbo';
  }
  
  // OpenAI models
  if (lower.includes('gpt-4o-mini')) return 'gpt-4o-mini';
  if (lower.includes('gpt-4o')) return 'gpt-4o';
  if (lower.includes('gpt-4-turbo')) return 'gpt-4-turbo';
  if (lower.includes('gpt-4')) return 'gpt-4';
  if (lower.includes('gpt-3.5')) return 'gpt-3.5-turbo';
  
  // Anthropic models
  if (lower.includes('claude-3-5-sonnet-20241022')) return 'claude-3-5-sonnet-20241022';
  if (lower.includes('claude-3-5-sonnet')) return 'claude-3-5-sonnet-20240620';
  if (lower.includes('claude-3-opus')) return 'claude-3-opus-20240229';
  if (lower.includes('claude-3-sonnet')) return 'claude-3-sonnet-20240229';
  if (lower.includes('claude-3-haiku')) return 'claude-3-haiku-20240307';
  
  // Google models
  if (lower.includes('gemini-1.5-pro')) return 'gemini-1.5-pro';
  if (lower.includes('gemini-1.5-flash')) return 'gemini-1.5-flash';
  if (lower.includes('gemini-pro')) return 'gemini-pro';
  
  // Return original if no match
  return model;
}

/**
 * Get all supported models with pricing
 */
export function getSupportedModels() {
  return Object.keys(PRICING).map(model => ({
    model,
    pricing: PRICING[model]
  }));
}

/**
 * Estimate cost before making API call
 * @param provider AI provider
 * @param model Model name
 * @param estimatedTokens Estimated token count
 * @returns Estimated cost in cents
 */
export function estimateCost(
  provider: string,
  model: string,
  estimatedTokens: number
): number {
  const normalizedModel = normalizeModelName(provider, model);
  const pricing = PRICING[normalizedModel];
  
  if (!pricing) {
    return Math.round((estimatedTokens / 1_000_000) * 5.00 * 100);
  }
  
  // Assume 70/30 split for prompt/completion
  const promptTokens = Math.round(estimatedTokens * 0.7);
  const completionTokens = Math.round(estimatedTokens * 0.3);
  
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  
  return Math.round((inputCost + outputCost) * 100);
}
