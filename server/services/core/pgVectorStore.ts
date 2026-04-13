/**
 * PostgreSQL Vector Store Service (pgvector)
 * Persistent embedding-based semantic search - NO MEMORY FALLBACKS
 * All data persists in Supabase PostgreSQL
 */

import { db } from '../../db';
import { vectorEmbeddings } from '@shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { createHash } from 'crypto';
import OpenAI from 'openai';

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    type: 'regulation' | 'case' | 'procedure' | 'document' | 'calculation' | 'other';
    source?: string;
    jurisdiction?: string;
    effectiveDate?: Date;
    expiryDate?: Date;
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
  documentsByJurisdiction: Record<string, number>;
}

// OpenAI client for embeddings
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY || 'dummy_key_to_allow_startup' 
});

/**
 * Generate SHA-256 hash for content deduplication
 */
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Generate embedding using OpenAI ada-002
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY required for embeddings - no fallbacks');
  }
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text.slice(0, 8191), // Ada-002 max tokens
  });
  
  return response.data[0].embedding;
}

/**
 * Persistent Vector Store using PostgreSQL + pgvector
 * NO IN-MEMORY FALLBACKS - everything goes to the database
 */
export class PgVectorStore {
  private embeddingDimension: number = 1536;

  /**
   * Add document with embedding to persistent storage
   */
  async addDocument(doc: Omit<VectorDocument, 'id' | 'embedding'> & { embedding?: number[] }): Promise<VectorDocument> {
    const contentHash = hashContent(doc.content);
    
    // Check for duplicate
    const existing = await db
      .select()
      .from(vectorEmbeddings)
      .where(eq(vectorEmbeddings.contentHash, contentHash))
      .limit(1);
    
    if (existing.length > 0) {
      console.log(`[PgVectorStore] Document already exists: ${existing[0].id}`);
      return this.dbRowToDocument(existing[0]);
    }
    
    // Generate embedding if not provided
    const embedding = doc.embedding || await generateEmbedding(doc.content);
    
    const [inserted] = await db.insert(vectorEmbeddings).values({
      content: doc.content,
      embedding: JSON.stringify(embedding),
      contentHash: contentHash,
      documentType: doc.metadata.type,
      source: doc.metadata.source || null,
      jurisdiction: doc.metadata.jurisdiction || null,
      effectiveDate: doc.metadata.effectiveDate || null,
      expiryDate: doc.metadata.expiryDate || null,
      tags: doc.metadata.tags || [],
      metadata: doc.metadata,
    }).returning();
    
    console.log(`[PgVectorStore] Added document: ${inserted.id} (${inserted.documentType})`);
    return this.dbRowToDocument(inserted);
  }

  /**
   * Add multiple documents in batch
   */
  async addDocuments(docs: Array<Omit<VectorDocument, 'id'>>): Promise<VectorDocument[]> {
    const added: VectorDocument[] = [];
    
    // Process in batches to avoid overwhelming OpenAI API
    const batchSize = 10;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(doc => this.addDocument(doc)));
      added.push(...results);
    }
    
    console.log(`[PgVectorStore] Batch added ${added.length}/${docs.length} documents`);
    return added;
  }

  /**
   * Search for similar documents using pgvector cosine similarity
   */
  async search(
    query: string | number[],
    options?: {
      limit?: number;
      minSimilarity?: number;
      types?: string[];
      tags?: string[];
      jurisdiction?: string;
    }
  ): Promise<SearchResult[]> {
    // Generate query embedding if string provided
    const queryEmbedding = typeof query === 'string' 
      ? await generateEmbedding(query)
      : query;
    
    const limit = options?.limit || 10;
    const minSimilarity = options?.minSimilarity || 0.7;
    
    // Build dynamic WHERE conditions
    const conditions: any[] = [];
    
    if (options?.types && options.types.length > 0) {
      conditions.push(inArray(vectorEmbeddings.documentType, options.types));
    }
    
    if (options?.jurisdiction) {
      conditions.push(eq(vectorEmbeddings.jurisdiction, options.jurisdiction));
    }
    
    // Use pgvector's cosine similarity operator
    const embeddingVector = `[${queryEmbedding.join(',')}]`;
    
    const results = await db
      .select({
        id: vectorEmbeddings.id,
        content: vectorEmbeddings.content,
        embedding: vectorEmbeddings.embedding,
        documentType: vectorEmbeddings.documentType,
        source: vectorEmbeddings.source,
        jurisdiction: vectorEmbeddings.jurisdiction,
        effectiveDate: vectorEmbeddings.effectiveDate,
        expiryDate: vectorEmbeddings.expiryDate,
        tags: vectorEmbeddings.tags,
        metadata: vectorEmbeddings.metadata,
        // Cosine similarity: 1 - cosine distance
        similarity: sql<number>`1 - (${vectorEmbeddings.embedding} <=> ${embeddingVector}::vector)`,
      })
      .from(vectorEmbeddings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${vectorEmbeddings.embedding} <=> ${embeddingVector}::vector`)
      .limit(limit * 2); // Fetch extra to filter by similarity
    
    // Filter by minimum similarity and format results
    const filtered = results
      .filter(r => r.similarity >= minSimilarity)
      .slice(0, limit)
      .map((r, index) => ({
        document: {
          id: r.id,
          content: r.content,
          embedding: typeof r.embedding === 'string' ? JSON.parse(r.embedding) : (r.embedding as number[]),
          metadata: {
            type: r.documentType as VectorDocument['metadata']['type'],
            source: r.source || undefined,
            jurisdiction: r.jurisdiction || undefined,
            effectiveDate: r.effectiveDate || undefined,
            expiryDate: r.expiryDate || undefined,
            tags: (r.tags as string[]) || [],
          },
        },
        similarity: r.similarity,
        rank: index + 1,
      }));
    
    console.log(`[PgVectorStore] Search found ${filtered.length} results`);
    return filtered;
  }

  /**
   * Semantic search with natural language query
   */
  async semanticSearch(query: string, options?: {
    limit?: number;
    jurisdiction?: string;
  }): Promise<SearchResult[]> {
    return this.search(query, options);
  }

  /**
   * Get document by ID
   */
  async getDocument(docId: string): Promise<VectorDocument | null> {
    const [doc] = await db
      .select()
      .from(vectorEmbeddings)
      .where(eq(vectorEmbeddings.id, docId))
      .limit(1);
    
    return doc ? this.dbRowToDocument(doc) : null;
  }

  /**
   * Get documents by type
   */
  async getDocumentsByType(type: string): Promise<VectorDocument[]> {
    const docs = await db
      .select()
      .from(vectorEmbeddings)
      .where(eq(vectorEmbeddings.documentType, type));
    
    return docs.map(d => this.dbRowToDocument(d));
  }

  /**
   * Get documents by jurisdiction
   */
  async getDocumentsByJurisdiction(jurisdiction: string): Promise<VectorDocument[]> {
    const docs = await db
      .select()
      .from(vectorEmbeddings)
      .where(eq(vectorEmbeddings.jurisdiction, jurisdiction));
    
    return docs.map(d => this.dbRowToDocument(d));
  }

  /**
   * Delete document
   */
  async deleteDocument(docId: string): Promise<boolean> {
    const result = await db
      .delete(vectorEmbeddings)
      .where(eq(vectorEmbeddings.id, docId))
      .returning({ id: vectorEmbeddings.id });
    
    if (result.length > 0) {
      console.log(`[PgVectorStore] Deleted document: ${docId}`);
      return true;
    }
    return false;
  }

  /**
   * Update document metadata
   */
  async updateDocument(docId: string, updates: Partial<VectorDocument['metadata']>): Promise<VectorDocument | null> {
    const [updated] = await db
      .update(vectorEmbeddings)
      .set({
        documentType: updates.type,
        source: updates.source,
        jurisdiction: updates.jurisdiction,
        tags: updates.tags,
        metadata: updates,
        updatedAt: new Date(),
      })
      .where(eq(vectorEmbeddings.id, docId))
      .returning();
    
    return updated ? this.dbRowToDocument(updated) : null;
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<VectorStoreStats> {
    const typeStats = await db
      .select({
        type: vectorEmbeddings.documentType,
        count: sql<number>`count(*)`,
      })
      .from(vectorEmbeddings)
      .groupBy(vectorEmbeddings.documentType);
    
    const jurisdictionStats = await db
      .select({
        jurisdiction: vectorEmbeddings.jurisdiction,
        count: sql<number>`count(*)`,
      })
      .from(vectorEmbeddings)
      .groupBy(vectorEmbeddings.jurisdiction);
    
    const documentsByType: Record<string, number> = {};
    typeStats.forEach(s => {
      documentsByType[s.type] = Number(s.count);
    });
    
    const documentsByJurisdiction: Record<string, number> = {};
    jurisdictionStats.forEach(s => {
      if (s.jurisdiction) {
        documentsByJurisdiction[s.jurisdiction] = Number(s.count);
      }
    });
    
    return {
      totalDocuments: Object.values(documentsByType).reduce((a, b) => a + b, 0),
      documentsByType,
      documentsByJurisdiction,
    };
  }

  /**
   * Index regulatory content from authoritative sources
   */
  async indexRegulation(params: {
    content: string;
    source: string;
    jurisdiction: string;
    title?: string;
    effectiveDate?: Date;
    tags?: string[];
  }): Promise<VectorDocument> {
    return this.addDocument({
      content: params.content,
      metadata: {
        type: 'regulation',
        source: params.source,
        jurisdiction: params.jurisdiction,
        effectiveDate: params.effectiveDate,
        tags: params.tags || [],
      },
    });
  }

  /**
   * Convert database row to VectorDocument
   */
  private dbRowToDocument(row: any): VectorDocument {
    return {
      id: row.id,
      content: row.content,
      embedding: row.embedding as number[],
      metadata: {
        type: row.documentType as VectorDocument['metadata']['type'],
        source: row.source || undefined,
        jurisdiction: row.jurisdiction || undefined,
        effectiveDate: row.effectiveDate || undefined,
        expiryDate: row.expiryDate || undefined,
        tags: (row.tags as string[]) || [],
      },
    };
  }
}

// Singleton instance - PERSISTENT, NO FALLBACKS
export const pgVectorStore = new PgVectorStore();
