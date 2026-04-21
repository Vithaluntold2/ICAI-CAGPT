// client/src/components/shell/ModeSidebar.tsx
import { useState, useMemo } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { MODES, type ChatMode } from '@/lib/mode-registry';
import { ModeRow } from './ModeRow';
import { ConvoRow } from './ConvoRow';
import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/utils';
import logoImg from '@assets/icai-ca-india-logo.png';

export type ThemeMode = 'light' | 'dark' | 'system';

interface SidebarConversation {
  id: string;
  title: string;
  mode: ChatMode;
}

interface ModeSidebarProps {
  conversations: SidebarConversation[];
  activeMode?: ChatMode;
  activeConversationId?: string;
  userLabel?: string;
  userPlan?: string;
  userInitial?: string;
  themeMode?: ThemeMode;
  onChangeTheme?: (mode: ThemeMode) => void;
  onSelectMode: (mode: ChatMode) => void;
  onSelectConversation: (id: string) => void;
}

export function ModeSidebar({
  conversations,
  activeMode,
  activeConversationId,
  userLabel = 'User',
  userPlan = 'Free',
  userInitial = 'U',
  themeMode = 'system',
  onChangeTheme,
  onSelectMode,
  onSelectConversation,
}: ModeSidebarProps) {
  const [expanded, setExpanded] = useState<ChatMode | null>(activeMode ?? null);

  const byMode = useMemo(() => {
    const map = new Map<ChatMode, SidebarConversation[]>();
    for (const c of conversations) {
      const list = map.get(c.mode) ?? [];
      list.push(c);
      map.set(c.mode, list);
    }
    return map;
  }, [conversations]);

  const handleModeClick = (mode: ChatMode) => {
    setExpanded((prev) => (prev === mode ? null : mode));
    onSelectMode(mode);
  };

  return (
    <aside className="w-[280px] bg-sidebar border-r border-border flex flex-col overflow-hidden shrink-0">
      <div className="px-4 pt-3.5 pb-2.5 border-b border-border flex items-center gap-2.5">
        <img src={logoImg} alt="" className="h-8 w-auto object-contain shrink-0" />
        <div className="min-w-0">
          <div className="font-display font-bold text-[15px] tracking-tight text-foreground truncate">
            CA-GPT
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            Chartered Accountancy · Research &amp; Practice
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <div className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
          Modes
        </div>
        {MODES.map((mode) => {
          const convos = byMode.get(mode.id) ?? [];
          const isExpanded = expanded === mode.id;
          return (
            <div key={mode.id}>
              <ModeRow
                icon={mode.icon}
                label={mode.label}
                count={convos.length}
                active={mode.id === activeMode}
                onClick={() => handleModeClick(mode.id)}
              />
              {isExpanded && convos.length > 0 && (
                <div>
                  {convos.map((c) => (
                    <ConvoRow
                      key={c.id}
                      title={c.title}
                      selected={c.id === activeConversationId}
                      onClick={() => onSelectConversation(c.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <footer className="px-3.5 py-2.5 border-t border-border flex items-center gap-2.5 text-[12px] text-muted-foreground">
        <div className="w-[26px] h-[26px] rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-white text-[11px] font-bold font-display shrink-0">
          {userInitial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-foreground font-display font-semibold text-[12px] truncate">
            {userLabel}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            {userPlan} · <Kbd keys={['mod', 'K']} />
          </div>
        </div>
        {onChangeTheme && (
          <ThemeToggle mode={themeMode} onChange={onChangeTheme} />
        )}
      </footer>
    </aside>
  );
}

function ThemeToggle({
  mode,
  onChange,
}: {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  // Three tightly-packed icon buttons — Light / System / Dark.
  // Active segment gets the teal tint; others muted with hover fallback.
  // Kept inline (rather than a dropdown) so theme switching is one click,
  // always visible, no menu dance.
  const segments: Array<{ id: ThemeMode; label: string; Icon: typeof Sun }> = [
    { id: 'light', label: 'Light', Icon: Sun },
    { id: 'system', label: 'System', Icon: Monitor },
    { id: 'dark', label: 'Dark', Icon: Moon },
  ];
  return (
    <div className="inline-flex bg-foreground/[0.04] border border-border rounded-md p-0.5 shrink-0">
      {segments.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          title={label}
          onClick={() => onChange(id)}
          className={cn(
            'w-6 h-6 flex items-center justify-center rounded transition-colors',
            mode === id
              ? 'bg-aurora-teal/15 text-aurora-teal-soft'
              : 'text-muted-foreground hover:text-foreground'
          )}
          aria-label={`Switch to ${label} theme`}
          aria-pressed={mode === id}
        >
          <Icon className="w-3 h-3" strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}
