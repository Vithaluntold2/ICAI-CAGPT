/**
 * Base Voice Provider Interface
 * Abstract class that all voice providers must extend
 */

import {
  VoiceProviderName,
  VoiceTier,
  VoiceConfig,
  TranscriptionRequest,
  TranscriptionResponse,
  SpeechSynthesisRequest,
  SpeechSynthesisResponse,
  VoiceDefinition,
} from '../types';

export abstract class VoiceProvider {
  protected config: VoiceConfig;

  constructor(config: VoiceConfig) {
    this.config = config;
  }

  /**
   * Get the provider name
   */
  abstract getName(): VoiceProviderName;

  /**
   * Get the tier this provider serves
   */
  abstract getTier(): VoiceTier;

  /**
   * Check if provider supports STT
   */
  abstract supportsSTT(): boolean;

  /**
   * Check if provider supports TTS
   */
  abstract supportsTTS(): boolean;

  /**
   * Transcribe audio to text (STT)
   */
  abstract transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse>;

  /**
   * Synthesize text to speech (TTS)
   */
  abstract synthesize(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResponse>;

  /**
   * Get available voices for this provider
   */
  abstract getVoices(language?: string): VoiceDefinition[];

  /**
   * Get supported languages for STT
   */
  abstract getSupportedLanguages(): string[];

  /**
   * Health check
   */
  abstract isHealthy(): Promise<boolean>;

  /**
   * Check if provider is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}
