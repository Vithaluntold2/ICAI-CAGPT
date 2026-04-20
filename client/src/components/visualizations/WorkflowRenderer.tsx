import { useCallback, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
  MiniMap,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import dagre from 'dagre';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  Palette,
  Shuffle,
  Settings,
  Download,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3x3,
  GitBranch,
  Layers,
  Share2,
  Play,
  Pause,
  RotateCcw,
  Info,
  MousePointerClick,
  Expand,
  Shrink,
} from 'lucide-react';
import ColorPicker from '@/components/ui/color-picker';
import { useToast } from '@/hooks/use-toast';
import '@xyflow/react/dist/style.css';

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
  layout?: string; // 'linear-process', 'decision-tree', 'parallel-workflow', 'approval-workflow'
  /** When true, the internal title chip (left side of the header) is hidden
   *  since the outer artifact card already shows the artifact title. The
   *  toolbar on the right stays — its controls are unique to the workflow. */
  embedded?: boolean;
}

interface ColorTheme {
  name: string;
  start: string;
  step: string;
  decision: string;
  end: string;
  edge: string;
  background: string;
}

const colorThemes: ColorTheme[] = [
  {
    // Branded, readable default. White canvas, brand-blue accents, crisp contrast
    // on every node type. Step cells use a soft slate-blue instead of washed-out
    // pastels so the dark body text is unambiguously legible.
    name: 'CA GPT Classic',
    start: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',       // deep brand blue
    step: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',        // slate-50 → slate-200
    decision: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',    // amber for decisions
    end: 'linear-gradient(135deg, #059669 0%, #047857 100%)',         // green for completion
    edge: '#2563eb',
    background: '#f8fafc'
  },
  {
    name: 'Midnight Professional',
    start: 'linear-gradient(135deg, #3C96EE 0%, #764ba2 100%)',
    step: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',         // dark slate so white text reads
    decision: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    end: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    edge: '#3C96EE',
    background: '#0f172a'
  },
  {
    name: 'Ocean Breeze',
    start: 'linear-gradient(135deg, #3C96EE 0%, #0891b2 100%)',
    step: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
    decision: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)',
    end: 'linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%)',
    edge: '#3C96EE',
    background: '#ecfeff'
  },
  {
    name: 'Sunset Glow',
    start: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    step: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
    decision: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
    end: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    edge: '#f97316',
    background: '#fffbeb'
  },
  {
    name: 'Forest Path',
    start: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    step: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    decision: 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
    end: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    edge: '#059669',
    background: '#f0fdf4'
  },
  {
    name: 'Royal Purple',
    start: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
    step: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
    decision: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
    end: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)',
    edge: '#9333ea',
    background: '#faf5ff'
  },
  {
    name: 'RAi Blue',
    start: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
    step: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    decision: 'linear-gradient(135deg, #3C96EE 0%, #137BE1 100%)',
    end: 'linear-gradient(135deg, #5FA9F1 0%, #3C96EE 100%)',
    edge: '#1e40af',
    background: '#eff6ff'
  },
  {
    name: 'Rose Gold',
    start: 'linear-gradient(135deg, #be123c 0%, #9f1239 100%)',
    step: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
    decision: 'linear-gradient(135deg, #fb7185 0%, #f43f5e 100%)',
    end: 'linear-gradient(135deg, #fda4af 0%, #fb7185 100%)',
    edge: '#be123c',
    background: '#fff1f2'
  }
];

// Dynamic node dimensions based on compact mode. Slightly more generous so
// long labels like "Supplies to unregistered persons" can wrap to two or three
// lines rather than ellipsis-truncating to a single line.
const getNodeDimensions = (compact: boolean, nodeCount: number) => {
  if (compact || nodeCount > 30) {
    return { width: 220, height: 72 };
  } else if (nodeCount > 20) {
    return { width: 260, height: 110 };
  }
  return { width: 320, height: 130 };
};

// Default dimensions for layout calculations
const nodeWidth = 280;
const nodeHeight = 100;

const layoutAlgorithms = {
  'dagre-tb': { rankdir: 'TB', ranksep: 180, nodesep: 140 },
  'dagre-lr': { rankdir: 'LR', ranksep: 200, nodesep: 120 },
  'swimlane': { rankdir: 'TB', ranksep: 180, nodesep: 140 },
  'hierarchical': { rankdir: 'TB', ranksep: 220, nodesep: 160 },
  'radial': { rankdir: 'TB', ranksep: 200, nodesep: 150 },
};

// Compact layout for large workflows
const compactLayoutAlgorithms = {
  'dagre-tb': { rankdir: 'TB', ranksep: 80, nodesep: 60 },
  'dagre-lr': { rankdir: 'LR', ranksep: 100, nodesep: 50 },
  'swimlane': { rankdir: 'TB', ranksep: 80, nodesep: 60 },
  'hierarchical': { rankdir: 'TB', ranksep: 100, nodesep: 70 },
  'radial': { rankdir: 'TB', ranksep: 90, nodesep: 60 },
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], layout: string = 'dagre-tb', compact: boolean = false, nodeDims?: { width: number; height: number }) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const layouts = compact ? compactLayoutAlgorithms : layoutAlgorithms;
  const layoutConfig = layouts[layout as keyof typeof layouts] || layouts['dagre-tb'];
  const nWidth = nodeDims?.width || nodeWidth;
  const nHeight = nodeDims?.height || nodeHeight;
  
  dagreGraph.setGraph({ 
    ...layoutConfig,
    marginx: compact ? 40 : 80,
    marginy: compact ? 40 : 80
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: nWidth, 
      height: nHeight
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: Math.round(nodeWithPosition.x - nWidth / 2),
        y: Math.round(nodeWithPosition.y - nHeight / 2),
      },
      style: {
        width: nWidth,
        height: nHeight,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

const getNodeStyle = (type: string, theme: ColorTheme) => {
  const baseStyle = {
    padding: '20px 24px',
    borderRadius: '16px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    wordWrap: 'break-word' as const,
    boxSizing: 'border-box' as const,
    overflow: 'visible',
    color: '#ffffff',
    textShadow: '0 2px 8px rgba(0,0,0,0.3)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1) inset',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    zIndex: 10,
    position: 'relative' as const,
  };

  const hoverTransform = {
    ':hover': {
      transform: 'translateY(-4px) scale(1.02)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.25), 0 0 0 2px rgba(255,255,255,0.2) inset',
      zIndex: 20
    }
  };

  let backgroundColor: string;
  
  switch (type) {
    case 'start':
      backgroundColor = theme.start;
      return {
        ...baseStyle,
        ...hoverTransform,
        background: backgroundColor,
        borderRadius: '50px',
        minHeight: '80px',
        boxShadow: `0 10px 30px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1) inset, 0 0 60px ${theme.edge}40`,
      };
    case 'end':
      backgroundColor = theme.end;
      return {
        ...baseStyle,
        ...hoverTransform,
        background: backgroundColor,
        borderRadius: '50px',
        minHeight: '80px',
        boxShadow: `0 10px 30px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1) inset, 0 0 60px ${theme.edge}40`,
      };
    case 'decision':
      backgroundColor = theme.decision;
      return {
        ...baseStyle,
        background: backgroundColor,
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        boxShadow: `0 10px 30px rgba(0,0,0,0.15), 0 0 60px ${theme.edge}30`,
        ':hover': {
          transform: 'scale(1.08) rotate(2deg)',
          boxShadow: `0 20px 40px rgba(0,0,0,0.25), 0 0 80px ${theme.edge}50`,
          zIndex: 20
        }
      };
    default:
      backgroundColor = theme.step;
      // Step nodes often use pastel / light gradients. Pick text color by
      // sampling the first hex in the gradient: if the luminance is high
      // (light background) → dark text; else → white text with shadow.
      const firstHex = backgroundColor.match(/#[0-9a-fA-F]{6}/)?.[0] ?? '#e0e7ff';
      const isLight = hexLuminance(firstHex) > 0.55;
      return {
        ...baseStyle,
        ...hoverTransform,
        background: backgroundColor,
        color: isLight ? '#0f172a' : '#ffffff',
        textShadow: isLight ? 'none' : '0 2px 8px rgba(0,0,0,0.3)',
        border: isLight ? '1px solid rgba(15,23,42,0.08)' : 'none',
      };
  }
};

// Relative luminance (WCAG) of a #RRGGBB hex; 0 = black, 1 = white.
function hexLuminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function WorkflowRendererInner({ nodes: nodesInput, edges: edgesInput, title, layout = 'dagre-tb', embedded = false }: WorkflowRendererProps) {
  // Payloads from failed/in-flight server generations can arrive with
  // nodes/edges missing entirely. Defend the first `.length` access on line
  // below — otherwise WorkflowRenderer blows up on mount and takes the whole
  // chat view with it via the error boundary.
  const nodes = Array.isArray(nodesInput) ? nodesInput : [];
  const edges = Array.isArray(edgesInput) ? edgesInput : [];

  const [selectedTheme, setSelectedTheme] = useState<ColorTheme>(colorThemes[0]);
  const [animateEdges, setAnimateEdges] = useState(true);
  const [customTheme, setCustomTheme] = useState<ColorTheme | null>(null);
  const [currentLayout, setCurrentLayout] = useState(layout);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  // Compact mode for large workflows - auto-enabled for 20+ nodes
  const isLargeWorkflow = nodes.length > 20;
  const [compactMode, setCompactMode] = useState(isLargeWorkflow);
  // Node detail modal — opened on node click. Holds the full (un-clamped)
  // label/description/substeps so nothing is ever unreachable.
  const [detailNode, setDetailNode] = useState<WorkflowNode | null>(null);
  // Fullscreen lightbox — separate from "Fit to View". Fullscreen enlarges the
  // entire workflow container to fill the viewport; Fit to View just reframes
  // the canvas within whatever container size it's currently in.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { toast } = useToast();
  const reactFlowInstance = useReactFlow();
  
  const activeTheme = customTheme || selectedTheme;
  
  const randomizeColors = () => {
    const randomIndex = Math.floor(Math.random() * colorThemes.length);
    setSelectedTheme(colorThemes[randomIndex]);
    setCustomTheme(null);
    toast({
      title: "Theme changed",
      description: `Applied ${colorThemes[randomIndex].name} theme`
    });
  };

  const updateCustomColor = (nodeType: keyof ColorTheme, color: string) => {
    const newCustomTheme: ColorTheme = {
      ...activeTheme,
      name: 'Custom',
      [nodeType]: color
    };
    setCustomTheme(newCustomTheme);
  };

  const exportAsImage = useCallback(async (format: 'png' | 'svg') => {
    if (!reactFlowInstance) return;

    // Find the actual rendered viewport. React Flow renders the node graph inside
    // `.react-flow__viewport`; capturing that element gives us the diagram without
    // the surrounding toolbars and panels.
    const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
    const fallback = document.querySelector<HTMLElement>('.react-flow');
    const target = viewport ?? fallback;
    if (!target) {
      toast({
        title: "Export failed",
        description: "Could not locate the workflow canvas.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Exporting workflow",
      description: `Generating ${format.toUpperCase()} image…`,
    });

    try {
      // Fit the diagram into view so the capture includes every node.
      reactFlowInstance.fitView?.({ padding: 0.1, duration: 0 });
      // Give React Flow one frame to settle the transform before we snapshot.
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const htmlToImage = await import('html-to-image');
      const options = {
        pixelRatio: format === 'png' ? 2 : 1,
        backgroundColor: '#ffffff',
        cacheBust: true,
        // skipFonts avoids a bug in html-to-image@1.11.x where `font.trim()` is
        // called on an undefined value during @font-face embedding, crashing
        // the export. With this flag, text renders in the system/browser font
        // — acceptable for a snapshot; the PNG still looks fine.
        skipFonts: true,
        // html-to-image tries to inline cross-origin images; swallow failures so the
        // main diagram still renders.
        filter: (node: HTMLElement) => !node.classList?.contains('react-flow__minimap'),
      };

      const dataUrl = format === 'png'
        ? await htmlToImage.toPng(target, options)
        : await htmlToImage.toSvg(target, options);

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `workflow-${Date.now()}.${format}`;
      a.click();

      toast({
        title: "Export complete",
        description: `Workflow saved as ${format.toUpperCase()}.`,
      });
    } catch (err: any) {
      console.error('[WorkflowRenderer] export failed', err);
      toast({
        title: "Export failed",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    }
  }, [reactFlowInstance, toast]);

  const playAnimation = useCallback(() => {
    setIsAnimating(true);
    setAnimationProgress(0);
    
    const duration = 3000;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      setAnimationProgress(progress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        setAnimationProgress(0);
      }
    };
    
    requestAnimationFrame(animate);
  }, []);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    if (!term || !reactFlowInstance) return;

    const { getNodes, setCenter } = reactFlowInstance;
    const matchingNode = getNodes().find(node => 
      node.data.label && 
      typeof node.data.label === 'string' &&
      node.data.label.toLowerCase().includes(term.toLowerCase())
    );

    if (matchingNode) {
      setCenter(
        matchingNode.position.x + nodeWidth / 2,
        matchingNode.position.y + nodeHeight / 2,
        { zoom: 1.2, duration: 800 }
      );
    }
  }, [reactFlowInstance]);
  const createThemedNodes = (theme: ColorTheme): Node[] => {
    const dims = getNodeDimensions(compactMode, nodes.length);
    
    return nodes.map((node, idx) => {
      const isHighlighted = isAnimating && animationProgress >= (idx / nodes.length) && animationProgress < ((idx + 1) / nodes.length + 0.1);
      const matchesSearch = searchTerm && node.label.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Build a native tooltip with full label + description so nothing is ever
      // unreachable, even when CSS line-clamp hides overflow.
      const fullTooltip = [
        node.label,
        node.description ? `\n\n${node.description}` : '',
        node.substeps && node.substeps.length > 0
          ? `\n\nSteps:\n${node.substeps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
          : '',
      ].join('');

      // True when rendered content will likely be clipped — used to decide
      // whether to surface a "more" hint at the bottom of the node body.
      const isLabelLong = (node.label?.length ?? 0) > (compactMode ? 40 : 90);
      const isDescLong = (node.description?.length ?? 0) > 80;
      const hasHiddenSubsteps = (node.substeps?.length ?? 0) > 3;
      const hasLongSubstep = (node.substeps ?? []).some(s => (s?.length ?? 0) > 60);
      const contentClipped = isLabelLong || isDescLong || hasHiddenSubsteps || hasLongSubstep;

      return {
        id: node.id,
        type: 'default',
        data: {
          label: (
            <>
              {/* Always-present affordance: a small info chip at the top-right
                  of the node communicates "click for full details". We show a
                  stronger pill ("More") when content is actually clipped, and a
                  subtle icon otherwise. */}
              <div
                className="absolute top-1.5 right-1.5 pointer-events-none flex items-center gap-1 z-20"
                aria-hidden
              >
                {contentClipped ? (
                  <div
                    className="flex items-center gap-1 rounded-full bg-black/35 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                    title="Content is truncated — click to expand"
                  >
                    <Info className="h-2.5 w-2.5" />
                    <span className="leading-none">More</span>
                  </div>
                ) : (
                  <Info className="h-3 w-3 text-white/60" />
                )}
              </div>

              {compactMode ? (
                // Compact mode: wrap to max 2 lines, then ellipsis. Full text on hover and on click.
                <div
                  className="flex items-center justify-center h-full w-full"
                  style={{ zIndex: 10 }}
                  title={fullTooltip}
                >
                  <div
                    className={`font-semibold text-xs leading-snug text-center px-1 ${isHighlighted ? 'animate-pulse' : ''} ${matchesSearch ? 'underline' : ''}`}
                    style={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                      maxWidth: dims.width - 12,
                    }}
                  >
                    {node.label}
                  </div>
                </div>
              ) : (
                // Detailed mode: wrap freely; let text span multiple lines. Clamp the
                // label at 3 lines, description at 2, so the node stays predictable
                // but no text is hard-truncated — full content is always reachable
                // via the click-to-expand dialog.
                <div
                  className="flex flex-col gap-1.5 w-full"
                  style={{ lineHeight: '1.35', zIndex: 10 }}
                  title={fullTooltip}
                >
                  <div
                    className={`font-bold text-sm pr-14 ${isHighlighted ? 'animate-pulse' : ''} ${matchesSearch ? 'underline' : ''}`}
                    style={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 3,
                      overflow: 'hidden',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {node.label}
                  </div>
                  {node.description && (
                    <div
                      className="text-xs opacity-90 leading-snug"
                      style={{
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {node.description}
                    </div>
                  )}
                  {node.substeps && node.substeps.length > 0 && (
                    <div className="text-[11px] text-left space-y-0.5 leading-tight opacity-95">
                      {node.substeps.slice(0, 3).map((step, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="mt-0.5">•</span>
                          <span
                            style={{
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: 1,
                              overflow: 'hidden',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {step}
                          </span>
                        </div>
                      ))}
                      {node.substeps.length > 3 && (
                        <div className="italic opacity-70">+{node.substeps.length - 3} more… (click to view all)</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        },
        position: { x: 0, y: idx * 150 },
        style: {
          ...getNodeStyle(node.type, theme),
          width: dims.width,
          height: dims.height,
          padding: compactMode ? '8px 12px' : '20px 24px',
          fontSize: compactMode ? '11px' : '14px',
          ...(isHighlighted ? {
            transform: 'scale(1.1)',
            boxShadow: `0 0 60px ${theme.edge}, 0 20px 40px rgba(0,0,0,0.3)`,
            zIndex: 30
          } : {}),
          ...(matchesSearch ? {
            outline: `3px solid ${theme.edge}`,
            outlineOffset: '4px'
          } : {})
        },
        zIndex: isHighlighted ? 30 : (matchesSearch ? 20 : 10)
      };
    });
  };

  const createThemedEdges = (theme: ColorTheme): Edge[] => {
    return edges.map((edge, idx) => {
      const isActive = isAnimating && animationProgress >= (idx / edges.length);
      
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: 'smoothstep',
        animated: animateEdges || isActive,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 30,
          height: 30,
          color: isActive ? theme.edge : theme.edge + '80'
        },
        style: {
          strokeWidth: isActive ? 5 : 3,
          stroke: isActive ? theme.edge : theme.edge + '80',
          strokeDasharray: animateEdges ? '8,8' : '0',
          filter: isActive ? `drop-shadow(0 0 8px ${theme.edge})` : 'none',
          transition: 'all 0.3s ease'
        },
        labelStyle: {
          fill: theme.edge,
          fontSize: 13,
          fontWeight: 700,
          zIndex: 100
        },
        labelBgStyle: {
          fill: '#ffffff',
          fillOpacity: 0.98,
          rx: 8,
          ry: 8,
          stroke: theme.edge,
          strokeWidth: 2
        },
        labelBgPadding: [10, 14] as [number, number],
        zIndex: isActive ? 15 : 5
      };
    });
  };
  
  // Get dimensions based on compact mode and node count
  const nodeDims = getNodeDimensions(compactMode, nodes.length);

  const initialNodes = createThemedNodes(activeTheme);
  const initialEdges = createThemedEdges(activeTheme);

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    initialNodes,
    initialEdges,
    layout,
    compactMode,
    nodeDims
  );

  const [flowNodes, setNodes] = useNodesState(layoutedNodes);
  const [flowEdges, setEdges] = useEdgesState(layoutedEdges);

  useEffect(() => {
    const newNodes = createThemedNodes(activeTheme);
    const newEdges = createThemedEdges(activeTheme);
    const dims = getNodeDimensions(compactMode, nodes.length);
    const { nodes: newLayoutedNodes, edges: newLayoutedEdges } = getLayoutedElements(
      newNodes,
      newEdges,
      currentLayout,
      compactMode,
      dims
    );
    setNodes(newLayoutedNodes);
    setEdges(newLayoutedEdges);
    
    setTimeout(() => {
      // Better fit view padding for large workflows
      const padding = nodes.length > 30 ? 0.1 : nodes.length > 15 ? 0.15 : 0.2;
      reactFlowInstance?.fitView({ padding, duration: 800 });
    }, 100);
  }, [nodes, edges, activeTheme, animateEdges, currentLayout, isAnimating, animationProgress, searchTerm, compactMode]);

  // Dynamic height based on workflow size
  const containerHeight = nodes.length > 40 ? 900 : nodes.length > 20 ? 800 : 700;

  // Early return when no workflow data is available — shows a clear message
  // instead of an empty canvas, so a failed generation is obvious to the user
  // and doesn't masquerade as a blank successful result.
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

  // While fullscreen, lock body scroll + bind Escape to exit. On toggle, give
  // React Flow a beat to settle the new container size then re-fit so the
  // workflow fills the whole screen instead of staying at the old zoom.
  useEffect(() => {
    if (!isFullscreen) {
      const t = window.setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2, duration: 300 }), 100);
      return () => window.clearTimeout(t);
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => reactFlowInstance?.fitView({ padding: 0.15, duration: 400 }), 100);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [isFullscreen, reactFlowInstance]);

  // Three modes:
  //   fullscreen → full-viewport portal overlay
  //   embedded   → fills the parent ArtifactCard (no own border/overflow;
  //                the card owns those). Explicit `height: containerHeight`
  //                here breaks ReactFlow's viewport measurement when nested
  //                inside a transformed whiteboard canvas — leaving the
  //                renderer invisible until the user clicks fullscreen.
  //   standalone → chat inline, own bordered card + fixed pixel height.
  const containerClass = isFullscreen
    ? "fixed inset-0 z-50 w-screen h-screen rounded-none border-0 shadow-none flex flex-col"
    : embedded
      ? "w-full h-full flex flex-col"
      : "w-full border rounded-xl overflow-hidden shadow-2xl";
  const containerStyle: React.CSSProperties = isFullscreen
    ? { background: activeTheme.background }
    : embedded
      ? { background: activeTheme.background }
      : { background: activeTheme.background, height: containerHeight };

  // Fullscreen has to escape the whiteboard's transformed container. A
  // transform on any ancestor turns that ancestor into the containing block
  // for `position: fixed`, so an overlay rendered inline would be visually
  // clipped to the canvas. createPortal moves the DOM node under <body>, out
  // of the transform subtree, so `fixed inset-0` now resolves against the
  // viewport as intended. Non-fullscreen renders stay in place.
  const tree = (
    <div className={containerClass} style={containerStyle} data-fullscreen={isFullscreen || undefined}>
      {/* Enhanced Header */}
      {title && (
        <div className="shrink-0 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between gap-4">
          {embedded ? (
            // Embedded inside an artifact card → the outer card already shows
            // the title, so we only render the toolbar (right side). A small
            // spacer pushes the toolbar to the right edge.
            <div aria-hidden />
          ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">{title}</h3>
              <p className="text-xs text-muted-foreground">{nodes.length} steps • {edges.length} connections{isLargeWorkflow ? ' • Large workflow' : ''}</p>
            </div>
          </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-8 w-36 pl-8 text-xs"
              />
            </div>

            {/* Layout Selector */}
            <Select
              value={currentLayout}
              onValueChange={setCurrentLayout}
            >
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dagre-tb">
                  <div className="flex items-center gap-2">
                    <Grid3x3 className="h-3 w-3" />
                    Vertical
                  </div>
                </SelectItem>
                <SelectItem value="dagre-lr">
                  <div className="flex items-center gap-2">
                    <Layers className="h-3 w-3" />
                    Horizontal
                  </div>
                </SelectItem>
                <SelectItem value="hierarchical">Hierarchical</SelectItem>
                <SelectItem value="swimlane">Swimlane</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
              </SelectContent>
            </Select>

            {/* Theme Selector */}
            <Select
              value={customTheme ? 'Custom' : selectedTheme.name}
              onValueChange={(value) => {
                if (value === 'Custom') return;
                const theme = colorThemes.find(t => t.name === value);
                if (theme) {
                  setSelectedTheme(theme);
                  setCustomTheme(null);
                }
              }}
            >
              <SelectTrigger className="w-40 h-8">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                {customTheme && (
                  <SelectItem value="Custom">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full border"
                        style={{ background: customTheme.start }}
                      />
                      Custom
                    </div>
                  </SelectItem>
                )}
                {colorThemes.map((theme) => (
                  <SelectItem key={theme.name} value={theme.name}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full border"
                        style={{ background: theme.start }}
                      />
                      {theme.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Color Customization */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Palette className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <h4 className="font-medium">Customize Colors</h4>
                  <div className="space-y-3">
                    <ColorPicker
                      label="Start Nodes"
                      color={activeTheme.start}
                      onChange={(color) => updateCustomColor('start', color)}
                    />
                    <ColorPicker
                      label="Step Nodes"
                      color={activeTheme.step}
                      onChange={(color) => updateCustomColor('step', color)}
                    />
                    <ColorPicker
                      label="Decision Nodes"
                      color={activeTheme.decision}
                      onChange={(color) => updateCustomColor('decision', color)}
                    />
                    <ColorPicker
                      label="End Nodes"
                      color={activeTheme.end}
                      onChange={(color) => updateCustomColor('end', color)}
                    />
                    <ColorPicker
                      label="Edges"
                      color={activeTheme.edge}
                      onChange={(color) => updateCustomColor('edge', color)}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button
              variant="outline"
              size="sm"
              onClick={randomizeColors}
              className="h-8"
              title="Random Theme"
            >
              <Shuffle className="h-3.5 w-3.5" />
            </Button>
            
            {/* Compact Mode Toggle */}
            <Button
              variant={compactMode ? "default" : "outline"}
              size="sm"
              onClick={() => setCompactMode(!compactMode)}
              className="h-8"
              title={compactMode ? "Switch to Detailed View" : "Switch to Compact View"}
            >
              <Layers className="h-3.5 w-3.5 mr-1" />
              {compactMode ? "Compact" : "Detailed"}
            </Button>

            {/* Animation Controls */}
            <Button
              variant={isAnimating ? "default" : "outline"}
              size="sm"
              onClick={playAnimation}
              disabled={isAnimating}
              className="h-8"
              title="Animate Flow"
            >
              {isAnimating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>

            <Button
              variant={animateEdges ? "default" : "outline"}
              size="sm"
              onClick={() => setAnimateEdges(!animateEdges)}
              className="h-8"
              title="Toggle Edge Animation"
            >
              Animate
            </Button>

            {/* Fullscreen toggle — SEPARATE from Fit to View. Fullscreen
                enlarges the entire workflow container to cover the viewport;
                Fit to View only reframes the graph within the current container. */}
            <Button
              variant={isFullscreen ? "default" : "outline"}
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8"
              title={isFullscreen ? "Exit fullscreen (Esc)" : "Open fullscreen"}
              data-testid="workflow-fullscreen-toggle"
            >
              {isFullscreen ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
            </Button>

            {/* Export Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportAsImage('png')}>
                  Export as PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAsImage('svg')}>
                  Export as SVG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Zoom & View Controls */}
            <div className="flex items-center gap-1 border-l pl-2 ml-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => reactFlowInstance.zoomIn()}
                className="h-8 w-8 p-0"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reactFlowInstance.zoomOut()}
                className="h-8 w-8 p-0"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reactFlowInstance.fitView({ padding: 0.25 })}
                className="h-8 w-8 p-0"
                title="Fit to View"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 })}
                className="h-8 w-8 p-0"
                title="Reset View"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const flowData = { nodes, edges, theme: activeTheme };
                  const blob = new Blob([JSON.stringify(flowData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  navigator.clipboard.writeText(url);
                  toast({
                    title: "Link copied!",
                    description: "Workflow share link copied to clipboard",
                  });
                }}
                className="h-8 w-8 p-0"
                title="Share Workflow"
              >
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* React Flow Canvas. Fullscreen + embedded both use flex-1 inside the
          flex-col container (parent's height drives the canvas). Standalone
          uses % calc so it subtracts the header height from its fixed
          containerHeight. */}
      <div className={(isFullscreen || embedded) ? "flex-1 min-h-0" : title ? "h-[calc(100%-72px)]" : "h-full"}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          fitView
          fitViewOptions={{
            padding: isLargeWorkflow ? 0.1 : 0.25,
            maxZoom: isLargeWorkflow ? 1 : 1.5,
            minZoom: isLargeWorkflow ? 0.1 : 0.3
          }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnScroll={true}
          minZoom={0.05}
          maxZoom={3}
          defaultViewport={{ x: 0, y: 0, zoom: isLargeWorkflow ? 0.5 : 1 }}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: animateEdges,
          }}
          onNodeClick={(event, flowNode) => {
            // Stop propagation so the outer whiteboard card doesn't also
            // re-fire its selection logic while we're just inspecting a node.
            event.stopPropagation();
            const original = nodes.find(n => n.id === flowNode.id);
            if (original) setDetailNode(original);
          }}
        >
          <Background 
            variant={'dots' as any}
            gap={24} 
            size={2} 
            color={activeTheme.edge + '20'}
            style={{ background: activeTheme.background }}
          />
          <Controls 
            showInteractive={true}
            className="bg-background/95 backdrop-blur border rounded-lg shadow-lg"
          />
          <MiniMap 
            nodeColor={(node) => {
              const nodeData = nodes.find(n => n.id === node.id);
              if (!nodeData) return activeTheme.step;
              switch (nodeData.type) {
                case 'start': return activeTheme.edge;
                case 'end': return activeTheme.end;
                case 'decision': return activeTheme.decision;
                default: return activeTheme.step;
              }
            }}
            className="bg-background/95 backdrop-blur border rounded-lg shadow-lg"
            maskColor="rgba(0,0,0,0.1)"
          />
          
          {/* Progress Indicator for Animation */}
          {isAnimating && (
            <Panel position="top-center" className="bg-background/95 backdrop-blur px-4 py-2 rounded-lg border shadow-lg">
              <div className="flex items-center gap-3">
                <Play className="h-4 w-4 text-primary animate-pulse" />
                <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${animationProgress * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium">{Math.round(animationProgress * 100)}%</span>
              </div>
            </Panel>
          )}

          {/* Discoverability hint — permanently visible so users know long
              labels/descriptions aren't lost, they're a click away. */}
          <Panel
            position="bottom-center"
            className="bg-background/90 backdrop-blur px-3 py-1.5 rounded-full border shadow-sm text-[11px] text-muted-foreground flex items-center gap-1.5"
          >
            <MousePointerClick className="h-3 w-3" />
            <span>Click any node for full details</span>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node detail dialog — shows ALL of label / description / substeps with
          no truncation. This is the escape hatch for long content that doesn't
          fit on the node face. */}
      <Dialog open={!!detailNode} onOpenChange={(open) => !open && setDetailNode(null)}>
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

export default function WorkflowRenderer(props: WorkflowRendererProps) {
  return (
    <ReactFlowProvider>
      <WorkflowRendererInner {...props} />
    </ReactFlowProvider>
  );
}
