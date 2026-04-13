/**
 * Voice API Routes
 * RESTful endpoints for voice transcription, synthesis, credits, and settings
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { voiceRouter } from '../services/voice/voiceRouter';
import { VoiceTier, TranscriptionRequest, SpeechSynthesisRequest } from '../services/voice/types';
import { logger } from '../services/logger';
import { requireAuth as mainRequireAuth, AuthenticatedRequest as MainAuthRequest } from '../middleware/auth';

const router = Router();

// Extend Express Request type for user
interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    [key: string]: any;
  };
}

// Configure multer for audio file uploads
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max (Whisper limit)
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/webm',
      'audio/ogg',
      'audio/flac',
      'audio/m4a',
      'audio/mp4',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid audio format: ${file.mimetype}. Supported: mp3, wav, webm, ogg, flac, m4a`));
    }
  },
});

// Middleware to ensure user is authenticated - use session userId
const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.userId || req.session?.userId || req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Populate req.user for compatibility with route handlers
  if (!req.user) {
    req.user = { id: userId };
  }
  req.userId = userId;
  next();
};

/**
 * POST /api/voice/transcribe
 * Transcribe audio to text (STT)
 */
router.post('/transcribe', requireAuth, audioUpload.single('audio'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const language = req.body.language || undefined;
    const tier = req.body.tier as VoiceTier | undefined;

    logger.info(`[VoiceRoutes] Transcription request from ${userId}, ${audioFile.size} bytes`);

    const request: TranscriptionRequest = {
      audio: audioFile.buffer,
      language,
      format: 'verbose_json',
      timestamps: req.body.timestamps === 'true',
    };

    const result = await voiceRouter.transcribe(userId, request, tier);

    res.json({
      success: true,
      text: result.text,
      language: result.language,
      duration: result.duration,
      segments: result.segments,
      usage: result.usage,
    });
  } catch (error: any) {
    logger.error('[VoiceRoutes] Transcription error:', error);
    
    if (error.code === 'INSUFFICIENT_CREDITS') {
      return res.status(402).json({ error: error.message, code: 'INSUFFICIENT_CREDITS' });
    }
    
    res.status(500).json({ error: error.message || 'Transcription failed' });
  }
});

/**
 * POST /api/voice/synthesize
 * Convert text to speech (TTS)
 */
router.post('/synthesize', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { text, voice, language, accent, speed, format, tier } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (text.length > 4096) {
      return res.status(400).json({ error: 'Text too long. Maximum 4096 characters per request.' });
    }

    logger.info(`[VoiceRoutes] Synthesis request from ${userId}, ${text.length} chars`);

    const request: SpeechSynthesisRequest = {
      text,
      voice: voice || undefined,
      language: language || 'en-US',
      accent: accent || undefined,
      speed: speed ? parseFloat(speed) : undefined,
      format: format || 'mp3',
    };

    const result = await voiceRouter.synthesize(userId, request, tier as VoiceTier);

    // Set appropriate headers for audio
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      opus: 'audio/opus',
      aac: 'audio/aac',
      flac: 'audio/flac',
    };

    const mimeType = mimeTypes[request.format || 'mp3'] || 'audio/mpeg';
    logger.info(`[VoiceRoutes] Synthesis complete: ${result.audio.length} bytes, format: ${request.format || 'mp3'}, mime: ${mimeType}`);
    
    // Send raw binary audio — disable compression to prevent mangling
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', result.audio.length.toString());
    res.setHeader('Content-Encoding', 'identity');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Characters-Used', result.charactersUsed);
    res.setHeader('X-Cost', result.usage.cost.toFixed(4));
    res.end(result.audio);
  } catch (error: any) {
    logger.error('[VoiceRoutes] Synthesis error:', error);
    
    if (error.code === 'INSUFFICIENT_CREDITS') {
      return res.status(402).json({ error: error.message, code: 'INSUFFICIENT_CREDITS' });
    }
    
    res.status(500).json({ error: error.message || 'Speech synthesis failed' });
  }
});

/**
 * GET /api/voice/credits
 * Get user's voice credits and usage
 */
router.get('/credits', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const credits = await voiceRouter.getUserVoiceCredits(userId);

    // Auto-reset: if free minutes are exhausted, bump the limit by 120
    if (credits.freeMinutesRemaining <= 0) {
      await voiceRouter.resetFreeMinutes(userId, 120);
      const refreshed = await voiceRouter.getUserVoiceCredits(userId);
      return res.json({
        tier: refreshed.tier,
        balanceMinutes: refreshed.balanceMinutes,
        freeMinutesRemaining: refreshed.freeMinutesRemaining,
        spendingCap: refreshed.spendingCap,
        preferences: {
          voice: refreshed.preferredVoice,
          language: refreshed.preferredLanguage,
          accent: refreshed.preferredAccent,
        },
      });
    }

    res.json({
      tier: credits.tier,
      balanceMinutes: credits.balanceMinutes,
      freeMinutesRemaining: credits.freeMinutesRemaining,
      spendingCap: credits.spendingCap,
      preferences: {
        voice: credits.preferredVoice,
        language: credits.preferredLanguage,
        accent: credits.preferredAccent,
      },
    });
  } catch (error: any) {
    logger.error('[VoiceRoutes] Get credits error:', error);
    res.status(500).json({ error: error.message || 'Failed to get credits' });
  }
});

/**
 * GET /api/voice/packages
 * Get available credit packages
 */
router.get('/packages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tier = req.query.tier as VoiceTier | undefined;
    const packages = voiceRouter.getCreditPackages(tier);

    res.json({
      packages: packages.map(pkg => ({
        id: pkg.id,
        name: pkg.name,
        tier: pkg.tier,
        minutes: pkg.minutes,
        price: pkg.priceUsd,
        pricePerMinute: (pkg.priceUsd / pkg.minutes).toFixed(3),
        popular: pkg.popular,
      })),
    });
  } catch (error: any) {
    logger.error('[VoiceRoutes] Get packages error:', error);
    res.status(500).json({ error: error.message || 'Failed to get packages' });
  }
});

/**
 * POST /api/voice/purchase
 * Purchase voice credits
 */
router.post('/purchase', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { packageId, paymentId } = req.body;

    if (!packageId) {
      return res.status(400).json({ error: 'Package ID is required' });
    }

    // TODO: Integrate with Stripe for actual payment processing
    // For now, just record the purchase
    const result = await voiceRouter.purchaseCredits(userId, packageId, paymentId);

    res.json({
      success: true,
      newBalance: result.newBalance,
    });
  } catch (error: any) {
    logger.error('[VoiceRoutes] Purchase error:', error);
    res.status(500).json({ error: error.message || 'Purchase failed' });
  }
});

/**
 * GET /api/voice/voices
 * Get all available voices
 */
router.get('/voices', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tier = req.query.tier as VoiceTier | undefined;
    const language = req.query.language as string | undefined;
    const region = req.query.region as string | undefined;

    const voices = voiceRouter.getAllVoices(tier, language, region);

    // Group by language/region for easier frontend display
    const grouped: Record<string, any[]> = {};
    for (const voice of voices) {
      const key = voice.region || voice.language || 'other';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push({
        id: voice.id,
        name: voice.name,
        language: voice.language,
        gender: voice.gender,
        accent: voice.accent,
        provider: voice.provider,
        tier: voice.tier,
        preview: voice.previewUrl,
      });
    }

    res.json({
      voices,
      grouped,
      count: voices.length,
    });
  } catch (error: any) {
    logger.error('[VoiceRoutes] Get voices error:', error);
    res.status(500).json({ error: error.message || 'Failed to get voices' });
  }
});

/**
 * GET /api/voice/usage
 * Get user's voice usage history
 */
router.get('/usage', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 30;

    const usage = await voiceRouter.getUsageHistory(userId, days);

    // Calculate summary
    const summary = {
      totalMinutes: 0,
      totalCost: 0,
      totalCharged: 0,
      byProvider: {} as Record<string, number>,
    };

    for (const record of usage) {
      const minutes = (record.sttDurationSeconds || 0) / 60 + (record.ttsCharacters || 0) / 750;
      summary.totalMinutes += minutes;
      summary.totalCost += record.costUsd || 0;
      summary.totalCharged += record.chargedUsd || 0;

      const provider = record.sttProvider || record.ttsProvider || 'unknown';
      summary.byProvider[provider] = (summary.byProvider[provider] || 0) + minutes;
    }

    res.json({
      history: usage,
      summary: {
        totalMinutes: summary.totalMinutes.toFixed(2),
        totalCharged: summary.totalCharged.toFixed(2),
        byProvider: summary.byProvider,
      },
    });
  } catch (error: any) {
    logger.error('[VoiceRoutes] Get usage error:', error);
    res.status(500).json({ error: error.message || 'Failed to get usage' });
  }
});

/**
 * PUT /api/voice/preferences
 * Update user voice preferences
 */
router.put('/preferences', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { voice, language, accent, autoSpeak, spendingCap } = req.body;

    await voiceRouter.updatePreferences(userId, {
      preferredVoice: voice,
      preferredLanguage: language,
      preferredAccent: accent,
      autoSpeak,
      spendingCapUsd: spendingCap,
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[VoiceRoutes] Update preferences error:', error);
    res.status(500).json({ error: error.message || 'Failed to update preferences' });
  }
});

/**
 * GET /api/voice/languages
 * Get all supported languages
 */
router.get('/languages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Return supported languages by region
    const languages = {
      india: [
        { code: 'hi-IN', name: 'Hindi' },
        { code: 'ta-IN', name: 'Tamil' },
        { code: 'te-IN', name: 'Telugu' },
        { code: 'bn-IN', name: 'Bengali' },
        { code: 'gu-IN', name: 'Gujarati' },
        { code: 'mr-IN', name: 'Marathi' },
        { code: 'kn-IN', name: 'Kannada' },
        { code: 'ml-IN', name: 'Malayalam' },
        { code: 'pa-IN', name: 'Punjabi' },
        { code: 'en-IN', name: 'English (India)' },
      ],
      middleEast: [
        { code: 'ar-SA', name: 'Arabic (Saudi)' },
        { code: 'ar-AE', name: 'Arabic (UAE)' },
        { code: 'ar-EG', name: 'Arabic (Egypt)' },
        { code: 'ar-IQ', name: 'Arabic (Iraq)' },
        { code: 'ar-JO', name: 'Arabic (Jordan)' },
        { code: 'ar-KW', name: 'Arabic (Kuwait)' },
        { code: 'ar-LB', name: 'Arabic (Lebanon)' },
        { code: 'ar-OM', name: 'Arabic (Oman)' },
        { code: 'ar-QA', name: 'Arabic (Qatar)' },
        { code: 'fa-IR', name: 'Persian (Iran)' },
        { code: 'he-IL', name: 'Hebrew (Israel)' },
        { code: 'tr-TR', name: 'Turkish' },
      ],
      southeastAsia: [
        { code: 'id-ID', name: 'Indonesian' },
        { code: 'fil-PH', name: 'Filipino (Tagalog)' },
        { code: 'ms-MY', name: 'Malay' },
        { code: 'th-TH', name: 'Thai' },
        { code: 'vi-VN', name: 'Vietnamese' },
      ],
      northAmerica: [
        { code: 'en-US', name: 'English (US)' },
        { code: 'en-CA', name: 'English (Canada)' },
        { code: 'fr-CA', name: 'French (Canada)' },
        { code: 'es-MX', name: 'Spanish (Mexico)' },
      ],
      europe: [
        { code: 'en-GB', name: 'English (UK)' },
        { code: 'en-IE', name: 'English (Ireland)' },
        { code: 'fr-FR', name: 'French (France)' },
        { code: 'de-DE', name: 'German' },
        { code: 'es-ES', name: 'Spanish (Spain)' },
        { code: 'it-IT', name: 'Italian' },
        { code: 'pt-PT', name: 'Portuguese (Portugal)' },
        { code: 'nl-NL', name: 'Dutch' },
      ],
    };

    res.json({ languages });
  } catch (error: any) {
    logger.error('[VoiceRoutes] Get languages error:', error);
    res.status(500).json({ error: error.message || 'Failed to get languages' });
  }
});

// ============================================
// Backward Compatibility Aliases
// ============================================

/**
 * POST /api/voice/stt
 * Alias for /transcribe (backward compatibility)
 */
router.post('/stt', requireAuth, audioUpload.single('audio'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const request: TranscriptionRequest = {
      audio: audioFile.buffer,
      language: req.body.language,
      format: 'verbose_json',
      timestamps: false,
    };

    const result = await voiceRouter.transcribe(userId, request);

    res.json({
      text: result.text,
      language: result.language,
      duration: result.duration,
    });
  } catch (error: any) {
    logger.error('[VoiceRoutes] STT error:', error);
    res.status(500).json({ error: error.message || 'Transcription failed' });
  }
});

/**
 * POST /api/voice/tts
 * Alias for /synthesize (backward compatibility)
 */
router.post('/tts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const request: SpeechSynthesisRequest = {
      text,
      voice: voice || 'alloy',
      language: 'en-US',
      format: 'mp3',
    };

    const result = await voiceRouter.synthesize(userId, request);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(result.audio);
  } catch (error: any) {
    logger.error('[VoiceRoutes] TTS error:', error);
    res.status(500).json({ error: error.message || 'Speech synthesis failed' });
  }
});

export default router;
