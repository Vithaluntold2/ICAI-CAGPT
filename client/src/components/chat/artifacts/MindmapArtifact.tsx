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
import MindMapRenderer, {
  type MindMapRendererHandle,
} from "../../visualizations/MindMapRenderer";

export function MindmapArtifact({ payload, embedded = false }: { payload: any; embedded?: boolean }) {
  const rendererRef = useRef<MindMapRendererHandle>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Export delegates to Mind Elixir's native exporters — no more html-to-image
  // or `.react-flow__viewport` selector hackery. JSON still dumps the raw
  // payload so the structured source is downloadable.
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

    const blob = format === "png"
      ? await rendererRef.current?.exportPng()
      : rendererRef.current?.exportSvg();
    if (!blob) {
      console.error(`[MindmapArtifact] ${format} export returned no blob`);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
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

  // Container style: in-place card vs a full-viewport overlay. Fullscreen is
  // later portalled to <body> so its `fixed` positioning escapes any
  // transformed ancestor (the whiteboard canvas applies CSS transforms, which
  // would otherwise scope `fixed` to the canvas instead of the viewport).
  const containerClass = isFullscreen
    ? "fixed inset-0 z-50 bg-card p-4 flex flex-col"
    : embedded
      ? "bg-card border rounded-lg p-4 relative h-full flex flex-col min-h-0"
      : "bg-card border rounded-lg p-4 relative";

  // When fullscreen, the inner MindMapRenderer needs to fill the whole
  // overlay. MindMapRenderer's own root is `h-[600px]` — we override it to
  // `h-full w-full` on the first descendant div so the renderer stretches
  // to its parent without touching its source.
  const bodyClass = isFullscreen
    ? "flex-1 min-h-0 [&>div:first-child]:!h-full [&>div:first-child]:!w-full"
    : embedded
      ? // Chain `h-full` from the flex-col wrapper down so MindMapRenderer's
        // `h-full` (new — was `h-[600px]`) resolves against a real height.
        "flex-1 min-h-0"
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
      <div className={bodyClass}>
        <MindMapRenderer ref={rendererRef} data={payload} embedded={embedded} />
      </div>
    </div>
  );

  return isFullscreen ? createPortal(tree, document.body) : tree;
}
