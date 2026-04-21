import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  X,
  BarChart3,
  GitBranch,
  Brain,
  Workflow,
  Table as TableIcon,
  ListChecks,
  FileText,
} from "lucide-react";
import { PIPTranscript } from "./PIPTranscript";
import { Composer, type ComposerSelection } from "../Composer";
import { useSelectionContext } from "../whiteboard/useSelectionContext";
import { cn } from "@/lib/utils";
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

function kindIcon(kind: string | undefined) {
  const cls = "w-3 h-3";
  switch (kind) {
    case "chart":
      return <BarChart3 className={cls} strokeWidth={1.75} />;
    case "flowchart":
      return <GitBranch className={cls} strokeWidth={1.75} />;
    case "mindmap":
      return <Brain className={cls} strokeWidth={1.75} />;
    case "workflow":
      return <Workflow className={cls} strokeWidth={1.75} />;
    case "spreadsheet":
      return <TableIcon className={cls} strokeWidth={1.75} />;
    case "checklist":
      return <ListChecks className={cls} strokeWidth={1.75} />;
    default:
      return <FileText className={cls} strokeWidth={1.75} />;
  }
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
  const pipRef = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState("");

  // Read current artifact selection from the whiteboard selection store so
  // the composer can display chips for the referenced artifacts and the
  // send path forwards the selection back to the parent.
  const selectedArtifactIds = useSelectionContext((s) => s.artifactIds);
  const clearSelection = useSelectionContext((s) => s.clear);
  const setSelectedArtifacts = useSelectionContext((s) => s.setArtifacts);

  const selectionChips = useMemo(() => {
    if (!selectedArtifactIds || selectedArtifactIds.length === 0) return undefined;
    return selectedArtifactIds.map((id) => {
      const a = byId[id];
      return {
        id,
        label: a?.title || a?.kind || id.slice(0, 6),
        icon: kindIcon(a?.kind),
      };
    });
  }, [selectedArtifactIds, byId]);

  const handleRemoveSelection = (id: string) => {
    const next = selectedArtifactIds.filter((x) => x !== id);
    setSelectedArtifacts(next);
  };

  const handleSend = () => {
    const text = value.trim();
    if (!text) return;
    const selection: ComposerSelection | undefined =
      selectedArtifactIds.length > 0
        ? { artifactIds: [...selectedArtifactIds] }
        : undefined;
    onSend(text, selection);
    setValue("");
    if (selectedArtifactIds.length > 0) clearSelection();
  };

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
  const hasContent = value.trim().length > 0;

  return (
    <div
      ref={pipRef}
      style={{ right: state.right, bottom: state.bottom, width: PIP_WIDTH, height }}
      className={cn(
        "fixed bg-card/85 backdrop-blur-[14px] border border-border-strong rounded-xl shadow-float",
        "flex flex-col overflow-hidden z-40",
        hasContent && "ring-1 ring-aurora-teal/20"
      )}
      data-testid="chat-pip"
    >
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/60 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onMouseDown}
        data-testid="chat-pip-header"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        <span className="font-sans font-semibold text-[12px] text-foreground">Chat</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-foreground/5 hover:text-aurora-teal-soft transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setState((s) => ({ ...s, collapsed: !s.collapsed }));
            }}
            onMouseDown={(e) => e.stopPropagation()}
            data-testid="chat-pip-collapse"
            aria-label={state.collapsed ? "Expand PIP" : "Collapse PIP"}
          >
            {state.collapsed ? (
              <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>
      {!state.collapsed && (
        <>
          <PIPTranscript messages={messages} byId={byId} isStreaming={isStreaming} />
          <div className="border-t border-border p-3">
            <Composer
              variant="pip"
              value={value}
              onChange={setValue}
              onSend={handleSend}
              placeholder="Ask about the selected artifacts…"
              selectionChips={selectionChips}
              onRemoveSelection={handleRemoveSelection}
            />
          </div>
        </>
      )}
      {/* conversationId is intentionally read so the prop stays part of the
          public contract; downstream features (e.g. per-conversation draft
          persistence) will consume it. */}
      {false && <span data-conv={conversationId} />}
    </div>
  );
}
