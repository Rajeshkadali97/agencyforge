import type { IProvider } from "../interfaces/provider-base.js";
import type { ProviderCapability } from "../interfaces/provider-capability.js";
import type { ProviderHealth } from "../interfaces/provider-health.js";
import type { Result } from "../../shared/result.js";
import { ok, fail } from "../../shared/result.js";

type ProviderRegistryEntry = {
  provider: IProvider;
  registeredAt: Date;
};

type ProviderRegistryHealthSnapshot = Record<string, Result<ProviderHealth>>;

export interface ProviderRegistryOptions {
  readonly enableFallback?: boolean;
}

export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderRegistryEntry>();
  private readonly options: ProviderRegistryOptions;

  constructor(options: ProviderRegistryOptions = {}) {
    this.options = options;
  }

  register(provider: IProvider): Result<void> {
    if (this.providers.has(provider.id)) {
      return fail({
        code: "PROVIDER_ALREADY_REGISTERED",
        message: `Provider with id "${provider.id}" is already registered.`,
        retryable: false,
      });
    }
    this.providers.set(provider.id, { provider, registeredAt: new Date() });
    return ok(undefined);
  }

  unregister(providerId: string): Result<void> {
    const removed = this.providers.delete(providerId);
    if (!removed) {
      return fail({
        code: "PROVIDER_NOT_FOUND",
        message: `Provider with id "${providerId}" not found in the registry.`,
        retryable: false,
      });
    }
    return ok(undefined);
  }

  get(providerId: string): IProvider | undefined {
    return this.providers.get(providerId)?.provider;
  }

  require(providerId: string): IProvider {
    const provider = this.get(providerId);
    if (!provider) {
      throw new Error(`Provider not registered: ${providerId}`);
    }
    return provider;
  }

  list(): readonly IProvider[] {
    return Array.from(this.providers.values()).map((entry) => entry.provider);
  }

  byCapability(capability: ProviderCapability): readonly IProvider[] {
    return this.list().filter((p) => p.capabilities.includes(capability));
  }

  byCategory(category: string): readonly IProvider[] {
    return this.list().filter((p) => p.category === category);
  }

  async healthCheck(): Promise<ProviderRegistryHealthSnapshot> {
    const results: ProviderRegistryHealthSnapshot = {};
    for (const [id, entry] of this.providers) {
      try {
        results[id] = await entry.provider.healthCheck();
      } catch (err) {
        results[id] = fail({
          code: "HEALTH_CHECK_EXCEPTION",
          message: err instanceof Error ? err.message : String(err),
          retryable: true,
        });
      }
    }
    return results;
  }
}
