import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceRecording, useVoiceSynthesis } from '@/hooks/use-voice';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface VoiceModeProps {
  onTranscription: (text: string) => void;
  lastAssistantMessage?: string;
  autoSpeak?: boolean;
}

export const VoiceMode: React.FC<VoiceModeProps> = ({ 
  onTranscription, 
  lastAssistantMessage,
  autoSpeak = false 
}) => {
  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceRecording();
  const { isPlaying, speak, stop } = useVoiceSynthesis();
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [voices, setVoices] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/voice/voices', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setVoices(data.voices))
      .catch(err => console.error('Failed to load voices', err));
  }, []);

  useEffect(() => {
    if (autoSpeak && lastAssistantMessage && !isPlaying) {
      speak(lastAssistantMessage, selectedVoice);
    }
  }, [lastAssistantMessage, autoSpeak, selectedVoice]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      const text = await stopRecording();
      if (text) {
        onTranscription(text);
      }
    } else {
      stop(); // Stop any current playback
      await startRecording();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isRecording ? "destructive" : "ghost"}
        size="icon"
        onClick={handleToggleRecording}
        disabled={isTranscribing}
        className={isRecording ? "animate-pulse" : ""}
        title={isRecording ? "Stop Recording" : "Start Recording"}
      >
        {isTranscribing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isRecording ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </Button>

      {lastAssistantMessage && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => isPlaying ? stop() : speak(lastAssistantMessage, selectedVoice)}
          title={isPlaying ? "Stop Speaking" : "Speak Response"}
        >
          {isPlaying ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="Voice Settings">
            <Settings className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Choose Voice (Accent)</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {voices.map((voice) => (
            <DropdownMenuItem 
              key={voice.id}
              onClick={() => setSelectedVoice(voice.id)}
              className={selectedVoice === voice.id ? "bg-accent" : ""}
            >
              <div className="flex flex-col">
                <span>{voice.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{voice.gender}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
