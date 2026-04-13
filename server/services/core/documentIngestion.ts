/**
 * Document Ingestion Service
 * Processes and ingests documents into knowledge graph and vector store
 */

import { EventEmitter } from 'events';
import { knowledgeGraph } from './knowledgeGraph';
import { vectorStore } from './vectorStore';
import { embeddingService } from '../embeddingService';

export interface IngestionJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  documents: DocumentInput[];
  startTime?: Date;
  endTime?: Date;
  processed: number;
  failed: number;
  error?: string;
}

export interface DocumentInput {
  content: string;
  type: NodeType;
  source?: string;
  jurisdiction?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface ProcessedDocument {
  graphNodeId: string;
  vectorDocId: string;
  chunks: string[];
  embedding?: number[];
}

/**
 * Document Ingestion Pipeline
 * Processes documents and ingests into knowledge systems
 */
export class DocumentIngestion extends EventEmitter {
  private jobs: Map<string, IngestionJob> = new Map();
  private chunkSize = 1000; // Characters per chunk
  private chunkOverlap = 200; // Overlap between chunks

  /**
   * Ingest a single document
   */
  async ingestDocument(input: DocumentInput): Promise<ProcessedDocument> {
    console.log(`[DocumentIngestion] Processing document: ${input.type}`);

    // 1. Add to knowledge graph
    const graphNode = knowledgeGraph.addNode({
      type: input.type,
      label: this.generateLabel(input),
      properties: {
        content: input.content,
        source: input.source,
        jurisdiction: input.jurisdiction,
        tags: input.tags || [],
        ...input.metadata,
      },
    });

    // 2. Chunk the document
    const chunks = this.chunkDocument(input.content);

    // 3. Generate embeddings using production embedding service (OpenAI text-embedding-3-small)
    const embeddings = await this.generateEmbeddings(chunks);

    // 4. Add to vector store
    const vectorDocs = await Promise.all(
      chunks.map((chunk, index) =>
        vectorStore.addDocument({
          content: chunk,
          embedding: embeddings[index],
          metadata: {
            type: this.mapNodeTypeToVectorType(input.type),
            source: input.source,
            jurisdiction: input.jurisdiction,
            createdAt: new Date(),
            tags: input.tags || [],
          },
        })
      )
    );

    // 5. Link graph node to vector documents
    graphNode.properties.vectorDocIds = vectorDocs.map(d => d.id);

    this.emit('document:ingested', {
      graphNodeId: graphNode.id,
      vectorDocIds: vectorDocs.map(d => d.id),
    });

    return {
      graphNodeId: graphNode.id,
      vectorDocId: vectorDocs[0].id, // Return first chunk's ID
      chunks,
      embedding: embeddings[0],
    };
  }

  /**
   * Ingest multiple documents as a batch job
   */
  async ingestBatch(documents: DocumentInput[]): Promise<IngestionJob> {
    const job: IngestionJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      documents,
      processed: 0,
      failed: 0,
    };

    this.jobs.set(job.id, job);
    this.emit('job:created', job);

    // Process asynchronously
    this.processBatchJob(job).catch(error => {
      console.error('[DocumentIngestion] Batch job failed:', error);
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();
    });

    return job;
  }

  /**
   * Process batch job
   */
  private async processBatchJob(job: IngestionJob): Promise<void> {
    job.status = 'processing';
    job.startTime = new Date();

    console.log(`[DocumentIngestion] Starting batch job ${job.id} (${job.documents.length} documents)`);

    for (const doc of job.documents) {
      try {
        await this.ingestDocument(doc);
        job.processed++;
        this.emit('job:progress', job);
      } catch (error) {
        console.error('[DocumentIngestion] Document ingestion failed:', error);
        job.failed++;
      }
    }

    job.status = 'completed';
    job.endTime = new Date();
    this.emit('job:completed', job);

    console.log(
      `[DocumentIngestion] Batch job ${job.id} completed: ` +
      `${job.processed} processed, ${job.failed} failed`
    );
  }

  /**
   * Get job status
   */
  getJob(jobId: string): IngestionJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Chunk document into smaller pieces
   */
  private chunkDocument(content: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < content.length) {
      const end = Math.min(start + this.chunkSize, content.length);
      const chunk = content.substring(start, end);
      chunks.push(chunk);

      // Move start position with overlap
      start = end - this.chunkOverlap;
      if (start >= content.length) break;
    }

    return chunks;
  }

  /**
   * Generate embeddings for chunks using production embedding service
   */
  private async generateEmbeddings(chunks: string[]): Promise<number[][]> {
    // Use production embedding service
    if (embeddingService.isAvailable()) {
      try {
        const result = await embeddingService.generateEmbeddings(chunks);
        console.log(`[DocumentIngestion] Generated ${result.embeddings.length} embeddings (${result.cachedCount} cached, ${result.totalTokens} tokens)`);
        return result.embeddings;
      } catch (error) {
        console.error('[DocumentIngestion] Embedding generation failed:', error);
        // Fall through to fallback
      }
    }

    // Fallback: Generate deterministic pseudo-embeddings
    // These won't provide semantic search but allow the system to function
    console.warn('[DocumentIngestion] Using fallback embeddings - configure OPENAI_API_KEY for semantic search');
    return chunks.map(chunk => {
      const hash = this.hashString(chunk);
      const embedding: number[] = [];
      for (let i = 0; i < 1536; i++) {
        embedding.push(Math.sin(hash * (i + 1)) * Math.cos(hash * (i + 2)));
      }
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      return embedding.map(val => val / (magnitude || 1));
    });
  }

  /**
   * Simple string hash for fallback embedding generation
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * Generate label for knowledge graph node
   */
  private generateLabel(input: DocumentInput): string {
    // Extract first sentence or first 50 characters
    const firstSentence = input.content.match(/^[^.!?]+[.!?]/);
    if (firstSentence) {
      return firstSentence[0].trim();
    }

    return input.content.substring(0, 50) + (input.content.length > 50 ? '...' : '');
  }

  /**
   * Map knowledge graph node type to vector store type
   */
  private mapNodeTypeToVectorType(
    nodeType: NodeType
  ): 'regulation' | 'case' | 'procedure' | 'document' | 'calculation' | 'other' {
    const mapping: Record<NodeType, 'regulation' | 'case' | 'procedure' | 'document' | 'calculation' | 'other'> = {
      concept: 'document',
      entity: 'document',
      regulation: 'regulation',
      case: 'case',
      procedure: 'procedure',
      calculation: 'calculation',
      document: 'document',
      person: 'document',
      organization: 'document',
    };

    return mapping[nodeType] || 'other';
  }

  /**
   * Search across both knowledge graph and vector store
   */
  async hybridSearch(query: string, options?: {
    limit?: number;
    types?: string[];
    jurisdiction?: string;
  }): Promise<{
    vectorResults: any[];
    graphResults: any[];
    combined: any[];
  }> {
    // Generate query embedding
    const queryEmbedding = await this.generateEmbeddings([query]);

    // Search vector store
    const vectorResults = await vectorStore.search(queryEmbedding[0], {
      limit: options?.limit,
      types: options?.types,
      jurisdiction: options?.jurisdiction,
    });

    // Search knowledge graph
    const graphResults = knowledgeGraph.findNodes({
      nodeTypes: options?.types as any[],
      properties: options?.jurisdiction ? { jurisdiction: options.jurisdiction } : undefined,
      limit: options?.limit,
    });

    // Combine and deduplicate results
    const combined = this.combineResults(vectorResults, graphResults);

    return {
      vectorResults,
      graphResults,
      combined,
    };
  }

  /**
   * Combine vector and graph search results
   */
  private combineResults(vectorResults: any[], graphResults: any[]): any[] {
    const combined = [...vectorResults];
    const seenIds = new Set(vectorResults.map(r => r.document.id));

    // Add graph results that aren't already in vector results
    for (const graphNode of graphResults) {
      const vectorDocIds = graphNode.properties.vectorDocIds || [];
      const alreadyIncluded = vectorDocIds.some((id: string) => seenIds.has(id));

      if (!alreadyIncluded) {
        combined.push({
          document: {
            id: graphNode.id,
            content: graphNode.properties.content || graphNode.label,
            metadata: {
              type: graphNode.type,
              source: 'knowledge-graph',
              tags: graphNode.properties.tags || [],
            },
          },
          similarity: 0.5, // Default score for graph matches
          rank: combined.length + 1,
        });
      }
    }

    return combined;
  }

  /**
   * Link related documents in knowledge graph
   */
  async linkDocuments(
    fromDocId: string,
    toDocId: string,
    relationship: 'related_to' | 'references' | 'supersedes' | 'depends_on',
    weight: number = 0.8
  ): Promise<void> {
    const fromNode = knowledgeGraph.getNode(fromDocId);
    const toNode = knowledgeGraph.getNode(toDocId);

    if (!fromNode || !toNode) {
      throw new Error('Both documents must exist in knowledge graph');
    }

    knowledgeGraph.addEdge({
      from: fromDocId,
      to: toDocId,
      type: relationship,
      weight,
      properties: {},
    });

    console.log(`[DocumentIngestion] Linked documents: ${fromDocId} -> ${toDocId}`);
  }

  /**
   * Extract entities from document content
   * Uses pattern matching with financial domain knowledge
   * For enhanced NER, configure AZURE_TEXT_ANALYTICS_KEY
   */
  private async extractEntities(content: string): Promise<Array<{
    text: string;
    type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'tax_id';
    position: number;
    confidence: number;
  }>> {
    const entities: Array<{
      text: string;
      type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'tax_id';
      position: number;
      confidence: number;
    }> = [];

    // Financial domain-specific patterns
    const patterns: Record<string, { regex: RegExp; type: any; confidence: number }> = {
      // Company names
      organization: {
        regex: /\b[A-Z][a-z]+ (?:Ltd|Limited|Inc|Incorporated|Corp|Corporation|LLC|LLP|PLC|Pvt|Private|Company|Co|Group|Holdings|Partners|Associates)\b\.?/g,
        type: 'organization',
        confidence: 0.85
      },
      // Dates in various formats
      date: {
        regex: /\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi,
        type: 'date',
        confidence: 0.9
      },
      // Money amounts
      money: {
        regex: /(?:[$₹€£¥]|Rs\.?|INR|USD|EUR|GBP)\s*[\d,]+(?:\.\d{2})?|\b[\d,]+(?:\.\d{2})?\s*(?:dollars?|rupees?|euros?|pounds?|lakhs?|crores?)\b/gi,
        type: 'money',
        confidence: 0.85
      },
      // Tax IDs (PAN, GST, TIN, etc.)
      tax_id: {
        regex: /\b[A-Z]{5}\d{4}[A-Z]\b|\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d][A-Z]\b|\b\d{9,11}\b/g,
        type: 'tax_id',
        confidence: 0.8
      }
    };

    for (const [_, pattern] of Object.entries(patterns)) {
      let match;
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      while ((match = regex.exec(content)) !== null) {
        entities.push({
          text: match[0],
          type: pattern.type,
          position: match.index,
          confidence: pattern.confidence
        });
      }
    }

    // Sort by position
    entities.sort((a, b) => a.position - b.position);

    return entities;
  }

  /**
   * Get ingestion statistics
   */
  getStatistics() {
    const jobs = Array.from(this.jobs.values());

    return {
      totalJobs: jobs.length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
      processingJobs: jobs.filter(j => j.status === 'processing').length,
      totalDocumentsProcessed: jobs.reduce((sum, j) => sum + j.processed, 0),
      totalDocumentsFailed: jobs.reduce((sum, j) => sum + j.failed, 0),
      knowledgeGraphStats: knowledgeGraph.getStatistics(),
      vectorStoreStats: vectorStore.getStatistics(),
    };
  }

  /**
   * Clear all ingested data
   */
  clearAll(): void {
    this.jobs.clear();
    knowledgeGraph.clear();
    vectorStore.clear();
    console.log('[DocumentIngestion] Cleared all ingested data');
  }
}

// Singleton instance
export const documentIngestion = new DocumentIngestion();
