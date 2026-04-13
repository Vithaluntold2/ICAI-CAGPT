import { WebSocket } from 'ws';
import { logger } from '../logger';

interface OrchestrationUpdate {
  type: 'orchestration_step';
  sessionId: string;
  step: {
    id: string;
    phase: 'analyzing' | 'selecting' | 'consulting' | 'validating' | 'synthesizing' | 'complete';
    message: string;
    agentsInvolved?: number;
    timestamp: Date;
    metadata?: any;
  };
}

interface ConnectedClient {
  ws: WebSocket;
  sessionId: string;
  userId?: string;
}

export class OrchestrationBroadcaster {
  private clients: Map<string, ConnectedClient> = new Map();

  // Register a WebSocket connection for orchestration updates
  registerClient(ws: WebSocket, sessionId: string, userId?: string): void {
    this.clients.set(sessionId, { ws, sessionId, userId });
    
    ws.on('close', () => {
      this.clients.delete(sessionId);
      logger.info(`Orchestration client disconnected: ${sessionId}`);
    });

    logger.info(`Orchestration client connected: ${sessionId}`);
  }

  // Send orchestration step update to specific session
  sendOrchestrationUpdate(sessionId: string, step: OrchestrationUpdate['step']): void {
    const client = this.clients.get(sessionId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const update: OrchestrationUpdate = {
      type: 'orchestration_step',
      sessionId,
      step
    };

    try {
      client.ws.send(JSON.stringify(update));
    } catch (error) {
      logger.error(`Failed to send orchestration update to ${sessionId}:`, error);
      this.clients.delete(sessionId);
    }
  }

  // Send updates for the complete orchestration process
  async broadcastOrchestrationProcess(
    sessionId: string,
    query: string,
    orchestrationPlan: any
  ): Promise<void> {
    const steps = [
      {
        id: '1',
        phase: 'analyzing' as const,
        message: `Analyzing query: "${query.substring(0, 50)}..."`,
        delay: 800
      },
      {
        id: '2',
        phase: 'selecting' as const,
        message: 'Identifying relevant experts from 103 specialized agents...',
        agentsInvolved: orchestrationPlan.totalAgents || 12,
        delay: 1200
      },
      {
        id: '3',
        phase: 'consulting' as const,
        message: 'Consulting primary experts and gathering specialized insights...',
        agentsInvolved: orchestrationPlan.primaryAgents || 3,
        delay: 2000
      },
      {
        id: '4',
        phase: 'consulting' as const,
        message: 'Gathering additional perspectives from consulting experts...',
        agentsInvolved: orchestrationPlan.consultingAgents || 5,
        delay: 1500
      },
      {
        id: '5',
        phase: 'validating' as const,
        message: 'Validating analysis with compliance and quality assurance experts...',
        agentsInvolved: orchestrationPlan.validationAgents || 2,
        delay: 1000
      },
      {
        id: '6',
        phase: 'synthesizing' as const,
        message: 'Synthesizing multi-agent perspectives into comprehensive response...',
        agentsInvolved: orchestrationPlan.totalAgents || 12,
        delay: 1500
      },
      {
        id: '7',
        phase: 'complete' as const,
        message: 'Multi-agent analysis complete - presenting expert consultation results',
        agentsInvolved: orchestrationPlan.totalAgents || 12,
        delay: 500
      }
    ];

    for (const step of steps) {
      // Check if client is still connected
      if (!this.clients.has(sessionId)) {
        break;
      }

      this.sendOrchestrationUpdate(sessionId, {
        id: step.id,
        phase: step.phase,
        message: step.message,
        agentsInvolved: step.agentsInvolved,
        timestamp: new Date()
      });

      // Wait before next step
      await new Promise(resolve => setTimeout(resolve, step.delay));
    }
  }

  // Get connected clients count
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  // Clean up disconnected clients
  cleanup(): void {
    for (const [sessionId, client] of this.clients) {
      if (client.ws.readyState !== WebSocket.OPEN) {
        this.clients.delete(sessionId);
      }
    }
  }
}

export const orchestrationBroadcaster = new OrchestrationBroadcaster();

// Clean up disconnected clients every 30 seconds
setInterval(() => {
  orchestrationBroadcaster.cleanup();
}, 30000);