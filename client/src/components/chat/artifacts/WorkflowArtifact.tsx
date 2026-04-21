import { useState } from "react";
import WorkflowRenderer from "../../visualizations/workflow-x6/WorkflowRendererX6";
import { WorkflowFullscreenModal } from "../../visualizations/workflow-x6/WorkflowFullscreenModal";
import { cn } from "@/lib/utils";

/**
 * WorkflowArtifact owns the fullscreen-modal state.
 *
 * When the renderer (inline or preview) calls `onOpenFullscreen`, we
 * mount a fresh, fully-interactive instance inside a dedicated modal.
 * The inline/preview instance is never portaled or moved — it stays
 * alive at its original DOM location, so x6's internal state stays
 * consistent with what's on screen.
 *
 * - `preview` = whiteboard card rendering. Renderer disables pan/mousewheel
 *   and shows a click-overlay that opens fullscreen.
 * - `embedded` = parent (InlineArtifactCard or ArtifactCard) provides
 *   a bounded height via `h-full`.
 */
export function WorkflowArtifact({
  payload,
  embedded = false,
  preview = false,
}: {
  payload: any;
  embedded?: boolean;
  preview?: boolean;
}) {
  const [fsOpen, setFsOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "bg-card border rounded-lg p-4",
          embedded && "h-full flex flex-col min-h-0",
        )}
      >
        <WorkflowRenderer
          nodes={payload.nodes}
          edges={payload.edges}
          title={payload.title}
          layout={payload.layout}
          embedded={embedded}
          preview={preview}
          onOpenFullscreen={() => setFsOpen(true)}
        />
      </div>
      {fsOpen && (
        <WorkflowFullscreenModal
          nodes={payload.nodes}
          edges={payload.edges}
          title={payload.title}
          layout={payload.layout}
          onClose={() => setFsOpen(false)}
        />
      )}
    </>
  );
}
