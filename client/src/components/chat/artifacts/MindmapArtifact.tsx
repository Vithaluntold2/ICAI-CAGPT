import { useRef, useState } from "react";
import MindMapRenderer, {
  type MindMapRendererHandle,
} from "../../visualizations/MindMapRenderer";
import { MindmapFullscreenModal } from "./MindmapFullscreenModal";

/**
 * Inline/preview mindmap. Owns the fullscreen-modal state — the modal
 * mounts a fresh `MindMapRenderer` instance in a portal, so this inline
 * instance is never moved mid-render. See MindmapFullscreenModal for
 * why that matters (mind-elixir's internal refs don't survive a DOM
 * detach/reattach).
 *
 * - `preview` = whiteboard card. Disables interactions, click opens
 *   fullscreen.
 * - `embedded` = parent provides bounded height via `h-full`.
 */
export function MindmapArtifact({
  payload,
  embedded = false,
  preview = false,
}: {
  payload: any;
  embedded?: boolean;
  preview?: boolean;
}) {
  const rendererRef = useRef<MindMapRendererHandle>(null);
  const [fsOpen, setFsOpen] = useState(false);

  // Inner toolbar removed — chat-inline gets its download/copy/fullscreen
  // controls from InlineArtifactCard's outer header; whiteboard preview
  // has the whiteboard card's own menu. The fullscreen modal uses a
  // fresh MindMapRenderer directly, not this wrapper.
  const containerClass = embedded
    ? "bg-card border rounded-lg p-4 relative h-full flex flex-col min-h-0"
    : "bg-card border rounded-lg p-4 relative";

  const bodyClass = embedded ? "flex-1 min-h-0" : "";

  return (
    <>
      <div className={containerClass}>
        <div className={bodyClass}>
          <MindMapRenderer
            ref={rendererRef}
            data={payload}
            embedded={embedded}
            preview={preview}
            onOpenFullscreen={() => setFsOpen(true)}
          />
        </div>
      </div>
      {fsOpen && (
        <MindmapFullscreenModal
          payload={payload}
          onClose={() => setFsOpen(false)}
        />
      )}
    </>
  );
}
