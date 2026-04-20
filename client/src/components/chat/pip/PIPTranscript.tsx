import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import type { WhiteboardArtifact } from "../../../../../shared/schema";
import { useSelectionContext } from "../whiteboard/useSelectionContext";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const ARTIFACT_RE = /<artifact\s+id="([^"]+)"\s*\/?>\s*/g;

const KIND_ICON: Record<string, string> = {
  chart: "📊",
  workflow: "⎇",
  mindmap: "🧠",
  flowchart: "🔀",
  spreadsheet: "📋",
  checklist: "✓",
};

function iconFor(kind: string | undefined): string {
  if (!kind) return "📊";
  return KIND_ICON[kind] ?? "📊";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

interface Segment {
  type: "text" | "chip";
  value: string;
  id?: string;
  artifact?: WhiteboardArtifact;
}

function parseSegments(content: string, byId: Record<string, WhiteboardArtifact>): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  // Reset regex state
  const re = new RegExp(ARTIFACT_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    const id = match[1];
    segments.push({ type: "chip", value: id, id, artifact: byId[id] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }
  return segments;
}

function ArtifactChip({ id, artifact }: { id: string; artifact?: WhiteboardArtifact }) {
  const setArtifacts = useSelectionContext(s => s.setArtifacts);
  const title = artifact ? artifact.title : id;
  const kind = artifact?.kind;
  const onClick = () => {
    setArtifacts([id]);
    // Best-effort scroll to card on canvas, if rendered
    try {
      const el = document.querySelector<HTMLElement>(`[data-artifact-id="${id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    } catch {
      /* no-op */
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] hover:bg-primary/20 transition-colors align-middle mx-0.5"
      data-testid={`pip-artifact-chip-${id}`}
    >
      <span aria-hidden>{iconFor(kind)}</span>
      <span className="truncate max-w-[140px]">{truncate(title, 24)}</span>
    </button>
  );
}

export function PIPTranscript({
  messages, byId, isStreaming,
}: {
  messages: Msg[];
  byId: Record<string, WhiteboardArtifact>;
  isStreaming?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef<boolean>(true);
  const lastCountRef = useRef<number>(messages.length);

  // Before DOM updates, capture whether we were near the bottom.
  // We do this by checking on every render synchronously (layout effect
  // pattern is unnecessary here since the read happens in an effect, but
  // we use a ref of the PREVIOUS state to preserve stickiness across
  // appends).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prevCount = lastCountRef.current;
    const appended = messages.length > prevCount;
    if (appended && wasNearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    lastCountRef.current = messages.length;
  }, [messages.length]);

  // Track near-bottom state on scroll.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    wasNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  };

  if (messages.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center flex-1 text-muted-foreground p-6 text-center gap-2"
        data-testid="pip-transcript-empty"
      >
        <MessageSquare className="h-6 w-6 opacity-60" />
        <p className="text-xs">No messages yet. Ask anything to get started.</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex flex-col gap-2 p-3 overflow-auto flex-1"
      data-testid="pip-transcript"
    >
      {messages.map((m) => {
        const segments = parseSegments(m.content, byId);
        return (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "self-end bg-primary text-primary-foreground rounded-lg px-3 py-1.5 max-w-[85%] text-xs"
                : "self-start bg-muted rounded-lg px-3 py-1.5 max-w-[85%] text-xs"
            }
          >
            {segments.map((seg, i) =>
              seg.type === "chip" && seg.id ? (
                <ArtifactChip key={`chip-${i}-${seg.id}`} id={seg.id} artifact={seg.artifact} />
              ) : (
                <span key={`text-${i}`}>{seg.value}</span>
              ),
            )}
          </div>
        );
      })}
      {isStreaming && (
        <div
          className="self-start bg-muted rounded-lg px-3 py-1.5 text-xs text-muted-foreground"
          data-testid="pip-streaming-indicator"
          aria-label="Assistant is typing"
        >
          <span className="inline-flex gap-1 items-center">
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
      )}
    </div>
  );
}
