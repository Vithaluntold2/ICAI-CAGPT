/**
 * MindMapRenderer - Interactive Mindmap Visualization
 * Polished mindmap component rivaling VisualMind with animations and interactivity
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  useNodesState,
  useEdgesState,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  NodeTypes,
} from '@xyflow/react';
import dagre from 'dagre';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { MindMapData, MindMapNode, MindMapEdge, MindMapLayout } from '@/../../shared/types/mindmap';

interface MindMapRendererProps {
  data: MindMapData;
}

/**
 * Custom node component with clean styling
 */
function MindMapNode({ data }: { data: MindMapNode }) {
  const [isHovered, setIsHovered] = useState(false);

  const getNodeStyles = () => {
    const baseStyles = 'transition-all duration-200 rounded-lg border shadow-sm';
    const nodeType = data.type || 'leaf';
    
    // Clean monochromatic styling that works in both modes
    const styleMap: Record<string, string> = {
      root: 'bg-foreground text-background border-foreground font-bold',
      primary: 'bg-foreground/90 text-background border-foreground/90',
      secondary: 'bg-foreground/10 text-foreground border-foreground/20',
      tertiary: 'bg-background text-foreground border-border',
      leaf: 'bg-background text-foreground border-border',
    };

    return `${baseStyles} ${styleMap[nodeType] || styleMap.leaf} ${
      isHovered ? 'scale-105 shadow-md' : 'scale-100'
    }`;
  };

  const getSizeClass = () => {
    switch (data.type) {
      case 'root': return 'px-6 py-4 min-w-[200px]';
      case 'primary': return 'px-5 py-3 min-w-[160px]';
      case 'secondary': return 'px-4 py-2.5 min-w-[140px]';
      case 'tertiary': return 'px-3 py-2 min-w-[120px]';
      default: return 'px-3 py-2 min-w-[100px]';
    }
  };

  const getFontSize = () => {
    switch (data.type) {
      case 'root': return 'text-base font-semibold';
      case 'primary': return 'text-sm font-medium';
      case 'secondary': return 'text-sm';
      default: return 'text-xs';
    }
  };

  return (
    <div
      className={`${getNodeStyles()} ${getSizeClass()} relative`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* @xyflow/react requires custom nodes to declare their connection points.
          Without <Handle> elements, edges are silently dropped. We expose both
          target and source on all four sides so edges look right regardless of
          which layout algorithm (radial/tree-vertical/tree-horizontal/organic)
          placed this node. Handles are made invisible — the node looks plain,
          but ReactFlow can now route edges through them. */}
      <Handle type="target" position={Position.Top}    style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />

      <div className="flex items-center gap-2">
        {data.icon && (
          <span className="text-lg">{data.icon}</span>
        )}
        <div className="flex-1">
          <div className={getFontSize()}>{data.label}</div>
          {data.description && (
            <div className="text-xs mt-0.5 opacity-70">{data.description}</div>
          )}
        </div>
      </div>

      {data.metadata?.tags && data.metadata.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {data.metadata.tags.map((tag: string, i: number) => (
            <Badge key={i} variant="outline" className="text-[10px] px-1 py-0 h-4">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  mindmapNode: MindMapNode,
};

/**
 * Layout algorithms for different mindmap styles
 */
const layoutAlgorithms = {
  'radial': (nodes: MindMapNode[], edges: MindMapEdge[]) => {
    // Radial layout: root at center, branches radiating outward
    const root = nodes.find(n => n.type === 'root');
    if (!root) return { nodes: [], edges: [] };

    const levels = new Map<string, number>();
    const children = new Map<string, string[]>();
    
    // Build hierarchy
    edges.forEach(edge => {
      if (!children.has(edge.source)) {
        children.set(edge.source, []);
      }
      children.get(edge.source)!.push(edge.target);
    });

    // Calculate levels (BFS)
    const queue: Array<[string, number]> = [[root.id, 0]];
    levels.set(root.id, 0);
    
    while (queue.length > 0) {
      const [nodeId, level] = queue.shift()!;
      const nodeChildren = children.get(nodeId) || [];
      nodeChildren.forEach(childId => {
        if (!levels.has(childId)) {
          levels.set(childId, level + 1);
          queue.push([childId, level + 1]);
        }
      });
    }

    // Position nodes radially
    const radius = 250;
    const centerX = 0;
    const centerY = 0;

    const flowNodes: Node[] = nodes.map((node) => {
      const level = levels.get(node.id) || 0;
      const siblingsAtLevel = Array.from(levels.entries())
        .filter(([_, l]) => l === level)
        .map(([id]) => id);
      
      const indexAtLevel = siblingsAtLevel.indexOf(node.id);
      const angleStep = (2 * Math.PI) / Math.max(siblingsAtLevel.length, 1);
      const angle = angleStep * indexAtLevel;
      
      const distance = level * radius;
      const x = centerX + distance * Math.cos(angle);
      const y = centerY + distance * Math.sin(angle);

      return {
        id: node.id,
        type: 'mindmapNode',
        position: { x, y },
        data: {
          label: node.label,
          description: node.description,
          icon: node.icon,
          nodeType: node.type,
          metadata: node.metadata,
        },
        draggable: true,
      };
    });

    const flowEdges: Edge[] = edges.map((edge, i) => ({
      id: edge.id || `e-${i}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true,
      className: 'mindmap-edge',
      style: {
        strokeWidth: edge.weight || 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
      },
      label: edge.label,
    }));

    return { nodes: flowNodes, edges: flowEdges };
  },

  'tree-vertical': (nodes: MindMapNode[], edges: MindMapEdge[]) => {
    // Use dagre for tree layout
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', ranksep: 120, nodesep: 80 });

    nodes.forEach((node) => {
      g.setNode(node.id, { width: 200, height: 80 });
    });

    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    const flowNodes: Node[] = nodes.map((node) => {
      const nodeWithPosition = g.node(node.id);
      return {
        id: node.id,
        type: 'mindmapNode',
        position: {
          x: nodeWithPosition.x - 100,
          y: nodeWithPosition.y - 40,
        },
        data: {
          label: node.label,
          description: node.description,
          icon: node.icon,
          nodeType: node.type,
          metadata: node.metadata,
        },
        draggable: true,
      };
    });

    const flowEdges: Edge[] = edges.map((edge, i) => ({
      id: edge.id || `e-${i}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true,
      className: 'mindmap-edge',
      style: {
        strokeWidth: edge.weight || 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
      },
      label: edge.label,
    }));

    return { nodes: flowNodes, edges: flowEdges };
  },

  'tree-horizontal': (nodes: MindMapNode[], edges: MindMapEdge[]) => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', ranksep: 150, nodesep: 80 });

    nodes.forEach((node) => {
      g.setNode(node.id, { width: 200, height: 80 });
    });

    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    const flowNodes: Node[] = nodes.map((node) => {
      const nodeWithPosition = g.node(node.id);
      return {
        id: node.id,
        type: 'mindmapNode',
        position: {
          x: nodeWithPosition.x - 100,
          y: nodeWithPosition.y - 40,
        },
        data: {
          label: node.label,
          description: node.description,
          icon: node.icon,
          nodeType: node.type,
          metadata: node.metadata,
        },
        draggable: true,
      };
    });

    const flowEdges: Edge[] = edges.map((edge, i) => ({
      id: edge.id || `e-${i}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true,
      className: 'mindmap-edge',
      style: {
        strokeWidth: edge.weight || 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
      },
      label: edge.label,
    }));

    return { nodes: flowNodes, edges: flowEdges };
  },

  'organic': (nodes: MindMapNode[], edges: MindMapEdge[]) => {
    // Force-directed layout (simplified version)
    // In production, you'd use D3-force or similar
    return layoutAlgorithms['radial'](nodes, edges);
  },

  'timeline': (nodes: MindMapNode[], edges: MindMapEdge[]) => {
    // Linear timeline layout
    const flowNodes: Node[] = nodes.map((node, i) => ({
      id: node.id,
      type: 'mindmapNode',
      position: { x: i * 250, y: 0 },
      data: {
        label: node.label,
        description: node.description,
        icon: node.icon,
        nodeType: node.type,
        metadata: node.metadata,
      },
      draggable: true,
    }));

    const flowEdges: Edge[] = edges.map((edge, i) => ({
      id: edge.id || `e-${i}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true,
      className: 'mindmap-edge',
      style: {
        strokeWidth: edge.weight || 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
      },
      label: edge.label,
    }));

    return { nodes: flowNodes, edges: flowEdges };
  },
};

function MindMapRendererInner({ data }: MindMapRendererProps) {
  const layout = data.layout || 'radial';
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => layoutAlgorithms[layout](data.nodes, data.edges),
    [data.nodes, data.edges, layout]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);
  const { fitView } = useReactFlow();
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  // Fullscreen lightbox: when true, the mindmap container switches to a fixed
  // overlay covering the viewport. In-viewport zoom/pan/fit remain available
  // via ReactFlow's floating <Controls> in the bottom-right.
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Container ref scopes our PNG/SVG capture query so a page with multiple
  // mindmaps doesn't grab the wrong React Flow viewport.
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
    // Fit view after layout
    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
  }, [layoutNodes, layoutEdges, setNodes, setEdges, fitView]);

  // Escape exits fullscreen. Also re-run fitView whenever fullscreen toggles so
  // the mindmap fills the new container size instead of staying at the old zoom.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const timer = setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 60);
    // Lock background scroll while the overlay is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen, fitView]);

  useEffect(() => {
    // After exiting fullscreen, re-fit so the tile view recenters too.
    if (!isFullscreen) {
      const timer = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 60);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen, fitView]);

  const handleExport = useCallback(async (format: 'png' | 'svg' | 'json') => {
    const baseName = (data.title || 'mindmap').replace(/[^a-z0-9_-]+/gi, '_');

    if (format === 'json') {
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // PNG / SVG: snapshot React Flow's viewport (the scaled node graph) so the
    // exported image matches what the user is looking at — no toolbars, no
    // controls, just the diagram.
    const root = containerRef.current;
    const viewport = (root?.querySelector('.react-flow__viewport') as HTMLElement | null)
      ?? (root?.querySelector('.react-flow') as HTMLElement | null);
    if (!viewport) {
      console.error('[MindMapRenderer] export target not found');
      return;
    }

    try {
      // Settle the layout before snapshotting so the capture includes everything.
      fitView({ padding: 0.2, duration: 0 });
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const htmlToImage = await import('html-to-image');
      const options = {
        pixelRatio: format === 'png' ? 2 : 1,
        backgroundColor: '#ffffff',
        cacheBust: true,
        filter: (node: HTMLElement) =>
          !node.classList?.contains('react-flow__minimap')
          && !node.classList?.contains('react-flow__controls'),
      };

      const dataUrl = format === 'png'
        ? await htmlToImage.toPng(viewport, options)
        : await htmlToImage.toSvg(viewport, options);

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${baseName}.${format}`;
      a.click();
    } catch (err) {
      console.error(`[MindMapRenderer] ${format} export failed:`, err);
    }
  }, [data, fitView]);

  // Container class switches between in-tile and fullscreen-overlay presentation.
  // In fullscreen, we cover the viewport with a fixed-position layer; the
  // ReactFlow canvas below grows to fill it automatically.
  const containerClass = isFullscreen
    ? "fixed inset-0 z-50 w-screen h-screen bg-background"
    : "w-full h-[600px] relative border border-border rounded-lg overflow-hidden bg-background";

  return (
    <div ref={containerRef} className={containerClass}>
      {/* Collapsible Header */}
      {data.title && (
        <div className={`absolute top-0 left-0 right-0 z-10 bg-background/95 backdrop-blur border-b border-border transition-all duration-200 ${isHeaderCollapsed ? 'px-4 py-2' : 'px-4 py-3'}`}>
          <div className="flex items-center justify-between">
            <div className={`flex-1 ${isHeaderCollapsed ? 'hidden' : 'block'}`}>
              <h3 className="text-sm font-medium">{data.title}</h3>
              {data.subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{data.subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Artifact-level actions only. Zoom/fit are intentionally NOT
                  duplicated here — ReactFlow's floating <Controls> in the
                  bottom-right already handle zoom-in / zoom-out / fit-view. */}
              {!isHeaderCollapsed && (
                <div className="flex gap-1 mr-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Open fullscreen'}
                    className="h-7 w-7 p-0"
                  >
                    {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Download…"
                        className="h-7 w-7 p-0"
                        data-testid="mindmap-download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExport('png')}>
                        PNG image
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('svg')}>
                        SVG image
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('json')}>
                        JSON source
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                title={isHeaderCollapsed ? 'Expand' : 'Collapse'}
                className="h-7 w-7 p-0"
              >
                {isHeaderCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ReactFlow Canvas */}
      <div className={data.title ? (isHeaderCollapsed ? 'h-[calc(100%-40px)] mt-[40px]' : 'h-[calc(100%-60px)] mt-[60px]') : 'h-full'}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{
            padding: 0.2,
            maxZoom: 1.5,
            minZoom: 0.3,
          }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnScroll={true}
          minZoom={0.2}
          maxZoom={2.5}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        >
          <Background gap={20} size={1} />
          <Controls
            position="bottom-right"
            showInteractive={false}
          />
          <MiniMap
            position="bottom-left"
            nodeColor={() => 'hsl(var(--foreground))'}
            maskColor="hsl(var(--background) / 0.8)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function MindMapRenderer(props: MindMapRendererProps) {
  return (
    <ReactFlowProvider>
      <MindMapRendererInner {...props} />
    </ReactFlowProvider>
  );
}
