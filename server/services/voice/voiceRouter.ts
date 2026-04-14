/**
 * Voice Router Service
 * Routes voice requests to appropriate providers based on user tier
 * Handles credits, usage tracking, and billing
 */

import { db } from '../../db';
import { voiceCredits, voiceUsage, voiceCreditPurchases, users } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { logger } from '../logger';
import { VoiceProvider } from './providers/base';
import { OpenAIVoiceProvider } from './providers/openai.provider';
import { AzureVoiceProvider } from './providers/azure.provider';
import { DeepgramVoiceProvider } from './providers/deepgram.provider';
import { ElevenLabsVoiceProvider } from './providers/elevenlabs.provider';
import {
  VoiceProviderName,
  VoiceTier,
  VoiceDefinition,
  TranscriptionRequest,
  TranscriptionResponse,
  SpeechSynthesisRequest,
  SpeechSynthesisResponse,
  VOICE_PRICING,
  calculatePricePerMinute,
  CREDIT_PACKAGES,
  VoiceProviderError,
} from './types';

export class VoiceRouter {
  // Test accounts with unlimited voice credits
  private static readonly UNLIMITED_ACCOUNTS = [
    'vithal@finacegroup.com',
  ];
  private providers: Map<VoiceProviderName, VoiceProvider> = new Map();
  private tierProviders: Map<VoiceTier, { stt: VoiceProviderName; tts: VoiceProviderName }> = new Map();

  constructor() {
    this.initializeProviders();
    this.configureTierRouting();
  }

  private initializeProviders() {
    // Initialize OpenAI provider (Premium STT + Standard/Premium TTS)
    try {
      const openaiProvider = new OpenAIVoiceProvider({
        provider: VoiceProviderName.OPENAI,
        enabled: !!process.env.OPENAI_API_KEY,
      });
      this.providers.set(VoiceProviderName.OPENAI, openaiProvider);
      logger.info('[VoiceRouter] OpenAI voice provider initialized');
    } catch (error: any) {
      logger.warn(`[VoiceRouter] OpenAI voice provider not available: ${error?.message || error}`);
    }

    // Initialize Azure provider (Standard TTS)
    try {
      if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_KEY !== 'YOUR_AZURE_SPEECH_KEY_HERE') {
        const azureProvider = new AzureVoiceProvider({
          provider: VoiceProviderName.AZURE,
          enabled: true,
        });
        this.providers.set(VoiceProviderName.AZURE, azureProvider);
        logger.info('[VoiceRouter] Azure voice provider initialized');
      } else {
        logger.warn('[VoiceRouter] Azure Speech credentials not configured (AZURE_SPEECH_KEY missing or placeholder)');
      }
    } catch (error: any) {
      logger.warn(`[VoiceRouter] Azure voice provider not available: ${error?.message || error}`);
    }

    // Initialize Deepgram provider (Standard STT)
    try {
      if (process.env.DEEPGRAM_API_KEY) {
        const deepgramProvider = new DeepgramVoiceProvider({
          provider: VoiceProviderName.DEEPGRAM,
          enabled: true,
        });
        this.providers.set(VoiceProviderName.DEEPGRAM, deepgramProvider);
        logger.info('[VoiceRouter] Deepgram voice provider initialized');
      }
    } catch (error: any) {
      logger.warn(`[VoiceRouter] Deepgram voice provider not available: ${error?.message || error}`);
    }

    // Initialize ElevenLabs provider (Premium TTS)
    try {
      if (process.env.ELEVENLABS_API_KEY) {
        const elevenLabsProvider = new ElevenLabsVoiceProvider({
          provider: VoiceProviderName.ELEVENLABS,
          enabled: true,
        });
        this.providers.set(VoiceProviderName.ELEVENLABS, elevenLabsProvider);
        logger.info('[VoiceRouter] ElevenLabs voice provider initialized');
      }
    } catch (error: any) {
      logger.warn(`[VoiceRouter] ElevenLabs voice provider not available: ${error?.message || error}`);
    }
  }

  private configureTierRouting() {
    // Configure which providers serve which tier
    // FREE tier: Use Azure for both STT and TTS (OpenAI quota exceeded)
    const freeStt = this.providers.has(VoiceProviderName.AZURE)
      ? VoiceProviderName.AZURE
      : VoiceProviderName.OPENAI;
    const freeTts = this.providers.has(VoiceProviderName.AZURE)
      ? VoiceProviderName.AZURE
      : VoiceProviderName.OPENAI;
    
    this.tierProviders.set(VoiceTier.FREE, {
      stt: freeStt, // Azure Speech (fallback: Whisper if Azure unavailable)
      tts: freeTts, // Azure Neural TTS (fallback: OpenAI TTS)
    });

    // Standard tier: Deepgram STT (if available) + Azure TTS
    const standardStt = this.providers.has(VoiceProviderName.DEEPGRAM) 
      ? VoiceProviderName.DEEPGRAM 
      : VoiceProviderName.OPENAI;
    
    this.tierProviders.set(VoiceTier.STANDARD, {
      stt: standardStt,
      tts: VoiceProviderName.AZURE,
    });

    // Premium tier: OpenAI Whisper STT + ElevenLabs TTS (if available)
    const premiumTts = this.providers.has(VoiceProviderName.ELEVENLABS)
      ? VoiceProviderName.ELEVENLABS
      : VoiceProviderName.OPENAI;

    this.tierProviders.set(VoiceTier.PREMIUM, {
      stt: VoiceProviderName.OPENAI,
      tts: premiumTts,
    });
  }

  /**
   * Get user's voice tier and credits
   */
  async getUserVoiceCredits(userId: string): Promise<{
    tier: VoiceTier;
    balanceMinutes: number;
    freeMinutesRemaining: number;
    spendingCap: number | null;
    preferredVoice: string;
    preferredLanguage: string;
    preferredAccent: string;
  }> {
    const credits = await db
      .select()
      .from(voiceCredits)
      .where(eq(voiceCredits.userId, userId))
      .limit(1);

    if (credits.length === 0) {
      // Create default credits for new user
      const [newCredits] = await db
        .insert(voiceCredits)
        .values({
          userId,
          tier: 'free',
          balanceMinutes: 0,
          freeMinutesUsed: 0,
          freeMinutesLimit: 120,
        })
        .returning();

      return {
        tier: VoiceTier.FREE,
        balanceMinutes: 0,
        freeMinutesRemaining: 120,
        spendingCap: null,
        preferredVoice: 'en-US-JennyNeural',
        preferredLanguage: 'en-US',
        preferredAccent: 'neutral',
      };
    }

    const credit = credits[0];
    return {
      tier: credit.tier as VoiceTier,
      balanceMinutes: credit.balanceMinutes,
      freeMinutesRemaining: Math.max(0, credit.freeMinutesLimit - credit.freeMinutesUsed),
      spendingCap: credit.spendingCapUsd,
      preferredVoice: credit.preferredVoice || 'en-US-JennyNeural',
      preferredLanguage: credit.preferredLanguage || 'en-US',
      preferredAccent: credit.preferredAccent || 'neutral',
    };
  }

  /**
   * Determine effective tier for a request
   */
  async getEffectiveTier(userId: string, requestedTier?: VoiceTier): Promise<VoiceTier> {
    const credits = await this.getUserVoiceCredits(userId);

    // If user has paid credits, use requested tier (or their default)
    if (requestedTier === VoiceTier.PREMIUM && credits.balanceMinutes > 0 && credits.tier === 'premium') {
      return VoiceTier.PREMIUM;
    }
    if (requestedTier === VoiceTier.STANDARD && credits.balanceMinutes > 0 && (credits.tier === 'standard' || credits.tier === 'premium')) {
      return VoiceTier.STANDARD;
    }

    // Check if free minutes available
    if (credits.freeMinutesRemaining > 0) {
      return VoiceTier.FREE;
    }

    // No credits, no free minutes - return tier but will fail on usage
    return credits.tier as VoiceTier || VoiceTier.FREE;
  }

  /**
   * Transcribe audio (STT)
   */
  async transcribe(
    userId: string,
    request: TranscriptionRequest,
    tier?: VoiceTier
  ): Promise<TranscriptionResponse & { usage: { seconds: number; cost: number } }> {
    const effectiveTier = await this.getEffectiveTier(userId, tier);
    const routing = this.tierProviders.get(effectiveTier)!;
    const provider = this.providers.get(routing.stt);

    if (!provider) {
      const availableProviders = Array.from(this.providers.keys()).join(', ');
      const requestedProvider = routing.stt;
      logger.error(`[VoiceRouter] STT provider '${requestedProvider}' not available. Available: ${availableProviders}`);
      
      // Provide helpful error message based on which provider was expected
      if (requestedProvider === VoiceProviderName.AZURE) {
        throw new VoiceProviderError(
          'Azure Speech API is not configured. Please add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to environment variables.',
          routing.stt,
          'NO_PROVIDER',
          false
        );
      } else if (requestedProvider === VoiceProviderName.OPENAI) {
        throw new VoiceProviderError(
          'OpenAI API is not configured. Please add a valid OPENAI_API_KEY (format: sk-...) to environment variables.',
          routing.stt,
          'NO_PROVIDER',
          false
        );
      }
      
      throw new VoiceProviderError(
        `No speech-to-text provider available. Available providers: ${availableProviders}`,
        routing.stt,
        'NO_PROVIDER',
        false
      );
    }

    // Check credits before processing
    await this.checkCredits(userId, effectiveTier, 0.5); // Estimate 30 seconds

    const startTime = Date.now();
    const response = await provider.transcribe(request);
    const durationSeconds = response.duration || (Date.now() - startTime) / 1000;

    // Calculate and deduct usage
    const usage = await this.recordUsage(userId, effectiveTier, {
      sttSeconds: durationSeconds,
      ttsCharacters: 0,
      sttProvider: provider.getName(),
    });

    return {
      ...response,
      usage: {
        seconds: durationSeconds,
        cost: usage.charged,
      },
    };
  }

  /**
   * Synthesize speech (TTS)
   */
  async synthesize(
    userId: string,
    request: SpeechSynthesisRequest,
    tier?: VoiceTier
  ): Promise<SpeechSynthesisResponse & { usage: { characters: number; cost: number } }> {
    const effectiveTier = await this.getEffectiveTier(userId, tier);
    const routing = this.tierProviders.get(effectiveTier)!;
    const provider = this.providers.get(routing.tts);

    if (!provider) {
      throw new VoiceProviderError(
        'No TTS provider available',
        routing.tts,
        'NO_PROVIDER',
        false
      );
    }

    // Estimate cost (characters / 1000 * cost per K chars)
    const estimatedMinutes = request.text.length / 750; // ~750 chars per minute
    await this.checkCredits(userId, effectiveTier, estimatedMinutes);

    const response = await provider.synthesize(request);

    // Calculate and deduct usage
    const usage = await this.recordUsage(userId, effectiveTier, {
      sttSeconds: 0,
      ttsCharacters: response.charactersUsed,
      ttsProvider: provider.getName(),
      voiceUsed: request.voice,
      languageUsed: request.language,
    });

    return {
      ...response,
      usage: {
        characters: response.charactersUsed,
        cost: usage.charged,
      },
    };
  }

  /**
   * Check if user has enough credits
   */
  private async checkCredits(userId: string, tier: VoiceTier, estimatedMinutes: number): Promise<void> {
    // Check if user is a test/unlimited account
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (user && VoiceRouter.UNLIMITED_ACCOUNTS.includes(user.email.toLowerCase())) {
      return; // Unlimited — skip credit check
    }

    const credits = await this.getUserVoiceCredits(userId);

    if (tier === VoiceTier.FREE) {
      if (credits.freeMinutesRemaining < estimatedMinutes) {
        throw new VoiceProviderError(
          `Free voice minutes exhausted. ${credits.freeMinutesRemaining.toFixed(1)} minutes remaining. Purchase voice credits to continue.`,
          VoiceProviderName.OPENAI,
          'INSUFFICIENT_CREDITS',
          false
        );
      }
      return;
    }

    // Paid tiers
    if (credits.balanceMinutes < estimatedMinutes) {
      throw new VoiceProviderError(
        `Insufficient voice credits. ${credits.balanceMinutes.toFixed(1)} minutes remaining. Purchase more credits to continue.`,
        VoiceProviderName.OPENAI,
        'INSUFFICIENT_CREDITS',
        false
      );
    }

    // Check spending cap
    if (credits.spendingCap !== null) {
      // TODO: Check monthly spend against cap
    }
  }

  /**
   * Record usage and deduct credits
   */
  private async recordUsage(
    userId: string,
    tier: VoiceTier,
    usage: {
      sttSeconds: number;
      ttsCharacters: number;
      sttProvider?: string;
      ttsProvider?: string;
      voiceUsed?: string;
      languageUsed?: string;
      conversationId?: string;
    }
  ): Promise<{ cost: number; charged: number }> {
    const pricing = VOICE_PRICING[tier];
    
    // Calculate our cost
    const sttCost = (usage.sttSeconds / 60) * pricing.sttCostPerMinute;
    const ttsCost = (usage.ttsCharacters / 1000) * pricing.ttsCostPerKChars;
    const totalCost = sttCost + ttsCost;
    
    // Calculate user charge (with markup)
    const charged = tier === VoiceTier.FREE ? 0 : totalCost * (1 + pricing.markup);

    // Calculate minutes used (for credit deduction)
    const minutesUsed = (usage.sttSeconds / 60) + (usage.ttsCharacters / 750);

    // Record usage
    await db.insert(voiceUsage).values({
      userId,
      conversationId: usage.conversationId,
      tier,
      sttProvider: usage.sttProvider,
      ttsProvider: usage.ttsProvider,
      sttDurationSeconds: usage.sttSeconds,
      ttsCharacters: usage.ttsCharacters,
      voiceUsed: usage.voiceUsed,
      languageUsed: usage.languageUsed,
      costUsd: totalCost,
      chargedUsd: charged,
    });

    // Deduct credits
    if (tier === VoiceTier.FREE) {
      await db
        .update(voiceCredits)
        .set({
          freeMinutesUsed: sql`${voiceCredits.freeMinutesUsed} + ${minutesUsed}`,
          updatedAt: new Date(),
        })
        .where(eq(voiceCredits.userId, userId));
    } else {
      await db
        .update(voiceCredits)
        .set({
          balanceMinutes: sql`${voiceCredits.balanceMinutes} - ${minutesUsed}`,
          updatedAt: new Date(),
        })
        .where(eq(voiceCredits.userId, userId));
    }

    logger.info(`[VoiceRouter] Recorded usage for ${userId}: ${minutesUsed.toFixed(2)} min, cost: $${totalCost.toFixed(4)}, charged: $${charged.toFixed(4)}`);

    return { cost: totalCost, charged };
  }

  /**
   * Reset free minutes for a user (bump limit so they get more free minutes)
   */
  async resetFreeMinutes(userId: string, newLimit: number): Promise<void> {
    await db
      .update(voiceCredits)
      .set({
        freeMinutesUsed: 0,
        freeMinutesLimit: newLimit,
        updatedAt: new Date(),
      })
      .where(eq(voiceCredits.userId, userId));
    logger.info(`[VoiceRouter] Reset free minutes for ${userId}: limit=${newLimit}`);
  }

  /**
   * Purchase voice credits
   */
  async purchaseCredits(
    userId: string,
    packageId: string,
    paymentId?: string
  ): Promise<{ success: boolean; newBalance: number }> {
    const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
    if (!pkg) {
      throw new Error(`Invalid package ID: ${packageId}`);
    }

    // Record purchase
    await db.insert(voiceCreditPurchases).values({
      userId,
      packageId,
      tier: pkg.tier,
      minutesPurchased: pkg.minutes,
      amountUsd: pkg.priceUsd,
      paymentId,
      status: 'completed',
    });

    // Add credits to user balance
    const [updated] = await db
      .update(voiceCredits)
      .set({
        tier: pkg.tier,
        balanceMinutes: sql`${voiceCredits.balanceMinutes} + ${pkg.minutes}`,
        updatedAt: new Date(),
      })
      .where(eq(voiceCredits.userId, userId))
      .returning();

    logger.info(`[VoiceRouter] Credits purchased for ${userId}: ${pkg.minutes} min (${pkg.tier})`);

    return {
      success: true,
      newBalance: updated?.balanceMinutes || pkg.minutes,
    };
  }

  /**
   * Get all available voices
   */
  getAllVoices(tier?: VoiceTier, language?: string, region?: string): VoiceDefinition[] {
    let voices: VoiceDefinition[] = [];

    for (const provider of Array.from(this.providers.values())) {
      voices = voices.concat(provider.getVoices(language));
    }

    // Filter by tier if specified
    if (tier) {
      voices = voices.filter(v => {
        if (tier === VoiceTier.PREMIUM) return true; // Premium gets all voices
        if (tier === VoiceTier.STANDARD) return v.tier !== VoiceTier.PREMIUM;
        return v.tier === VoiceTier.FREE || v.provider === VoiceProviderName.OPENAI;
      });
    }

    // Filter by region if specified
    if (region) {
      voices = voices.filter(v => 
        v.region?.toLowerCase().includes(region.toLowerCase()) ||
        v.accent?.toLowerCase().includes(region.toLowerCase())
      );
    }

    return voices;
  }

  /**
   * Get credit packages
   */
  getCreditPackages(tier?: VoiceTier): typeof CREDIT_PACKAGES {
    if (tier) {
      return CREDIT_PACKAGES.filter(p => p.tier === tier);
    }
    return CREDIT_PACKAGES;
  }

  /**
   * Get usage history for user
   */
  async getUsageHistory(userId: string, days: number = 30): Promise<any[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const usage = await db
      .select()
      .from(voiceUsage)
      .where(and(
        eq(voiceUsage.userId, userId),
        gte(voiceUsage.createdAt, since)
      ))
      .orderBy(sql`${voiceUsage.createdAt} DESC`)
      .limit(100);

    return usage;
  }

  /**
   * Update user voice preferences
   */
  async updatePreferences(
    userId: string,
    preferences: {
      preferredVoice?: string;
      preferredLanguage?: string;
      preferredAccent?: string;
      autoSpeak?: boolean;
      spendingCapUsd?: number | null;
    }
  ): Promise<void> {
    await db
      .update(voiceCredits)
      .set({
        ...preferences,
        updatedAt: new Date(),
      })
      .where(eq(voiceCredits.userId, userId));
  }

  /**
   * Reset monthly free minutes (call this on monthly cron)
   */
  async resetMonthlyFreeMinutes(): Promise<number> {
    const result = await db
      .update(voiceCredits)
      .set({
        freeMinutesUsed: 0,
        updatedAt: new Date(),
      })
      .returning();

    logger.info(`[VoiceRouter] Reset free minutes for ${result.length} users`);
    return result.length;
  }
}

// Singleton instance
export const voiceRouter = new VoiceRouter();
