/**
 * Voice WebSocket Handler
 * Real-time voice streaming for low-latency STT and TTS
 */

import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../logger';
import { voiceRouter } from './voiceRouter';
import { VoiceTier, TranscriptionRequest, SpeechSynthesisRequest } from './types';

interface VoiceWebSocketClient {
  ws: WebSocket;
  userId: string;
  sessionId: string;
  tier: VoiceTier;
  language: string;
  voice: string;
  audioChunks: Buffer[];
  isRecording: boolean;
}

interface VoiceMessage {
  type: 'start_recording' | 'audio_chunk' | 'stop_recording' | 'synthesize' | 'config';
  data?: any;
}

interface VoiceResponse {
  type: 'transcription' | 'audio' | 'error' | 'status' | 'credits';
  data: any;
}

export class VoiceWebSocketHandler {
  private clients: Map<string, VoiceWebSocketClient> = new Map();
  private wss: WebSocketServer | null = null;

  /**
   * Initialize WebSocket server for voice
   */
  initialize(wss: WebSocketServer): void {
    this.wss = wss;
    logger.info('[VoiceWebSocket] Voice WebSocket handler initialized');
  }

  /**
   * Handle new WebSocket connection for voice
   */
  async handleConnection(
    ws: WebSocket, 
    userId: string, 
    sessionId: string
  ): Promise<void> {
    // Get user's voice settings
    const credits = await voiceRouter.getUserVoiceCredits(userId);

    const client: VoiceWebSocketClient = {
      ws,
      userId,
      sessionId,
      tier: credits.tier as VoiceTier,
      language: credits.preferredLanguage,
      voice: credits.preferredVoice,
      audioChunks: [],
      isRecording: false,
    };

    this.clients.set(sessionId, client);

    // Send initial credits info
    this.sendMessage(ws, {
      type: 'credits',
      data: {
        tier: credits.tier,
        balanceMinutes: credits.balanceMinutes,
        freeMinutesRemaining: credits.freeMinutesRemaining,
      }
    });

    ws.on('message', async (data: Buffer) => {
      try {
        // Check if it's binary audio data
        if (data[0] !== 0x7B) { // Not JSON (doesn't start with '{')
          await this.handleAudioChunk(sessionId, data);
          return;
        }

        // Parse JSON message
        const message: VoiceMessage = JSON.parse(data.toString());
        await this.handleMessage(sessionId, message);
      } catch (error: any) {
        logger.error('[VoiceWebSocket] Message handling error:', error);
        this.sendMessage(ws, {
          type: 'error',
          data: { message: error.message }
        });
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(sessionId);
    });

    ws.on('error', (err) => {
      logger.error({ error: err, sessionId }, '[VoiceWebSocket] WebSocket error');
      this.handleDisconnect(sessionId);
    });

    logger.info(`[VoiceWebSocket] Client connected: ${sessionId}`);
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(sessionId: string, message: VoiceMessage): Promise<void> {
    const client = this.clients.get(sessionId);
    if (!client) {
      return;
    }

    switch (message.type) {
      case 'start_recording':
        await this.handleStartRecording(client);
        break;

      case 'stop_recording':
        await this.handleStopRecording(client);
        break;

      case 'synthesize':
        await this.handleSynthesize(client, message.data);
        break;

      case 'config':
        this.handleConfig(client, message.data);
        break;

      default:
        logger.warn(`[VoiceWebSocket] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle audio chunk from client
   */
  private async handleAudioChunk(sessionId: string, chunk: Buffer): Promise<void> {
    const client = this.clients.get(sessionId);
    if (!client || !client.isRecording) {
      return;
    }

    client.audioChunks.push(chunk);

    // Send acknowledgment
    this.sendMessage(client.ws, {
      type: 'status',
      data: { 
        status: 'recording',
        chunks: client.audioChunks.length,
        bytes: client.audioChunks.reduce((sum, c) => sum + c.length, 0)
      }
    });
  }

  /**
   * Start recording
   */
  private async handleStartRecording(client: VoiceWebSocketClient): Promise<void> {
    client.audioChunks = [];
    client.isRecording = true;

    this.sendMessage(client.ws, {
      type: 'status',
      data: { status: 'recording_started' }
    });

    logger.info(`[VoiceWebSocket] Recording started for ${client.sessionId}`);
  }

  /**
   * Stop recording and transcribe
   */
  private async handleStopRecording(client: VoiceWebSocketClient): Promise<void> {
    client.isRecording = false;

    if (client.audioChunks.length === 0) {
      this.sendMessage(client.ws, {
        type: 'error',
        data: { message: 'No audio recorded' }
      });
      return;
    }

    this.sendMessage(client.ws, {
      type: 'status',
      data: { status: 'transcribing' }
    });

    try {
      // Combine audio chunks
      const audioBuffer = Buffer.concat(client.audioChunks);
      client.audioChunks = [];

      // Transcribe
      const request: TranscriptionRequest = {
        audio: audioBuffer,
        language: client.language,
        format: 'verbose_json',
        timestamps: false,
      };

      const result = await voiceRouter.transcribe(client.userId, request, client.tier);

      this.sendMessage(client.ws, {
        type: 'transcription',
        data: {
          text: result.text,
          language: result.language,
          duration: result.duration,
          segments: result.segments,
          usage: result.usage,
        }
      });

      // Send updated credits
      const credits = await voiceRouter.getUserVoiceCredits(client.userId);
      this.sendMessage(client.ws, {
        type: 'credits',
        data: {
          tier: credits.tier,
          balanceMinutes: credits.balanceMinutes,
          freeMinutesRemaining: credits.freeMinutesRemaining,
        }
      });

      logger.info(`[VoiceWebSocket] Transcription complete for ${client.sessionId}: "${result.text.substring(0, 50)}..."`);
    } catch (error: any) {
      this.sendMessage(client.ws, {
        type: 'error',
        data: { 
          message: error.message,
          code: error.code 
        }
      });
    }
  }

  /**
   * Handle TTS synthesis request
   */
  private async handleSynthesize(
    client: VoiceWebSocketClient, 
    data: { text: string; voice?: string; language?: string }
  ): Promise<void> {
    if (!data.text) {
      this.sendMessage(client.ws, {
        type: 'error',
        data: { message: 'No text provided' }
      });
      return;
    }

    this.sendMessage(client.ws, {
      type: 'status',
      data: { status: 'synthesizing' }
    });

    try {
      const request: SpeechSynthesisRequest = {
        text: data.text.substring(0, 4096),
        voice: data.voice || client.voice,
        language: data.language || client.language,
        format: 'mp3',
      };

      const result = await voiceRouter.synthesize(client.userId, request, client.tier);

      // Send audio as binary
      client.ws.send(result.audio, { binary: true });

      // Send usage info
      this.sendMessage(client.ws, {
        type: 'status',
        data: { 
          status: 'synthesis_complete',
          usage: result.usage 
        }
      });

      // Send updated credits
      const credits = await voiceRouter.getUserVoiceCredits(client.userId);
      this.sendMessage(client.ws, {
        type: 'credits',
        data: {
          tier: credits.tier,
          balanceMinutes: credits.balanceMinutes,
          freeMinutesRemaining: credits.freeMinutesRemaining,
        }
      });

      logger.info(`[VoiceWebSocket] Synthesis complete for ${client.sessionId}: ${result.charactersUsed} chars`);
    } catch (error: any) {
      this.sendMessage(client.ws, {
        type: 'error',
        data: { 
          message: error.message,
          code: error.code 
        }
      });
    }
  }

  /**
   * Update client configuration
   */
  private handleConfig(
    client: VoiceWebSocketClient, 
    config: { language?: string; voice?: string; tier?: VoiceTier }
  ): void {
    if (config.language) {
      client.language = config.language;
    }
    if (config.voice) {
      client.voice = config.voice;
    }
    if (config.tier) {
      client.tier = config.tier;
    }

    this.sendMessage(client.ws, {
      type: 'status',
      data: { 
        status: 'config_updated',
        config: {
          language: client.language,
          voice: client.voice,
          tier: client.tier,
        }
      }
    });
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(sessionId: string): void {
    const client = this.clients.get(sessionId);
    if (client) {
      client.audioChunks = [];
    }
    this.clients.delete(sessionId);
    logger.info(`[VoiceWebSocket] Client disconnected: ${sessionId}`);
  }

  /**
   * Send message to client
   */
  private sendMessage(ws: WebSocket, message: VoiceResponse): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Get active connection count
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * Check if user has active voice connection
   */
  hasActiveConnection(userId: string): boolean {
    for (const client of Array.from(this.clients.values())) {
      if (client.userId === userId) {
        return true;
      }
    }
    return false;
  }
}

// Singleton instance
export const voiceWebSocketHandler = new VoiceWebSocketHandler();
