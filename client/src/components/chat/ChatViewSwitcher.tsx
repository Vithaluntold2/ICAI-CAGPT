import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export type ChatView = "chat" | "board";

export function useChatView(): [ChatView, (v: ChatView) => void] {
  const [, setLocation] = useLocation();
  const url = new URL(window.location.href);
  const current = (url.searchParams.get("view") === "board" ? "board" : "chat") as ChatView;
  const set = (v: ChatView) => {
    const u = new URL(window.location.href);
    u.searchParams.set("view", v);
    setLocation(u.pathname + u.search);
  };
  return [current, set];
}

export function ChatViewSwitcher({ value, onChange }: { value: ChatView; onChange: (v: ChatView) => void }) {
  return (
    <div className="inline-flex rounded-full border overflow-hidden text-xs" data-testid="chat-view-switcher">
      <button
        className={cn("px-4 py-1.5", value === "chat" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
        onClick={() => onChange("chat")}
        data-testid="view-switch-chat"
      >
        Chat
      </button>
      <button
        className={cn("px-4 py-1.5", value === "board" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
        onClick={() => onChange("board")}
        data-testid="view-switch-board"
      >
        Whiteboard
      </button>
    </div>
  );
}
