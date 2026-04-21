import { useCallback, useMemo, useRef } from "react";
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

  // Parent re-renders during the SSE end → metadata plumbing → setQueryData
  // sequence hand ChartArtifact a fresh `payload` object reference even when
  // the data hasn't changed. Recharts shallow-compares its `data` prop and
  // re-runs its mount animation on every new reference, which is what the
  // user sees as "the chart flashing 2-3 times before it settles".
  //
  // Freeze the payload reference by its structural content — as long as the
  // serialised payload is unchanged, VisualizationRenderer sees the same
  // object and Recharts skips the re-animation.
  const stablePayload = useMemo(
    () => payload,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(payload)]
  );

  const handleDownload = useCallback(async () => {
    const target = bodyRef.current;
    if (!target) return;
    try {
      const htmlToImage = await import("html-to-image");
      const dataUrl = await htmlToImage.toPng(target, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        // html-to-image@1.11.x crashes on `font.trim()` during @font-face
        // embedding when the computed font shorthand is undefined; skipping
        // fonts avoids that code path. Snapshot still uses system fonts.
        skipFonts: true,
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
        <VisualizationRenderer chartData={stablePayload} embedded={embedded} />
      </div>
    </div>
  );
}
