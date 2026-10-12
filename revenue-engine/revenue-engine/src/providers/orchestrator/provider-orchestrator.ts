import { IProviderRegistry } from "../interfaces/provider-registry.js";
import { IProvider, ProviderCapability, ProviderCategory, ProviderPriority, ProviderConfig, ProviderHealth } from "../interfaces/index.js";
import { Result } from "../../shared/result.js";
import { CapabilityResolver } from "./capability-resolver.js";
import { ProviderHealthManager } from "./provider-health-manager.js";
import { RetryManager, RetryStrategy } from "./retry-manager.js";
import { CircuitBreaker, CircuitBreakerState } from "./circuit-breaker.js";
import { RateLimitManager, RateLimitAlgorithm } from "./rate-limit-manager.js";
import { LoadBalancer, LoadBalancingStrategy } from "./load-balancer.js";
import { ExecutionPipeline, PipelineContext } from "./execution-pipeline.js";

/**
 * Configuration for the provider orchestrator
 */
export interface OrchestratorConfig {
  /** Default retry configuration */
  defaultRetryConfig?: Partial<{
    strategy: RetryStrategy;
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    jitter: boolean;
  }>;

  /** Default circuit breaker configuration */
  defaultCircuitBreakerConfig?: Partial<{
    failureThreshold: number;
    recoveryTimeoutMs: number;
    successThreshold: number;
    timeoutMs: number;
  }>;

  /** Default rate limit configuration */
  defaultRateLimitConfig?: Partial<{
    algorithm: RateLimitAlgorithm;
    requestsPerWindow: number;
    windowMs: number;
  }>;

  /** Default load balancing configuration */
  defaultLoadBalancerConfig?: Partial<{
    strategy: LoadBalancingStrategy;
    healthWeight: number;
    latencyWeight: number;
    priorityWeight: number;
  }>;

  /** Enable/disable specific features */
  enableRetry?: boolean;
  enableCircuitBreaker?: boolean;
  enableRateLimiting?: boolean;
  enableLoadBalancing?: boolean;
  enableHealthMonitoring?: boolean;

  /** Health check interval in milliseconds */
  healthCheckIntervalMs?: number;

  /** Default timeout for operations in milliseconds */
  defaultTimeoutMs?: number;
}

/**
 * Main orchestrator that coordinates all provider operations
 */
export class ProviderOrchestrator {
  private readonly providerRegistry: IProviderRegistry;
  private readonly config: OrchestratorConfig;

  // Core components
  private readonly capabilityResolver: CapabilityResolver;
  private readonly healthManager: ProviderHealthManager;
  private readonly retryManager: RetryManager;
  private readonly rateLimitManager: RateLimitManager;
  private readonly loadBalancer: LoadBalancer;
  private readonly executionPipeline: ExecutionPipeline;

  // Circuit breakers per provider
  private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(
    providerRegistry: IProviderRegistry,
    config: OrchestratorConfig = {}
  ) {
    this.providerRegistry = providerRegistry;
    this.config = {
      enableRetry: true,
      enableCircuitBreaker: true,
      enableRateLimiting: true,
      enableLoadBalancing: true,
      enableHealthMonitoring: true,
      healthCheckIntervalMs: 30000,
      defaultTimeoutMs: 30000,
      ...config
    };

    // Initialize core components
    this.capabilityResolver = new CapabilityResolver(providerRegistry);
    this.healthManager = new ProviderHealthManager(
      providerRegistry,
      {
        healthCheckIntervalMs: this.config.healthCheckIntervalMs!,
        autoStart: this.config.enableHealthMonitoring !== false
      }
    );
    this.retryManager = new RetryManager(this.config.defaultRetryConfig);
    this.rateLimitManager = new RateLimitManager(this.config.defaultRateLimitConfig);
    this.loadBalancer = new LoadBalancer(this.healthManager, this.config.defaultLoadBalancerConfig);
    this.executionPipeline = new ExecutionPipeline();

    // Initialize circuit breakers for existing providers
    this.initializeCircuitBreakers();

    // Set up health monitoring if enabled
    if (this.config.enableHealthMonitoring !== false) {
      this.healthManager.startMonitoring();
    }
  }

  /**
   * Initialize circuit breakers for all known providers
   */
  private initializeCircuitBreakers(): void {
    const providers = this.providerRegistry.list();
    for (const provider of providers) {
      this.getOrCreateCircuitBreaker(provider.id);
    }
  }

  /**
   * Get or create a circuit breaker for a provider
   * @param providerId The provider ID
   * @returns The circuit breaker instance
   */
  private getOrCreateCircuitBreaker(providerId: string): CircuitBreaker {
    let breaker = this.circuitBreakers.get(providerId);
    if (!breaker) {
      breaker = new CircuitBreaker(providerId, this.config.defaultCircuitBreakerConfig);
      this.circuitBreakers.set(providerId, breaker);
    }
    return breaker;
  }

  /**
   * Execute a capability using the orchestrator
   * @param capability The capability to execute
   * @param operation The specific operation
   * @param parameters Parameters for the operation
   * @param options Additional options
   * @returns Result of the operation
   */
  async executeCapability(
    capability: ProviderCapability,
    operation: string,
    parameters: Record<string, any> = {},
    options: {
      timeoutMs?: number;
      retryOnFailure?: boolean;
      preferredProvider?: string;
      fallbackProviders?: string[];
      correlationId?: string;
    } = {}
  ): Promise<Result<any>> {
    const startTime = Date.now();

    // Create execution context
    const context: PipelineContext = {
      capability,
      operation,
      parameters,
      correlationId: options.correlationId ?? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retryCount: 0,
      ...options
    };

    try {
      // Step 1: Resolve capable providers
      const capableProviders = this.capabilityResolver.resolveCapability(capability);
      if (capableProviders.length === 0) {
        return {
          ok: false,
          error: {
            code: "NO_CAPABLE_PROVIDER",
            message: `No providers found capable of ${capability}`
          }
        };
      }

      // Step 2: Filter by health if health monitoring is enabled
      let availableProviders = capableProviders;
      if (this.config.enableHealthMonitoring !== false) {
        availableProviders = this.healthManager.getUsableProvidersForCapability(capability);
        if (availableProviders.length === 0) {
          // Fall back to all capable providers if none are healthy
          availableProviders = capableProviders;
        }
      }

      // Step 3: Apply preferred/filter providers from options
      if (options.preferredProvider) {
        const preferred = availableProviders.find(p => p.id === options.preferredProvider);
        if (preferred) {
          context.preferredProvider = options.preferredProvider;
        }
      }

      if (options.fallbackProviders?.length) {
        context.fallbackProviders = options.fallbackProviders;
      }

      // Step 4: Select provider using load balancer
      const lbContext = {
        requiredCapabilities: [capability],
        preferredProvider: context.preferredProvider,
        fallbackProviders: context.fallbackProviders,
        metadata: context
      };

      const lbDecision = this.loadBalancer.selectProvider(availableProviders, lbContext);
      if (!lbDecision.provider) {
        return {
          ok: false,
          error: {
            code: "NO_PROVIDER_SELECTED",
            message: "Load balancer failed to select a provider"
          }
        };
      }

      context.selectedProvider = lbDecision.provider;

      // Step 5: Check rate limiting if enabled
      if (this.config.enableRateLimiting !== false) {
        const rateLimitResult = this.rateLimitManager.isAllowed(
          context.selectedProvider.id,
          operation
        );

        if (!rateLimitResult.allowed) {
          return {
            ok: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: `Rate limit exceeded for ${context.selectedProvider.id}`,
              retryable: true
            }
          };
        }
      }

      // Step 6: Check circuit breaker if enabled
      if (this.config.enableCircuitBreaker !== false) {
        const circuitBreaker = this.getOrCreateCircuitBreaker(context.selectedProvider.id);
        if (circuitBreaker.getState() === CircuitBreakerState.OPEN) {
          return {
            ok: false,
            error: {
              code: "CIRCUIT_BREAKER_OPEN",
              message: `Circuit breaker is open for ${context.selectedProvider.id}`,
              retryable: true,
              cause: new Error(`Retry available in ${Math.ceil(circuitBreaker.getTimeUntilReset() / 1000)}s`)
            }
          };
        }
      }

      // Step 7: Execute with retry logic if enabled
      let lastError: any = null;
      let result: any = null;
      const maxAttempts = this.config.enableRetry !== false
        ? (this.config.defaultRetryConfig?.maxAttempts ?? 3)
        : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        context.retryCount = attempt;

        try {
          // Execute through the pipeline
          const pipelineResult = await this.executionPipeline.execute(
            capability,
            operation,
            parameters,
            context
          );

          if (!pipelineResult.ok) {
            throw pipelineResult.error;
          }

          result = pipelineResult.value;

          // Success! Break out of retry loop
          break;
        } catch (error) {
          lastError = error;

          // If this is the last attempt, don't retry
          if (attempt >= maxAttempts - 1) {
            break;
          }

          // Check if we should retry based on error
          if (this.config.enableRetry !== false) {
            const retryDecision = this.retryManager.shouldRetry(
              error,
              context.selectedProvider.id,
              `${capability}.${operation}`,
              { maxAttempts }
            );

            if (!retryDecision.shouldRetry) {
              break;
            }

            // Wait before retrying
            if (retryDecision.delayMs > 0) {
              await new Promise(resolve => setTimeout(resolve, retryDecision.delayMs));
            }
          } else {
            // Retries disabled, break on first failure
            break;
          }
        }
      }

      // If we have a result, return success
      if (result !== null) {
        // Update circuit breaker on success
        if (this.config.enableCircuitBreaker !== false) {
          const circuitBreaker = this.getOrCreateCircuitBreaker(context.selectedProvider.id);
          circuitBreaker.onSuccess();
        }

        return {
          ok: true,
          value: {
            result,
            executionInfo: {
              providerId: context.selectedProvider.id,
              capability,
              operation,
              attemptCount: context.retryCount + 1,
              durationMs: Date.now() - startTime,
              selectedBy: lbDecision.reason,
              confidence: lbDecision.confidence
            }
          }
        };
      }

      // If we get here, all retries failed
      // Update circuit breaker on failure
      if (this.config.enableCircuitBreaker !== false) {
        const circuitBreaker = this.getOrCreateCircuitBreaker(context.selectedProvider.id);
        circuitBreaker.onFailure();
      }

      return {
        ok: false,
        error: {
          code: "EXECUTION_FAILED",
          message: lastError instanceof Error ? lastError.message : "Unknown error during execution",
          cause: lastError,
          retryable: false
        }
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message: error instanceof Error ? error.message : String(error),
          cause: error,
          retryable: false
        }
      };
    }
  }

  /**
   * Execute a pipeline (for more complex workflows)
   * @param capability The capability to execute
   * @param operation The specific operation
   * @param parameters Parameters for the operation
   * @param options Additional options
   * @returns Result of the pipeline execution
   */
  async executePipeline(
    capability: string,
    operation: string,
    parameters: Record<string, any> = {},
    options: {
      timeoutMs?: number;
      retryOnFailure?: boolean;
      preferredProvider?: string;
      fallbackProviders?: string[];
      correlationId?: string;
    } = {}
  ): Promise<Result<any>> {
    // For now, delegate to executeCapability - in a more advanced implementation,
    // this could handle multi-step workflows, scatter-gather patterns, etc.
    return this.executeCapability(capability as ProviderCapability, operation, parameters, options);
  }

  /**
   * Get the health status of a provider
   * @param providerId The provider ID
   * @returns Health status or null if unknown
   */
  getProviderHealth(providerId: string): ProviderHealth | null {
    return this.healthManager.getProviderHealth(providerId);
  }

  /**
   * Get health status for all providers
   * @returns Map of provider IDs to their health status
   */
  getAllProvidersHealth(): ReadonlyMap<string, ProviderHealth> {
    return this.healthManager.getAllProvidersHealth();
  }

  /**
   * Get the state of a circuit breaker for a provider
   * @param providerId The provider ID
   * @returns Circuit breaker state or undefined if not found
   */
  getCircuitBreakerState(providerId: string): CircuitBreakerState | undefined {
    const breaker = this.circuitBreakers.get(providerId);
    return breaker ? breaker.getState() : undefined;
  }

  /**
   * Get statistics for the load balancer
   * @returns Load balancer statistics
   */
  getLoadBalancerStats(): any {
    return this.loadBalancer.getStats();
  }

  /**
   * Manually trigger a health check for all providers
   */
  async checkHealth(): Promise<void> {
    await this.healthManager.checkAllProvidersHealth();
  }

  /**
   * Shutdown the orchestrator and clean up resources
   */
  shutdown(): void {
    this.healthManager.stopMonitoring();

    // Dispose of circuit breakers
    for (const breaker of this.circuitBreakers.values()) {
      breaker.dispose();
    }
    this.circuitBreakers.clear();
  }

  /**
   * Get diagnostic information about the orchestrator state
   * @returns Diagnostic information
   */
  getDiagnostics(): {
    timestamp: string;
    providers: Array<{
      id: string;
      name: string;
      category: string;
      priority: string;
      health: {
        status: string;
        score: number | null;
        lastCheck: string | null;
      };
      circuitBreaker: {
        state: string;
        failureCount: number;
        successCount: number;
      };
      rateLimit: {
        currentUsage: number | null;
        limit: number;
        windowSeconds: number;
      };
    }>;
    summary: {
      totalProviders: number;
      healthyProviders: number;
      degradedProviders: number;
      unavailableProviders: number;
      openCircuitBreakers: number;
    };
  } {
    const now = new Date();
    const providers = this.providerRegistry.list();

    const providerInfo = providers.map(provider => {
      const health = this.getProviderHealth(provider.id);
      const breaker = this.circuitBreakers.get(provider.id);

      return {
        id: provider.id,
        name: provider.displayName,
        category: provider.category,
        priority: provider.priority,
        health: {
          status: health?.status ?? "unknown",
          score: health instanceof Object && 'healthScore' in health
            ? (health as any).healthScore
            : null,
          lastCheck: health?.checkedAt?.toISOString() ?? null
        },
        circuitBreaker: breaker ? {
          state: breaker.getState(),
          failureCount: (breaker as any).getFailureCount?.() ?? 0,
          successCount: (breaker as any).getSuccessCount?.() ?? 0
        } : {
          state: "unknown",
          failureCount: 0,
          successCount: 0
        },
        rateLimit: {
          currentUsage: null, // Would need to track this
          limit: 100, // Placeholder
          windowSeconds: 60
        }
      };
    });

    // Calculate summary stats
    const healthyProviders = providerInfo.filter(p =>
      p.health.status === "healthy" || p.health.status === "degraded"
    ).length;

    const degradedProviders = providerInfo.filter(p =>
      p.health.status === "degraded"
    ).length;

    const unavailableProviders = providerInfo.filter(p =>
      p.health.status === "unavailable"
    ).length;

    const openCircuitBreakers = providerInfo.filter(p =>
      p.circuitBreaker.state === "open"
    ).length;

    return {
      timestamp: now.toISOString(),
      providers: providerInfo,
      summary: {
        totalProviders: providers.length,
        healthyProviders,
        degradedProviders,
        unavailableProviders,
        openCircuitBreakers
      }
    };
  }
}
