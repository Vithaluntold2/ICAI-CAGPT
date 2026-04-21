// client/src/components/chat/ChatBreadcrumb.tsx
import { cn } from '@/lib/utils';
import { getMode, type ChatMode } from '@/lib/mode-registry';

type ViewMode = 'chat' | 'whiteboard';

interface ChatBreadcrumbProps {
  mode: ChatMode;
  title: string;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  rightSlot?: React.ReactNode;
}

export function ChatBreadcrumb({
  mode,
  title,
  view,
  onViewChange,
  rightSlot,
}: ChatBreadcrumbProps) {
  const modeConfig = getMode(mode);
  const ModeIcon = modeConfig?.icon;

  return (
    <header className="h-12 px-5 border-b border-border flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2 font-display font-semibold text-[13px] min-w-0">
        <span className="flex items-center gap-1.5 text-aurora-teal-soft shrink-0">
          {ModeIcon && <ModeIcon className="w-3.5 h-3.5" strokeWidth={1.75} />}
          {modeConfig?.label ?? mode}
        </span>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground truncate">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {rightSlot}
        <ViewToggle view={view} onChange={onViewChange} />
      </div>
    </header>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div className="inline-flex bg-foreground/[0.04] border border-border rounded-md p-0.5 text-[11px] font-medium">
      {(['chat', 'whiteboard'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            'px-3 py-1 rounded transition-colors capitalize',
            view === v
              ? 'bg-aurora-teal/15 text-aurora-teal-soft'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {v === 'whiteboard' ? 'Output' : 'Chat'}
        </button>
      ))}
    </div>
  );
}
