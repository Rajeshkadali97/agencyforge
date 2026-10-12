import type { ProviderCapability } from "./provider-capability.js";
import type { ProviderHealth } from "./provider-health.js";

export type { ProviderHealth } from "./provider-health.js";

export interface ProviderConfig {
  readonly [key: string]: unknown;
}

export type ProviderPriority = "critical" | "high" | "normal" | "low" | "fallback";

export type ProviderCategory =
  | "discovery"
  | "website-analysis"
  | "seo"
  | "technology-detection"
  | "business-enrichment"
  | "crm"
  | "outreach"
  | "proposal"
  | "analytics"
  | "research"
  | "content"
  | "publishing"
  | "growth";

export interface IProvider {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly category: ProviderCategory;
  readonly capabilities: ReadonlyArray<ProviderCapability>;
  readonly priority: ProviderPriority;
  initialize(config: ProviderConfig): Promise<void>;
  dispose(): Promise<void>;
  healthCheck(): Promise<import("../../shared/result.js").Result<ProviderHealth>>;
  execute<TInput = unknown, TOutput = unknown>(input: TInput): Promise<import("../../shared/result.js").Result<TOutput>>;
}
