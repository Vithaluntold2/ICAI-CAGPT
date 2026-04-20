import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X } from "lucide-react";
import { useSelectionContext } from "./whiteboard/useSelectionContext";
import { useConversationArtifacts } from "@/hooks/useConversationArtifacts";
import type { WhiteboardArtifact } from "../../../../shared/schema";

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
  id, artifact, onRemove,
}: {
  id: string;
  artifact: WhiteboardArtifact | undefined;
  onRemove: () => void;
}) {
  const title = artifact ? artifact.title : id;
  const kind = artifact?.kind;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px]"
      data-testid={`composer-chip-${id}`}
    >
      <span aria-hidden>{iconFor(kind)}</span>
      <span className="truncate max-w-[140px]">{truncate(title, 20)}</span>
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
  const artifactIds = useSelectionContext(s => s.artifactIds);
  const highlightedText = useSelectionContext(s => s.highlightedText);
  const setArtifacts = useSelectionContext(s => s.setArtifacts);
  const clear = useSelectionContext(s => s.clear);
  const { data } = useConversationArtifacts(conversationId);
  const byId = data?.byId ?? {};

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    const selection: ComposerSelection | undefined =
      artifactIds.length > 0 ? { artifactIds, highlightedText } : undefined;
    onSend(t, selection);
    setText("");
    if (selection) clear();
  };

  return (
    <div className="flex flex-col gap-2" data-testid="composer">
      {artifactIds.length > 0 && (
        <div
          className="flex flex-col gap-1 text-xs px-2 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded border"
          data-testid="composer-selection-bar"
        >
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-muted-foreground mr-1">Referring to:</span>
            {artifactIds.map((id) => (
              <SelectionChip
                key={id}
                id={id}
                artifact={byId[id]}
                onRemove={() => setArtifacts(artifactIds.filter(x => x !== id))}
              />
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-auto px-2 py-0.5 text-[11px]"
              onClick={clear}
              data-testid="composer-clear"
            >
              clear
            </Button>
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
