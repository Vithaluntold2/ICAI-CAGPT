/**
 * MindMap Generation Service
 * AI-powered mindmap generation for all professional modes
 */

import type {
  MindMapData,
  MindMapNode,
  MindMapEdge,
  MindMapLayout,
} from '../../shared/types/mindmap';
import { MODE_MINDMAP_CONFIGS, shouldGenerateMindmap } from '../../shared/types/mindmap';

export class MindMapGenerator {
  // Expose config for testing
  static MODE_MINDMAP_CONFIGS = MODE_MINDMAP_CONFIGS;

  /**
   * Generate mindmap prompt instruction for AI
   */
  static getMindMapGenerationPrompt(chatMode: string, query: string): string {
    const config = MODE_MINDMAP_CONFIGS[chatMode] || MODE_MINDMAP_CONFIGS['standard'];
    
    return `
## 🧠 MINDMAP GENERATION REQUESTED

The user has requested a mindmap visualization. Generate a comprehensive mindmap structure.

### Mindmap Format Requirements:
Generate the mindmap using this EXACT JSON structure at the END of your response:

\`\`\`json
{
  "type": "mindmap",
  "title": "Concise Title (3-7 words)",
  "subtitle": "Brief description",
  "layout": "${config.defaultLayout}",
  "nodes": [
    {
      "id": "root",
      "label": "Central Concept",
      "description": "Brief explanation",
      "type": "root",
      "icon": "${config.nodeIcons?.root || '💭'}"
    },
    {
      "id": "node-1",
      "label": "Main Branch 1",
      "description": "Details",
      "type": "primary",
      "icon": "${config.nodeIcons?.primary || '📝'}"
    },
    {
      "id": "node-2",
      "label": "Main Branch 2",
      "type": "primary",
      "icon": "${config.nodeIcons?.primary || '📝'}"
    },
    {
      "id": "node-1-1",
      "label": "Sub-topic 1.1",
      "type": "secondary",
      "icon": "${config.nodeIcons?.secondary || '🔹'}"
    },
    {
      "id": "node-1-1-1",
      "label": "Detail",
      "type": "tertiary",
      "icon": "${config.nodeIcons?.tertiary || '•'}"
    }
  ],
  "edges": [
    { "id": "e1", "source": "root", "target": "node-1" },
    { "id": "e2", "source": "root", "target": "node-2" },
    { "id": "e3", "source": "node-1", "target": "node-1-1" },
    { "id": "e4", "source": "node-1-1", "target": "node-1-1-1" }
  ]
}
\`\`\`

### Mode-Specific Guidelines for ${chatMode}:

${this.getModeSpecificGuidelines(chatMode)}

### Mindmap Quality Standards:
1. **Hierarchy**: 3-5 levels deep (root → primary → secondary → tertiary → leaf)
2. **Breadth**: 3-7 main branches from root
3. **Balance**: Roughly equal nodes per main branch
4. **Clarity**: Short labels (2-5 words), concise descriptions
5. **Relevance**: Every node directly supports the topic
6. **Completeness**: Cover all major aspects of the topic

### Node Types & Their Roles:
- **root**: Central concept (1 node)
- **primary**: Main categories/themes (3-7 nodes)
- **secondary**: Sub-topics/components (2-5 per primary)
- **tertiary**: Details/specifics (1-4 per secondary)
- **leaf**: Final details/examples (optional)

Place the mindmap JSON at the VERY END of your response after your text explanation.
`;
  }

  /**
   * Get mode-specific mindmap generation guidelines
   */
  private static getModeSpecificGuidelines(mode: string): string {
    const guidelines: Record<string, string> = {
      'deep-research': `
- Root: Research Question/Topic
- Primary: Key Research Areas (legal, regulatory, practical, international)
- Secondary: Specific Sources (statutes, regulations, case law, guidance)
- Tertiary: Key Findings/Citations
- Include jurisdiction labels where relevant
`,
      'calculation': `
- Root: Calculation Objective
- Primary: Major Calculation Steps
- Secondary: Sub-calculations/Formulas
- Tertiary: Input Variables/Constants
- Leaf: Specific Values/References
- Show mathematical relationships clearly
`,
      'audit-plan': `
- Root: Audit Engagement
- Primary: Audit Areas (controls, transactions, balances, disclosures)
- Secondary: Specific Procedures
- Tertiary: Testing Methods/Evidence
- Leaf: Documentation Requirements
- Highlight risk levels (high/medium/low)
`,
      'workflow': `
- Root: Process Name
- Primary: Major Phases
- Secondary: Key Steps
- Tertiary: Actions/Decisions
- Leaf: Outputs/Checkpoints
- Show sequential flow clearly
`,
      'checklist': `
- Root: Checklist Purpose
- Primary: Major Categories
- Secondary: Task Groups
- Tertiary: Individual Tasks
- Leaf: Sub-tasks/Notes
- Include priority indicators
`,
      'scenario-simulator': `
- Root: Base Scenario
- Primary: Key Variables/Assumptions
- Secondary: Possible Outcomes
- Tertiary: Impact Analysis
- Leaf: Specific Metrics
- Show probability or likelihood where relevant
`,
      'deliverable-composer': `
- Root: Document Type
- Primary: Major Sections
- Secondary: Subsections
- Tertiary: Key Content Points
- Leaf: Supporting Details
- Follow standard document structure
`,
      'forensic-intelligence': `
- Root: Investigation Focus
- Primary: Analysis Dimensions (patterns, anomalies, relationships)
- Secondary: Specific Findings
- Tertiary: Evidence/Indicators
- Leaf: Data Sources
- Highlight red flags
`,
      'roundtable': `
- Root: Discussion Topic
- Primary: Expert Perspectives (CPA, Tax Attorney, CFO, etc.)
- Secondary: Key Arguments/Positions
- Tertiary: Supporting Points
- Leaf: Examples/Case Studies
- Show agreement/disagreement
`,
    };

    return guidelines[mode] || guidelines['deep-research'];
  }

  /**
   * Check if query should trigger mindmap generation
   */
  static shouldGenerateMindmap(query: string, mode: string): boolean {
    return shouldGenerateMindmap(query, mode);
  }

  /**
   * Extract mindmap JSON from AI response - ROBUST with multiple strategies
   */
  static extractMindMapFromResponse(response: string): MindMapData | null {
    try {
      // Strategy 1: Standard JSON code block with explicit type="mindmap"
      const strategy1 = response.match(/```json\s*({[\s\S]*?"type"\s*:\s*["']mindmap["'][\s\S]*?})\s*```/);
      
      if (strategy1) {
        try {
          const data = JSON.parse(strategy1[1]);
          if (this.isValidMindmapStructure(data)) {
            console.log('[MindMapGenerator] Extracted via Strategy 1 (explicit type)');
            return data as MindMapData;
          }
        } catch (e) {
          console.warn('[MindMapGenerator] Strategy 1 parse failed:', e);
        }
      }

      // Strategy 2: Any JSON block with mindmap structure (no type check)
      const jsonBlocksRegex = /```(?:json)?\s*({[\s\S]*?})\s*```/g;
      let blockMatch;
      
      while ((blockMatch = jsonBlocksRegex.exec(response)) !== null) {
        try {
          const data = JSON.parse(blockMatch[1]);
          // Check if it has mindmap structure even without explicit type
          if (data.nodes && data.edges && data.title) {
            data.type = 'mindmap'; // Force the type
            if (this.isValidMindmapStructure(data)) {
              console.log('[MindMapGenerator] Extracted via Strategy 2 (structure match)');
              return data as MindMapData;
            }
          }
        } catch (e) {
          // Try next block
          continue;
        }
      }

      // Strategy 3: Find raw JSON object in response (last resort)
      const rawJsonMatch = response.match(/{\s*["']type["']\s*:\s*["']mindmap["'][\s\S]*?["']nodes["']\s*:\s*\[[\s\S]*?\][\s\S]*?["']edges["']\s*:\s*\[[\s\S]*?\]\s*}/m);
      
      if (rawJsonMatch) {
        try {
          const data = JSON.parse(rawJsonMatch[0]);
          if (this.isValidMindmapStructure(data)) {
            console.log('[MindMapGenerator] Extracted via Strategy 3 (raw JSON)');
            return data as MindMapData;
          }
        } catch (e) {
          console.warn('[MindMapGenerator] Strategy 3 parse failed:', e);
        }
      }
      
      console.log('[MindMapGenerator] No valid mindmap found in response');
      return null;
    } catch (error) {
      console.error('[MindMapGenerator] Extraction failed:', error);
      return null;
    }
  }

  /**
   * Check if object has valid mindmap structure
   */
  private static isValidMindmapStructure(data: unknown): data is MindMapData {
    if (data === null || typeof data !== 'object') {
      return false;
    }
    const obj = data as Record<string, unknown>;
    return (
      'nodes' in obj &&
      'edges' in obj &&
      'title' in obj &&
      Array.isArray(obj.nodes) &&
      Array.isArray(obj.edges) &&
      obj.nodes.length > 0 &&
      typeof obj.title === 'string'
    );
  }

  /**
   * Validate mindmap data structure
   */
  static validateMindMap(data: MindMapData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!data.title) errors.push('Missing title');
    if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
      errors.push('Missing or empty nodes array');
    }
    if (!Array.isArray(data.edges)) {
      errors.push('Missing edges array');
    }

    // Check for root node
    const hasRoot = data.nodes.some(n => n.type === 'root');
    if (!hasRoot) errors.push('Missing root node');

    // Validate node IDs are unique
    const nodeIds = data.nodes.map(n => n.id);
    const uniqueIds = new Set(nodeIds);
    if (nodeIds.length !== uniqueIds.size) {
      errors.push('Duplicate node IDs found');
    }

    // Validate edges reference existing nodes
    const nodeIdSet = new Set(nodeIds);
    data.edges.forEach((edge, i) => {
      if (!nodeIdSet.has(edge.source)) {
        errors.push(`Edge ${i}: source node "${edge.source}" not found`);
      }
      if (!nodeIdSet.has(edge.target)) {
        errors.push(`Edge ${i}: target node "${edge.target}" not found`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate example mindmap for testing
   */
  static generateExample(mode: string): MindMapData {
    const config = MODE_MINDMAP_CONFIGS[mode] || MODE_MINDMAP_CONFIGS['standard'];
    
    return {
      type: 'mindmap',
      title: 'Example Mindmap',
      subtitle: `Generated for ${mode} mode`,
      layout: config.defaultLayout,
      nodes: [
        {
          id: 'root',
          label: 'Central Topic',
          description: 'Main focus area',
          type: 'root',
          icon: config.nodeIcons?.root,
        },
        {
          id: 'branch-1',
          label: 'First Branch',
          type: 'primary',
          icon: config.nodeIcons?.primary,
        },
        {
          id: 'branch-2',
          label: 'Second Branch',
          type: 'primary',
          icon: config.nodeIcons?.primary,
        },
        {
          id: 'detail-1-1',
          label: 'Sub-topic 1.1',
          type: 'secondary',
          icon: config.nodeIcons?.secondary,
        },
        {
          id: 'detail-1-2',
          label: 'Sub-topic 1.2',
          type: 'secondary',
          icon: config.nodeIcons?.secondary,
        },
      ],
      edges: [
        { id: 'e1', source: 'root', target: 'branch-1' },
        { id: 'e2', source: 'root', target: 'branch-2' },
        { id: 'e3', source: 'branch-1', target: 'detail-1-1' },
        { id: 'e4', source: 'branch-1', target: 'detail-1-2' },
      ],
      options: {
        animated: true,
        interactive: true,
        expandable: true,
        showIcons: true,
      },
    };
  }
}
