import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MindMapRenderer from "../../visualizations/MindMapRenderer";

export function MindmapArtifact({ payload, embedded = false }: { payload: any; embedded?: boolean }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Export via html-to-image snapshot of the React Flow viewport so the PNG/SVG
  // matches what the user sees. JSON dumps the raw mindmap structure.
  const handleExport = useCallback(async (format: "png" | "svg" | "json") => {
    const baseName = ((payload?.title as string) || "mindmap").replace(/[^a-z0-9_-]+/gi, "_");

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

    const root = bodyRef.current;
    const viewport = (root?.querySelector(".react-flow__viewport") as HTMLElement | null)
      ?? (root?.querySelector(".react-flow") as HTMLElement | null);
    if (!viewport) {
      console.error("[MindmapArtifact] export target not found");
      return;
    }
    try {
      const htmlToImage = await import("html-to-image");
      const options = {
        pixelRatio: format === "png" ? 2 : 1,
        backgroundColor: "#ffffff",
        cacheBust: true,
        // Avoid html-to-image@1.11.x `font.trim()` crash during @font-face
        // embedding; snapshots use system/browser fonts instead.
        skipFonts: true,
        filter: (node: HTMLElement) =>
          !node.classList?.contains("react-flow__minimap")
          && !node.classList?.contains("react-flow__controls"),
      };
      const dataUrl = format === "png"
        ? await htmlToImage.toPng(viewport, options)
        : await htmlToImage.toSvg(viewport, options);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${baseName}.${format}`;
      a.click();
    } catch (err) {
      console.error(`[MindmapArtifact] ${format} export failed:`, err);
    }
  }, [payload]);

  // While fullscreen: Escape exits, and body scroll is locked so the overlay
  // can't be scrolled behind. Restored on toggle-off.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  // Container style: three layouts here.
  //   - fullscreen:  portal + fixed inset-0 overlay (escapes whiteboard transform).
  //   - embedded:    fills the ArtifactCard exactly, no own border (card has it).
  //   - standalone:  provides its own card chrome (for chat inline rendering).
  // Fullscreen is later portalled to <body> so its `fixed` positioning escapes
  // any transformed ancestor (whiteboard applies CSS transforms, which would
  // otherwise scope `fixed` to the canvas instead of the viewport).
  const containerClass = isFullscreen
    ? "fixed inset-0 z-50 bg-card flex flex-col"
    : embedded
      ? "relative h-full w-full"
      : "bg-card border rounded-lg p-4 relative";

  // MindMapRenderer's own root is `h-[600px]` — override it to `h-full w-full`
  // on the first descendant div so the renderer stretches to its parent in
  // fullscreen and embedded modes.
  const bodyClass = isFullscreen || embedded
    ? "h-full w-full [&>div:first-child]:!h-full [&>div:first-child]:!w-full"
    : "";

  const tree = (
    <div className={containerClass}>
      {/* Action toolbar — grouped so the background contrast makes both
          buttons visible against any card content. */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-md border bg-background shadow-sm">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => setIsFullscreen(v => !v)}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Open fullscreen"}
          data-testid="mindmap-artifact-fullscreen"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
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
      <div ref={bodyRef} className={bodyClass}>
        <MindMapRenderer data={payload} embedded={embedded} />
      </div>
    </div>
  );

  return isFullscreen ? createPortal(tree, document.body) : tree;
}
