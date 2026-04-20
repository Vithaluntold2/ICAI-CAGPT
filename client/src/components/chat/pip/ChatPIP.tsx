import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripHorizontal } from "lucide-react";
import { PIPTranscript } from "./PIPTranscript";
import { Composer, type ComposerSelection } from "../Composer";
import type { WhiteboardArtifact } from "../../../../../shared/schema";

const LS_KEY = "cagpt.pip.state.v1";

interface PIPState {
  right: number;
  bottom: number;
  collapsed: boolean;
}

function readState(): PIPState {
  const defaults: PIPState = { right: 24, bottom: 24, collapsed: false };
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (!saved) return defaults;
    return { ...defaults, ...JSON.parse(saved) };
  } catch {
    return defaults;
  }
}

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatPIP({
  messages, byId, onSend, isStreaming,
}: {
  messages: Msg[];
  byId: Record<string, WhiteboardArtifact>;
  onSend: (text: string, selection: ComposerSelection | undefined) => void;
  isStreaming?: boolean;
}) {
  const [state, setState] = useState<PIPState>(readState);
  const dragging = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

  function onMouseDown(e: React.MouseEvent) {
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    dragging.current = { dx: startClientX, dy: startClientY };
    const origRight = state.right;
    const origBottom = state.bottom;

    const move = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const deltaX = ev.clientX - startClientX;
      const deltaY = ev.clientY - startClientY;
      setState((s) => ({
        ...s,
        right: Math.max(0, Math.min(window.innerWidth - 360, origRight - deltaX)),
        bottom: Math.max(0, Math.min(window.innerHeight - 80, origBottom - deltaY)),
      }));
    };
    const up = () => {
      dragging.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  const height = state.collapsed ? 40 : 480;

  return (
    <div
      className="fixed z-30 bg-background border shadow-lg rounded-lg flex flex-col overflow-hidden"
      style={{ right: state.right, bottom: state.bottom, width: 360, height }}
      data-testid="chat-pip"
    >
      <div
        className="flex items-center gap-2 px-3 py-2 border-b bg-muted cursor-move select-none"
        onMouseDown={onMouseDown}
        data-testid="chat-pip-header"
      >
        <GripHorizontal className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium">Chat</span>
        <button
          className="ml-auto"
          onClick={() => setState((s) => ({ ...s, collapsed: !s.collapsed }))}
          data-testid="chat-pip-collapse"
          aria-label={state.collapsed ? "Expand PIP" : "Collapse PIP"}
        >
          {state.collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {!state.collapsed && (
        <>
          <PIPTranscript messages={messages} byId={byId} isStreaming={isStreaming} />
          <div className="border-t p-2">
            <Composer onSend={onSend} placeholder="Ask…" />
          </div>
        </>
      )}
    </div>
  );
}
