import { useEffect, useMemo } from "react";
import { useConversationArtifacts } from "@/hooks/useConversationArtifacts";
import { useMultiSelection } from "./useMultiSelection";
import { useSelectionContext } from "./useSelectionContext";
import { WhiteboardCanvas } from "./WhiteboardCanvas";
import { ArtifactCard } from "./ArtifactCard";
import { Button } from "@/components/ui/button";

export function Whiteboard({ conversationId }: { conversationId: string }) {
  const { data } = useConversationArtifacts(conversationId);
  const orderedIds = useMemo(() => data?.artifacts.map(a => a.id) ?? [], [data]);
  const { selected, click, clear } = useMultiSelection(orderedIds);
  const setArtifacts = useSelectionContext(s => s.setArtifacts);
  const artifacts = data?.artifacts ?? [];

  // Cmd/Ctrl+K — when there is a multi-selection, push it into the
  // composer's selection context and focus the PIP composer textarea.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isK = e.key === "k" || e.key === "K";
      if (!isK) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (selected.size === 0) return;
      e.preventDefault();
      setArtifacts([...selected]);
      const el = document.querySelector<HTMLTextAreaElement>('[data-testid="composer-input"]');
      el?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, setArtifacts]);

  if (artifacts.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center"
        data-testid="whiteboard-empty"
      >
        <p className="text-sm">Your whiteboard will fill as the assistant produces diagrams, charts, and workflows.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" data-testid="whiteboard-root">
      <WhiteboardCanvas>
        {artifacts.map(a => (
          <ArtifactCard
            key={a.id}
            artifact={a}
            selected={selected.has(a.id)}
            conversationId={conversationId}
            onClick={(e) => click(a.id, { metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey })}
          />
        ))}
      </WhiteboardCanvas>
      {selected.size > 0 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card border rounded-full px-4 py-2 shadow flex items-center gap-3 text-sm z-10"
          data-testid="whiteboard-selection-bar"
        >
          <span>{selected.size} artifact{selected.size === 1 ? "" : "s"} selected</span>
          <Button size="sm" onClick={() => setArtifacts([...selected])} data-testid="selection-ask">
            Ask about these
          </Button>
          <Button size="sm" variant="ghost" onClick={clear} data-testid="selection-clear">Clear</Button>
        </div>
      )}
    </div>
  );
}
