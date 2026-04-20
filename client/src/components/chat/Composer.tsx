import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, X } from "lucide-react";
import { useSelectionContext } from "./whiteboard/useSelectionContext";
import { useConversationArtifacts } from "@/hooks/useConversationArtifacts";
import { useReferenceResolver } from "./whiteboard/useReferenceResolver";
import type { WhiteboardArtifact } from "../../../../shared/schema";
import { cn } from "@/lib/utils";

export interface ComposerSelection {
  artifactIds: string[];
  highlightedText?: string;
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

function SelectionChip({
  id, artifact, onRemove, autoReason,
}: {
  id: string;
  artifact: WhiteboardArtifact | undefined;
  onRemove: () => void;
  /** When present, this chip is an auto-inferred reference, not an explicit selection. */
  autoReason?: "viewport" | "recent" | "topic";
}) {
  const title = artifact ? artifact.title : id;
  const kind = artifact?.kind;
  const isAuto = !!autoReason;
  const autoLabel =
    autoReason === "viewport" ? "in view"
    : autoReason === "topic" ? "matches your question"
    : autoReason === "recent" ? "most recent"
    : undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
        isAuto
          ? "bg-muted text-foreground/80 border border-dashed border-muted-foreground/40"
          : "bg-primary/10 text-primary",
      )}
      data-testid={`composer-chip-${id}`}
      data-auto={isAuto || undefined}
      title={isAuto ? `Auto-inferred (${autoLabel}). Click × to remove or pick a different artifact.` : undefined}
    >
      {isAuto && <Sparkles className="h-3 w-3 opacity-70" aria-hidden />}
      <span aria-hidden>{iconFor(kind)}</span>
      <span className="truncate max-w-[140px]">{truncate(title, 20)}</span>
      {isAuto && <span className="text-muted-foreground text-[10px] ml-0.5">auto</span>}
      <button
        type="button"
        aria-label={`Remove ${title}`}
        className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5"
        onClick={onRemove}
        data-testid={`composer-chip-remove-${id}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function Composer({
  onSend, disabled, placeholder = "Ask anything…", conversationId,
}: {
  onSend: (text: string, selection: ComposerSelection | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  conversationId?: string;
}) {
  const [text, setText] = useState("");
  const [dismissedAutoId, setDismissedAutoId] = useState<string | null>(null);
  const artifactIds = useSelectionContext(s => s.artifactIds);
  const highlightedText = useSelectionContext(s => s.highlightedText);
  const setArtifacts = useSelectionContext(s => s.setArtifacts);
  const clear = useSelectionContext(s => s.clear);
  const { data } = useConversationArtifacts(conversationId);
  const byId = data?.byId ?? {};

  // Auto-inferred reference: only active when the user has NO explicit
  // selection and the typed text contains a pronoun/reference word.
  const autoRef = useReferenceResolver(conversationId, text);
  const showAuto = useMemo(() => {
    if (artifactIds.length > 0) return null; // explicit selection wins
    if (!autoRef) return null;
    if (autoRef.artifactId === dismissedAutoId) return null;
    return autoRef;
  }, [artifactIds, autoRef, dismissedAutoId]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    let selection: ComposerSelection | undefined;
    if (artifactIds.length > 0) {
      selection = { artifactIds, highlightedText };
    } else if (showAuto) {
      // Promote the auto-inferred reference into an explicit selection on send.
      // The server-side selection preamble and clarifier bypass are already
      // wired to treat selection.artifactIds identically regardless of source.
      selection = { artifactIds: [showAuto.artifactId] };
    }
    onSend(t, selection);
    setText("");
    setDismissedAutoId(null);
    if (artifactIds.length > 0) clear();
  };

  const hasVisibleReference = artifactIds.length > 0 || !!showAuto;

  return (
    <div className="flex flex-col gap-2" data-testid="composer">
      {hasVisibleReference && (
        <div
          className="flex flex-col gap-1 text-xs px-2 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded border"
          data-testid="composer-selection-bar"
        >
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-muted-foreground mr-1">
              {artifactIds.length > 0 ? "Referring to:" : "Probably about:"}
            </span>
            {artifactIds.length > 0
              ? artifactIds.map((id) => (
                  <SelectionChip
                    key={id}
                    id={id}
                    artifact={byId[id]}
                    onRemove={() => setArtifacts(artifactIds.filter(x => x !== id))}
                  />
                ))
              : showAuto ? (
                  <SelectionChip
                    key={`auto-${showAuto.artifactId}`}
                    id={showAuto.artifactId}
                    artifact={byId[showAuto.artifactId]}
                    onRemove={() => setDismissedAutoId(showAuto.artifactId)}
                    autoReason={showAuto.reason}
                  />
                ) : null}
            {artifactIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-auto px-2 py-0.5 text-[11px]"
                onClick={clear}
                data-testid="composer-clear"
              >
                clear
              </Button>
            )}
          </div>
          {highlightedText && (
            <div className="italic text-[11px] text-muted-foreground truncate">
              quoted: "{highlightedText.slice(0, 60)}{highlightedText.length > 60 ? "…" : ""}"
            </div>
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="flex-1 resize-none"
          rows={2}
          data-testid="composer-input"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button onClick={submit} disabled={disabled || !text.trim()} size="icon" data-testid="composer-send">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
