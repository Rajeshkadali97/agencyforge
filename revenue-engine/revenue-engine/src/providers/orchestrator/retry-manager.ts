import { IProvider } from "../interfaces/index.js";

/**
 * Different retry strategies available
 */
export enum RetryStrategy {
  IMMEDIATE = "immediate",
  LINEAR = "linear",
  EXPONENTIAL = "exponential",
  CIRCUIT_BREAKER = "circuit_breaker",
  NONE = "none"
}

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  strategy: RetryStrategy;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean; // Add randomness to prevent thundering herd
  retryableErrors: Set<string>; // Error codes that should trigger retry
}

/**
 * Result of a retry attempt calculation
 */
export interface RetryDecision {
  shouldRetry: boolean;
  delayMs: number;
  attemptNumber: number;
  reason: string;
}

/**
 * Manages retry logic for provider operations with various strategies
 */
export class RetryManager {
  private readonly defaultConfig: RetryConfig;
  private readonly attemptCounts: Map<string, number> = new Map();

  constructor(defaultConfig: Partial<RetryConfig> = {}) {
    this.defaultConfig = {
      strategy: RetryStrategy.EXPONENTIAL,
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: new Set([
        "TIMEOUT",
        "NETWORK_ERROR", 
        "RATE_LIMITED",
        "SERVICE_UNAVAILABLE",
        "INTERNAL_ERROR"
      ]),
      ...defaultConfig
    };
  }

  /**
   * Determine if we should retry based on error and configuration
   * @param error The error from the previous attempt
   * @param providerId The provider that failed
   * @param operation Description of what was being attempted
   * @param config Optional override for retry configuration
   * @returns Decision on whether and how to retry
   */
  shouldRetry(
    error: any, 
    providerId: string, 
    operation: string,
    config?: Partial<RetryConfig>
  ): RetryDecision {
    const finalConfig = { ...this.defaultConfig, ...config };
    const key = `${providerId}:${operation}`;
    
    // Get current attempt count
    const currentAttempts = this.attemptCounts.get(key) ?? 0;
    
    // Check if we've exceeded max attempts
    if (currentAttempts >= finalConfig.maxAttempts) {
      this.attemptCounts.delete(key); // Reset counter
      return {
        shouldRetry: false,
        delayMs: 0,
        attemptNumber: currentAttempts + 1,
        reason: `Max attempts (${finalConfig.maxAttempts}) exceeded`
      };
    }
    
    // Check if error is retryable
    const errorCode = error?.code || error?.type || "UNKNOWN";
    const isRetryable = finalConfig.retryableErrors.has(errorCode);
    
    if (!isRetryable) {
      this.attemptCounts.delete(key); // Reset counter for non-retryable errors
      return {
        shouldRetry: false,
        delayMs: 0,
        attemptNumber: currentAttempts + 1,
        reason: `Error code '${errorCode}' is not retryable`
      };
    }
    
    // Calculate delay based on strategy
    const delayMs = this.calculateDelay(currentAttempts + 1, finalConfig);
    
    // Increment attempt counter
    this.attemptCounts.set(key, currentAttempts + 1);
    
    return {
      shouldRetry: true,
      delayMs: delayMs,
      attemptNumber: currentAttempts + 1,
      reason: `Attempt ${currentAttempts + 1}/${finalConfig.maxAttempts} failed with retryable error: ${errorCode}`
    };
  }

  /**
   * Calculate delay based on retry strategy
   * @param attemptNumber The attempt number (1-based)
   * @param config The retry configuration
   * @returns Delay in milliseconds
   */
  private calculateDelay(attemptNumber: number, config: RetryConfig): number {
    let baseDelay = 0;
    
    switch (config.strategy) {
      case RetryStrategy.IMMEDIATE:
        baseDelay = 0;
        break;
        
      case RetryStrategy.LINEAR:
        baseDelay = config.baseDelayMs * attemptNumber;
        break;
        
      case RetryStrategy.EXPONENTIAL:
        baseDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1);
        break;
        
      case RetryStrategy.CIRCUIT_BREAKER:
        // For circuit breaker, we'd normally check circuit state
        // For now, fallback to exponential
        baseDelay = config.baseDelayMs * Math.pow(2, attemptNumber - 1);
        break;
        
      case RetryStrategy.NONE:
      default:
        baseDelay = 0;
        break;
    }
    
    // Apply maximum delay cap
    baseDelay = Math.min(baseDelay, config.maxDelayMs);
    
    // Add jitter if enabled (±25% randomness)
    if (config.jitter && baseDelay > 0) {
      const jitterAmount = baseDelay * 0.25;
      const jitter = (Math.random() * 2 - 1) * jitterAmount; // -25% to +25%
      baseDelay += jitter;
    }
    
    return Math.max(0, Math.floor(baseDelay));
  }

  /**
   * Reset the attempt count for a provider/operation
   * @param providerId The provider ID
   * @param operation The operation name
   */
  resetAttemptCount(providerId: string, operation: string): void {
    const key = `${providerId}:${operation}`;
    this.attemptCounts.delete(key);
  }

  /**
   * Get current attempt count for a provider/operation
   * @param providerId The provider ID
   * @param operation The operation name
   * @returns Current attempt count (0 if never attempted)
   */
  getAttemptCount(providerId: string, operation: string): number {
    const key = `${providerId}:${operation}`;
    return this.attemptCounts.get(key) ?? 0;
  }

  /**
   * Clear all retry counters (useful for testing or reset scenarios)
   */
  clearAllCounts(): void {
    this.attemptCounts.clear();
  }
}