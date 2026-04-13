/**
 * Voice Provider Types
 * Type definitions for STT and TTS providers
 */

export enum VoiceProviderName {
  OPENAI = 'openai',
  AZURE = 'azure',
  DEEPGRAM = 'deepgram',
  ELEVENLABS = 'elevenlabs',
  VOSK = 'vosk',
  PIPER = 'piper',
}

export enum VoiceTier {
  FREE = 'free',
  STANDARD = 'standard',
  PREMIUM = 'premium',
}

export interface VoiceConfig {
  provider: VoiceProviderName;
  apiKey?: string;
  endpoint?: string;
  enabled: boolean;
}

// STT Types
export interface TranscriptionRequest {
  audio: Buffer;
  language?: string;
  model?: string;
  prompt?: string;
  format?: 'json' | 'text' | 'verbose_json' | 'srt' | 'vtt';
  timestamps?: boolean;
}

export interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  confidence?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

// TTS Types
export interface SpeechSynthesisRequest {
  text: string;
  voice: string;
  language?: string;
  accent?: string;
  speed?: number;
  pitch?: number;
  format?: 'mp3' | 'opus' | 'wav' | 'ogg';
}

export interface SpeechSynthesisResponse {
  audio: Buffer;
  contentType: string;
  duration?: number;
  charactersUsed: number;
}

// Voice Definition
export interface VoiceDefinition {
  id: string;
  name: string;
  language: string;
  languageCode: string;
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
  region?: string;
  provider: VoiceProviderName;
  tier: VoiceTier;
  previewUrl?: string;
}

// Usage Tracking
export interface VoiceUsage {
  sttSeconds: number;
  ttsCharacters: number;
  costUsd: number;
  tier: VoiceTier;
}

// Pricing
export interface VoicePricing {
  tier: VoiceTier;
  sttCostPerMinute: number;
  ttsCostPerKChars: number;
  markup: number; // e.g., 0.30 for 30%
}

export const VOICE_PRICING: Record<VoiceTier, VoicePricing> = {
  [VoiceTier.FREE]: {
    tier: VoiceTier.FREE,
    sttCostPerMinute: 0.001,
    ttsCostPerKChars: 0.001,
    markup: 0, // subsidized
  },
  [VoiceTier.STANDARD]: {
    tier: VoiceTier.STANDARD,
    sttCostPerMinute: 0.0043, // Deepgram
    ttsCostPerKChars: 0.016, // Azure
    markup: 0.30,
  },
  [VoiceTier.PREMIUM]: {
    tier: VoiceTier.PREMIUM,
    sttCostPerMinute: 0.006, // OpenAI Whisper
    ttsCostPerKChars: 0.30, // ElevenLabs
    markup: 0.30,
  },
};

// Calculate user-facing price per minute (includes TTS for avg response)
export function calculatePricePerMinute(tier: VoiceTier): number {
  const pricing = VOICE_PRICING[tier];
  // Assume 750 chars TTS per minute of conversation
  const avgTtsCharsPerMin = 750;
  const baseCost = pricing.sttCostPerMinute + (pricing.ttsCostPerKChars * avgTtsCharsPerMin / 1000);
  return baseCost * (1 + pricing.markup);
}

// Credit Packages
export interface CreditPackage {
  id: string;
  name: string;
  tier: VoiceTier;
  minutes: number;
  priceUsd: number;
  savings: number; // percentage
  popular?: boolean;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  // Standard packages
  { id: 'std-starter', name: 'Standard Starter', tier: VoiceTier.STANDARD, minutes: 50, priceUsd: 1.00, savings: 0 },
  { id: 'std-basic', name: 'Standard Basic', tier: VoiceTier.STANDARD, minutes: 250, priceUsd: 4.50, savings: 10 },
  { id: 'std-pro', name: 'Standard Pro', tier: VoiceTier.STANDARD, minutes: 500, priceUsd: 8.00, savings: 20 },
  { id: 'std-business', name: 'Standard Business', tier: VoiceTier.STANDARD, minutes: 1000, priceUsd: 14.00, savings: 30 },
  // Premium packages
  { id: 'prm-starter', name: 'Premium Starter', tier: VoiceTier.PREMIUM, minutes: 10, priceUsd: 3.00, savings: 0 },
  { id: 'prm-basic', name: 'Premium Basic', tier: VoiceTier.PREMIUM, minutes: 50, priceUsd: 13.50, savings: 10 },
  { id: 'prm-pro', name: 'Premium Pro', tier: VoiceTier.PREMIUM, minutes: 100, priceUsd: 24.00, savings: 20 },
  { id: 'prm-business', name: 'Premium Business', tier: VoiceTier.PREMIUM, minutes: 250, priceUsd: 52.50, savings: 30 },
];

// Provider error
export class VoiceProviderError extends Error {
  constructor(
    message: string,
    public provider: VoiceProviderName,
    public code: string,
    public retryable: boolean,
    public originalError?: any
  ) {
    super(message);
    this.name = 'VoiceProviderError';
  }
}
