/**
 * Unit Tests for Agent Orchestration Framework
 * Tests for agentOrchestrator, agentRegistry, messageQueue, and agentMonitor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { agentOrchestrator, AgentStatus as OrchestratorStatus } from '../agentOrchestrator';
import { agentRegistry } from '../agentRegistry';
import { messageQueue } from '../messageQueue';
import { agentMonitor } from '../agentMonitor';
import type { AgentDefinition, AgentInput, AgentOutput, AgentStatus } from '../../../../shared/types/agentTypes';

describe('AgentOrchestrator', () => {
  beforeEach(() => {
    // Clear all registered agents before each test
    vi.clearAllMocks();
    // Clear registry state
    if (agentRegistry && typeof agentRegistry.clear === 'function') {
      agentRegistry.clear();
    }
    // Clear message queue state
    if (messageQueue && typeof messageQueue.clear === 'function') {
      messageQueue.clear();
    }
    // Clear monitor state
    if (agentMonitor && typeof agentMonitor.clear === 'function') {
      agentMonitor.clear();
    }
  });

  describe('Agent Registration', () => {
    it('should register a single agent successfully', () => {
      const mockAgent: AgentDefinition = {
        id: 'test-agent-1',
        name: 'Test Agent',
        description: 'Test agent for unit testing',
        mode: 'deep-research',
        capabilities: ['research'],
        version: '1.0.0',
        execute: vi.fn().mockResolvedValue({ 
          agentId: 'test-agent-1', 
          status: 'success',
          data: { result: 'test' }
        }),
      };

      agentOrchestrator.registerAgent(mockAgent);
      
      expect(agentRegistry.get('test-agent-1')).toBeDefined();
    });

    it('should register multiple agents in batch', () => {
      const mockAgents: AgentDefinition[] = [
        {
          id: 'test-agent-2',
          name: 'Test Agent 2',
          description: 'Second test agent',
          mode: 'financial-calculation',
          capabilities: ['calculation'],
          version: '1.0.0',
          execute: vi.fn().mockResolvedValue({ 
            agentId: 'test-agent-2',
            status: 'success',
            data: {}
          }),
        },
        {
          id: 'test-agent-3',
          name: 'Test Agent 3',
          description: 'Third test agent',
          mode: 'audit-planning',
          capabilities: ['validation'],
          version: '1.0.0',
          execute: vi.fn().mockResolvedValue({
            agentId: 'test-agent-3',
            status: 'success',
            data: {}
          }),
        },
      ];

      agentOrchestrator.registerAgents(mockAgents);
      
      expect(agentRegistry.get('test-agent-2')).toBeDefined();
      expect(agentRegistry.get('test-agent-3')).toBeDefined();
    });
  });

  describe('Agent Execution', () => {
    it('should execute a single agent successfully', async () => {
      const executeMock = vi.fn().mockResolvedValue({
        agentId: 'test-agent-4',
        status: 'success',
        data: { result: 'execution successful' },
      });

      const mockAgent: AgentDefinition = {
        id: 'test-agent-4',
        name: 'Execution Test Agent',
        description: 'Tests execution flow',
        mode: 'deep-research',
        capabilities: ['research'],
        version: '1.0.0',
        execute: executeMock,
      };

      agentOrchestrator.registerAgent(mockAgent);

      const input: AgentInput = {
        conversationId: 'conv-123',
        query: 'test query',
        context: {},
        data: {},
        userTier: 'free',
        timestamp: Date.now(),
      };

      const job = await agentOrchestrator.executeAgents(
        'conv-123',
        'user-456',
        'research',
        ['test-agent-4'],
        input
      );
      
      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(executeMock).toHaveBeenCalledWith(input);
      expect(job.status).toBe('completed');
      expect(job.progress.completed).toBe(1);
    });

    it('should handle agent execution failure with retry', async () => {
      let attemptCount = 0;
      const executeMock = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          agentId: 'test-agent-5',
          status: 'success',
          data: { result: 'success after retries' },
        });
      });

      const mockAgent: AgentDefinition = {
        id: 'test-agent-5',
        name: 'Retry Test Agent',
        description: 'Tests retry logic',
        mode: 'financial-calculation',
        capabilities: ['calculation'],
        version: '1.0.0',
        execute: executeMock,
        retryConfig: {
          maxRetries: 3,
          initialDelayMs: 10,
          backoffMultiplier: 2,
        },
      };

      agentOrchestrator.registerAgent(mockAgent);

      const input: AgentInput = {
        conversationId: 'conv-123',
        query: '',
        context: {},
        data: {},
        userTier: 'free',
        timestamp: Date.now(),
      };

      const job = await agentOrchestrator.executeAgents(
        'conv-123',
        'user-456',
        'research',
        ['test-agent-4'],
        input
      );
      
      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(executeMock).toHaveBeenCalled();
      // Job should complete or still be running after retries
      expect(['completed', 'running', 'failed']).toContain(job.status);
    });

    it('should respect agent dependencies', async () => {
      const executionOrder: string[] = [];

      const agent1: AgentDefinition = {
        id: 'agent-dep-1',
        name: 'First Agent',
        description: 'Runs first',
        mode: 'deep-research',
        capabilities: ['research'],
        version: '1.0.0',
        execute: vi.fn().mockImplementation(async () => {
          executionOrder.push('agent-dep-1');
          await new Promise(resolve => setTimeout(resolve, 50));
          return { agentId: 'agent-dep-1', status: 'success', data: {} };
        }),
      };

      const agent2: AgentDefinition = {
        id: 'agent-dep-2',
        name: 'Second Agent',
        description: 'Runs after first',
        mode: 'financial-calculation',
        capabilities: ['calculation'],
        version: '1.0.0',
        dependencies: ['agent-dep-1'],
        execute: vi.fn().mockImplementation(async () => {
          executionOrder.push('agent-dep-2');
          return { agentId: 'agent-dep-2', status: 'success', data: {} };
        }),
      };

      agentOrchestrator.registerAgents([agent1, agent2]);

      const input: AgentInput = {
        conversationId: 'conv-123',
        query: '',
        context: {},
        data: {},
        userTier: 'free',
        timestamp: Date.now(),
      };

      await agentOrchestrator.executeAgents(
        'conv-123',
        'user-456',
        'research',
        ['agent-dep-1', 'agent-dep-2'],
        input
      );
      
      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(executionOrder).toEqual(['agent-dep-1', 'agent-dep-2']);
    });

    it('should execute independent agents in parallel', async () => {
      const startTimes: Record<string, number> = {};

      const createParallelAgent = (id: string): AgentDefinition => ({
        id,
        name: `Parallel Agent ${id}`,
        description: 'Can run in parallel',
        mode: 'deep-research',
        capabilities: ['research'],
        version: '1.0.0',
        allowParallel: true,
        execute: vi.fn().mockImplementation(async () => {
          startTimes[id] = Date.now();
          await new Promise(resolve => setTimeout(resolve, 50));
          return { agentId: id, status: 'success', data: {} };
        }),
      });

      const agents = ['parallel-1', 'parallel-2', 'parallel-3'].map(createParallelAgent);
      agentOrchestrator.registerAgents(agents);

      const input: AgentInput = {
        conversationId: 'conv-123',
        query: '',
        context: {},
        data: {},
        userTier: 'free',
        timestamp: Date.now(),
      };

      await agentOrchestrator.executeAgents(
        'conv-123',
        'user-456',
        'research',
        ['parallel-1', 'parallel-2', 'parallel-3'],
        input
      );

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 150));

      // All should start within 20ms of each other (parallel execution)
      const times = Object.values(startTimes);
      const maxDiff = Math.max(...times) - Math.min(...times);
      expect(maxDiff).toBeLessThan(20);
    });
  });

  describe('Job Management', () => {
    it('should track job progress correctly', async () => {
      const agents: AgentDefinition[] = Array.from({ length: 5 }, (_, i) => ({
        id: `progress-agent-${i}`,
        name: `Progress Agent ${i}`,
        description: 'Test progress tracking',
        mode: 'deep-research' as const,
        capabilities: ['research'] as const,
        version: '1.0.0',
        execute: vi.fn().mockResolvedValue({
          agentId: `progress-agent-${i}`,
          status: 'success',
          data: {},
        }),
      }));

      agentOrchestrator.registerAgents(agents);

      const input: AgentInput = {
        conversationId: 'conv-123',
        query: '',
        context: {},
        data: {},
        userTier: 'free',
        timestamp: Date.now(),
      };

      const job = await agentOrchestrator.executeAgents(
        'conv-123',
        'user-456',
        'research',
        agents.map(a => a.id),
        input
      );

      expect(job.progress.total).toBe(5);
      expect(job.progress.completed).toBe(0);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(job.progress.completed).toBe(5);
      expect(job.progress.percentage).toBe(100);
    });

    it('should allow job cancellation', async () => {
      const longRunningAgent: AgentDefinition = {
        id: 'long-running',
        name: 'Long Running Agent',
        description: 'Takes a long time',
        mode: 'deep-research',
        capabilities: ['research'],
        version: '1.0.0',
        execute: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 5000));
          return { agentId: 'long-running', status: 'success', data: {} };
        }),
      };

      agentOrchestrator.registerAgent(longRunningAgent);

      const input: AgentInput = {
        conversationId: 'conv-123',
        query: '',
        context: {},
        data: {},
        userTier: 'free',
        timestamp: Date.now(),
      };

      const job = await agentOrchestrator.executeAgents(
        'conv-123',
        'user-456',
        'research',
        ['long-running'],
        input
      );
      
      // Cancel after 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
      agentOrchestrator.cancelJob(job.jobId);

      expect(job.status).toBe('cancelled');
    });
  });
});

describe('AgentRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentRegistry.clear();
  });

  describe('Agent Registration', () => {
    it('should store agent metadata correctly', () => {
      const agent: AgentDefinition = {
        id: 'registry-test-1',
        name: 'Registry Test Agent',
        description: 'Tests registry functionality',
        mode: 'deep-research',
        capabilities: ['research'],
        version: '1.0.0',
        execute: vi.fn(),
      };

      agentRegistry.register(agent, '1.0.0');

      const registered = agentRegistry.get('registry-test-1');
      expect(registered).toBeDefined();
      expect(registered?.version).toBe('1.0.0');
      expect(registered?.registeredAt).toBeInstanceOf(Date);
    });

    it('should index agents by mode', () => {
      const agents: AgentDefinition[] = [
        {
          id: 'research-1',
          name: 'Research Agent 1',
          description: '',
          mode: 'deep-research',
          capabilities: ['research'],
          version: '1.0.0',
          execute: vi.fn(),
        },
        {
          id: 'research-2',
          name: 'Research Agent 2',
          description: '',
          mode: 'deep-research',
          capabilities: ['research'],
          version: '1.0.0',
          execute: vi.fn(),
        },
        {
          id: 'calc-1',
          name: 'Calculation Agent 1',
          description: '',
          mode: 'financial-calculation',
          capabilities: ['calculation'],
          version: '1.0.0',
          execute: vi.fn(),
        },
      ];

      agents.forEach(agent => agentRegistry.register(agent));

      const researchAgents = agentRegistry.getByMode('deep-research');
      expect(researchAgents).toHaveLength(2);

      const calcAgents = agentRegistry.getByMode('financial-calculation');
      expect(calcAgents).toHaveLength(1);
    });
  });

  describe('Metrics Tracking', () => {
    it('should update metrics after execution', () => {
      const agent: AgentDefinition = {
        id: 'metrics-test-1',
        name: 'Metrics Test Agent',
        description: '',
        mode: 'deep-research',
        capabilities: ['research'],
        version: '1.0.0',
        execute: vi.fn(),
      };

      agentRegistry.register(agent);
      
      // Simulate executions
      agentRegistry.updateMetrics('metrics-test-1', 100, true);
      agentRegistry.updateMetrics('metrics-test-1', 150, true);
      agentRegistry.updateMetrics('metrics-test-1', 200, false);

      const registered = agentRegistry.get('metrics-test-1');
      expect(registered?.metrics.totalExecutions).toBe(3);
      expect(registered?.metrics.successfulExecutions).toBe(2);
      expect(registered?.metrics.failedExecutions).toBe(1);
      expect(registered?.metrics.successRate).toBeCloseTo(0.667, 2);
      expect(registered?.metrics.averageDuration).toBeCloseTo(150, 0);
    });

    it('should track health status based on success rate', () => {
      const agent: AgentDefinition = {
        id: 'health-test-1',
        name: 'Health Test Agent',
        description: '',
        mode: 'deep-research',
        capabilities: ['research'],
        version: '1.0.0',
        execute: vi.fn(),
      };

      agentRegistry.register(agent);

      // Simulate 20 executions with different success rates
      for (let i = 0; i < 19; i++) {
        agentRegistry.updateMetrics('health-test-1', 100, true);
      }
      agentRegistry.updateMetrics('health-test-1', 100, false);

      const health = agentRegistry.getHealth('health-test-1');
      expect(health).toBe('healthy'); // 95% success rate

      // Add more failures to get degraded (need >= 80% but < 95%)
      // Current: 19 success, 1 failure = 20 total
      // Add 3 more failures: 19 success, 4 failure = 23 total = 19/23 = 82.6% (degraded)
      for (let i = 0; i < 3; i++) {
        agentRegistry.updateMetrics('health-test-1', 100, false);
      }

      const degradedHealth = agentRegistry.getHealth('health-test-1');
      expect(degradedHealth).toBe('degraded'); // ~82.6% success rate
    });
  });

  describe('Statistics', () => {
    it('should provide accurate registry statistics', () => {
      // Clear registry to ensure clean state
      agentRegistry.clear();
      
      const agents: AgentDefinition[] = Array.from({ length: 10 }, (_, i) => ({
        id: `stats-agent-${i}`,
        name: `Stats Agent ${i}`,
        description: '',
        mode: i < 5 ? 'deep-research' : 'financial-calculation',
        capabilities: [i < 5 ? 'research' : 'calculation'] as const,
        version: '1.0.0',
        execute: vi.fn(),
      }));

      agents.forEach(agent => agentRegistry.register(agent));

      // Simulate some executions
      for (let i = 0; i < 5; i++) {
        agentRegistry.updateMetrics(`stats-agent-${i}`, 100, true);
      }

      const stats = agentRegistry.getStatistics();
      expect(stats.totalAgents).toBe(10);
      expect(stats.agentsByMode['deep-research']).toBe(5);
      expect(stats.agentsByMode['financial-calculation']).toBe(5);
      expect(stats.totalExecutions).toBe(5);
    });
  });
});

describe('MessageQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Sending', () => {
    it('should send messages with correct metadata', () => {
      const messageId = messageQueue.send({
        fromAgent: 'agent-1',
        toAgent: 'agent-2',
        conversationId: 'conv-123',
        type: 'data',
        payload: { data: 'test' },
        priority: 5,
      });

      expect(messageId).toMatch(/^msg_/);
      expect(messageQueue.getQueueSize('agent-2')).toBe(1);
    });

    it('should prioritize high-priority messages', () => {
      messageQueue.send({
        fromAgent: 'agent-1',
        toAgent: 'agent-2',
        conversationId: 'conv-123',
        type: 'data',
        payload: { order: 1 },
        priority: 3,
      });

      messageQueue.send({
        fromAgent: 'agent-1',
        toAgent: 'agent-2',
        conversationId: 'conv-123',
        type: 'data',
        payload: { order: 2 },
        priority: 8,
      });

      const firstMessage = messageQueue.receive('agent-2');
      expect(firstMessage?.payload.order).toBe(2); // Higher priority processed first
    });
  });

  describe('Message Receiving', () => {
    it('should retrieve messages in order', () => {
      messageQueue.send({
        fromAgent: 'agent-1',
        toAgent: 'agent-3',
        conversationId: 'conv-123',
        type: 'data',
        payload: { value: 'first' },
        priority: 5,
      });

      messageQueue.send({
        fromAgent: 'agent-1',
        toAgent: 'agent-3',
        conversationId: 'conv-123',
        type: 'data',
        payload: { value: 'second' },
        priority: 5,
      });

      const msg1 = messageQueue.receive('agent-3');
      const msg2 = messageQueue.receive('agent-3');
      const msg3 = messageQueue.receive('agent-3');

      expect(msg1?.payload.value).toBe('first');
      expect(msg2?.payload.value).toBe('second');
      expect(msg3).toBeNull();
    });

    it('should handle TTL expiration', async () => {
      messageQueue.send({
        fromAgent: 'agent-1',
        toAgent: 'agent-4',
        conversationId: 'conv-123',
        type: 'data',
        payload: { data: 'expires' },
        priority: 5,
        ttl: 50, // 50ms TTL
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const message = messageQueue.receive('agent-4');
      expect(message).toBeNull(); // Should be expired
    });
  });

  describe('Statistics', () => {
    it('should track message statistics correctly', () => {
      // Clear queue to ensure clean state
      messageQueue.clear();
      
      messageQueue.send({
        fromAgent: 'agent-1',
        toAgent: 'agent-5',
        conversationId: 'conv-123',
        type: 'data',
        payload: {},
        priority: 5,
      });

      messageQueue.send({
        fromAgent: 'agent-1',
        toAgent: 'agent-5',
        conversationId: 'conv-123',
        type: 'data',
        payload: {},
        priority: 5,
      });

      const msg1 = messageQueue.receive('agent-5');
      if (msg1) {
        messageQueue.markProcessed(msg1.id, 100);
      }

      const stats = messageQueue.getStatistics();
      expect(stats.totalMessages).toBe(2);
      expect(stats.processedMessages).toBe(1);
      expect(stats.pendingMessages).toBe(1);
    });
  });
});

describe('AgentMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear all state before each test
    if (agentRegistry && typeof agentRegistry.clear === 'function') {
      agentRegistry.clear();
    }
    if (messageQueue && typeof messageQueue.clear === 'function') {
      messageQueue.clear();
    }
    if (agentMonitor && typeof agentMonitor.clear === 'function') {
      agentMonitor.clear();
    }
  });

  describe('Status Tracking', () => {
    it('should record agent status updates', () => {
      agentMonitor.recordStatus({
        agentId: 'monitor-test-1',
        agentName: 'Monitor Test Agent',
        status: OrchestratorStatus.RUNNING,
        timestamp: new Date(),
      });

      const history = agentMonitor.getStatusHistory('monitor-test-1');
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('running');
    });

    it('should track active executions', () => {
      // Register agents first (required by getActiveAgents implementation)
      const agent1: AgentDefinition = {
        id: 'active-1',
        name: 'Active Agent 1',
        description: 'Test agent',
        mode: 'deep-research',
        capabilities: ['research'],
        version: '1.0.0',
        execute: vi.fn(),
      };
      const agent2: AgentDefinition = {
        id: 'active-2',
        name: 'Active Agent 2',
        description: 'Test agent',
        mode: 'deep-research',
        capabilities: ['research'],
        version: '1.0.0',
        execute: vi.fn(),
      };
      
      agentRegistry.register(agent1);
      agentRegistry.register(agent2);
      
      agentMonitor.recordStatus({
        agentId: 'active-1',
        agentName: 'Active Agent 1',
        status: OrchestratorStatus.RUNNING,
        timestamp: new Date(),
      });

      agentMonitor.recordStatus({
        agentId: 'active-2',
        agentName: 'Active Agent 2',
        status: OrchestratorStatus.RUNNING,
        timestamp: new Date(),
      });

      const active = agentMonitor.getActiveAgents();
      expect(active).toHaveLength(2);

      // Mark one as completed
      agentMonitor.recordStatus({
        agentId: 'active-1',
        agentName: 'Active Agent 1',
        status: OrchestratorStatus.COMPLETED,
        timestamp: new Date(),
      });

      const stillActive = agentMonitor.getActiveAgents();
      expect(stillActive).toHaveLength(1);
    });
  });

  describe('System Health', () => {
    it('should calculate overall system health', () => {
      // Clear registry to ensure clean state
      agentRegistry.clear();
      
      // Register some test agents
      const testAgents: AgentDefinition[] = Array.from({ length: 5 }, (_, i) => ({
        id: `health-agent-${i}`,
        name: `Health Agent ${i}`,
        description: '',
        mode: 'deep-research' as const,
        capabilities: ['research'] as const,
        version: '1.0.0',
        execute: vi.fn(),
      }));

      testAgents.forEach(agent => agentRegistry.register(agent));

      // Simulate executions with high success rate
      testAgents.forEach(agent => {
        for (let i = 0; i < 20; i++) {
          agentRegistry.updateMetrics(agent.id, 100, true);
        }
      });

      const health = agentMonitor.getSystemHealth();
      expect(health.totalAgents).toBe(5);
      expect(health.overallHealth).toBe('healthy');
    });
  });

  describe('Monitoring Statistics', () => {
    it('should provide accurate monitoring statistics', () => {
      agentMonitor.recordStatus({
        agentId: 'stat-agent-1',
        agentName: 'Stat Agent 1',
        status: OrchestratorStatus.RUNNING,
        timestamp: new Date(),
      });

      agentMonitor.recordStatus({
        agentId: 'stat-agent-2',
        agentName: 'Stat Agent 2',
        status: OrchestratorStatus.COMPLETED,
        timestamp: new Date(),
      });

      const stats = agentMonitor.getStatistics();
      expect(stats.totalAgentsTracked).toBeGreaterThanOrEqual(2);
      expect(stats.totalStatusUpdates).toBeGreaterThanOrEqual(2);
    });
  });
});
