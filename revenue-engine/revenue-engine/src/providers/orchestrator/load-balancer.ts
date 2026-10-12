import { IProvider } from "../interfaces/index.js";
import { ProviderHealthManager } from "./provider-health-manager.js";

/**
 * Different load balancing strategies
 */
export enum LoadBalancingStrategy {
  ROUND_ROBIN = "round_robin",
  WEIGHTED = "weighted",
  LEAST_CONNECTIONS = "least_connections",
  RESPONSE_TIME = "response_time",
  HEALTH_BASED = "health_based",
  RANDOM = "random"
}

/**
 * Configuration for load balancer
 */
export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy;
  healthWeight: number;      // Weight for health score (0-1)
  latencyWeight: number;     // Weight for latency (0-1)
  priorityWeight: number;    // Weight for priority (0-1)
  enableStickySessions: boolean; // Whether to stick to same provider for related requests
}

/**
 * Context for load balancing decision
 */
export interface LoadBalancingContext {
  /** The capabilities required for this request */
  requiredCapabilities: string[];
  /** Preferred provider (if any) */
  preferredProvider?: string;
  /** Fallback providers to try if primary fails */
  fallbackProviders?: string[];
  /** Request-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of load balancing decision
 */
export interface LoadBalancingDecision {
  /** Selected provider */
  provider: IProvider;
  /** Reason for selection */
  reason: string;
  /** Alternative providers in order of preference */
  alternatives: IProvider[];
  /** Confidence score for this selection (0-1) */
  confidence: number;
}

/**
 * Tracks connection counts for least_connections strategy
 */
interface ConnectionTracker {
  providerId: string;
  activeConnections: number;
  lastUsed: number;
}

/**
 * Load balancer that distributes requests across available providers
 * based on various algorithms and health metrics
 */
export class LoadBalancer {
  private readonly config: LoadBalancerConfig;
  private readonly healthManager: ProviderHealthManager;
  private readonly connectionTracker: Map<string, ConnectionTracker> = new Map();
  private roundRobinIndex: number = 0;

  constructor(
    healthManager: ProviderHealthManager,
    config: Partial<LoadBalancerConfig> = {}
  ) {
    this.healthManager = healthManager;
    this.config = {
      strategy: LoadBalancingStrategy.HEALTH_BASED,
      healthWeight: 0.4,
      latencyWeight: 0.3,
      priorityWeight: 0.3,
      enableStickySessions: false,
      ...config
    };

    // Validate weights sum to 1.0 (approximately)
    const totalWeight = this.config.healthWeight +
                       this.config.latencyWeight +
                       this.config.priorityWeight;
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      console.warn(`Load balancer weights sum to ${totalWeight}, should be 1.0`);
    }
  }

  /**
   * Select the best provider for a given request
   * @param availableProviders Providers that are available and capable
   * @param context Context for the load balancing decision
   * @returns Decision on which provider to use
   */
  selectProvider(
    availableProviders: IProvider[],
    context: LoadBalancingContext
  ): LoadBalancingDecision {
    if (availableProviders.length === 0) {
      throw new Error("No available providers for selection");
    }

    if (availableProviders.length === 1) {
      const provider = availableProviders[0]!;
      return {
        provider,
        reason: "Only one provider available",
        alternatives: [],
        confidence: 1.0
      };
    }

    // Filter by required capabilities if specified
    let candidates = availableProviders;
    if (context.requiredCapabilities && context.requiredCapabilities.length > 0) {
      candidates = candidates.filter(provider =>
        context.requiredCapabilities!.every(cap =>
          (provider.capabilities as string[]).includes(cap)
        )
      );
    }

    if (candidates.length === 0) {
      throw new Error("No providers match the required capabilities");
    }

    // Apply preferred provider if specified and available
    if (context.preferredProvider) {
      const preferred = candidates.find(p => p.id === context.preferredProvider);
      if (preferred) {
        return {
          provider: preferred,
          reason: "Preferred provider selected",
          alternatives: candidates.filter(p => p.id !== preferred.id),
          confidence: 0.9
        };
      }
    }

    // Apply different strategies
    let selectedProvider: IProvider;
    let reason: string;

    switch (this.config.strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        ({ provider: selectedProvider, reason } = this.roundRobinSelect(candidates));
        break;

      case LoadBalancingStrategy.WEIGHTED:
        ({ provider: selectedProvider, reason } = this.weightedSelect(candidates));
        break;

      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        ({ provider: selectedProvider, reason } = this.leastConnectionsSelect(candidates));
        break;

      case LoadBalancingStrategy.RESPONSE_TIME:
        ({ provider: selectedProvider, reason } = this.responseTimeSelect(candidates));
        break;

      case LoadBalancingStrategy.HEALTH_BASED:
        ({ provider: selectedProvider, reason } = this.healthBasedSelect(candidates));
        break;

      case LoadBalancingStrategy.RANDOM:
        ({ provider: selectedProvider, reason } = this.randomSelect(candidates));
        break;

      default:
        ({ provider: selectedProvider, reason } = this.healthBasedSelect(candidates));
        break;
    }

    // Calculate alternatives (remaining candidates sorted by suitability)
    const alternatives = [...candidates]
      .filter(p => p.id !== selectedProvider.id)
      .sort((a, b) => this.compareProviderSuitability(b, a, context)); // Descending order

    // Calculate confidence score based on how much better the selected option is
    const confidence = this.calculateSelectionConfidence(selectedProvider, alternatives[0], context);

    return {
      provider: selectedProvider,
      reason,
      alternatives,
      confidence
    };
  }

  /**
   * Round robin selection
   */
  private roundRobinSelect(candidates: IProvider[]): { provider: IProvider; reason: string } {
    if (this.roundRobinIndex >= candidates.length) {
      this.roundRobinIndex = 0;
    }
    const selected = candidates[this.roundRobinIndex]!;
    this.roundRobinIndex++;

    return {
      provider: selected,
      reason: `Round robin selection (index ${this.roundRobinIndex - 1}/${candidates.length})`
    };
  }

  /**
   * Weighted selection based on configured weights
   */
  private weightedSelect(candidates: IProvider[]): { provider: IProvider; reason: string } {
    const scores = candidates.map(candidate => ({
      provider: candidate,
      score: this.calculateWeightedScore(candidate)
    }));

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0]!;

    return {
      provider: best.provider,
      reason: `Weighted selection (score: ${best.score.toFixed(3)})`
    };
  }

  /**
   * Calculate weighted score for a provider
   */
  private calculateWeightedScore(provider: IProvider): number {
    const healthRecord = this.healthManager.getProviderHealth(provider.id);

    // Normalize health score (0-100) to (0-1)
    const healthScore = healthRecord?.status === "available" ? 1 : healthRecord?.status === "degraded" ? 0.5 : 0;

    // Normalize latency (lower is better) - invert and normalize
    // Default if no metrics
    const latencyScore = 0.5;

    // Convert priority to score (higher priority = higher score)
    const priorityScores: Record<string, number> = {
      critical: 1.0,
      high: 0.8,
      normal: 0.6,
      low: 0.4,
      fallback: 0.2
    };
    const priorityScore = priorityScores[provider.priority] ?? 0.5;

    // Calculate weighted sum
    return (
      this.config.healthWeight * healthScore +
      this.config.latencyWeight * latencyScore +
      this.config.priorityWeight * priorityScore
    );
  }

  /**
   * Least connections selection
   */
  private leastConnectionsSelect(candidates: IProvider[]): { provider: IProvider; reason: string } {
    const connectionCounts = candidates.map(candidate => {
      const tracker = this.connectionTracker.get(candidate.id) || {
        providerId: candidate.id,
        activeConnections: 0,
        lastUsed: Date.now()
      };
      return {
        provider: candidate,
        connections: tracker.activeConnections
      };
    });

    // Sort by ascending connection count
    connectionCounts.sort((a, b) => a.connections - b.connections);
    const leastConnected = connectionCounts[0]!;

    // Update tracking
    this.updateConnectionCount(leastConnected.provider.id, 1);

    return {
      provider: leastConnected.provider,
      reason: `Least connections (${leastConnected.connections} active)`
    };
  }

  /**
   * Response time based selection (fastest response time)
   */
  private responseTimeSelect(candidates: IProvider[]): { provider: IProvider; reason: string } {
    const responseTimes = candidates.map(candidate => {
      const health = this.healthManager.getProviderHealth(candidate.id);
      return {
        provider: candidate,
        responseTime: health?.status === "available" ? 0 : health?.status === "degraded" ? 1000 : Number.MAX_VALUE
      };
    });

    // Sort by ascending response time
    responseTimes.sort((a, b) => a.responseTime - b.responseTime);
    const fastest = responseTimes[0]!;

    return {
      provider: fastest.provider,
      reason: `Fastest response time (${fastest.responseTime}ms)`
    };
  }

  /**
   * Health based selection (highest health score)
   */
  private healthBasedSelect(candidates: IProvider[]): { provider: IProvider; reason: string } {
    const healthScores = candidates.map(candidate => {
      const health = this.healthManager.getProviderHealth(candidate.id);
      const healthScore = health?.status === "available" ? 100 : health?.status === "degraded" ? 50 : 0;
      return {
        provider: candidate,
        healthScore
      };
    });

    // Sort by descending health score
    healthScores.sort((a, b) => b.healthScore - a.healthScore);
    const healthiest = healthScores[0]!;

    return {
      provider: healthiest.provider,
      reason: `Healthiest (${healthiest.healthScore}/100)`
    };
  }

  /**
   * Random selection
   */
  private randomSelect(candidates: IProvider[]): { provider: IProvider; reason: string } {
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const selected = candidates[randomIndex]!;

    return {
      provider: selected,
      reason: `Random selection (index ${randomIndex}/${candidates.length})`
    };
  }

  /**
   * Compare two providers by suitability for the given context
   */
  private compareProviderSuitability(
    a: IProvider,
    b: IProvider,
    context: LoadBalancingContext
  ): number {
    const scoreA = this.calculateOverallScore(a, context);
    const scoreB = this.calculateOverallScore(b, context);
    return scoreB - scoreA; // Descending order (better first)
  }

  /**
   * Calculate overall suitability score for a provider
   */
  private calculateOverallScore(provider: IProvider, context: LoadBalancingContext): number {
    // Base weighted score
    let score = this.calculateWeightedScore(provider);

    // Bonus for preferred provider
    if (context.preferredProvider && provider.id === context.preferredProvider) {
      score *= 1.2; // 20% bonus
    }

    // Penalty for recently used (to spread load)
    const tracker = this.connectionTracker.get(provider.id);
    if (tracker) {
      const timeSinceLastUse = Date.now() - tracker.lastUsed;
      // If used in last second, slight penalty
      if (timeSinceLastUse < 1000) {
        score *= 0.9;
      }
    }

    return Math.max(0, Math.min(1, score)); // Clamp to 0-1
  }

  /**
   * Calculate confidence in selection based on gap between best and second-best
   */
  private calculateSelectionConfidence(
    best: IProvider,
    secondBest: IProvider | undefined,
    context: LoadBalancingContext
  ): number {
    if (!secondBest) return 1.0; // Only one option

    const bestScore = this.calculateOverallScore(best, context);
    const secondBestScore = this.calculateOverallScore(secondBest, context);

    if (bestScore === 0) return 0;

    // Calculate relative difference
    const diff = bestScore - secondBestScore;
    const ratio = diff / bestScore;

    // Convert to confidence (0-1) where bigger difference = higher confidence
    // Using a sigmoid-like function for smooth transition
    return 1 / (1 + Math.exp(-5 * (ratio - 0.1)));
  }

  /**
   * Update connection count for a provider
   * @param providerId The provider ID
   * @param delta Change in connection count (positive for new connection, negative for closed)
   */
  private updateConnectionCount(providerId: string, delta: number): void {
    const tracker = this.connectionTracker.get(providerId) || {
      providerId: providerId,
      activeConnections: 0,
      lastUsed: Date.now()
    };

    tracker.activeConnections = Math.max(0, tracker.activeConnections + delta);
    tracker.lastUsed = Date.now();

    this.connectionTracker.set(providerId, tracker);
  }

  /**
   * Notify that a connection has been released (for connection tracking)
   * @param providerId The provider ID
   */
  releaseConnection(providerId: string): void {
    this.updateConnectionCount(providerId, -1);
  }

  /**
   * Get current connection count for a provider
   * @param providerId The provider ID
   * @returns Number of active connections
   */
  getConnectionCount(providerId: string): number {
    const tracker = this.connectionTracker.get(providerId);
    return tracker ? tracker.activeConnections : 0;
  }

  /**
   * Reset all connection tracking (useful for testing)
   */
  resetConnectionTracking(): void {
    this.connectionTracker.clear();
  }

  /**
   * Get current load balancer statistics
   * @returns Object containing current stats
   */
  getStats(): {
    strategy: LoadBalancingStrategy;
    roundRobinIndex: number;
    trackedProviders: number;
    totalConnections: number;
  } {
    let totalConnections = 0;
    for (const tracker of this.connectionTracker.values()) {
      totalConnections += tracker.activeConnections;
    }

    return {
      strategy: this.config.strategy,
      roundRobinIndex: this.roundRobinIndex,
      trackedProviders: this.connectionTracker.size,
      totalConnections
    };
  }
}
