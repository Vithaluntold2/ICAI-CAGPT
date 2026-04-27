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
  onShareConversation?: (id: string) => void;
  onUnshareConversation?: (id: string) => void;
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
    <div className="relative flex h-full min-h-0 bg-background text-foreground">
      {/* Aurora accent bar — 2px gradient at the very top edge of the app. */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-aurora z-50 pointer-events-none"
      />
      <IconRail
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
        onOpenSearch={onOpenSearch}
        onNewChat={onNewChat}
        onOpenSettings={onOpenSettings}
      />
      {/* Width animates 0 ↔ 280 via `width` on the sidebar itself. The
          previous attempt used an extra wrapper div, which broke the sidebar's
          own `flex-col` + `flex-1 overflow-y-auto` chain (the wrapper had no
          bounded height, so the inner `overflow-y-auto` collapsed to content
          and never scrolled). Passing `collapsed` directly lets the aside
          keep its own flex column while still animating width. */}
      <ModeSidebar
        collapsed={!sidebarOpen}
        onToggleSidebar={onToggleSidebar}
        {...sidebarProps}
      />
      <main className="flex-1 flex flex-col min-w-0 relative">{children}</main>
    </div>
  );
}
