/**
 * AI Provider Health Monitor
 * Tracks provider health metrics and enables intelligent failover
 */

import { AIProviderName } from './types';

interface ProviderHealthMetrics {
  successCount: number;
  errorCount: number;
  consecutiveFailures: number;
  lastError: Date | null;
  lastSuccess: Date | null;
  lastErrorType: string | null;
  healthScore: number; // 0-100
  rateLimitUntil: Date | null;
  quotaExceeded: boolean;
  isHealthy: boolean;
}

interface ErrorClassification {
  isRetriable: boolean;
  isRateLimit: boolean;
  isQuotaExceeded: boolean;
  isAuthError: boolean;
  cooldownMs: number;
}

export class ProviderHealthMonitor {
  private healthMetrics: Map<AIProviderName, ProviderHealthMetrics> = new Map();
  private readonly HEALTH_DECAY_INTERVAL = 60000; // 1 minute
  private readonly MAX_CONSECUTIVE_FAILURES = 5;
  private readonly RATE_LIMIT_COOLDOWN = 60000; // 1 minute
  private readonly QUOTA_EXCEEDED_COOLDOWN = 300000; // 5 minutes
  private readonly AUTH_ERROR_COOLDOWN = 600000; // 10 minutes

  constructor() {
    // Initialize health decay timer
    setInterval(() => this.decayHealthScores(), this.HEALTH_DECAY_INTERVAL);
  }

  /**
   * Initialize health metrics for a provider
   */
  initializeProvider(providerName: AIProviderName): void {
    if (!this.healthMetrics.has(providerName)) {
      this.healthMetrics.set(providerName, {
        successCount: 0,
        errorCount: 0,
        consecutiveFailures: 0,
        lastError: null,
        lastSuccess: null,
        lastErrorType: null,
        healthScore: 100,
        rateLimitUntil: null,
        quotaExceeded: false,
        isHealthy: true,
      });
    }
  }

  /**
   * Record a successful API call
   */
  recordSuccess(providerName: AIProviderName): void {
    this.initializeProvider(providerName);
    const metrics = this.healthMetrics.get(providerName)!;

    metrics.successCount++;
    metrics.consecutiveFailures = 0;
    metrics.lastSuccess = new Date();
    metrics.quotaExceeded = false;
    metrics.rateLimitUntil = null;

    // Improve health score
    metrics.healthScore = Math.min(100, metrics.healthScore + 5);
    metrics.isHealthy = this.calculateHealthStatus(metrics);

    console.log(`[HealthMonitor] ${providerName} success - Health: ${metrics.healthScore}`);
  }

  /**
   * Record a failed API call
   */
  recordFailure(providerName: AIProviderName, error: any): void {
    this.initializeProvider(providerName);
    const metrics = this.healthMetrics.get(providerName)!;

    metrics.errorCount++;
    metrics.consecutiveFailures++;
    metrics.lastError = new Date();

    const classification = this.classifyError(error);
    metrics.lastErrorType = classification.isRateLimit
      ? 'rate_limit'
      : classification.isQuotaExceeded
      ? 'quota_exceeded'
      : classification.isAuthError
      ? 'auth_error'
      : 'general_error';

    // Handle specific error types
    if (classification.isRateLimit) {
      metrics.rateLimitUntil = new Date(Date.now() + this.RATE_LIMIT_COOLDOWN);
      metrics.healthScore = Math.max(0, metrics.healthScore - 30);
      console.warn(`[HealthMonitor] ${providerName} rate limited until ${metrics.rateLimitUntil.toISOString()}`);
    } else if (classification.isQuotaExceeded) {
      metrics.quotaExceeded = true;
      metrics.rateLimitUntil = new Date(Date.now() + this.QUOTA_EXCEEDED_COOLDOWN);
      metrics.healthScore = 0;
      console.error(`[HealthMonitor] ${providerName} quota exceeded - Provider unhealthy`);
    } else if (classification.isAuthError) {
      metrics.rateLimitUntil = new Date(Date.now() + this.AUTH_ERROR_COOLDOWN);
      metrics.healthScore = 0;
      console.error(`[HealthMonitor] ${providerName} authentication error - Check API key`);
    } else {
      metrics.healthScore = Math.max(0, metrics.healthScore - 10);
    }

    // Penalize consecutive failures
    if (metrics.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      metrics.healthScore = Math.max(0, metrics.healthScore - 20);
      console.error(
        `[HealthMonitor] ${providerName} has ${metrics.consecutiveFailures} consecutive failures - Health: ${metrics.healthScore}`
      );
    }

    metrics.isHealthy = this.calculateHealthStatus(metrics);

    if (!metrics.isHealthy) {
      console.warn(`[HealthMonitor] ${providerName} marked as UNHEALTHY - Health: ${metrics.healthScore}`);
    }
  }

  /**
   * Classify error type for appropriate handling
   */
  private classifyError(error: any): ErrorClassification {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code || error?.status || error?.statusCode;

    const isRateLimit =
      errorCode === 429 ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('quota_exceeded') ||
      errorMessage.includes('rate_limit_exceeded');

    const isQuotaExceeded =
      errorMessage.includes('insufficient_quota') ||
      errorMessage.includes('quota exceeded') ||
      errorMessage.includes('billing') ||
      errorMessage.includes('model overloaded') ||  // OpenAI capacity
      errorMessage.includes('capacity') ||          // Anthropic capacity
      (errorCode === 429 && errorMessage.includes('quota'));

    const isAuthError =
      errorCode === 401 ||
      errorCode === 403 ||
      errorMessage.includes('invalid api key') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('unauthorized');

    const isRetriable =
      errorCode === 500 ||
      errorCode === 502 ||
      errorCode === 503 ||
      errorCode === 504 ||
      errorCode === 408 ||  // Request timeout
      errorCode === 522 ||  // Connection timed out
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('enotfound') ||  // DNS errors
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('econnreset');

    let cooldownMs = 0;
    if (isQuotaExceeded) cooldownMs = this.QUOTA_EXCEEDED_COOLDOWN;
    else if (isAuthError) cooldownMs = this.AUTH_ERROR_COOLDOWN;
    else if (isRateLimit) cooldownMs = this.RATE_LIMIT_COOLDOWN;

    return {
      isRetriable,
      isRateLimit,
      isQuotaExceeded,
      isAuthError,
      cooldownMs,
    };
  }

  /**
   * Calculate health status based on metrics
   */
  private calculateHealthStatus(metrics: ProviderHealthMetrics): boolean {
    // Provider is unhealthy if:
    // 1. Health score is below 30
    // 2. Currently rate limited
    // 3. Quota exceeded
    // 4. Too many consecutive failures

    if (metrics.healthScore < 30) return false;
    if (metrics.quotaExceeded) return false;
    if (metrics.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) return false;
    if (metrics.rateLimitUntil && new Date() < metrics.rateLimitUntil) return false;

    return true;
  }

  /**
   * Get health metrics for a provider
   */
  getHealthMetrics(providerName: AIProviderName): ProviderHealthMetrics {
    this.initializeProvider(providerName);
    return { ...this.healthMetrics.get(providerName)! };
  }

  /**
   * Get health score for a provider (0-100)
   */
  getHealthScore(providerName: AIProviderName): number {
    this.initializeProvider(providerName);
    return this.healthMetrics.get(providerName)!.healthScore;
  }

  /**
   * Check if provider is healthy
   */
  isProviderHealthy(providerName: AIProviderName): boolean {
    this.initializeProvider(providerName);
    const metrics = this.healthMetrics.get(providerName)!;

    // Check if rate limit has expired
    if (metrics.rateLimitUntil && new Date() >= metrics.rateLimitUntil) {
      metrics.rateLimitUntil = null;
      metrics.healthScore = Math.min(100, metrics.healthScore + 20);
      metrics.isHealthy = this.calculateHealthStatus(metrics);
    }

    return metrics.isHealthy;
  }

  /**
   * Get all healthy providers sorted by health score
   */
  getHealthyProviders(providers: AIProviderName[]): AIProviderName[] {
    return providers
      .filter((name) => this.isProviderHealthy(name))
      .sort((a, b) => this.getHealthScore(b) - this.getHealthScore(a));
  }

  /**
   * Get best available provider from a list
   */
  getBestProvider(preferredProvider: AIProviderName, fallbacks: AIProviderName[]): AIProviderName | null {
    // Check preferred provider first
    if (this.isProviderHealthy(preferredProvider)) {
      return preferredProvider;
    }

    // Get healthy fallbacks sorted by health score
    const healthyFallbacks = this.getHealthyProviders(fallbacks);
    return healthyFallbacks.length > 0 ? healthyFallbacks[0] : null;
  }

  /**
   * Decay health scores over time (rewards recovery)
   */
  private decayHealthScores(): void {
    const entries = Array.from(this.healthMetrics.entries());
    for (const [name, metrics] of entries) {
      // Gradually improve health score if no recent errors
      const timeSinceLastError = metrics.lastError
        ? Date.now() - metrics.lastError.getTime()
        : Infinity;

      // If no errors in last 5 minutes, start recovering
      if (timeSinceLastError > 300000) {
        metrics.healthScore = Math.min(100, metrics.healthScore + 2);
        metrics.consecutiveFailures = Math.max(0, metrics.consecutiveFailures - 1);
        metrics.isHealthy = this.calculateHealthStatus(metrics);
      }
    }
  }

  /**
   * Get comprehensive health status for all providers
   */
  getAllHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {};

    const entries = Array.from(this.healthMetrics.entries());
    for (const [name, metrics] of entries) {
      status[name] = {
        healthy: metrics.isHealthy,
        healthScore: metrics.healthScore,
        successCount: metrics.successCount,
        errorCount: metrics.errorCount,
        successRate:
          metrics.successCount + metrics.errorCount > 0
            ? ((metrics.successCount / (metrics.successCount + metrics.errorCount)) * 100).toFixed(2)
            : 100,
        consecutiveFailures: metrics.consecutiveFailures,
        lastError: metrics.lastError?.toISOString() || null,
        lastSuccess: metrics.lastSuccess?.toISOString() || null,
        lastErrorType: metrics.lastErrorType,
        rateLimitUntil: metrics.rateLimitUntil?.toISOString() || null,
        quotaExceeded: metrics.quotaExceeded,
      };
    }

    return status;
  }

  /**
   * Reset health metrics for a provider (admin tool)
   */
  resetProviderHealth(providerName: AIProviderName): void {
    this.healthMetrics.delete(providerName);
    this.initializeProvider(providerName);
    console.log(`[HealthMonitor] Reset health metrics for ${providerName}`);
  }
}

// Export singleton instance
export const providerHealthMonitor = new ProviderHealthMonitor();
