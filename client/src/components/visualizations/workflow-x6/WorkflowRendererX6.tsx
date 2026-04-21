import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Graph } from '@antv/x6';
// Plugins removed: @antv/x6-plugin-minimap and -export apply class
// decorators that read static helpers (e.g. `View.dispose`) at module-load
// time. Against x6@2.19.x those helpers have moved, so the plugins blow up
// at import with "View.dispose is not a function" — blank page before any
// React mounts. We'll roll our own export via graph.toPNG/toSVG (x6 core)
// and skip the minimap (nice-to-have, not critical for a single-pane view).
import dagre from 'dagre';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitBranch,
  Expand,
  Shrink,
  MoreHorizontal,
  FileJson,
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
}: WorkflowRendererProps) {
  const nodes = Array.isArray(nodesInput) ? nodesInput : [];
  const edges = Array.isArray(edgesInput) ? edgesInput : [];

  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [detailNode, setDetailNode] = useState<WorkflowNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
      panning: true,
      mousewheel: { enabled: true, modifiers: [] },
      interacting: { nodeMovable: true, edgeMovable: false },
      connecting: { allowBlank: false, allowMulti: false, allowLoop: false },
      autoResize: true,
    });

    // Plugins (MiniMap, Export) removed — see import-block comment at top.

    graph.on('node:click', ({ node }) => {
      const id = node.id;
      const original = nodes.find((n) => n.id === id);
      if (original) setDetailNode(original);
    });

    graphRef.current = graph;

    // ResizeObserver — x6 has autoResize but the resize only fires on window
    // resize. Our embedded case (whiteboard) resizes the container without
    // a window event, so we drive it manually.
    const ro = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth > 0 && clientHeight > 0) {
        graph.resize(clientWidth, clientHeight);
      }
    });
    ro.observe(container);

    return () => {
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

    // Fit view after layout settles.
    requestAnimationFrame(() => {
      graph.zoomToFit({ padding: 24, maxScale: 1.2 });
    });
  }, [nodes, edges, compactMode]);

  // Search — center the first matching node and flag it so the React shape
  // component draws the teal outline.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const term = searchTerm.trim().toLowerCase();
    graph.getNodes().forEach((cell) => {
      const data = (cell.getData() ?? {}) as WorkflowNodeData;
      const matches = !!term && !!data.label && data.label.toLowerCase().includes(term);
      if (!!data.matchesSearch !== matches) {
        cell.setData({ ...data, matchesSearch: matches });
      }
    });

    if (term) {
      const first = graph.getNodes().find((cell) => {
        const data = (cell.getData() ?? {}) as WorkflowNodeData;
        return data.label?.toLowerCase().includes(term);
      });
      if (first) {
        graph.centerCell(first);
      }
    }
  }, [searchTerm]);

  // Fullscreen — lock body scroll + Escape to exit, then re-fit the graph.
  useEffect(() => {
    const graph = graphRef.current;
    if (!isFullscreen) {
      if (graph) {
        const t = window.setTimeout(() => graph.zoomToFit({ padding: 24, maxScale: 1.2 }), 120);
        return () => window.clearTimeout(t);
      }
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => {
      if (graph) graph.zoomToFit({ padding: 24, maxScale: 1.2 });
    }, 150);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [isFullscreen]);

  // Toolbar actions
  const zoomIn = () => graphRef.current?.zoom(0.15);
  const zoomOut = () => graphRef.current?.zoom(-0.15);
  const fitView = () => graphRef.current?.zoomToFit({ padding: 24, maxScale: 1.2 });

  const exportAs = useCallback(
    async (format: 'png' | 'svg') => {
      const el = containerRef.current;
      if (!el) return;
      try {
        // x6 Export plugin is incompatible with x6@2.19 (see import-block
        // comment). Rehang export via html-to-image against the graph's
        // container div — the same technique the old React Flow renderer
        // + flowchart + mindmap artifacts use. skipFonts avoids the
        // html-to-image@1.11 `font.trim()` crash.
        const htmlToImage = await import('html-to-image');
        const dataUrl =
          format === 'png'
            ? await htmlToImage.toPng(el, { pixelRatio: 2, cacheBust: true, skipFonts: true })
            : await htmlToImage.toSvg(el, { cacheBust: true, skipFonts: true });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `workflow-${Date.now()}.${format}`;
        a.click();
        toast({ title: `Exported ${format.toUpperCase()}`, description: 'Downloaded.' });
      } catch (err: any) {
        toast({
          title: 'Export failed',
          description: err?.message ?? String(err),
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const copyJson = () => {
    const payload = { nodes, edges, title };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast({ title: 'Copied JSON', description: 'Workflow JSON copied to clipboard' });
  };

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

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-50 w-screen h-screen rounded-none border-0 shadow-none flex flex-col'
    : embedded
      ? 'w-full h-full flex flex-col overflow-hidden'
      : 'w-full border rounded-xl overflow-hidden shadow-2xl flex flex-col';

  const containerStyle: React.CSSProperties = isFullscreen
    ? { background: canvasBg }
    : embedded
      ? { background: canvasBg, minHeight: 420 }
      : { background: canvasBg, height: Math.max(480, Math.min(1800, nodes.length * 110 + 80)) };

  const tree = (
    <div
      className={containerClass}
      style={containerStyle}
      data-fullscreen={isFullscreen || undefined}
    >
      {/* Header / toolbar */}
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
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
              strokeWidth={1.75}
            />
            <Input
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-36 pl-8 text-xs"
            />
          </div>

          <div className="h-5 w-px bg-border mx-1" aria-hidden />

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

          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8 w-8 p-0 rounded-md hover:bg-foreground/5 text-muted-foreground"
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Open fullscreen'}
            data-testid="workflow-fullscreen-toggle"
          >
            {isFullscreen ? (
              <Shrink className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <Expand className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
          </Button>

          {/* Overflow */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-md hover:bg-foreground/5 text-muted-foreground"
                title="More options"
              >
                <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem disabled>Theme (coming soon)</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={copyJson}>
                <FileJson className="h-3.5 w-3.5 mr-2" strokeWidth={1.75} />
                Copy as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Canvas. x6 paints into containerRef. Minimap dropped — plugin
          compat issue, see import-block comment. */}
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
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

  return isFullscreen ? createPortal(tree, document.body) : tree;
}
