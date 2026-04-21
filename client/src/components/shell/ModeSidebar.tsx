// client/src/components/shell/ModeSidebar.tsx
import { useState, useMemo } from 'react';
import { MODES, type ChatMode } from '@/lib/mode-registry';
import { ModeRow } from './ModeRow';
import { ConvoRow } from './ConvoRow';
import { Kbd } from '@/components/ui/Kbd';

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
      <div className="px-4 pt-3.5 pb-2.5 border-b border-border">
        <div className="font-display font-bold text-[15px] tracking-tight text-foreground">
          CA-GPT
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Chartered Accountancy · Research &amp; Practice
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
        <div className="w-[26px] h-[26px] rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-white text-[11px] font-bold font-display">
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
      </footer>
    </aside>
  );
}
