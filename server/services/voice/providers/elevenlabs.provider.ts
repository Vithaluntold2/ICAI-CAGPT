/**
 * ElevenLabs Voice Provider
 * Premium TTS with ultra-realistic voices
 * Supports voice cloning and emotional control
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

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: {
    accent?: string;
    age?: string;
    gender?: string;
    description?: string;
    use_case?: string;
  };
  preview_url?: string;
}

export class ElevenLabsVoiceProvider extends VoiceProvider {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private cachedVoices: VoiceDefinition[] = [];
  private lastVoiceFetch = 0;

  // Default voices (pre-cached to avoid API calls)
  private static readonly DEFAULT_VOICES: VoiceDefinition[] = [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (Soft)', language: 'English', languageCode: 'en', gender: 'female', accent: 'American', region: 'North America', provider: VoiceProviderName.ELEVENLABS, tier: VoiceTier.PREMIUM },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam (Young)', language: 'English', languageCode: 'en', gender: 'male', accent: 'American', region: 'North America', provider: VoiceProviderName.ELEVENLABS, tier: VoiceTier.PREMIUM },
    { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte (Elegant)', language: 'English', languageCode: 'en', gender: 'female', accent: 'British', region: 'Europe', provider: VoiceProviderName.ELEVENLABS, tier: VoiceTier.PREMIUM },
    { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice (Confident)', language: 'English', languageCode: 'en', gender: 'female', accent: 'British', region: 'Europe', provider: VoiceProviderName.ELEVENLABS, tier: VoiceTier.PREMIUM },
    { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill (Narrator)', language: 'English', languageCode: 'en', gender: 'male', accent: 'American', region: 'North America', provider: VoiceProviderName.ELEVENLABS, tier: VoiceTier.PREMIUM },
    { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian (Deep)', language: 'English', languageCode: 'en', gender: 'male', accent: 'American', region: 'North America', provider: VoiceProviderName.ELEVENLABS, tier: VoiceTier.PREMIUM },
    { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum (Warm)', language: 'English', languageCode: 'en', gender: 'male', accent: 'Scottish', region: 'Europe', provider: VoiceProviderName.ELEVENLABS, tier: VoiceTier.PREMIUM },
    { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie (Natural)', language: 'English', languageCode: 'en', gender: 'male', accent: 'Australian', region: 'Australia', provider: VoiceProviderName.ELEVENLABS, tier: VoiceTier.PREMIUM },
    { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda (Friendly)', language: 'English', languageCode: 'en', gender: 'female', accent: 'American', region: 'North America', provider: VoiceProviderName.ELEVENLABS, tier: VoiceTier.PREMIUM },
    { id: 'bIHbv24MWmeRgasZH58o', name: 'Will (Friendly)', language: 'English', languageCode: 'en', gender: 'male', accent: 'American', region: 'North America', provider: VoiceProviderName.ELEVENLABS, tier: VoiceTier.PREMIUM },
    { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica (Expressive)', language: 'English', languageCode: 'en', gender: 'female', accent: 'American', region: 'North America', provider: VoiceProviderName.ELEVENLABS, tier: VoiceTier.PREMIUM },
    { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric (Friendly)', language: 'English', languageCode: 'en', gender: 'male', accent: 'American', region: 'North America', provider: VoiceProviderName.ELEVENLABS, tier: VoiceTier.PREMIUM },
  ];

  constructor(config: VoiceConfig) {
    super(config);

    this.apiKey = config.apiKey || process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }
  }

  getName(): VoiceProviderName {
    return VoiceProviderName.ELEVENLABS;
  }

  getTier(): VoiceTier {
    return VoiceTier.PREMIUM;
  }

  supportsSTT(): boolean {
    return false; // ElevenLabs doesn't offer STT
  }

  supportsTTS(): boolean {
    return true;
  }

  async transcribe(_request: TranscriptionRequest): Promise<TranscriptionResponse> {
    // ElevenLabs doesn't offer STT
    throw new VoiceProviderError(
      'ElevenLabs does not support speech-to-text',
      VoiceProviderName.ELEVENLABS,
      'NOT_SUPPORTED',
      false
    );
  }

  async synthesize(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResponse> {
    try {
      const voiceId = request.voice || 'EXAVITQu4vr4xnSDxMaL'; // Default to Sarah

      // Map format to ElevenLabs output format
      const outputFormat = this.mapOutputFormat(request.format || 'mp3');

      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: request.text,
          model_id: 'eleven_multilingual_v2', // Best multilingual model
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
          output_format: outputFormat,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      return {
        audio: buffer,
        contentType: `audio/${request.format || 'mp3'}`,
        charactersUsed: request.text.length,
      };
    } catch (error: any) {
      console.error('[ElevenLabs] Synthesis failed:', error);
      throw new VoiceProviderError(
        error.message || 'ElevenLabs synthesis failed',
        VoiceProviderName.ELEVENLABS,
        'TTS_ERROR',
        true,
        error
      );
    }
  }

  private mapOutputFormat(format: string): string {
    const formatMap: Record<string, string> = {
      mp3: 'mp3_44100_128',
      wav: 'pcm_44100',
      ogg: 'mp3_44100_128', // Fallback to mp3
      opus: 'mp3_44100_128', // Fallback to mp3
    };
    return formatMap[format] || 'mp3_44100_128';
  }

  getVoices(language?: string): VoiceDefinition[] {
    let voices = this.cachedVoices.length > 0 
      ? this.cachedVoices 
      : ElevenLabsVoiceProvider.DEFAULT_VOICES;

    if (language) {
      voices = voices.filter(v => 
        v.languageCode === language || 
        v.language.toLowerCase().includes(language.toLowerCase())
      );
    }

    return voices;
  }

  async fetchVoices(): Promise<VoiceDefinition[]> {
    // Cache for 1 hour
    if (Date.now() - this.lastVoiceFetch < 3600000 && this.cachedVoices.length > 0) {
      return this.cachedVoices;
    }

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        console.warn('[ElevenLabs] Failed to fetch voices, using defaults');
        return ElevenLabsVoiceProvider.DEFAULT_VOICES;
      }

      const data = await response.json();
      
      this.cachedVoices = (data.voices || []).map((voice: ElevenLabsVoice) => ({
        id: voice.voice_id,
        name: voice.name,
        language: 'English', // ElevenLabs supports multilingual
        languageCode: 'en',
        gender: (voice.labels?.gender as 'male' | 'female') || 'neutral',
        accent: voice.labels?.accent,
        region: this.mapAccentToRegion(voice.labels?.accent),
        provider: VoiceProviderName.ELEVENLABS,
        tier: VoiceTier.PREMIUM,
        previewUrl: voice.preview_url,
      }));

      this.lastVoiceFetch = Date.now();
      return this.cachedVoices;
    } catch (error) {
      console.error('[ElevenLabs] Error fetching voices:', error);
      return ElevenLabsVoiceProvider.DEFAULT_VOICES;
    }
  }

  private mapAccentToRegion(accent?: string): string {
    if (!accent) return 'North America';
    
    const accentLower = accent.toLowerCase();
    if (accentLower.includes('british') || accentLower.includes('scottish') || accentLower.includes('irish')) {
      return 'Europe';
    }
    if (accentLower.includes('australian')) {
      return 'Australia';
    }
    if (accentLower.includes('indian')) {
      return 'India';
    }
    return 'North America';
  }

  getSupportedLanguages(): string[] {
    // ElevenLabs multilingual v2 supports 29 languages
    return [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr', 'ru', 'nl', 
      'cs', 'ar', 'zh', 'ja', 'ko', 'hi', 'hu', 'sv', 'id', 'fil',
      'ms', 'ro', 'uk', 'el', 'vi', 'bn', 'ta', 'te', 'mr'
    ];
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
