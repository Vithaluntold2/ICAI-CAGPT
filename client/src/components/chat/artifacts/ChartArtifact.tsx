import { useCallback, useRef } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import VisualizationRenderer, { type ChartData } from "../../visualizations/VisualizationRenderer";
import { ArtifactToolbar } from "./ArtifactToolbar";

export function ChartArtifact({
  payload,
  embedded = false,
}: {
  payload: ChartData;
  embedded?: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    const target = bodyRef.current;
    if (!target) return;
    try {
      const htmlToImage = await import("html-to-image");
      const dataUrl = await htmlToImage.toPng(target, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        skipFonts: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      const base = ((payload as any)?.title || "chart").replace(/[^a-z0-9_-]+/gi, "_");
      a.download = `${base}.png`;
      a.click();
    } catch (err) {
      console.error("[ChartArtifact] PNG export failed:", err);
    }
  }, [payload]);

  // Embedded mode (inside ArtifactCard on the whiteboard): the card owns the
  // border + header + background, so we render the chart directly with just
  // the floating toolbar. Standalone mode (inline in chat): we provide our
  // own card chrome so the chart doesn't look naked in the conversation.
  const toolbar = (
    <ArtifactToolbar>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={handleDownload}
        title="Download as PNG"
        data-testid="chart-download"
      >
        <Download className="h-3.5 w-3.5" />
      </Button>
    </ArtifactToolbar>
  );

  if (embedded) {
    return (
      <div ref={bodyRef} className="relative h-full w-full overflow-auto">
        {toolbar}
        <VisualizationRenderer chartData={payload} embedded />
      </div>
    );
  }

  // Standalone (chat inline): padding keeps the chart off the border, and
  // VisualizationRenderer's internal responsive containers need a measurable
  // box. p-4 plus the chart's own height gives the wrapper a real size in a
  // zero-height parent (the .my-4 not-prose div in chat markdown).
  return (
    <div ref={bodyRef} className="relative bg-card border rounded-lg p-4">
      {toolbar}
      <VisualizationRenderer chartData={payload} />
    </div>
  );
}
