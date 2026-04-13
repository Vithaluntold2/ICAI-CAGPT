/**
 * Circuit Breaker Pattern for External Services
 * Prevents cascade failures when AI providers or external APIs fail
 */

// @ts-ignore - opossum types not available
import CircuitBreaker from 'opossum';
import pTimeout from 'p-timeout';

/**
 * Circuit Breaker Options
 */
const DEFAULT_OPTIONS = {
  timeout: 30000, // 30 seconds
  errorThresholdPercentage: 50, // Open circuit if 50% fail
  resetTimeout: 30000, // Try again after 30s
  rollingCountTimeout: 10000, // 10s rolling window
  rollingCountBuckets: 10,
  name: 'default'
};

/**
 * Create a circuit breaker for a function
 */
export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: Partial<typeof DEFAULT_OPTIONS> = {}
): CircuitBreaker<Parameters<T>, ReturnType<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const breaker = new CircuitBreaker(fn, {
    timeout: opts.timeout,
    errorThresholdPercentage: opts.errorThresholdPercentage,
    resetTimeout: opts.resetTimeout,
    rollingCountTimeout: opts.rollingCountTimeout,
    rollingCountBuckets: opts.rollingCountBuckets,
    name: opts.name
  });

  // Event logging
  breaker.on('open', () => {
    console.error(`[CircuitBreaker] ${opts.name} OPEN - too many failures`);
  });

  breaker.on('halfOpen', () => {
    console.warn(`[CircuitBreaker] ${opts.name} HALF-OPEN - testing recovery`);
  });

  breaker.on('close', () => {
    console.log(`[CircuitBreaker] ${opts.name} CLOSED - service recovered`);
  });

  breaker.on('timeout', () => {
    console.warn(`[CircuitBreaker] ${opts.name} timeout after ${opts.timeout}ms`);
  });

  breaker.fallback((error: any) => {
    console.error(`[CircuitBreaker] ${opts.name} fallback triggered:`, error.message);
    throw new Error(`Service ${opts.name} is currently unavailable. Please try again later.`);
  });

  return breaker;
}

/**
 * Wrap async function with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message?: string
): Promise<T> {
  return pTimeout(promise, {
    milliseconds,
    message: message || `Operation timed out after ${milliseconds}ms`
  });
}

/**
 * Circuit Breaker for AI Providers
 */
export const aiProviderBreakers = new Map<string, CircuitBreaker>();

export function getAIProviderBreaker(providerName: string): CircuitBreaker {
  if (!aiProviderBreakers.has(providerName)) {
    const breaker = createCircuitBreaker(
      async (fn: () => Promise<any>) => fn(),
      {
        name: `AI-${providerName}`,
        timeout: 45000, // 45s for AI requests
        errorThresholdPercentage: 40,
        resetTimeout: 60000 // 1 min
      }
    );
    aiProviderBreakers.set(providerName, breaker);
  }
  
  return aiProviderBreakers.get(providerName)!;
}

/**
 * Circuit Breaker for Database Operations
 */
export const databaseBreaker = createCircuitBreaker(
  async (fn: () => Promise<any>) => fn(),
  {
    name: 'Database',
    timeout: 10000, // 10s
    errorThresholdPercentage: 60,
    resetTimeout: 20000
  }
);

/**
 * Circuit Breaker for External APIs (Cashfree, etc.)
 */
export const externalAPIBreaker = createCircuitBreaker(
  async (fn: () => Promise<any>) => fn(),
  {
    name: 'ExternalAPI',
    timeout: 15000, // 15s
    errorThresholdPercentage: 50,
    resetTimeout: 30000
  }
);

/**
 * Get circuit breaker stats
 */
export function getCircuitBreakerStats() {
  const stats: Record<string, any> = {
    database: {
      state: databaseBreaker.status.state,
      stats: databaseBreaker.stats
    },
    externalAPI: {
      state: externalAPIBreaker.status.state,
      stats: externalAPIBreaker.stats
    },
    aiProviders: {}
  };

  aiProviderBreakers.forEach((breaker, name) => {
    stats.aiProviders[name] = {
      state: breaker.status.state,
      stats: breaker.stats
    };
  });

  return stats;
}

export default {
  createCircuitBreaker,
  withTimeout,
  getAIProviderBreaker,
  databaseBreaker,
  externalAPIBreaker,
  getCircuitBreakerStats
};
