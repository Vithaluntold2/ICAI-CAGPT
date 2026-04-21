// client/src/components/ui/Kbd.tsx
import { cn } from '@/lib/utils';
import { MOD, SHIFT, RETURN, OPTION } from '@/lib/platform';

type KbdToken = 'mod' | 'shift' | 'return' | 'option' | string;

const GLYPHS: Record<string, string> = {
  mod: MOD,
  shift: SHIFT,
  return: RETURN,
  option: OPTION,
};

interface KbdProps {
  /** Either a list of semantic tokens ("mod", "shift", "return", "option")
   *  or raw glyphs ("K", "Esc"). Rendered with a space between. */
  keys: KbdToken[];
  className?: string;
}

export function Kbd({ keys, className }: KbdProps) {
  const rendered = keys.map((k) => GLYPHS[k] ?? k).join(' ');
  return (
    <kbd
      className={cn(
        'inline-block font-mono text-[10px] px-1.5 py-0.5 rounded',
        'bg-muted/60 border border-border text-muted-foreground',
        className
      )}
    >
      {rendered}
    </kbd>
  );
}
