import { useCallback, useRef, useState } from "react";
import { Download, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  const handleExport = useCallback(
    async (format: "png" | "svg" | "json") => {
      const baseName = ((payload?.title as string) || "mindmap").replace(
        /[^a-z0-9_-]+/gi,
        "_",
      );
      if (format === "json") {
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const blob =
        format === "png"
          ? await rendererRef.current?.exportPng()
          : rendererRef.current?.exportSvg();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [payload],
  );

  const containerClass = embedded
    ? "bg-card border rounded-lg p-4 relative h-full flex flex-col min-h-0"
    : "bg-card border rounded-lg p-4 relative";

  const bodyClass = embedded ? "flex-1 min-h-0" : "";

  return (
    <>
      <div className={containerClass}>
        {/* Toolbar — hidden in preview mode (whiteboard card has its own
            menu in the card header). The fullscreen + download buttons
            only make sense for the interactive chat-inline case. */}
        {!preview && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-md border bg-background shadow-sm">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setFsOpen(true)}
              title="Open fullscreen"
              data-testid="mindmap-artifact-fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  title="Download…"
                  data-testid="mindmap-artifact-download"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("png")}>
                  PNG image
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("svg")}>
                  SVG image
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")}>
                  JSON source
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
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
