/**
 * RAG Pipeline Service
 * Retrieval-Augmented Generation for intelligent context retrieval
 * 
 * Combines:
 * - Vector store semantic search
 * - Knowledge graph traversal
 * - Context reranking
 * - Prompt augmentation
 */

import { EventEmitter } from 'events';
import { pgVectorStore } from './pgVectorStore';
import { knowledgeGraph } from './knowledgeGraph';
import { embeddingService } from '../embeddingService';
import type { QueryClassification } from '../queryTriage';

export interface RetrievedContext {
  id: string;
  content: string;
  source: string;
  type: 'vector' | 'graph' | 'calculation';
  similarity: number;
  jurisdiction?: string;
  metadata?: Record<string, any>;
}

export interface RAGResult {
  contexts: RetrievedContext[];
  sources: string[];
  confidence: number;
  retrievalTimeMs: number;
  vectorResults: number;
  graphResults: number;
}

export interface RAGConfig {
  vectorTopK: number;
  graphMaxDepth: number;
  minSimilarity: number;
  enableReranking: boolean;
  maxContextTokens: number;
}

const DEFAULT_CONFIG: RAGConfig = {
  vectorTopK: 10,
  graphMaxDepth: 2,
  minSimilarity: 0.7,
  enableReranking: true,
  maxContextTokens: 4000,
};

/**
 * RAG Pipeline
 * Retrieves relevant context for query augmentation
 */
export class RAGPipeline extends EventEmitter {
  private config: RAGConfig;

  constructor(config: Partial<RAGConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main entry point: Retrieve context for a query
   */
  async retrieveContext(
    query: string,
    classification: QueryClassification
  ): Promise<RAGResult> {
    const startTime = Date.now();
    const allContexts: RetrievedContext[] = [];

    try {
      // 1. Generate query embedding
      const queryEmbedding = await this.getQueryEmbedding(query);

      // 2. Vector similarity search
      const vectorContexts = await this.vectorSearch(
        queryEmbedding,
        classification
      );
      allContexts.push(...vectorContexts);

      // 3. Knowledge graph traversal
      const graphContexts = await this.graphSearch(
        query,
        classification
      );
      allContexts.push(...graphContexts);

      // 4. Deduplicate
      const deduped = this.deduplicateContexts(allContexts);

      // 5. Rerank if enabled
      const ranked = this.config.enableReranking
        ? await this.rerankContexts(query, deduped)
        : deduped;

      // 6. Truncate to token limit
      const truncated = this.truncateToTokenLimit(ranked);

      // 7. Calculate confidence
      const confidence = this.calculateConfidence(truncated);

      const retrievalTimeMs = Date.now() - startTime;

      const result: RAGResult = {
        contexts: truncated,
        sources: Array.from(new Set(truncated.map(c => c.source).filter((s): s is string => Boolean(s)))),
        confidence,
        retrievalTimeMs,
        vectorResults: vectorContexts.length,
        graphResults: graphContexts.length,
      };

      this.emit('retrieval:complete', result);
      console.log(`[RAGPipeline] Retrieved ${truncated.length} contexts in ${retrievalTimeMs}ms (confidence: ${confidence.toFixed(2)})`);

      return result;

    } catch (error) {
      console.error('[RAGPipeline] Retrieval failed:', error);
      this.emit('retrieval:error', error);
      
      // Return empty result on error
      return {
        contexts: [],
        sources: [],
        confidence: 0,
        retrievalTimeMs: Date.now() - startTime,
        vectorResults: 0,
        graphResults: 0,
      };
    }
  }

  /**
   * Generate embedding for query
   */
  private async getQueryEmbedding(query: string): Promise<number[]> {
    try {
      const result = await embeddingService.generateEmbedding(query);
      return result.embedding;
    } catch (error) {
      console.error('[RAGPipeline] Embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Vector similarity search
   */
  private async vectorSearch(
    queryEmbedding: number[],
    classification: QueryClassification
  ): Promise<RetrievedContext[]> {
    try {
      const results = await pgVectorStore.search(queryEmbedding, {
        limit: this.config.vectorTopK,
        minSimilarity: this.config.minSimilarity,
        jurisdiction: classification.jurisdiction?.[0],
        types: this.getRelevantTypes(classification),
      });

      return results.map(r => ({
        id: r.document.id,
        content: r.document.content,
        source: r.document.metadata.source || 'knowledge_base',
        type: 'vector' as const,
        similarity: r.similarity,
        jurisdiction: r.document.metadata.jurisdiction,
        metadata: r.document.metadata,
      }));

    } catch (error) {
      console.error('[RAGPipeline] Vector search failed:', error);
      return [];
    }
  }

  /**
   * Knowledge graph traversal
   */
  private async graphSearch(
    query: string,
    classification: QueryClassification
  ): Promise<RetrievedContext[]> {
    try {
      // Search for relevant nodes by label/type
      const nodeTypeNames = this.getRelevantNodeTypes(classification);
      const nodeTypes = nodeTypeNames.filter((t): t is import('./knowledgeGraph').NodeType => 
        ['concept', 'entity', 'regulation', 'procedure', 'calculation', 'document', 'case', 'jurisdiction'].includes(t)
      );
      const nodes = knowledgeGraph.findNodes({
        nodeTypes,
        limit: 5,
      });

      // Get related nodes via edges
      const relatedContexts: RetrievedContext[] = [];
      
      for (const node of nodes) {
        // Get the node's content
        relatedContexts.push({
          id: node.id,
          content: node.properties.content || node.label,
          source: node.metadata.source || 'knowledge_graph',
          type: 'graph' as const,
          similarity: 0.8, // Graph matches get high base score
          jurisdiction: node.properties.jurisdiction,
          metadata: node.properties,
        });

        // Get related nodes
        const related = knowledgeGraph.getNeighbors(node.id, {
          maxDepth: this.config.graphMaxDepth,
        }).slice(0, 3);

        for (const relNode of related) {
          relatedContexts.push({
            id: relNode.id,
            content: relNode.properties.content || relNode.label,
            source: relNode.metadata.source || 'knowledge_graph',
            type: 'graph' as const,
            similarity: 0.6, // Related nodes get lower score
            jurisdiction: relNode.properties.jurisdiction,
            metadata: relNode.properties,
          });
        }
      }

      return relatedContexts;

    } catch (error) {
      console.error('[RAGPipeline] Graph search failed:', error);
      return [];
    }
  }

  /**
   * Deduplicate contexts by content hash
   */
  private deduplicateContexts(contexts: RetrievedContext[]): RetrievedContext[] {
    const seen = new Map<string, RetrievedContext>();
    
    for (const ctx of contexts) {
      const key = this.hashContent(ctx.content);
      const existing = seen.get(key);
      
      if (!existing || ctx.similarity > existing.similarity) {
        seen.set(key, ctx);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Rerank contexts by relevance
   * Uses simple heuristics; can be upgraded to cross-encoder or GPT-4 reranking
   */
  private async rerankContexts(
    query: string,
    contexts: RetrievedContext[]
  ): Promise<RetrievedContext[]> {
    // Simple keyword-based reranking
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    const scored = contexts.map(ctx => {
      let score = ctx.similarity;
      
      // Boost for keyword matches
      const content = ctx.content.toLowerCase();
      for (const term of queryTerms) {
        if (term.length > 3 && content.includes(term)) {
          score += 0.05;
        }
      }

      // Boost for vector results (higher precision)
      if (ctx.type === 'vector') {
        score += 0.1;
      }

      // Boost for matching jurisdiction
      if (ctx.jurisdiction) {
        score += 0.05;
      }

      return { ...ctx, similarity: Math.min(score, 1.0) };
    });

    // Sort by score descending
    return scored.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Truncate contexts to fit within token limit
   */
  private truncateToTokenLimit(contexts: RetrievedContext[]): RetrievedContext[] {
    const result: RetrievedContext[] = [];
    let totalTokens = 0;

    for (const ctx of contexts) {
      const tokens = this.estimateTokens(ctx.content);
      
      if (totalTokens + tokens <= this.config.maxContextTokens) {
        result.push(ctx);
        totalTokens += tokens;
      } else {
        // Truncate content to fit remaining tokens
        const remainingTokens = this.config.maxContextTokens - totalTokens;
        if (remainingTokens > 100) {
          const truncatedContent = this.truncateText(ctx.content, remainingTokens);
          result.push({ ...ctx, content: truncatedContent });
        }
        break;
      }
    }

    return result;
  }

  /**
   * Calculate overall retrieval confidence
   */
  private calculateConfidence(contexts: RetrievedContext[]): number {
    if (contexts.length === 0) return 0;

    const avgSimilarity = contexts.reduce((sum, c) => sum + c.similarity, 0) / contexts.length;
    const countBonus = Math.min(contexts.length / 5, 0.2); // Up to 0.2 bonus for having multiple results

    return Math.min(avgSimilarity + countBonus, 1.0);
  }

  /**
   * Format retrieved contexts for LLM prompt
   */
  formatForPrompt(ragResult: RAGResult): string {
    if (ragResult.contexts.length === 0) {
      return '';
    }

    let prompt = '\n\n---\n## 📚 Retrieved Knowledge Context\n\n';
    prompt += `*Confidence: ${(ragResult.confidence * 100).toFixed(0)}% | Sources: ${ragResult.sources.length}*\n\n`;

    for (let i = 0; i < ragResult.contexts.length; i++) {
      const ctx = ragResult.contexts[i];
      prompt += `### Context ${i + 1} [${ctx.source}]\n`;
      prompt += `${ctx.content}\n\n`;
    }

    prompt += '---\n\n';
    prompt += '**Instructions**: Use the above context to inform your response. ';
    prompt += 'Cite sources using [Source: name] format when referencing specific information.\n\n';

    return prompt;
  }

  /**
   * Get relevant document types based on query classification
   */
  private getRelevantTypes(classification: QueryClassification): string[] {
    const types: string[] = [];

    switch (classification.domain) {
      case 'tax':
        types.push('regulation', 'case', 'procedure');
        break;
      case 'audit':
        types.push('procedure', 'document', 'regulation');
        break;
      case 'advisory':
        types.push('calculation', 'procedure', 'document');
        break;
      default:
        types.push('regulation', 'procedure', 'document');
    }

    return types;
  }

  /**
   * Get relevant node types for graph search
   */
  private getRelevantNodeTypes(classification: QueryClassification): string[] {
    switch (classification.domain) {
      case 'tax':
        return ['regulation', 'entity', 'concept'];
      case 'audit':
        return ['procedure', 'concept', 'regulation'];
      case 'advisory':
        return ['calculation', 'concept', 'procedure'];
      default:
        return ['concept', 'regulation', 'procedure'];
    }
  }

  /**
   * Simple content hash for deduplication
   */
  private hashContent(content: string): string {
    // Use first 100 chars normalized as hash
    return content.toLowerCase().replace(/\s+/g, ' ').slice(0, 100);
  }

  /**
   * Estimate token count (rough: ~4 chars per token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate text to approximate token count
   */
  private truncateText(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 3) + '...';
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RAGConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const ragPipeline = new RAGPipeline();
