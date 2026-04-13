/**
 * Base AI Provider Interface
 * All LLM providers must implement this interface
 */

import {
  AIProviderName,
  ProviderFeature,
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
  CostEstimate,
} from './types';

export abstract class AIProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Get the provider name
   */
  abstract getName(): AIProviderName;

  /**
   * Generate a completion response
   */
  abstract generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse>;

  /**
   * Transcribe audio to text
   */
  async transcribeAudio(
    request: import('./types').AudioTranscriptionRequest
  ): Promise<import('./types').AudioTranscriptionResponse> {
    throw new Error(`Method transcribeAudio not implemented for ${this.getName()}`);
  }

  /**
   * Convert text to speech
   */
  async generateSpeech(
    request: import('./types').SpeechRequest
  ): Promise<import('./types').SpeechResponse> {
    throw new Error(`Method generateSpeech not implemented for ${this.getName()}`);
  }

  /**
   * Check if provider supports a specific feature
   */
  abstract supportsFeature(feature: ProviderFeature): boolean;

  /**
   * Estimate cost for a given request
   */
  abstract estimateCost(request: CompletionRequest): CostEstimate;

  /**
   * Get available models for this provider
   */
  abstract getAvailableModels(): string[];

  /**
   * Health check - is provider operational?
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get provider configuration
   */
  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  /**
   * Check if provider is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled !== false;
  }

  /**
   * Validate request before sending
   */
  protected validateRequest(request: CompletionRequest): void {
    if (!request.messages || request.messages.length === 0) {
      throw new Error('Request must contain at least one message');
    }

    if (request.maxTokens && request.maxTokens < 1) {
      throw new Error('maxTokens must be positive');
    }

    if (request.temperature !== undefined) {
      if (request.temperature < 0 || request.temperature > 2) {
        throw new Error('temperature must be between 0 and 2');
      }
    }
  }

  /**
   * Count tokens in messages (approximate)
   */
  protected estimateTokenCount(messages: CompletionMessage[]): number {
    const text = messages.map(m => m.content).join(' ');
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}

import type { CompletionMessage } from './types';
