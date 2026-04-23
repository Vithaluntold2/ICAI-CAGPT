/**
 * Google Gemini Provider
 * Implements the AIProvider interface for Gemini 2.0 Flash
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider } from './base';
import {
  AIProviderName,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  ProviderError,
  CompletionMessage,
  ProviderFeature,
  CostEstimate
} from './types';

export class GeminiProvider extends AIProvider {
  private client: GoogleGenerativeAI;
  private defaultModel: string;

  constructor(config: ProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new ProviderError(
        'Google AI API key is required',
        AIProviderName.GEMINI,
        'AUTHENTICATION_ERROR',
        false
      );
    }

    this.client = new GoogleGenerativeAI(config.apiKey);
    this.defaultModel = config.defaultModel || 'gemini-2.0-flash-exp';
  }

  getName(): AIProviderName {
    return AIProviderName.GEMINI;
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      // Gemini does not yet have tool-calling wired through this adapter.
      // If the caller explicitly asked for a forced tool call, bail out so
      // the router can failover to a provider that supports it (Azure / OpenAI /
      // Claude). `supportsForcedToolCall` on the capability registry is the
      // primary guard — this is a belt-and-braces second check.
      if (
        request.toolChoice === 'required' ||
        (typeof request.toolChoice === 'object' && request.toolChoice?.type === 'tool')
      ) {
        throw new ProviderError(
          'Gemini provider does not support toolChoice=required yet',
          AIProviderName.GEMINI,
          'UNSUPPORTED_TOOL_CHOICE',
          false,
        );
      }

      const modelName = request.model || this.defaultModel;
      const model = this.client.getGenerativeModel({ 
        model: modelName,
      });

      // Convert messages to Gemini format
      const { systemInstruction, contents } = this.convertMessages(request.messages);
      
      const generationConfig = {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens || 2000,
      };

      const chatOptions: any = {
        generationConfig,
        history: contents.slice(0, -1), // All but the last message
      };

      if (systemInstruction) {
        chatOptions.systemInstruction = systemInstruction;
      }

      const chat = model.startChat(chatOptions);

      // Send the last message
      const lastMessage = contents[contents.length - 1];
      if (!lastMessage?.parts?.[0]?.text) {
        console.error('[Gemini] Invalid message format:', { lastMessage, contents, messages: request.messages });
        throw new ProviderError(
          'No valid user message found',
          AIProviderName.GEMINI,
          'INVALID_REQUEST',
          false
        );
      }
      const result = await chat.sendMessage(lastMessage.parts[0].text);
      const response = result.response;

      // Extract token counts
      const usageMetadata = response.usageMetadata || {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
      };

      return {
        content: response.text(),
        finishReason: this.mapFinishReason(response.candidates?.[0]?.finishReason),
        tokensUsed: {
          input: usageMetadata.promptTokenCount || 0,
          output: usageMetadata.candidatesTokenCount || 0,
          total: usageMetadata.totalTokenCount || 0,
        },
        model: modelName,
        provider: AIProviderName.GEMINI,
        metadata: {
          safetyRatings: response.candidates?.[0]?.safetyRatings,
        }
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async *generateCompletionStream(request: CompletionRequest): AsyncGenerator<string> {
    try {
      const modelName = request.model || this.defaultModel;
      const model = this.client.getGenerativeModel({ model: modelName });

      const { systemInstruction, contents } = this.convertMessages(request.messages);
      
      const generationConfig = {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens || 2000,
      };

      const chatOptions: any = {
        generationConfig,
        history: contents.slice(0, -1),
      };

      if (systemInstruction) {
        chatOptions.systemInstruction = systemInstruction;
      }

      const chat = model.startChat(chatOptions);

      const lastMessage = contents[contents.length - 1];
      if (!lastMessage?.parts?.[0]?.text) {
        console.error('[Gemini] Invalid message format:', { lastMessage, contents, messages: request.messages });
        throw new ProviderError(
          'No valid user message found',
          AIProviderName.GEMINI,
          'INVALID_REQUEST',
          false
        );
      }
      const result = await chat.sendMessageStream(lastMessage.parts[0].text);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.defaultModel });
      await model.generateContent('Hi');
      return true;
    } catch {
      return false;
    }
  }

  estimateCost(request: CompletionRequest): CostEstimate {
    // Gemini 2.0 Flash pricing (as of Nov 2024)
    // Free tier: Up to 1500 requests per day
    // Paid tier (when available):
    // Input: $0.075 per million tokens (128K context)
    // Output: $0.30 per million tokens
    
    const estimatedInputTokens = JSON.stringify(request.messages).length / 4;
    const estimatedOutputTokens = (request.maxTokens || 2000) * 0.7;
    
    const inputCost = (estimatedInputTokens / 1_000_000) * 0.075;
    const outputCost = (estimatedOutputTokens / 1_000_000) * 0.30;
    
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
      ProviderFeature.VISION,
      ProviderFeature.LONG_CONTEXT,
      ProviderFeature.STREAMING,
      ProviderFeature.STRUCTURED_OUTPUT,
    ];
    return supported.includes(feature);
  }

  getAvailableModels(): string[] {
    return [
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro',
    ];
  }

  /**
   * Convert CompletionMessage[] to Gemini's format.
   *
   * Gemini doesn't participate in the tool-call loop today (see the
   * defensive reject in generateCompletion for forced tool choice),
   * but CompletionMessage may still carry `role:'tool'` or an
   * assistant turn with `toolCalls` when a conversation is replayed
   * cross-provider. Collapse both into plain text user/model turns
   * so the message isn't silently dropped or rejected by the SDK.
   */
  private convertMessages(messages: CompletionMessage[]): {
    systemInstruction?: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  } {
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const systemInstruction = systemMessages.length > 0
      ? systemMessages.map(m => m.content).join('\n\n')
      : undefined;

    const contents = conversationMessages.map(m => {
      if (m.role === 'tool') {
        const name = m.toolName ? ` for ${m.toolName}` : '';
        return {
          role: 'user',
          parts: [{ text: `[Tool result${name}]\n${m.content}` }],
        };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        const txt = m.content?.trim()
          ? m.content
          : m.toolCalls
              .map(tc => `[tool_call ${tc.name}] ${JSON.stringify(tc.input)}`)
              .join('\n');
        return { role: 'model', parts: [{ text: txt }] };
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      };
    });

    return { systemInstruction, contents };
  }

  /**
   * Map Gemini finish reasons to standard finish reasons
   */
  private mapFinishReason(finishReason?: string): CompletionResponse['finishReason'] {
    if (!finishReason) return 'stop';
    
    switch (finishReason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
      case 'RECITATION':
      case 'OTHER':
        return 'error';
      default:
        return 'stop';
    }
  }

  /**
   * Handle Gemini-specific errors
   */
  private handleError(error: any): ProviderError {
    let code: ProviderError['code'] = 'UNKNOWN_ERROR';
    let retryable = false;
    let message = error.message || 'Unknown error occurred';

    // Check for specific error patterns
    if (message.includes('API key')) {
      code = 'AUTHENTICATION_ERROR';
      message = 'Gemini API authentication failed. Please check your API key.';
    } else if (message.includes('quota') || message.includes('rate limit')) {
      code = 'RATE_LIMIT_EXCEEDED';
      retryable = true;
      message = 'Gemini API rate limit exceeded. Please try again later.';
    } else if (message.includes('invalid request') || message.includes('400')) {
      code = 'INVALID_REQUEST';
      message = `Invalid request to Gemini API: ${error.message}`;
    } else if (message.includes('500') || message.includes('503')) {
      code = 'PROVIDER_ERROR';
      retryable = true;
      message = 'Gemini API is experiencing issues. Please try again.';
    } else if (message.includes('timeout') || message.includes('ECONNREFUSED')) {
      code = 'TIMEOUT_ERROR';
      retryable = true;
      message = 'Connection to Gemini API timed out.';
    }

    return new ProviderError(message, AIProviderName.GEMINI, code, retryable);
  }
}
