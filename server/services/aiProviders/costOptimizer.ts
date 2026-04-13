/**
 * Cost Optimizer Service
 * Optimizes AI provider costs through intelligent routing and caching
 */

import { EventEmitter } from 'events';
import type { QueryClassification } from './providerRouter';

export interface CostMetrics {
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  averageCostPerRequest: number;
  costByProvider: Record<string, number>;
  costByMode: Record<string, number>;
  savingsFromOptimization: number;
}

export interface CacheEntry {
  query: string;
  queryHash: string;
  response: any;
  timestamp: Date;
  hits: number;
  cost: number;
}

export interface OptimizationRecommendation {
  type: 'cache' | 'provider-switch' | 'model-downgrade' | 'batch-request';
  reason: string;
  estimatedSavings: number;
  confidence: number;
}

/**
 * Cost Optimizer
 * Tracks and optimizes AI usage costs
 */
export class CostOptimizer extends EventEmitter {
  private metrics: CostMetrics = {
    totalCost: 0,
    totalTokens: 0,
    requestCount: 0,
    averageCostPerRequest: 0,
    costByProvider: {},
    costByMode: {},
    savingsFromOptimization: 0,
  };

  private cache: Map<string, CacheEntry> = new Map();
  private maxCacheSize = 1000;
  private cacheHitCount = 0;
  private cacheMissCount = 0;
  private estimatedSavingsFromCache = 0;

  /**
   * Record a request cost
   */
  recordCost(
    providerId: string,
    mode: string,
    cost: number,
    tokens: number
  ): void {
    this.metrics.totalCost += cost;
    this.metrics.totalTokens += tokens;
    this.metrics.requestCount++;

    // Update provider costs
    if (!this.metrics.costByProvider[providerId]) {
      this.metrics.costByProvider[providerId] = 0;
    }
    this.metrics.costByProvider[providerId] += cost;

    // Update mode costs
    if (!this.metrics.costByMode[mode]) {
      this.metrics.costByMode[mode] = 0;
    }
    this.metrics.costByMode[mode] += cost;

    // Update average
    this.metrics.averageCostPerRequest = this.metrics.totalCost / this.metrics.requestCount;

    this.emit('cost:recorded', { providerId, mode, cost, tokens });
  }

  /**
   * Get cached response if available
   */
  getCached(query: string, classification: QueryClassification): CacheEntry | null {
    const hash = this.hashQuery(query, classification);
    const entry = this.cache.get(hash);

    if (entry) {
      // Check if cache is still valid (1 hour TTL)
      const age = Date.now() - entry.timestamp.getTime();
      if (age < 3600000) {
        entry.hits++;
        this.cacheHitCount++;
        this.estimatedSavingsFromCache += entry.cost;
        this.metrics.savingsFromOptimization += entry.cost;

        console.log(`[CostOptimizer] Cache HIT (saved $${entry.cost.toFixed(4)})`);
        this.emit('cache:hit', { query: hash, cost: entry.cost });
        return entry;
      } else {
        // Cache expired
        this.cache.delete(hash);
      }
    }

    this.cacheMissCount++;
    return null;
  }

  /**
   * Cache a response
   */
  cacheResponse(
    query: string,
    classification: QueryClassification,
    response: any,
    cost: number
  ): void {
    const hash = this.hashQuery(query, classification);

    const entry: CacheEntry = {
      query,
      queryHash: hash,
      response,
      timestamp: new Date(),
      hits: 0,
      cost,
    };

    this.cache.set(hash, entry);

    // Evict old entries if cache is full
    if (this.cache.size > this.maxCacheSize) {
      this.evictLeastUsed();
    }

    console.log(`[CostOptimizer] Cached response for query (hash: ${hash.substr(0, 8)}...)`);
  }

  /**
   * Hash query for cache key
   */
  private hashQuery(query: string, classification: QueryClassification): string {
    const str = `${query}:${classification.mode}:${classification.complexity}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Evict least recently used cache entries
   */
  private evictLeastUsed(): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => {
        // Sort by hits (ascending) and timestamp (oldest first)
        if (a[1].hits !== b[1].hits) {
          return a[1].hits - b[1].hits;
        }
        return a[1].timestamp.getTime() - b[1].timestamp.getTime();
      });

    // Remove bottom 10%
    const removeCount = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < removeCount; i++) {
      this.cache.delete(entries[i][0]);
    }

    console.log(`[CostOptimizer] Evicted ${removeCount} cache entries`);
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Check cache hit rate
    const totalCacheRequests = this.cacheHitCount + this.cacheMissCount;
    const cacheHitRate = totalCacheRequests > 0 
      ? this.cacheHitCount / totalCacheRequests 
      : 0;

    if (cacheHitRate < 0.2 && totalCacheRequests > 100) {
      recommendations.push({
        type: 'cache',
        reason: 'Low cache hit rate - consider implementing query normalization',
        estimatedSavings: this.metrics.averageCostPerRequest * 0.2 * this.metrics.requestCount,
        confidence: 0.7,
      });
    }

    // Check provider distribution
    const providerCosts = Object.entries(this.metrics.costByProvider);
    if (providerCosts.length > 0) {
      const [mostExpensiveProvider, cost] = providerCosts.reduce((max, curr) => 
        curr[1] > max[1] ? curr : max
      );

      const totalCost = this.metrics.totalCost;
      if (cost > totalCost * 0.6) {
        recommendations.push({
          type: 'provider-switch',
          reason: `Heavy reliance on ${mostExpensiveProvider} - consider load balancing`,
          estimatedSavings: cost * 0.3,
          confidence: 0.6,
        });
      }
    }

    // Check for simple queries using expensive models
    const simpleQueryCost = this.metrics.costByMode['simple'] || 0;
    if (simpleQueryCost > this.metrics.totalCost * 0.2) {
      recommendations.push({
        type: 'model-downgrade',
        reason: 'Simple queries using expensive models - use cheaper models',
        estimatedSavings: simpleQueryCost * 0.5,
        confidence: 0.8,
      });
    }

    return recommendations;
  }

  /**
   * Get cost metrics
   */
  getMetrics(): CostMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
    const totalCacheRequests = this.cacheHitCount + this.cacheMissCount;

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: totalCacheRequests > 0 ? this.cacheHitCount / totalCacheRequests : 0,
      totalHits: this.cacheHitCount,
      totalMisses: this.cacheMissCount,
      averageHitsPerEntry: entries.length > 0 ? totalHits / entries.length : 0,
      estimatedSavings: this.estimatedSavingsFromCache,
    };
  }

  /**
   * Get cost breakdown by time period
   */
  getCostBreakdown(period: '24h' | '7d' | '30d' = '24h'): {
    period: string;
    cost: number;
    tokens: number;
    requests: number;
  } {
    // In production, this would query historical data
    // For now, return current metrics
    return {
      period,
      cost: this.metrics.totalCost,
      tokens: this.metrics.totalTokens,
      requests: this.metrics.requestCount,
    };
  }

  /**
   * Project costs for next period
   */
  projectCosts(days: number = 30): {
    estimatedCost: number;
    estimatedTokens: number;
    estimatedRequests: number;
    confidence: number;
  } {
    if (this.metrics.requestCount === 0) {
      return {
        estimatedCost: 0,
        estimatedTokens: 0,
        estimatedRequests: 0,
        confidence: 0,
      };
    }

    // Simple projection based on current rate
    const avgRequestsPerDay = this.metrics.requestCount / 1; // Assume current data is from 1 day
    const avgCostPerDay = this.metrics.totalCost / 1;
    const avgTokensPerDay = this.metrics.totalTokens / 1;

    return {
      estimatedCost: avgCostPerDay * days,
      estimatedTokens: avgTokensPerDay * days,
      estimatedRequests: avgRequestsPerDay * days,
      confidence: Math.min(this.metrics.requestCount / 100, 1), // More confident with more data
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalCost: 0,
      totalTokens: 0,
      requestCount: 0,
      averageCostPerRequest: 0,
      costByProvider: {},
      costByMode: {},
      savingsFromOptimization: 0,
    };
    this.cache.clear();
    this.cacheHitCount = 0;
    this.cacheMissCount = 0;
    this.estimatedSavingsFromCache = 0;
    console.log('[CostOptimizer] Metrics reset');
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      cacheStats: this.getCacheStats(),
      recommendations: this.getRecommendations(),
      timestamp: new Date().toISOString(),
    }, null, 2);
  }
}

// Singleton instance
export const costOptimizer = new CostOptimizer();
