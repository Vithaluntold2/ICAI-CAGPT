/**
 * Embedding Service
 * Generates text embeddings using Azure OpenAI text-embedding-3-large
 * Production-grade implementation with caching and fallback
 */

import { AzureOpenAI } from 'openai';
import crypto from 'crypto';

// Embedding cache to avoid duplicate API calls
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokensUsed: number;
  cached: boolean;
}

export interface EmbeddingBatchResult {
  embeddings: number[][];
  model: string;
  totalTokens: number;
  cachedCount: number;
}

class EmbeddingService {
  private client: AzureOpenAI | null = null;
  private model: string = 'text-embedding-3-large';
  private initialized: boolean = false;

  /**
   * Initialize the embedding service with Azure OpenAI
   */
  initialize(): boolean {
    if (this.initialized) return true;

    const apiKey = process.env.AZURE_EMBEDDING_API_KEY || process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_EMBEDDING_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_EMBEDDING_DEPLOYMENT || 'text-embedding-3-large';
    
    if (!apiKey || !endpoint) {
      console.warn('[EmbeddingService] Azure embedding credentials not configured - embeddings will be unavailable');
      return false;
    }

    try {
      this.model = deployment;
      this.client = new AzureOpenAI({
        apiKey,
        endpoint: endpoint.replace(/\/$/, ''),
        apiVersion: '2024-06-01',
        deployment,
        timeout: 30000,
        maxRetries: 2,
      });
      this.initialized = true;
      console.log('[EmbeddingService] Initialized with Azure OpenAI, deployment:', deployment, 'endpoint:', endpoint);
      return true;
    } catch (error) {
      console.error('[EmbeddingService] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    // Check cache first
    const cacheKey = this.getCacheKey(text);
    const cached = embeddingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        embedding: cached.embedding,
        model: this.model,
        tokensUsed: 0,
        cached: true,
      };
    }

    // Initialize if needed
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.client) {
      throw new Error('Embedding service not available - Azure credentials not configured');
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
      });

      const embedding = response.data[0].embedding;
      const tokensUsed = response.usage?.total_tokens || 0;

      // Cache the result
      embeddingCache.set(cacheKey, {
        embedding,
        timestamp: Date.now(),
      });

      // Clean old cache entries periodically
      this.cleanCache();

      return {
        embedding,
        model: this.model,
        tokensUsed,
        cached: false,
      };
    } catch (error: any) {
      console.error('[EmbeddingService] Error generating embedding:', error.message);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts (batched for efficiency)
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingBatchResult> {
    if (texts.length === 0) {
      return {
        embeddings: [],
        model: this.model,
        totalTokens: 0,
        cachedCount: 0,
      };
    }

    // Check which texts are cached
    const results: { index: number; embedding: number[] | null; cached: boolean }[] = texts.map((text, index) => {
      const cacheKey = this.getCacheKey(text);
      const cached = embeddingCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return { index, embedding: cached.embedding, cached: true };
      }
      return { index, embedding: null, cached: false };
    });

    const uncachedIndices = results.filter(r => !r.cached).map(r => r.index);
    const uncachedTexts = uncachedIndices.map(i => texts[i]);
    let totalTokens = 0;

    // Fetch uncached embeddings
    if (uncachedTexts.length > 0) {
      if (!this.initialized) {
        this.initialize();
      }

      if (!this.client) {
        throw new Error('Embedding service not available - Azure credentials not configured');
      }

      try {
        // OpenAI supports batch embedding up to ~8000 texts
        // Split into chunks of 100 for safety
        const BATCH_SIZE = 100;
        for (let i = 0; i < uncachedTexts.length; i += BATCH_SIZE) {
          const batch = uncachedTexts.slice(i, i + BATCH_SIZE);
          const batchIndices = uncachedIndices.slice(i, i + BATCH_SIZE);

          const response = await this.client.embeddings.create({
            model: this.model,
            input: batch,
          });

          totalTokens += response.usage?.total_tokens || 0;

          // Map results back to original indices
          response.data.forEach((item, batchIdx) => {
            const originalIndex = batchIndices[batchIdx];
            results[originalIndex].embedding = item.embedding;

            // Cache the result
            const cacheKey = this.getCacheKey(texts[originalIndex]);
            embeddingCache.set(cacheKey, {
              embedding: item.embedding,
              timestamp: Date.now(),
            });
          });
        }
      } catch (error: any) {
        console.error('[EmbeddingService] Batch embedding error:', error.message);
        throw new Error(`Failed to generate embeddings: ${error.message}`);
      }
    }

    // Clean old cache entries
    this.cleanCache();

    // Sort results back to original order
    const sortedEmbeddings = results
      .sort((a, b) => a.index - b.index)
      .map(r => r.embedding!);

    return {
      embeddings: sortedEmbeddings,
      model: this.model,
      totalTokens,
      cachedCount: results.filter(r => r.cached).length,
    };
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Check if embedding service is available
   */
  isAvailable(): boolean {
    return !!(process.env.AZURE_EMBEDDING_API_KEY || process.env.AZURE_OPENAI_API_KEY);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: embeddingCache.size,
      hitRate: 0, // Would need to track hits/misses for this
    };
  }

  /**
   * Generate cache key for text
   */
  private getCacheKey(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex').substring(0, 32);
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of Array.from(embeddingCache.entries())) {
      if (now - value.timestamp > CACHE_TTL) {
        embeddingCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[EmbeddingService] Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    embeddingCache.clear();
    console.log('[EmbeddingService] Cache cleared');
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
