import { useEffect, useMemo, useRef, useState } from "react";
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { useConversationArtifacts } from "@/hooks/useConversationArtifacts";
import { useMultiSelection } from "./useMultiSelection";
import { useSelectionContext } from "./useSelectionContext";
import { ArtifactCard } from "./ArtifactCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface MarqueeState {
  // Viewport (client) coords — used to render the overlay.
  startClientX: number;
  startClientY: number;
  curClientX: number;
  curClientY: number;
  // Canvas-space starting point (pre-computed so we don't depend on transform
  // state mid-drag, which is stable for the duration of the drag).
  startCanvasX: number;
  startCanvasY: number;
}

function rectsIntersect(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
): boolean {
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

export function Whiteboard({ conversationId }: { conversationId: string }) {
  const { data } = useConversationArtifacts(conversationId);
  const orderedIds = useMemo(() => data?.artifacts.map(a => a.id) ?? [], [data]);
  const { selected, click, clear, setMany } = useMultiSelection(orderedIds);
  const setArtifacts = useSelectionContext(s => s.setArtifacts);
  const artifacts = data?.artifacts ?? [];
  const { toast } = useToast();

  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [panDisabled, setPanDisabled] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Cmd/Ctrl+K — focus composer + push current selection as referred artifacts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isK = e.key === "k" || e.key === "K";
      if (!isK) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (selected.size === 0) return;
      e.preventDefault();
      setArtifacts([...selected]);
      const el = document.querySelector<HTMLTextAreaElement>('[data-testid="composer-input"]');
      el?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, setArtifacts]);

  // Cmd/Ctrl+A — select all artifacts (when focus is NOT inside an input)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isA = e.key === "a" || e.key === "A";
      if (!isA) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || active.isContentEditable) return;
      }
      if (artifacts.length === 0) return;
      e.preventDefault();
      const allIds = artifacts.map(a => a.id);
      setMany(allIds);
      toast({ title: "Selected all", description: `${allIds.length} artifact${allIds.length === 1 ? "" : "s"} selected.` });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [artifacts, setMany, toast]);

  // Marquee handlers: shift+mousedown on empty canvas starts a drag-select.
  const onWrapperMouseDown = (e: React.MouseEvent) => {
    if (!e.shiftKey) return;
    // Ignore if mousedown originated on an artifact card
    const target = e.target as HTMLElement;
    if (target.closest("[data-artifact-id]")) return;
    const ref = transformRef.current;
    if (!ref) return;
    const { scale, positionX, positionY } = ref.state;

    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    if (!wrapperRect) return;
    const viewportX = e.clientX - wrapperRect.left;
    const viewportY = e.clientY - wrapperRect.top;
    const canvasX = (viewportX - positionX) / scale;
    const canvasY = (viewportY - positionY) / scale;

    setPanDisabled(true);
    setMarquee({
      startClientX: e.clientX,
      startClientY: e.clientY,
      curClientX: e.clientX,
      curClientY: e.clientY,
      startCanvasX: canvasX,
      startCanvasY: canvasY,
    });
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    if (!marquee) return;
    const onMove = (ev: MouseEvent) => {
      setMarquee(prev => prev ? { ...prev, curClientX: ev.clientX, curClientY: ev.clientY } : prev);
    };
    const onUp = (ev: MouseEvent) => {
      const ref = transformRef.current;
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      if (!ref || !wrapperRect) {
        setMarquee(null);
        setPanDisabled(false);
        return;
      }
      const { scale, positionX, positionY } = ref.state;
      const endViewportX = ev.clientX - wrapperRect.left;
      const endViewportY = ev.clientY - wrapperRect.top;
      const endCanvasX = (endViewportX - positionX) / scale;
      const endCanvasY = (endViewportY - positionY) / scale;

      const rx1 = Math.min(marquee.startCanvasX, endCanvasX);
      const ry1 = Math.min(marquee.startCanvasY, endCanvasY);
      const rx2 = Math.max(marquee.startCanvasX, endCanvasX);
      const ry2 = Math.max(marquee.startCanvasY, endCanvasY);

      // Only treat as marquee if the drag has non-trivial size; otherwise
      // fall through to click behavior (which shift+click on empty canvas
      // simply won't do — safe no-op).
      if (Math.abs(rx2 - rx1) > 3 && Math.abs(ry2 - ry1) > 3) {
        const hits: string[] = [];
        for (const a of artifacts) {
          const ax1 = a.canvasX;
          const ay1 = a.canvasY;
          const ax2 = a.canvasX + a.width;
          const ay2 = a.canvasY + a.height;
          if (rectsIntersect(ax1, ay1, ax2, ay2, rx1, ry1, rx2, ry2)) {
            hits.push(a.id);
          }
        }
        if (hits.length > 0) setMany(hits);
      }
      setMarquee(null);
      setPanDisabled(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [marquee, artifacts, setMany]);

  // Bulk export selected as xlsx (no rendered images needed; backend supports subset by artifactIds).
  const onExportSelected = async () => {
    if (selected.size === 0 || !conversationId) return;
    setIsExporting(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/whiteboard/export`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "xlsx", artifactIds: [...selected] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `whiteboard-selected-${conversationId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: `${selected.size} artifact${selected.size === 1 ? "" : "s"} exported.` });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (artifacts.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center"
        data-testid="whiteboard-empty"
      >
        <p className="text-sm">Your whiteboard will fill as the assistant produces diagrams, charts, and workflows.</p>
      </div>
    );
  }

  // Compute marquee overlay (in viewport coords, clipped to wrapper)
  const marqueeOverlay = (() => {
    if (!marquee) return null;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x1 = Math.min(marquee.startClientX, marquee.curClientX) - rect.left;
    const y1 = Math.min(marquee.startClientY, marquee.curClientY) - rect.top;
    const w = Math.abs(marquee.curClientX - marquee.startClientX);
    const h = Math.abs(marquee.curClientY - marquee.startClientY);
    return (
      <div
        className="absolute pointer-events-none bg-blue-500/20 border border-blue-500 z-20"
        style={{ left: x1, top: y1, width: w, height: h }}
        data-testid="whiteboard-marquee"
      />
    );
  })();

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full"
      data-testid="whiteboard-root"
      onMouseDown={onWrapperMouseDown}
    >
      <TransformWrapper
        ref={transformRef}
        minScale={0.25}
        maxScale={3}
        initialScale={0.8}
        centerOnInit
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: true }}
        panning={{ disabled: panDisabled }}
      >
        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-[2600px] !min-h-[1200px]">
          <div className="relative w-full h-full" data-testid="whiteboard-canvas-inner">
            {artifacts.map(a => (
              <ArtifactCard
                key={a.id}
                artifact={a}
                selected={selected.has(a.id)}
                conversationId={conversationId}
                onClick={(e) => click(a.id, { metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey })}
              />
            ))}
          </div>
        </TransformComponent>
      </TransformWrapper>
      {marqueeOverlay}
      {selected.size > 0 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card border rounded-full px-4 py-2 shadow flex items-center gap-3 text-sm z-10"
          data-testid="whiteboard-selection-bar"
        >
          <span>{selected.size} artifact{selected.size === 1 ? "" : "s"} selected</span>
          <Button size="sm" onClick={() => setArtifacts([...selected])} data-testid="selection-ask">
            Ask about these
          </Button>
          {selected.size >= 2 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onExportSelected}
              disabled={isExporting}
              data-testid="selection-export"
            >
              {isExporting ? "Exporting…" : "Export selected"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={clear} data-testid="selection-clear">Clear</Button>
        </div>
      )}
    </div>
  );
}
