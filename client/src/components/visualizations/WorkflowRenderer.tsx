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
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
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
  RotateCcw,
  MousePointerClick,
  Expand,
  Shrink,
  MoreHorizontal,
  FileJson,
} from 'lucide-react';
import ColorPicker from '@/components/ui/color-picker';
import { useToast } from '@/hooks/use-toast';
import '@xyflow/react/dist/style.css';
import {
  StartNode,
  EndNode,
  StepNode,
  DecisionNode,
  type WorkflowNodeData,
} from './workflow-nodes';

/**
 * React Flow `nodeTypes` registration. Lifting each node type out of the
 * inline-style path and into a real React component gives us JSX control —
 * the previous `type: 'default'` + per-node `style={{...}}` approach was
 * what kept us from matching the variant-B mockup (default nodes add a
 * wrapper + baseline CSS we were fighting). Defined at module scope so
 * React Flow doesn't re-create the type map on every render.
 */
const nodeTypes = {
  start: StartNode,
  end: EndNode,
  step: StepNode,
  decision: DecisionNode,
};

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

// Rank/node separation values tuned for the variant-B card heights
// (~60-80px). The old values assumed 130px cards and left huge whitespace
// gaps between ranks.
const layoutAlgorithms = {
  'dagre-tb': { rankdir: 'TB', ranksep: 90, nodesep: 80 },
  'dagre-lr': { rankdir: 'LR', ranksep: 140, nodesep: 70 },
  'swimlane': { rankdir: 'TB', ranksep: 90, nodesep: 80 },
  'hierarchical': { rankdir: 'TB', ranksep: 110, nodesep: 90 },
  'radial': { rankdir: 'TB', ranksep: 100, nodesep: 90 },
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
    // Position only — no style.width/height override. Custom node components
    // (StartNode / EndNode / StepNode / DecisionNode) own their rendered size,
    // which React Flow measures post-render for edge routing.
    return {
      ...node,
      position: {
        x: Math.round(nodeWithPosition.x - nWidth / 2),
        y: Math.round(nodeWithPosition.y - nHeight / 2),
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// A theme resolved for the current light/dark mode. All per-node visual
// decisions (gradient fills, text color, border, shadow, canvas, dot color)
// are pre-computed ONCE per (theme × mode) change — `getNodeStyle` just looks
// values up, so every dark-mode fix flows from a single function instead of
// scattered per-call luminance math and `isDark` branches.
interface ResolvedTheme {
  startBg: string;
  endBg: string;
  decisionBg: string;
  stepBg: string;
  stepText: string;
  stepBorder: string;
  stepShadow: string;
  edge: string;
  canvasBackground: string;
  dotColor: string;
}

function resolveTheme(theme: ColorTheme, isDark: boolean): ResolvedTheme {
  // The variant-B redesign makes step nodes Aurora-token-based cards
  // (hsl(var(--card)) with hsl(var(--border-strong)) outline). These are kept
  // here only for the MiniMap's colour callback and the legacy theme dropdown
  // — getNodeStyle no longer uses the stepBg / stepText / stepBorder /
  // stepShadow / startBg / endBg / decisionBg fields. Keeping them typed so
  // the signature stays stable.
  const stepFirstHex = theme.step.match(/#[0-9a-fA-F]{6}/)?.[0] ?? '#e0e7ff';
  const stepIsLight = hexLuminance(stepFirstHex) > 0.55;

  // Canvas + dot colour. In light mode, the app's --background is pure white
  // and --card is only ~2% off, so cards on canvas have near-zero visible
  // separation. Fix: light-mode canvas uses --muted (slate-100-ish) so white
  // cards pop against it. Dark mode keeps --background (near-black) since
  // --card is already a step lighter.
  const canvasBackground = isDark
    ? 'hsl(var(--background))'
    : 'hsl(var(--muted))';
  const dotColor = isDark
    ? 'rgba(255,255,255,0.06)'
    : 'rgba(15,23,42,0.08)';

  if (!isDark) {
    return {
      startBg: theme.start,
      endBg: theme.end,
      decisionBg: theme.decision,
      stepBg: theme.step,
      stepText: stepIsLight ? '#0f172a' : '#ffffff',
      stepBorder: stepIsLight
        ? '1px solid rgba(15,23,42,0.08)'
        : 'none',
      stepShadow: stepIsLight ? 'none' : '0 2px 8px rgba(0,0,0,0.3)',
      edge: theme.edge,
      canvasBackground,
      dotColor,
    };
  }

  const darkStepBg = theme.step.replace(/#[0-9a-fA-F]{6}/g, (hex) =>
    blendHex(hex, '#1a1b1f', 0.25)
  );
  return {
    startBg: theme.start,
    endBg: theme.end,
    decisionBg: theme.decision,
    stepBg: darkStepBg,
    stepText: '#ffffff',
    stepBorder: '1px solid rgba(255,255,255,0.08)',
    stepShadow: '0 2px 8px rgba(0,0,0,0.6)',
    edge: theme.edge,
    canvasBackground,
    dotColor,
  };
}

// NOTE: getNodeStyle was removed when we moved to proper React Flow
// `nodeTypes`. Each node type is now a dedicated component under
// ./workflow-nodes/ that owns its DOM + styling. Look there to change how a
// specific node type renders.

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

// Linear blend of two #RRGGBB hex colors. `ratio` is the weight of `hex`
// (0 = all target, 1 = all hex). Produces a standard `#rrggbb` so every
// browser parses the resulting gradient without relying on CSS `color-mix`.
function blendHex(hex: string, targetHex: string, ratio: number): string {
  const parse = (h: string): [number, number, number] => {
    const m = /^#([0-9a-fA-F]{6})$/.exec(h);
    if (!m) return [0, 0, 0];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = parse(hex);
  const [r2, g2, b2] = parse(targetHex);
  const mix = (a: number, b: number) =>
    Math.max(0, Math.min(255, Math.round(a * ratio + b * (1 - ratio))));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r1, r2))}${toHex(mix(g1, g2))}${toHex(mix(b1, b2))}`;
}

function WorkflowRendererInner({ nodes: nodesInput, edges: edgesInput, title, layout = 'dagre-tb', embedded = false }: WorkflowRendererProps) {
  // Payloads from failed/in-flight server generations can arrive with
  // nodes/edges missing entirely. Defend the first `.length` access on line
  // below — otherwise WorkflowRenderer blows up on mount and takes the whole
  // chat view with it via the error boundary.
  const nodes = Array.isArray(nodesInput) ? nodesInput : [];
  const edges = Array.isArray(edgesInput) ? edgesInput : [];

  // Pick the default theme based on the current light/dark mode so dark-mode
  // users don't land on the bright "CA GPT Classic" palette (near-white step
  // cells that clash with the dark canvas). Still user-overridable via the
  // theme dropdown afterwards.
  const [selectedTheme, setSelectedTheme] = useState<ColorTheme>(() => {
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
      return colorThemes.find(t => t.name === "Midnight Professional") ?? colorThemes[0];
    }
    return colorThemes[0];
  });

  // Track dark-mode state as React state so the node-rebuild useEffect fires
  // when the user toggles the theme toggle. Without this, flipping dark mode
  // while a non-paired theme (e.g. Royal Purple) is selected leaves the
  // node styles frozen with light-mode colors — getNodeStyle only runs inside
  // the rebuild effect, and that effect's deps don't otherwise include `.dark`.
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  // Follow live theme toggles + catch the initial state. The useState
  // initializer above reads `.dark` at render time — too early if the app
  // applies dark mode from a parent useEffect (which fires AFTER our render
  // but before our own effects). So we also run a check once on mount here,
  // and subscribe a MutationObserver for subsequent toggles. Only auto-flips
  // between the two "paired" themes (CA GPT Classic ↔ Midnight Professional);
  // any other manual theme choice is preserved.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncTheme = () => {
      const nextIsDark = document.documentElement.classList.contains("dark");
      setIsDark(nextIsDark);
      setSelectedTheme(prev => {
        if (prev.name === "CA GPT Classic" && nextIsDark) {
          return colorThemes.find(t => t.name === "Midnight Professional") ?? prev;
        }
        if (prev.name === "Midnight Professional" && !nextIsDark) {
          return colorThemes[0];
        }
        return prev;
      });
    };
    // Catch the initial state — parent effects may have added .dark after our
    // useState initializer already ran.
    syncTheme();
    const obs = new MutationObserver(syncTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
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

  // Single source of truth for every dark-mode decision. `resolveTheme` folds
  // theme + isDark into pre-computed fills, text colors, borders, canvas,
  // and dot alpha — so every visual layer derives from one memoized object
  // instead of ad-hoc `isDark ? x : y` checks scattered through the tree.
  const resolved = useMemo(() => resolveTheme(activeTheme, isDark), [activeTheme, isDark]);

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
  const createThemedNodes = (_resolved: ResolvedTheme): Node[] => {
    // With proper React Flow nodeTypes, each node type is a real component
    // that owns its own DOM + styling. We just hand the components their
    // data + a few presentation flags. No inline `style` prop, no wrapper
    // div CSS fighting, no getNodeStyle dispatch.
    return nodes.map((node, idx) => {
      const isHighlighted =
        isAnimating &&
        animationProgress >= idx / nodes.length &&
        animationProgress < (idx + 1) / nodes.length + 0.1;
      const matchesSearch =
        !!searchTerm && node.label.toLowerCase().includes(searchTerm.toLowerCase());

      const tooltip = [
        node.label,
        node.description ? `\n\n${node.description}` : '',
        node.substeps && node.substeps.length > 0
          ? `\n\nSteps:\n${node.substeps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
          : '',
      ].join('');

      const isLabelLong = (node.label?.length ?? 0) > (compactMode ? 40 : 90);
      const isDescLong = (node.description?.length ?? 0) > 80;
      const hasHiddenSubsteps = (node.substeps?.length ?? 0) > 3;
      const hasLongSubstep = (node.substeps ?? []).some((s) => (s?.length ?? 0) > 60);
      const contentClipped = isLabelLong || isDescLong || hasHiddenSubsteps || hasLongSubstep;

      const data: WorkflowNodeData = {
        label: node.label,
        description: node.description,
        substeps: node.substeps,
        highlighted: isHighlighted,
        matchesSearch,
        contentClipped,
        tooltip,
        compact: compactMode,
      };

      return {
        id: node.id,
        type: node.type,
        data: data as unknown as Record<string, unknown>,
        position: { x: 0, y: idx * 150 },
        zIndex: isHighlighted ? 30 : matchesSearch ? 20 : 10,
      } as Node;
    });
  };

  const createThemedEdges = (_resolved: ResolvedTheme): Edge[] => {
    // Variant B: hairline edges. 1.5px stroke, translucent white dim / teal
    // active, no pill behind the label — just colored teal text inline.
    const dimStroke = 'rgba(255,255,255,0.25)';
    const activeStroke = 'rgba(20,184,166,0.75)';
    return edges.map((edge, idx) => {
      const isActive = isAnimating && animationProgress >= (idx / edges.length);
      const stroke = isActive ? activeStroke : dimStroke;

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: 'smoothstep',
        animated: animateEdges || isActive,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: isActive ? activeStroke : 'rgba(255,255,255,0.45)',
        },
        style: {
          strokeWidth: 1.5,
          stroke,
          strokeDasharray: animateEdges ? '6,4' : '0',
          transition: 'all 0.3s ease',
        },
        labelStyle: {
          fill: '#5eead4',
          fontSize: 11,
          fontFamily: 'JetBrains Mono',
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: 'transparent',
        },
        labelBgPadding: [0, 0] as [number, number],
        zIndex: isActive ? 15 : 5,
      };
    });
  };
  
  // Get dimensions based on compact mode and node count
  const nodeDims = getNodeDimensions(compactMode, nodes.length);

  const initialNodes = createThemedNodes(resolved);
  const initialEdges = createThemedEdges(resolved);

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
    const newNodes = createThemedNodes(resolved);
    const newEdges = createThemedEdges(resolved);
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
  }, [nodes, edges, resolved, animateEdges, currentLayout, isAnimating, animationProgress, searchTerm, compactMode]);

  // Dynamic height based on workflow size. Tuned for the variant-B card
  // heights (~60-80px) + the tightened ranksep. 110px per node gives enough
  // room without leaving huge vertical gaps that forced fitView to zoom out.
  const containerHeight = Math.max(480, Math.min(1800, nodes.length * 110 + 80));

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

  const containerClass = isFullscreen
    ? "fixed inset-0 z-50 w-screen h-screen rounded-none border-0 shadow-none flex flex-col"
    : embedded
      ? "w-full h-full flex flex-col overflow-hidden"
      : "w-full border rounded-xl overflow-hidden shadow-2xl";
  // Height behaviour:
  //   fullscreen → absolute, no explicit height
  //   embedded   → fill parent (h-full from class). Parent is either
  //     InlineArtifactCard in chat (no explicit height) or the whiteboard's
  //     ArtifactCard (flex-1 inside a flex-col with minHeight: artifact.height).
  //     We set a minHeight floor so chat doesn't collapse to content, and no
  //     forced height so whiteboard's card geometry wins.
  //   standalone (old embed paths, never used) → the previous fixed height.
  const containerStyle: React.CSSProperties = isFullscreen
    ? { background: resolved.canvasBackground }
    : embedded
      ? { background: resolved.canvasBackground, minHeight: 420 }
      : { background: resolved.canvasBackground, height: containerHeight };

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

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
              <Input
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-8 w-36 pl-8 text-xs"
              />
            </div>

            {/* Layout */}
            <Select value={currentLayout} onValueChange={setCurrentLayout}>
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

            <div className="h-5 w-px bg-border mx-1" aria-hidden />

            {/* Zoom cluster */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => reactFlowInstance.zoomOut()}
              className="h-8 w-8 p-0 rounded-md hover:bg-foreground/5 text-muted-foreground"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => reactFlowInstance.zoomIn()}
              className="h-8 w-8 p-0 rounded-md hover:bg-foreground/5 text-muted-foreground"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => reactFlowInstance.fitView({ padding: 0.25 })}
              className="h-8 w-8 p-0 rounded-md hover:bg-foreground/5 text-muted-foreground"
              title="Fit to view"
            >
              <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>

            <div className="h-5 w-px bg-border mx-1" aria-hidden />

            {/* Download (PNG/SVG) */}
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
                <DropdownMenuItem onClick={() => exportAsImage('png')}>
                  Export as PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAsImage('svg')}>
                  Export as SVG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Fullscreen (mode, not action — stays separate) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 p-0 rounded-md hover:bg-foreground/5 text-muted-foreground"
              title={isFullscreen ? "Exit fullscreen (Esc)" : "Open fullscreen"}
              data-testid="workflow-fullscreen-toggle"
            >
              {isFullscreen
                ? <Shrink className="h-3.5 w-3.5" strokeWidth={1.75} />
                : <Expand className="h-3.5 w-3.5" strokeWidth={1.75} />}
            </Button>

            {/* Overflow menu */}
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
                <DropdownMenuItem onClick={() => reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 })}>
                  <RotateCcw className="h-3.5 w-3.5 mr-2" strokeWidth={1.75} />
                  Reset view
                </DropdownMenuItem>
                <DropdownMenuItem onClick={randomizeColors}>
                  <Shuffle className="h-3.5 w-3.5 mr-2" strokeWidth={1.75} />
                  Randomize theme
                </DropdownMenuItem>
                <Popover>
                  <PopoverTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Palette className="h-3.5 w-3.5 mr-2" strokeWidth={1.75} />
                      Custom colors…
                    </DropdownMenuItem>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" side="left" align="start">
                    <div className="space-y-4">
                      <h4 className="font-medium">Customize Colors</h4>
                      <div className="space-y-3">
                        <ColorPicker label="Start Nodes" color={activeTheme.start} onChange={(color) => updateCustomColor('start', color)} />
                        <ColorPicker label="Step Nodes" color={activeTheme.step} onChange={(color) => updateCustomColor('step', color)} />
                        <ColorPicker label="Decision Nodes" color={activeTheme.decision} onChange={(color) => updateCustomColor('decision', color)} />
                        <ColorPicker label="End Nodes" color={activeTheme.end} onChange={(color) => updateCustomColor('end', color)} />
                        <ColorPicker label="Edges" color={activeTheme.edge} onChange={(color) => updateCustomColor('edge', color)} />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  Theme
                </DropdownMenuLabel>
                {colorThemes.map((theme) => (
                  <DropdownMenuCheckboxItem
                    key={theme.name}
                    checked={!customTheme && selectedTheme.name === theme.name}
                    onCheckedChange={() => {
                      setSelectedTheme(theme);
                      setCustomTheme(null);
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full border mr-2 shrink-0"
                      style={{ background: theme.start }}
                    />
                    {theme.name}
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={compactMode}
                  onCheckedChange={(v) => setCompactMode(!!v)}
                >
                  Compact layout
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={animateEdges}
                  onCheckedChange={(v) => setAnimateEdges(!!v)}
                >
                  Animate edges
                </DropdownMenuCheckboxItem>
                <DropdownMenuItem
                  disabled={isAnimating}
                  onClick={playAnimation}
                >
                  <Play className="h-3.5 w-3.5 mr-2" strokeWidth={1.75} />
                  Play animation
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem
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
                >
                  <Share2 className="h-3.5 w-3.5 mr-2" strokeWidth={1.75} />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const flowData = { nodes, edges, theme: activeTheme };
                    navigator.clipboard.writeText(JSON.stringify(flowData, null, 2));
                    toast({
                      title: "Copied JSON",
                      description: "Workflow JSON copied to clipboard",
                    });
                  }}
                >
                  <FileJson className="h-3.5 w-3.5 mr-2" strokeWidth={1.75} />
                  Copy as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* React Flow Canvas. In fullscreen the container is flex-col with an
          unbounded height, so we use flex-1 instead of a % calc. */}
      <div className={isFullscreen ? "flex-1 min-h-0" : title ? "h-[calc(100%-72px)]" : "h-full"}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{
            padding: isLargeWorkflow ? 0.1 : 0.25,
            maxZoom: isLargeWorkflow ? 1 : 1.4,
            minZoom: isLargeWorkflow ? 0.2 : 0.5
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
            color={resolved.dotColor}
            style={{ background: resolved.canvasBackground }}
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
