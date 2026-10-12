import { IProvider } from "../interfaces/index.js";

/**
 * State of the circuit breaker
 */
export enum CircuitBreakerState {
  CLOSED = "closed",      // Normal operation, requests pass through
  OPEN = "open",          // Circuit is open, requests fail fast
  HALF_OPEN = "half_open" // Testing if service has recovered
}

/**
 * Configuration for circuit breaker behavior
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures to trip the circuit
  recoveryTimeoutMs: number;     // Time to wait before trying half-open
  successThreshold: number;      // Successes needed in half-open to close
  timeoutMs: number;             // Timeout for individual requests
  rollingWindowSize: number;     // Number of requests to consider for failure rate
  minimumRequests: number;       // Minimum requests before calculating failure rate
}

/**
 * Statistics for circuit breaker decision making
 */
export interface CircuitBreakerStats {
  totalRequests: number;
  failedRequests: number;
  successCount: number;
  lastFailureTime: number | null;
  stateChangedTime: number;
}

/**
 * Circuit breaker implementation for preventing cascade failures
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private readonly config: CircuitBreakerConfig;
  private readonly stats: Map<string, CircuitBreakerStats> = new Map();
  private readonly timeouts: Map<string, number> = new Map();

  constructor(private readonly providerId: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeoutMs: 60000, // 1 minute
      successThreshold: 3,
      timeoutMs: 5000, // 5 seconds
      rollingWindowSize: 10,
      minimumRequests: 5,
      ...config
    };
    
    // Initialize stats for this provider
    if (!this.stats.has(this.providerId)) {
      this.stats.set(this.providerId, {
        totalRequests: 0,
        failedRequests: 0,
        successCount: 0,
        lastFailureTime: null,
        stateChangedTime: Date.now()
      });
    }
  }

  /**
   * Execute a function with circuit breaker protection
   * @param operationFn The async function to execute
   * @returns Promise resolving to the function result or rejecting with error
   */
  async execute<T>(operationFn: () => Promise<T>): Promise<T> {
    // Check if we should allow the request based on circuit state
    if (!this.canExecute()) {
      throw this.createCircuitOpenError();
    }

    // Execute with timeout
    const timeoutId = setTimeout(() => {
      /* timeout handled by race */
    }, this.config.timeoutMs);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);
    });

    try {
      const result = await Promise.race([
        operationFn(),
        timeoutPromise
      ]);

      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if the circuit breaker allows execution
   * @returns True if request should be allowed, false if it should fail fast
   */
  private canExecute(): boolean {
    const stats = this.stats.get(this.providerId);
    if (!stats) return true; // No stats yet, allow
    
    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        // Check if we should trip to open
        if (this.shouldTripToOpen(stats)) {
          this.open();
          return false;
        }
        return true;
        
      case CircuitBreakerState.OPEN:
        // Check if we should try half-open
        if (this.shouldAttemptReset()) {
          this.halfOpen();
          return true;
        }
        return false;
        
      case CircuitBreakerState.HALF_OPEN:
        // Allow limited requests to test recovery
        return true;
    }
  }

  /**
   * Determine if we should trip from closed to open
   * @param stats Current statistics
   * @returns True if circuit should trip to open
   */
  private shouldTripToOpen(stats: CircuitBreakerStats): boolean {
    // Need minimum requests before evaluating
    if (stats.totalRequests < this.config.minimumRequests) {
      return false;
    }
    
    const failureRate = stats.failedRequests / stats.totalRequests;
    return failureRate >= (this.config.failureThreshold / this.config.rollingWindowSize);
  }

  /**
   * Determine if we should attempt to reset from open to half-open
   * @returns True if we should try half-open
   */
  private shouldAttemptReset(): boolean {
    const stats = this.stats.get(this.providerId);
    if (!stats) return false;
    
    const timeSinceOpen = Date.now() - stats.stateChangedTime;
    return timeSinceOpen >= this.config.recoveryTimeoutMs;
  }

  /**
   * Handle successful execution
   */
  onSuccess(): void {
    const stats = this.stats.get(this.providerId);
    if (!stats) return;
    
    stats.totalRequests++;
    // Note: In a real implementation, we'd track successes in the rolling window
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      stats.successCount++;
      if (stats.successCount >= this.config.successThreshold) {
        this.close();
      }
    }
  }

  /**
   * Handle failed execution
   */
  onFailure(): void {
    const stats = this.stats.get(this.providerId);
    if (!stats) return;
    
    stats.totalRequests++;
    stats.failedRequests++;
    stats.lastFailureTime = Date.now();
    
    if (this.state === CircuitBreakerState.CLOSED && 
        this.shouldTripToOpen(stats)) {
      this.open();
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Any failure in half-open state goes back to open
      this.open();
    }
  }

  /**
   * Transition to closed state
   */
  private close(): void {
    this.transitionTo(CircuitBreakerState.CLOSED);
    
    // Reset success count for half-open state tracking
    const stats = this.stats.get(this.providerId);
    if (stats) {
      stats.successCount = 0;
    }
  }

  /**
   * Transition to open state
   */
  private open(): void {
    this.transitionTo(CircuitBreakerState.OPEN);
    
    // Schedule automatic half-open attempt after timeout
    if (this.timeouts.has(this.providerId)) {
      clearTimeout(this.timeouts.get(this.providerId)!);
    }

    const timeout = (setTimeout as typeof window.setTimeout)(() => {
      this.attemptReset();
    }, this.config.recoveryTimeoutMs);

    this.timeouts.set(this.providerId, timeout);
  }

  /**
   * Transition to half-open state
   */
  private halfOpen(): void {
    this.transitionTo(CircuitBreakerState.HALF_OPEN);
    
    // Reset success count when entering half-open
    const stats = this.stats.get(this.providerId);
    if (stats) {
      stats.successCount = 0;
    }
  }

  /**
   * Attempt to reset the circuit breaker to half-open
   */
  private attemptReset(): void {
    if (this.state === CircuitBreakerState.OPEN) {
      this.halfOpen();
    }
  }

  /**
   * Transition to a new state
   * @param newState The state to transition to
   */
  private transitionTo(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;
    
    const stats = this.stats.get(this.providerId);
    if (stats) {
      stats.stateChangedTime = Date.now();
    }
    
    // In a real implementation, we might emit events here
    console.debug(`Circuit breaker for ${this.providerId}: ${oldState} -> ${newState}`);
  }

  /**
   * Create an error indicating the circuit is open
   * @returns Error indicating circuit breaker is open
   */
  private createCircuitOpenError(): Error {
    const stats = this.stats.get(this.providerId);
    return new Error(
      `Circuit breaker is OPEN for provider ${this.providerId}. ` +
      `Failed requests: ${stats?.failedRequests ?? 0}/${stats?.totalRequests ?? 0}. ` +
      `Next attempt available in: ${this.getTimeUntilReset()}ms`
    );
  }

  /**
   * Get time until circuit breaker attempts to reset
   * @returns Milliseconds until reset attempt, or 0 if not applicable
   */
  getTimeUntilReset(): number {
    if (this.state !== CircuitBreakerState.OPEN) return 0;
    
    const stats = this.stats.get(this.providerId);
    if (!stats || !stats.stateChangedTime) return 0;
    
    const elapsed = Date.now() - stats.stateChangedTime;
    return Math.max(0, this.config.recoveryTimeoutMs - elapsed);
  }

  /**
   * Get current state of the circuit breaker
   * @returns Current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get statistics for this circuit breaker
   * @returns Current statistics
   */
  getStats(): CircuitBreakerStats | undefined {
    return this.stats.get(this.providerId);
  }

  /**
   * Manually force the circuit breaker to open
   */
  forceOpen(): void {
    this.open();
  }

  /**
   * Manually force the circuit breaker to close
   */
  forceClose(): void {
    this.close();
  }

  /**
   * Clean up resources (call when no longer needed)
   */
  dispose(): void {
    if (this.timeouts.has(this.providerId)) {
      clearTimeout(this.timeouts.get(this.providerId)!);
      this.timeouts.delete(this.providerId);
    }
  }
}

/**
 * Manager for multiple circuit breakers
 */
export class CircuitBreakerManager {
  private readonly breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker for a provider
   * @param providerId The provider ID
   * @param config Optional configuration
   * @returns Circuit breaker instance
   */
  getBreaker(providerId: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(providerId)) {
      this.breakers.set(providerId, new CircuitBreaker(providerId, config));
    }
    return this.breakers.get(providerId)!;
  }

  /**
   * Get all circuit breakers
   * @returns Map of provider IDs to circuit breakers
   */
  getAllBreakers(): ReadonlyMap<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Remove a circuit breaker
   * @param providerId The provider ID
   */
  removeBreaker(providerId: string): void {
    const breaker = this.breakers.get(providerId);
    if (breaker) {
      breaker.dispose();
      this.breakers.delete(providerId);
    }
  }

  /**
   * Get the state of a specific circuit breaker
   * @param providerId The provider ID
   * @returns Circuit breaker state or undefined if not found
   */
  getBreakerState(providerId: string): CircuitBreakerState | undefined {
    const breaker = this.breakers.get(providerId);
    return breaker ? breaker.getState() : undefined;
  }

  /**
   * Get statistics for a specific circuit breaker
   * @param providerId The provider ID
   * @returns Circuit breaker statistics or undefined if not found
   */
  getBreakerStats(providerId: string): any | undefined {
    const breaker = this.breakers.get(providerId);
    return breaker ? breaker.getStats() : undefined;
  }

  /**
   * Close all circuit breakers (useful for testing or reset)
   */
  closeAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.forceClose();
    }
  }

  /**
   * Open all circuit breakers (simulate widespread outage)
   */
  openAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.forceOpen();
    }
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    for (const breaker of this.breakers.values()) {
      breaker.dispose();
    }
    this.breakers.clear();
  }
}