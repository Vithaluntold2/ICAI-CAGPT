/**
 * Knowledge Graph Service
 * Graph-based knowledge storage for relationships between entities
 */

import { EventEmitter } from 'events';

export interface KnowledgeNode {
  id: string;
  type: NodeType;
  label: string;
  properties: Record<string, any>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    source?: string;
    confidence?: number;
  };
}

export type NodeType = 
  | 'concept'
  | 'entity'
  | 'regulation'
  | 'case'
  | 'procedure'
  | 'calculation'
  | 'document'
  | 'person'
  | 'organization';

export interface KnowledgeEdge {
  id: string;
  from: string; // Node ID
  to: string; // Node ID
  type: EdgeType;
  weight: number; // 0-1, higher means stronger relationship
  properties: Record<string, any>;
  metadata: {
    createdAt: Date;
    source?: string;
  };
}

export type EdgeType =
  | 'related_to'
  | 'part_of'
  | 'depends_on'
  | 'supersedes'
  | 'references'
  | 'applies_to'
  | 'calculated_by'
  | 'authored_by';

export interface GraphQuery {
  nodeTypes?: NodeType[];
  edgeTypes?: EdgeType[];
  properties?: Record<string, any>;
  maxDepth?: number;
  limit?: number;
}

export interface GraphPath {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  totalWeight: number;
}

/**
 * Knowledge Graph
 * Manages relationships between knowledge entities
 */
export class KnowledgeGraph extends EventEmitter {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: Map<string, KnowledgeEdge> = new Map();
  private nodesByType: Map<NodeType, Set<string>> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map(); // For traversal

  /**
   * Add a node to the graph
   */
  addNode(node: Omit<KnowledgeNode, 'id' | 'metadata'>): KnowledgeNode {
    const fullNode: KnowledgeNode = {
      ...node,
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        confidence: 1.0,
      },
    };

    this.nodes.set(fullNode.id, fullNode);

    // Index by type
    if (!this.nodesByType.has(fullNode.type)) {
      this.nodesByType.set(fullNode.type, new Set());
    }
    this.nodesByType.get(fullNode.type)!.add(fullNode.id);

    // Initialize adjacency list
    if (!this.adjacencyList.has(fullNode.id)) {
      this.adjacencyList.set(fullNode.id, new Set());
    }

    this.emit('node:added', fullNode);
    console.log(`[KnowledgeGraph] Added node: ${fullNode.label} (${fullNode.type})`);

    return fullNode;
  }

  /**
   * Add an edge to the graph
   */
  addEdge(edge: Omit<KnowledgeEdge, 'id' | 'metadata'>): KnowledgeEdge {
    // Verify nodes exist
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
      throw new Error('Both nodes must exist before creating an edge');
    }

    const fullEdge: KnowledgeEdge = {
      ...edge,
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        createdAt: new Date(),
      },
    };

    this.edges.set(fullEdge.id, fullEdge);

    // Update adjacency list
    this.adjacencyList.get(fullEdge.from)!.add(fullEdge.to);

    this.emit('edge:added', fullEdge);
    console.log(`[KnowledgeGraph] Added edge: ${fullEdge.from} -> ${fullEdge.to} (${fullEdge.type})`);

    return fullEdge;
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): KnowledgeNode | null {
    return this.nodes.get(nodeId) || null;
  }

  /**
   * Get nodes by type
   */
  getNodesByType(type: NodeType): KnowledgeNode[] {
    const nodeIds = this.nodesByType.get(type);
    if (!nodeIds) return [];

    return Array.from(nodeIds)
      .map(id => this.nodes.get(id))
      .filter((node): node is KnowledgeNode => node !== undefined);
  }

  /**
   * Find nodes matching criteria
   */
  findNodes(query: GraphQuery): KnowledgeNode[] {
    let results = Array.from(this.nodes.values());

    // Filter by type
    if (query.nodeTypes && query.nodeTypes.length > 0) {
      results = results.filter(node => query.nodeTypes!.includes(node.type));
    }

    // Filter by properties
    if (query.properties) {
      results = results.filter(node => {
        for (const [key, value] of Object.entries(query.properties!)) {
          if (node.properties[key] !== value) return false;
        }
        return true;
      });
    }

    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get neighbors of a node
   */
  getNeighbors(nodeId: string, options?: {
    edgeTypes?: EdgeType[];
    maxDepth?: number;
  }): KnowledgeNode[] {
    const visited = new Set<string>();
    const neighbors: KnowledgeNode[] = [];
    const maxDepth = options?.maxDepth || 1;

    const traverse = (currentId: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentId)) return;
      visited.add(currentId);

      const adjacentIds = this.adjacencyList.get(currentId);
      if (!adjacentIds) return;

      for (const adjacentId of Array.from(adjacentIds)) {
        // Check edge type filter
        if (options?.edgeTypes) {
          const edge = this.getEdge(currentId, adjacentId, options.edgeTypes);
          if (!edge) continue;
        }

        const neighbor = this.nodes.get(adjacentId);
        if (neighbor && currentId !== nodeId) { // Don't include starting node
          neighbors.push(neighbor);
        }

        if (depth < maxDepth) {
          traverse(adjacentId, depth + 1);
        }
      }
    };

    traverse(nodeId, 0);
    return neighbors;
  }

  /**
   * Get edge between two nodes
   */
  private getEdge(fromId: string, toId: string, types?: EdgeType[]): KnowledgeEdge | null {
    for (const edge of Array.from(this.edges.values())) {
      if (edge.from === fromId && edge.to === toId) {
        if (!types || types.includes(edge.type)) {
          return edge;
        }
      }
    }
    return null;
  }

  /**
   * Find shortest path between two nodes
   */
  findPath(fromId: string, toId: string): GraphPath | null {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      return null;
    }

    // BFS for shortest path
    const queue: Array<{ nodeId: string; path: string[]; edges: KnowledgeEdge[] }> = [
      { nodeId: fromId, path: [fromId], edges: [] }
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { nodeId, path, edges } = queue.shift()!;

      if (nodeId === toId) {
        // Found path
        const nodes = path.map(id => this.nodes.get(id)!);
        const totalWeight = edges.reduce((sum, e) => sum + e.weight, 0) / edges.length;

        return { nodes, edges, totalWeight };
      }

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const adjacentIds = this.adjacencyList.get(nodeId);
      if (!adjacentIds) continue;

      for (const adjacentId of Array.from(adjacentIds)) {
        if (!visited.has(adjacentId)) {
          const edge = this.getEdge(nodeId, adjacentId);
          if (edge) {
            queue.push({
              nodeId: adjacentId,
              path: [...path, adjacentId],
              edges: [...edges, edge],
            });
          }
        }
      }
    }

    return null; // No path found
  }

  /**
   * Get subgraph around a node
   */
  getSubgraph(nodeId: string, depth: number = 2): {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
  } {
    const nodeIds = new Set<string>([nodeId]);
    const edgeIds = new Set<string>();

    const traverse = (currentId: string, currentDepth: number) => {
      if (currentDepth > depth) return;

      const adjacentIds = this.adjacencyList.get(currentId);
      if (!adjacentIds) return;

      for (const adjacentId of Array.from(adjacentIds)) {
        nodeIds.add(adjacentId);

        // Find edge
        for (const edge of Array.from(this.edges.values())) {
          if ((edge.from === currentId && edge.to === adjacentId) ||
              (edge.from === adjacentId && edge.to === currentId)) {
            edgeIds.add(edge.id);
          }
        }

        if (currentDepth < depth) {
          traverse(adjacentId, currentDepth + 1);
        }
      }
    };

    traverse(nodeId, 0);

    const nodes = Array.from(nodeIds)
      .map(id => this.nodes.get(id))
      .filter((node): node is KnowledgeNode => node !== undefined);

    const edges = Array.from(edgeIds)
      .map(id => this.edges.get(id))
      .filter((edge): edge is KnowledgeEdge => edge !== undefined);

    return { nodes, edges };
  }

  /**
   * Update node properties
   */
  updateNode(nodeId: string, updates: Partial<KnowledgeNode>): KnowledgeNode | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    Object.assign(node, updates);
    node.metadata.updatedAt = new Date();

    this.emit('node:updated', node);
    return node;
  }

  /**
   * Delete node and associated edges
   */
  deleteNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Delete all edges connected to this node
    for (const [edgeId, edge] of Array.from(this.edges.entries())) {
      if (edge.from === nodeId || edge.to === nodeId) {
        this.edges.delete(edgeId);
      }
    }

    // Remove from adjacency list
    this.adjacencyList.delete(nodeId);
    for (const adjacentSet of Array.from(this.adjacencyList.values())) {
      adjacentSet.delete(nodeId);
    }

    // Remove from type index
    this.nodesByType.get(node.type)?.delete(nodeId);

    // Remove node
    this.nodes.delete(nodeId);

    this.emit('node:deleted', nodeId);
    console.log(`[KnowledgeGraph] Deleted node: ${nodeId}`);

    return true;
  }

  /**
   * Get graph statistics
   */
  getStatistics() {
    const nodesByType: Record<string, number> = {};
    for (const [type, ids] of Array.from(this.nodesByType.entries())) {
      nodesByType[type] = ids.size;
    }

    const edgesByType: Record<string, number> = {};
    for (const edge of Array.from(this.edges.values())) {
      edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
    }

    const averageDegree = this.nodes.size > 0
      ? (this.edges.size * 2) / this.nodes.size
      : 0;

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      nodesByType,
      edgesByType,
      averageDegree,
    };
  }

  /**
   * Export graph as JSON
   */
  export(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  /**
   * Import graph from JSON
   */
  import(data: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }): void {
    // Clear existing data
    this.nodes.clear();
    this.edges.clear();
    this.nodesByType.clear();
    this.adjacencyList.clear();

    // Import nodes
    data.nodes.forEach(node => {
      this.nodes.set(node.id, node);
      
      if (!this.nodesByType.has(node.type)) {
        this.nodesByType.set(node.type, new Set());
      }
      this.nodesByType.get(node.type)!.add(node.id);

      if (!this.adjacencyList.has(node.id)) {
        this.adjacencyList.set(node.id, new Set());
      }
    });

    // Import edges
    data.edges.forEach(edge => {
      this.edges.set(edge.id, edge);
      this.adjacencyList.get(edge.from)!.add(edge.to);
    });

    console.log(`[KnowledgeGraph] Imported ${data.nodes.length} nodes and ${data.edges.length} edges`);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.nodesByType.clear();
    this.adjacencyList.clear();
    console.log('[KnowledgeGraph] Cleared all data');
  }
}

// Singleton instance
export const knowledgeGraph = new KnowledgeGraph();
