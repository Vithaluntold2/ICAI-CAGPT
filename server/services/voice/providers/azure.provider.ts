/**
 * Azure Neural Voice Provider
 * Supports Azure Cognitive Services TTS with 400+ neural voices
 * Tier: Standard
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

export class AzureVoiceProvider extends VoiceProvider {
  private endpoint: string;
  private apiKey: string;
  private region: string;

  // Complete regional voice mapping per the proposal
  private static readonly VOICES: VoiceDefinition[] = [
    // India - 10 Languages
    { id: 'hi-IN-SwaraNeural', name: 'Swara (Hindi)', language: 'Hindi', languageCode: 'hi-IN', gender: 'female', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'hi-IN-MadhurNeural', name: 'Madhur (Hindi)', language: 'Hindi', languageCode: 'hi-IN', gender: 'male', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'ta-IN-PallaviNeural', name: 'Pallavi (Tamil)', language: 'Tamil', languageCode: 'ta-IN', gender: 'female', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'ta-IN-ValluvarNeural', name: 'Valluvar (Tamil)', language: 'Tamil', languageCode: 'ta-IN', gender: 'male', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'te-IN-ShrutiNeural', name: 'Shruti (Telugu)', language: 'Telugu', languageCode: 'te-IN', gender: 'female', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'te-IN-MohanNeural', name: 'Mohan (Telugu)', language: 'Telugu', languageCode: 'te-IN', gender: 'male', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'bn-IN-TanishaaNeural', name: 'Tanishaa (Bengali)', language: 'Bengali', languageCode: 'bn-IN', gender: 'female', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'bn-IN-BashkarNeural', name: 'Bashkar (Bengali)', language: 'Bengali', languageCode: 'bn-IN', gender: 'male', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'mr-IN-AarohiNeural', name: 'Aarohi (Marathi)', language: 'Marathi', languageCode: 'mr-IN', gender: 'female', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'mr-IN-ManoharNeural', name: 'Manohar (Marathi)', language: 'Marathi', languageCode: 'mr-IN', gender: 'male', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'kn-IN-SapnaNeural', name: 'Sapna (Kannada)', language: 'Kannada', languageCode: 'kn-IN', gender: 'female', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'kn-IN-GaganNeural', name: 'Gagan (Kannada)', language: 'Kannada', languageCode: 'kn-IN', gender: 'male', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'gu-IN-DhwaniNeural', name: 'Dhwani (Gujarati)', language: 'Gujarati', languageCode: 'gu-IN', gender: 'female', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'gu-IN-NiranjanNeural', name: 'Niranjan (Gujarati)', language: 'Gujarati', languageCode: 'gu-IN', gender: 'male', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'ml-IN-SobhanaNeural', name: 'Sobhana (Malayalam)', language: 'Malayalam', languageCode: 'ml-IN', gender: 'female', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'ml-IN-MidhunNeural', name: 'Midhun (Malayalam)', language: 'Malayalam', languageCode: 'ml-IN', gender: 'male', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'pa-IN-VaaniNeural', name: 'Vaani (Punjabi)', language: 'Punjabi', languageCode: 'pa-IN', gender: 'female', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'pa-IN-GurdeepNeural', name: 'Gurdeep (Punjabi)', language: 'Punjabi', languageCode: 'pa-IN', gender: 'male', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'en-IN-NeerjaNeural', name: 'Neerja (English)', language: 'English', languageCode: 'en-IN', gender: 'female', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'en-IN-PrabhatNeural', name: 'Prabhat (English)', language: 'English', languageCode: 'en-IN', gender: 'male', accent: 'Indian', region: 'India', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },

    // Middle East - Arabic, Farsi, Hebrew, Urdu
    { id: 'ar-AE-FatimaNeural', name: 'Fatima (Arabic Gulf)', language: 'Arabic', languageCode: 'ar-AE', gender: 'female', accent: 'Gulf', region: 'Middle East', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'ar-AE-HamdanNeural', name: 'Hamdan (Arabic Gulf)', language: 'Arabic', languageCode: 'ar-AE', gender: 'male', accent: 'Gulf', region: 'Middle East', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'ar-SA-ZariyahNeural', name: 'Zariyah (Arabic Saudi)', language: 'Arabic', languageCode: 'ar-SA', gender: 'female', accent: 'Saudi', region: 'Middle East', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'ar-SA-HamedNeural', name: 'Hamed (Arabic Saudi)', language: 'Arabic', languageCode: 'ar-SA', gender: 'male', accent: 'Saudi', region: 'Middle East', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'ar-EG-SalmaNeural', name: 'Salma (Arabic Egyptian)', language: 'Arabic', languageCode: 'ar-EG', gender: 'female', accent: 'Egyptian', region: 'Middle East', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'ar-EG-ShakirNeural', name: 'Shakir (Arabic Egyptian)', language: 'Arabic', languageCode: 'ar-EG', gender: 'male', accent: 'Egyptian', region: 'Middle East', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'he-IL-HilaNeural', name: 'Hila (Hebrew)', language: 'Hebrew', languageCode: 'he-IL', gender: 'female', accent: 'Israeli', region: 'Middle East', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'he-IL-AvriNeural', name: 'Avri (Hebrew)', language: 'Hebrew', languageCode: 'he-IL', gender: 'male', accent: 'Israeli', region: 'Middle East', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'fa-IR-DilaraNeural', name: 'Dilara (Farsi)', language: 'Farsi', languageCode: 'fa-IR', gender: 'female', accent: 'Persian', region: 'Middle East', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'fa-IR-FaridNeural', name: 'Farid (Farsi)', language: 'Farsi', languageCode: 'fa-IR', gender: 'male', accent: 'Persian', region: 'Middle East', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'ur-PK-UzmaNeural', name: 'Uzma (Urdu)', language: 'Urdu', languageCode: 'ur-PK', gender: 'female', accent: 'Pakistani', region: 'Middle East', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'ur-PK-AsadNeural', name: 'Asad (Urdu)', language: 'Urdu', languageCode: 'ur-PK', gender: 'male', accent: 'Pakistani', region: 'Middle East', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },

    // Indonesia
    { id: 'id-ID-GadisNeural', name: 'Gadis (Indonesian)', language: 'Indonesian', languageCode: 'id-ID', gender: 'female', accent: 'Indonesian', region: 'Indonesia', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'id-ID-ArdiNeural', name: 'Ardi (Indonesian)', language: 'Indonesian', languageCode: 'id-ID', gender: 'male', accent: 'Indonesian', region: 'Indonesia', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },

    // Philippines
    { id: 'fil-PH-BlessicaNeural', name: 'Blessica (Filipino)', language: 'Filipino', languageCode: 'fil-PH', gender: 'female', accent: 'Filipino', region: 'Philippines', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'fil-PH-AngeloNeural', name: 'Angelo (Filipino)', language: 'Filipino', languageCode: 'fil-PH', gender: 'male', accent: 'Filipino', region: 'Philippines', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'en-PH-RosaNeural', name: 'Rosa (English PH)', language: 'English', languageCode: 'en-PH', gender: 'female', accent: 'Filipino', region: 'Philippines', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'en-PH-JamesNeural', name: 'James (English PH)', language: 'English', languageCode: 'en-PH', gender: 'male', accent: 'Filipino', region: 'Philippines', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },

    // Turkey
    { id: 'tr-TR-EmelNeural', name: 'Emel (Turkish)', language: 'Turkish', languageCode: 'tr-TR', gender: 'female', accent: 'Turkish', region: 'Turkey', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'tr-TR-AhmetNeural', name: 'Ahmet (Turkish)', language: 'Turkish', languageCode: 'tr-TR', gender: 'male', accent: 'Turkish', region: 'Turkey', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },

    // Canada
    { id: 'en-CA-ClaraNeural', name: 'Clara (English CA)', language: 'English', languageCode: 'en-CA', gender: 'female', accent: 'Canadian', region: 'Canada', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'en-CA-LiamNeural', name: 'Liam (English CA)', language: 'English', languageCode: 'en-CA', gender: 'male', accent: 'Canadian', region: 'Canada', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'fr-CA-SylvieNeural', name: 'Sylvie (French CA)', language: 'French', languageCode: 'fr-CA', gender: 'female', accent: 'Quebec', region: 'Canada', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'fr-CA-AntoineNeural', name: 'Antoine (French CA)', language: 'French', languageCode: 'fr-CA', gender: 'male', accent: 'Quebec', region: 'Canada', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },

    // UK
    { id: 'en-GB-SoniaNeural', name: 'Sonia (British)', language: 'English', languageCode: 'en-GB', gender: 'female', accent: 'British', region: 'United Kingdom', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'en-GB-RyanNeural', name: 'Ryan (British)', language: 'English', languageCode: 'en-GB', gender: 'male', accent: 'British', region: 'United Kingdom', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'en-GB-LibbyNeural', name: 'Libby (British)', language: 'English', languageCode: 'en-GB', gender: 'female', accent: 'British', region: 'United Kingdom', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },

    // US
    { id: 'en-US-JennyNeural', name: 'Jenny (American)', language: 'English', languageCode: 'en-US', gender: 'female', accent: 'American', region: 'United States', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'en-US-GuyNeural', name: 'Guy (American)', language: 'English', languageCode: 'en-US', gender: 'male', accent: 'American', region: 'United States', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'en-US-AriaNeural', name: 'Aria (American)', language: 'English', languageCode: 'en-US', gender: 'female', accent: 'American', region: 'United States', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'es-US-PalomaNeural', name: 'Paloma (Spanish US)', language: 'Spanish', languageCode: 'es-US', gender: 'female', accent: 'American', region: 'United States', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
    { id: 'es-US-AlonsoNeural', name: 'Alonso (Spanish US)', language: 'Spanish', languageCode: 'es-US', gender: 'male', accent: 'American', region: 'United States', provider: VoiceProviderName.AZURE, tier: VoiceTier.STANDARD },
  ];

  constructor(config: VoiceConfig) {
    super(config);

    this.apiKey = config.apiKey || process.env.AZURE_SPEECH_KEY || '';
    this.region = process.env.AZURE_SPEECH_REGION || 'eastus';
    this.endpoint = config.endpoint || `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    if (!this.apiKey) {
      console.warn('[Azure Voice] No API key configured - provider will be disabled');
    }
  }

  getName(): VoiceProviderName {
    return VoiceProviderName.AZURE;
  }

  getTier(): VoiceTier {
    return VoiceTier.STANDARD;
  }

  supportsSTT(): boolean {
    return true; // Azure supports STT but we use Deepgram for Standard tier
  }

  supportsTTS(): boolean {
    return true;
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    if (!this.apiKey) {
      throw new VoiceProviderError(
        'Azure Speech API key not configured',
        this.getName(),
        'NO_API_KEY',
        false
      );
    }

    try {
      const language = request.language || 'en-US';
      const sttEndpoint = `https://${this.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}&format=detailed`;

      // Detect content type from audio buffer
      const contentType = this.detectAudioContentType(request.audio);

      const response = await fetch(sttEndpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Content-Type': contentType,
          'Accept': 'application/json',
        },
        body: request.audio,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure STT API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.RecognitionStatus === 'Success') {
        return {
          text: result.DisplayText || result.NBest?.[0]?.Display || '',
          language: language,
          duration: (result.Duration || 0) / 10_000_000, // Convert 100-nanosecond units to seconds
          confidence: result.NBest?.[0]?.Confidence,
        };
      } else if (result.RecognitionStatus === 'NoMatch') {
        return {
          text: '',
          language: language,
          duration: 0,
          confidence: 0,
        };
      } else {
        throw new Error(`Recognition failed: ${result.RecognitionStatus}`);
      }
    } catch (error: any) {
      console.error('[Azure Voice] Transcription failed:', error);
      throw new VoiceProviderError(
        error.message || 'Transcription failed',
        this.getName(),
        'STT_ERROR',
        true,
        error
      );
    }
  }

  private detectAudioContentType(buffer: Buffer): string {
    // Check magic bytes for common audio formats
    if (buffer.length >= 4) {
      // WAV: RIFF header
      if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
        return 'audio/wav';
      }
      // OGG/WebM: check for WebM/OGG magic
      if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
        return 'audio/webm';
      }
      // OGG
      if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
        return 'audio/ogg';
      }
      // FLAC
      if (buffer[0] === 0x66 && buffer[1] === 0x4C && buffer[2] === 0x61 && buffer[3] === 0x43) {
        return 'audio/flac';
      }
    }
    // Default to WAV for Azure compatibility
    return 'audio/wav';
  }

  async synthesize(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResponse> {
    if (!this.apiKey) {
      throw new VoiceProviderError(
        'Azure Speech API key not configured',
        this.getName(),
        'NO_API_KEY',
        false
      );
    }

    try {
      // Build SSML
      const ssml = this.buildSSML(request);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': this.getOutputFormat(request.format),
          'User-Agent': 'ICAI CAGPT-Voice',
        },
        body: ssml,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure TTS API error: ${response.status} - ${errorText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      return {
        audio: buffer,
        contentType: this.getContentType(request.format),
        charactersUsed: request.text.length,
      };
    } catch (error: any) {
      console.error('[Azure Voice] Speech synthesis failed:', error);
      throw new VoiceProviderError(
        error.message || 'Speech synthesis failed',
        this.getName(),
        'TTS_ERROR',
        true,
        error
      );
    }
  }

  private buildSSML(request: SpeechSynthesisRequest): string {
    const voice = request.voice || 'en-US-JennyNeural';
    const rate = request.speed ? `${Math.round((request.speed - 1) * 100)}%` : '0%';
    const pitch = request.pitch ? `${Math.round((request.pitch - 1) * 50)}%` : '0%';

    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${request.language || 'en-US'}">
        <voice name="${voice}">
          <prosody rate="${rate}" pitch="${pitch}">
            ${this.escapeXml(request.text)}
          </prosody>
        </voice>
      </speak>
    `.trim();
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private getOutputFormat(format?: string): string {
    const formats: Record<string, string> = {
      'mp3': 'audio-24khz-160kbitrate-mono-mp3',
      'opus': 'ogg-24khz-16bit-mono-opus',
      'wav': 'riff-24khz-16bit-mono-pcm',
      'ogg': 'ogg-24khz-16bit-mono-opus',
    };
    return formats[format || 'mp3'] || formats['mp3'];
  }

  private getContentType(format?: string): string {
    const types: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'opus': 'audio/ogg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
    };
    return types[format || 'mp3'] || types['mp3'];
  }

  getVoices(language?: string): VoiceDefinition[] {
    if (language) {
      const langLower = language.toLowerCase();
      return AzureVoiceProvider.VOICES.filter(v =>
        v.languageCode.toLowerCase().startsWith(langLower) ||
        v.language.toLowerCase().includes(langLower) ||
        v.region?.toLowerCase().includes(langLower) ||
        v.accent?.toLowerCase().includes(langLower)
      );
    }
    return AzureVoiceProvider.VOICES;
  }

  getSupportedLanguages(): string[] {
    const languages = new Set(AzureVoiceProvider.VOICES.map(v => v.languageCode));
    return Array.from(languages);
  }

  async isHealthy(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      // Simple health check - get token
      const tokenResponse = await fetch(
        `https://${this.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
            'Content-Length': '0',
          },
        }
      );
      return tokenResponse.ok;
    } catch {
      return false;
    }
  }
}
