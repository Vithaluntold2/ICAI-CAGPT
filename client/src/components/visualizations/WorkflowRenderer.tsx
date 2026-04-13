import { useCallback, useEffect, useState, useMemo } from 'react';
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
  RotateCcw
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
    name: 'Midnight Professional',
    start: 'linear-gradient(135deg, #3C96EE 0%, #764ba2 100%)',
    step: 'linear-gradient(135deg, #e0e7ff 0%, #cffafe 100%)',
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

// Dynamic node dimensions based on compact mode
const getNodeDimensions = (compact: boolean, nodeCount: number) => {
  if (compact || nodeCount > 30) {
    return { width: 180, height: 60 };
  } else if (nodeCount > 20) {
    return { width: 220, height: 80 };
  }
  return { width: 280, height: 100 };
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
      return {
        ...baseStyle,
        ...hoverTransform,
        background: backgroundColor,
        color: '#1e293b',
        textShadow: 'none',
      };
  }
};

function WorkflowRendererInner({ nodes, edges, title, layout = 'dagre-tb' }: WorkflowRendererProps) {
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
    
    const { getNodes } = reactFlowInstance;
    const nodesBounds = getNodes().reduce((bounds, node) => {
      return {
        minX: Math.min(bounds.minX, node.position.x),
        minY: Math.min(bounds.minY, node.position.y),
        maxX: Math.max(bounds.maxX, node.position.x + (node.width || nodeWidth)),
        maxY: Math.max(bounds.maxY, node.position.y + (node.height || nodeHeight)),
      };
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

    const width = nodesBounds.maxX - nodesBounds.minX + 100;
    const height = nodesBounds.maxY - nodesBounds.minY + 100;

    toast({
      title: "Exporting workflow",
      description: `Generating ${format.toUpperCase()} image...`
    });
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
      
      return {
        id: node.id,
        type: 'default',
        data: { 
          label: compactMode ? (
            // Compact mode: just show the title, truncated
            <div className="flex items-center justify-center h-full" style={{ zIndex: 10 }}>
              <div className={`font-semibold text-xs leading-tight text-center ${isHighlighted ? 'animate-pulse' : ''} ${matchesSearch ? 'underline' : ''}`}
                   style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: dims.width - 20 }}>
                {node.label.length > 35 ? node.label.substring(0, 32) + '...' : node.label}
              </div>
            </div>
          ) : (
            // Detailed mode: full content
            <div className="flex flex-col gap-2" style={{ lineHeight: '1.5', zIndex: 10 }}>
              <div className={`font-bold text-base leading-tight ${isHighlighted ? 'animate-pulse' : ''} ${matchesSearch ? 'underline' : ''}`}>
                {node.label}
              </div>
              {node.description && (
                <div className="text-xs opacity-95 leading-snug">{node.description}</div>
              )}
              {node.substeps && node.substeps.length > 0 && (
                <div className="text-xs text-left mt-2 space-y-1 leading-tight">
                  {node.substeps.map((step, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="mt-0.5">•</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

  return (
    <div className="w-full border rounded-xl overflow-hidden shadow-2xl" style={{ background: activeTheme.background, height: containerHeight }}>
      {/* Enhanced Header */}
      {title && (
        <div className="px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">{title}</h3>
              <p className="text-xs text-muted-foreground">{nodes.length} steps • {edges.length} connections{isLargeWorkflow ? ' • Large workflow' : ''}</p>
            </div>
          </div>
          
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

      {/* React Flow Canvas */}
      <div className={title ? "h-[calc(100%-72px)]" : "h-full"}>
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
        </ReactFlow>
      </div>
    </div>
  );
}

export default function WorkflowRenderer(props: WorkflowRendererProps) {
  return (
    <ReactFlowProvider>
      <WorkflowRendererInner {...props} />
    </ReactFlowProvider>
  );
}
