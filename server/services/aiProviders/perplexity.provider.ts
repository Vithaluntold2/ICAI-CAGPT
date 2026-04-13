/**
 * Perplexity AI Provider
 * Implements the AIProvider interface for Perplexity's real-time search models
 */

import OpenAI from 'openai';
import { AIProvider } from './base';
import {
  AIProviderName,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  ProviderError,
  ProviderFeature,
  CostEstimate
} from './types';

export class PerplexityProvider extends AIProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(config: ProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new ProviderError(
        'Perplexity API key is required',
        AIProviderName.PERPLEXITY,
        'AUTHENTICATION_ERROR',
        false
      );
    }

    // Perplexity uses OpenAI-compatible API
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.perplexity.ai',
    });

    this.defaultModel = config.defaultModel || 'llama-3.1-sonar-large-128k-online';
  }

  getName(): AIProviderName {
    return AIProviderName.PERPLEXITY;
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const model = request.model || this.defaultModel;
      
      const response = await this.client.chat.completions.create({
        model,
        messages: request.messages as any,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens || 2000,
        stream: false,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No response from Perplexity API');
      }

      // Extract citations from response if available
      const citations = (response as any).citations || [];

      return {
        content: choice.message.content || '',
        finishReason: this.mapFinishReason(choice.finish_reason),
        tokensUsed: {
          input: response.usage?.prompt_tokens || 0,
          output: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0,
        },
        model: response.model,
        provider: AIProviderName.PERPLEXITY,
        metadata: {
          citations: citations.length > 0 ? citations : undefined,
        }
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async *generateCompletionStream(request: CompletionRequest): AsyncGenerator<string> {
    try {
      const model = request.model || this.defaultModel;
      
      const stream = await this.client.chat.completions.create({
        model,
        messages: request.messages as any,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens || 2000,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }

  estimateCost(request: CompletionRequest): CostEstimate {
    // Perplexity pricing (as of Nov 2024) for online models
    // llama-3.1-sonar-large-128k-online:
    // Input: $1.00 per million tokens
    // Output: $1.00 per million tokens
    // (Includes real-time search capabilities)
    
    const estimatedInputTokens = JSON.stringify(request.messages).length / 4;
    const estimatedOutputTokens = (request.maxTokens || 2000) * 0.7;
    
    const inputCost = (estimatedInputTokens / 1_000_000) * 1.00;
    const outputCost = (estimatedOutputTokens / 1_000_000) * 1.00;
    
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD'
    };
  }

  supportsFeature(feature: ProviderFeature): boolean {
    const supported: ProviderFeature[] = [
      ProviderFeature.CHAT_COMPLETION,
      ProviderFeature.REAL_TIME_SEARCH,
      ProviderFeature.STREAMING,
      ProviderFeature.LONG_CONTEXT,
    ];
    return supported.includes(feature);
  }

  getAvailableModels(): string[] {
    return [
      'llama-3.1-sonar-large-128k-online',
      'llama-3.1-sonar-small-128k-online',
      'llama-3.1-sonar-large-128k-chat',
      'llama-3.1-sonar-small-128k-chat',
    ];
  }

  /**
   * Map OpenAI finish reasons to standard finish reasons
   */
  private mapFinishReason(finishReason: string | null | undefined): CompletionResponse['finishReason'] {
    if (!finishReason) return 'stop';
    
    switch (finishReason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'function_call':
      case 'tool_calls':
        return 'tool_calls';
      case 'content_filter':
        return 'error';
      default:
        return 'stop';
    }
  }

  /**
   * Handle Perplexity-specific errors
   */
  private handleError(error: any): ProviderError {
    let code: ProviderError['code'] = 'UNKNOWN_ERROR';
    let retryable = false;
    let message = error.message || 'Unknown error occurred';

    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        code = 'RATE_LIMIT_EXCEEDED';
        retryable = true;
        message = 'Perplexity API rate limit exceeded. Please try again later.';
      } else if (error.status === 401 || error.status === 403) {
        code = 'AUTHENTICATION_ERROR';
        message = 'Perplexity API authentication failed. Please check your API key.';
      } else if (error.status === 400) {
        code = 'INVALID_REQUEST';
        message = `Invalid request to Perplexity API: ${error.message}`;
      } else if (error.status === 500 || error.status === 503) {
        code = 'PROVIDER_ERROR';
        retryable = true;
        message = 'Perplexity API is experiencing issues. Please try again.';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
        code = 'TIMEOUT_ERROR';
        retryable = true;
        message = 'Connection to Perplexity API timed out.';
      }
    }

    return new ProviderError(message, AIProviderName.PERPLEXITY, code, retryable);
  }
}
