import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useSelectionContext } from "./whiteboard/useSelectionContext";

export interface ComposerSelection {
  artifactIds: string[];
  highlightedText?: string;
}

export function Composer({
  onSend, disabled, placeholder = "Ask anything…",
}: {
  onSend: (text: string, selection: ComposerSelection | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const artifactIds = useSelectionContext(s => s.artifactIds);
  const highlightedText = useSelectionContext(s => s.highlightedText);
  const clear = useSelectionContext(s => s.clear);

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
          className="flex items-center gap-2 text-xs px-2 py-1 bg-blue-50 dark:bg-blue-950/30 rounded border"
          data-testid="composer-selection-bar"
        >
          <span>
            Referring to: {artifactIds.length} artifact{artifactIds.length === 1 ? "" : "s"}
            {highlightedText ? ` · "${highlightedText.slice(0, 40)}${highlightedText.length > 40 ? "…" : ""}"` : ""}
          </span>
          <Button variant="ghost" size="sm" className="ml-auto h-auto px-2 py-0.5" onClick={clear}>
            clear
          </Button>
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
