import { useCallback, useEffect, useRef, useState } from 'react';
// createPortal removed — fullscreen now lives in a separate modal with
// its own graph instance (see WorkflowFullscreenModal).
import { Graph } from '@antv/x6';
// Plugins removed: @antv/x6-plugin-minimap and -export apply class
// decorators that read static helpers (e.g. `View.dispose`) at module-load
// time. Against x6@2.19.x those helpers have moved, so the plugins blow up
// at import with "View.dispose is not a function" — blank page before any
// React mounts. We'll roll our own export via graph.toPNG/toSVG (x6 core)
// and skip the minimap (nice-to-have, not critical for a single-pane view).
import dagre from 'dagre';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitBranch,
  Expand,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registerWorkflowShapes } from './register-nodes';
import type { WorkflowNodeData } from './nodes/types';

// Register shapes once at module scope — register() is idempotent via our
// internal guard, so re-imports from HMR don't cause warnings.
registerWorkflowShapes();

interface WorkflowNode {
  id: string;
  type: 'step' | 'decision' | 'start' | 'end';
  label: string;
  description?: string;
  substeps?: string[];
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface WorkflowRendererProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  title?: string;
  layout?: string;
  embedded?: boolean;
  /** Preview mode: x6 is rendered as a non-interactive thumbnail — no pan,
   *  no mousewheel zoom, no toolbar. Clicking anywhere fires
   *  `onOpenFullscreen`. This mode is used when the renderer is embedded
   *  inside another pan/zoom surface (the whiteboard canvas), where
   *  stacking two interactive zoom libraries creates a scroll trap. */
  preview?: boolean;
  /** Called when the fullscreen button is clicked (non-preview) OR the
   *  preview surface is clicked. The parent is expected to mount a
   *  fresh, fully-interactive instance of this renderer in a dedicated
   *  modal. We do NOT portal our own DOM — x6 stores internal refs tied
   *  to parent layout and detaching mid-instance leaves the graph in a
   *  blank, half-initialised state. */
  onOpenFullscreen?: () => void;
}

const SHAPE_BY_TYPE: Record<WorkflowNode['type'], string> = {
  start: 'wf-start',
  end: 'wf-end',
  step: 'wf-step',
  decision: 'wf-decision',
};

const NODE_SIZE: Record<WorkflowNode['type'], { width: number; height: number }> = {
  start: { width: 180, height: 48 },
  end: { width: 180, height: 48 },
  step: { width: 220, height: 120 },
  decision: { width: 180, height: 180 },
};

function computeClipped(node: WorkflowNode, compact: boolean): boolean {
  const labelLong = (node.label?.length ?? 0) > (compact ? 40 : 90);
  const descLong = (node.description?.length ?? 0) > 80;
  const hiddenSubsteps = (node.substeps?.length ?? 0) > 3;
  const longSubstep = (node.substeps ?? []).some((s) => (s?.length ?? 0) > 60);
  return labelLong || descLong || hiddenSubsteps || longSubstep;
}

function buildTooltip(node: WorkflowNode): string {
  return [
    node.label,
    node.description ? `\n\n${node.description}` : '',
    node.substeps && node.substeps.length > 0
      ? `\n\nSteps:\n${node.substeps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
      : '',
  ].join('');
}

export default function WorkflowRendererX6({
  nodes: nodesInput,
  edges: edgesInput,
  title,
  embedded = false,
  preview = false,
  onOpenFullscreen,
}: WorkflowRendererProps) {
  const nodes = Array.isArray(nodesInput) ? nodesInput : [];
  const edges = Array.isArray(edgesInput) ? edgesInput : [];

  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);

  // The content's bounding box derived from the DAGRE layout we already
  // computed in-memory. Dagre gives us exact pixel coords for each node
  // keyed by id; we fold in NODE_SIZE per type to get the real box. This
  // is populated at the end of the layout effect and read by fitContent()
  // so we never have to ask X6 / Safari what the content bounds are.
  // That matters because Safari's SVG getBBox() returns stale values for
  // foreignObject-based nodes until the embedded HTML has actually
  // painted — X6's zoomToFit then fits against a tiny partial box and
  // leaves the viewport stuck at the top-left with most nodes offscreen.
  const contentBoundsRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);

  const PAD = 24;
  const MAX_SCALE = 1.6;

  // Safari-specific paint bug workaround (complementary to fitContent's
  // measurement bypass below). When x6 wraps each node in
  // `<g transform="translate(x,y)"><foreignObject>…</foreignObject></g>`,
  // WebKit paints the foreignObject HTML at the SVG origin (0,0) instead
  // of the translated position. Edges (native SVG paths) route correctly;
  // nodes stack at top-left. Flushing the SVG's display property forces
  // WebKit to invalidate the ancestor-transform inheritance path it had
  // cached with stale (0,0) positions. No-op on Chrome/Firefox.
  const forceSafariReflow = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector('svg') as SVGElement | null;
    if (!svg) return;
    const prev = svg.style.display;
    svg.style.display = 'none';
    // Read offsetHeight to flush pending layout.
    void (svg as unknown as HTMLElement).offsetHeight;
    svg.style.display = prev;
  }, []);

  /**
   * Fit the graph to contain the pre-computed content bounds inside the
   * container's visible area. No SVG measurement needed — bounds come
   * from dagre output, container size comes from clientWidth/Height. Works
   * identically in Chrome / Firefox / Safari.
   *
   * Chains `forceSafariReflow` after each fit so that Safari's cached
   * foreignObject transforms get invalidated and the nodes actually paint
   * at their correct translated positions (otherwise nodes visually stack
   * at the origin even when the zoom math is correct).
   */
  const fitContent = useCallback(() => {
    const container = containerRef.current;
    const graph = graphRef.current;
    const bounds = contentBoundsRef.current;
    if (!container || !graph || !bounds) return;

    const vw = container.clientWidth;
    const vh = container.clientHeight;
    if (vw < 40 || vh < 40) return; // container not laid out yet

    const contentW = bounds.maxX - bounds.minX;
    const contentH = bounds.maxY - bounds.minY;
    if (contentW <= 0 || contentH <= 0) return;

    const scale = Math.min(
      MAX_SCALE,
      (vw - 2 * PAD) / contentW,
      (vh - 2 * PAD) / contentH,
    );

    try {
      // X6's zoomTo takes an absolute scale by default. Centre the content
      // box in the viewport after scaling.
      graph.zoomTo(scale);
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      graph.centerPoint(cx, cy);
      forceSafariReflow();
    } catch {
      /* graph disposed mid-fit */
    }
  }, [forceSafariReflow]);

  /**
   * Schedule fitContent with retries until the container is a reasonable
   * size. Safari sometimes settles parent flex layout a frame or two
   * after the effect runs; the retry loop absorbs that without depending
   * on broken SVG measurement.
   */
  const fitWhenReady = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let attempt = 0;
    const run = () => {
      if (cancelled) return;
      if (!containerRef.current || !graphRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth < 120 || clientHeight < 120) {
        if (attempt++ < 20) requestAnimationFrame(run);
        return;
      }
      fitContent();
    };
    run();
    // Settle passes — Safari occasionally lands a theme / font reflow a
    // few frames after mount, and foreignObject paint positions may shift
    // after embedded HTML completes layout. Re-fit so the final state is
    // always correct. fitContent itself calls forceSafariReflow.
    const t1 = window.setTimeout(() => !cancelled && fitContent(), 120);
    const t2 = window.setTimeout(() => !cancelled && fitContent(), 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [fitContent]);

  const [detailNode, setDetailNode] = useState<WorkflowNode | null>(null);
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark'),
  );
  const { toast } = useToast();

  const isLargeWorkflow = nodes.length > 20;
  const compactMode = isLargeWorkflow;

  // Follow dark-mode toggles — used to re-draw the grid with a mode-appropriate
  // dot colour. x6 lets us call drawGrid() at any time without destroying cells.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => setIsDark(document.documentElement.classList.contains('dark'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => obs.disconnect();
  }, []);

  // Initialize the graph once. All mutations flow through graphRef.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const graph = new Graph({
      container,
      background: { color: 'transparent' },
      grid: {
        size: 20,
        visible: true,
        type: 'dot',
        args: {
          color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)',
          thickness: 1,
        },
      },
      // Preview: the renderer sits inside another pan/zoom surface
      // (whiteboard canvas), so disable x6's own input capture to avoid the
      // scroll-zoom trap. Click is handled by the overlay below, not by x6.
      panning: !preview,
      mousewheel: preview ? false : { enabled: true, modifiers: [] },
      interacting: preview ? false : { nodeMovable: true, edgeMovable: false },
      connecting: { allowBlank: false, allowMulti: false, allowLoop: false },
      autoResize: true,
    });

    // Plugins (MiniMap, Export) removed — see import-block comment at top.

    // Node click in interactive mode opens the detail dialog. In preview
    // mode the clickable-overlay above the canvas swallows clicks and
    // calls onOpenFullscreen instead.
    if (!preview) {
      graph.on('node:click', ({ node }) => {
        const id = node.id;
        const original = nodes.find((n) => n.id === id);
        if (original) setDetailNode(original);
      });
    }

    graphRef.current = graph;

    // ResizeObserver — x6 has autoResize but the resize only fires on window
    // resize. Our embedded case (whiteboard) resizes the container without
    // a window event, so we drive it manually. Critically, we also RE-FIT
    // after the resize: otherwise the graph canvas grows to match the new
    // container but the content stays pinned at its old position, leaving
    // the rest of the card empty. Debounced to the next frame so we don't
    // thrash on transient width/height changes during animation.
    let rafId = 0;
    const ro = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth > 0 && clientHeight > 0) {
        graph.resize(clientWidth, clientHeight);
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          fitWhenReady();
        });
      }
    });
    ro.observe(container);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      graph.dispose();
      graphRef.current = null;
    };
    // Intentionally mount-once — subsequent node/edge changes flow through the
    // second effect. `nodes` appears in the click handler closure but is
    // re-bound below via an on() rebind in the data effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebind the click handler whenever the `nodes` array changes so the dialog
  // always resolves against the current payload.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.off('node:click');
    graph.on('node:click', ({ node }) => {
      const original = nodes.find((n) => n.id === node.id);
      if (original) setDetailNode(original);
    });
  }, [nodes]);

  // Re-draw the grid when dark mode changes.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.drawGrid({
      type: 'dot',
      args: {
        color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)',
        thickness: 1,
      },
    });
  }, [isDark]);

  // Build / rebuild the graph contents whenever the payload changes.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || nodes.length === 0) {
      if (graph) graph.clearCells();
      return;
    }

    // Dagre layout — plain dagre (already installed), rankdir TB.
    const dag = new dagre.graphlib.Graph();
    dag.setDefaultEdgeLabel(() => ({}));
    dag.setGraph({
      rankdir: 'TB',
      ranksep: 90,
      nodesep: 80,
      marginx: 40,
      marginy: 40,
    });

    nodes.forEach((n) => {
      const size = NODE_SIZE[n.type] ?? NODE_SIZE.step;
      dag.setNode(n.id, { width: size.width, height: size.height });
    });
    edges.forEach((e) => dag.setEdge(e.source, e.target));
    dagre.layout(dag);

    // Compute content bounds from dagre output so Safari-safe fitContent()
    // doesn't need SVG measurement later.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((n) => {
      const pos = dag.node(n.id);
      if (!pos) return;
      const size = NODE_SIZE[n.type] ?? NODE_SIZE.step;
      const hx = size.width / 2;
      const hy = size.height / 2;
      if (pos.x - hx < minX) minX = pos.x - hx;
      if (pos.y - hy < minY) minY = pos.y - hy;
      if (pos.x + hx > maxX) maxX = pos.x + hx;
      if (pos.y + hy > maxY) maxY = pos.y + hy;
    });
    if (isFinite(minX)) {
      contentBoundsRef.current = { minX, minY, maxX, maxY };
    }

    graph.clearCells();

    // Add nodes.
    nodes.forEach((n) => {
      const pos = dag.node(n.id);
      if (!pos) return;
      const size = NODE_SIZE[n.type] ?? NODE_SIZE.step;
      const data: WorkflowNodeData = {
        label: n.label,
        description: n.description,
        substeps: n.substeps,
        contentClipped: computeClipped(n, compactMode),
        tooltip: buildTooltip(n),
        compact: compactMode,
      };
      graph.addNode({
        id: n.id,
        shape: SHAPE_BY_TYPE[n.type] ?? 'wf-step',
        x: Math.round(pos.x - size.width / 2),
        y: Math.round(pos.y - size.height / 2),
        width: size.width,
        height: size.height,
        data,
      });
    });

    // Add edges — hairline teal, manhattan router for crisp 90° paths.
    edges.forEach((e) => {
      graph.addEdge({
        id: e.id,
        source: e.source,
        target: e.target,
        labels: e.label
          ? [
              {
                attrs: {
                  label: {
                    text: e.label,
                    fill: '#5eead4',
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 600,
                  },
                  body: { fill: 'transparent', stroke: 'transparent' },
                },
              },
            ]
          : undefined,
        attrs: {
          line: {
            stroke: 'rgba(20,184,166,0.6)',
            strokeWidth: 1.5,
            targetMarker: {
              name: 'classic',
              size: 7,
            },
          },
        },
        router: { name: 'manhattan' },
        connector: { name: 'rounded' },
      });
    });

    // Fit view after layout settles. Uses a Safari-safe retry: if the
    // container isn't sized yet (e.g. parent flex layout still resolving),
    // defer the fit on rAF instead of fitting against 0×0 bounds.
    requestAnimationFrame(() => {
      fitWhenReady();
    });
  }, [nodes, edges, compactMode, fitWhenReady]);

  // Fullscreen is now handled by the parent (a dedicated
  // WorkflowFullscreenModal that mounts a *fresh* graph instance in a
  // portal). This component never portals its own DOM, so x6's internal
  // refs stay bound to the container it was constructed with. The old
  // portal approach broke both fullscreen (blank — x6 disoriented after
  // DOM move) and exit (inline view broken — x6 canvas tied to the
  // portaled container).

  // Toolbar actions
  const zoomIn = () => graphRef.current?.zoom(0.15);
  const zoomOut = () => graphRef.current?.zoom(-0.15);
  // Use our dagre-based fit (Safari-safe) rather than X6's zoomToFit which
  // depends on SVG getBBox measurements that Safari returns incorrectly
  // for foreignObject-hosted HTML nodes.
  const fitView = () => fitContent();

  const exportAs = useCallback(
    async (format: 'png' | 'svg') => {
      const el = containerRef.current;
      if (!el) return;

      // Fit before capture so the saved image shows the full graph and
      // isn't clipped by whatever zoom/pan the user left it at. Uses our
      // dagre-derived fit (Safari-safe — see fitContent() docstring).
      try {
        fitContent();
      } catch {
        /* fit can throw on dispose race — ignore */
      }
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      const rect = el.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      // Honour the actual theme background so exports never come out with
      // a transparent void that reads as black on dark viewers.
      const bg =
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains('dark')
          ? '#0b1220'
          : '#ffffff';

      try {
        const htmlToImage = await import('html-to-image');
        // toBlob is more reliable than toPng's giant data-URI (some
        // browsers silently drop >2MB hrefs on <a download>).
        const blob =
          format === 'png'
            ? await htmlToImage.toBlob(el, {
                pixelRatio: 2,
                cacheBust: true,
                skipFonts: true,
                width,
                height,
                backgroundColor: bg,
              })
            : await (async () => {
                const svg = await htmlToImage.toSvg(el, {
                  cacheBust: true,
                  skipFonts: true,
                  width,
                  height,
                  backgroundColor: bg,
                });
                // toSvg returns a data URL; convert to a blob for the
                // same anchor-download codepath as PNG.
                const resp = await fetch(svg);
                return await resp.blob();
              })();

        if (!blob) throw new Error('Capture produced no image data.');

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workflow-${Date.now()}.${format}`;
        // Some Chromium builds require the anchor to be in the DOM for
        // programmatic click() to kick off the download.
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Release the blob after the browser has latched onto the URL.
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast({ title: `Exported ${format.toUpperCase()}`, description: 'Downloaded.' });
      } catch (err: any) {
        console.error('[WorkflowRendererX6] export failed', err);
        toast({
          title: 'Export failed',
          description: err?.message ?? String(err),
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  // Canvas background — defers to the app surface so the workflow blends with
  // whatever card the artifact is in. Light mode uses --muted so white cards
  // pop against the surface; dark mode uses --background.
  const canvasBg = isDark ? 'hsl(var(--background))' : 'hsl(var(--muted))';

  if (nodes.length === 0) {
    return (
      <div
        className="w-full border rounded-xl p-8 flex flex-col items-center justify-center text-center bg-muted/20"
        style={{ minHeight: 240 }}
      >
        <GitBranch className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No workflow to display</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md">
          The workflow generation produced no steps. This can happen if the
          agent pipeline failed or the response was empty — try re-sending the
          request.
        </p>
      </div>
    );
  }

  const containerClass = embedded
    ? 'w-full h-full flex flex-col overflow-hidden relative'
    : 'w-full border rounded-xl overflow-hidden shadow-2xl flex flex-col relative';

  const containerStyle: React.CSSProperties = embedded
    ? // `h-full` chains through from the class; minHeight: 420 is a floor
      // for parents that don't set a concrete height (InlineArtifactCard in
      // chat is p-4 with no height — child h-full there would collapse to
      // 0). Whiteboard's ArtifactCard sets a concrete height and it
      // always exceeds 420, so the floor is inert there.
      { background: canvasBg, minHeight: 420 }
    : { background: canvasBg, height: Math.max(480, Math.min(1800, nodes.length * 110 + 80)) };

  const tree = (
    <div className={containerClass} style={containerStyle}>
      {/* Header / toolbar. Hidden when:
          - preview (whiteboard card — parent has its own header)
          - chat-inline (embedded AND parent supplies onOpenFullscreen —
            the user goes to Output / fullscreen for interactive controls).
          Shown in the fullscreen modal (embedded, no onOpenFullscreen)
          and in the rare standalone case. */}
      {!preview && !(embedded && onOpenFullscreen) && (
      <div className="shrink-0 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between gap-4">
        {embedded ? (
          <div aria-hidden />
        ) : title ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">{title}</h3>
              <p className="text-xs text-muted-foreground">
                {nodes.length} steps • {edges.length} connections
                {isLargeWorkflow ? ' • Large workflow' : ''}
              </p>
            </div>
          </div>
        ) : (
          <div aria-hidden />
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            className="h-8 w-8 p-0 rounded-md hover:bg-foreground/5 text-muted-foreground"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            className="h-8 w-8 p-0 rounded-md hover:bg-foreground/5 text-muted-foreground"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fitView}
            className="h-8 w-8 p-0 rounded-md hover:bg-foreground/5 text-muted-foreground"
            title="Fit to view"
          >
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>

          <div className="h-5 w-px bg-border mx-1" aria-hidden />

          {/* Download */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-md hover:bg-foreground/5 text-muted-foreground"
                title="Download"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportAs('png')}>
                Export as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAs('svg')}>
                Export as SVG
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Fullscreen — delegates to parent so a fresh instance mounts
              in a portal. Hidden when the parent doesn't wire it. */}
          {onOpenFullscreen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenFullscreen}
              className="h-8 w-8 p-0 rounded-md hover:bg-foreground/5 text-muted-foreground"
              title="Open fullscreen"
              data-testid="workflow-fullscreen-toggle"
            >
              <Expand className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
          )}
        </div>
      </div>
      )}

      {/* Canvas. x6 paints into containerRef. Minimap dropped — plugin
          compat issue, see import-block comment. */}
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        {/* Preview overlay — swallows all pointer events above x6 (which
            already has panning/mousewheel disabled). Click opens
            fullscreen via the parent. Only rendered in preview mode. */}
        {preview && onOpenFullscreen && (
          <button
            type="button"
            onClick={onOpenFullscreen}
            aria-label="Open workflow in fullscreen"
            className="absolute inset-0 z-10 cursor-zoom-in group"
            data-testid="workflow-preview-overlay"
          >
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-background/90 backdrop-blur border border-border px-2 py-1 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              <Expand className="h-3 w-3" strokeWidth={1.75} />
              Open
            </span>
          </button>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog
        open={!!detailNode}
        onOpenChange={(open) => !open && setDetailNode(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="uppercase tracking-wide">
                {detailNode?.type ?? 'step'}
              </Badge>
              <span className="text-[11px] text-muted-foreground font-mono">
                {detailNode?.id}
              </span>
            </div>
            <DialogTitle className="text-xl leading-tight pr-8">
              {detailNode?.label}
            </DialogTitle>
            {detailNode?.description && (
              <DialogDescription className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {detailNode.description}
              </DialogDescription>
            )}
          </DialogHeader>
          {detailNode?.substeps && detailNode.substeps.length > 0 && (
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <h4 className="font-semibold text-sm text-muted-foreground">
                Steps · {detailNode.substeps.length}
              </h4>
              <ScrollArea className="flex-1 pr-3 -mr-3">
                <ol className="list-decimal pl-6 text-sm space-y-2 marker:text-muted-foreground marker:font-semibold">
                  {detailNode.substeps.map((s, i) => (
                    <li key={i} className="leading-relaxed whitespace-pre-wrap">
                      {s}
                    </li>
                  ))}
                </ol>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  // Always return the tree in place — fullscreen is a separate modal path.
  return tree;
}
