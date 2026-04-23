/**
 * Anthropic Claude Provider
 * Implements the AIProvider interface for Claude 3.5 Sonnet
 */

import Anthropic from '@anthropic-ai/sdk';
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
import { parseAnthropicToolCall } from '../tools/adapters/anthropic';

export class ClaudeProvider extends AIProvider {
  private client: Anthropic;
  private defaultModel: string;

  constructor(config: ProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new ProviderError(
        'Anthropic API key is required',
        AIProviderName.CLAUDE,
        'AUTHENTICATION_ERROR',
        false
      );
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
    });

    this.defaultModel = config.defaultModel || 'claude-3-5-sonnet-20241022';
  }

  getName(): AIProviderName {
    return AIProviderName.CLAUDE;
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const model = request.model || this.defaultModel;
      
      // Convert messages to Claude format
      let requestMessages = request.messages;
      
      // Handle PDF attachments by extracting text
      if (request.attachment && request.attachment.mimeType === 'application/pdf') {
        try {
          console.log(`[Claude] Extracting text from PDF: ${request.attachment.filename}`);
          
          // Use dynamic import for pdf-parse v1.x
          const pdfParse = (await import('pdf-parse')).default;
          const pdfData = await pdfParse(request.attachment.buffer);
          
          // Add extracted text to the last message
          const extractedText = (pdfData.text || '').trim();
          if (extractedText) {
            requestMessages = [...request.messages];
            const lastMessage = requestMessages[requestMessages.length - 1];
            lastMessage.content = `${lastMessage.content}\n\n**Document Content Extracted from ${request.attachment.filename}:**\n\`\`\`\n${extractedText.substring(0, 8000)}\n\`\`\``;
            
            console.log(`[Claude] Successfully extracted ${extractedText.length} characters from PDF`);
          }
        } catch (pdfError) {
          console.error('[Claude] Failed to extract PDF text:', pdfError);
          // Continue without PDF text - let the LLM respond based on the message alone
        }
      }
      
      const { system, messages } = this.convertMessages(requestMessages);

      const apiRequest: any = {
        model,
        max_tokens: request.maxTokens || 2000,
        temperature: request.temperature ?? 0.7,
        system,
        messages,
      };
      if (request.tools && request.tools.length > 0) {
        apiRequest.tools = request.tools;
        // Translate provider-agnostic toolChoice into Anthropic's `tool_choice`.
        // Anthropic shapes:
        //   'auto'     → { type: 'auto' }
        //   'required' → { type: 'any' }     (force SOME tool, Anthropic's closest analogue)
        //   'none'     → omit tools entirely (handled by caller — or we just drop)
        //   { type: 'tool', name } → { type: 'tool', name }
        if (request.toolChoice !== undefined) {
          if (request.toolChoice === 'auto') {
            apiRequest.tool_choice = { type: 'auto' };
          } else if (request.toolChoice === 'required') {
            apiRequest.tool_choice = { type: 'any' };
          } else if (request.toolChoice === 'none') {
            // Anthropic has no 'none'; stripping tools is the correct way to
            // forbid them. Keep tools present but skip setting tool_choice —
            // most call sites don't reach here because the caller shouldn't
            // send both tools and 'none', but we defend.
            delete apiRequest.tools;
          } else if (request.toolChoice.type === 'tool') {
            apiRequest.tool_choice = { type: 'tool', name: request.toolChoice.name };
          }
        }
      } else if (request.toolChoice === 'required' || (typeof request.toolChoice === 'object' && request.toolChoice?.type === 'tool')) {
        throw new ProviderError(
          `toolChoice='${JSON.stringify(request.toolChoice)}' requires a non-empty tools array`,
          this.getName(),
          'INVALID_TOOL_CHOICE',
          false,
        );
      }

      const response = await this.client.messages.create(apiRequest);

      // Extract the response content (text blocks only)
      const content = response.content
        .filter(block => block.type === 'text')
        .map(block => 'text' in block ? block.text : '')
        .join('\n');

      // Parse any tool_use blocks
      const toolCalls = parseAnthropicToolCall(response.content as any);
      const hasToolCalls = toolCalls.length > 0;

      return {
        content,
        finishReason: hasToolCalls ? 'tool_calls' : this.mapStopReason(response.stop_reason),
        tokensUsed: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
        provider: AIProviderName.CLAUDE,
        metadata: {
          id: response.id,
          stopSequence: response.stop_sequence || undefined,
          extractedFromPdf: request.attachment?.mimeType === 'application/pdf',
          toolCalls: hasToolCalls ? toolCalls : undefined,
        }
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async *generateCompletionStream(request: CompletionRequest): AsyncGenerator<string> {
    try {
      const model = request.model || this.defaultModel;
      const { system, messages } = this.convertMessages(request.messages);
      
      const stream = await this.client.messages.create({
        model,
        max_tokens: request.maxTokens || 2000,
        temperature: request.temperature ?? 0.7,
        system,
        messages,
        stream: true,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && 
            chunk.delta.type === 'text_delta') {
          yield chunk.delta.text;
        }
      }
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - try to create a minimal completion
      await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  estimateCost(request: CompletionRequest): CostEstimate {
    // Claude 3.5 Sonnet pricing (as of Nov 2024)
    // Input: $3.00 per million tokens
    // Output: $15.00 per million tokens
    
    // Rough token estimation (4 chars per token average)
    const estimatedInputTokens = JSON.stringify(request.messages).length / 4;
    const estimatedOutputTokens = (request.maxTokens || 2000) * 0.7; // Assume 70% of max
    
    const inputCost = (estimatedInputTokens / 1_000_000) * 3.00;
    const outputCost = (estimatedOutputTokens / 1_000_000) * 15.00;
    
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
      ProviderFeature.TOOL_CALLING,
      ProviderFeature.LONG_CONTEXT,
      ProviderFeature.STREAMING,
    ];
    return supported.includes(feature);
  }

  getAvailableModels(): string[] {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  /**
   * Convert CompletionMessage[] to Claude's format (separate system message).
   *
   * Tool rounds need native content-block shapes, not plain strings:
   *   - An assistant turn that emitted tool calls becomes
   *     `{ role: 'assistant', content: [{type:'text',text}, {type:'tool_use', id, name, input}, ...] }`.
   *     Anthropic REJECTS the conversation if the prior assistant
   *     turn's tool_use is replayed as a string instead of blocks.
   *   - Each subsequent `role:'tool'` message becomes a user turn with
   *     `content: [{type:'tool_result', tool_use_id, content}]`.
   *     Consecutive tool results collapse into a single user turn so
   *     they pair cleanly with the preceding assistant tool_use turn.
   */
  private convertMessages(messages: CompletionMessage[]): {
    system?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: any }>;
  } {
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const system = systemMessages.length > 0
      ? systemMessages.map(m => m.content).join('\n\n')
      : undefined;

    const claudeMessages: Array<{ role: 'user' | 'assistant'; content: any }> = [];
    let pendingToolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

    const flushToolResults = () => {
      if (pendingToolResults.length > 0) {
        claudeMessages.push({ role: 'user', content: pendingToolResults });
        pendingToolResults = [];
      }
    };

    for (const m of conversationMessages) {
      if (m.role === 'tool') {
        pendingToolResults.push({
          type: 'tool_result',
          tool_use_id: m.toolCallId ?? '',
          content: m.content,
        });
        continue;
      }
      flushToolResults();
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        const blocks: any[] = [];
        if (m.content && m.content.trim()) blocks.push({ type: 'text', text: m.content });
        for (const tc of m.toolCalls) {
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
        }
        claudeMessages.push({ role: 'assistant', content: blocks });
        continue;
      }
      claudeMessages.push({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      });
    }
    flushToolResults();

    return { system, messages: claudeMessages };
  }

  /**
   * Map Claude stop reasons to standard finish reasons
   */
  private mapStopReason(stopReason: string | null): CompletionResponse['finishReason'] {
    if (!stopReason) return 'stop';
    
    switch (stopReason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
    }
  }

  /**
   * Handle Claude-specific errors
   */
  private handleError(error: any): ProviderError {
    let code: ProviderError['code'] = 'UNKNOWN_ERROR';
    let retryable = false;
    let message = error.message || 'Unknown error occurred';

    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        code = 'RATE_LIMIT_EXCEEDED';
        retryable = true;
        message = 'Claude API rate limit exceeded. Please try again later.';
      } else if (error.status === 401 || error.status === 403) {
        code = 'AUTHENTICATION_ERROR';
        message = 'Claude API authentication failed. Please check your API key.';
      } else if (error.status === 400) {
        code = 'INVALID_REQUEST';
        message = `Invalid request to Claude API: ${error.message}`;
      } else if (error.status === 500 || error.status === 503) {
        code = 'PROVIDER_ERROR';
        retryable = true;
        message = 'Claude API is experiencing issues. Please try again.';
      } else if (error.name === 'APIConnectionError') {
        code = 'TIMEOUT_ERROR';
        retryable = true;
        message = 'Connection to Claude API timed out.';
      }
    }

    return new ProviderError(message, AIProviderName.CLAUDE, code, retryable);
  }
}
