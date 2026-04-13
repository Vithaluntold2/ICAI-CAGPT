import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MessageSquare, Settings, LogOut, Sparkles, FileText, Search, MoreVertical, Pin, Edit3, Share2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";

interface Conversation {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  pinned?: boolean;
}

interface ChatSidebarProps {
  conversations?: Conversation[];
  activeId?: string;
  onSelectConversation?: (id: string) => void;
  onNewChat?: () => void;
  onPinConversation?: (id: string) => void;
  onEditConversation?: (id: string) => void;
  onShareConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
}

export default function ChatSidebar({ 
  conversations = [], 
  activeId,
  onSelectConversation,
  onNewChat,
  onPinConversation,
  onEditConversation,
  onShareConversation,
  onDeleteConversation
}: ChatSidebarProps) {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(
      conv => 
        conv.title.toLowerCase().includes(query) || 
        conv.preview.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // Sort conversations: pinned first, then by timestamp
  const sortedConversations = useMemo(() => {
    return [...filteredConversations].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [filteredConversations]);
  
  return (
    <div className="border-r border-border bg-sidebar flex flex-col h-screen" style={{ width: '20%', minWidth: '200px' }}>
      <div className="p-4 border-b border-sidebar-border space-y-3">
        <Button 
          className="w-full gap-2" 
          onClick={onNewChat}
          data-testid="button-new-chat"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
        
        {/* Search conversations */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
            data-testid="input-search-conversations"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          <nav role="navigation" aria-label="Professional Features">
            <div className="space-y-1">
              <div className="px-2 py-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Professional Features
                </h3>
              </div>
              <Link href="/scenarios" data-testid="link-nav-scenarios">
                <Button 
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start gap-2",
                    location === '/scenarios' && "bg-sidebar-accent"
                  )}
                  aria-current={location === '/scenarios' ? 'page' : undefined}
                  asChild
                >
                  <a>
                    <Sparkles className="w-4 h-4" />
                    Scenario Simulator
                  </a>
                </Button>
              </Link>
              <Link href="/deliverables" data-testid="link-nav-deliverables">
                <Button 
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start gap-2",
                    location === '/deliverables' && "bg-sidebar-accent"
                  )}
                  aria-current={location === '/deliverables' ? 'page' : undefined}
                  asChild
                >
                  <a>
                    <FileText className="w-4 h-4" />
                    Deliverable Composer
                  </a>
                </Button>
              </Link>
              <Link href="/search" data-testid="link-nav-search">
                <Button 
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start gap-2",
                    location === '/search' && "bg-sidebar-accent"
                  )}
                  aria-current={location === '/search' ? 'page' : undefined}
                  asChild
                >
                  <a>
                    <Search className="w-4 h-4" />
                    CA GPT Search
                  </a>
                </Button>
              </Link>
            </div>
          </nav>
          
          <div className="space-y-0.5">
            <div className="px-3 py-2">
              <h3 className="text-xs font-medium text-muted-foreground/70">
                Conversations {searchQuery && `(${sortedConversations.length} found)`}
              </h3>
            </div>
            {sortedConversations.length === 0 && searchQuery ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No conversations match "{searchQuery}"
              </div>
            ) : (
              sortedConversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group relative mx-1 rounded-lg transition-colors",
                  activeId === conv.id 
                    ? "bg-sidebar-accent" 
                    : "hover:bg-sidebar-accent/50"
                )}
                data-testid={`container-conversation-${conv.id}`}
              >
                <button
                  onClick={() => onSelectConversation?.(conv.id)}
                  className="w-full text-left px-3 py-2 pr-10"
                  data-testid={`button-conversation-${conv.id}`}
                >
                  <div className="relative overflow-hidden">
                    <span className="text-sm whitespace-nowrap">{conv.title}</span>
                    {/* ChatGPT-style fade gradient for long titles */}
                    <div className={cn(
                      "absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l pointer-events-none",
                      activeId === conv.id 
                        ? "from-sidebar-accent to-transparent" 
                        : "from-sidebar to-transparent group-hover:from-sidebar-accent/50"
                    )} />
                  </div>
                </button>
                  
                {/* 3-dot menu - positioned absolutely on the right, appears on hover */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md",
                        "opacity-0 group-hover:opacity-100 transition-opacity",
                        "hover:bg-sidebar-accent"
                      )}
                      data-testid={`button-conversation-menu-${conv.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onPinConversation?.(conv.id);
                      }}
                      data-testid={`button-pin-conversation-${conv.id}`}
                    >
                      <Pin className="w-4 h-4 mr-2" />
                      {conv.pinned ? 'Unpin' : 'Pin'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditConversation?.(conv.id);
                      }}
                      data-testid={`button-edit-conversation-${conv.id}`}
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onShareConversation?.(conv.id);
                      }}
                      data-testid={`button-share-conversation-${conv.id}`}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation?.(conv.id);
                      }}
                      className="text-destructive focus:text-destructive"
                      data-testid={`button-delete-conversation-${conv.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
            )}
          </div>
        </div>
      </ScrollArea>
      
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <Link href="/settings" data-testid="link-settings">
          <Button 
            variant="ghost" 
            className={cn(
              "w-full justify-start gap-2",
              location === '/settings' && "bg-sidebar-accent"
            )}
            aria-current={location === '/settings' ? 'page' : undefined}
            asChild
          >
            <a>
              <Settings className="w-4 h-4" />
              Settings
            </a>
          </Button>
        </Link>
        <Link href="/auth" data-testid="link-logout">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2"
            asChild
          >
            <a>
              <LogOut className="w-4 h-4" />
              Logout
            </a>
          </Button>
        </Link>
      </div>
    </div>
  );
}
