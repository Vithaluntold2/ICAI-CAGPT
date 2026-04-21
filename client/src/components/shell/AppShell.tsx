// client/src/components/shell/AppShell.tsx
import type { ReactNode } from 'react';
import { IconRail } from './IconRail';
import { ModeSidebar } from './ModeSidebar';
import type { ChatMode } from '@/lib/mode-registry';

interface SidebarConversation {
  id: string;
  title: string;
  mode: ChatMode;
}

interface AppShellProps {
  conversations: SidebarConversation[];
  activeMode?: ChatMode;
  activeConversationId?: string;
  userLabel?: string;
  userPlan?: string;
  userInitial?: string;
  onSelectMode: (mode: ChatMode) => void;
  onSelectConversation: (id: string) => void;
  onOpenSearch?: () => void;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
  /** Rendered inside the main pane — should include its own header. */
  children: ReactNode;
}

export function AppShell({ children, ...sidebarProps }: AppShellProps) {
  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <IconRail
        activeView="modes"
        onOpenSearch={sidebarProps.onOpenSearch}
        onNewChat={sidebarProps.onNewChat}
        onOpenSettings={sidebarProps.onOpenSettings}
      />
      <ModeSidebar {...sidebarProps} />
      <main className="flex-1 flex flex-col min-w-0 relative">{children}</main>
    </div>
  );
}
