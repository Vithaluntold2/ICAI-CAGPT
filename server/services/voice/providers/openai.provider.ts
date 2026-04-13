/**
 * OpenAI Voice Provider
 * Supports Whisper STT and OpenAI TTS
 * Tier: Premium (STT) and Standard/Premium (TTS)
 */

import OpenAI from 'openai';
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

export class OpenAIVoiceProvider extends VoiceProvider {
  private client: OpenAI;

  // OpenAI TTS voices (gpt-4o-mini-tts supports all 13 + accent control via instructions)
  private static readonly VOICES: VoiceDefinition[] = [
    { id: 'alloy', name: 'Alloy', language: 'English', languageCode: 'en', gender: 'neutral', accent: 'Neutral', provider: VoiceProviderName.OPENAI, tier: VoiceTier.STANDARD },
    { id: 'ash', name: 'Ash', language: 'English', languageCode: 'en', gender: 'male', accent: 'Neutral', provider: VoiceProviderName.OPENAI, tier: VoiceTier.STANDARD },
    { id: 'ballad', name: 'Ballad', language: 'English', languageCode: 'en', gender: 'male', accent: 'Neutral', provider: VoiceProviderName.OPENAI, tier: VoiceTier.STANDARD },
    { id: 'coral', name: 'Coral', language: 'English', languageCode: 'en', gender: 'female', accent: 'Neutral', provider: VoiceProviderName.OPENAI, tier: VoiceTier.STANDARD },
    { id: 'echo', name: 'Echo', language: 'English', languageCode: 'en', gender: 'male', accent: 'Neutral', provider: VoiceProviderName.OPENAI, tier: VoiceTier.STANDARD },
    { id: 'fable', name: 'Fable', language: 'English', languageCode: 'en', gender: 'neutral', accent: 'British', provider: VoiceProviderName.OPENAI, tier: VoiceTier.STANDARD },
    { id: 'nova', name: 'Nova', language: 'English', languageCode: 'en', gender: 'female', accent: 'Neutral', provider: VoiceProviderName.OPENAI, tier: VoiceTier.STANDARD },
    { id: 'onyx', name: 'Onyx', language: 'English', languageCode: 'en', gender: 'male', accent: 'Neutral', provider: VoiceProviderName.OPENAI, tier: VoiceTier.STANDARD },
    { id: 'sage', name: 'Sage', language: 'English', languageCode: 'en', gender: 'female', accent: 'Neutral', provider: VoiceProviderName.OPENAI, tier: VoiceTier.STANDARD },
    { id: 'shimmer', name: 'Shimmer', language: 'English', languageCode: 'en', gender: 'female', accent: 'Neutral', provider: VoiceProviderName.OPENAI, tier: VoiceTier.STANDARD },
    { id: 'verse', name: 'Verse', language: 'English', languageCode: 'en', gender: 'male', accent: 'Neutral', provider: VoiceProviderName.OPENAI, tier: VoiceTier.STANDARD },
    { id: 'marin', name: 'Marin', language: 'English', languageCode: 'en', gender: 'female', accent: 'Neutral', provider: VoiceProviderName.OPENAI, tier: VoiceTier.STANDARD },
    { id: 'cedar', name: 'Cedar', language: 'English', languageCode: 'en', gender: 'male', accent: 'Neutral', provider: VoiceProviderName.OPENAI, tier: VoiceTier.STANDARD },
  ];

  // Whisper supported languages
  private static readonly SUPPORTED_LANGUAGES = [
    'en', 'hi', 'ar', 'id', 'tl', 'tr', 'fr', 'es', 'de', 'pt', 'ru', 'ja', 'ko', 'zh',
    'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur', 'fa', 'he', 'nl', 'it', 'pl',
    'uk', 'vi', 'th', 'el', 'cs', 'ro', 'hu', 'sv', 'da', 'fi', 'no', 'sk', 'hr', 'bg',
  ];

  constructor(config: VoiceConfig) {
    super(config);

    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is required for voice provider');
    }

    this.client = new OpenAI({
      apiKey,
      timeout: 60000,
      maxRetries: 2,
    });
  }

  getName(): VoiceProviderName {
    return VoiceProviderName.OPENAI;
  }

  getTier(): VoiceTier {
    return VoiceTier.PREMIUM; // Whisper is premium quality
  }

  supportsSTT(): boolean {
    return true;
  }

  supportsTTS(): boolean {
    return true;
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    try {
      // Create a File-like object from Buffer
      const file = await OpenAI.toFile(request.audio, 'audio.webm');

      const transcription = await this.client.audio.transcriptions.create({
        file: file,
        model: request.model || 'whisper-1',
        language: request.language,
        prompt: request.prompt,
        response_format: 'verbose_json',
      });

      return {
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
      };
    } catch (error: any) {
      console.error('[OpenAI Voice] Transcription failed:', error);
      throw new VoiceProviderError(
        error.message || 'Transcription failed',
        this.getName(),
        'STT_ERROR',
        true,
        error
      );
    }
  }

  /**
   * Build accent instructions for gpt-4o-mini-tts
   * The model supports natural language instructions to control accent, tone, speed, etc.
   */
  private buildAccentInstructions(accent?: string): string {
    if (!accent || accent === 'neutral' || accent === 'Neutral') {
      return 'Speak clearly and naturally.';
    }

    // Map user-defined accents to natural language instructions
    const accentInstructions: Record<string, string> = {
      'indian': 'Speak with an Indian English accent. Use the intonation and rhythm typical of Indian English speakers.',
      'british': 'Speak with a British English accent, specifically Received Pronunciation. Use British intonation and phrasing.',
      'american': 'Speak with a standard American English accent. Use American pronunciation and intonation.',
      'australian': 'Speak with an Australian English accent. Use Australian intonation, pronunciation, and casual warmth.',
      'irish': 'Speak with an Irish English accent. Use the melodic intonation and rhythm of Irish English.',
      'scottish': 'Speak with a Scottish English accent. Use Scottish pronunciation and cadence.',
      'south-african': 'Speak with a South African English accent. Use South African pronunciation patterns.',
      'canadian': 'Speak with a Canadian English accent. Use Canadian pronunciation and friendly tone.',
      'nigerian': 'Speak with a Nigerian English accent. Use Nigerian English intonation and rhythm.',
      'singaporean': 'Speak with a Singaporean English accent (Singlish-influenced). Use Singaporean speech patterns.',
      'middle-eastern': 'Speak with a Middle Eastern English accent. Use the intonation typical of Arabic-influenced English.',
      'french': 'Speak with a French accent. Use French-influenced intonation and pronunciation.',
      'german': 'Speak with a German accent. Use German-influenced pronunciation patterns.',
      'spanish': 'Speak with a Spanish accent. Use Spanish-influenced intonation and pronunciation.',
      'italian': 'Speak with an Italian accent. Use Italian-influenced intonation, warmth, and expressiveness.',
      'japanese': 'Speak with a Japanese-influenced English accent. Use Japanese intonation patterns.',
      'korean': 'Speak with a Korean-influenced English accent. Use Korean speech rhythm.',
      'chinese': 'Speak with a Chinese-influenced English accent. Use Mandarin-influenced tonal patterns.',
    };

    const key = accent.toLowerCase().replace(/\s+/g, '-');
    return accentInstructions[key] || `Speak with a ${accent} accent. Adapt your pronunciation, intonation, and rhythm accordingly.`;
  }

  async synthesize(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResponse> {
    try {
      // Map format to OpenAI supported formats
      const formatMap: Record<string, 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'> = {
        mp3: 'mp3',
        opus: 'opus',
        wav: 'wav',
        ogg: 'opus', // OpenAI doesn't support ogg, use opus
        aac: 'aac',
        flac: 'flac',
      };
      const responseFormat = formatMap[request.format || 'mp3'] || 'mp3';

      // Use gpt-4o-mini-tts with instructions for accent/style control
      const instructions = this.buildAccentInstructions(request.accent);

      const response = await this.client.audio.speech.create({
        model: 'gpt-4o-mini-tts',
        voice: request.voice as any || 'coral',
        input: request.text,
        instructions,
        speed: request.speed || 1.0,
        response_format: responseFormat,
      } as any);

      const buffer = Buffer.from(await response.arrayBuffer());

      return {
        audio: buffer,
        contentType: `audio/${request.format || 'mp3'}`,
        charactersUsed: request.text.length,
      };
    } catch (error: any) {
      console.error('[OpenAI Voice] Speech synthesis failed:', error);
      throw new VoiceProviderError(
        error.message || 'Speech synthesis failed',
        this.getName(),
        'TTS_ERROR',
        true,
        error
      );
    }
  }

  getVoices(language?: string): VoiceDefinition[] {
    if (language) {
      return OpenAIVoiceProvider.VOICES.filter(v => 
        v.languageCode === language || v.language.toLowerCase().includes(language.toLowerCase())
      );
    }
    return OpenAIVoiceProvider.VOICES;
  }

  getSupportedLanguages(): string[] {
    return OpenAIVoiceProvider.SUPPORTED_LANGUAGES;
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Simple health check - list models
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
