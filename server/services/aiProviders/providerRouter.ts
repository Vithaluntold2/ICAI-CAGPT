/**
 * AI Provider Router
 * Intelligent routing to optimal AI providers based on query type, cost, and health
 */

import type { ProfessionalMode } from '../../../shared/types/agentTypes';

export interface AIProvider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'azure' | 'perplexity';
  models: string[];
  capabilities: AICapability[];
  costPerToken: {
    input: number;
    output: number;
  };
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  priority: number; // 1-10, higher is preferred
}

export type AICapability = 
  | 'chat' 
  | 'code-generation' 
  | 'reasoning' 
  | 'research' 
  | 'analysis' 
  | 'streaming';

export interface RoutingDecision {
  providerId: string;
  providerName: string;
  model: string;
  reasoning: string;
  estimatedCost: number;
  confidence: number; // 0-1
}

export interface QueryClassification {
  mode: ProfessionalMode;
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  requiresReasoning: boolean;
  requiresResearch: boolean;
  requiresCalculation: boolean;
  estimatedTokens: number;
  urgency: 'low' | 'normal' | 'high';
}

/**
 * Provider Router
 * Routes queries to optimal AI providers
 */
export class ProviderRouter {
  private providers: Map<string, AIProvider> = new Map();
  private providerHealth: Map<string, number> = new Map(); // 0-1 health score
  private requestCounts: Map<string, number[]> = new Map(); // Sliding window of request timestamps

  constructor() {
    this.initializeProviders();
    this.startHealthMonitoring();
  }

  /**
   * Initialize AI providers
   */
  private initializeProviders(): void {
    const providers: AIProvider[] = [
      {
        id: 'openai-gpt4',
        name: 'OpenAI GPT-4',
        type: 'openai',
        models: ['gpt-4-turbo-preview', 'gpt-4-0125-preview'],
        capabilities: ['chat', 'code-generation', 'reasoning', 'analysis'],
        costPerToken: { input: 0.00001, output: 0.00003 },
        rateLimit: { requestsPerMinute: 500, tokensPerMinute: 150000 },
        priority: 8,
      },
      {
        id: 'anthropic-claude',
        name: 'Anthropic Claude 3.5 Sonnet',
        type: 'anthropic',
        models: ['claude-3-5-sonnet-20241022'],
        capabilities: ['chat', 'code-generation', 'reasoning', 'analysis', 'research'],
        costPerToken: { input: 0.000003, output: 0.000015 },
        rateLimit: { requestsPerMinute: 1000, tokensPerMinute: 400000 },
        priority: 9,
      },
      {
        id: 'google-gemini',
        name: 'Google Gemini Pro',
        type: 'google',
        models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro'],
        capabilities: ['chat', 'reasoning', 'analysis', 'research'],
        costPerToken: { input: 0.000001, output: 0.000002 },
        rateLimit: { requestsPerMinute: 2000, tokensPerMinute: 1000000 },
        priority: 7,
      },
      {
        id: 'azure-openai',
        name: 'Azure OpenAI',
        type: 'azure',
        models: ['gpt-4-turbo', 'gpt-35-turbo'],
        capabilities: ['chat', 'code-generation', 'reasoning', 'analysis'],
        costPerToken: { input: 0.00001, output: 0.00003 },
        rateLimit: { requestsPerMinute: 800, tokensPerMinute: 200000 },
        priority: 6,
      },
      {
        id: 'perplexity-research',
        name: 'Perplexity Research',
        type: 'perplexity',
        models: ['sonar-pro', 'sonar-reasoning'],
        capabilities: ['research', 'analysis', 'reasoning'],
        costPerToken: { input: 0.000005, output: 0.000015 },
        rateLimit: { requestsPerMinute: 100, tokensPerMinute: 50000 },
        priority: 8,
      },
    ];

    providers.forEach(provider => {
      this.providers.set(provider.id, provider);
      this.providerHealth.set(provider.id, 1.0); // Start healthy
    });

    console.log(`[ProviderRouter] Initialized ${providers.length} AI providers`);
  }

  /**
   * Route a query to the best AI provider
   */
  async route(
    classification: QueryClassification,
    userTier: string = 'free'
  ): Promise<RoutingDecision> {
    // Get available providers
    const availableProviders = Array.from(this.providers.values())
      .filter(provider => {
        // Check health
        const health = this.providerHealth.get(provider.id) || 0;
        if (health < 0.3) return false;

        // Check rate limits
        if (!this.checkRateLimit(provider.id)) return false;

        // Check capabilities match query needs
        if (classification.requiresResearch && !provider.capabilities.includes('research')) {
          return false;
        }
        if (classification.requiresReasoning && !provider.capabilities.includes('reasoning')) {
          return false;
        }

        return true;
      });

    if (availableProviders.length === 0) {
      throw new Error('No available AI providers meet requirements');
    }

    // Score each provider
    const scoredProviders = availableProviders.map(provider => {
      let score = 0;

      // Priority weight (30%)
      score += (provider.priority / 10) * 0.3;

      // Health weight (25%)
      score += (this.providerHealth.get(provider.id) || 0) * 0.25;

      // Cost weight (25%) - inverse (lower cost = higher score)
      const avgCost = (provider.costPerToken.input + provider.costPerToken.output) / 2;
      const maxCost = 0.00003;
      score += (1 - (avgCost / maxCost)) * 0.25;

      // Capability match weight (20%)
      let capabilityScore = 0;
      if (classification.requiresResearch && provider.capabilities.includes('research')) {
        capabilityScore += 0.4;
      }
      if (classification.requiresReasoning && provider.capabilities.includes('reasoning')) {
        capabilityScore += 0.3;
      }
      if (classification.requiresCalculation && provider.capabilities.includes('analysis')) {
        capabilityScore += 0.3;
      }
      score += capabilityScore * 0.2;

      return { provider, score };
    });

    // Sort by score
    scoredProviders.sort((a, b) => b.score - a.score);

    // Select best provider
    const best = scoredProviders[0];
    const provider = best.provider;

    // Select best model for this provider
    const model = this.selectModel(provider, classification);

    // Track request
    this.trackRequest(provider.id);

    // Calculate estimated cost
    const estimatedCost = this.calculateCost(
      provider,
      classification.estimatedTokens
    );

    return {
      providerId: provider.id,
      providerName: provider.name,
      model,
      reasoning: this.generateReasoningExplanation(provider, classification),
      estimatedCost,
      confidence: best.score,
    };
  }

  /**
   * Select best model from provider
   */
  private selectModel(
    provider: AIProvider,
    classification: QueryClassification
  ): string {
    // For now, use first model (can be enhanced with model-specific logic)
    if (classification.complexity === 'expert') {
      // Prefer more powerful models for complex queries
      return provider.models[0];
    }
    
    // Use most cost-effective model for simpler queries
    return provider.models[provider.models.length - 1];
  }

  /**
   * Check if provider is within rate limits
   */
  private checkRateLimit(providerId: string): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Get recent requests
    const requests = this.requestCounts.get(providerId) || [];
    const recentRequests = requests.filter(timestamp => timestamp > oneMinuteAgo);

    // Update request history
    this.requestCounts.set(providerId, recentRequests);

    const provider = this.providers.get(providerId);
    if (!provider) return false;

    return recentRequests.length < provider.rateLimit.requestsPerMinute;
  }

  /**
   * Track a request to a provider
   */
  private trackRequest(providerId: string): void {
    const requests = this.requestCounts.get(providerId) || [];
    requests.push(Date.now());
    this.requestCounts.set(providerId, requests);
  }

  /**
   * Calculate estimated cost for a query
   */
  private calculateCost(
    provider: AIProvider,
    estimatedTokens: number
  ): number {
    // Assume 60% input, 40% output token distribution
    const inputTokens = estimatedTokens * 0.6;
    const outputTokens = estimatedTokens * 0.4;

    const cost = 
      (inputTokens * provider.costPerToken.input) +
      (outputTokens * provider.costPerToken.output);

    return cost;
  }

  /**
   * Generate explanation for routing decision
   */
  private generateReasoningExplanation(
    provider: AIProvider,
    classification: QueryClassification
  ): string {
    const reasons: string[] = [];

    if (classification.requiresResearch && provider.capabilities.includes('research')) {
      reasons.push('excellent research capabilities');
    }
    if (classification.requiresReasoning && provider.capabilities.includes('reasoning')) {
      reasons.push('strong reasoning abilities');
    }
    if (classification.complexity === 'expert') {
      reasons.push('advanced model for complex queries');
    }

    const health = this.providerHealth.get(provider.id) || 0;
    if (health > 0.9) {
      reasons.push('high availability');
    }

    const avgCost = (provider.costPerToken.input + provider.costPerToken.output) / 2;
    if (avgCost < 0.00001) {
      reasons.push('cost-effective');
    }

    return `Selected ${provider.name} for ${reasons.join(', ')}`;
  }

  /**
   * Update provider health score
   */
  updateHealth(providerId: string, success: boolean, responseTime?: number): void {
    const currentHealth = this.providerHealth.get(providerId) || 1.0;

    // Exponential moving average
    const alpha = 0.2; // Weight for new data
    const newHealth = success ? 1.0 : 0.0;
    const updatedHealth = (alpha * newHealth) + ((1 - alpha) * currentHealth);

    this.providerHealth.set(providerId, Math.max(0, Math.min(1, updatedHealth)));

    console.log(
      `[ProviderRouter] Updated health for ${providerId}: ${updatedHealth.toFixed(3)} ` +
      `(${success ? 'success' : 'failure'})`
    );
  }

  /**
   * Get provider health status
   */
  getProviderHealth(providerId: string): number {
    return this.providerHealth.get(providerId) || 0;
  }

  /**
   * Get all provider health statuses
   */
  getAllProviderHealth(): Record<string, number> {
    const health: Record<string, number> = {};
    for (const [id, score] of Array.from(this.providerHealth.entries())) {
      health[id] = score;
    }
    return health;
  }

  /**
   * Get router statistics
   */
  getStatistics() {
    const stats = {
      totalProviders: this.providers.size,
      healthyProviders: 0,
      degradedProviders: 0,
      unhealthyProviders: 0,
      totalRequests: 0,
      requestsByProvider: {} as Record<string, number>,
      averageHealth: 0,
    };

    let totalHealth = 0;

    for (const [id, provider] of Array.from(this.providers.entries())) {
      const health = this.providerHealth.get(id) || 0;
      totalHealth += health;

      if (health >= 0.8) stats.healthyProviders++;
      else if (health >= 0.5) stats.degradedProviders++;
      else stats.unhealthyProviders++;

      const requests = this.requestCounts.get(id) || [];
      stats.requestsByProvider[provider.name] = requests.length;
      stats.totalRequests += requests.length;
    }

    stats.averageHealth = totalHealth / this.providers.size;

    return stats;
  }

  /**
   * Start health monitoring (simulated for now)
   */
  private startHealthMonitoring(): void {
    // In production, this would ping providers periodically
    // For now, maintain current health scores
    console.log('[ProviderRouter] Health monitoring started');
  }

  /**
   * Force provider offline (for testing/maintenance)
   */
  setProviderOffline(providerId: string): void {
    this.providerHealth.set(providerId, 0);
    console.log(`[ProviderRouter] Set ${providerId} offline`);
  }

  /**
   * Force provider online
   */
  setProviderOnline(providerId: string): void {
    this.providerHealth.set(providerId, 1.0);
    console.log(`[ProviderRouter] Set ${providerId} online`);
  }
}

// Singleton instance
export const providerRouter = new ProviderRouter();
