import type { IProvider, ProviderConfig } from "./provider-base.js";
import type { ProviderCapability } from "./provider-capability.js";

export interface ProviderDiscovery {
  discover(options?: Readonly<DiscoveryOptions>): Promise<ReadonlyArray<DiscoveredProvider>>;
}

export interface DiscoveryOptions {
  readonly requiredCapabilities?: readonly ProviderCapability[];
  readonly minVersion?: string;
  readonly categories?: readonly string[];
}

export interface DiscoveredProvider {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly category: string;
  readonly capabilities: readonly ProviderCapability[];
  readonly status: "available" | "degraded" | "unavailable";
  readonly modulePath: string;
  readonly factory: ProviderFactory;
}

export interface ProviderFactory<TProvider extends IProvider = IProvider> {
  readonly id: string;
  create(config: ProviderConfig): Promise<TProvider>;
}
