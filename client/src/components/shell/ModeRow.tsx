// client/src/components/shell/ModeRow.tsx
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface ModeRowProps {
  icon: LucideIcon;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}

export function ModeRow({ icon: Icon, label, count, active, onClick }: ModeRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative w-full flex items-center gap-2.5 px-4 py-1.5 text-[13px] transition-colors text-left',
        active
          ? 'text-aurora-teal-soft bg-gradient-to-r from-aurora-teal/10 to-transparent'
          : 'text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground'
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded bg-aurora-teal shadow-glow-teal"
        />
      )}
      <Icon className="w-[15px] h-[15px] shrink-0" strokeWidth={1.75} />
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            'font-mono text-[10px]',
            active ? 'text-aurora-teal-soft/70' : 'text-muted-foreground/70'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
