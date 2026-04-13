/**
 * Workflow Visualization Mode Agents
 * Agents for parsing, generating, and optimizing workflow visualizations
 */

import { EventEmitter } from 'events';
import type { AgentDefinition, AgentInput, AgentOutput } from '@shared/types/agentTypes';

export interface WorkflowNode {
  id: string;
  type: 'start' | 'end' | 'process' | 'decision' | 'document' | 'subprocess';
  label: string;
  position?: { x: number; y: number };
  data?: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  type?: 'normal' | 'conditional' | 'data-flow';
}

/**
 * Workflow Parser Agent
 * Parses text descriptions into workflow structures
 */
export class WorkflowParser extends EventEmitter implements AgentDefinition {
  id = 'workflow-parser';
  name = 'Workflow Parser';
  mode = 'workflow-visualization' as const;
  capabilities = ['parsing', 'structure-analysis'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[WorkflowParser] Parsing workflow description');

    const description = input.data.description as string;
    const workflow = this.parseWorkflow(description);

    return {
      success: true,
      data: {
        workflow,
        nodeCount: workflow.nodes.length,
        edgeCount: workflow.edges.length,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 0.85,
      },
    };
  }

  private parseWorkflow(description: string): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    // Split into sentences
    const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Always add start node
    nodes.push({
      id: 'start',
      type: 'start',
      label: 'Start',
    });

    let previousNodeId = 'start';

    // Parse each sentence for workflow steps
    sentences.forEach((sentence, index) => {
      const trimmed = sentence.trim();
      if (trimmed.length === 0) return;

      const nodeId = `node_${index + 1}`;
      let nodeType: WorkflowNode['type'] = 'process';
      let label = trimmed;

      // Detect decision points
      if (trimmed.match(/if|whether|decide|determine|check/i)) {
        nodeType = 'decision';
      }
      // Detect documents
      else if (trimmed.match(/generate|create|prepare|document|report|form/i)) {
        nodeType = 'document';
      }
      // Detect subprocesses
      else if (trimmed.match(/subprocess|subroutine|call|invoke/i)) {
        nodeType = 'subprocess';
      }

      nodes.push({
        id: nodeId,
        type: nodeType,
        label: label.substring(0, 80),
      });

      // Create edge from previous node
      edges.push({
        id: `edge_${edges.length + 1}`,
        from: previousNodeId,
        to: nodeId,
        type: nodeType === 'decision' ? 'conditional' : 'normal',
      });

      previousNodeId = nodeId;
    });

    // Add end node
    nodes.push({
      id: 'end',
      type: 'end',
      label: 'End',
    });

    edges.push({
      id: `edge_${edges.length + 1}`,
      from: previousNodeId,
      to: 'end',
    });

    return { nodes, edges };
  }
}

/**
 * Node Generator Agent
 * Generates detailed workflow nodes with properties
 */
export class NodeGenerator extends EventEmitter implements AgentDefinition {
  id = 'node-generator';
  name = 'Node Generator';
  mode = 'workflow-visualization' as const;
  capabilities = ['generation', 'enrichment'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[NodeGenerator] Generating workflow nodes');

    const steps = input.data.steps as string[];
    const nodes = steps.map((step, index) => this.generateNode(step, index));

    return {
      success: true,
      data: {
        nodes,
        count: nodes.length,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 0.9,
      },
    };
  }

  private generateNode(step: string, index: number): WorkflowNode {
    const nodeId = `node_${index + 1}`;
    let nodeType: WorkflowNode['type'] = 'process';

    // Classify node type
    if (step.match(/^start|begin/i)) {
      nodeType = 'start';
    } else if (step.match(/end|finish|complete/i)) {
      nodeType = 'end';
    } else if (step.match(/if|whether|decide|check/i)) {
      nodeType = 'decision';
    } else if (step.match(/document|report|form|generate/i)) {
      nodeType = 'document';
    } else if (step.match(/subprocess|call|invoke/i)) {
      nodeType = 'subprocess';
    }

    return {
      id: nodeId,
      type: nodeType,
      label: step.substring(0, 80),
      data: {
        description: step,
        estimatedDuration: this.estimateDuration(step),
        priority: this.estimatePriority(step),
      },
    };
  }

  private estimateDuration(step: string): number {
    // Simple heuristic - longer steps take more time
    const words = step.split(' ').length;
    return Math.min(words * 5, 60); // 5 minutes per word, max 60
  }

  private estimatePriority(step: string): 'high' | 'medium' | 'low' {
    if (step.match(/critical|urgent|important|must/i)) return 'high';
    if (step.match(/optional|consider|might/i)) return 'low';
    return 'medium';
  }
}

/**
 * Edge Generator Agent
 * Generates connections between workflow nodes
 */
export class EdgeGenerator extends EventEmitter implements AgentDefinition {
  id = 'edge-generator';
  name = 'Edge Generator';
  mode = 'workflow-visualization' as const;
  capabilities = ['generation', 'connection-building'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[EdgeGenerator] Generating workflow edges');

    const nodes = input.data.nodes as WorkflowNode[];
    const edges = this.generateEdges(nodes);

    return {
      success: true,
      data: {
        edges,
        count: edges.length,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 0.9,
      },
    };
  }

  private generateEdges(nodes: WorkflowNode[]): WorkflowEdge[] {
    const edges: WorkflowEdge[] = [];

    // Sequential connections
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i];
      const to = nodes[i + 1];

      const edgeType = from.type === 'decision' ? 'conditional' : 'normal';

      edges.push({
        id: `edge_${i + 1}`,
        from: from.id,
        to: to.id,
        type: edgeType,
        label: edgeType === 'conditional' ? 'Yes' : undefined,
      });

      // Add alternative path for decision nodes
      if (from.type === 'decision' && i + 2 < nodes.length) {
        edges.push({
          id: `edge_${i + 1}_alt`,
          from: from.id,
          to: nodes[i + 2].id,
          type: 'conditional',
          label: 'No',
        });
      }
    }

    return edges;
  }
}

/**
 * Layout Optimizer Agent
 * Optimizes visual layout of workflow diagrams
 */
export class LayoutOptimizer extends EventEmitter implements AgentDefinition {
  id = 'layout-optimizer';
  name = 'Layout Optimizer';
  mode = 'workflow-visualization' as const;
  capabilities = ['optimization', 'layout'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[LayoutOptimizer] Optimizing workflow layout');

    const nodes = input.data.nodes as WorkflowNode[];
    const edges = input.data.edges as WorkflowEdge[];
    const layout = (input.data.layout as string) || 'hierarchical';

    const optimizedNodes = this.optimizeLayout(nodes, edges, layout);

    return {
      success: true,
      data: {
        nodes: optimizedNodes,
        layout,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 0.95,
      },
    };
  }

  private optimizeLayout(nodes: WorkflowNode[], edges: WorkflowEdge[], layout: string): WorkflowNode[] {
    if (layout === 'hierarchical') {
      return this.hierarchicalLayout(nodes, edges);
    } else if (layout === 'circular') {
      return this.circularLayout(nodes);
    }

    return this.hierarchicalLayout(nodes, edges);
  }

  private hierarchicalLayout(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const positioned = [...nodes];
    const nodeSpacing = 200;
    const levelSpacing = 150;

    // Build adjacency list
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      if (!adjacency.has(edge.from)) {
        adjacency.set(edge.from, []);
      }
      adjacency.get(edge.from)!.push(edge.to);
    }

    // Calculate levels (BFS)
    const levels = new Map<string, number>();
    const queue: Array<{ id: string; level: number }> = [];

    // Find start nodes
    const startNodes = positioned.filter(n => n.type === 'start');
    startNodes.forEach(n => queue.push({ id: n.id, level: 0 }));

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      levels.set(id, level);

      const neighbors = adjacency.get(id) || [];
      neighbors.forEach(neighborId => {
        if (!levels.has(neighborId)) {
          queue.push({ id: neighborId, level: level + 1 });
        }
      });
    }

    // Position nodes by level
    const nodesByLevel = new Map<number, string[]>();
    for (const [nodeId, level] of Array.from(levels.entries())) {
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(nodeId);
    }

    // Apply positions
    for (const [level, nodeIds] of Array.from(nodesByLevel.entries())) {
      nodeIds.forEach((nodeId: string, index: number) => {
        const node = positioned.find(n => n.id === nodeId);
        if (node) {
          node.position = {
            x: level * levelSpacing,
            y: index * nodeSpacing,
          };
        }
      });
    }

    return positioned;
  }

  private circularLayout(nodes: WorkflowNode[]): WorkflowNode[] {
    const positioned = [...nodes];
    const radius = 300;
    const centerX = 400;
    const centerY = 400;

    const angleStep = (2 * Math.PI) / nodes.length;

    positioned.forEach((node, index) => {
      const angle = index * angleStep;
      node.position = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    return positioned;
  }
}

/**
 * Workflow Validator Agent
 * Validates workflow structure and completeness
 */
export class WorkflowValidator extends EventEmitter implements AgentDefinition {
  id = 'workflow-validator';
  name = 'Workflow Validator';
  mode = 'workflow-visualization' as const;
  capabilities = ['validation', 'quality-assurance'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[WorkflowValidator] Validating workflow');

    const nodes = input.data.nodes as WorkflowNode[];
    const edges = input.data.edges as WorkflowEdge[];

    const validation = this.validateWorkflow(nodes, edges);

    return {
      success: validation.valid,
      data: validation,
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: validation.valid ? 1.0 : 0.5,
      },
    };
  }

  private validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for start and end nodes
    const startNodes = nodes.filter(n => n.type === 'start');
    const endNodes = nodes.filter(n => n.type === 'end');

    if (startNodes.length === 0) {
      errors.push('Workflow must have at least one start node');
    }
    if (endNodes.length === 0) {
      errors.push('Workflow must have at least one end node');
    }

    // Check for disconnected nodes
    const connectedNodes = new Set<string>();
    edges.forEach(edge => {
      connectedNodes.add(edge.from);
      connectedNodes.add(edge.to);
    });

    const disconnected = nodes.filter(n => !connectedNodes.has(n.id));
    if (disconnected.length > 0) {
      warnings.push(`${disconnected.length} disconnected nodes found`);
    }

    // Check for cycles (simple check)
    if (this.hasCycles(nodes, edges)) {
      warnings.push('Workflow contains cycles');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      timestamp: new Date().toISOString(),
    };
  }

  private hasCycles(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      if (!adjacency.has(edge.from)) {
        adjacency.set(edge.from, []);
      }
      adjacency.get(edge.from)!.push(edge.to);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleUtil = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacency.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleUtil(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycleUtil(node.id)) return true;
      }
    }

    return false;
  }
}

// Export all agents
export const workflowVisualizationAgents: AgentDefinition[] = [
  new WorkflowParser(),
  new NodeGenerator(),
  new EdgeGenerator(),
  new LayoutOptimizer(),
  new WorkflowValidator(),
];
