export class InterruptionError extends Error {
  public readonly reason: string;
  public readonly timestamp: string;

  constructor(reason: string = 'Operation interrupted') {
    super(reason);
    this.name = 'InterruptionError';
    this.reason = reason;
    this.timestamp = new Date().toISOString();
  }
}

export interface InterruptHandler {
  (reason?: string): Promise<void>;
}

export class InterruptionManager {
  private isInterrupted = false;
  private interruptionReason?: string;
  private handlers: InterruptHandler[] = [];
  private activeTasks: Set<string> = new Set();

  /**
   * Register an interrupt handler
   */
  registerHandler(handler: InterruptHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove an interrupt handler
   */
  removeHandler(handler: InterruptHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Check if execution is interrupted
   */
  checkInterrupted(): void {
    if (this.isInterrupted) {
      throw new InterruptionError(this.interruptionReason);
    }
  }

  /**
   * Start tracking a task
   */
  startTask(taskId: string): void {
    this.activeTasks.add(taskId);
  }

  /**
   * End tracking a task
   */
  endTask(taskId: string): void {
    this.activeTasks.delete(taskId);
  }

  /**
   * Get active task count
   */
  getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  /**
   * Interrupt execution
   */
  async interrupt(reason?: string): Promise<void> {
    if (this.isInterrupted) {
      return; // Already interrupted
    }

    this.isInterrupted = true;
    this.interruptionReason = reason || 'Execution interrupted by user';

    // Execute all interrupt handlers
    const promises = this.handlers.map(async (handler) => {
      try {
        await handler(this.interruptionReason);
      } catch (error) {
        console.error('Interrupt handler failed:', error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Reset interruption state
   */
  reset(): void {
    this.isInterrupted = false;
    this.interruptionReason = undefined;
  }

  /**
   * Get interruption status
   */
  getStatus(): {
    isInterrupted: boolean;
    reason?: string;
    activeTaskCount: number;
  } {
    return {
      isInterrupted: this.isInterrupted,
      reason: this.interruptionReason,
      activeTaskCount: this.activeTasks.size
    };
  }

  /**
   * Create a cancellable promise
   */
  createCancellablePromise<T>(
    promise: Promise<T>,
    taskId?: string
  ): Promise<T> {
    if (taskId) {
      this.startTask(taskId);
    }

    return promise
      .then(result => {
        if (taskId) {
          this.endTask(taskId);
        }
        return result;
      })
      .catch(error => {
        if (taskId) {
          this.endTask(taskId);
        }
        throw error;
      });
  }

  /**
   * Create an interruptible async function wrapper
   */
  wrapAsyncFunction<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    taskId?: string
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      this.checkInterrupted();

      if (taskId) {
        this.startTask(taskId);
      }

      try {
        const result = await fn(...args);
        return result;
      } finally {
        if (taskId) {
          this.endTask(taskId);
        }
      }
    };
  }

  /**
   * Add timeout with interruption support
   */
  withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage?: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage || `Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Clean up timeout if promise resolves
      promise.finally(() => {
        clearTimeout(timeoutId);
      });
    });

    return Promise.race([
      this.createCancellablePromise(promise),
      timeoutPromise
    ]);
  }
}