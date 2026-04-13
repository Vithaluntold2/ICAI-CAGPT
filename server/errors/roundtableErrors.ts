/**
 * Custom Error Types for Roundtable Workflows
 * Provides structured error handling with specific error codes and recovery hints
 */

export enum RoundtableErrorCode {
  TIMEOUT = 'ROUNDTABLE_TIMEOUT',
  AGENT_FAILURE = 'AGENT_EXECUTION_FAILED',
  ORCHESTRATION_ERROR = 'ORCHESTRATION_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  INVALID_SESSION = 'INVALID_SESSION',
  UNAUTHORIZED = 'UNAUTHORIZED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PARTIAL_FAILURE = 'PARTIAL_FAILURE',
}

export interface RoundtableErrorDetails {
  code: RoundtableErrorCode;
  message: string;
  agentId?: string;
  sessionId?: string;
  partialResults?: any;
  retryable: boolean;
  recoveryHint?: string;
}

/**
 * Base error class for all Roundtable-related errors
 */
export class RoundtableError extends Error {
  public readonly code: RoundtableErrorCode;
  public readonly retryable: boolean;
  public readonly recoveryHint?: string;
  public readonly agentId?: string;
  public readonly sessionId?: string;
  public readonly partialResults?: any;
  public readonly timestamp: Date;

  constructor(details: RoundtableErrorDetails) {
    super(details.message);
    this.name = 'RoundtableError';
    this.code = details.code;
    this.retryable = details.retryable;
    this.recoveryHint = details.recoveryHint;
    this.agentId = details.agentId;
    this.sessionId = details.sessionId;
    this.partialResults = details.partialResults;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RoundtableError);
    }
  }

  toJSON(): RoundtableErrorDetails & { timestamp: string } {
    return {
      code: this.code,
      message: this.message,
      agentId: this.agentId,
      sessionId: this.sessionId,
      partialResults: this.partialResults,
      retryable: this.retryable,
      recoveryHint: this.recoveryHint,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

/**
 * Agent took too long to respond (>30 seconds default)
 */
export class RoundtableTimeoutError extends RoundtableError {
  constructor(agentId: string, sessionId: string, timeoutMs: number = 30000) {
    super({
      code: RoundtableErrorCode.TIMEOUT,
      message: `Agent '${agentId}' timed out after ${timeoutMs / 1000} seconds`,
      agentId,
      sessionId,
      retryable: true,
      recoveryHint: 'The agent is taking longer than expected. Try again or simplify your query.',
    });
    this.name = 'RoundtableTimeoutError';
  }
}

/**
 * Individual agent execution failed
 */
export class AgentExecutionError extends RoundtableError {
  constructor(agentId: string, sessionId: string, originalError: Error, partialResults?: any) {
    super({
      code: RoundtableErrorCode.AGENT_FAILURE,
      message: `Agent '${agentId}' failed: ${originalError.message}`,
      agentId,
      sessionId,
      partialResults,
      retryable: true,
      recoveryHint: 'An expert agent encountered an issue. Retrying may resolve it.',
    });
    this.name = 'AgentExecutionError';
  }
}

/**
 * Workflow orchestration failed
 */
export class OrchestratorError extends RoundtableError {
  constructor(sessionId: string, reason: string, partialResults?: any) {
    super({
      code: RoundtableErrorCode.ORCHESTRATION_ERROR,
      message: `Workflow orchestration failed: ${reason}`,
      sessionId,
      partialResults,
      retryable: true,
      recoveryHint: 'The workflow coordination encountered an issue. Please try again.',
    });
    this.name = 'OrchestratorError';
  }
}

/**
 * Rate limit or quota exceeded
 */
export class QuotaExceededError extends RoundtableError {
  public readonly retryAfterMs: number;

  constructor(sessionId: string, retryAfterMs: number = 60000) {
    super({
      code: RoundtableErrorCode.QUOTA_EXCEEDED,
      message: `Rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before retrying.`,
      sessionId,
      retryable: true,
      recoveryHint: `You've reached the usage limit. Please wait ${Math.ceil(retryAfterMs / 1000)} seconds.`,
    });
    this.name = 'QuotaExceededError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Session not found or expired
 */
export class InvalidSessionError extends RoundtableError {
  constructor(sessionId: string) {
    super({
      code: RoundtableErrorCode.INVALID_SESSION,
      message: `Session '${sessionId}' not found or has expired`,
      sessionId,
      retryable: false,
      recoveryHint: 'This session has expired. Please start a new workflow.',
    });
    this.name = 'InvalidSessionError';
  }
}

/**
 * Partial workflow failure - some agents succeeded
 */
export class PartialFailureError extends RoundtableError {
  public readonly successfulAgents: string[];
  public readonly failedAgents: string[];

  constructor(
    sessionId: string,
    successfulAgents: string[],
    failedAgents: string[],
    partialResults: any
  ) {
    super({
      code: RoundtableErrorCode.PARTIAL_FAILURE,
      message: `Workflow partially completed: ${failedAgents.length} of ${successfulAgents.length + failedAgents.length} agents failed`,
      sessionId,
      partialResults,
      retryable: true,
      recoveryHint: 'Some experts completed successfully. You can view partial results or retry.',
    });
    this.name = 'PartialFailureError';
    this.successfulAgents = successfulAgents;
    this.failedAgents = failedAgents;
  }
}

/**
 * Helper to format error for API response
 */
export function formatErrorResponse(error: Error | RoundtableError): {
  error: string;
  code?: string;
  retryable?: boolean;
  recoveryHint?: string;
  partialResults?: any;
} {
  if (error instanceof RoundtableError) {
    return {
      error: error.message,
      code: error.code,
      retryable: error.retryable,
      recoveryHint: error.recoveryHint,
      partialResults: error.partialResults,
    };
  }

  // Generic error
  return {
    error: error.message || 'An unexpected error occurred',
    retryable: true,
    recoveryHint: 'Please try again. If the problem persists, contact support.',
  };
}

/**
 * Helper to determine if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof RoundtableError) {
    return error.retryable;
  }
  
  // Check for common retryable error patterns
  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'timeout',
    'network',
    'connection',
    'econnreset',
    'econnrefused',
    'rate limit',
    'too many requests',
    'service unavailable',
    '503',
    '429',
  ];
  
  return retryablePatterns.some(pattern => message.includes(pattern));
}
