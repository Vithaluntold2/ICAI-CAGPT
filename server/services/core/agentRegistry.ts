/**
 * Agent Registry Service
 * Manages agent discovery, lifecycle, and health monitoring
 */

import type { AgentDefinition } from '@shared/types/agentTypes';
import { AgentStatus } from './agentOrchestrator';

export interface AgentMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  lastExecuted?: Date;
  successRate: number;
}

export interface RegisteredAgent extends AgentDefinition {
  registeredAt: Date;
  version: string;
  metrics: AgentMetrics;
  status: AgentStatus;
}

/**
 * Agent Registry
 * Central registry for all AI agents in the system
 */
export class AgentRegistry {
  private agents: Map<string, RegisteredAgent> = new Map();
  private agentsByMode: Map<string, Set<string>> = new Map();

  /**
   * Register a new agent
   */
  register(agent: AgentDefinition, version: string = '1.0.0'): void {
    const registeredAgent: RegisteredAgent = {
      ...agent,
      registeredAt: new Date(),
      version,
      metrics: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        successRate: 0,
      },
      status: 'idle' as AgentStatus,
    };

    this.agents.set(agent.id, registeredAgent);

    // Index by mode
    if (!this.agentsByMode.has(agent.mode)) {
      this.agentsByMode.set(agent.mode, new Set());
    }
    this.agentsByMode.get(agent.mode)!.add(agent.id);

    console.log(`[AgentRegistry] Registered: ${agent.name} v${version}`);
  }

  /**
   * Get agent by ID
   */
  get(agentId: string): RegisteredAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAll(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by mode
   */
  getByMode(mode: string): RegisteredAgent[] {
    const agentIds = this.agentsByMode.get(mode);
    if (!agentIds) return [];
    
    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter((agent): agent is RegisteredAgent => agent !== undefined);
  }

  /**
   * Update agent metrics after execution
   */
  updateMetrics(
    agentId: string,
    duration: number,
    success: boolean
  ): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const metrics = agent.metrics;
    metrics.totalExecutions++;
    
    if (success) {
      metrics.successfulExecutions++;
    } else {
      metrics.failedExecutions++;
    }

    // Update average duration (running average)
    metrics.averageDuration = 
      (metrics.averageDuration * (metrics.totalExecutions - 1) + duration) / 
      metrics.totalExecutions;

    metrics.successRate = metrics.successfulExecutions / metrics.totalExecutions;
    metrics.lastExecuted = new Date();
  }

  /**
   * Get agent health status
   */
  getHealth(agentId: string): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
    const agent = this.agents.get(agentId);
    if (!agent || agent.metrics.totalExecutions === 0) return 'unknown';

    const { successRate, totalExecutions } = agent.metrics;

    if (totalExecutions < 10) return 'unknown'; // Need more data

    if (successRate >= 0.95) return 'healthy';
    if (successRate >= 0.80) return 'degraded';
    return 'unhealthy';
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    const agents = this.getAll();
    const totalExecutions = agents.reduce((sum, a) => sum + a.metrics.totalExecutions, 0);
    const totalSuccessful = agents.reduce((sum, a) => sum + a.metrics.successfulExecutions, 0);

    return {
      totalAgents: agents.length,
      agentsByMode: Object.fromEntries(
        Array.from(this.agentsByMode.entries()).map(([mode, ids]) => [mode, ids.size])
      ),
      totalExecutions,
      overallSuccessRate: totalExecutions > 0 ? totalSuccessful / totalExecutions : 0,
      healthStatus: {
        healthy: agents.filter(a => this.getHealth(a.id) === 'healthy').length,
        degraded: agents.filter(a => this.getHealth(a.id) === 'degraded').length,
        unhealthy: agents.filter(a => this.getHealth(a.id) === 'unhealthy').length,
        unknown: agents.filter(a => this.getHealth(a.id) === 'unknown').length,
      },
    };
  }

  /**
   * Clear all registered agents (for testing)
   */
  clear(): void {
    this.agents.clear();
    this.agentsByMode.clear();
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistry();
