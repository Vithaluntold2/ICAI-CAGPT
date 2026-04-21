/**
 * ChatGPT/Gemini-Style Voice Component
 * 
 * Input bar: Single mic button (VAD auto-stops on silence) + headphones for Advanced Voice Mode
 * Per-message: Small speaker icon on each assistant message
 * Advanced Voice Mode: Full-screen overlay with fluid orb, ChatGPT/Gemini-inspired UX
 * User-defined accent support — the key differentiator
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Loader2,
  Headphones,
  Square,
  X,
  Phone,
  ChevronDown,
  Sparkles,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

// ==================== TYPES ====================

interface VoiceDefinition {
  id: string;
  name: string;
  language: string;
  languageCode: string;
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
  region?: string;
  provider: string;
  tier: 'free' | 'standard' | 'premium';
}

interface SpeakControls {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
  isSynthesizing: boolean;
}

interface VoiceModeEnhancedProps {
  onTranscription: (text: string) => void;
  onSendMessage?: () => void;
  onSpeakReady?: (controls: SpeakControls) => void;
  lastAssistantMessage?: string;
  autoSpeak?: boolean;
  conversationId?: string;
  inputMessage?: string;
}

export type { SpeakControls };

// ==================== ACCENT OPTIONS ====================

const ACCENT_OPTIONS = [
  { value: 'neutral', label: 'Neutral', emoji: '🌐' },
  { value: 'american', label: 'American', emoji: '🇺🇸' },
  { value: 'british', label: 'British', emoji: '🇬🇧' },
  { value: 'australian', label: 'Australian', emoji: '🇦🇺' },
  { value: 'indian', label: 'Indian', emoji: '🇮🇳' },
  { value: 'irish', label: 'Irish', emoji: '🇮🇪' },
  { value: 'scottish', label: 'Scottish', emoji: '🏴' },
  { value: 'canadian', label: 'Canadian', emoji: '🇨🇦' },
  { value: 'south-african', label: 'South African', emoji: '🇿🇦' },
  { value: 'nigerian', label: 'Nigerian', emoji: '🇳🇬' },
  { value: 'singaporean', label: 'Singaporean', emoji: '🇸🇬' },
  { value: 'middle-eastern', label: 'Middle Eastern', emoji: '🌍' },
  { value: 'french', label: 'French', emoji: '🇫🇷' },
  { value: 'german', label: 'German', emoji: '🇩🇪' },
  { value: 'spanish', label: 'Spanish', emoji: '🇪🇸' },
  { value: 'italian', label: 'Italian', emoji: '🇮🇹' },
  { value: 'japanese', label: 'Japanese', emoji: '🇯🇵' },
  { value: 'korean', label: 'Korean', emoji: '🇰🇷' },
  { value: 'chinese', label: 'Chinese', emoji: '🇨🇳' },
];

// ==================== WAV CONVERTER ====================

const convertToWav = async (webmBlob: Blob): Promise<Blob> => {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const arrayBuffer = await webmBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const numChannels = 1;
  const sampleRate = 16000;
  const bitsPerSample = 16;
  
  const offlineCtx = new OfflineAudioContext(numChannels, audioBuffer.duration * sampleRate, sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const renderedBuffer = await offlineCtx.startRendering();
  
  const channelData = renderedBuffer.getChannelData(0);
  const wavBuffer = new ArrayBuffer(44 + channelData.length * 2);
  const view = new DataView(wavBuffer);
  
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + channelData.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, channelData.length * 2, true);
  
  for (let i = 0; i < channelData.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
  }
  
  audioContext.close();
  return new Blob([wavBuffer], { type: 'audio/wav' });
};

// ==================== VAD (Voice Activity Detection) ====================

interface VADConfig {
  calibrationMs: number;
  silenceDurationMs: number;
  maxWaitForSpeech: number;
  minNoiseFloor: number;
  speechConfirmFrames: number;
  silenceResetFrames: number;
  minSpeechDelta: number;
  intervalMs: number;
}

const DEFAULT_VAD: VADConfig = {
  calibrationMs: 500,
  silenceDurationMs: 1200,
  maxWaitForSpeech: 15000,
  minNoiseFloor: 0.3,
  speechConfirmFrames: 2,
  silenceResetFrames: 2,
  minSpeechDelta: 0.3,
  intervalMs: 50,
};

function startVAD(
  analyser: AnalyserNode,
  config: VADConfig,
  onAutoStop: () => void,
  onTimeout: () => void,
): { stop: () => void } {
  let speechDetected = false;
  let silenceStart: number | null = null;
  let calibrated = false;
  let noiseFloor = 0;
  const calibrationSamples: number[] = [];
  let consecutiveSpeechFrames = 0;
  let peakRms = 0;
  const startTime = Date.now();

  const getRMS = (): number => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const val = dataArray[i] / 255;
      sum += val * val;
    }
    return Math.sqrt(sum / dataArray.length) * 100;
  };

  const interval = setInterval(() => {
    const rms = getRMS();
    const elapsed = Date.now() - startTime;
    if (rms > peakRms) peakRms = rms;

    if (!calibrated) {
      calibrationSamples.push(rms);
      if (elapsed >= config.calibrationMs) {
        const avg = calibrationSamples.reduce((a, b) => a + b, 0) / calibrationSamples.length;
        noiseFloor = Math.max(avg, config.minNoiseFloor);
        calibrated = true;
        const threshold = Math.max(noiseFloor + config.minSpeechDelta, noiseFloor * 1.3);
        console.log('[VAD] Calibrated — noise floor:', noiseFloor.toFixed(2), 'threshold:', threshold.toFixed(2));
      }
      return;
    }

    const speechThreshold = Math.max(noiseFloor + config.minSpeechDelta, noiseFloor * 1.3);
    const isSpeech = rms > speechThreshold;

    if (isSpeech) {
      consecutiveSpeechFrames++;
      if (consecutiveSpeechFrames >= config.speechConfirmFrames) {
        speechDetected = true;
      }
      if (consecutiveSpeechFrames >= config.silenceResetFrames && silenceStart) {
        silenceStart = null;
      }
    } else {
      consecutiveSpeechFrames = 0;
      if (speechDetected) {
        if (!silenceStart) {
          silenceStart = Date.now();
        } else if (Date.now() - silenceStart > config.silenceDurationMs) {
          console.log('[VAD] Auto-stop — silence detected (peak:', peakRms.toFixed(2) + ')');
          clearInterval(interval);
          onAutoStop();
          return;
        }
      }
    }

    if (!speechDetected && elapsed > config.maxWaitForSpeech) {
      console.log('[VAD] Timeout — no speech (peak:', peakRms.toFixed(2) + ')');
      clearInterval(interval);
      onTimeout();
    }
  }, config.intervalMs);

  return { stop: () => clearInterval(interval) };
}

// ==================== MAIN COMPONENT ====================

export const VoiceModeEnhanced: React.FC<VoiceModeEnhancedProps> = ({ 
  onTranscription, 
  onSendMessage,
  onSpeakReady,
  lastAssistantMessage,
  autoSpeak = false,
  conversationId,
  inputMessage,
}) => {
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState<string>('en-US-JennyNeural');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-US');
  const [voices, setVoices] = useState<VoiceDefinition[]>([]);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [orbState, setOrbState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [selectedAccent, setSelectedAccent] = useState<string>('neutral');
  const [showSettings, setShowSettings] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const vadRef = useRef<{ stop: () => void } | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const advancedModeRef = useRef(false);
  const lastAssistantMsgRef = useRef<string | undefined>(undefined);
  const orbCanvasRef = useRef<HTMLCanvasElement>(null);
  const orbAnimRef = useRef<number | null>(null);

  const { toast } = useToast();

  useEffect(() => { advancedModeRef.current = advancedMode; }, [advancedMode]);

  // Load voices + credits on mount
  useEffect(() => {
    fetchVoices();
    return () => {
      vadRef.current?.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
      if (orbAnimRef.current) cancelAnimationFrame(orbAnimRef.current);
    };
  }, []);

  // Expose speak controls to parent (for per-message speaker buttons)
  useEffect(() => {
    if (onSpeakReady) {
      onSpeakReady({ speak, stop: stopSpeaking, isPlaying, isSynthesizing });
    }
  }, [onSpeakReady, isPlaying, isSynthesizing]);

  // Advanced mode: auto-speak new assistant messages
  useEffect(() => {
    if (advancedMode && lastAssistantMessage && lastAssistantMessage !== lastAssistantMsgRef.current && !isPlaying && !isSynthesizing) {
      lastAssistantMsgRef.current = lastAssistantMessage;
      setOrbState('speaking');
      speak(lastAssistantMessage);
    }
  }, [lastAssistantMessage, advancedMode, isPlaying, isSynthesizing]);

  // Advanced mode: auto-restart listening after TTS finishes
  useEffect(() => {
    if (advancedMode && !isPlaying && !isSynthesizing && !isRecording && !isTranscribing && lastAssistantMsgRef.current) {
      const timeout = setTimeout(() => {
        if (advancedModeRef.current && !isRecording) {
          setOrbState('listening');
          startRecording();
        }
      }, 600);
      return () => clearTimeout(timeout);
    }
  }, [isPlaying, isSynthesizing, advancedMode, isRecording, isTranscribing]);

  // ==================== ORB ANIMATION ====================
  useEffect(() => {
    if (!advancedMode) {
      if (orbAnimRef.current) cancelAnimationFrame(orbAnimRef.current);
      return;
    }
    const canvas = orbCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 280;
    canvas.width = size * 2;
    canvas.height = size * 2;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(2, 2);

    let phase = 0;
    const draw = () => {
      orbAnimRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, size, size);
      phase += 0.02;

      const cx = size / 2;
      const cy = size / 2;
      const baseRadius = 65;

      let pulseSpeed = 1;
      let glowColor = 'rgba(139, 92, 246, 0.3)';
      let ringColor = 'rgba(139, 92, 246, 0.6)';
      let amplitude = 3;

      if (orbState === 'listening') {
        pulseSpeed = 2;
        glowColor = 'rgba(59, 130, 246, 0.4)';
        ringColor = 'rgba(59, 130, 246, 0.8)';
        amplitude = 8;
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a: number, b: number) => a + b, 0) / dataArray.length;
          amplitude = 5 + (avg / 255) * 25;
        }
      } else if (orbState === 'thinking') {
        pulseSpeed = 3;
        glowColor = 'rgba(234, 179, 8, 0.4)';
        ringColor = 'rgba(234, 179, 8, 0.8)';
        amplitude = 5;
      } else if (orbState === 'speaking') {
        pulseSpeed = 1.5;
        glowColor = 'rgba(34, 197, 94, 0.4)';
        ringColor = 'rgba(34, 197, 94, 0.8)';
        amplitude = 10 + Math.sin(phase * 4) * 5;
      }

      const pulse = Math.sin(phase * pulseSpeed) * amplitude;
      const radius = baseRadius + pulse;

      // Outer glow
      const gradient = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 2);
      gradient.addColorStop(0, glowColor);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      // Main orb
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      const orbGrad = ctx.createRadialGradient(cx - 10, cy - 10, 5, cx, cy, radius);
      orbGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
      orbGrad.addColorStop(0.5, ringColor);
      orbGrad.addColorStop(1, glowColor);
      ctx.fillStyle = orbGrad;
      ctx.fill();

      // Inner highlight
      ctx.beginPath();
      ctx.arc(cx - 8, cy - 8, radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fill();

      // Ripple rings
      if (orbState !== 'idle') {
        for (let i = 0; i < 3; i++) {
          const ripplePhase = (phase + i * 0.7) % 3;
          const rippleRadius = radius + ripplePhase * 20;
          const rippleAlpha = Math.max(0, 0.3 - ripplePhase * 0.1);
          ctx.beginPath();
          ctx.arc(cx, cy, rippleRadius, 0, Math.PI * 2);
          ctx.strokeStyle = ringColor.replace(/[\d.]+\)$/, rippleAlpha + ')');
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    };
    draw();
    return () => { if (orbAnimRef.current) cancelAnimationFrame(orbAnimRef.current); };
  }, [advancedMode, orbState]);

  // ==================== FETCH ====================
  const fetchVoices = async () => {
    try {
      const res = await fetch('/api/voice/voices', { credentials: 'include' });
      const data = await res.json();
      setVoices(data.voices || []);
      const creditsRes = await fetch('/api/voice/credits', { credentials: 'include' });
      if (creditsRes.ok) {
        const credits = await creditsRes.json();
        if (credits.preferences?.voice) setSelectedVoice(credits.preferences.voice);
        if (credits.preferences?.language) setSelectedLanguage(credits.preferences.language);
        if (credits.preferences?.accent) setSelectedAccent(credits.preferences.accent);
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
    }
  };

  // Auto-save preferences when accent/voice/language change
  const savePreferencesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (voices.length === 0) return;
    if (savePreferencesTimeoutRef.current) clearTimeout(savePreferencesTimeoutRef.current);
    savePreferencesTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/voice/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            voice: selectedVoice,
            language: selectedLanguage,
            accent: selectedAccent,
          }),
        });
      } catch (e) {
        console.error('Failed to save voice preferences:', e);
      }
    }, 800);
    return () => { if (savePreferencesTimeoutRef.current) clearTimeout(savePreferencesTimeoutRef.current); };
  }, [selectedVoice, selectedLanguage, selectedAccent, voices.length]);

  // ==================== RECORDING ====================
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 } 
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
        vadRef.current?.stop();
        vadRef.current = null;
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        const webmBlob = new Blob(chunks, { type: 'audio/webm' });
        if (advancedModeRef.current) setOrbState('thinking');

        try {
          const wavBlob = await convertToWav(webmBlob);
          await transcribeAndSend(wavBlob);
        } catch (convErr) {
          console.error('WAV conversion failed, sending WebM:', convErr);
          await transcribeAndSend(webmBlob);
        }

        if (audioContext.state !== 'closed') audioContext.close();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // VAD always on — auto-stops when you stop talking
      const vad = startVAD(analyser, DEFAULT_VAD, 
        () => { if (recorder.state === 'recording') recorder.stop(); },
        () => { if (recorder.state === 'recording') recorder.stop(); }
      );
      vadRef.current = vad;
      setIsRecording(true);
      if (advancedModeRef.current) setOrbState('listening');
    } catch (error: any) {
      toast({ title: "Microphone Error", description: error.message || "Could not access microphone", variant: "destructive" });
    }
  }, []);

  const stopRecording = useCallback(() => {
    vadRef.current?.stop();
    vadRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // ==================== TRANSCRIPTION ====================
  const transcribeAndSend = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      const filename = audioBlob.type === 'audio/wav' ? 'recording.wav' : 'recording.webm';
      formData.append('audio', audioBlob, filename);
      formData.append('language', selectedLanguage);

      const res = await fetch('/api/voice/transcribe', {
        method: 'POST', body: formData, credentials: 'include'
      });

      if (!res.ok) {
        const error = await res.json();
        if (error.code === 'INSUFFICIENT_CREDITS') {
          toast({ title: "Voice Credits Exhausted", description: error.error, variant: "destructive" });
          if (advancedMode) exitAdvancedMode();
          return;
        }
        throw new Error(error.error || 'Transcription failed');
      }

      const data = await res.json();
      if (data.text && data.text.trim()) {
        onTranscription(data.text);
        setTimeout(() => { if (onSendMessage) onSendMessage(); }, 100);
      } else {
        toast({ title: "No Speech Detected", description: "Try again.", variant: "default" });
        if (advancedModeRef.current) {
          setOrbState('listening');
          setTimeout(() => startRecording(), 500);
        }
      }
    } catch (error: any) {
      toast({ title: "Transcription Error", description: error.message, variant: "destructive" });
      if (advancedMode) exitAdvancedMode();
    } finally {
      setIsTranscribing(false);
    }
  };

  // ==================== TTS ====================
  const speak = async (text: string) => {
    if (isPlaying || isSynthesizing) {
      stopSpeaking();
      return;
    }

    const cleanText = text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`{1,3}[^`]*`{1,3}/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^[-*+]\s/gm, '')
      .replace(/^\d+\.\s/gm, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim();

    if (!cleanText) return;

    setIsSynthesizing(true);
    try {
      const res = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: cleanText.substring(0, 4096),
          voice: selectedVoice,
          language: selectedLanguage,
          accent: selectedAccent,
          format: 'mp3',
        })
      });

      if (!res.ok) {
        let errorMsg = 'Speech synthesis failed';
        try { const error = await res.json(); errorMsg = error.error || errorMsg; } catch {}
        throw new Error(errorMsg);
      }

      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength < 100) throw new Error('Audio response was empty');

      const serverMime = res.headers.get('content-type') || 'audio/mpeg';
      const audioBlob = new Blob([arrayBuf], { type: serverMime });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => resolve(), 3000);
        audio.oncanplaythrough = () => { clearTimeout(timeout); resolve(); };
        audio.onerror = () => { clearTimeout(timeout); reject(new Error('Cannot play: ' + serverMime)); };
        audio.load();
      });

      audio.onended = () => {
        setIsPlaying(false);
        setOrbState('idle');
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        toast({ title: "Audio Error", description: "Playback interrupted", variant: "destructive" });
      };

      currentAudioRef.current = audio;
      setIsPlaying(true);
      if (advancedModeRef.current) setOrbState('speaking');
      audio.play();
    } catch (error: any) {
      toast({ title: "Synthesis Error", description: error.message, variant: "destructive" });
      setOrbState('idle');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    setIsPlaying(false);
    setOrbState('idle');
  };

  // ==================== HANDLERS ====================
  const handleMicClick = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      stopSpeaking();
      await startRecording();
    }
  };

  const enterAdvancedMode = () => {
    setAdvancedMode(true);
    setOrbState('listening');
    if (!isRecording && !isTranscribing) {
      setTimeout(() => startRecording(), 300);
    }
    toast({ title: "\uD83C\uDF99\uFE0F Voice Mode", description: "Speak naturally \u2014 I'll respond with voice." });
  };

  const exitAdvancedMode = () => {
    setAdvancedMode(false);
    setShowSettings(false);
    setOrbState('idle');
    if (isRecording) stopRecording();
    stopSpeaking();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ':' + s.toString().padStart(2, '0');
  };

  const orbStateLabel: Record<string, string> = {
    idle: 'Ready',
    listening: 'Listening...',
    thinking: 'Thinking...',
    speaking: 'Speaking...',
  };

  // ==================== RENDER ====================
  //
  // Fullscreen overlays (recording, transcribing, advanced voice mode) are
  // portalled to <body> because this component renders inside the Composer's
  // toolbar, and the Composer has `backdrop-filter: blur(14px)` which CSS
  // promotes to a containing block for `fixed`-positioned descendants. Without
  // the portal, `fixed inset-0` resolves against the composer's 300-or-so-px
  // width instead of the viewport, producing a black strip at the top + a
  // stray orb floating mid-page.
  const recordingOverlay = isRecording && !advancedMode && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-background/95 border shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-lg font-medium">Listening...</span>
          <span className="text-sm text-muted-foreground font-mono">{formatDuration(recordingDuration)}</span>
        </div>
        <div className="relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/100/20 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-primary/100/30 animate-pulse" />
          <Mic className="w-8 h-8 text-primary relative z-10" />
        </div>
        <Button variant="destructive" size="lg" onClick={stopRecording} className="rounded-full h-14 w-14">
          <Square className="w-5 h-5 fill-current" />
        </Button>
        <p className="text-xs text-muted-foreground">Will auto-send when you stop talking</p>
      </div>
    </div>
  );

  const transcribingOverlay = isTranscribing && !advancedMode && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-background/95 border shadow-2xl">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-medium">Transcribing...</p>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5">

        {typeof document !== 'undefined' && recordingOverlay
          ? createPortal(recordingOverlay, document.body)
          : null}

        {typeof document !== 'undefined' && transcribingOverlay
          ? createPortal(transcribingOverlay, document.body)
          : null}

        {/* ADVANCED VOICE MODE — ChatGPT/Gemini style (portalled for same
            reason as above) */}
        {advancedMode && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col bg-black select-none">

            {/* Top bar */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2 z-10">
              {/* Accent badge — tap to open settings drawer */}
              <button
                aria-label="Voice settings"
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.06] transition-all text-white/80 text-sm font-medium backdrop-blur-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary/80" />
                <span>{ACCENT_OPTIONS.find(a => a.value === selectedAccent)?.emoji || '\ud83c\udf10'}{' '}{ACCENT_OPTIONS.find(a => a.value === selectedAccent)?.label || 'Neutral'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showSettings ? 'rotate-180' : ''}`} />
              </button>

              {/* Close */}
              <button
                aria-label="Exit Voice Mode"
                onClick={exitAdvancedMode}
                className="p-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] transition-colors text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Center: Orb + Status */}
            <div className="flex-1 flex flex-col items-center justify-center -mt-10">
              <canvas ref={orbCanvasRef} />

              <p className="text-white/60 text-base font-light mt-5 tracking-wide">
                {orbStateLabel[orbState]}
              </p>

              {orbState === 'listening' && recordingDuration > 0 && (
                <p className="text-white/25 text-xs font-mono mt-1.5">{formatDuration(recordingDuration)}</p>
              )}

              {isPlaying && (
                <p className="text-white/25 text-xs mt-3">Tap to interrupt</p>
              )}
            </div>

            {/* Bottom controls */}
            <div className="flex items-center justify-center gap-5 pb-10 pt-4">
              {/* Main action */}
              {isRecording ? (
                <button
                  aria-label="Stop Recording"
                  onClick={stopRecording}
                  className="w-[72px] h-[72px] rounded-full bg-white/[0.12] hover:bg-white/[0.18] flex items-center justify-center transition-all ring-1 ring-white/10"
                >
                  <div className="w-5 h-5 rounded-[4px] bg-red-500" />
                </button>
              ) : isTranscribing ? (
                <div className="w-[72px] h-[72px] rounded-full bg-white/[0.06] flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-white/60 animate-spin" />
                </div>
              ) : isPlaying ? (
                <button
                  aria-label="Stop Speaking"
                  onClick={stopSpeaking}
                  className="w-[72px] h-[72px] rounded-full bg-white/[0.12] hover:bg-white/[0.18] flex items-center justify-center transition-all ring-1 ring-white/10"
                >
                  <VolumeX className="w-7 h-7 text-white/80" />
                </button>
              ) : (
                <button
                  aria-label="Start Recording"
                  onClick={startRecording}
                  className="w-[72px] h-[72px] rounded-full bg-white/[0.12] hover:bg-white/[0.18] flex items-center justify-center transition-all ring-1 ring-white/10"
                >
                  <Mic className="w-7 h-7 text-white/80" />
                </button>
              )}

              {/* End call */}
              <button
                aria-label="End Voice Mode"
                onClick={exitAdvancedMode}
                className="w-14 h-14 rounded-full bg-red-500/90 hover:bg-red-500 flex items-center justify-center transition-all shadow-lg shadow-red-500/20"
              >
                <Phone className="w-6 h-6 text-white rotate-[135deg]" />
              </button>
            </div>

            {/* Settings drawer */}
            {showSettings && (
              <>
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/40 z-20" onClick={() => setShowSettings(false)} />

                {/* Drawer */}
                <div className="absolute bottom-0 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur-xl border-t border-white/[0.06] rounded-t-[28px] max-h-[70vh] overflow-y-auto">
                  {/* Handle */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                  </div>

                  <div className="px-6 pb-8 space-y-6">
                    {/* Accent */}
                    <div>
                      <h3 className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Accent</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {ACCENT_OPTIONS.map(accent => (
                          <button
                            key={accent.value}
                            onClick={() => setSelectedAccent(accent.value)}
                            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              selectedAccent === accent.value
                                ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                                : 'bg-white/[0.05] text-white/60 hover:bg-white/[0.08] hover:text-white/80'
                            }`}
                          >
                            <span className="text-base shrink-0">{accent.emoji}</span>
                            <span className="truncate">{accent.label}</span>
                            {selectedAccent === accent.value && <Check className="w-3 h-3 ml-auto shrink-0 text-primary/80" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Voice */}
                    <div>
                      <h3 className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Voice</h3>
                      <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1">
                        {voices
                          .filter(v => v.languageCode === selectedLanguage)
                          .map(voice => (
                            <button
                              key={voice.id}
                              onClick={() => setSelectedVoice(voice.id)}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${
                                selectedVoice === voice.id
                                  ? 'bg-rai-500/20 text-rai-300 ring-1 ring-rai-500/40'
                                  : 'bg-white/[0.05] text-white/60 hover:bg-white/[0.08] hover:text-white/80'
                              }`}
                            >
                              <div className="flex flex-col min-w-0">
                                <span className="truncate font-medium">{voice.name}</span>
                                <span className="text-[10px] text-white/30 capitalize">{voice.gender}{voice.accent ? ` \u00b7 ${voice.accent}` : ''}</span>
                              </div>
                              {selectedVoice === voice.id && <Check className="w-3 h-3 ml-auto shrink-0 text-rai-400" />}
                            </button>
                          ))
                        }
                      </div>
                    </div>

                    {/* Language */}
                    <div>
                      <h3 className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Language</h3>
                      <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1">
                        {Array.from(new Map(voices.map(v => [v.languageCode, v])).values()).map(voice => (
                          <button
                            key={voice.languageCode}
                            onClick={() => {
                              setSelectedLanguage(voice.languageCode);
                              const match = voices.find(v => v.languageCode === voice.languageCode);
                              if (match) setSelectedVoice(match.id);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                              selectedLanguage === voice.languageCode
                                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                                : 'bg-white/[0.05] text-white/50 hover:bg-white/[0.08] hover:text-white/70'
                            }`}
                          >
                            {voice.language}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>,
          document.body
        )}

        {/* ===== INPUT BAR: Just mic + headphones ===== */}

        {/* Mic — tap to record, VAD auto-stops */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isRecording ? "destructive" : "ghost"}
              size="icon"
              onClick={handleMicClick}
              disabled={isTranscribing}
              className={"h-8 w-8 rounded-full " + (isRecording ? "animate-pulse ring-2 ring-red-500" : "")}
            >
              {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>{isRecording ? "Stop" : "Voice input"}</p></TooltipContent>
        </Tooltip>

        {/* Headphones — Advanced Voice Mode */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={advancedMode ? "default" : "ghost"}
              size="icon"
              onClick={advancedMode ? exitAdvancedMode : enterAdvancedMode}
              className={"h-8 w-8 rounded-full " + (advancedMode ? "bg-primary hover:bg-secondary text-primary-foreground ring-2 ring-primary/50" : "")}
            >
              <Headphones className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>{advancedMode ? "Exit Voice Mode" : "Voice Mode"}</p></TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

// ==================== PER-MESSAGE SPEAK BUTTON ====================

export const MessageSpeakButton: React.FC<{
  text: string;
  speakControls: SpeakControls | null;
}> = ({ text, speakControls }) => {
  const [localSynthesizing, setLocalSynthesizing] = useState(false);
  const { toast } = useToast();

  const handleSpeak = async () => {
    if (!speakControls) return;
    if (speakControls.isPlaying) {
      speakControls.stop();
      return;
    }
    setLocalSynthesizing(true);
    try {
      await speakControls.speak(text);
    } catch (e: any) {
      toast({ title: "Audio Error", description: e.message, variant: "destructive" });
    } finally {
      setLocalSynthesizing(false);
    }
  };

  return (
    <button
      onClick={handleSpeak}
      disabled={speakControls?.isSynthesizing || localSynthesizing}
      className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
      title={speakControls?.isPlaying ? "Stop" : "Listen"}
    >
      {localSynthesizing || speakControls?.isSynthesizing ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : speakControls?.isPlaying ? (
        <VolumeX className="w-3.5 h-3.5" />
      ) : (
        <Volume2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
};

export default VoiceModeEnhanced;
