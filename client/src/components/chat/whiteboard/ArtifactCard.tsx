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
        "absolute bg-card border rounded-md transition-all cursor-pointer flex flex-col",
        selected
          ? "border-aurora-teal ring-[3px] ring-aurora-teal/20 shadow-glow-teal"
          : "border-border hover:border-border-strong",
      )}
      style={{
        left: artifact.canvasX,
        top: artifact.canvasY,
        width: artifact.width,
        // Fixed height (not minHeight). Earlier the card was a soft floor,
        // leaving children ambiguous: "fill parent or grow past me?" — which
        // made workflow's fitView drift against the stored dimensions. With
        // a hard height, every child sees a concrete bounded container.
        // Content that exceeds the height scrolls inside the body slot's
        // overflow-auto; the server's compute*Size heuristics should be tuned
        // so overflow is rare.
        height: artifact.height,
      }}
      data-artifact-id={artifact.id}
      data-testid={`artifact-card-${artifact.id}`}
      onClick={onClick}
    >
      {selected && (
        <span
          className="absolute top-2.5 left-2.5 w-[18px] h-[18px] rounded-full bg-aurora-teal text-white text-[11px] font-bold font-mono flex items-center justify-center shadow-glow-teal z-10"
          aria-hidden="true"
        >
          ✓
        </span>
      )}
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
      <div className="p-2 flex-1 overflow-auto">
        {/* `embedded` tells the child renderers that this card already shows
            the title + kind + menu in its own header — so they should suppress
            their own redundant title chrome to avoid duplication. */}
        <ArtifactRenderer
          artifact={artifact}
          conversationId={conversationId}
          embedded
          preview
        />
      </div>
    </div>
  );
}
