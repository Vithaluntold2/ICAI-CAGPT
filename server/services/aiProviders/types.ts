/**
 * Multi-Provider AI Architecture - Type Definitions
 * Supports OpenAI, Claude, Gemini, Perplexity, and Azure
 */

export enum AIProviderName {
  OPENAI = 'openai',
  AZURE_OPENAI = 'azure-openai',
  CLAUDE = 'claude',
  GEMINI = 'gemini',
  PERPLEXITY = 'perplexity',
  AZURE_SEARCH = 'azure-search',
  AZURE_DOCUMENT_INTELLIGENCE = 'azure-document-intelligence',
}

export enum ProviderFeature {
  CHAT_COMPLETION = 'chat_completion',
  VISION = 'vision',
  TOOL_CALLING = 'tool_calling',
  LONG_CONTEXT = 'long_context',
  REAL_TIME_SEARCH = 'real_time_search',
  STRUCTURED_OUTPUT = 'structured_output',
  DOCUMENT_INTELLIGENCE = 'document_intelligence',
  KNOWLEDGE_SEARCH = 'knowledge_search',
  STREAMING = 'streaming',
  SPEECH_TO_TEXT = 'speech_to_text',
  TEXT_TO_SPEECH = 'text_to_speech',
}

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /**
   * Tool-call role identifier. Required when `role === 'tool'` so each
   * adapter can pair the result with the originating call:
   *   OpenAI/Azure : maps to `{ role: 'tool', tool_call_id, content }`.
   *   Anthropic    : maps to a `user` turn whose content is
   *                  `[{ type: 'tool_result', tool_use_id: toolCallId, content }]`.
   *   Gemini       : maps to a `functionResponse` part; name comes from `toolName`.
   * Consumers of the plain-text `content` (legacy providers, logs) are
   * unaffected because `content` is always populated with the JSON
   * result stringified — the structured fields are additive.
   */
  toolCallId?: string;
  /**
   * Tool name associated with the call. Optional for OpenAI/Azure
   * (the id alone is enough) but REQUIRED by Anthropic when echoing
   * the prior assistant turn, and by Gemini when emitting a
   * `functionResponse`. Always populated by `completeWithToolLoop`.
   */
  toolName?: string;
  /**
   * Present when `role === 'assistant'` and the model emitted tool
   * calls. Needed because Anthropic's API REJECTS a conversation
   * where a `tool_use` assistant turn is followed by a user turn
   * whose text contradicts it — the prior assistant turn must be
   * echoed back verbatim in native shape. OpenAI is laxer but we
   * echo consistently anyway to stay provider-agnostic.
   */
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
}

export interface CompletionRequest {
  messages: CompletionMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: any[];
  /**
   * Forces / disables / constrains tool usage. When unset the provider decides.
   *   'auto'                        — model may call tools or reply in text (default).
   *   'required'                    — model MUST emit at least one tool call.
   *   'none'                        — model may not call tools.
   *   { type: 'tool', name: '...' } — model MUST call the named tool specifically.
   *
   * Mapped per provider:
   *   Azure/OpenAI : `tool_choice: 'auto' | 'required' | 'none' | { type: 'function', function: { name } }`
   *   Anthropic    : `tool_choice: { type: 'auto' } | { type: 'any' } | { type: 'tool', name }` (no 'none'; caller omits tools instead)
   *   Gemini       : `toolConfig.functionCallingConfig.mode: 'AUTO' | 'ANY' | 'NONE'` plus `allowedFunctionNames` for name-pinning
   *   Perplexity   : not supported; router must exclude when value !== 'auto'.
   *
   * When `toolChoice !== 'auto'` and the selected provider lacks the
   * `supportsForcedToolCall` capability the router re-routes or the
   * provider adapter throws a non-retryable ProviderError.
   */
  toolChoice?: 'auto' | 'required' | 'none' | { type: 'tool'; name: string };
  /**
   * Response format hint.
   *   'text'        — free-form output (default).
   *   'json'        — Azure/OpenAI JSON mode. Model must emit valid
   *                   JSON; no schema enforcement.
   *   'json_schema' — strict schema-constrained JSON. Requires
   *                   `jsonSchema` to be set. Azure/OpenAI decodes
   *                   into valid JSON that matches the schema, or
   *                   raises — kills whole classes of generation
   *                   drift at the decoder. Preferred for ExcelSpec
   *                   and similarly-strict formats.
   */
  responseFormat?: 'text' | 'json' | 'json_schema';
  /** JSON schema required when responseFormat === 'json_schema'.
   *  Passed through to Azure/OpenAI's `response_format.json_schema`. */
  jsonSchema?: {
    name: string;
    schema: Record<string, any>;
    strict?: boolean;
    description?: string;
  };
  /** Deterministic-sampling seed. Azure/OpenAI uses this to make
   *  outputs reproducible when paired with temperature 0. */
  seed?: number;
  attachment?: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    documentType?: string;
  };
}

export interface CompletionResponse {
  content: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  model: string;
  provider: AIProviderName;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  metadata?: {
    citations?: string[];
    toolCalls?: any[];
    [key: string]: any;
  };
}

export interface AudioTranscriptionRequest {
  file: Buffer;
  model?: string;
  language?: string;
  prompt?: string;
}

export interface AudioTranscriptionResponse {
  text: string;
  duration?: number;
}

export interface SpeechRequest {
  text: string;
  model?: string;
  voice?: string;
  speed?: number;
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac';
}

export interface SpeechResponse {
  audio: Buffer;
  contentType: string;
}

export interface ProviderConfig {
  name: AIProviderName;
  apiKey?: string;
  endpoint?: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
  enabled?: boolean;
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: AIProviderName,
    public code: string,
    public retryable: boolean,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
