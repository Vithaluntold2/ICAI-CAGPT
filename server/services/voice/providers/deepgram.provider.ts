/**
 * Deepgram Voice Provider
 * High-quality STT for Standard tier
 * Lower cost than OpenAI Whisper with excellent accuracy
 */

import { VoiceProvider } from './base';
import {
  VoiceProviderName,
  VoiceTier,
  VoiceConfig,
  TranscriptionRequest,
  TranscriptionResponse,
  SpeechSynthesisRequest,
  SpeechSynthesisResponse,
  VoiceDefinition,
  VoiceProviderError,
} from '../types';

export class DeepgramVoiceProvider extends VoiceProvider {
  private apiKey: string;
  private baseUrl = 'https://api.deepgram.com/v1';

  // Deepgram supported languages
  private static readonly SUPPORTED_LANGUAGES = [
    'en', 'en-US', 'en-GB', 'en-AU', 'en-IN', 'en-NZ',
    'es', 'es-419', 'es-ES',
    'fr', 'fr-CA',
    'de',
    'hi', 'hi-Latn',
    'id',
    'it',
    'ja',
    'ko',
    'nl',
    'pl',
    'pt', 'pt-BR', 'pt-PT',
    'ru',
    'sv',
    'ta',
    'tr',
    'uk',
    'zh', 'zh-CN', 'zh-TW',
    'ar',
    'bn', // Bengali
    'gu', // Gujarati
    'kn', // Kannada
    'ml', // Malayalam
    'mr', // Marathi
    'pa', // Punjabi
    'te', // Telugu
    'ur', // Urdu
    'vi', // Vietnamese
    'th', // Thai
    'tl', // Tagalog/Filipino
    'ms', // Malay
  ];

  constructor(config: VoiceConfig) {
    super(config);

    this.apiKey = config.apiKey || process.env.DEEPGRAM_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Deepgram API key is required');
    }
  }

  getName(): VoiceProviderName {
    return VoiceProviderName.DEEPGRAM;
  }

  getTier(): VoiceTier {
    return VoiceTier.STANDARD;
  }

  supportsSTT(): boolean {
    return true;
  }

  supportsTTS(): boolean {
    return false; // Deepgram Aura TTS is in beta, not implemented yet
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    try {
      // Prepare query parameters
      const params = new URLSearchParams({
        model: 'nova-2', // Best accuracy model
        smart_format: 'true',
        punctuate: 'true',
        paragraphs: 'true',
        utterances: 'true',
        diarize: 'false',
      });

      if (request.language) {
        params.append('language', request.language);
      } else {
        params.append('detect_language', 'true');
      }

      const response = await fetch(`${this.baseUrl}/listen?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'audio/webm', // Adjust based on input
        },
        body: new Uint8Array(request.audio),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const channel = result.results?.channels?.[0];
      const alternative = channel?.alternatives?.[0];

      if (!alternative) {
        throw new Error('No transcription result from Deepgram');
      }

      return {
        text: alternative.transcript || '',
        language: result.results?.channels?.[0]?.detected_language || request.language,
        duration: result.metadata?.duration,
        confidence: alternative.confidence,
        words: alternative.words?.map((w: any) => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence,
        })),
      };
    } catch (error: any) {
      console.error('[Deepgram] Transcription failed:', error);
      throw new VoiceProviderError(
        error.message || 'Deepgram transcription failed',
        VoiceProviderName.DEEPGRAM,
        'STT_ERROR',
        true,
        error
      );
    }
  }

  async synthesize(_request: SpeechSynthesisRequest): Promise<SpeechSynthesisResponse> {
    // Deepgram Aura TTS (beta) - implement when needed
    throw new VoiceProviderError(
      'Deepgram TTS not yet implemented',
      VoiceProviderName.DEEPGRAM,
      'NOT_IMPLEMENTED',
      false
    );
  }

  getVoices(_language?: string): VoiceDefinition[] {
    // Deepgram is STT-only for now
    return [];
  }

  getSupportedLanguages(): string[] {
    return DeepgramVoiceProvider.SUPPORTED_LANGUAGES;
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Simple API key validation
      const response = await fetch(`${this.baseUrl}/projects`, {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
