/**
 * Agent Monitor Service
 * Real-time monitoring and status tracking for all agents
 */

import { EventEmitter } from 'events';
import type { AgentStatus } from './agentOrchestrator';
import type { RegisteredAgent } from './agentRegistry';
import { agentRegistry } from './agentRegistry';
import WebSocket from 'ws';

export interface AgentStatusUpdate {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface SystemHealth {
  timestamp: Date;
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  failedAgents: number;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  metrics: {
    averageSuccessRate: number;
    totalExecutions: number;
    activeExecutions: number;
  };
}

/**
 * Agent Monitor
 * Tracks agent status and broadcasts updates via WebSocket
 */
export class AgentMonitor extends EventEmitter {
  private statusHistory: Map<string, AgentStatusUpdate[]> = new Map();
  private activeExecutions: Set<string> = new Set();
  private wsClients: Set<WebSocket> = new Set();
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.startMonitoring();
  }

  /**
   * Register WebSocket client for real-time updates
   */
  registerClient(ws: WebSocket): void {
    this.wsClients.add(ws);
    
    ws.on('close', () => {
      this.wsClients.delete(ws);
    });

    // Send current system health on connect
    this.sendToClient(ws, {
      type: 'system:health',
      data: this.getSystemHealth(),
    });

    console.log(`[AgentMonitor] WebSocket client registered (${this.wsClients.size} total)`);
  }

  /**
   * Record status update for an agent
   */
  recordStatus(update: AgentStatusUpdate): void {
    if (!this.statusHistory.has(update.agentId)) {
      this.statusHistory.set(update.agentId, []);
    }

    const history = this.statusHistory.get(update.agentId)!;
    history.push(update);

    // Keep only last 100 status updates per agent
    if (history.length > 100) {
      history.shift();
    }

    // Track active executions
    if (update.status === 'running') {
      this.activeExecutions.add(update.agentId);
    } else if (update.status === 'completed' || update.status === 'failed') {
      this.activeExecutions.delete(update.agentId);
    }

    // Broadcast to all WebSocket clients
    this.broadcast({
      type: 'agent:status',
      data: update,
    });

    // Emit event for internal listeners
    this.emit('status:update', update);
  }

  /**
   * Get status history for an agent
   */
  getStatusHistory(agentId: string, limit: number = 50): AgentStatusUpdate[] {
    const history = this.statusHistory.get(agentId);
    if (!history) return [];

    return history.slice(-limit);
  }

  /**
   * Get current system health
   */
  getSystemHealth(): SystemHealth {
    const agents = agentRegistry.getAll();
    const stats = agentRegistry.getStatistics();

    const activeCount = this.activeExecutions.size;
    const idleCount = agents.filter(a => !this.activeExecutions.has(a.id)).length;
    const failedCount = agents.filter(a => 
      agentRegistry.getHealth(a.id) === 'unhealthy'
    ).length;

    let overallHealth: 'healthy' | 'degraded' | 'critical';
    if (failedCount === 0 && stats.overallSuccessRate >= 0.95) {
      overallHealth = 'healthy';
    } else if (failedCount < agents.length * 0.1 && stats.overallSuccessRate >= 0.80) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'critical';
    }

    return {
      timestamp: new Date(),
      totalAgents: agents.length,
      activeAgents: activeCount,
      idleAgents: idleCount,
      failedAgents: failedCount,
      overallHealth,
      metrics: {
        averageSuccessRate: stats.overallSuccessRate,
        totalExecutions: stats.totalExecutions,
        activeExecutions: activeCount,
      },
    };
  }

  /**
   * Get detailed agent status
   */
  getAgentStatus(agentId: string): {
    agent: RegisteredAgent | undefined;
    currentStatus: AgentStatus;
    health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    recentHistory: AgentStatusUpdate[];
    isActive: boolean;
  } {
    const agent = agentRegistry.get(agentId);
    const health = agentRegistry.getHealth(agentId);
    const recentHistory = this.getStatusHistory(agentId, 10);
    const currentStatus = recentHistory[recentHistory.length - 1]?.status || 'idle';
    const isActive = this.activeExecutions.has(agentId);

    return {
      agent,
      currentStatus,
      health,
      recentHistory,
      isActive,
    };
  }

  /**
   * Get all active agents
   */
  getActiveAgents(): Array<{
    agentId: string;
    agentName: string;
    startedAt: Date;
    duration: number;
  }> {
    const active: Array<{
      agentId: string;
      agentName: string;
      startedAt: Date;
      duration: number;
    }> = [];

    for (const agentId of Array.from(this.activeExecutions)) {
      const history = this.statusHistory.get(agentId);
      if (!history) continue;

      // Use spread to avoid mutating original array
      const lastRunning = [...history].reverse().find(h => h.status === 'running');
      if (!lastRunning) continue;

      const agent = agentRegistry.get(agentId);
      if (!agent) continue;

      active.push({
        agentId,
        agentName: agent.name,
        startedAt: lastRunning.timestamp,
        duration: Date.now() - lastRunning.timestamp.getTime(),
      });
    }

    return active;
  }

  /**
   * Broadcast message to all WebSocket clients
   */
  private broadcast(message: { type: string; data: any }): void {
    const payload = JSON.stringify(message);
    
    for (const client of Array.from(this.wsClients)) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  /**
   * Send message to specific WebSocket client
   */
  private sendToClient(client: WebSocket, message: { type: string; data: any }): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  /**
   * Start periodic monitoring and health broadcasts
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      const health = this.getSystemHealth();
      
      // Broadcast system health every 5 seconds
      this.broadcast({
        type: 'system:health',
        data: health,
      });

      // Log critical health issues
      if (health.overallHealth === 'critical') {
        console.error('[AgentMonitor] CRITICAL: System health degraded!', {
          failedAgents: health.failedAgents,
          successRate: health.metrics.averageSuccessRate,
        });
      }
    }, 5000);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Get monitoring statistics
   */
  getStatistics() {
    return {
      totalAgentsTracked: this.statusHistory.size,
      totalStatusUpdates: Array.from(this.statusHistory.values())
        .reduce((sum, history) => sum + history.length, 0),
      activeExecutions: this.activeExecutions.size,
      connectedClients: this.wsClients.size,
    };
  }

  /**
   * Clear all monitoring data (for testing)
   */
  clear(): void {
    this.statusHistory.clear();
    this.activeExecutions.clear();
    this.wsClients.clear();
  }
}

// Singleton instance
export const agentMonitor = new AgentMonitor();
