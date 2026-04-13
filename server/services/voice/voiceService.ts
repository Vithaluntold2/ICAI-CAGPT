/**
 * Voice Service (Legacy Wrapper)
 * This wraps the new voiceRouter for backward compatibility
 * New code should use voiceRouter directly
 */

import { voiceRouter } from './voiceRouter';
import { VoiceTier, VoiceDefinition } from './types';
import { logger } from '../logger';

export class VoiceService {
  /**
   * Transcribe audio buffer to text
   * @deprecated Use voiceRouter.transcribe() instead
   */
  async transcribe(audioBuffer: Buffer, language?: string, userId?: string): Promise<string> {
    logger.info('[VoiceService] Transcribing audio...');
    
    // Use system user if no user specified
    const effectiveUserId = userId || 'system';
    
    const result = await voiceRouter.transcribe(effectiveUserId, {
      audio: audioBuffer,
      language,
      format: 'json',
    }, VoiceTier.FREE);

    return result.text;
  }

  /**
   * Convert text to speech buffer
   * @deprecated Use voiceRouter.synthesize() instead
   */
  async synthesize(text: string, voice: string = 'alloy', speed: number = 1.0, userId?: string): Promise<{ audio: Buffer, contentType: string }> {
    logger.info(`[VoiceService] Synthesizing speech for text: ${text.substring(0, 50)}...`);
    
    const effectiveUserId = userId || 'system';
    
    const result = await voiceRouter.synthesize(effectiveUserId, {
      text,
      voice,
      speed,
      format: 'mp3',
    }, VoiceTier.FREE);

    return {
      audio: result.audio,
      contentType: result.contentType,
    };
  }

  /**
   * Get available voices for a given accent/language
   */
  getAvailableVoices(accent?: string): VoiceDefinition[] {
    return voiceRouter.getAllVoices(undefined, undefined, accent);
  }
}

export const voiceService = new VoiceService();
