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

const PIP_WIDTH = 360;
const PIP_HEIGHT_EXPANDED = 480;
const PIP_HEIGHT_COLLAPSED = 40;

// Clamp position so the entire PIP stays within the viewport. Applied on
// read, resize, and drag — any of those can produce an out-of-bounds value
// (e.g. a stale localStorage entry from before a smaller window, or a
// pre-fix bad drag saved by an earlier build).
function clampState(s: PIPState): PIPState {
  if (typeof window === "undefined") return s;
  const h = s.collapsed ? PIP_HEIGHT_COLLAPSED : PIP_HEIGHT_EXPANDED;
  return {
    ...s,
    right: Math.max(0, Math.min(window.innerWidth - PIP_WIDTH, s.right)),
    bottom: Math.max(0, Math.min(window.innerHeight - h, s.bottom)),
  };
}

function readState(): PIPState {
  const defaults: PIPState = { right: 24, bottom: 24, collapsed: false };
  try {
    const saved = localStorage.getItem(LS_KEY);
    const raw = saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    return clampState(raw);
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
  messages, byId, onSend, isStreaming, conversationId,
}: {
  messages: Msg[];
  byId: Record<string, WhiteboardArtifact>;
  onSend: (text: string, selection: ComposerSelection | undefined) => void;
  isStreaming?: boolean;
  conversationId?: string;
}) {
  const [state, setState] = useState<PIPState>(readState);
  const dragging = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

  // Re-clamp on window resize so the PIP doesn't get stranded off-screen
  // after the window is shrunk (common when docking/undocking a monitor).
  useEffect(() => {
    const onResize = () => setState((s) => clampState(s));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
      setState((s) => clampState({
        ...s,
        right: origRight - deltaX,
        bottom: origBottom - deltaY,
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

  const height = state.collapsed ? PIP_HEIGHT_COLLAPSED : PIP_HEIGHT_EXPANDED;

  return (
    <div
      className="fixed z-30 bg-background border shadow-lg rounded-lg flex flex-col overflow-hidden"
      style={{ right: state.right, bottom: state.bottom, width: PIP_WIDTH, height }}
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
            <Composer onSend={onSend} placeholder="Ask…" conversationId={conversationId} />
          </div>
        </>
      )}
    </div>
  );
}
