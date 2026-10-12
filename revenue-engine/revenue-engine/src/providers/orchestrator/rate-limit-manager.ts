import { IProvider } from "../interfaces/index.js";

/**
 * Different rate limiting algorithms
 */
export enum RateLimitAlgorithm {
  FIXED_WINDOW = "fixed_window",
  SLIDING_WINDOW = "sliding_window",
  TOKEN_BUCKET = "token_bucket",
  LEAKY_BUCKET = "leaky_bucket"
}

/**
 * Configuration for rate limiting
 */
export interface RateLimitConfig {
  algorithm: RateLimitAlgorithm;
  requestsPerWindow: number;
  windowMs: number;
  burstCapacity?: number; // For token/leaky bucket
  replenishRate?: number; // For token bucket (per ms)
  keyGenerator?: (providerId: string, operation: string) => string;
}

/**
 * Current state of rate limiting for a key
 */
export interface RateLimitState {
  key: string;
  providerId: string;
  operation: string;
  currentCount: number;
  windowStart: number;
  lastRequestTime: number;
  tokens: number; // For token bucket
  blockedUntil: number; // Timestamp when request will be allowed
}

/**
 * Result of checking if a request is allowed
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number; // Unix timestamp when limit resets
  retryAfter: number; // Seconds to wait before retrying (0 if allowed)
  consumedPoints: number; // How many points this request consumed
}

/**
 * Manages rate limiting for providers to prevent overwhelming them
 */
export class RateLimitManager {
  private readonly states: Map<string, RateLimitState> = new Map();
  private readonly defaultConfig: RateLimitConfig;
  
  constructor(defaultConfig: Partial<RateLimitConfig> = {}) {
    this.defaultConfig = {
      algorithm: RateLimitAlgorithm.FIXED_WINDOW,
      requestsPerWindow: 100,
      windowMs: 60000, // 1 minute
      burstCapacity: 20,
      replenishRate: 100 / 60000, // Default to match requestsPerWindow per windowMs
      keyGenerator: (providerId: string, operation: string) => `${providerId}:${operation}`,
      ...defaultConfig
    };
  }

  /**
   * Check if a request is allowed under rate limits
   * @param providerId The provider making the request
   * @param operation The operation being performed
   * @param config Optional rate limit configuration override
   * @returns Result indicating if request is allowed and related info
   */
  isAllowed(
    providerId: string,
    operation: string,
    config?: Partial<RateLimitConfig>
  ): RateLimitResult {
    const finalConfig = { ...this.defaultConfig, ...config };
    const key = this.getKey(providerId, operation, finalConfig.keyGenerator!);
    
    let state = this.states.get(key);
    const now = Date.now();
    
    // Initialize state if not present
    if (!state) {
      state = this.createInitialState(providerId, operation, key, now);
      this.states.set(key, state);
    }
    
    // Clean up old entries periodically (every 10 checks)
    if (Math.random() < 0.1) {
      this.cleanupOldEntries();
    }
    
    // Apply the selected algorithm
    switch (finalConfig.algorithm) {
      case RateLimitAlgorithm.FIXED_WINDOW:
        return this.processFixedWindow(state, finalConfig, now);
        
      case RateLimitAlgorithm.SLIDING_WINDOW:
        return this.processSlidingWindow(state, finalConfig, now);
        
      case RateLimitAlgorithm.TOKEN_BUCKET:
        return this.processTokenBucket(state, finalConfig, now);
        
      case RateLimitAlgorithm.LEAKY_BUCKET:
        return this.processLeakyBucket(state, finalConfig, now);
        
      default:
        return this.processFixedWindow(state, finalConfig, now);
    }
  }

  /**
   * Get the key for storing rate limit state
   */
  private getKey(
    providerId: string, 
    operation: string, 
    keyGenerator: (providerId: string, operation: string) => string
  ): string {
    return keyGenerator(providerId, operation);
  }

  /**
   * Create initial state for a new key
   */
  private createInitialState(
    providerId: string,
    operation: string,
    key: string,
    now: number
  ): RateLimitState {
    return {
      key,
      providerId,
      operation,
      currentCount: 0,
      windowStart: now,
      lastRequestTime: now,
      tokens: 0,
      blockedUntil: 0
    };
  }

  /**
   * Process request using fixed window algorithm
   */
  private processFixedWindow(
    state: RateLimitState,
    config: RateLimitConfig,
    now: number
  ): RateLimitResult {
    // Check if we're in a new window
    if (now - state.windowStart >= config.windowMs) {
      // Reset window
      state.windowStart = now;
      state.currentCount = 0;
    }
    
    // Check if limit exceeded
    if (state.currentCount >= config.requestsPerWindow) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: state.windowStart + config.windowMs,
        retryAfter: Math.ceil((state.windowStart + config.windowMs - now) / 1000),
        consumedPoints: 0
      };
    }
    
    // Allow request
    state.currentCount++;
    state.lastRequestTime = now;
    
    return {
      allowed: true,
      remaining: config.requestsPerWindow - state.currentCount,
      resetTime: state.windowStart + config.windowMs,
      retryAfter: 0,
      consumedPoints: 1
    };
  }

  /**
   * Process request using sliding window algorithm
   */
  private processSlidingWindow(
    state: RateLimitState,
    config: RateLimitConfig,
    now: number
  ): RateLimitResult {
    // For simplicity, we'll implement a basic version
    // In production, you'd want a more sophisticated implementation
    // that tracks individual request timestamps
    
    // Fall back to fixed window for now
    return this.processFixedWindow(state, config, now);
  }

  /**
   * Process request using token bucket algorithm
   */
  private processTokenBucket(
    state: RateLimitState,
    config: RateLimitConfig,
    now: number
  ): RateLimitResult {
    // Add tokens based on time passed
    const timePassed = now - state.lastRequestTime;
    const tokensToAdd = timePassed * (config.replenishRate ?? this.defaultConfig.replenishRate!);
state.tokens = Math.min(
      config.burstCapacity ?? this.defaultConfig.burstCapacity!,
      state.tokens + tokensToAdd
    );
    
    // Check if we have enough tokens
    const tokensNeeded = 1; // Each request costs 1 token
    if (state.tokens < tokensNeeded) {
      // Not enough tokens - calculate when we'll have enough
      const deficit = tokensNeeded - state.tokens;
      const waitTime = Math.ceil(deficit / (config.replenishRate ?? this.defaultConfig.replenishRate!));
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + waitTime,
        retryAfter: Math.ceil(waitTime / 1000),
        consumedPoints: 0
      };
    }
    
    // Consume tokens and allow request
    state.tokens -= tokensNeeded;
    state.lastRequestTime = now;
    
    return {
      allowed: true,
      remaining: Math.floor(state.tokens),
      resetTime: now + config.windowMs, // Approximate
      retryAfter: 0,
      consumedPoints: 1
    };
  }

  /**
   * Process request using leaky bucket algorithm
   */
  private processLeakyBucket(
    state: RateLimitState,
    config: RateLimitConfig,
    now: number
  ): RateLimitResult {
    // For simplicity, we'll treat this similar to fixed window with draining
    // A full implementation would track outflow rate
    
    // Check if we're in a new window
    if (now - (state.windowStart ?? now) >= config.windowMs) {
      // Partially drain the bucket based on time passed
      const timePassed = now - (state.windowStart ?? now);
      const drainAmount = Math.floor(
        timePassed * (config.requestsPerWindow / config.windowMs)
      );
      state.currentCount = Math.max(0, state.currentCount - drainAmount);
      state.windowStart = now;
    }
    
    // Check if limit exceeded
    if (state.currentCount >= config.requestsPerWindow) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: state.windowStart + config.windowMs,
        retryAfter: Math.ceil((state.windowStart + config.windowMs - now) / 1000),
        consumedPoints: 0
      };
    }
    
    // Allow request
    state.currentCount++;
    state.lastRequestTime = now;
    
    return {
      allowed: true,
      remaining: config.requestsPerWindow - state.currentCount,
      resetTime: state.windowStart + config.windowMs,
      retryAfter: 0,
      consumedPoints: 1
    };
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  private cleanupOldEntries(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [key, state] of this.states.entries()) {
      if (now - state.lastRequestTime > maxAge) {
        this.states.delete(key);
      }
    }
  }

  /**
   * Manually reset rate limit for a provider/operation
   * @param providerId The provider ID
   * @param operation The operation name
   */
  reset(providerId: string, operation: string): void {
    const key = this.getKey(providerId, operation, this.defaultConfig.keyGenerator!);
    this.states.delete(key);
  }

  /**
   * Get current rate limit state for monitoring/debugging
   * @param providerId The provider ID
   * @param operation The operation name
   * @returns Current state or undefined if not tracked
   */
  getState(providerId: string, operation: string): RateLimitState | undefined {
    const key = this.getKey(providerId, operation, this.defaultConfig.keyGenerator!);
    return this.states.get(key);
  }

  /**
   * Get all current rate limit states
   * @returns Map of all current states
   */
  getAllStates(): ReadonlyMap<string, RateLimitState> {
    return new Map(this.states);
  }

  /**
   * Set a custom rate limit for a specific provider/operation
   * @param providerId The provider ID
   * @param operation The operation name
   * @param count Current count to set
   */
  setCount(providerId: string, operation: string, count: number): void {
    const key = this.getKey(providerId, operation, this.defaultConfig.keyGenerator!);
    let state = this.states.get(key);
    if (!state) {
      state = this.createInitialState(
        providerId,
        operation,
        key,
        Date.now()
      );
      this.states.set(key, state);
    }
    state.currentCount = count;
  }
}
