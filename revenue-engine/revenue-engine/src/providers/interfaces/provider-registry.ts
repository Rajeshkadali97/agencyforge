import type { IProvider, ProviderConfig, ProviderCategory } from "./provider-base.js";
import type { ProviderCapability } from "./provider-capability.js";
import type { ProviderHealth } from "./provider-health.js";
import type { Result } from "../../shared/result.js";

export interface IProviderRegistry {
  register(provider: IProvider): Result<void>;
  unregister(providerId: string): Result<void>;
  get(providerId: string): IProvider | undefined;
  require(providerId: string): IProvider;
  list(): readonly IProvider[];
  byCapability(capability: ProviderCapability): readonly IProvider[];
  byCategory(category: ProviderCategory): readonly IProvider[];
  healthCheck(): Promise<Readonly<Record<string, Result<ProviderHealth>>>>;
  defaultConfigProvider?: DefaultConfigProvider;
}

export interface DefaultConfigProvider {
  getConfig(providerId: string): ProviderConfig | undefined;
}
