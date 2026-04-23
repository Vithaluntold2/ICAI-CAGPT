/**
 * Vector Store Service
 * Embedding-based semantic search for knowledge retrieval
 */

import { EventEmitter } from 'events';

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    type: 'regulation' | 'case' | 'procedure' | 'document' | 'calculation' | 'other';
    source?: string;
    jurisdiction?: string;
    createdAt: Date;
    tags: string[];
  };
}

export interface SearchResult {
  document: VectorDocument;
  similarity: number;
  rank: number;
}

export interface VectorStoreStats {
  totalDocuments: number;
  documentsByType: Record<string, number>;
  averageEmbeddingSize: number;
  storageSize: number;
}

/**
 * Vector Store
 * Manages embeddings and semantic search
 */
export class VectorStore extends EventEmitter {
  private documents: Map<string, VectorDocument> = new Map();
  private documentsByType: Map<string, Set<string>> = new Map();
  private embeddingDimension: number = 3072; // Azure text-embedding-3-large

  /**
   * Add document with embedding
   */
  async addDocument(doc: Omit<VectorDocument, 'id'>): Promise<VectorDocument> {
    const fullDoc: VectorDocument = {
      ...doc,
      id: `vec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    // Validate embedding dimension
    if (fullDoc.embedding.length !== this.embeddingDimension) {
      throw new Error(
        `Embedding dimension mismatch: expected ${this.embeddingDimension}, got ${fullDoc.embedding.length}`
      );
    }

    this.documents.set(fullDoc.id, fullDoc);

    // Index by type
    if (!this.documentsByType.has(fullDoc.metadata.type)) {
      this.documentsByType.set(fullDoc.metadata.type, new Set());
    }
    this.documentsByType.get(fullDoc.metadata.type)!.add(fullDoc.id);

    this.emit('document:added', fullDoc);
    console.log(`[VectorStore] Added document: ${fullDoc.id} (${fullDoc.metadata.type})`);

    return fullDoc;
  }

  /**
   * Add multiple documents in batch
   */
  async addDocuments(docs: Array<Omit<VectorDocument, 'id'>>): Promise<VectorDocument[]> {
    const added: VectorDocument[] = [];
    
    for (const doc of docs) {
      try {
        const fullDoc = await this.addDocument(doc);
        added.push(fullDoc);
      } catch (error) {
        console.error('[VectorStore] Failed to add document:', error);
      }
    }

    console.log(`[VectorStore] Batch added ${added.length}/${docs.length} documents`);
    return added;
  }

  /**
   * Search for similar documents using cosine similarity
   */
  async search(
    queryEmbedding: number[],
    options?: {
      limit?: number;
      minSimilarity?: number;
      types?: string[];
      tags?: string[];
      jurisdiction?: string;
    }
  ): Promise<SearchResult[]> {
    // Validate query embedding
    if (queryEmbedding.length !== this.embeddingDimension) {
      throw new Error(
        `Query embedding dimension mismatch: expected ${this.embeddingDimension}, got ${queryEmbedding.length}`
      );
    }

    let candidates = Array.from(this.documents.values());

    // Filter by type
    if (options?.types && options.types.length > 0) {
      candidates = candidates.filter(doc => 
        options.types!.includes(doc.metadata.type)
      );
    }

    // Filter by tags
    if (options?.tags && options.tags.length > 0) {
      candidates = candidates.filter(doc =>
        options.tags!.some(tag => doc.metadata.tags.includes(tag))
      );
    }

    // Filter by jurisdiction
    if (options?.jurisdiction) {
      candidates = candidates.filter(doc =>
        doc.metadata.jurisdiction === options.jurisdiction
      );
    }

    // Calculate similarities
    const results: SearchResult[] = candidates.map(doc => ({
      document: doc,
      similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
      rank: 0, // Will be set after sorting
    }));

    // Filter by minimum similarity
    const minSimilarity = options?.minSimilarity || 0.7;
    const filtered = results.filter(r => r.similarity >= minSimilarity);

    // Sort by similarity (descending)
    filtered.sort((a, b) => b.similarity - a.similarity);

    // Set ranks
    filtered.forEach((result, index) => {
      result.rank = index + 1;
    });

    // Apply limit
    const limit = options?.limit || 10;
    const limited = filtered.slice(0, limit);

    console.log(
      `[VectorStore] Search found ${limited.length} results ` +
      `(filtered from ${candidates.length} candidates)`
    );

    return limited;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Get document by ID
   */
  getDocument(docId: string): VectorDocument | null {
    return this.documents.get(docId) || null;
  }

  /**
   * Get documents by type
   */
  getDocumentsByType(type: string): VectorDocument[] {
    const docIds = this.documentsByType.get(type);
    if (!docIds) return [];

    return Array.from(docIds)
      .map(id => this.documents.get(id))
      .filter((doc): doc is VectorDocument => doc !== undefined);
  }

  /**
   * Update document metadata
   */
  updateDocument(
    docId: string,
    updates: Partial<Pick<VectorDocument, 'content' | 'embedding' | 'metadata'>>
  ): VectorDocument | null {
    const doc = this.documents.get(docId);
    if (!doc) return null;

    if (updates.content !== undefined) {
      doc.content = updates.content;
    }

    if (updates.embedding !== undefined) {
      if (updates.embedding.length !== this.embeddingDimension) {
        throw new Error('Embedding dimension mismatch');
      }
      doc.embedding = updates.embedding;
    }

    if (updates.metadata !== undefined) {
      // Update type index if type changed
      if (updates.metadata.type && updates.metadata.type !== doc.metadata.type) {
        this.documentsByType.get(doc.metadata.type)?.delete(docId);
        if (!this.documentsByType.has(updates.metadata.type)) {
          this.documentsByType.set(updates.metadata.type, new Set());
        }
        this.documentsByType.get(updates.metadata.type)!.add(docId);
      }

      Object.assign(doc.metadata, updates.metadata);
    }

    this.emit('document:updated', doc);
    return doc;
  }

  /**
   * Delete document
   */
  deleteDocument(docId: string): boolean {
    const doc = this.documents.get(docId);
    if (!doc) return false;

    this.documents.delete(docId);
    this.documentsByType.get(doc.metadata.type)?.delete(docId);

    this.emit('document:deleted', docId);
    console.log(`[VectorStore] Deleted document: ${docId}`);

    return true;
  }

  /**
   * Find similar documents to a given document
   */
  async findSimilar(
    docId: string,
    options?: {
      limit?: number;
      minSimilarity?: number;
      excludeSelf?: boolean;
    }
  ): Promise<SearchResult[]> {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document not found: ${docId}`);
    }

    const results = await this.search(doc.embedding, {
      limit: (options?.limit || 10) + (options?.excludeSelf ? 1 : 0),
      minSimilarity: options?.minSimilarity,
    });

    // Exclude the document itself if requested
    if (options?.excludeSelf) {
      return results.filter(r => r.document.id !== docId).slice(0, options.limit || 10);
    }

    return results;
  }

  /**
   * Cluster documents by similarity
   */
  async cluster(threshold: number = 0.8): Promise<Array<VectorDocument[]>> {
    const docs = Array.from(this.documents.values());
    const clusters: Array<VectorDocument[]> = [];
    const assigned = new Set<string>();

    for (const doc of docs) {
      if (assigned.has(doc.id)) continue;

      const cluster = [doc];
      assigned.add(doc.id);

      // Find similar documents
      const similar = await this.findSimilar(doc.id, {
        minSimilarity: threshold,
        excludeSelf: true,
      });

      for (const result of similar) {
        if (!assigned.has(result.document.id)) {
          cluster.push(result.document);
          assigned.add(result.document.id);
        }
      }

      clusters.push(cluster);
    }

    console.log(`[VectorStore] Created ${clusters.length} clusters from ${docs.length} documents`);
    return clusters;
  }

  /**
   * Get statistics
   */
  getStatistics(): VectorStoreStats {
    const docs = Array.from(this.documents.values());
    
    const documentsByType: Record<string, number> = {};
    for (const [type, ids] of Array.from(this.documentsByType.entries())) {
      documentsByType[type] = ids.size;
    }

    const totalEmbeddingSize = docs.reduce(
      (sum, doc) => sum + doc.embedding.length,
      0
    );

    return {
      totalDocuments: docs.length,
      documentsByType,
      averageEmbeddingSize: docs.length > 0 ? totalEmbeddingSize / docs.length : 0,
      storageSize: this.estimateStorageSize(),
    };
  }

  /**
   * Estimate storage size in bytes
   */
  private estimateStorageSize(): number {
    let size = 0;

    for (const doc of Array.from(this.documents.values())) {
      // Content string
      size += doc.content.length * 2; // UTF-16 encoding

      // Embedding (float64 = 8 bytes per number)
      size += doc.embedding.length * 8;

      // Metadata (rough estimate)
      size += JSON.stringify(doc.metadata).length * 2;

      // ID
      size += doc.id.length * 2;
    }

    return size;
  }

  /**
   * Export all documents
   */
  export(): VectorDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Import documents
   */
  async import(docs: VectorDocument[]): Promise<void> {
    for (const doc of docs) {
      this.documents.set(doc.id, doc);

      if (!this.documentsByType.has(doc.metadata.type)) {
        this.documentsByType.set(doc.metadata.type, new Set());
      }
      this.documentsByType.get(doc.metadata.type)!.add(doc.id);
    }

    console.log(`[VectorStore] Imported ${docs.length} documents`);
  }

  /**
   * Clear all documents
   */
  clear(): void {
    this.documents.clear();
    this.documentsByType.clear();
    console.log('[VectorStore] Cleared all documents');
  }

  /**
   * Set embedding dimension (should be called before adding documents)
   */
  setEmbeddingDimension(dimension: number): void {
    if (this.documents.size > 0) {
      throw new Error('Cannot change embedding dimension after documents have been added');
    }
    this.embeddingDimension = dimension;
    console.log(`[VectorStore] Set embedding dimension to ${dimension}`);
  }
}

// Singleton instance
export const vectorStore = new VectorStore();
