/**
 * Agent Orchestration Framework
 * Core coordination service for 87+ AI agents across all professional modes
 * 
 * Responsibilities:
 * - Coordinate agent execution (sequential and parallel)
 * - Manage agent dependencies
 * - Track progress across all agents
 * - Handle errors and implement retry logic
 * - Provide real-time status updates via WebSocket
 */

import { EventEmitter } from 'events';
import type { WebSocket } from 'ws';
import type { AgentDefinition, AgentInput, AgentOutput } from '@shared/types/agentTypes';

// Types
export enum AgentStatus {
  IDLE = 'idle',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number; // 1.5 = 50% longer each retry
  initialDelayMs: number;
}

export interface OrchestrationJob {
  jobId: string;
  conversationId: string;
  userId: string;
  mode: string;
  agents: string[]; // Agent IDs to execute
  input: AgentInput;
  /**
   * Per-job dependency overrides: agentId → list of upstream agent IDs it
   * depends on. If set, these override the `dependencies` field on the agent
   * definitions for this job. Populated from the mode-template configured in
   * agentBootstrap — agents themselves rarely declare dependencies directly.
   */
  dependencies?: Record<string, string[]>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  results: Map<string, AgentOutput>;
  errors: Array<{ agentId: string; error: string; timestamp: Date }>;
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
}

export interface AgentExecutionContext {
  agentId: string;
  jobId: string;
  input: AgentInput;
  dependencies: AgentOutput[]; // Outputs from dependent agents
  attempt: number;
  maxAttempts: number;
}

/**
 * Agent Orchestrator
 * Manages execution of AI agents with dependency resolution and parallel processing
 */
export class AgentOrchestrator extends EventEmitter {
  private agents: Map<string, AgentDefinition> = new Map();
  private activeJobs: Map<string, OrchestrationJob> = new Map();
  private agentStatus: Map<string, AgentStatus> = new Map();
  private wsConnections: Map<string, WebSocket[]> = new Map(); // conversationId -> WebSockets

  constructor() {
    super();
    this.setMaxListeners(100); // Support many agents
  }

  /**
   * Register an agent for orchestration
   */
  registerAgent(agent: AgentDefinition): void {
    this.agents.set(agent.id, agent);
    this.agentStatus.set(agent.id, AgentStatus.IDLE);
    console.log(`[AgentOrchestrator] Registered agent: ${agent.name} (${agent.id})`);
  }

  /**
   * Register multiple agents at once
   */
  registerAgents(agents: AgentDefinition[]): void {
    agents.forEach(agent => this.registerAgent(agent));
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentDefinition | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by mode
   */
  getAgentsByMode(mode: string): AgentDefinition[] {
    return Array.from(this.agents.values()).filter(agent => agent.mode === mode);
  }

  /**
   * Register WebSocket connection for real-time updates
   */
  registerWebSocket(conversationId: string, ws: WebSocket): void {
    if (!this.wsConnections.has(conversationId)) {
      this.wsConnections.set(conversationId, []);
    }
    this.wsConnections.get(conversationId)!.push(ws);

    // Remove on close
    ws.on('close', () => {
      const connections = this.wsConnections.get(conversationId);
      if (connections) {
        const index = connections.indexOf(ws);
        if (index > -1) {
          connections.splice(index, 1);
        }
      }
    });
  }

  /**
   * Execute a set of agents for a conversation
   *
   * `dependencies` is an optional per-job override of the dependency graph —
   * required because individual agent classes rarely declare their own
   * `AgentDefinition.dependencies`; the authoritative graph lives in the
   * mode templates in agentBootstrap.ts and must be plumbed through here.
   */
  async executeAgents(
    conversationId: string,
    userId: string,
    mode: string,
    agentIds: string[],
    input: AgentInput,
    dependencies?: Record<string, string[]>,
  ): Promise<OrchestrationJob> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: OrchestrationJob = {
      jobId,
      conversationId,
      userId,
      mode,
      agents: agentIds,
      input,
      dependencies,
      status: 'pending',
      results: new Map(),
      errors: [],
      progress: {
        total: agentIds.length,
        completed: 0,
        failed: 0,
        percentage: 0,
      },
    };

    this.activeJobs.set(jobId, job);

    // Start execution asynchronously
    this.startExecution(job).catch(error => {
      console.error(`[AgentOrchestrator] Job ${jobId} failed:`, error);
      job.status = 'failed';
      job.endTime = new Date();
      this.broadcastJobUpdate(job);
    });

    return job;
  }

  /**
   * Start executing agents in the job
   */
  private async startExecution(job: OrchestrationJob): Promise<void> {
    job.status = 'running';
    job.startTime = new Date();
    this.broadcastJobUpdate(job);

    // Build dependency graph (per-job overrides take precedence over
    // agent self-declared dependencies — see buildDependencyGraph notes)
    const dependencyGraph = this.buildDependencyGraph(job.agents, job.dependencies);

    // Execute agents in dependency order with parallelization
    await this.executeWithDependencies(job, dependencyGraph);

    // Mark job as completed
    job.status = job.errors.length > 0 ? 'failed' : 'completed';
    job.endTime = new Date();
    this.broadcastJobUpdate(job);

    // Emit completion event
    this.emit('job:completed', job);
  }

  /**
   * Build dependency graph for agents
   *
   * Priority order for each agent's dependency list:
   *   1. Per-job override (`job.dependencies[agentId]`) — populated from the
   *      mode template in agentBootstrap.ts. This is the authoritative source.
   *   2. Agent self-declared `dependencies` on the AgentDefinition.
   *   3. Empty list (agent runs as a root).
   */
  private buildDependencyGraph(
    agentIds: string[],
    overrides?: Record<string, string[]>,
  ): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const agentId of agentIds) {
      const agent = this.agents.get(agentId);
      if (!agent) {
        console.warn(`[AgentOrchestrator] Agent not found: ${agentId}`);
        continue;
      }

      const deps = overrides?.[agentId] ?? agent.dependencies ?? [];
      graph.set(agentId, deps);
    }

    return graph;
  }

  /**
   * Execute agents respecting dependencies and allowing parallel execution
   */
  private async executeWithDependencies(
    job: OrchestrationJob,
    dependencyGraph: Map<string, string[]>
  ): Promise<void> {
    const completed = new Set<string>();
    const failed = new Set<string>();
    const inProgress = new Set<string>();

    while (completed.size + failed.size < job.agents.length) {
      // Find agents ready to execute
      const readyAgents = job.agents.filter(agentId => {
        if (completed.has(agentId) || failed.has(agentId) || inProgress.has(agentId)) {
          return false;
        }

        const dependencies = dependencyGraph.get(agentId) || [];
        return dependencies.every(depId => completed.has(depId));
      });

      if (readyAgents.length === 0) {
        // Check if we're stuck
        if (inProgress.size === 0) {
          // Circular dependency or all remaining agents have failed dependencies
          const remaining = job.agents.filter(
            id => !completed.has(id) && !failed.has(id)
          );
          console.error(`[AgentOrchestrator] Cannot proceed. Remaining agents: ${remaining.join(', ')}`);
          break;
        }

        // Wait for in-progress agents
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Execute ready agents in parallel
      const executions = readyAgents.map(async (agentId) => {
        inProgress.add(agentId);
        const agent = this.agents.get(agentId);

        if (!agent) {
          failed.add(agentId);
          inProgress.delete(agentId);
          return;
        }

        try {
          const mergedInput = this.buildAgentInput(job, agentId, dependencyGraph.get(agentId) || []);
          const context: AgentExecutionContext = {
            agentId,
            jobId: job.jobId,
            input: mergedInput,
            dependencies: this.getDependencyOutputs(job, dependencyGraph.get(agentId) || []),
            attempt: 1,
            maxAttempts: agent.retryConfig?.maxRetries ?? 3,
          };

          const output = await this.executeAgentWithRetry(agent, context);
          
          job.results.set(agentId, output);
          completed.add(agentId);
          job.progress.completed++;

          this.agentStatus.set(agentId, AgentStatus.COMPLETED);
          this.broadcastAgentUpdate(job, agentId, AgentStatus.COMPLETED, output);

        } catch (error: any) {
          failed.add(agentId);
          job.progress.failed++;
          job.errors.push({
            agentId,
            error: error.message || 'Unknown error',
            timestamp: new Date(),
          });

          this.agentStatus.set(agentId, AgentStatus.FAILED);
          this.broadcastAgentUpdate(job, agentId, AgentStatus.FAILED, undefined, error.message);

          console.error(`[AgentOrchestrator] Agent ${agentId} failed:`, error);
        } finally {
          inProgress.delete(agentId);
        }

        // Update progress
        job.progress.percentage = Math.round(
          ((job.progress.completed + job.progress.failed) / job.progress.total) * 100
        );
        this.broadcastJobUpdate(job);
      });

      // Wait for current batch to complete if not allowing parallel execution
      await Promise.all(executions);
    }
  }

  /**
   * Get outputs from dependency agents
   */
  private getDependencyOutputs(job: OrchestrationJob, dependencyIds: string[]): AgentOutput[] {
    return dependencyIds
      .map(id => job.results.get(id))
      .filter((output): output is AgentOutput => output !== undefined);
  }

  /**
   * Assemble the input for a single agent by merging the job's root input
   * with data produced by the agent's upstream dependencies.
   *
   * Previously every agent received only `job.input` (the original user query),
   * so downstream agents in a pipeline couldn't see the output of upstream
   * agents — they always saw `input.data.<expected-field>` as undefined.
   *
   * Merge strategy (first overrides are earliest, later overrides win):
   *   1. Start with `job.input.data` so user-provided fields remain available.
   *   2. Shallow-merge each upstream's `output.data` into input.data, in
   *      dependency-declaration order. This is the "flatten by convention"
   *      path agents generally rely on — e.g. WorkflowParser emits
   *      `{ workflow, nodeCount, edgeCount }`, so NodeGenerator can read
   *      `input.data.workflow.nodes` without knowing its upstream's id.
   *   3. Expose the raw outputs two additional ways so agents that prefer an
   *      explicit lookup can use them:
   *        - `input.data.previousOutputs[<upstreamAgentId>]` (flat dict)
   *        - `input.previousAgentOutputs` (ordered array — declared on the
   *          AgentInput type, was never populated before this change).
   */
  private buildAgentInput(
    job: OrchestrationJob,
    agentId: string,
    dependencyIds: string[],
  ): AgentInput {
    const mergedData: Record<string, any> = { ...(job.input.data ?? {}) };
    const previousOutputs: Record<string, any> = {};
    const previousAgentOutputs: AgentOutput[] = [];

    for (const depId of dependencyIds) {
      const depOut = job.results.get(depId);
      if (!depOut) continue;
      previousAgentOutputs.push(depOut);
      if (depOut.success && depOut.data) {
        previousOutputs[depId] = depOut.data;
        Object.assign(mergedData, depOut.data);
      }
    }

    // Preserve any previousOutputs the caller already set (rare — defensive).
    const existingPrev = (job.input.data?.previousOutputs ?? {}) as Record<string, any>;

    return {
      ...job.input,
      data: {
        ...mergedData,
        previousOutputs: { ...existingPrev, ...previousOutputs },
      },
      previousAgentOutputs: [
        ...(job.input.previousAgentOutputs ?? []),
        ...previousAgentOutputs,
      ],
    };
  }

  /**
   * Execute agent with retry logic
   */
  private async executeAgentWithRetry(
    agent: AgentDefinition,
    context: AgentExecutionContext
  ): Promise<AgentOutput> {
    const maxAttempts = context.maxAttempts;
    let attempt = context.attempt;
    let lastError: Error | null = null;

    while (attempt <= maxAttempts) {
      try {
        this.agentStatus.set(agent.id, attempt === 1 ? AgentStatus.RUNNING : AgentStatus.RETRYING);

        const startTime = new Date();
        const result = await this.executeWithTimeout(
          agent.execute(context.input),
          agent.timeout || 300000 // 5 minute default timeout
        );

        const endTime = new Date();

        return {
          success: result.success,
          data: result.data,
          error: result.error,
          metadata: {
            ...result.metadata,
            executionTime: endTime.getTime() - startTime.getTime(),
            startTime,
            endTime,
            duration: endTime.getTime() - startTime.getTime(),
          },
        };

      } catch (error: any) {
        lastError = error;
        console.error(`[AgentOrchestrator] Agent ${agent.id} attempt ${attempt}/${maxAttempts} failed:`, error);

        if (attempt < maxAttempts) {
          // Calculate delay with exponential backoff
          const delay = this.calculateRetryDelay(attempt, agent.retryConfig);
          console.log(`[AgentOrchestrator] Retrying agent ${agent.id} in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          attempt++;
        } else {
          break;
        }
      }
    }

    // All attempts failed
    throw lastError || new Error(`Agent ${agent.id} failed after ${maxAttempts} attempts`);
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Agent execution timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, config?: RetryConfig): number {
    const initialDelay = config?.initialDelayMs || 1000;
    const multiplier = config?.backoffMultiplier || 1.5;
    return Math.round(initialDelay * Math.pow(multiplier, attempt - 1));
  }

  /**
   * Broadcast job update to connected WebSocket clients
   */
  private broadcastJobUpdate(job: OrchestrationJob): void {
    const connections = this.wsConnections.get(job.conversationId);
    if (!connections || connections.length === 0) return;

    const message = JSON.stringify({
      type: 'job:update',
      data: {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        errors: job.errors,
      },
    });

    connections.forEach(ws => {
      if (ws.readyState === 1) { // OPEN
        ws.send(message);
      }
    });
  }

  /**
   * Broadcast agent status update to connected WebSocket clients
   */
  private broadcastAgentUpdate(
    job: OrchestrationJob,
    agentId: string,
    status: AgentStatus,
    output?: AgentOutput,
    error?: string
  ): void {
    const connections = this.wsConnections.get(job.conversationId);
    if (!connections || connections.length === 0) return;

    const agent = this.agents.get(agentId);

    const message = JSON.stringify({
      type: 'agent:update',
      data: {
        jobId: job.jobId,
        agentId,
        agentName: agent?.name,
        status,
        output,
        error,
        timestamp: new Date().toISOString(),
      },
    });

    connections.forEach(ws => {
      if (ws.readyState === 1) {
        ws.send(message);
      }
    });
  }

  /**
   * Get job status
   */
  getJob(jobId: string): OrchestrationJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get all active jobs for a conversation
   */
  getJobsByConversation(conversationId: string): OrchestrationJob[] {
    return Array.from(this.activeJobs.values()).filter(
      job => job.conversationId === conversationId
    );
  }

  /**
   * Get agent status
   */
  getAgentStatus(agentId: string): AgentStatus {
    return this.agentStatus.get(agentId) || AgentStatus.IDLE;
  }

  /**
   * Get status of all agents
   */
  getAllAgentStatus(): Map<string, AgentStatus> {
    return new Map(this.agentStatus);
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status !== 'running') {
      return false;
    }

    job.status = 'cancelled';
    job.endTime = new Date();
    job.errors.push({
      agentId: 'system',
      error: 'Job cancelled by user',
      timestamp: new Date(),
    });

    this.broadcastJobUpdate(job);
    return true;
  }

  /**
   * Clean up completed jobs (keep only last 100)
   */
  cleanup(): void {
    const jobs = Array.from(this.activeJobs.values())
      .filter(job => job.status === 'completed' || job.status === 'failed')
      .sort((a, b) => (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0));

    if (jobs.length > 100) {
      jobs.slice(100).forEach(job => {
        this.activeJobs.delete(job.jobId);
      });
    }
  }
}

// Singleton instance
export const agentOrchestrator = new AgentOrchestrator();
