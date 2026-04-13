/**
 * System Health Monitoring Service
 * Real-time monitoring of all critical system components
 */

import { providerHealthMonitor } from './aiProviders/healthMonitor';
import { getQueueStats } from './hybridJobQueue';
import { getCircuitBreakerStats } from './circuitBreaker';
import CacheService from './hybridCache';
import { storage } from '../pgStorage';
import os from 'os';

export interface SecurityThreat {
  id: string;
  type: 'rate_limit_exceeded' | 'suspicious_activity' | 'failed_auth' | 'brute_force' | 'ddos_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ipAddress: string;
  userId?: string;
  timestamp: Date;
  description: string;
  blocked: boolean;
}

export interface SystemMetrics {
  timestamp: Date;
  uptime: number;
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  cpu: {
    cores: number;
    loadAverage: number[];
    percentage: number;
  };
  health: {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    score: number; // 0-100
    components: {
      database: ComponentHealth;
      redis: ComponentHealth;
      aiProviders: ComponentHealth;
      jobQueues: ComponentHealth;
      circuitBreakers: ComponentHealth;
    };
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message: string;
  lastCheck: Date;
  metrics?: any;
}

export interface RouteHealth {
  path: string;
  method: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  avgResponseTime: number;
  requestCount: number;
  errorRate: number;
  lastError?: string;
  lastErrorTime?: Date;
}

export interface IntegrationHealth {
  name: string;
  type: 'accounting' | 'payment' | 'ai_provider' | 'storage' | 'notification';
  status: 'connected' | 'disconnected' | 'error';
  lastCheck: Date;
  latency?: number;
  errorMessage?: string;
}

class SystemMonitor {
  private threats: SecurityThreat[] = [];
  private routeMetrics: Map<string, RouteHealth> = new Map();
  private readonly MAX_THREAT_HISTORY = 1000;
  private readonly THREAT_RETENTION_HOURS = 24;

  /**
   * Get comprehensive system health metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const [
      databaseHealth,
      redisHealth,
      aiProvidersHealth,
      jobQueuesHealth,
      circuitBreakersHealth
    ] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkAIProvidersHealth(),
      this.checkJobQueuesHealth(),
      this.checkCircuitBreakersHealth()
    ]);

    const components = {
      database: databaseHealth,
      redis: redisHealth,
      aiProviders: aiProvidersHealth,
      jobQueues: jobQueuesHealth,
      circuitBreakers: circuitBreakersHealth
    };

    const overallHealth = this.calculateOverallHealth(components);

    return {
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: this.getMemoryMetrics(),
      cpu: this.getCPUMetrics(),
      health: {
        overall: overallHealth.status,
        score: overallHealth.score,
        components
      }
    };
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    try {
      const start = Date.now();
      await storage.getAllUsers();
      const latency = Date.now() - start;

      return {
        status: latency < 100 ? 'healthy' : latency < 500 ? 'degraded' : 'unhealthy',
        message: latency < 100 ? 'Database responding normally' : `High latency: ${latency}ms`,
        lastCheck: new Date(),
        metrics: { latency }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `Database error: ${error.message}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check cache health (Hybrid: Redis + PostgreSQL)
   */
  private async checkRedisHealth(): Promise<ComponentHealth> {
    try {
      const cacheStats = await CacheService.getStats();
      const healthResult = await CacheService.healthCheck();
      
      if (!healthResult.healthy) {
        return {
          status: 'unhealthy',
          message: 'All cache layers unavailable',
          lastCheck: new Date(),
          metrics: cacheStats
        };
      }

      const layers = [];
      if (healthResult.layers.redis) layers.push('Redis');
      if (healthResult.layers.postgres) layers.push('PostgreSQL');

      return {
        status: healthResult.latencyMs < 50 ? 'healthy' : healthResult.latencyMs < 200 ? 'degraded' : 'unhealthy',
        message: `Cache ready [${layers.join(' + ')}] (${healthResult.latencyMs}ms)`,
        lastCheck: new Date(),
        metrics: { ...cacheStats, latencyMs: healthResult.latencyMs, layers: healthResult.layers }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `Cache error: ${error.message}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check AI providers health
   */
  private async checkAIProvidersHealth(): Promise<ComponentHealth> {
    try {
      const healthStatus = providerHealthMonitor.getAllHealthStatus();
      const providers = Object.values(healthStatus);
      
      const healthyCount = providers.filter((p: any) => p.healthy).length;
      const totalCount = providers.length;
      const healthPercentage = (healthyCount / totalCount) * 100;

      let status: ComponentHealth['status'] = 'healthy';
      if (healthPercentage < 50) status = 'unhealthy';
      else if (healthPercentage < 80) status = 'degraded';

      return {
        status,
        message: `${healthyCount}/${totalCount} providers healthy`,
        lastCheck: new Date(),
        metrics: { healthStatus, healthyCount, totalCount }
      };
    } catch (error: any) {
      return {
        status: 'unknown',
        message: `Failed to check AI providers: ${error.message}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check job queues health
   */
  private async checkJobQueuesHealth(): Promise<ComponentHealth> {
    try {
      const stats = await getQueueStats();
      
      const totalFailed = Object.values(stats)
        .filter((q: any) => typeof q === 'object' && 'failed' in q)
        .reduce((sum: number, q: any) => sum + (q.failed || 0), 0);

      const totalActive = Object.values(stats)
        .filter((q: any) => typeof q === 'object' && 'active' in q)
        .reduce((sum: number, q: any) => sum + (q.active || 0), 0);

      let status: ComponentHealth['status'] = 'healthy';
      if (totalFailed > 100) status = 'unhealthy';
      else if (totalFailed > 50 || totalActive > 100) status = 'degraded';

      return {
        status,
        message: `${totalActive} active, ${totalFailed} failed jobs`,
        lastCheck: new Date(),
        metrics: stats
      };
    } catch (error: any) {
      return {
        status: 'unknown',
        message: `Failed to check queues: ${error.message}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check circuit breakers health
   */
  private async checkCircuitBreakersHealth(): Promise<ComponentHealth> {
    try {
      const stats = getCircuitBreakerStats();
      
      const openBreakers = Object.values(stats)
        .flatMap((category: any) => {
          if (typeof category === 'object' && category !== null) {
            return Object.values(category).filter((breaker: any) => breaker.state === 'open');
          }
          return [];
        });

      let status: ComponentHealth['status'] = 'healthy';
      if (openBreakers.length > 2) status = 'unhealthy';
      else if (openBreakers.length > 0) status = 'degraded';

      return {
        status,
        message: openBreakers.length > 0 
          ? `${openBreakers.length} circuit breakers open` 
          : 'All circuit breakers closed',
        lastCheck: new Date(),
        metrics: stats
      };
    } catch (error: any) {
      return {
        status: 'unknown',
        message: `Failed to check circuit breakers: ${error.message}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Calculate overall system health
   */
  private calculateOverallHealth(components: SystemMetrics['health']['components']): { status: SystemMetrics['health']['overall'], score: number } {
    const weights = {
      database: 30,
      redis: 15,
      aiProviders: 25,
      jobQueues: 15,
      circuitBreakers: 15
    };

    const scores = {
      healthy: 100,
      degraded: 60,
      unhealthy: 20,
      unknown: 50
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [component, weight] of Object.entries(weights)) {
      const health = components[component as keyof typeof components];
      const score = scores[health.status];
      totalScore += score * weight;
      totalWeight += weight;
    }

    const overallScore = Math.round(totalScore / totalWeight);

    let status: SystemMetrics['health']['overall'] = 'healthy';
    if (overallScore < 40) status = 'unhealthy';
    else if (overallScore < 70) status = 'degraded';

    return { status, score: overallScore };
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = (used / total) * 100;

    return {
      total: Math.round(total / 1024 / 1024), // MB
      used: Math.round(used / 1024 / 1024), // MB
      free: Math.round(free / 1024 / 1024), // MB
      percentage: Math.round(percentage)
    };
  }

  /**
   * Get CPU metrics
   */
  private getCPUMetrics() {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();
    
    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const percentage = Math.round(100 - (idle / total * 100));

    return {
      cores: cpus.length,
      loadAverage,
      percentage
    };
  }

  /**
   * Record security threat
   */
  recordThreat(threat: Omit<SecurityThreat, 'id' | 'timestamp'>): void {
    const newThreat: SecurityThreat = {
      ...threat,
      id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    this.threats.unshift(newThreat);
    
    // Cleanup old threats
    this.cleanupThreats();
    
    // Log critical threats
    if (threat.severity === 'critical' || threat.severity === 'high') {
      console.error('[SystemMonitor] Security threat detected:', newThreat);
    }
  }

  /**
   * Get recent security threats
   */
  getThreats(limit = 100): SecurityThreat[] {
    return this.threats.slice(0, limit);
  }

  /**
   * Get threat statistics
   */
  getThreatStats() {
    const now = Date.now();
    const last24h = this.threats.filter(t => 
      now - t.timestamp.getTime() < 24 * 60 * 60 * 1000
    );

    const byType = last24h.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bySeverity = last24h.reduce((acc, t) => {
      acc[t.severity] = (acc[t.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const blocked = last24h.filter(t => t.blocked).length;
    const active = last24h.filter(t => !t.blocked).length;

    return {
      total: last24h.length,
      active,
      blocked,
      resolved: 0, // Can be extended to track resolved threats separately
      byType,
      bySeverity
    };
  }

  /**
   * Cleanup old threats
   */
  private cleanupThreats(): void {
    const cutoffTime = Date.now() - (this.THREAT_RETENTION_HOURS * 60 * 60 * 1000);
    this.threats = this.threats
      .filter(t => t.timestamp.getTime() > cutoffTime)
      .slice(0, this.MAX_THREAT_HISTORY);
  }

  /**
   * Record route metrics
   */
  recordRouteMetrics(path: string, method: string, responseTime: number, isError: boolean): void {
    const key = `${method}:${path}`;
    const existing = this.routeMetrics.get(key);

    if (existing) {
      const totalRequests = existing.requestCount + 1;
      const totalErrors = isError ? existing.errorRate * existing.requestCount + 1 : existing.errorRate * existing.requestCount;
      const totalTime = existing.avgResponseTime * existing.requestCount + responseTime;

      this.routeMetrics.set(key, {
        path,
        method,
        status: this.calculateRouteStatus(totalTime / totalRequests, totalErrors / totalRequests),
        avgResponseTime: totalTime / totalRequests,
        requestCount: totalRequests,
        errorRate: totalErrors / totalRequests,
        lastError: isError ? 'Request failed' : existing.lastError,
        lastErrorTime: isError ? new Date() : existing.lastErrorTime
      });
    } else {
      this.routeMetrics.set(key, {
        path,
        method,
        status: isError ? 'unhealthy' : 'healthy',
        avgResponseTime: responseTime,
        requestCount: 1,
        errorRate: isError ? 1 : 0,
        lastError: isError ? 'Request failed' : undefined,
        lastErrorTime: isError ? new Date() : undefined
      });
    }
  }

  /**
   * Calculate route health status
   */
  private calculateRouteStatus(avgResponseTime: number, errorRate: number): RouteHealth['status'] {
    if (errorRate > 0.1 || avgResponseTime > 5000) return 'unhealthy';
    if (errorRate > 0.05 || avgResponseTime > 2000) return 'degraded';
    return 'healthy';
  }

  /**
   * Get route health metrics
   */
  getRouteHealth(): RouteHealth[] {
    return Array.from(this.routeMetrics.values())
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 50); // Top 50 routes
  }

  /**
   * Check integration health
   */
  async checkIntegrations(): Promise<IntegrationHealth[]> {
    const integrations: IntegrationHealth[] = [];

    // Check payment gateway (Cashfree)
    try {
      const cashfreeStatus = process.env.CASHFREE_APP_ID ? 'connected' : 'disconnected';
      integrations.push({
        name: 'Cashfree Payment Gateway',
        type: 'payment',
        status: cashfreeStatus,
        lastCheck: new Date()
      });
    } catch (error: any) {
      integrations.push({
        name: 'Cashfree Payment Gateway',
        type: 'payment',
        status: 'error',
        lastCheck: new Date(),
        errorMessage: error.message
      });
    }

    // Check AI Providers
    const aiHealth = providerHealthMonitor.getAllHealthStatus();
    for (const [name, health] of Object.entries(aiHealth)) {
      integrations.push({
        name: `AI Provider: ${name}`,
        type: 'ai_provider',
        status: (health as any).healthy ? 'connected' : 'error',
        lastCheck: new Date(),
        errorMessage: (health as any).healthy ? undefined : (health as any).lastErrorType
      });
    }

    return integrations;
  }
}

export const systemMonitor = new SystemMonitor();
