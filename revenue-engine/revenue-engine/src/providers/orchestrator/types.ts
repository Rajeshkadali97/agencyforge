
export enum ProviderStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  OFFLINE = 'offline',
  RATE_LIMITED = 'rate_limited',
  MAINTENANCE = 'maintenance',
  INITIALIZING = 'initializing',
  RECOVERING = 'recovering'
}

export enum RetryStrategy {
  IMMEDIATE = 'immediate',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  LINEAR = 'linear',
  CIRCUIT_BREAKER = 'circuit_breaker',
  MANUAL = 'manual',
  NO_RETRY = 'no_retry'
}

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying'
}

export enum PriorityLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
  FALLBACK = 'fallback'
}

export interface ProviderHealthMetrics {
  status: ProviderStatus;
  uptime: number; // percentage
  averageLatency: number; // milliseconds
  successRate: number; // percentage (0-100)
  lastSuccess: Date | null;
  lastFailure: Date | null;
  consecutiveFailures: number;
  cooldownUntil: Date | null;
  healthScore: number; // 0-100 composite score
}

export interface ProviderScore {
  healthScore: number;
  trustScore: number;
  performanceScore: number;
  costScore: number;
  confidenceScore: number;
  reliabilityScore: number;
  weightedScore: number;
}

export interface ProviderMetadata extends Record<string, unknown> {
  capabilities: string[];
  dependencies?: string[];
  requiredConfig?: Record<string, unknown>;
  optionalConfig?: Record<string, unknown>;
  authenticationType?: string;
  averageResponseTime?: number;
  supportedRegions?: string[];
  languages?: string[];
  estimatedCostPerRequest?: number;
  supportsStreaming?: boolean;
  supportsParallelism?: boolean;
  version?: string;
}

export interface RetryPolicy {
  strategy: RetryStrategy;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: string[]; // error codes that should trigger retry
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // number of trips to open circuit
  recoveryTimeoutMs: number; // time to try half-open
  successThreshold: number; // successes needed in half-open to close
  timeoutMs: number; // request timeout
}

export interface LoadBalancingOptions {
  strategy: 'round_robin' | 'weighted' | 'least_connections' | 'response_time';
  healthWeight: number;
  latencyWeight: number;
  priorityWeight: number;
}

export interface RateLimitConfig {
  requestsPerWindow: number;
  windowMs: number;
  dailyQuota?: number;
  monthlyQuota?: number;
}

export interface ExecutionContext {
  workflowId: string;
  correlationId: string;
  userId?: string;
  businessId?: string;
  priority: PriorityLevel;
  timeoutMs: number;
  cancellationToken: AbortSignal;
  metadata: Record<string, unknown>;
}

export interface ProviderSelectionCriteria {
  requiredCapabilities: string[];
  preferredProvider?: string;
  fallbackProviders?: string[];
  minHealthScore?: number;
  maxCostPerRequest?: number;
  requiredRegions?: string[];
  requiredLanguages?: string[];
}

