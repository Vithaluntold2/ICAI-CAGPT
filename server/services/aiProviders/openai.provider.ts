/**
 * OpenAI Provider Implementation
 * Supports GPT-4o, GPT-4o-mini, and other OpenAI models
 */

import OpenAI from 'openai';
import { AIProvider } from './base';
import {
  AIProviderName,
  ProviderFeature,
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
  CostEstimate,
  ProviderError,
} from './types';
import { parseOpenAIToolCall } from '../tools/adapters/openai';

export class OpenAIProvider extends AIProvider {
  private client: OpenAI;
  
  // Pricing per 1M tokens (as of 2025)
  private static readonly PRICING = {
    'gpt-4o': { input: 5, output: 15 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4': { input: 30, output: 60 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  };

  constructor(config: ProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 2,
    });
  }

  getName(): AIProviderName {
    return AIProviderName.OPENAI;
  }

  async transcribeAudio(request: any): Promise<any> {
    try {
      // Manual multi-part form data might be needed if using older SDK, 
      // but OpenAI SDK v4 has helper for this.
      // We need to create a File-like object from Buffer
      const file = await OpenAI.toFile(request.file, 'audio.webm');
      
      const transcription = await this.client.audio.transcriptions.create({
        file: file,
        model: request.model || 'whisper-1',
        language: request.language,
        prompt: request.prompt,
      });

      return {
        text: transcription.text,
      };
    } catch (error) {
      console.error('[OpenAI STT] Transcription failed:', error);
      throw new ProviderError(
        'Transcription failed',
        this.getName(),
        'STT_ERROR',
        true,
        error
      );
    }
  }

  async generateSpeech(request: any): Promise<any> {
    try {
      const response = await this.client.audio.speech.create({
        model: request.model || 'tts-1',
        voice: (request.voice as any) || 'alloy',
        input: request.text,
        speed: request.speed || 1.0,
        response_format: request.responseFormat || 'mp3',
      });

      const buffer = Buffer.from(await response.arrayBuffer());

      return {
        audio: buffer,
        contentType: `audio/${request.responseFormat || 'mp3'}`,
      };
    } catch (error) {
      console.error('[OpenAI TTS] Speech generation failed:', error);
      throw new ProviderError(
        'Speech generation failed',
        this.getName(),
        'TTS_ERROR',
        true,
        error
      );
    }
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    this.validateRequest(request);

    const model = request.model || this.config.defaultModel || 'gpt-4o';
    
    try {
      let messages = request.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Handle PDF attachments by extracting text
      if (request.attachment && request.attachment.mimeType === 'application/pdf') {
        try {
          console.log(`[OpenAI] Extracting text from PDF: ${request.attachment.filename}`);
          
          // Use dynamic import for pdf-parse v1.x
          const pdfParse = (await import('pdf-parse')).default;
          const pdfData = await pdfParse(request.attachment.buffer);
          
          // Add extracted text to the last message
          const extractedText = (pdfData.text || '').trim();
          if (extractedText) {
            const lastMessage = messages[messages.length - 1];
            lastMessage.content = `${lastMessage.content}\n\n**Document Content Extracted from ${request.attachment.filename}:**\n\`\`\`\n${extractedText.substring(0, 8000)}\n\`\`\``;
            
            console.log(`[OpenAI] Successfully extracted ${extractedText.length} characters from PDF`);
          }
        } catch (pdfError) {
          console.error('[OpenAI] Failed to extract PDF text:', pdfError);
          // Continue without PDF text - let the LLM respond based on the message alone
        }
      }

      // We don't support streaming in this method
      const completion = await this.client.chat.completions.create({
        model,
        messages: messages as any,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2000,
        stream: false,  // Explicitly false to get correct return type
        tools: request.tools,
        response_format: request.responseFormat === 'json' 
          ? { type: 'json_object' as const }
          : undefined,
      });

      const choice = completion.choices[0];
      if (!choice) {
        throw new ProviderError(
          'No completion choice returned',
          this.getName(),
          'NO_CHOICE',
          true
        );
      }

      // Normalize tool calls into the shared ParsedToolCall shape so the
      // orchestrator-level tool loop can execute them uniformly across providers.
      const toolCalls = parseOpenAIToolCall(choice.message as any);
      const hasToolCalls = toolCalls.length > 0;
      const finishReason: CompletionResponse['finishReason'] = hasToolCalls
        ? 'tool_calls'
        : this.mapFinishReason(choice.finish_reason);

      return {
        content: choice.message.content || '',
        tokensUsed: {
          input: completion.usage?.prompt_tokens || 0,
          output: completion.usage?.completion_tokens || 0,
          total: completion.usage?.total_tokens || 0,
        },
        model,
        provider: this.getName(),
        finishReason,
        metadata: {
          toolCalls: hasToolCalls ? toolCalls : undefined,
          extractedFromPdf: request.attachment?.mimeType === 'application/pdf',
        },
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  supportsFeature(feature: ProviderFeature): boolean {
    const supportedFeatures = new Set([
      ProviderFeature.CHAT_COMPLETION,
      ProviderFeature.VISION,
      ProviderFeature.TOOL_CALLING,
      ProviderFeature.STRUCTURED_OUTPUT,
      ProviderFeature.STREAMING,
      ProviderFeature.SPEECH_TO_TEXT,
      ProviderFeature.TEXT_TO_SPEECH,
    ]);

    return supportedFeatures.has(feature);
  }

  estimateCost(request: CompletionRequest): CostEstimate {
    const model = request.model || this.config.defaultModel || 'gpt-4o';
    const pricing = OpenAIProvider.PRICING[model as keyof typeof OpenAIProvider.PRICING] 
      || OpenAIProvider.PRICING['gpt-4o'];

    const inputTokens = this.estimateTokenCount(request.messages);
    const outputTokens = request.maxTokens || 2000;

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD',
    };
  }

  getAvailableModels(): string[] {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4',
      'gpt-3.5-turbo',
    ];
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  private mapFinishReason(reason: string | null | undefined): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
      case 'function_call':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }

  private handleError(error: any): ProviderError {
    let message = 'An error occurred with OpenAI';
    let code = 'UNKNOWN_ERROR';
    let retryable = false;

    if (error.status === 429 || error.message?.includes('quota')) {
      message = "I'm currently experiencing high demand. The AI service has reached its quota limit. However, I can still help with calculations directly. Please try asking your question again, or contact support for assistance.";
      code = 'RATE_LIMIT';
      retryable = true;
    } else if (error.status === 401 || error.message?.includes('API key')) {
      message = "There's a configuration issue with the AI service. Please contact support.";
      code = 'AUTH_ERROR';
      retryable = false;
    } else if (error.message?.includes('timeout')) {
      message = "The request took too long to process. Please try a simpler question or try again.";
      code = 'TIMEOUT';
      retryable = true;
    } else if (error.status >= 500) {
      message = "The AI service is temporarily unavailable. Please try again.";
      code = 'SERVICE_ERROR';
      retryable = true;
    }

    return new ProviderError(
      message,
      this.getName(),
      code,
      retryable,
      error
    );
  }
}
