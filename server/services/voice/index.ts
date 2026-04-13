/**
 * Voice Services Index
 * Central export for all voice-related services and types
 */

// Types
export * from './types';

// Providers
export { VoiceProvider } from './providers/base';
export { OpenAIVoiceProvider } from './providers/openai.provider';
export { AzureVoiceProvider } from './providers/azure.provider';
export { DeepgramVoiceProvider } from './providers/deepgram.provider';
export { ElevenLabsVoiceProvider } from './providers/elevenlabs.provider';

// Services
export { voiceRouter, VoiceRouter } from './voiceRouter';
export { voiceWebSocketHandler, VoiceWebSocketHandler } from './voiceWebSocket';
