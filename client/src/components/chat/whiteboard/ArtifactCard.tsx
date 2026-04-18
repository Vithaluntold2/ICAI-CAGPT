import { cn } from "@/lib/utils";
import type { WhiteboardArtifact } from "../../../../../shared/schema";
import { ArtifactRenderer } from "../artifacts/ArtifactRenderer";

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
        "absolute border rounded-lg bg-card shadow-sm overflow-hidden cursor-pointer",
        selected ? "ring-2 ring-blue-500" : "hover:border-blue-400",
      )}
      style={{ left: artifact.canvasX, top: artifact.canvasY, width: artifact.width, height: artifact.height }}
      data-artifact-id={artifact.id}
      data-testid={`artifact-card-${artifact.id}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b text-xs">
        <span className="font-medium truncate">{artifact.title}</span>
        <span className="text-muted-foreground shrink-0 ml-2">{artifact.kind}</span>
      </div>
      <div className="p-2 overflow-hidden" style={{ height: "calc(100% - 32px)" }}>
        <ArtifactRenderer artifact={artifact} conversationId={conversationId} />
      </div>
    </div>
  );
}
