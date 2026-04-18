import { cn } from "@/lib/utils";
import type { WhiteboardArtifact } from "../../../../../shared/schema";
import { ArtifactRenderer } from "../artifacts/ArtifactRenderer";

/**
 * Whiteboard artifact card.
 *
 * Fixed width from the DB (so auto-layout stays stable), but height is
 * min-height only — the card grows to fit its content instead of cropping
 * long flowcharts / tall charts. Internal scrolling remains as a fallback
 * for pathologically large content.
 */
export function ArtifactCard({
  artifact, selected, onClick, conversationId,
}: {
  artifact: WhiteboardArtifact;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  conversationId?: string;
}) {
  return (
    <div
      className={cn(
        "absolute border rounded-lg bg-card shadow-sm cursor-pointer flex flex-col",
        selected ? "ring-2 ring-blue-500" : "hover:border-blue-400",
      )}
      style={{
        left: artifact.canvasX,
        top: artifact.canvasY,
        width: artifact.width,
        minHeight: artifact.height,
        // No `height` — height is content-driven via min-height so diagrams
        // larger than the natural size render in full.
      }}
      data-artifact-id={artifact.id}
      data-testid={`artifact-card-${artifact.id}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b text-xs shrink-0">
        <span className="font-medium truncate">{artifact.title}</span>
        <span className="text-muted-foreground shrink-0 ml-2">{artifact.kind}</span>
      </div>
      <div className="p-2 flex-1 overflow-auto">
        <ArtifactRenderer artifact={artifact} conversationId={conversationId} />
      </div>
    </div>
  );
}
