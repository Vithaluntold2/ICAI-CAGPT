// client/src/components/chat/EmptyModeState.tsx
import { getMode, type ChatMode } from '@/lib/mode-registry';

interface EmptyModeStateProps {
  mode: ChatMode;
  onPickStarter: (prompt: string) => void;
}

export function EmptyModeState({ mode, onPickStarter }: EmptyModeStateProps) {
  const config = getMode(mode);
  if (!config) return null;
  const { icon: Icon, label, description, starters } = config;

  return (
    <div className="flex flex-col items-center text-center py-24 max-w-[560px] mx-auto">
      <div className="w-10 h-10 rounded-lg bg-gradient-aurora flex items-center justify-center text-white mb-5">
        <Icon className="w-6 h-6" strokeWidth={1.75} />
      </div>
      <h2 className="font-display font-semibold text-[22px] tracking-tight text-foreground">
        New {label} conversation
      </h2>
      <p className="text-[13px] text-muted-foreground mt-2 max-w-[480px]">
        {description}
      </p>
      <div className="flex flex-col gap-2 mt-7 w-full">
        {starters.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPickStarter(prompt)}
            className="text-left text-[13px] text-foreground px-4 py-2.5 rounded-md border border-border hover:border-aurora-teal/40 hover:bg-aurora-teal/5 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
