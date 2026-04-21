// client/src/components/shell/IconRail.tsx
import { Grid3x3, Search, Plus, Settings, Sparkle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconRailProps {
  activeView?: 'modes' | 'search';
  onOpenModes?: () => void;
  onOpenSearch?: () => void;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
}

export function IconRail({
  activeView = 'modes',
  onOpenModes,
  onOpenSearch,
  onNewChat,
  onOpenSettings,
}: IconRailProps) {
  return (
    <nav className="w-[52px] bg-sidebar border-r border-border flex flex-col items-center py-3.5 gap-1.5 shrink-0">
      <div className="w-8 h-8 rounded-lg bg-gradient-aurora flex items-center justify-center text-white mb-2.5">
        <Sparkle className="w-[18px] h-[18px]" strokeWidth={2} />
      </div>
      <RailButton label="Modes" active={activeView === 'modes'} onClick={onOpenModes}>
        <Grid3x3 className="w-4 h-4" strokeWidth={1.75} />
      </RailButton>
      <RailButton label="Search" active={activeView === 'search'} onClick={onOpenSearch}>
        <Search className="w-4 h-4" strokeWidth={1.75} />
      </RailButton>
      <RailButton label="New chat" onClick={onNewChat}>
        <Plus className="w-4 h-4" strokeWidth={1.75} />
      </RailButton>
      <div className="flex-1" />
      <RailButton label="Settings" onClick={onOpenSettings}>
        <Settings className="w-4 h-4" strokeWidth={1.75} />
      </RailButton>
    </nav>
  );
}

function RailButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
        active
          ? 'bg-aurora-teal/15 text-aurora-teal-soft'
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}
