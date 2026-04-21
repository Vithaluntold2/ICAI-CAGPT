import { useEffect } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { MODES, type ChatMode } from '@/lib/mode-registry';
import { Plus, Moon, Maximize2, Minimize2, LogOut } from 'lucide-react';

interface RecentConversation {
  id: string;
  title: string;
  mode: ChatMode;
}

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recentConversations: RecentConversation[];
  currentView: 'chat' | 'whiteboard';
  onSelectMode: (mode: ChatMode) => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onToggleTheme: () => void;
  onToggleView: () => void;
  onSignOut: () => void;
}

export function CommandMenu(props: CommandMenuProps) {
  const { open, onOpenChange, recentConversations, currentView } = props;

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => () => {
    fn();
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search modes, conversations, actions…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Jump to mode">
          {MODES.map(({ id, label, icon: Icon }) => (
            <CommandItem key={id} onSelect={run(() => props.onSelectMode(id))}>
              <Icon className="mr-2 w-4 h-4" strokeWidth={1.75} />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>

        {recentConversations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent conversations">
              {recentConversations.slice(0, 10).map((c) => (
                <CommandItem
                  key={c.id}
                  onSelect={run(() => props.onSelectConversation(c.id))}
                >
                  {c.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={run(props.onNewChat)}>
            <Plus className="mr-2 w-4 h-4" strokeWidth={1.75} /> New chat
          </CommandItem>
          <CommandItem onSelect={run(props.onToggleTheme)}>
            <Moon className="mr-2 w-4 h-4" strokeWidth={1.75} /> Toggle theme
          </CommandItem>
          <CommandItem onSelect={run(props.onToggleView)}>
            {currentView === 'chat' ? (
              <Maximize2 className="mr-2 w-4 h-4" strokeWidth={1.75} />
            ) : (
              <Minimize2 className="mr-2 w-4 h-4" strokeWidth={1.75} />
            )}
            {currentView === 'chat' ? 'Open output' : 'Back to chat'}
          </CommandItem>
          <CommandItem onSelect={run(props.onSignOut)}>
            <LogOut className="mr-2 w-4 h-4" strokeWidth={1.75} /> Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
