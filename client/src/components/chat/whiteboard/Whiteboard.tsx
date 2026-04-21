import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { useConversationArtifacts } from "@/hooks/useConversationArtifacts";
import { useMultiSelection } from "./useMultiSelection";
import { useSelectionContext } from "./useSelectionContext";
import { useSelectionTooltip } from "./useSelectionTooltip";
import { ArtifactCard } from "./ArtifactCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Minus, Plus, Maximize, RotateCcw, Quote, Info, X } from "lucide-react";
import { Kbd } from "@/components/ui/Kbd";

// Zoom bounds + step — kept here so the overlay UI and the TransformWrapper
// stay in sync. Step is a multiplicative factor per press, not an additive
// delta, so 1.25x zooms in 25%, 0.8x zooms out 20%.
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 1.25;         // one press = 25% in, or 1/1.25 = 20% out
const ZOOM_ANIM_MS = 180;
const INITIAL_SCALE = 0.8;
const FIT_PADDING_PX = 60;       // breathing room around artifacts in fit view
// Canvas sizing: the transform's content area must always fully enclose every
// artifact, otherwise react-zoom-pan-pinch's pan-clamp will refuse to scroll
// past the fixed edge when zoomed in. We use MIN_* as a floor for small boards
// and CANVAS_PAD so there's always breathing room past the last artifact.
const MIN_CANVAS_W = 2600;
const MIN_CANVAS_H = 1200;
const CANVAS_PAD = 600;          // px of pan-room past the farthest artifact

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
  const setHighlight = useSelectionContext(s => s.setHighlight);
  const artifacts = data?.artifacts ?? [];

  // Native text selection within any card → floating "Ask about this" tooltip.
  const { selection: textSelection, clear: clearTextSelection } = useSelectionTooltip();

  const onAskAboutSelection = useCallback(() => {
    if (!textSelection) return;
    setHighlight([textSelection.artifactId], textSelection.text);
    const el = document.querySelector<HTMLTextAreaElement>('[data-testid="composer-input"]');
    el?.focus();
    // Clear the native browser selection so the tooltip disappears and the
    // composer has visual focus; the text is already captured in the store.
    window.getSelection()?.removeAllRanges();
    clearTextSelection();
  }, [textSelection, setHighlight, clearTextSelection]);

  // Dynamic canvas dimensions: always large enough to fully contain every
  // artifact (plus pad), so panning isn't clamped when zoomed into a tall card.
  // NOTE: artifacts can also grow taller than their stored `height` because
  // ArtifactCard uses `minHeight`, not `height` — we'd never capture that from
  // data alone. CANVAS_PAD compensates for the uncertainty; it's intentionally
  // generous so the user can always pan an extra screenful past the bottom.
  const { canvasW, canvasH } = useMemo(() => {
    let maxX = MIN_CANVAS_W - CANVAS_PAD;
    let maxY = MIN_CANVAS_H - CANVAS_PAD;
    for (const a of artifacts) {
      const right = a.canvasX + a.width;
      const bottom = a.canvasY + a.height;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }
    return {
      canvasW: Math.max(MIN_CANVAS_W, Math.round(maxX + CANVAS_PAD)),
      canvasH: Math.max(MIN_CANVAS_H, Math.round(maxY + CANVAS_PAD)),
    };
  }, [artifacts]);
  const { toast } = useToast();

  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [panDisabled, setPanDisabled] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // Mirror of the current transform scale so the overlay can show "75%" etc.
  // Updated via TransformWrapper's onTransformed callback.
  const [scale, setScale] = useState<number>(INITIAL_SCALE);
  const [hintDismissed, setHintDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem("cagpt.whiteboard.hint.v1") === "1";
    } catch {
      return false;
    }
  });
  const dismissHint = () => {
    setHintDismissed(true);
    try {
      localStorage.setItem("cagpt.whiteboard.hint.v1", "1");
    } catch { /* ignore */ }
  };

  // --- Stable zoom controls -----------------------------------------------
  // Multiplicative stepping so zoom is predictable (every press is the same
  // perceived amount regardless of current scale), and animated so it doesn't
  // feel like a snap-jump.

  const clamp = (n: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, n));

  const zoomTo = useCallback((nextScale: number) => {
    const ref = transformRef.current;
    if (!ref) return;
    const target = clamp(nextScale);
    const { positionX, positionY, scale: cur } = ref.state;
    if (Math.abs(target - cur) < 1e-4) return;
    // Keep the viewport centre pinned so zoom doesn't jump away.
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) {
      ref.setTransform(positionX, positionY, target, ZOOM_ANIM_MS, 'easeOut');
      return;
    }
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const canvasX = (cx - positionX) / cur;
    const canvasY = (cy - positionY) / cur;
    const newPx = cx - canvasX * target;
    const newPy = cy - canvasY * target;
    ref.setTransform(newPx, newPy, target, ZOOM_ANIM_MS, 'easeOut');
  }, []);

  const zoomIn = useCallback(() => zoomTo(scale * ZOOM_STEP), [scale, zoomTo]);
  const zoomOut = useCallback(() => zoomTo(scale / ZOOM_STEP), [scale, zoomTo]);

  const resetView = useCallback(() => {
    const ref = transformRef.current;
    if (!ref) return;
    ref.resetTransform(ZOOM_ANIM_MS, 'easeOut');
  }, []);

  const fitToContent = useCallback(() => {
    const ref = transformRef.current;
    const wrapper = wrapperRef.current;
    if (!ref || !wrapper || artifacts.length === 0) return;
    // Bounding box over all artifacts in canvas space
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const a of artifacts) {
      if (a.canvasX < minX) minX = a.canvasX;
      if (a.canvasY < minY) minY = a.canvasY;
      if (a.canvasX + a.width > maxX) maxX = a.canvasX + a.width;
      if (a.canvasY + a.height > maxY) maxY = a.canvasY + a.height;
    }
    const bboxW = (maxX - minX) + FIT_PADDING_PX * 2;
    const bboxH = (maxY - minY) + FIT_PADDING_PX * 2;
    const wrapRect = wrapper.getBoundingClientRect();
    if (bboxW <= 0 || bboxH <= 0 || wrapRect.width <= 0 || wrapRect.height <= 0) return;
    const fitScale = clamp(Math.min(wrapRect.width / bboxW, wrapRect.height / bboxH));
    // Centre the bbox in the viewport
    const tx = (wrapRect.width - (maxX - minX) * fitScale) / 2 - minX * fitScale;
    const ty = (wrapRect.height - (maxY - minY) * fitScale) / 2 - minY * fitScale;
    ref.setTransform(tx, ty, fitScale, 250, 'easeOut');
  }, [artifacts]);

  // Keyboard: + / = zoom in, - zoom out, 0 reset, F fit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable) return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomOut(); }
      else if (e.key === '0') { e.preventDefault(); resetView(); }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); fitToContent(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomIn, zoomOut, resetView, fitToContent]);

  // CAD-style wheel behavior: plain wheel = pan, Ctrl+wheel = zoom.
  // The TransformWrapper's `wheel.activationKeys: ['Control']` makes the library
  // only handle zoom when Ctrl is held; we take over wheel-without-Ctrl and
  // translate it into a pan by calling setTransform directly.
  // Must attach natively with { passive: false } because React's synthetic
  // onWheel is passive by default (preventDefault would silently no-op).
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return; // let the library zoom
      const ref = transformRef.current;
      if (!ref) return;
      e.preventDefault();
      const { positionX, positionY, scale: cur } = ref.state;
      // Line-mode wheels report deltaMode=1; page-mode is 2. Scale deltas to
      // keep pan feel consistent regardless of the device reporting mode.
      const lineHeight = 16;
      const mult = e.deltaMode === 1 ? lineHeight : e.deltaMode === 2 ? 400 : 1;
      const dx = e.deltaX * mult;
      const dy = e.deltaY * mult;
      ref.setTransform(positionX - dx, positionY - dy, cur, 0);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Cmd/Ctrl+Enter — focus composer + push current selection as referred
  // artifacts. Previously this was Cmd/Ctrl+K, but that already opens the
  // global command menu (search chats, switch modes, new chat). Enter is a
  // natural "submit/ask" affordance and has no other global binding.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (selected.size === 0) return;
      // Don't steal the keystroke if the user is typing somewhere —
      // Cmd+Enter inside an input should behave the way that input wants.
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || active.isContentEditable) return;
      }
      e.preventDefault();
      setArtifacts([...selected]);
      // Fire at the PIP composer rather than the main-page composer (which
      // isn't mounted in output view). ChatPIP listens for this event and
      // will expand itself if collapsed before focusing its textarea.
      window.dispatchEvent(new CustomEvent('cagpt:focus-pip-composer'));
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
      link.download = `output-selected-${conversationId}.xlsx`;
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
        <p className="text-sm">Your output will fill as the assistant produces diagrams, charts, and workflows.</p>
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
      className="relative w-full h-full overflow-auto bg-background [background-image:radial-gradient(circle,_hsl(var(--foreground)/0.04)_1px,_transparent_1px)] [background-size:24px_24px]"
      data-testid="whiteboard-root"
      onMouseDown={onWrapperMouseDown}
    >
      {!hintDismissed && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-2 bg-card/92 backdrop-blur-[14px] border border-border-strong rounded-full text-[11px] text-muted-foreground inline-flex items-center gap-2 shadow-popover"
          data-testid="whiteboard-hint"
        >
          <Info className="w-3.5 h-3.5 text-aurora-teal-soft" strokeWidth={1.75} />
          <span>
            Click artifacts to select · Shift-click for multiple ·{" "}
            <Kbd keys={["mod", "return"]} /> to ask about selection
          </span>
          <button
            type="button"
            onClick={dismissHint}
            className="ml-1 opacity-50 hover:opacity-100"
            aria-label="Dismiss hint"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <TransformWrapper
        ref={transformRef}
        minScale={MIN_SCALE}
        maxScale={MAX_SCALE}
        initialScale={INITIAL_SCALE}
        centerOnInit
        // Disable pan-clamping so tall cards can always be fully reviewed;
        // the canvas size itself already guarantees you can reach every
        // artifact, and unbounded lets the user overshoot slightly without
        // feeling "stuck".
        limitToBounds={false}
        centerZoomedOut={false}
        wheel={{ step: 0.08, activationKeys: ['Control', 'Meta'] }}
        doubleClick={{ disabled: true }}
        panning={{ disabled: panDisabled }}
        onTransform={(_ref, state) => {
          // Keep overlay % in sync with current zoom level
          if (Math.abs(state.scale - scale) > 1e-3) setScale(state.scale);
        }}
      >
        <TransformComponent
          wrapperClass="!w-full !h-full"
          contentStyle={{ width: canvasW, minHeight: canvasH }}
        >
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

      {/* Floating "Ask about this" button when the user selects text inside
          any artifact card. Position-fixed to the document so it tracks the
          selection regardless of canvas pan/zoom. */}
      {textSelection && (
        <button
          type="button"
          onClick={onAskAboutSelection}
          onMouseDown={(e) => e.preventDefault()} // don't clear the selection
          className="fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+6px)] bg-primary text-primary-foreground text-xs font-medium rounded-full shadow-lg px-3 py-1.5 flex items-center gap-1.5 hover:brightness-110 whitespace-nowrap"
          style={{ top: textSelection.rect.top, left: textSelection.rect.left }}
          data-testid="selection-ask-about-this"
        >
          <Quote className="h-3 w-3" />
          Ask about this
        </button>
      )}

      {/* Zoom / view controls — fixed overlay, outside the transformed area so
          it never moves or scales with the canvas. */}
      <div
        className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-card/95 border border-border rounded-full shadow-lg px-2 py-1 backdrop-blur"
        data-testid="whiteboard-zoom-controls"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={zoomOut}
          disabled={scale <= MIN_SCALE + 1e-3}
          title="Zoom out (−)"
          data-testid="zoom-out"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <button
          type="button"
          onClick={resetView}
          className="min-w-[3.5rem] text-center text-xs font-medium tabular-nums px-2 py-1 rounded hover:bg-muted"
          title="Click to reset to 100% (0)"
          data-testid="zoom-percent"
        >
          {Math.round(scale * 100)}%
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={zoomIn}
          disabled={scale >= MAX_SCALE - 1e-3}
          title="Zoom in (+)"
          data-testid="zoom-in"
        >
          <Plus className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={fitToContent}
          disabled={artifacts.length === 0}
          title="Fit to content (F)"
          data-testid="zoom-fit"
        >
          <Maximize className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={resetView}
          title="Reset view (0)"
          data-testid="zoom-reset"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

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
