/**
 * MindMap Visualization Types
 * Advanced interactive mindmap system for ICAI CAGPT
 */

export interface MindMapNode {
  id: string;
  label: string;
  description?: string;
  type: 'root' | 'primary' | 'secondary' | 'tertiary' | 'leaf';
  icon?: string;
  color?: string;
  metadata?: {
    importance?: 'high' | 'medium' | 'low';
    status?: 'complete' | 'in-progress' | 'pending';
    tags?: string[];
    notes?: string;
    [key: string]: any;
  };
  collapsed?: boolean;
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: 'solid' | 'dashed' | 'dotted';
  color?: string;
  weight?: number;
}

export interface MindMapData {
  type: 'mindmap';
  title: string;
  subtitle?: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  layout?: MindMapLayout;
  theme?: MindMapTheme;
  options?: MindMapOptions;
}

export type MindMapLayout = 
  | 'radial'        // Central node with branches radiating outward
  | 'tree-vertical' // Top-down hierarchical tree
  | 'tree-horizontal' // Left-to-right hierarchical tree
  | 'organic'       // Force-directed natural layout
  | 'timeline';     // Sequential timeline layout

export interface MindMapTheme {
  rootColor?: string;
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
  edgeColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
}

export interface MindMapOptions {
  expandable?: boolean;
  animated?: boolean;
  interactive?: boolean;
  showIcons?: boolean;
  showMetadata?: boolean;
  exportFormats?: ('png' | 'svg' | 'pdf' | 'json')[];
  initialZoom?: number;
  autoFit?: boolean;
}

/**
 * Mode-specific mindmap configurations
 */
export interface ModeMindmapConfig {
  mode: string;
  automaticTriggers?: string[]; // Keywords that auto-trigger mindmaps
  defaultLayout?: MindMapLayout;
  nodeIcons?: Record<string, string>;
  colorScheme?: {
    root: string;
    primary: string;
    secondary: string;
    tertiary: string;
  };
}

export const MODE_MINDMAP_CONFIGS: Record<string, ModeMindmapConfig> = {
  'deep-research': {
    mode: 'deep-research',
    automaticTriggers: ['explain', 'overview', 'structure', 'hierarchy', 'framework'],
    defaultLayout: 'radial',
    nodeIcons: {
      root: '🔬',
      primary: '📚',
      secondary: '📄',
      tertiary: '💡',
      leaf: '✓'
    },
    colorScheme: {
      root: '#8b5cf6',
      primary: '#a78bfa',
      secondary: '#c4b5fd',
      tertiary: '#e9d5ff'
    }
  },
  'calculation': {
    mode: 'calculation',
    automaticTriggers: ['steps', 'process', 'calculate', 'formula', 'breakdown'],
    defaultLayout: 'tree-vertical',
    nodeIcons: {
      root: '🧮',
      primary: '➕',
      secondary: '🔢',
      tertiary: '📊',
      leaf: '='
    },
    colorScheme: {
      root: '#eab308',
      primary: '#facc15',
      secondary: '#fde047',
      tertiary: '#fef08a'
    }
  },
  'audit-plan': {
    mode: 'audit-plan',
    automaticTriggers: ['plan', 'framework', 'procedures', 'testing', 'scope'],
    defaultLayout: 'tree-horizontal',
    nodeIcons: {
      root: '📋',
      primary: '🔍',
      secondary: '📝',
      tertiary: '✅',
      leaf: '🎯'
    },
    colorScheme: {
      root: '#f59e0b',
      primary: '#fbbf24',
      secondary: '#fcd34d',
      tertiary: '#fde68a'
    }
  },
  'workflow': {
    mode: 'workflow',
    automaticTriggers: ['process', 'workflow', 'steps', 'flow', 'sequence'],
    defaultLayout: 'tree-horizontal',
    nodeIcons: {
      root: '🔄',
      primary: '▶️',
      secondary: '⚡',
      tertiary: '🔗',
      leaf: '🏁'
    },
    colorScheme: {
      root: '#06b6d4',
      primary: '#22d3ee',
      secondary: '#67e8f9',
      tertiary: '#a5f3fc'
    }
  },
  'checklist': {
    mode: 'checklist',
    automaticTriggers: ['checklist', 'tasks', 'steps', 'requirements'],
    defaultLayout: 'tree-vertical',
    nodeIcons: {
      root: '✅',
      primary: '📌',
      secondary: '☐',
      tertiary: '→',
      leaf: '•'
    },
    colorScheme: {
      root: '#10b981',
      primary: '#34d399',
      secondary: '#6ee7b7',
      tertiary: '#a7f3d0'
    }
  },
  'scenario-simulator': {
    mode: 'scenario-simulator',
    automaticTriggers: ['scenarios', 'outcomes', 'paths', 'alternatives'],
    defaultLayout: 'organic',
    nodeIcons: {
      root: '🎯',
      primary: '🔀',
      secondary: '📈',
      tertiary: '💰',
      leaf: '🏆'
    },
    colorScheme: {
      root: '#a855f7',
      primary: '#c084fc',
      secondary: '#d8b4fe',
      tertiary: '#e9d5ff'
    }
  },
  'deliverable-composer': {
    mode: 'deliverable-composer',
    automaticTriggers: ['structure', 'outline', 'sections', 'components'],
    defaultLayout: 'tree-vertical',
    nodeIcons: {
      root: '📄',
      primary: '📝',
      secondary: '🔖',
      tertiary: '📌',
      leaf: '•'
    },
    colorScheme: {
      root: '#ec4899',
      primary: '#f472b6',
      secondary: '#f9a8d4',
      tertiary: '#fbcfe8'
    }
  },
  'forensic-intelligence': {
    mode: 'forensic-intelligence',
    automaticTriggers: ['analysis', 'patterns', 'relationships', 'investigation'],
    defaultLayout: 'organic',
    nodeIcons: {
      root: '🔍',
      primary: '🕵️',
      secondary: '🔎',
      tertiary: '📊',
      leaf: '⚠️'
    },
    colorScheme: {
      root: '#ef4444',
      primary: '#f87171',
      secondary: '#fca5a5',
      tertiary: '#fecaca'
    }
  },
  'roundtable': {
    mode: 'roundtable',
    automaticTriggers: ['perspectives', 'viewpoints', 'analysis', 'discussion'],
    defaultLayout: 'radial',
    nodeIcons: {
      root: '👥',
      primary: '💼',
      secondary: '💬',
      tertiary: '🎤',
      leaf: '💡'
    },
    colorScheme: {
      root: '#6366f1',
      primary: '#818cf8',
      secondary: '#a5b4fc',
      tertiary: '#c7d2fe'
    }
  },
  'standard': {
    mode: 'standard',
    automaticTriggers: ['explain', 'overview', 'breakdown'],
    defaultLayout: 'radial',
    nodeIcons: {
      root: '💭',
      primary: '📝',
      secondary: '🔹',
      tertiary: '•',
      leaf: '→'
    },
    colorScheme: {
      root: '#64748b',
      primary: '#94a3b8',
      secondary: '#cbd5e1',
      tertiary: '#e2e8f0'
    }
  }
};

/**
 * Helper to check if a query should trigger mindmap generation
 */
export function shouldGenerateMindmap(query: string, mode: string): boolean {
  const config = MODE_MINDMAP_CONFIGS[mode];
  if (!config) return false;
  
  const lowerQuery = query.toLowerCase();
  return config.automaticTriggers?.some(trigger => 
    lowerQuery.includes(trigger.toLowerCase())
  ) || false;
}
