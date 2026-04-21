// client/src/components/shell/AppShell.tsx
import type { ReactNode } from 'react';
import { IconRail } from './IconRail';
import { ModeSidebar, type ThemeMode } from './ModeSidebar';
import type { ChatMode } from '@/lib/mode-registry';

interface SidebarConversation {
  id: string;
  title: string;
  mode: ChatMode;
  pinned?: boolean;
}

interface AppShellProps {
  conversations: SidebarConversation[];
  activeMode?: ChatMode;
  activeConversationId?: string;
  userLabel?: string;
  userPlan?: string;
  userInitial?: string;
  themeMode?: ThemeMode;
  onChangeTheme?: (mode: ThemeMode) => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onSelectMode: (mode: ChatMode) => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation?: (id: string) => void;
  onPinConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onOpenSearch?: () => void;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
  /** Rendered inside the main pane — should include its own header. */
  children: ReactNode;
}

export function AppShell({
  children,
  sidebarOpen = true,
  onToggleSidebar,
  onOpenSearch,
  onNewChat,
  onOpenSettings,
  ...sidebarProps
}: AppShellProps) {
  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <IconRail
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
        onOpenSearch={onOpenSearch}
        onNewChat={onNewChat}
        onOpenSettings={onOpenSettings}
      />
      {/* Width animates 0 ↔ 280; overflow-hidden clips content on collapse so
          the sidebar doesn't shove the main pane around as it narrows. */}
      <div
        className={
          'overflow-hidden transition-[width] duration-200 ease-out ' +
          (sidebarOpen ? 'w-[280px]' : 'w-0')
        }
        aria-hidden={!sidebarOpen}
      >
        <ModeSidebar {...sidebarProps} />
      </div>
      <main className="flex-1 flex flex-col min-w-0 relative">{children}</main>
    </div>
  );
}
