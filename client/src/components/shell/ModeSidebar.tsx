// client/src/components/shell/ModeSidebar.tsx
import { useState, useMemo } from 'react';
import { Sun, Moon, Monitor, PanelLeftClose, PanelLeft } from 'lucide-react';

const THEME_SEGMENTS: Array<{ id: ThemeMode; label: string; Icon: typeof Sun }> = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'system', label: 'System', Icon: Monitor },
  { id: 'dark', label: 'Dark', Icon: Moon },
];
import { MODES, type ChatMode } from '@/lib/mode-registry';
import { ModeRow } from './ModeRow';
import { ConvoRow } from './ConvoRow';
import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/utils';

export type ThemeMode = 'light' | 'dark' | 'system';

interface SidebarConversation {
  id: string;
  title: string;
  mode: ChatMode;
  pinned?: boolean;
  shared?: boolean;
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
  /** When true, the sidebar collapses to a 52px icon rail. */
  collapsed?: boolean;
  /** Toggle handler invoked by the in-header collapse button. */
  onToggleSidebar?: () => void;
  onSelectMode: (mode: ChatMode) => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation?: (id: string) => void;
  onPinConversation?: (id: string) => void;
  onShareConversation?: (id: string) => void;
  onUnshareConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
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
  collapsed = false,
  onToggleSidebar,
  onSelectMode,
  onSelectConversation,
  onRenameConversation,
  onPinConversation,
  onShareConversation,
  onUnshareConversation,
  onDeleteConversation,
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
    <aside
      className={cn(
        'bg-sidebar border-r border-border flex flex-col overflow-hidden shrink-0 transition-[width] duration-200 ease-out',
        collapsed ? 'w-[52px]' : 'w-[280px]'
      )}
      aria-label="Modes sidebar"
    >
      {/* ── Header ── */}
      {!collapsed && (
        <div className="px-4 pt-3.5 pb-2.5 border-b border-border flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-[15px] tracking-tight text-foreground">
              CA-GPT
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Chartered Accountancy · Research &amp; Practice
            </div>
          </div>
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="shrink-0 w-7 h-7 -mr-1 flex items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      )}
      {collapsed && (
        <div className="h-[57px] border-b border-border shrink-0 flex items-center justify-center">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
            >
              <PanelLeft className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-2">
        {!collapsed && (
          <div className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
            Modes
          </div>
        )}

        {collapsed
          ? /* Icon-only mode buttons with tooltip */
            MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  title={mode.label}
                  onClick={() => handleModeClick(mode.id)}
                  className={cn(
                    'relative w-full h-9 flex items-center justify-center transition-colors',
                    mode.id === activeMode
                      ? 'bg-aurora-teal/10 text-aurora-teal-soft'
                      : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
                  )}
                >
                  {mode.id === activeMode && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded bg-aurora-teal shadow-glow-teal"
                    />
                  )}
                  <Icon className="w-[15px] h-[15px] shrink-0" strokeWidth={1.75} />
                </button>
              );
            })
          : /* Expanded: full ModeRow + conversation list */
            MODES.map((mode) => {
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
                          isPinned={c.pinned}
                          isShared={c.shared}
                          onClick={() => onSelectConversation(c.id)}
                          onRename={
                            onRenameConversation
                              ? () => onRenameConversation(c.id)
                              : undefined
                          }
                          onPin={
                            onPinConversation
                              ? () => onPinConversation(c.id)
                              : undefined
                          }
                          onShare={
                            onShareConversation
                              ? () => onShareConversation(c.id)
                              : undefined
                          }
                          onUnshare={
                            onUnshareConversation
                              ? () => onUnshareConversation(c.id)
                              : undefined
                          }
                          onDelete={
                            onDeleteConversation
                              ? () => onDeleteConversation(c.id)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
      </nav>

      {/* ── Footer ── */}
      {collapsed ? (
        /* Collapsed: avatar + theme icons in a compact vertical-column,
           theme icons are arranged horizontally ("becomes horizontal"). */
        <footer className="py-2.5 border-t border-border flex flex-col items-center gap-2">
          <div
            title={`${userLabel} · ${userPlan}`}
            className="w-[26px] h-[26px] rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-white text-[11px] font-bold font-display shrink-0 cursor-default"
          >
            {userInitial}
          </div>
          {onChangeTheme && (
            <div className="flex flex-col items-center gap-1">
              {THEME_SEGMENTS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() => onChangeTheme(id)}
                  aria-label={`Switch to ${label} theme`}
                  className={cn(
                    'w-6 h-6 flex items-center justify-center rounded transition-colors',
                    themeMode === id
                      ? 'bg-aurora-teal/15 text-aurora-teal-soft'
                      : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
                  )}
                >
                  <Icon className="w-3 h-3" strokeWidth={1.75} />
                </button>
              ))}
            </div>
          )}
        </footer>
      ) : (
        /* Expanded: full user row */
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
      )}
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
  return (
    <div className="inline-flex bg-foreground/[0.04] border border-border rounded-md p-0.5 shrink-0">
      {THEME_SEGMENTS.map(({ id, label, Icon }) => (
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
        >
          <Icon className="w-3 h-3" strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}
