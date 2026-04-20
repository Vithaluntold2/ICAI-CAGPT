import { useCallback, useRef } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import VisualizationRenderer, { type ChartData } from "../../visualizations/VisualizationRenderer";

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
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      const base = (payload?.title || "chart").replace(/[^a-z0-9_-]+/gi, "_");
      a.download = `${base}.png`;
      a.click();
    } catch (err) {
      console.error("[ChartArtifact] PNG export failed:", err);
    }
  }, [payload?.title]);

  return (
    <div className="bg-card border rounded-lg p-4 relative">
      <div className="absolute top-2 right-2 z-10">
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0 bg-background/90 backdrop-blur shadow-sm"
          onClick={handleDownload}
          title="Download as PNG"
          data-testid="chart-download"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div ref={bodyRef}>
        <VisualizationRenderer chartData={payload} embedded={embedded} />
      </div>
    </div>
  );
}
