import { useRef } from "react";
import { cn } from "@/lib/utils";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WhiteboardArtifact } from "../../../../../shared/schema";
import { ArtifactRenderer } from "../artifacts/ArtifactRenderer";
import { useSelectionContext } from "./useSelectionContext";
import { useReportArtifactVisibility } from "./useVisibleArtifacts";

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
  const setArtifacts = useSelectionContext(s => s.setArtifacts);
  const rootRef = useRef<HTMLDivElement>(null);
  useReportArtifactVisibility(artifact.id, rootRef);

  return (
    <div
      ref={rootRef}
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
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-muted-foreground">{artifact.kind}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-5 w-5 rounded hover:bg-muted flex items-center justify-center"
                aria-label="Card actions"
                data-testid={`artifact-card-menu-${artifact.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setArtifacts([artifact.id]);
                }}
                data-testid={`artifact-card-reference-${artifact.id}`}
              >
                Reference in chat
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  window.alert("Full-size view coming soon");
                }}
                data-testid={`artifact-card-open-${artifact.id}`}
              >
                Open full size
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* No inner padding, no outer scroll — the renderer owns its own
          viewport (via `embedded=true`). Prevents the double-scrollbar effect
          on large spreadsheets and long documents, and removes a padding ring
          that was competing with each renderer's own internal padding. */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <ArtifactRenderer artifact={artifact} conversationId={conversationId} embedded />
      </div>
    </div>
  );
}
