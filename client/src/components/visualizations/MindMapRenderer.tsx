/**
 * MindMapRenderer - Interactive Mindmap Visualization
 * Polished mindmap component rivaling VisualMind with animations and interactivity
 */

import { memo, useEffect, useRef, useState, useMemo } from 'react';
// ReactFlow base stylesheet is required — without it, nodes render without
// dimensions and edges route to nowhere, producing a visually-empty canvas.
// (WorkflowRenderer imports the same file; mindmap was relying on workflow
// being loaded first, which breaks on pages with only mindmaps.)
import '@xyflow/react/dist/style.css';
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
import { Badge } from '@/components/ui/badge';
import type { MindMapData, MindMapNode, MindMapEdge, MindMapLayout } from '@/../../shared/types/mindmap';

interface MindMapRendererProps {
  data: MindMapData;
  /** When true, suppresses the internal title/subtitle header. Set by wrappers
   *  (MindmapArtifact when inside the whiteboard ArtifactCard) to avoid the
   *  title being rendered twice. */
  embedded?: boolean;
}

/**
 * Custom node component with clean styling
 */
function MindMapNode({ data }: { data: any }) {
  const [isHovered, setIsHovered] = useState(false);

  // Layout algorithms pass the original node.type as `data.nodeType` (because
  // ReactFlow reserves `type` on the outer node record). Read `nodeType` here
  // with `type` as a fallback — without this, every node falls through to the
  // "leaf" style which is `bg-background text-foreground`, i.e. identical to
  // the canvas background → invisible in both light and dark modes.
  const getNodeStyles = () => {
    const baseStyles = 'transition-all duration-200 rounded-lg border shadow-sm';
    const nodeType = data.nodeType || data.type || 'leaf';
    
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

  // Same nodeType-vs-type mismatch as getNodeStyles above.
  const resolvedType = data.nodeType || data.type;

  const getSizeClass = () => {
    switch (resolvedType) {
      case 'root': return 'px-6 py-4 min-w-[200px]';
      case 'primary': return 'px-5 py-3 min-w-[160px]';
      case 'secondary': return 'px-4 py-2.5 min-w-[140px]';
      case 'tertiary': return 'px-3 py-2 min-w-[120px]';
      default: return 'px-3 py-2 min-w-[100px]';
    }
  };

  const getFontSize = () => {
    switch (resolvedType) {
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
      data-mindmap-node-type={resolvedType ?? "UNSET"}
      data-mindmap-raw-type={data.type ?? "NONE"}
      data-mindmap-raw-nodetype={data.nodeType ?? "NONE"}
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

function MindMapRendererInner({ data, embedded = false }: MindMapRendererProps) {
  const layout = data.layout || 'radial';
  // Payload from a failed or in-flight generation can arrive with nodes/edges
  // missing. layoutAlgorithms iterate them directly — guard before handing off
  // so we don't crash the whole chat view on mount.
  const safeNodes = Array.isArray(data.nodes) ? data.nodes : [];
  const safeEdges = Array.isArray(data.edges) ? data.edges : [];
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => layoutAlgorithms[layout](safeNodes, safeEdges),
    [safeNodes, safeEdges, layout]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);
  const { fitView } = useReactFlow();
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
    // fitView only makes sense in non-embedded contexts where the container
    // has a stable pixel size at mount. In embedded mode we rely on
    // defaultViewport at a fixed zoom (see the ReactFlow component below) to
    // dodge the late-measurement bug entirely.
    if (!embedded) {
      setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
    }
  }, [layoutNodes, layoutEdges, setNodes, setEdges, fitView, embedded]);

  // Header is rendered only when a title is present AND we're not embedded
  // inside an outer artifact card (which already shows the title). Action
  // buttons (fullscreen / download) have been moved out of the renderer and
  // into the wrapper level so there's a single source of truth per artifact.
  const showHeader = !embedded && !!data.title;

  // Empty-state — show a clear message when no nodes were produced, instead
  // of a silent blank canvas that looks like a rendering bug.
  if (safeNodes.length === 0) {
    return (
      <div
        className="w-full rounded-lg border border-border bg-muted/20 p-8 flex flex-col items-center justify-center text-center"
        style={{ minHeight: 240 }}
      >
        <div className="text-3xl mb-2">🧠</div>
        <p className="text-sm font-medium">No mindmap to display</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md">
          The mindmap generation produced no nodes. This can happen if the
          response was empty or malformed — try re-sending the request.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-background ${embedded ? "w-full h-full" : "w-full h-[600px] border border-border rounded-lg"}`}>
      {showHeader && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium">{data.title}</h3>
          {data.subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{data.subtitle}</p>
          )}
        </div>
      )}

      {/* ReactFlow Canvas */}
      <div
        ref={canvasWrapperRef}
        className={showHeader ? 'h-[calc(100%-60px)] mt-[60px]' : 'h-full'}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          // fitView is deliberately OFF in embedded mode. Inside the
          // whiteboard's CSS-transformed canvas, ReactFlow's initial
          // measurement of our parent's size is unreliable and fitView locks
          // in a tiny scale (~0.31) that it never recovers from, even with
          // ResizeObserver re-fits. We opt for a stable defaultViewport at
          // readable zoom instead — user pans / uses Controls to explore.
          // Standalone (chat) and fullscreen paths still fitView since their
          // containers have a stable pixel size at mount.
          fitView={!embedded}
          fitViewOptions={{
            padding: 0.2,
            maxZoom: 1.5,
            minZoom: 0.5,
          }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnScroll={true}
          minZoom={0.2}
          maxZoom={2.5}
          defaultViewport={embedded ? { x: 40, y: 40, zoom: 0.8 } : { x: 0, y: 0, zoom: 1 }}
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

/**
 * Memoised public API for MindMapRenderer. Without memo, every parent
 * re-render (e.g. Chat re-rendering on each composer keystroke) walks into
 * MindMapRendererInner's useEffect, re-runs the dagre layout, and calls
 * setNodes/setEdges — ReactFlow visibly "flashes" the mindmap. memo
 * short-circuits when `data` and `embedded` are reference-equal; callers
 * are responsible for handing us a stable `data` reference.
 */
const MindMapRenderer = memo(function MindMapRenderer(props: MindMapRendererProps) {
  return (
    <ReactFlowProvider>
      <MindMapRendererInner {...props} />
    </ReactFlowProvider>
  );
});

export default MindMapRenderer;
