/**
 * Model Selection Service
 * Selects optimal AI model based on query characteristics and provider capabilities
 */

import type { QueryClassification } from './providerRouter';

export interface ModelCapabilities {
  maxTokens: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  contextWindow: number;
  strengths: ModelStrength[];
}

export type ModelStrength = 
  | 'reasoning'
  | 'code-generation'
  | 'creative-writing'
  | 'analysis'
  | 'research'
  | 'mathematics'
  | 'multilingual';

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapabilities;
  costMultiplier: number; // Relative to base pricing
  recommendedFor: QueryClassification['complexity'][];
}

/**
 * Model Selector
 * Intelligent model selection based on query requirements
 */
export class ModelSelector {
  private models: Map<string, ModelConfig> = new Map();

  constructor() {
    this.initializeModels();
  }

  /**
   * Initialize model configurations
   */
  private initializeModels(): void {
    const models: ModelConfig[] = [
      // OpenAI Models
      {
        id: 'gpt-4-turbo-preview',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        capabilities: {
          maxTokens: 4096,
          supportsStreaming: true,
          supportsVision: true,
          supportsFunctionCalling: true,
          contextWindow: 128000,
          strengths: ['reasoning', 'code-generation', 'analysis', 'mathematics'],
        },
        costMultiplier: 1.0,
        recommendedFor: ['complex', 'expert'],
      },
      {
        id: 'gpt-4-0125-preview',
        name: 'GPT-4 0125',
        provider: 'openai',
        capabilities: {
          maxTokens: 4096,
          supportsStreaming: true,
          supportsVision: false,
          supportsFunctionCalling: true,
          contextWindow: 128000,
          strengths: ['reasoning', 'code-generation', 'analysis'],
        },
        costMultiplier: 0.9,
        recommendedFor: ['complex', 'expert'],
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        capabilities: {
          maxTokens: 4096,
          supportsStreaming: true,
          supportsVision: false,
          supportsFunctionCalling: true,
          contextWindow: 16385,
          strengths: ['code-generation', 'analysis'],
        },
        costMultiplier: 0.1,
        recommendedFor: ['simple', 'moderate'],
      },

      // Anthropic Models
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        capabilities: {
          maxTokens: 4096,
          supportsStreaming: true,
          supportsVision: true,
          supportsFunctionCalling: true,
          contextWindow: 200000,
          strengths: ['reasoning', 'analysis', 'creative-writing', 'research', 'code-generation'],
        },
        costMultiplier: 0.8,
        recommendedFor: ['moderate', 'complex', 'expert'],
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        capabilities: {
          maxTokens: 4096,
          supportsStreaming: true,
          supportsVision: true,
          supportsFunctionCalling: false,
          contextWindow: 200000,
          strengths: ['reasoning', 'analysis', 'creative-writing', 'research'],
        },
        costMultiplier: 1.5,
        recommendedFor: ['expert'],
      },

      // Google Models
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        capabilities: {
          maxTokens: 8192,
          supportsStreaming: true,
          supportsVision: true,
          supportsFunctionCalling: true,
          contextWindow: 1000000,
          strengths: ['reasoning', 'analysis', 'research', 'multilingual'],
        },
        costMultiplier: 0.3,
        recommendedFor: ['simple', 'moderate', 'complex'],
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        capabilities: {
          maxTokens: 8192,
          supportsStreaming: true,
          supportsVision: true,
          supportsFunctionCalling: true,
          contextWindow: 2000000,
          strengths: ['reasoning', 'analysis', 'research', 'multilingual', 'mathematics'],
        },
        costMultiplier: 0.7,
        recommendedFor: ['moderate', 'complex', 'expert'],
      },

      // Perplexity Models
      {
        id: 'sonar-pro',
        name: 'Sonar Pro',
        provider: 'perplexity',
        capabilities: {
          maxTokens: 4096,
          supportsStreaming: true,
          supportsVision: false,
          supportsFunctionCalling: false,
          contextWindow: 127000,
          strengths: ['research', 'analysis'],
        },
        costMultiplier: 1.2,
        recommendedFor: ['moderate', 'complex'],
      },
      {
        id: 'sonar-reasoning',
        name: 'Sonar Reasoning',
        provider: 'perplexity',
        capabilities: {
          maxTokens: 4096,
          supportsStreaming: true,
          supportsVision: false,
          supportsFunctionCalling: false,
          contextWindow: 127000,
          strengths: ['reasoning', 'research', 'analysis'],
        },
        costMultiplier: 1.5,
        recommendedFor: ['complex', 'expert'],
      },
    ];

    models.forEach(model => this.models.set(model.id, model));
    console.log(`[ModelSelector] Initialized ${models.length} model configurations`);
  }

  /**
   * Select best model for a query
   */
  selectModel(
    providerId: string,
    classification: QueryClassification,
    options?: {
      requireStreaming?: boolean;
      requireVision?: boolean;
      requireFunctionCalling?: boolean;
      maxCost?: number;
    }
  ): ModelConfig | null {
    // Get all models for this provider
    const providerModels = Array.from(this.models.values())
      .filter(model => model.provider === providerId.split('-')[0]); // Extract provider from ID like 'openai-gpt4'

    if (providerModels.length === 0) {
      console.warn(`[ModelSelector] No models found for provider: ${providerId}`);
      return null;
    }

    // Filter by requirements
    let candidates = providerModels.filter(model => {
      // Check streaming requirement
      if (options?.requireStreaming && !model.capabilities.supportsStreaming) {
        return false;
      }

      // Check vision requirement
      if (options?.requireVision && !model.capabilities.supportsVision) {
        return false;
      }

      // Check function calling requirement
      if (options?.requireFunctionCalling && !model.capabilities.supportsFunctionCalling) {
        return false;
      }

      // Check cost limit
      if (options?.maxCost && model.costMultiplier > options.maxCost) {
        return false;
      }

      // Check if recommended for complexity level
      if (!model.recommendedFor.includes(classification.complexity)) {
        return false;
      }

      return true;
    });

    if (candidates.length === 0) {
      // No models meet requirements, fall back to any model for this provider
      candidates = providerModels;
    }

    // Score each candidate
    const scoredModels = candidates.map(model => {
      let score = 0;

      // Complexity match (40%)
      if (model.recommendedFor.includes(classification.complexity)) {
        score += 0.4;
        // Bonus if it's the primary recommendation
        if (model.recommendedFor[0] === classification.complexity) {
          score += 0.1;
        }
      }

      // Capability match (30%)
      let capabilityScore = 0;
      if (classification.requiresReasoning && model.capabilities.strengths.includes('reasoning')) {
        capabilityScore += 0.4;
      }
      if (classification.requiresResearch && model.capabilities.strengths.includes('research')) {
        capabilityScore += 0.4;
      }
      if (classification.requiresCalculation && model.capabilities.strengths.includes('mathematics')) {
        capabilityScore += 0.2;
      }
      score += capabilityScore * 0.3;

      // Cost efficiency (20%)
      const costScore = 1 - (model.costMultiplier / 2); // Normalize cost multiplier
      score += Math.max(0, costScore) * 0.2;

      // Context window (10%) - bonus for larger context
      const contextScore = Math.min(model.capabilities.contextWindow / 200000, 1);
      score += contextScore * 0.1;

      return { model, score };
    });

    // Sort by score
    scoredModels.sort((a, b) => b.score - a.score);

    const selected = scoredModels[0]?.model || null;

    if (selected) {
      console.log(
        `[ModelSelector] Selected ${selected.name} for ${classification.complexity} query ` +
        `(score: ${scoredModels[0].score.toFixed(2)})`
      );
    }

    return selected;
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): ModelConfig | null {
    return this.models.get(modelId) || null;
  }

  /**
   * Get all models for a provider
   */
  getProviderModels(provider: string): ModelConfig[] {
    return Array.from(this.models.values())
      .filter(model => model.provider === provider);
  }

  /**
   * Get models by capability
   */
  getModelsByCapability(strength: ModelStrength): ModelConfig[] {
    return Array.from(this.models.values())
      .filter(model => model.capabilities.strengths.includes(strength));
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const models = Array.from(this.models.values());

    return {
      totalModels: models.length,
      modelsByProvider: models.reduce((acc, model) => {
        acc[model.provider] = (acc[model.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      averageCostMultiplier: models.reduce((sum, m) => sum + m.costMultiplier, 0) / models.length,
      averageContextWindow: models.reduce((sum, m) => sum + m.capabilities.contextWindow, 0) / models.length,
    };
  }
}

// Singleton instance
export const modelSelector = new ModelSelector();
