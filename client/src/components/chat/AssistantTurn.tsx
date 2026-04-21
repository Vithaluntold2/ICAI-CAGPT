// client/src/components/chat/AssistantTurn.tsx
import { Sparkle, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssistantTurnProps {
  modeName?: string;
  timestamp?: string;
  streaming?: boolean;
  onStop?: () => void;
  children: React.ReactNode;
}

export function AssistantTurn({
  modeName,
  timestamp,
  streaming,
  onStop,
  children,
}: AssistantTurnProps) {
  return (
    <div className="flex gap-3.5 max-w-full">
      <div className="w-[30px] h-[30px] rounded-full bg-gradient-aurora flex items-center justify-center text-white shrink-0">
        <Sparkle className="w-[15px] h-[15px]" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-[12px] text-foreground mb-1 flex items-center gap-2">
          <span>CA-GPT</span>
          {(modeName || timestamp) && (
            <span className="font-mono font-normal text-[10px] text-muted-foreground">
              {[modeName, timestamp].filter(Boolean).join(' · ')}
            </span>
          )}
          {streaming && onStop && (
            <button
              type="button"
              onClick={onStop}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
              title="Stop"
            >
              <Square className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
        <div
          className={cn(
            'text-[14px] leading-[1.58] text-foreground/90',
            streaming && 'after:inline-block after:w-2 after:h-[1.2em] after:ml-0.5 after:bg-aurora-teal after:align-text-bottom after:animate-pulse'
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
