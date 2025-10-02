export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  monitoringPeriodMs: number;
}

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkState();

    if (this.state === CircuitState.OPEN) {
      throw new Error('Circuit breaker is OPEN');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private checkState(): void {
    const now = Date.now();

    if (this.state === CircuitState.OPEN) {
      if (now - this.lastFailureTime >= this.config.recoveryTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      }
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) { // Need 3 consecutive successes to close
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
      }
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

export class ResilienceManager {
  private defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryCondition: (error: Error) => {
      // Retry on network errors and timeouts
      return error.name === 'NetworkError' ||
             error.name === 'TimeoutError' ||
             error.message.includes('timeout') ||
             error.message.includes('ECONNRESET');
    }
  };

  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Execute a function with retry logic
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...this.defaultRetryConfig, ...config };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry this error
        if (finalConfig.retryCondition && !finalConfig.retryCondition(lastError)) {
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt === finalConfig.maxAttempts) {
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          finalConfig.baseDelayMs * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
          finalConfig.maxDelayMs
        );

        // Add jitter to prevent thundering herd
        const jitter = delay * 0.1 * Math.random();
        const finalDelay = delay + jitter;

        console.warn(`Attempt ${attempt} failed, retrying in ${finalDelay.toFixed(0)}ms:`, lastError.message);
        await this.sleep(finalDelay);
      }
    }

    throw lastError!;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async withCircuitBreaker<T>(
    name: string,
    fn: () => Promise<T>,
    config: CircuitBreakerConfig
  ): Promise<T> {
    let circuitBreaker = this.circuitBreakers.get(name);

    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(config);
      this.circuitBreakers.set(name, circuitBreaker);
    }

    return circuitBreaker.execute(fn);
  }

  /**
   * Execute a function with both retry and circuit breaker
   */
  async withResilience<T>(
    name: string,
    fn: () => Promise<T>,
    retryConfig?: Partial<RetryConfig>,
    circuitBreakerConfig?: CircuitBreakerConfig
  ): Promise<T> {
    const resilientFn = circuitBreakerConfig
      ? () => this.withCircuitBreaker(name, fn, circuitBreakerConfig)
      : fn;

    return retryConfig
      ? this.withRetry(resilientFn, retryConfig)
      : resilientFn();
  }

  /**
   * Create a resilient function wrapper
   */
  createResilientFunction<T extends any[], R>(
    name: string,
    fn: (...args: T) => Promise<R>,
    retryConfig?: Partial<RetryConfig>,
    circuitBreakerConfig?: CircuitBreakerConfig
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      return this.withResilience(
        name,
        () => fn(...args),
        retryConfig,
        circuitBreakerConfig
      );
    };
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats(name?: string): Record<string, any> {
    if (name) {
      const breaker = this.circuitBreakers.get(name);
      return breaker ? { [name]: breaker.getStats() } : {};
    }

    const stats: Record<string, any> = {};
    for (const [breakerName, breaker] of this.circuitBreakers) {
      stats[breakerName] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset a specific circuit breaker or all of them
   */
  resetCircuitBreaker(name?: string): void {
    if (name) {
      const breaker = this.circuitBreakers.get(name);
      if (breaker) {
        breaker.reset();
      }
    } else {
      for (const breaker of this.circuitBreakers.values()) {
        breaker.reset();
      }
    }
  }

  /**
   * Execute multiple functions with timeout and error isolation
   */
  async race<T>(promises: Promise<T>[], timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Race timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([...promises, timeoutPromise]);
  }

  /**
   * Execute functions in parallel with error isolation
   */
  async parallel<T>(
    functions: Array<() => Promise<T>>,
    continueOnError: boolean = false
  ): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
    const promises = functions.map(async (fn) => {
      try {
        const result = await fn();
        return { success: true, result };
      } catch (error) {
        if (continueOnError) {
          return { success: false, error: error as Error };
        }
        throw error;
      }
    });

    return Promise.all(promises);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}