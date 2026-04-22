/**
 * Azure OpenAI Provider
 * Uses Azure OpenAI Service for LLM completions with dedicated endpoints
 */

import { AzureOpenAI } from 'openai';
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

export class AzureOpenAIProvider extends AIProvider {
  private client: AzureOpenAI | null = null;
  private endpoint: string;
  private apiKey: string;
  private deploymentName: string;

  constructor(config: ProviderConfig) {
    super(config);
    
    this.endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    this.apiKey = process.env.AZURE_OPENAI_API_KEY || '';
    // Use AZURE_OPENAI_DEPLOYMENT env var, fallback to gpt-4o-mini (the actual deployed model)
    this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o-mini';
    
    console.log(`[AzureOpenAI] Initializing with deployment: ${this.deploymentName}, endpoint: ${this.endpoint}`);

    if (!this.endpoint || !this.apiKey) {
      console.warn('[AzureOpenAI] Missing endpoint or API key - provider will be disabled');
      return;
    }

    try {
      // Ensure endpoint has https:// prefix and remove trailing slash
      let normalizedEndpoint = this.endpoint.startsWith('http') 
        ? this.endpoint 
        : `https://${this.endpoint}`;
      normalizedEndpoint = normalizedEndpoint.replace(/\/$/, '');
      
      // Use AzureOpenAI client with proper Azure configuration
      this.client = new AzureOpenAI({
        apiKey: this.apiKey,
        endpoint: normalizedEndpoint,
        deployment: this.deploymentName,
        apiVersion: '2024-08-01-preview',
      });
      
      console.log(`[AzureOpenAI] Client initialized with endpoint: ${normalizedEndpoint}, deployment: ${this.deploymentName}`);
    } catch (error) {
      console.error('[AzureOpenAI] Failed to initialize client:', error);
      throw new ProviderError(
        'Failed to initialize Azure OpenAI client',
        AIProviderName.AZURE_OPENAI,
        'INIT_ERROR',
        false,
        error
      );
    }
  }

  getName(): AIProviderName {
    return AIProviderName.AZURE_OPENAI;
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    this.validateRequest(request);

    if (!this.client) {
      throw new ProviderError(
        'Azure OpenAI client not initialized',
        AIProviderName.AZURE_OPENAI,
        'CLIENT_ERROR',
        false
      );
    }

    try {
      // Handle PDF attachments by extracting text
      let messages = [...request.messages];
      if (request.attachment && request.attachment.mimeType === 'application/pdf') {
        try {
          console.log(`[AzureOpenAI] Extracting text from PDF: ${request.attachment.filename}`);
          
          // Use dynamic import for pdf-parse v1.x
          const pdfParse = (await import('pdf-parse')).default;
          const pdfData = await pdfParse(request.attachment.buffer);
          
          // Add extracted text to the last message
          const extractedText = (pdfData.text || '').trim();
          if (extractedText) {
            const lastMessage = messages[messages.length - 1];
            messages = [...messages.slice(0, -1), {
              ...lastMessage,
              content: `${lastMessage.content}\n\n**Document Content Extracted from ${request.attachment.filename}:**\n\`\`\`\n${extractedText.substring(0, 8000)}\n\`\`\``
            }];
            
            console.log(`[AzureOpenAI] Successfully extracted ${extractedText.length} characters from PDF`);
          }
        } catch (pdfError) {
          console.error('[AzureOpenAI] Failed to extract PDF text:', pdfError);
          // Continue without PDF text - let the LLM respond based on the message alone
        }
      }
      
      // Azure OpenAI uses deployment from client config, not model parameter
      // gpt-5.2-chat only supports temperature=1, so omit it for that model
      const supportsTemperature = !this.deploymentName.includes('5.1') && !this.deploymentName.includes('5.2');
      const apiRequest: any = {
        model: this.deploymentName,
        messages: messages,
        ...(supportsTemperature ? { temperature: request.temperature ?? 0.7 } : {}),
        max_completion_tokens: request.maxTokens ?? 2000,
        stream: false,
      };
      if (request.tools && request.tools.length > 0) {
        apiRequest.tools = request.tools;
      }
      // Pass through structured-output + deterministic-sampling flags.
      // Supported on gpt-4o / gpt-4o-mini / gpt-5.x Azure deployments.
      // Skipped silently for provider responses that don't recognise
      // the field (Azure returns 400 if the deployment doesn't
      // support the feature — wrapped in try/catch upstream).
      if (request.responseFormat === 'json') {
        apiRequest.response_format = { type: 'json_object' };
      } else if (request.responseFormat === 'json_schema' && request.jsonSchema) {
        apiRequest.response_format = {
          type: 'json_schema',
          json_schema: {
            name: request.jsonSchema.name,
            schema: request.jsonSchema.schema,
            strict: request.jsonSchema.strict ?? true,
            ...(request.jsonSchema.description ? { description: request.jsonSchema.description } : {}),
          },
        };
      }
      if (typeof request.seed === 'number') {
        apiRequest.seed = request.seed;
      }
      const completion = await this.client.chat.completions.create(apiRequest) as any;

      const choice = completion.choices?.[0];
      const message = choice?.message;
      const content = message?.content || '';
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;

      // Parse tool calls if present
      const toolCalls = message ? parseOpenAIToolCall(message as any) : [];
      const hasToolCalls = toolCalls.length > 0;

      const rawFinish = choice?.finish_reason;
      let finishReason: CompletionResponse['finishReason'];
      if (hasToolCalls || rawFinish === 'tool_calls' || rawFinish === 'function_call') {
        finishReason = 'tool_calls';
      } else if (rawFinish === 'length') {
        finishReason = 'length';
      } else if (rawFinish === 'stop') {
        finishReason = 'stop';
      } else {
        finishReason = 'stop';
      }

      return {
        content,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
        model: completion.model || this.deploymentName,
        provider: AIProviderName.AZURE_OPENAI,
        finishReason,
        metadata: {
          toolCalls: hasToolCalls ? toolCalls : undefined,
        },
      };
    } catch (error: any) {
      console.error('[AzureOpenAI] Completion error:', error);

      // Handle specific Azure OpenAI errors
      if (error.status === 429) {
        throw new ProviderError(
          'Azure OpenAI rate limit exceeded',
          AIProviderName.AZURE_OPENAI,
          'RATE_LIMIT',
          true,
          error
        );
      }

      if (error.status === 401 || error.status === 403) {
        throw new ProviderError(
          'Azure OpenAI authentication failed',
          AIProviderName.AZURE_OPENAI,
          'AUTH_ERROR',
          false,
          error
        );
      }

      if (error.code === 'insufficient_quota') {
        throw new ProviderError(
          'Azure OpenAI quota exceeded',
          AIProviderName.AZURE_OPENAI,
          'QUOTA_EXCEEDED',
          true,
          error
        );
      }

      throw new ProviderError(
        error.message || 'Azure OpenAI request failed',
        AIProviderName.AZURE_OPENAI,
        'API_ERROR',
        true,
        error
      );
    }
  }

  getSupportedFeatures(): ProviderFeature[] {
    return [
      ProviderFeature.CHAT_COMPLETION,
      ProviderFeature.STREAMING,
      ProviderFeature.TOOL_CALLING,
      ProviderFeature.STRUCTURED_OUTPUT,
    ];
  }

  supportsFeature(feature: ProviderFeature): boolean {
    return this.getSupportedFeatures().includes(feature);
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    try {
      // Azure OpenAI uses deployment from client config
      await this.client.chat.completions.create({
        model: this.deploymentName,
        messages: [{ role: 'user', content: 'test' }],
        max_completion_tokens: 5,
      });
      return true;
    } catch {
      return false;
    }
  }

  estimateCost(request: CompletionRequest): CostEstimate {
    const inputTokens = this.estimateTokenCount(request.messages);
    const outputTokens = request.maxTokens || 2000;
    
    // Azure OpenAI pricing (approximate, varies by region and deployment)
    const inputCostPer1k = 0.03; // $0.03 per 1K input tokens (gpt-4o)
    const outputCostPer1k = 0.06; // $0.06 per 1K output tokens

    const inputCost = (inputTokens / 1000) * inputCostPer1k;
    const outputCost = (outputTokens / 1000) * outputCostPer1k;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD',
    };
  }

  getAvailableModels(): string[] {
    return [this.deploymentName];
  }
}
