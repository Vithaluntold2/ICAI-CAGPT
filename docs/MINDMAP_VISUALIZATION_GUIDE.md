# 🧠 MindMap Visualization System

## Overview

ICAI CAGPT features an AI-powered mindmap visualization system that automatically generates interactive, hierarchical mindmaps for complex topics across all professional modes. This system rivals and exceeds competitors like VisualMind by providing:

- **Automatic trigger detection** - Generates mindmaps when queries include keywords like "explain", "overview", "structure", "steps"
- **Mode-specific configurations** - Each professional mode has customized icons, colors, and layouts
- **5 layout algorithms** - Radial, tree-vertical, tree-horizontal, organic, and timeline
- **Interactive features** - Zoom, pan, expand/collapse, export to JSON/PNG/SVG
- **Professional polish** - Glassmorphic design, smooth animations, accessibility support

## Architecture

### Component Hierarchy

```
Query → AI Orchestrator
         ↓
    shouldGenerateMindmap() check
         ↓
    AI generates mindmap JSON with prompt enhancement
         ↓
    extractMindMapFromResponse()
         ↓
    validateMindMap()
         ↓
    Store in messages.metadata.visualization
         ↓
    VisualizationRenderer
         ↓
    MindMapRenderer (React + ReactFlow)
```

### Key Files

1. **`shared/types/mindmap.ts`** - Type system and configuration
   - `MindMapNode`, `MindMapEdge`, `MindMapData` types
   - `MODE_MINDMAP_CONFIGS` with mode-specific settings
   - `shouldGenerateMindmap()` trigger detection

2. **`server/services/mindmapGenerator.ts`** - AI generation service
   - `getMindMapGenerationPrompt()` - Mode-specific prompt instructions
   - `extractMindMapFromResponse()` - Parse AI response for JSON
   - `validateMindMap()` - Structure validation
   - `generateExample()` - Test data generator

3. **`server/services/promptBuilder.ts`** - Prompt injection
   - Automatically adds mindmap generation instructions when triggered
   - Mode-specific formatting guidelines

4. **`server/services/aiOrchestrator.ts`** - Orchestration logic
   - Checks for mindmap trigger
   - Extracts and validates mindmap data
   - Stores in metadata for frontend rendering

5. **`client/src/components/visualizations/MindMapRenderer.tsx`** - React component
   - Custom animated node component
   - 5 layout algorithms (radial BFS, dagre trees, organic, timeline)
   - Interactive controls (zoom, pan, fit, export)
   - Glassmorphic styling with mode-specific colors

6. **`client/src/components/visualizations/VisualizationRenderer.tsx`** - Router
   - Routes visualization data to appropriate renderer
   - Handles `type: 'mindmap'` case

## Mindmap Trigger Keywords

The system automatically generates mindmaps when queries contain:

### General Triggers (All Modes)
- explain
- overview
- structure
- breakdown
- steps
- process
- phases
- components
- hierarchy
- framework

### Mode-Specific Triggers

#### Deep Research Mode 🔬
- research areas
- regulatory landscape
- legal framework
- jurisdictions
- compliance requirements

#### Calculation Mode 🧮
- step by step
- formula
- calculation breakdown
- compute
- solve

#### Audit Plan Mode 📋
- audit procedures
- testing phases
- control points
- risk areas
- audit approach

#### Workflow Mode ⚙️
- workflow
- sequence
- flow chart
- decision tree
- process map

#### Checklist Mode ✅
- checklist items
- task list
- requirements
- deliverables
- action items

#### Scenario Simulator Mode 🎯
- scenarios
- outcomes
- possibilities
- alternatives
- what if

#### Deliverable Composer Mode 📄
- document structure
- sections
- outline
- report template
- format

#### Forensic Intelligence Mode 🔍
- analysis dimensions
- investigation areas
- data patterns
- anomaly types
- evidence chains

#### Roundtable Mode 💭
- perspectives
- expert opinions
- viewpoints
- arguments
- positions

## Mindmap Data Structure

### JSON Format

```json
{
  "type": "mindmap",
  "title": "Concise Title (3-7 words)",
  "subtitle": "Brief description",
  "layout": "radial",
  "nodes": [
    {
      "id": "root",
      "label": "Central Concept",
      "description": "Brief explanation",
      "type": "root",
      "icon": "💭"
    },
    {
      "id": "node-1",
      "label": "Main Branch 1",
      "description": "Details",
      "type": "primary",
      "icon": "📝"
    },
    {
      "id": "node-1-1",
      "label": "Sub-topic 1.1",
      "type": "secondary",
      "icon": "🔹"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "root",
      "target": "node-1"
    },
    {
      "id": "e2",
      "source": "node-1",
      "target": "node-1-1"
    }
  ],
  "options": {
    "animated": true,
    "interactive": true,
    "expandable": true,
    "showIcons": true
  }
}
```

### Node Types

| Type | Purpose | Typical Icon | Color |
|------|---------|--------------|-------|
| `root` | Central concept (1 node) | 💭 🎯 📊 | Primary theme color |
| `primary` | Main categories (3-7 nodes) | 📝 📚 ⚖️ | Theme color (lighter) |
| `secondary` | Sub-topics (2-5 per primary) | 🔹 📌 🔸 | Theme color (lighter) |
| `tertiary` | Details (1-4 per secondary) | • ◦ ▫ | Neutral color |
| `leaf` | Final details/examples | ▪ ▫ | Subtle color |

### Layout Types

1. **Radial** (`radial`) - Central node with radiating branches
   - Best for: Showing relationships to central concept
   - Algorithm: BFS level-based circular positioning
   - Use cases: Topic exploration, concept mapping

2. **Tree Vertical** (`tree-vertical`) - Top-down hierarchy
   - Best for: Organizational structures, process flows
   - Algorithm: Dagre with LR direction
   - Use cases: Audit plans, checklists

3. **Tree Horizontal** (`tree-horizontal`) - Left-to-right hierarchy
   - Best for: Sequential processes, timelines
   - Algorithm: Dagre with TB direction
   - Use cases: Workflows, calculation steps

4. **Organic** (`organic`) - Force-directed layout
   - Best for: Complex interconnections
   - Algorithm: ReactFlow default physics
   - Use cases: Forensic analysis, roundtable discussions

5. **Timeline** (`timeline`) - Sequential with timestamps
   - Best for: Historical progression, phased approaches
   - Algorithm: Vertical spacing with time markers
   - Use cases: Scenario simulation, project planning

## Mode-Specific Configurations

### Deep Research Mode 🔬

```typescript
{
  nodeIcons: {
    root: '🔬',
    primary: '📚',
    secondary: '📌',
    tertiary: '🔹',
  },
  defaultLayout: 'radial',
  colorTheme: {
    primary: '#3b82f6',    // Blue
    secondary: '#60a5fa',
    accent: '#93c5fd',
  },
  autoTriggers: [
    'explain', 'overview', 'research', 'analyze',
    'regulatory landscape', 'legal framework'
  ],
}
```

### Calculation Mode 🧮

```typescript
{
  nodeIcons: {
    root: '🧮',
    primary: '📊',
    secondary: '🔢',
    tertiary: '➗',
  },
  defaultLayout: 'tree-horizontal',
  colorTheme: {
    primary: '#10b981',    // Green
    secondary: '#34d399',
    accent: '#6ee7b7',
  },
  autoTriggers: [
    'calculate', 'formula', 'step by step',
    'compute', 'solve', 'breakdown'
  ],
}
```

### Audit Plan Mode 📋

```typescript
{
  nodeIcons: {
    root: '📋',
    primary: '✅',
    secondary: '🔍',
    tertiary: '📝',
  },
  defaultLayout: 'tree-vertical',
  colorTheme: {
    primary: '#8b5cf6',    // Purple
    secondary: '#a78bfa',
    accent: '#c4b5fd',
  },
  autoTriggers: [
    'audit plan', 'procedures', 'testing',
    'control points', 'risk areas'
  ],
}
```

## Quality Standards

The AI is instructed to generate mindmaps meeting these criteria:

### Hierarchy
- **Depth**: 3-5 levels (root → primary → secondary → tertiary → leaf)
- **Breadth**: 3-7 main branches from root
- **Balance**: Roughly equal nodes per main branch

### Clarity
- **Labels**: 2-5 words per node
- **Descriptions**: 1-2 sentences (optional)
- **Icons**: Meaningful and consistent

### Relevance
- **Focus**: Every node supports the topic
- **Completeness**: All major aspects covered
- **Precision**: Avoid redundancy

### Structure
- **Root**: Single central concept
- **Primary**: Main categories/themes (3-7)
- **Secondary**: Sub-topics/components (2-5 per primary)
- **Tertiary**: Details/specifics (1-4 per secondary)
- **Leaf**: Final details/examples (optional)

## Validation Rules

The system validates mindmaps for:

1. **Required Fields**
   - `title` present
   - `nodes` array with at least 1 node
   - `edges` array (can be empty for single node)

2. **Root Node**
   - Exactly one node with `type: 'root'`

3. **Unique IDs**
   - All node IDs must be unique
   - No duplicate `id` values

4. **Edge Integrity**
   - All `source` and `target` reference existing node IDs
   - No dangling edges

5. **Structural Coherence**
   - At least one edge connecting to root (for multi-node graphs)
   - No isolated subgraphs (except single-node mindmaps)

## Frontend Features

### Interactive Controls

1. **Zoom**: Mouse wheel or pinch gesture
2. **Pan**: Click and drag background
3. **Fit View**: Auto-center and scale to fit all nodes
4. **Node Interaction**: Hover for tooltips, click to expand/collapse

### Export Options

1. **JSON** - Download mindmap data structure
2. **PNG** - Raster image export (planned)
3. **SVG** - Vector graphic export (planned)

### Animations

- **Fade-in**: Nodes appear with opacity transition
- **Hover**: Scale and shadow effects
- **Edge drawing**: Smooth Bezier curves with animated path
- **Layout transitions**: Smooth repositioning on layout change

### Accessibility

- **Keyboard navigation**: Tab through nodes, Enter to select
- **Screen reader support**: Aria labels on all interactive elements
- **High contrast mode**: Respects system preferences
- **Focus indicators**: Clear visible focus states

## Usage Examples

### Example 1: Research Query

**Query**: "Explain the FIFO inventory method and its tax implications"

**Triggers**: "explain" (general trigger)

**Generated Mindmap**:
```
Root: FIFO Inventory Method
├── Primary: Definition & Concept
│   ├── Secondary: First In, First Out principle
│   └── Secondary: Inventory flow assumption
├── Primary: Tax Implications
│   ├── Secondary: IRS regulations
│   ├── Secondary: Taxable income calculation
│   └── Secondary: LIFO comparison
├── Primary: Practical Applications
│   ├── Secondary: Retail businesses
│   └── Secondary: Manufacturing contexts
└── Primary: Advantages & Disadvantages
    ├── Secondary: Benefits (inflation impact)
    └── Secondary: Limitations (record keeping)
```

### Example 2: Calculation Query

**Query**: "Calculate NPV step by step for a 5-year project"

**Triggers**: "calculate", "step by step" (calculation mode triggers)

**Generated Mindmap**:
```
Root: NPV Calculation Process
├── Primary: Step 1 - Identify Cash Flows
│   ├── Secondary: Initial investment (Year 0)
│   └── Secondary: Annual cash flows (Years 1-5)
├── Primary: Step 2 - Determine Discount Rate
│   ├── Secondary: WACC calculation
│   └── Secondary: Risk adjustment
├── Primary: Step 3 - Calculate Present Values
│   ├── Secondary: Formula: PV = CF / (1+r)^n
│   └── Secondary: Excel function: =PV()
└── Primary: Step 4 - Sum PVs for NPV
    ├── Secondary: Add all discounted cash flows
    └── Secondary: Subtract initial investment
```

### Example 3: Audit Plan Query

**Query**: "Create an audit plan structure for revenue recognition"

**Triggers**: "audit plan", "structure" (audit mode triggers)

**Generated Mindmap**:
```
Root: Revenue Recognition Audit
├── Primary: Planning Phase
│   ├── Secondary: Risk assessment
│   ├── Secondary: Materiality determination
│   └── Secondary: Engagement letter
├── Primary: Internal Controls Testing
│   ├── Secondary: Sales order approval
│   ├── Secondary: Credit checks
│   └── Secondary: Shipping procedures
├── Primary: Substantive Testing
│   ├── Secondary: Revenue cut-off tests
│   ├── Secondary: Contract review
│   └── Secondary: Analytical procedures
└── Primary: Reporting
    ├── Secondary: Findings documentation
    └── Secondary: Management letter
```

## Customization

### Adding New Triggers

Edit `shared/types/mindmap.ts`:

```typescript
export const MODE_MINDMAP_CONFIGS = {
  'my-custom-mode': {
    nodeIcons: {
      root: '🎯',
      primary: '📋',
      secondary: '🔸',
      tertiary: '•',
    },
    defaultLayout: 'radial',
    colorTheme: {
      primary: '#ff6b6b',
      secondary: '#ff8787',
      accent: '#ffa5a5',
    },
    autoTriggers: [
      'custom trigger 1',
      'custom trigger 2',
    ],
  },
};
```

### Custom Layout Algorithms

Add to `client/src/components/visualizations/MindMapRenderer.tsx`:

```typescript
case 'my-custom-layout':
  return nodes.map((node, index) => {
    // Your custom positioning logic
    const angle = (index / nodes.length) * 2 * Math.PI;
    return {
      ...node,
      position: {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      },
    };
  });
```

### Mode-Specific Prompt Guidelines

Modify `server/services/mindmapGenerator.ts`:

```typescript
private static getModeSpecificGuidelines(mode: string): string {
  const guidelines: Record<string, string> = {
    'my-custom-mode': `
- Root: Custom concept
- Primary: Main themes
- Secondary: Supporting details
- Include specific formatting rules
`,
  };
  return guidelines[mode] || guidelines['deep-research'];
}
```

## Performance Optimization

### Frontend
- **Lazy loading**: MindMapRenderer only loads when needed
- **Memoization**: React.memo on node components
- **Virtualization**: Large mindmaps (100+ nodes) use virtual rendering
- **Debouncing**: Layout recalculations debounced on window resize

### Backend
- **Prompt caching**: Mode-specific prompts cached in memory
- **Parallel processing**: Mindmap extraction runs async
- **Validation caching**: Validated structures cached for 5 minutes

## Testing

### Unit Tests
```bash
npm run test server/services/mindmapGenerator.test.ts
```

### Integration Tests
```bash
npm run test server/services/aiOrchestrator.test.ts -- -t "mindmap"
```

### E2E Tests
```bash
npm run test:e2e -- features/mindmap-visualization.spec.ts
```

### Manual Testing Queries

1. **Research**: "Explain the double-entry bookkeeping system"
2. **Calculation**: "Show me the steps to calculate compound interest"
3. **Audit**: "Create an audit plan for inventory valuation"
4. **Workflow**: "Explain the month-end close process"
5. **Checklist**: "What are the requirements for a S-Corp election?"
6. **Scenario**: "Show possible outcomes of tax strategy changes"

## Troubleshooting

### Mindmap Not Generating

**Symptoms**: No mindmap appears even with trigger keywords

**Checks**:
1. Verify trigger keyword is in `MODE_MINDMAP_CONFIGS[mode].autoTriggers`
2. Check console for `[Orchestrator] Mindmap triggered` log
3. Validate AI response contains JSON code block with `"type": "mindmap"`
4. Check `[Orchestrator] No mindmap data found` warning

**Solutions**:
- Add trigger keyword to mode configuration
- Verify AI response format matches expected JSON structure
- Check AI provider is responding correctly (not truncated)

### Invalid Mindmap Structure

**Symptoms**: `[Orchestrator] Mindmap validation failed` warning

**Checks**:
1. Missing required fields (`title`, `nodes`, `edges`)
2. No root node or multiple root nodes
3. Duplicate node IDs
4. Edges reference non-existent nodes

**Solutions**:
- Review AI response JSON structure
- Add validation-specific prompt instructions
- Increase AI max tokens to avoid truncation

### Layout Issues

**Symptoms**: Nodes overlapping or positioned incorrectly

**Checks**:
1. Verify layout type is valid (`radial`, `tree-vertical`, etc.)
2. Check node count (large mindmaps need adjustments)
3. Review dagre configuration for tree layouts

**Solutions**:
- Adjust layout spacing in `MindMapRenderer.tsx`
- Implement virtualization for large mindmaps
- Use different layout algorithm for node count

### Performance Degradation

**Symptoms**: Slow rendering, laggy interactions

**Checks**:
1. Node count (>100 nodes)
2. Browser console for performance warnings
3. ReactFlow performance profiling

**Solutions**:
- Enable virtualization for large graphs
- Reduce animation complexity
- Implement progressive loading

## Future Enhancements

### Planned Features
- [ ] Export to PNG/SVG with high resolution
- [ ] Collaborative editing (real-time updates)
- [ ] Custom color themes per user
- [ ] AI-assisted mindmap refinement
- [ ] Mobile-optimized touch gestures
- [ ] Mindmap templates library
- [ ] Integration with note-taking apps
- [ ] Voice-to-mindmap generation

### Research & Development
- [ ] 3D mindmap visualization
- [ ] AR/VR mindmap exploration
- [ ] Neural network-based layout optimization
- [ ] Semantic similarity-based clustering
- [ ] Automatic mindmap summarization

## Contributing

### Adding Mode Support
1. Add mode configuration to `shared/types/mindmap.ts`
2. Add mode-specific guidelines to `server/services/mindmapGenerator.ts`
3. Update `MODE_MINDMAP_CONFIGS` with icons and triggers
4. Test with sample queries

### Improving Layouts
1. Create layout algorithm in `MindMapRenderer.tsx`
2. Add layout option to `MindMapLayout` enum
3. Document algorithm in this guide
4. Add tests for edge cases

### UI/UX Enhancements
1. Propose design in GitHub issue
2. Create mockups/prototypes
3. Implement in `MindMapRenderer.tsx`
4. Update documentation with screenshots

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Maintainer**: ICAI CAGPT Development Team
