// client/src/components/chat/Composer.tsx
import { useRef, useEffect, type KeyboardEvent, type ReactNode } from 'react';
import { Paperclip, AtSign, Mic, X } from 'lucide-react';
import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/utils';

export type ComposerVariant = 'main' | 'pip';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAttach?: () => void;
  onVoice?: () => void;
  onMention?: () => void;
  placeholder?: string;
  disabled?: boolean;
  variant?: ComposerVariant;
  /** Shown above the textarea as removable chips. */
  selectionChips?: Array<{ id: string; label: string; icon?: ReactNode }>;
  onRemoveSelection?: (id: string) => void;
}

export function Composer({
  value,
  onChange,
  onSend,
  onAttach,
  onVoice,
  onMention,
  placeholder = 'Ask CA-GPT…',
  disabled = false,
  variant = 'main',
  selectionChips,
  onRemoveSelection,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxRows = variant === 'pip' ? 4 : 8;
    const maxHeight = 24 * maxRows + 16;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, [value, variant]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault();
      if (value.trim().length > 0) onSend();
    }
  };

  const frameClass = cn(
    'border border-border-strong bg-card/85 rounded-xl px-4 py-3.5 transition-shadow',
    'backdrop-blur-[14px] supports-[backdrop-filter]:bg-card/85',
    value.trim() ? 'shadow-float ring-1 ring-aurora-teal/20' : 'shadow-float',
    disabled && 'opacity-60'
  );

  return (
    <div className={frameClass}>
      {selectionChips && selectionChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-2 mb-2 border-b border-border">
          {selectionChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-aurora-teal/12 border border-aurora-teal/30 text-aurora-teal-soft text-[10px] font-medium"
            >
              {chip.icon}
              {chip.label}
              {onRemoveSelection && (
                <button
                  type="button"
                  className="opacity-50 hover:opacity-100"
                  onClick={() => onRemoveSelection(chip.id)}
                  aria-label={`Remove ${chip.label}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="w-full bg-transparent outline-none resize-none text-[14px] text-foreground placeholder:text-muted-foreground font-sans leading-[1.5]"
      />

      <div className="flex justify-between items-center mt-2.5 text-[11px] text-muted-foreground">
        <div className="flex gap-0.5">
          <ToolButton title="Attach" onClick={onAttach}>
            <Paperclip className="w-[15px] h-[15px]" strokeWidth={1.75} />
          </ToolButton>
          <ToolButton title="Mention" onClick={onMention}>
            <AtSign className="w-[15px] h-[15px]" strokeWidth={1.75} />
          </ToolButton>
          <ToolButton title="Voice" onClick={onVoice}>
            <Mic className="w-[15px] h-[15px]" strokeWidth={1.75} />
          </ToolButton>
        </div>
        {variant === 'main' ? (
          <div className="flex items-center gap-2">
            <Kbd keys={['shift', 'return']} /> newline
            <Kbd keys={['return']} /> send
            <Kbd keys={['mod', 'K']} /> commands
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Kbd keys={['return']} /> send
          </div>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-foreground/5 hover:text-aurora-teal-soft transition-colors"
    >
      {children}
    </button>
  );
}
