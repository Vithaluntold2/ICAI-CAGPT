import { useState } from "react";
import { cn } from "@/lib/utils";

export type ChatView = "chat" | "board";

export function useChatView(): [ChatView, (v: ChatView) => void] {
  const [view, setView] = useState<ChatView>(() => {
    if (typeof window === "undefined") return "chat";
    return new URL(window.location.href).searchParams.get("view") === "board" ? "board" : "chat";
  });
  const set = (v: ChatView) => {
    setView(v);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("view", v);
      window.history.replaceState(null, "", u.pathname + u.search);
    } catch {
      // ignore — URL sync is best-effort
    }
  };
  return [view, set];
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
        Output
      </button>
    </div>
  );
}
