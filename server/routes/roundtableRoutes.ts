import express from 'express';
import { requireAuth, getCurrentUserId } from '../middleware/auth';
import { executeWorkflow, getAgentCapabilities } from '../services/agents/agentBootstrap';
import { agentRegistry } from '../services/core/agentRegistry';
import { storage } from '../pgStorage';
import { z } from 'zod';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import {
  RoundtableError,
  RoundtableTimeoutError,
  AgentExecutionError,
  OrchestratorError,
  QuotaExceededError,
  InvalidSessionError,
  PartialFailureError,
  formatErrorResponse,
  RoundtableErrorCode,
} from '../errors/roundtableErrors';

const router = express.Router();

// Rate limiting state (simple in-memory, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10; // requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMs: userLimit.resetAt - now };
  }

  userLimit.count++;
  return { allowed: true };
}

// Event emitter for SSE streaming
const sessionEvents = new EventEmitter();
sessionEvents.setMaxListeners(100); // Allow many concurrent connections

// In-memory session store for roundtable workflows
// In production, this should be Redis or database-backed
interface RoundtableSession {
  sessionId: string;
  userId: string;
  query: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  progress: number;
  currentAgent: string | null;
  agentOutputs: Record<string, any>;
  finalResult: any;
  error: string | null;
  errorCode: RoundtableErrorCode | null;
  errorDetails: ReturnType<typeof formatErrorResponse> | null;
  startedAt: Date;
  completedAt: Date | null;
  successfulAgents: string[];
  failedAgents: string[];
}

// Helper to emit session updates
function emitSessionUpdate(sessionId: string, event: string, data: any) {
  sessionEvents.emit(`session:${sessionId}`, { event, data, timestamp: new Date() });
}

const sessionStore = new Map<string, RoundtableSession>();

// Hybrid approach: in-memory for real-time updates, DB for persistence
// Cleanup old sessions every 30 minutes (keep for 2 hours in memory)
// DB sessions cleaned up periodically by separate job
const SESSION_TTL = 2 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessionStore.entries()) {
    if (now - session.startedAt.getTime() > SESSION_TTL) {
      sessionStore.delete(sessionId);
      console.log('[Roundtable] Cleaned up expired session:', sessionId);
    }
  }
}, 30 * 60 * 1000);

// Database cleanup: remove sessions older than 7 days (runs every 6 hours)
const DB_SESSION_TTL_HOURS = 7 * 24; // 7 days in hours
const DB_CLEANUP_INTERVAL = 6 * 60 * 60 * 1000;
setInterval(async () => {
  try {
    const deletedCount = await storage.cleanupExpiredRoundtableSessions(DB_SESSION_TTL_HOURS);
    if (deletedCount > 0) {
      console.log(`[Roundtable] DB cleanup: removed ${deletedCount} sessions older than ${DB_SESSION_TTL_HOURS / 24} days`);
    }
  } catch (error) {
    console.error('[Roundtable] DB cleanup error:', error);
  }
}, DB_CLEANUP_INTERVAL);

// Helper function to generate workflow summary from agent outputs
function generateWorkflowSummary(agentOutputs: Record<string, any>): string {
  const outputs = Object.entries(agentOutputs);
  if (outputs.length === 0) {
    return 'No agent outputs available.';
  }
  
  const summaryParts: string[] = [];
  
  // Extract key information from each agent's output
  for (const [agentId, output] of outputs) {
    if (output?.success && output?.data) {
      const agentName = agentId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const dataKeys = Object.keys(output.data);
      if (dataKeys.length > 0) {
        summaryParts.push(`${agentName}: ${dataKeys.length} data points collected`);
      }
    }
  }
  
  if (summaryParts.length === 0) {
    return 'Workflow completed but no summary data available.';
  }
  
  return `Workflow Summary:\n${summaryParts.join('\n')}`;
}

// Request validation schemas
const executeSchema = z.object({
  query: z.string().min(10, 'Query must be at least 10 characters'),
  workflowId: z.string().optional().default('default-roundtable'),
  conversationId: z.string().optional(),
});

// Apply authentication to all routes
router.use(requireAuth);

/**
 * POST /api/roundtable/execute
 * Start a new roundtable workflow execution
 */
router.post('/execute', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    
    // Check rate limit
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      const quotaError = new QuotaExceededError('', rateCheck.retryAfterMs);
      return res.status(429).json({
        ...formatErrorResponse(quotaError),
        retryAfter: Math.ceil((rateCheck.retryAfterMs || 60000) / 1000),
      });
    }
    
    // Validate request body
    const parseResult = executeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        code: RoundtableErrorCode.VALIDATION_ERROR,
        details: parseResult.error.errors,
        retryable: false,
        recoveryHint: 'Please check your query and try again.',
      });
    }

    const { query, workflowId, conversationId } = parseResult.data;

    // Generate session ID
    const sessionId = crypto.randomUUID();

    // Create session
    const session: RoundtableSession = {
      sessionId,
      userId,
      query,
      workflowId,
      status: 'pending',
      progress: 0,
      currentAgent: null,
      agentOutputs: {},
      finalResult: null,
      error: null,
      errorCode: null,
      errorDetails: null,
      startedAt: new Date(),
      completedAt: null,
      successfulAgents: [],
      failedAgents: [],
    };

    sessionStore.set(sessionId, session);

    // Persist to database
    try {
      await storage.createRoundtableSession({
        id: sessionId,
        userId,
        query,
        workflowId,
        status: 'pending',
        progress: 0,
        currentAgent: null,
        agentOutputs: {},
        finalResult: null,
        error: null,
        errorCode: null,
        errorDetails: null,
        successfulAgents: [],
        failedAgents: [],
        conversationId: conversationId || null,
      });
    } catch (dbError) {
      console.warn('[Roundtable] Failed to persist session to DB, continuing with in-memory:', dbError);
    }

    // Start workflow execution asynchronously
    session.status = 'running';
    emitSessionUpdate(sessionId, 'workflow-started', { 
      sessionId, 
      workflowId,
      query: query.substring(0, 100),
    });
    
    // Get agent sequence based on workflowId
    const getAgentSequence = (wfId: string): string[] => {
      const sequences: Record<string, string[]> = {
        'default-roundtable': ['expert-assembler', 'discussion-moderator', 'perspective-collector', 
                               'argument-analyzer', 'consensus-synthesizer', 'recommendation-finalizer'],
        'ma-analysis': ['expert-assembler', 'perspective-collector', 'argument-analyzer', 
                        'consensus-synthesizer', 'recommendation-finalizer'],
        'fraud-investigation': ['expert-assembler', 'discussion-moderator', 'argument-analyzer',
                                'consensus-synthesizer', 'recommendation-finalizer'],
        'tax-planning': ['expert-assembler', 'perspective-collector', 'argument-analyzer',
                         'consensus-synthesizer', 'recommendation-finalizer'],
        'audit-execution': ['expert-assembler', 'discussion-moderator', 'perspective-collector',
                            'argument-analyzer', 'consensus-synthesizer', 'recommendation-finalizer'],
      };
      if (!sequences[wfId]) {
        console.warn(`[Roundtable] Unknown workflowId '${wfId}', using default-roundtable sequence`);
      }
      return sequences[wfId] || sequences['default-roundtable'];
    };
    
    const agents = getAgentSequence(workflowId);
    const AGENT_TIMEOUT_MS = 30000; // 30 seconds per agent
    
    const runWithProgress = async () => {
      try {
        // Execute each agent individually and track real progress
        for (let i = 0; i < agents.length; i++) {
          const agentId = agents[i];
          session.currentAgent = agentId;
          session.progress = Math.round((i / agents.length) * 100);
          
          emitSessionUpdate(sessionId, 'agent-started', {
            agent: agentId,
            index: i,
            total: agents.length,
            progress: session.progress,
          });
          
          // Get the actual registered agent
          const agent = agentRegistry.get(agentId);
          
          if (!agent) {
            console.warn(`[Roundtable] Agent not found: ${agentId}, skipping`);
            session.failedAgents.push(agentId);
            continue;
          }
          
          try {
            // Execute the agent with timeout
            const agentInput = {
              conversationId: conversationId || sessionId,
              query,
              context: {},
              userTier: 'premium',
              timestamp: Date.now(),
              data: {
                query,
                workflowId,
                userId,
                previousOutputs: session.agentOutputs,
                domain: workflowId.replace(/-/g, ' '),
              },
            };
            
            const agentPromise = agent.execute(agentInput);
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(new RoundtableTimeoutError(agentId, sessionId, AGENT_TIMEOUT_MS));
              }, AGENT_TIMEOUT_MS);
            });
            
            const agentResult = await Promise.race([agentPromise, timeoutPromise]);
            
            // Store the agent's output
            session.agentOutputs[agentId] = agentResult;
            session.successfulAgents.push(agentId);
            
            // Update registry metrics
            agentRegistry.updateMetrics(agentId, Date.now() - agentInput.timestamp, true);
            
            emitSessionUpdate(sessionId, 'agent-completed', {
              agent: agentId,
              index: i,
              total: agents.length,
              progress: Math.round(((i + 1) / agents.length) * 100),
              output: agentResult.success ? 'success' : 'partial',
            });
            
            console.log(`[Roundtable] Agent ${agentId} completed for session: ${sessionId}`);
            
          } catch (agentError) {
            console.error(`[Roundtable] Agent ${agentId} failed:`, agentError);
            session.failedAgents.push(agentId);
            agentRegistry.updateMetrics(agentId, AGENT_TIMEOUT_MS, false);
            
            emitSessionUpdate(sessionId, 'agent-failed', {
              agent: agentId,
              index: i,
              total: agents.length,
              error: agentError instanceof Error ? agentError.message : 'Unknown error',
            });
            
            // Continue to next agent instead of failing entire workflow
            // This allows partial results
          }
        }
        
        // Check if we have any successful results
        if (session.successfulAgents.length === 0) {
          throw new OrchestratorError(sessionId, 'All agents failed', session.agentOutputs);
        }
        
        // Combine agent outputs into final result
        const finalResult = {
          sessionId,
          workflowId,
          query,
          agentOutputs: session.agentOutputs,
          summary: generateWorkflowSummary(session.agentOutputs),
          successfulAgents: session.successfulAgents,
          failedAgents: session.failedAgents,
          completedAt: new Date(),
        };
        
        // Determine status based on results
        const allSucceeded = session.failedAgents.length === 0;
        session.status = allSucceeded ? 'completed' : 'partial';
        session.progress = 100;
        session.finalResult = finalResult;
        session.completedAt = new Date();
        session.currentAgent = null;
        
        // Persist completion to database
        try {
          await storage.updateRoundtableSession(sessionId, {
            status: session.status as any,
            progress: 100,
            finalResult: finalResult,
            agentOutputs: session.agentOutputs,
            completedAt: session.completedAt,
            currentAgent: null,
            successfulAgents: session.successfulAgents,
            failedAgents: session.failedAgents,
          });
        } catch (dbError) {
          console.warn('[Roundtable] Failed to persist completion to DB:', dbError);
        }
        
        emitSessionUpdate(sessionId, 'workflow-completed', {
          sessionId,
          status: session.status,
          summary: finalResult.summary,
          successfulAgents: session.successfulAgents,
          failedAgents: session.failedAgents,
        });
        
        console.log(`[Roundtable] Workflow completed for session: ${sessionId}`);
      } catch (error) {
        const currentAgent = session.currentAgent;
        session.completedAt = new Date();
        session.currentAgent = null;
        
        // Track failed agent
        if (currentAgent) {
          session.failedAgents.push(currentAgent);
        }
        
        // Determine error type and create appropriate error object
        let roundtableError: RoundtableError;
        
        if (error instanceof RoundtableError) {
          roundtableError = error;
        } else if (error instanceof Error) {
          if (error.message.toLowerCase().includes('timeout')) {
            roundtableError = new RoundtableTimeoutError(currentAgent || 'unknown', sessionId);
          } else if (error.message.toLowerCase().includes('rate') || error.message.includes('429')) {
            roundtableError = new QuotaExceededError(sessionId);
          } else {
            roundtableError = new AgentExecutionError(
              currentAgent || 'unknown',
              sessionId,
              error,
              session.agentOutputs
            );
          }
        } else {
          roundtableError = new OrchestratorError(sessionId, 'Unknown error occurred', session.agentOutputs);
        }
        
        // Check if we have partial results
        const hasPartialResults = session.successfulAgents.length > 0;
        
        if (hasPartialResults && session.failedAgents.length > 0) {
          const partialError = new PartialFailureError(
            sessionId,
            session.successfulAgents,
            session.failedAgents,
            session.agentOutputs
          );
          session.status = 'partial';
          session.error = partialError.message;
          session.errorCode = partialError.code;
          session.errorDetails = formatErrorResponse(partialError);
        } else {
          session.status = 'failed';
          session.error = roundtableError.message;
          session.errorCode = roundtableError.code;
          session.errorDetails = formatErrorResponse(roundtableError);
        }
        
        // Persist failure to database
        try {
          await storage.updateRoundtableSession(sessionId, {
            status: session.status as any,
            error: session.error,
            errorCode: session.errorCode,
            errorDetails: session.errorDetails,
            completedAt: session.completedAt,
            currentAgent: null,
            successfulAgents: session.successfulAgents,
            failedAgents: session.failedAgents,
          });
        } catch (dbError) {
          console.warn('[Roundtable] Failed to persist failure to DB:', dbError);
        }
        
        emitSessionUpdate(sessionId, 'workflow-failed', {
          sessionId,
          ...session.errorDetails,
          successfulAgents: session.successfulAgents,
          failedAgents: session.failedAgents,
        });
        
        console.error(`[Roundtable] Workflow failed for session: ${sessionId}`, roundtableError.message);
      }
    };
    
    runWithProgress();

    // Return session ID immediately
    res.status(202).json({
      success: true,
      sessionId,
      message: 'Roundtable workflow started',
      status: 'running',
    });

  } catch (error) {
    console.error('[Roundtable] Execute error:', error);
    const errorResponse = formatErrorResponse(error instanceof Error ? error : new Error('Unknown error'));
    res.status(500).json({
      ...errorResponse,
      error: 'Failed to start roundtable workflow',
    });
  }
});

/**
 * GET /api/roundtable/stream/:sessionId
 * Server-Sent Events stream for real-time workflow updates
 */
router.get('/stream/:sessionId', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const { sessionId } = req.params;

    const session = sessionStore.get(sessionId);

    if (!session) {
      const invalidError = new InvalidSessionError(sessionId);
      return res.status(404).json(formatErrorResponse(invalidError));
    }

    // Verify ownership
    if (session.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        code: RoundtableErrorCode.UNAUTHORIZED,
        retryable: false,
      });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Send initial state
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send current session state immediately
    sendEvent('connected', {
      sessionId: session.sessionId,
      status: session.status,
      progress: session.progress,
      currentAgent: session.currentAgent,
      successfulAgents: session.successfulAgents,
      failedAgents: session.failedAgents,
    });

    // If already completed/failed/partial, send final state and close
    if (session.status === 'completed' || session.status === 'failed' || session.status === 'partial') {
      const eventName = session.status === 'completed' ? 'workflow-completed' : 'workflow-failed';
      sendEvent(eventName, {
        sessionId: session.sessionId,
        status: session.status,
        error: session.error,
      });
      res.end();
      return;
    }

    // Listen for session events
    const eventHandler = (update: { event: string; data: any; timestamp: Date }) => {
      sendEvent(update.event, update.data);

      // Close connection on terminal events
      if (update.event === 'workflow-completed' || update.event === 'workflow-failed') {
        setTimeout(() => res.end(), 100);
      }
    };

    sessionEvents.on(`session:${sessionId}`, eventHandler);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      sendEvent('heartbeat', { timestamp: new Date() });
    }, 30000);

    // Cleanup on client disconnect
    req.on('close', () => {
      sessionEvents.off(`session:${sessionId}`, eventHandler);
      clearInterval(heartbeatInterval);
      console.log(`[Roundtable] SSE connection closed for session: ${sessionId}`);
    });

  } catch (error) {
    console.error('[Roundtable] Stream error:', error);
    res.status(500).json({
      error: 'Failed to establish stream',
    });
  }
});

/**
 * GET /api/roundtable/status/:sessionId
 * Poll for workflow execution status
 */
router.get('/status/:sessionId', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const { sessionId } = req.params;

    // Check in-memory first, then fall back to database
    let session = sessionStore.get(sessionId);
    
    if (!session) {
      const dbSession = await storage.getRoundtableSession(sessionId);
      if (dbSession) {
        session = {
          sessionId: dbSession.id,
          userId: dbSession.userId,
          query: dbSession.query,
          workflowId: dbSession.workflowId || '',
          status: dbSession.status as RoundtableSession['status'],
          progress: dbSession.progress || 0,
          currentAgent: dbSession.currentAgent,
          agentOutputs: (dbSession.agentOutputs as Record<string, any>) || {},
          finalResult: dbSession.finalResult,
          error: dbSession.error,
          errorCode: dbSession.errorCode as RoundtableErrorCode | null,
          errorDetails: null,
          startedAt: new Date(dbSession.startedAt),
          completedAt: dbSession.completedAt ? new Date(dbSession.completedAt) : null,
          successfulAgents: (dbSession.successfulAgents as string[]) || [],
          failedAgents: (dbSession.failedAgents as string[]) || [],
        };
      }
    }

    if (!session) {
      const invalidError = new InvalidSessionError(sessionId);
      return res.status(404).json(formatErrorResponse(invalidError));
    }

    // Verify ownership
    if (session.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        code: RoundtableErrorCode.UNAUTHORIZED,
        retryable: false,
      });
    }

    res.json({
      sessionId: session.sessionId,
      status: session.status,
      progress: session.progress,
      currentAgent: session.currentAgent,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      error: session.error,
      errorCode: session.errorCode,
      errorDetails: session.errorDetails,
      successfulAgents: session.successfulAgents,
      failedAgents: session.failedAgents,
    });

  } catch (error) {
    console.error('[Roundtable] Status error:', error);
    res.status(500).json(formatErrorResponse(error instanceof Error ? error : new Error('Failed to fetch workflow status')));
  }
});

/**
 * GET /api/roundtable/results/:sessionId
 * Fetch final results of completed workflow
 */
router.get('/results/:sessionId', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const { sessionId } = req.params;

    // Check in-memory first, then fall back to database
    let session = sessionStore.get(sessionId);
    
    if (!session) {
      const dbSession = await storage.getRoundtableSession(sessionId);
      if (dbSession) {
        session = {
          sessionId: dbSession.id,
          userId: dbSession.userId,
          query: dbSession.query,
          workflowId: dbSession.workflowId || '',
          status: dbSession.status as RoundtableSession['status'],
          progress: dbSession.progress || 0,
          currentAgent: dbSession.currentAgent,
          agentOutputs: (dbSession.agentOutputs as Record<string, any>) || {},
          finalResult: dbSession.finalResult,
          error: dbSession.error,
          errorCode: dbSession.errorCode as RoundtableErrorCode | null,
          errorDetails: null,
          startedAt: new Date(dbSession.startedAt),
          completedAt: dbSession.completedAt ? new Date(dbSession.completedAt) : null,
          successfulAgents: (dbSession.successfulAgents as string[]) || [],
          failedAgents: (dbSession.failedAgents as string[]) || [],
        };
      }
    }

    if (!session) {
      const invalidError = new InvalidSessionError(sessionId);
      return res.status(404).json(formatErrorResponse(invalidError));
    }

    // Verify ownership
    if (session.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        code: RoundtableErrorCode.UNAUTHORIZED,
        retryable: false,
      });
    }

    if (session.status === 'running' || session.status === 'pending') {
      return res.status(202).json({
        message: 'Workflow still in progress',
        status: session.status,
        progress: session.progress,
        currentAgent: session.currentAgent,
      });
    }

    if (session.status === 'failed') {
      return res.status(500).json({
        error: 'Workflow failed',
        ...session.errorDetails,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        successfulAgents: session.successfulAgents,
        failedAgents: session.failedAgents,
      });
    }

    // Handle partial results
    if (session.status === 'partial') {
      return res.status(206).json({
        sessionId: session.sessionId,
        status: session.status,
        query: session.query,
        workflowId: session.workflowId,
        agentOutputs: session.agentOutputs,
        partialResult: session.finalResult,
        ...session.errorDetails,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        successfulAgents: session.successfulAgents,
        failedAgents: session.failedAgents,
      });
    }

    res.json({
      sessionId: session.sessionId,
      status: session.status,
      query: session.query,
      workflowId: session.workflowId,
      agentOutputs: session.agentOutputs,
      finalResult: session.finalResult,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    });

  } catch (error) {
    console.error('[Roundtable] Results error:', error);
    res.status(500).json({
      error: 'Failed to fetch workflow results',
    });
  }
});

/**
 * GET /api/roundtable/capabilities
 * Get roundtable agent capabilities
 */
router.get('/capabilities', async (req, res) => {
  try {
    const capabilities = getAgentCapabilities('roundtable');

    res.json({
      mode: 'roundtable',
      ...capabilities,
      description: 'Multi-expert collaborative discussion for complex queries',
    });

  } catch (error) {
    console.error('[Roundtable] Capabilities error:', error);
    res.status(500).json({
      error: 'Failed to fetch capabilities',
    });
  }
});

/**
 * GET /api/roundtable/sessions
 * List user's roundtable sessions (active and recent)
 */
router.get('/sessions', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);

    // Get in-memory sessions (active/recent)
    const memorySessions = Array.from(sessionStore.values())
      .filter((session) => session.userId === userId);
    
    // Get from database (persisted history)
    const dbSessions = await storage.getRoundtableSessionsByUser(userId, 20);
    
    // Merge and deduplicate (prefer in-memory for active sessions)
    const memoryIds = new Set(memorySessions.map(s => s.sessionId));
    const allSessions = [
      ...memorySessions,
      ...dbSessions.filter(s => !memoryIds.has(s.id)).map(s => ({
        sessionId: s.id,
        userId: s.userId,
        query: s.query,
        workflowId: s.workflowId,
        status: s.status,
        progress: s.progress,
        currentAgent: s.currentAgent,
        agentOutputs: s.agentOutputs,
        finalResult: s.finalResult,
        error: s.error,
        errorCode: s.errorCode,
        errorDetails: s.errorDetails,
        startedAt: new Date(s.startedAt),
        completedAt: s.completedAt ? new Date(s.completedAt) : null,
        successfulAgents: (s.successfulAgents as string[]) || [],
        failedAgents: (s.failedAgents as string[]) || [],
      }))
    ]
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 20)
      .map((session) => ({
        sessionId: session.sessionId,
        query: session.query.substring(0, 100) + (session.query.length > 100 ? '...' : ''),
        workflowId: session.workflowId,
        status: session.status,
        progress: session.progress,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      }));

    res.json({
      sessions: allSessions,
      count: allSessions.length,
    });

  } catch (error) {
    console.error('[Roundtable] Sessions error:', error);
    res.status(500).json({
      error: 'Failed to fetch sessions',
    });
  }
});

/**
 * DELETE /api/roundtable/sessions/:sessionId
 * Cancel or delete a session
 */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const { sessionId } = req.params;

    // Check in-memory first
    const session = sessionStore.get(sessionId);
    
    // Also check database
    const dbSession = await storage.getRoundtableSession(sessionId);
    
    if (!session && !dbSession) {
      return res.status(404).json({
        error: 'Session not found',
      });
    }

    // Verify ownership
    const ownerId = session?.userId || dbSession?.userId;
    if (ownerId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
      });
    }

    // Delete from both stores
    sessionStore.delete(sessionId);
    await storage.deleteRoundtableSession(sessionId);

    res.json({
      success: true,
      message: 'Session deleted',
      sessionId,
    });

  } catch (error) {
    console.error('[Roundtable] Delete session error:', error);
    res.status(500).json({
      error: 'Failed to delete session',
    });
  }
});

export default router;
