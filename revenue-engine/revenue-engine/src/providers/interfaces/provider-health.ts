export interface ProviderHealth {
  readonly status: "available" | "degraded" | "unavailable";
  readonly checkedAt: Date;
  readonly details?: string;
  readonly healthScore?: number;
  readonly averageLatency?: number;
}
