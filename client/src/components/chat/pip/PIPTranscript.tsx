import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import type { WhiteboardArtifact } from "../../../../../shared/schema";
import { useSelectionContext } from "../whiteboard/useSelectionContext";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

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

/**
 * Rewrites raw markdown content before handing it to ReactMarkdown:
 * replaces `<artifact id="..."/>` placeholder tags with a sentinel span that
 * our custom markdown `span` component matcher can pick up and swap for an
 * <ArtifactChip>. We can't do this via rehypeArtifactPlaceholder directly
 * because the chip needs access to `byId` which is a closure over the
 * component prop — easiest is a simple pre-pass on the source string.
 */
function rewriteArtifactPlaceholders(content: string): string {
  return content.replace(
    /<artifact\s+id="([^"]+)"\s*\/?>\s*(<\/artifact>)?/g,
    (_m, id) => `<span data-artifact-chip="${id}"></span>`,
  );
}

function ArtifactChip({ id, byId }: { id: string; byId: Record<string, WhiteboardArtifact> }) {
  const setArtifacts = useSelectionContext(s => s.setArtifacts);
  const artifact = byId[id];
  const title = artifact ? artifact.title : id;
  const kind = artifact?.kind;
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setArtifacts([id]);
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
      className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] hover:bg-primary/20 transition-colors align-middle mx-0.5 not-prose"
      data-testid={`pip-artifact-chip-${id}`}
    >
      <span aria-hidden>{iconFor(kind)}</span>
      <span className="truncate max-w-[140px]">{truncate(title, 24)}</span>
    </button>
  );
}

/**
 * Rich markdown rendering for one message inside the PIP transcript.
 * Same plugin chain as the main chat view so tables, math, code, headings,
 * lists, blockquotes, and LaTeX render identically. Artifact placeholders
 * become clickable chips (NOT full-size rendered artifacts — those live on
 * the whiteboard, the PIP is a conversational summary).
 *
 * Compact styling: prose-xs equivalent, tight line-height, small headings,
 * overflow-scroll for tables so wide content doesn't burst the PIP bounds.
 */
function MessageMarkdown({ content, byId, isUser }: { content: string; byId: Record<string, WhiteboardArtifact>; isUser: boolean }) {
  const rewritten = rewriteArtifactPlaceholders(content);
  // User and assistant bubbles both sit on low-alpha tinted surfaces against
  // the PIP's dark card — the foreground text stays at the regular foreground
  // colour in both cases, so `dark:prose-invert` is the right pick for both.
  // The old code forced `prose-invert` on the user bubble, which only makes
  // sense when the background is a solid primary fill (which it was before
  // we switched to the subtle aurora-teal tint).
  void isUser;
  return (
    <div
      className={cn(
        "prose prose-xs max-w-none break-words",
        "dark:prose-invert",
        // Compact typography tuned for a ~360px-wide bubble
        "prose-headings:mt-2 prose-headings:mb-1 prose-headings:font-semibold",
        "prose-h1:text-sm prose-h2:text-sm prose-h3:text-xs prose-h4:text-xs",
        "prose-p:my-1 prose-p:leading-snug",
        "prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
        "prose-hr:my-2",
        "prose-blockquote:my-1 prose-blockquote:py-0 prose-blockquote:px-2",
        "prose-code:text-[11px] prose-code:before:content-[''] prose-code:after:content-['']",
        "prose-pre:text-[11px] prose-pre:my-1 prose-pre:p-2",
        "prose-table:my-1 prose-table:text-[11px]",
        "prose-th:py-0.5 prose-th:px-1 prose-td:py-0.5 prose-td:px-1",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeRaw,
          rehypeKatex,
          [rehypeHighlight, { ignoreMissing: true, detect: false }],
        ]}
        components={{
          // Inline span carrying our sentinel attribute → ArtifactChip
          span: (props: any) => {
            const id = props?.["data-artifact-chip"];
            if (typeof id === "string" && id) {
              return <ArtifactChip id={id} byId={byId} />;
            }
            return <span {...props} />;
          },
          // Tables in a narrow PIP need horizontal scroll rather than overflowing
          table: ({ children }: any) => (
            <div className="overflow-x-auto -mx-1 my-1">
              <table className="w-full">{children}</table>
            </div>
          ),
          // Links: open in new tab, don't blow up the PIP
          a: ({ children, href, ...rest }: any) => (
            <a href={href} target="_blank" rel="noreferrer" className="underline break-all" {...rest}>
              {children}
            </a>
          ),
          // Any fenced block already gets syntax-highlighted by rehype-highlight.
          // Keep default <code>/<pre> but trim padding — the prose-pre classes
          // above already shrink them.
        } as any}
      >
        {rewritten}
      </ReactMarkdown>
    </div>
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
      {messages.map((m) => (
        <div
          key={m.id}
          className={
            m.role === "user"
              ? "self-end bg-aurora-teal/10 border border-aurora-teal/25 text-foreground rounded-lg px-3 py-1.5 max-w-[92%]"
              : "self-start bg-muted/60 border border-border rounded-lg px-3 py-1.5 max-w-[92%]"
          }
        >
          <MessageMarkdown content={m.content} byId={byId} isUser={m.role === "user"} />
        </div>
      ))}
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
