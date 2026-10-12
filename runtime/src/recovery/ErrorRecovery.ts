import { ILogger } from '../interfaces';
import { RuntimeEvent, createRuntimeEvent, RuntimeEventTypes } from '../contracts';
import { IEventBus } from '../interfaces';
import { CancellationToken, CancellationError } from '../utils/cancellation';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

export interface FallbackConfig<T> {
  fallbackValue: T;
  fallbackFunction?: () => Promise<T>;
  triggerErrors?: string[];
}

export interface TimeoutConfig {
  timeoutMs: number;
  onTimeout?: () => void;
}

export interface CheckpointConfig {
  checkpointId: string;
  data: unknown;
  ttlMs?: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  halfOpenMaxCalls: number;
}

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface IErrorRecovery {
  executeWithRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig,
    cancellationToken?: CancellationToken
  ): Promise<T>;

  executeWithFallback<T>(
    fn: () => Promise<T>,
    config: FallbackConfig<T>
  ): Promise<T>;

  executeWithTimeout<T>(
    fn: () => Promise<T>,
    config: TimeoutConfig,
    cancellationToken?: CancellationToken
  ): Promise<T>;

  executeWithCircuitBreaker<T>(
    fn: () => Promise<T>,
    config: CircuitBreakerConfig
  ): Promise<T>;

  saveCheckpoint(checkpoint: CheckpointConfig): void;
  getCheckpoint(checkpointId: string): unknown | undefined;
  clearCheckpoint(checkpointId: string): boolean;

  isRetryableError(error: Error, config: RetryConfig): boolean;
  createRecoveryStrategy(config: RecoveryStrategyConfig): RecoveryStrategy;
}

export interface RecoveryStrategyConfig {
  retry?: RetryConfig;
  fallback?: FallbackConfig<unknown>;
  timeout?: TimeoutConfig;
  circuitBreaker?: CircuitBreakerConfig;
}

export interface RecoveryStrategy {
  execute<T>(fn: () => Promise<T>, cancellationToken?: CancellationToken): Promise<T>;
}

export class ErrorRecovery implements IErrorRecovery {
  private checkpoints: Map<string, { data: unknown; expiresAt?: number }> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private circuitBreakerFailures: Map<string, number> = new Map();
  private circuitBreakerSuccesses: Map<string, number> = new Map();
  private circuitBreakerTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private eventBus: IEventBus,
    private logger: ILogger,
    private traceId: string,
    private spanId: string
  ) {}

  async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig,
    cancellationToken?: CancellationToken
  ): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= config.maxRetries) {
      try {
        if (cancellationToken?.isCancelled) {
          throw new CancellationError('Operation cancelled');
        }

        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.isRetryableError(lastError, config)) {
          throw lastError;
        }

        attempt++;

        if (attempt > config.maxRetries) {
          throw lastError;
        }

        if (cancellationToken?.isCancelled) {
          throw new CancellationError('Operation cancelled');
        }

        const delay = Math.min(
          config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelayMs
        );

        config.onRetry?.(attempt, lastError);

        this.emitRecoveryEvent('retry', {
          attempt,
          maxRetries: config.maxRetries,
          error: lastError.message,
          delayMs: delay,
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  async executeWithFallback<T>(
    fn: () => Promise<T>,
    config: FallbackConfig<T>
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (config.triggerErrors && !config.triggerErrors.some((e) => errorMessage.includes(e))) {
        throw error;
      }

      this.emitRecoveryEvent('fallback', {
        error: errorMessage,
        usingFallback: true,
      });

      if (config.fallbackFunction) {
        return config.fallbackFunction();
      }

      return config.fallbackValue;
    }
  }

  async executeWithTimeout<T>(
    fn: () => Promise<T>,
    config: TimeoutConfig,
    cancellationToken?: CancellationToken
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(async () => {
        config.onTimeout?.();
        this.emitRecoveryEvent('timeout', {
          timeoutMs: config.timeoutMs,
        });
        reject(new TimeoutError(`Operation timed out after ${config.timeoutMs}ms`));
      }, config.timeoutMs);

      const promise = fn();

      promise
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });

      cancellationToken?.onCancelled(() => {
        clearTimeout(timeout);
        reject(new CancellationError('Operation cancelled'));
      });
    });
  }

  async executeWithCircuitBreaker<T>(
    fn: () => Promise<T>,
    config: CircuitBreakerConfig
  ): Promise<T> {
    const breakerId = this.getBreakerId(fn);
    const state = this.circuitBreakers.get(breakerId) || 'closed';

    if (state === 'open') {
      throw new CircuitBreakerOpenError('Circuit breaker is open');
    }

    try {
      const result = await fn();

      this.recordSuccess(breakerId, config);
      return result;
    } catch (error) {
      this.recordFailure(breakerId, config);
      throw error;
    }
  }

  saveCheckpoint(checkpoint: CheckpointConfig): void {
    const expiresAt = checkpoint.ttlMs ? Date.now() + checkpoint.ttlMs : undefined;
    this.checkpoints.set(checkpoint.checkpointId, {
      data: checkpoint.data,
      expiresAt,
    });

    this.emitRecoveryEvent('checkpoint_saved', {
      checkpointId: checkpoint.checkpointId,
      ttlMs: checkpoint.ttlMs,
    });
  }

  getCheckpoint(checkpointId: string): unknown | undefined {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return undefined;
    }

    if (checkpoint.expiresAt && Date.now() > checkpoint.expiresAt) {
      this.checkpoints.delete(checkpointId);
      return undefined;
    }

    return checkpoint.data;
  }

  clearCheckpoint(checkpointId: string): boolean {
    return this.checkpoints.delete(checkpointId);
  }

  isRetryableError(error: Error, config: RetryConfig): boolean {
    if (!config.retryableErrors) {
      return true;
    }

    return config.retryableErrors.some((e) => error.message.includes(e));
  }

  createRecoveryStrategy(config: RecoveryStrategyConfig): RecoveryStrategy {
    return {
      execute: async <T>(fn: () => Promise<T>, cancellationToken?: CancellationToken): Promise<T> => {
        let result: T;

        if (config.timeout) {
          result = await this.executeWithTimeout(fn, config.timeout, cancellationToken);
        } else {
          result = await fn();
        }

        if (config.circuitBreaker) {
          result = await this.executeWithCircuitBreaker(() => Promise.resolve(result), config.circuitBreaker);
        }

        if (config.retry) {
          result = await this.executeWithRetry(() => Promise.resolve(result), config.retry, cancellationToken);
        }

        if (config.fallback) {
          result = await this.executeWithFallback(() => Promise.resolve(result), config.fallback as FallbackConfig<T>);
        }

        return result;
      },
    };
  }

  private recordSuccess(breakerId: string, config: CircuitBreakerConfig): void {
    const failures = this.circuitBreakerFailures.get(breakerId) || 0;
    const successes = (this.circuitBreakerSuccesses.get(breakerId) || 0) + 1;

    this.circuitBreakerSuccesses.set(breakerId, successes);

    const state = this.circuitBreakers.get(breakerId) || 'closed';

    if (state === 'half-open' && successes >= config.successThreshold) {
      this.circuitBreakers.set(breakerId, 'closed');
      this.circuitBreakerFailures.set(breakerId, 0);
      this.circuitBreakerSuccesses.set(breakerId, 0);
      this.emitRecoveryEvent('circuit_breaker_closed', { breakerId });
    }
  }

  private recordFailure(breakerId: string, config: CircuitBreakerConfig): void {
    const failures = (this.circuitBreakerFailures.get(breakerId) || 0) + 1;
    this.circuitBreakerFailures.set(breakerId, failures);

    const state = this.circuitBreakers.get(breakerId) || 'closed';

    if (state === 'closed' && failures >= config.failureThreshold) {
      this.circuitBreakers.set(breakerId, 'open');
      this.circuitBreakerSuccesses.set(breakerId, 0);

      const timer = setTimeout(() => {
        this.circuitBreakers.set(breakerId, 'half-open');
        this.emitRecoveryEvent('circuit_breaker_half_open', { breakerId });
      }, config.timeoutMs);

      this.circuitBreakerTimers.set(breakerId, timer);
      this.emitRecoveryEvent('circuit_breaker_open', { breakerId, failures });
    }
  }

  private getBreakerId<T>(fn: () => Promise<T>): string {
    return `breaker_${fn.name || 'anonymous'}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private emitRecoveryEvent(eventType: string, payload: Record<string, unknown>): void {
    const event = createRuntimeEvent(
      RuntimeEventTypes.SYSTEM_WARNING,
      {
        workflowId: this.traceId,
        taskId: this.spanId,
        timestamp: new Date().toISOString(),
        traceId: this.traceId,
        spanId: this.spanId,
        ...payload,
      },
      this.traceId,
      this.spanId
    );

    this.eventBus.publish(event);
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export function createErrorRecovery(
  eventBus: IEventBus,
  logger: ILogger,
  traceId: string,
  spanId: string
): ErrorRecovery {
  return new ErrorRecovery(eventBus, logger, traceId, spanId);
}