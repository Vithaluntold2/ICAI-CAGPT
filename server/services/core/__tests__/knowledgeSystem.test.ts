/**
 * Knowledge Graph, Vector Store, and Document Ingestion Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeGraph, KnowledgeGraph } from '../knowledgeGraph';
import { vectorStore, VectorStore } from '../vectorStore';
import { documentIngestion, DocumentIngestion } from '../documentIngestion';

describe('KnowledgeGraph', () => {
  beforeEach(() => {
    knowledgeGraph.clear();
  });

  describe('Node Management', () => {
    it('should add and retrieve nodes', () => {
      const node = knowledgeGraph.addNode({
        type: 'regulation',
        label: 'Section 80C',
        properties: { description: 'Tax deduction for investments' },
      });

      expect(node).toBeDefined();
      expect(node.type).toBe('regulation');
      expect(node.label).toBe('Section 80C');

      const retrieved = knowledgeGraph.getNode(node.id);
      expect(retrieved).toEqual(node);
    });

    it('should get nodes by type', () => {
      knowledgeGraph.addNode({ type: 'regulation', label: 'Reg 1', properties: {} });
      knowledgeGraph.addNode({ type: 'regulation', label: 'Reg 2', properties: {} });
      knowledgeGraph.addNode({ type: 'case', label: 'Case 1', properties: {} });

      const regulations = knowledgeGraph.getNodesByType('regulation');
      expect(regulations).toHaveLength(2);
      expect(regulations.every(n => n.type === 'regulation')).toBe(true);
    });

    it('should update node properties', () => {
      const node = knowledgeGraph.addNode({
        type: 'concept',
        label: 'TDS',
        properties: { description: 'Tax Deducted at Source' },
      });

      const updated = knowledgeGraph.updateNode(node.id, {
        properties: { description: 'Updated description', year: 2024 },
      });

      expect(updated?.properties.description).toBe('Updated description');
      expect(updated?.properties.year).toBe(2024);
    });

    it('should delete nodes', () => {
      const node = knowledgeGraph.addNode({
        type: 'concept',
        label: 'Test',
        properties: {},
      });

      const deleted = knowledgeGraph.deleteNode(node.id);
      expect(deleted).toBe(true);
      expect(knowledgeGraph.getNode(node.id)).toBeNull();
    });

    it('should find nodes by properties', () => {
      knowledgeGraph.addNode({
        type: 'regulation',
        label: 'Section 80C',
        properties: { category: 'deduction', year: 2024 },
      });
      knowledgeGraph.addNode({
        type: 'regulation',
        label: 'Section 80D',
        properties: { category: 'deduction', year: 2024 },
      });
      knowledgeGraph.addNode({
        type: 'regulation',
        label: 'Section 10',
        properties: { category: 'exemption', year: 2024 },
      });

      const deductions = knowledgeGraph.findNodes({
        properties: { category: 'deduction' },
      });

      expect(deductions).toHaveLength(2);
      expect(deductions.every(n => n.properties.category === 'deduction')).toBe(true);
    });
  });

  describe('Edge Management', () => {
    it('should add and retrieve edges', () => {
      const node1 = knowledgeGraph.addNode({
        type: 'regulation',
        label: 'Parent',
        properties: {},
      });
      const node2 = knowledgeGraph.addNode({
        type: 'regulation',
        label: 'Child',
        properties: {},
      });

      const edge = knowledgeGraph.addEdge({
        from: node1.id,
        to: node2.id,
        type: 'part_of',
        weight: 1.0,
        properties: {},
      });

      expect(edge).toBeDefined();
      expect(edge.from).toBe(node1.id);
      expect(edge.to).toBe(node2.id);
    });

    it('should get neighbors', () => {
      const node1 = knowledgeGraph.addNode({ type: 'concept', label: 'A', properties: {} });
      const node2 = knowledgeGraph.addNode({ type: 'concept', label: 'B', properties: {} });
      const node3 = knowledgeGraph.addNode({ type: 'concept', label: 'C', properties: {} });

      knowledgeGraph.addEdge({
        from: node1.id,
        to: node2.id,
        type: 'related_to',
        weight: 1.0,
        properties: {},
      });
      knowledgeGraph.addEdge({
        from: node1.id,
        to: node3.id,
        type: 'related_to',
        weight: 1.0,
        properties: {},
      });

      const neighbors = knowledgeGraph.getNeighbors(node1.id);
      expect(neighbors).toHaveLength(2);
      expect(neighbors.map(n => n.id)).toContain(node2.id);
      expect(neighbors.map(n => n.id)).toContain(node3.id);
    });
  });

  describe('Graph Traversal', () => {
    it('should find shortest path between nodes', () => {
      const n1 = knowledgeGraph.addNode({ type: 'concept', label: '1', properties: {} });
      const n2 = knowledgeGraph.addNode({ type: 'concept', label: '2', properties: {} });
      const n3 = knowledgeGraph.addNode({ type: 'concept', label: '3', properties: {} });
      const n4 = knowledgeGraph.addNode({ type: 'concept', label: '4', properties: {} });

      knowledgeGraph.addEdge({ from: n1.id, to: n2.id, type: 'related_to', weight: 1, properties: {} });
      knowledgeGraph.addEdge({ from: n2.id, to: n3.id, type: 'related_to', weight: 1, properties: {} });
      knowledgeGraph.addEdge({ from: n3.id, to: n4.id, type: 'related_to', weight: 1, properties: {} });

      const path = knowledgeGraph.findPath(n1.id, n4.id);
      expect(path).toHaveLength(4);
      expect(path[0]).toBe(n1.id);
      expect(path[3]).toBe(n4.id);
    });

    it('should return empty array if no path exists', () => {
      const n1 = knowledgeGraph.addNode({ type: 'concept', label: '1', properties: {} });
      const n2 = knowledgeGraph.addNode({ type: 'concept', label: '2', properties: {} });

      const path = knowledgeGraph.findPath(n1.id, n2.id);
      expect(path).toHaveLength(0);
    });

    it('should get subgraph', () => {
      const root = knowledgeGraph.addNode({ type: 'concept', label: 'Root', properties: {} });
      const child1 = knowledgeGraph.addNode({ type: 'concept', label: 'Child1', properties: {} });
      const child2 = knowledgeGraph.addNode({ type: 'concept', label: 'Child2', properties: {} });

      knowledgeGraph.addEdge({ from: root.id, to: child1.id, type: 'part_of', weight: 1, properties: {} });
      knowledgeGraph.addEdge({ from: root.id, to: child2.id, type: 'part_of', weight: 1, properties: {} });

      const subgraph = knowledgeGraph.getSubgraph(root.id, 1);
      expect(subgraph.nodes).toHaveLength(3);
      expect(subgraph.edges).toHaveLength(2);
    });
  });

  describe('Statistics', () => {
    it('should return accurate statistics', () => {
      knowledgeGraph.addNode({ type: 'regulation', label: 'R1', properties: {} });
      knowledgeGraph.addNode({ type: 'regulation', label: 'R2', properties: {} });
      knowledgeGraph.addNode({ type: 'case', label: 'C1', properties: {} });

      const stats = knowledgeGraph.getStatistics();
      expect(stats.totalNodes).toBe(3);
      expect(stats.nodesByType.regulation).toBe(2);
      expect(stats.nodesByType.case).toBe(1);
    });
  });
});

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(() => {
    store = new VectorStore();
  });

  describe('Document Management', () => {
    it('should add and retrieve documents', async () => {
      const embedding = new Array(3072).fill(0).map(() => Math.random());

      const doc = await store.addDocument({
        content: 'Test content',
        embedding,
        metadata: {
          type: 'regulation',
          createdAt: new Date(),
          tags: ['test'],
        },
      });

      expect(doc.id).toBeDefined();
      expect(doc.content).toBe('Test content');

      const retrieved = store.getDocument(doc.id);
      expect(retrieved).toEqual(doc);
    });

    it('should validate embedding dimensions', async () => {
      const invalidEmbedding = [1, 2, 3]; // Wrong dimension

      await expect(
        store.addDocument({
          content: 'Test',
          embedding: invalidEmbedding,
          metadata: {
            type: 'regulation',
            createdAt: new Date(),
            tags: [],
          },
        })
      ).rejects.toThrow('Embedding dimension mismatch');
    });

    it('should get documents by type', async () => {
      const embedding = new Array(3072).fill(0).map(() => Math.random());

      await store.addDocument({
        content: 'Regulation 1',
        embedding,
        metadata: { type: 'regulation', createdAt: new Date(), tags: [] },
      });
      await store.addDocument({
        content: 'Case 1',
        embedding,
        metadata: { type: 'case', createdAt: new Date(), tags: [] },
      });

      const regulations = store.getDocumentsByType('regulation');
      expect(regulations).toHaveLength(1);
      expect(regulations[0].metadata.type).toBe('regulation');
    });

    it('should update documents', async () => {
      const embedding = new Array(3072).fill(0).map(() => Math.random());

      const doc = await store.addDocument({
        content: 'Original',
        embedding,
        metadata: { type: 'regulation', createdAt: new Date(), tags: [] },
      });

      const updated = store.updateDocument(doc.id, {
        content: 'Updated',
      });

      expect(updated?.content).toBe('Updated');
    });

    it('should delete documents', async () => {
      const embedding = new Array(3072).fill(0).map(() => Math.random());

      const doc = await store.addDocument({
        content: 'Test',
        embedding,
        metadata: { type: 'regulation', createdAt: new Date(), tags: [] },
      });

      const deleted = store.deleteDocument(doc.id);
      expect(deleted).toBe(true);
      expect(store.getDocument(doc.id)).toBeNull();
    });
  });

  describe('Semantic Search', () => {
    it('should search by similarity', async () => {
      // Add documents with known embeddings
      const embedding1 = new Array(3072).fill(1).map(() => Math.random());
      const embedding2 = [...embedding1].map(v => v + 0.1); // Similar

      await store.addDocument({
        content: 'Document 1',
        embedding: embedding1,
        metadata: { type: 'regulation', createdAt: new Date(), tags: [] },
      });
      await store.addDocument({
        content: 'Document 2',
        embedding: embedding2,
        metadata: { type: 'regulation', createdAt: new Date(), tags: [] },
      });

      const results = await store.search(embedding1, { limit: 10, minSimilarity: 0.5 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThan(0.5);
    });

    it('should filter by type', async () => {
      const embedding = new Array(3072).fill(0).map(() => Math.random());

      await store.addDocument({
        content: 'Regulation',
        embedding,
        metadata: { type: 'regulation', createdAt: new Date(), tags: [] },
      });
      await store.addDocument({
        content: 'Case',
        embedding,
        metadata: { type: 'case', createdAt: new Date(), tags: [] },
      });

      const results = await store.search(embedding, {
        types: ['regulation'],
        minSimilarity: 0,
      });

      expect(results.every(r => r.document.metadata.type === 'regulation')).toBe(true);
    });

    it('should filter by tags', async () => {
      const embedding = new Array(3072).fill(0).map(() => Math.random());

      await store.addDocument({
        content: 'Tagged doc',
        embedding,
        metadata: {
          type: 'regulation',
          createdAt: new Date(),
          tags: ['important'],
        },
      });
      await store.addDocument({
        content: 'Untagged doc',
        embedding,
        metadata: {
          type: 'regulation',
          createdAt: new Date(),
          tags: [],
        },
      });

      const results = await store.search(embedding, {
        tags: ['important'],
        minSimilarity: 0,
      });

      expect(results.length).toBe(1);
      expect(results[0].document.metadata.tags).toContain('important');
    });

    it('should find similar documents', async () => {
      const embedding = new Array(3072).fill(0).map(() => Math.random());

      const doc1 = await store.addDocument({
        content: 'Document 1',
        embedding,
        metadata: { type: 'regulation', createdAt: new Date(), tags: [] },
      });
      await store.addDocument({
        content: 'Document 2',
        embedding,
        metadata: { type: 'regulation', createdAt: new Date(), tags: [] },
      });

      const similar = await store.findSimilar(doc1.id, {
        limit: 5,
        excludeSelf: true,
      });

      expect(similar.every(r => r.document.id !== doc1.id)).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should return accurate statistics', async () => {
      const embedding = new Array(3072).fill(0).map(() => Math.random());

      await store.addDocument({
        content: 'Doc 1',
        embedding,
        metadata: { type: 'regulation', createdAt: new Date(), tags: [] },
      });
      await store.addDocument({
        content: 'Doc 2',
        embedding,
        metadata: { type: 'case', createdAt: new Date(), tags: [] },
      });

      const stats = store.getStatistics();
      expect(stats.totalDocuments).toBe(2);
      expect(stats.documentsByType.regulation).toBe(1);
      expect(stats.documentsByType.case).toBe(1);
    });
  });
});

describe('DocumentIngestion', () => {
  beforeEach(() => {
    documentIngestion.clearAll();
  });

  describe('Single Document Ingestion', () => {
    it('should ingest a document', async () => {
      const result = await documentIngestion.ingestDocument({
        content: 'Section 80C allows deductions up to Rs 1.5 lakh for investments.',
        type: 'regulation',
        source: 'Income Tax Act',
        jurisdiction: 'India',
        tags: ['deduction', 'investment'],
      });

      expect(result.graphNodeId).toBeDefined();
      expect(result.vectorDocId).toBeDefined();
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should chunk large documents', async () => {
      const largeContent = 'Lorem ipsum '.repeat(1000); // ~12000 characters

      const result = await documentIngestion.ingestDocument({
        content: largeContent,
        type: 'document',
        tags: [],
      });

      expect(result.chunks.length).toBeGreaterThan(1);
    });
  });

  describe('Batch Ingestion', () => {
    it('should process batch jobs', async () => {
      const documents = [
        {
          content: 'Document 1',
          type: 'regulation' as const,
          tags: [],
        },
        {
          content: 'Document 2',
          type: 'case' as const,
          tags: [],
        },
      ];

      const job = await documentIngestion.ingestBatch(documents);

      expect(job.id).toBeDefined();
      expect(job.status).toBe('pending');
      expect(job.documents).toHaveLength(2);

      // Wait for job to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      const updatedJob = documentIngestion.getJob(job.id);
      expect(updatedJob?.status).toBe('completed');
      expect(updatedJob?.processed).toBe(2);
    });

    it('should track job progress', async () => {
      const documents = Array(5).fill(null).map((_, i) => ({
        content: `Document ${i}`,
        type: 'regulation' as const,
        tags: [],
      }));

      const job = await documentIngestion.ingestBatch(documents);
      
      // Wait for some progress
      await new Promise(resolve => setTimeout(resolve, 1000));

      const progress = documentIngestion.getJob(job.id);
      expect(progress?.processed).toBeGreaterThan(0);
    });
  });

  describe('Hybrid Search', () => {
    it('should search across both systems', async () => {
      await documentIngestion.ingestDocument({
        content: 'Section 80C deduction rules',
        type: 'regulation',
        tags: ['deduction'],
      });

      const results = await documentIngestion.hybridSearch('deduction', {
        limit: 10,
      });

      expect(results.vectorResults).toBeDefined();
      expect(results.graphResults).toBeDefined();
      expect(results.combined).toBeDefined();
    });
  });

  describe('Document Linking', () => {
    it('should link related documents', async () => {
      const doc1 = await documentIngestion.ingestDocument({
        content: 'Parent regulation',
        type: 'regulation',
        tags: [],
      });

      const doc2 = await documentIngestion.ingestDocument({
        content: 'Child regulation',
        type: 'regulation',
        tags: [],
      });

      await documentIngestion.linkDocuments(
        doc1.graphNodeId,
        doc2.graphNodeId,
        'references'
      );

      const neighbors = knowledgeGraph.getNeighbors(doc1.graphNodeId);
      expect(neighbors.some(n => n.id === doc2.graphNodeId)).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should return ingestion statistics', async () => {
      await documentIngestion.ingestDocument({
        content: 'Test document',
        type: 'regulation',
        tags: [],
      });

      const stats = documentIngestion.getStatistics();
      expect(stats.totalDocumentsProcessed).toBeGreaterThan(0);
      expect(stats.knowledgeGraphStats).toBeDefined();
      expect(stats.vectorStoreStats).toBeDefined();
    });
  });
});
