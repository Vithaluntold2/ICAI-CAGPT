// client/src/components/shell/ConvoRow.tsx
import { cn } from '@/lib/utils';

interface ConvoRowProps {
  title: string;
  selected?: boolean;
  onClick?: () => void;
}

export function ConvoRow({ title, selected, onClick }: ConvoRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left pl-9 pr-4 py-1 text-[12px] leading-[1.35] transition-colors',
        selected
          ? 'bg-aurora-teal/5 text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <span className="line-clamp-1">{title}</span>
    </button>
  );
}
