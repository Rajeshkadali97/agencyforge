import { ok, fail } from "../../shared/result.js";
import type { Result } from "../../shared/result.js";
import type { MemoryProvider } from "./memory-provider.js";
import { MemoryEngineError as MemoryError } from "../errors.js";

export interface MemoryProviderRegistryConfig {
  readonly defaultProvider?: string;
  readonly providers?: readonly MemoryProvider[];
}

export interface MemoryProviderRegistry {
  readonly providers: ReadonlyMap<string, MemoryProvider>;
  readonly defaultProvider: MemoryProvider | null;

  register(provider: MemoryProvider): Result<void>;
  unregister(providerId: string): Result<void>;
  get(providerId: string): MemoryProvider | undefined;
  require(providerId: string): MemoryProvider;
  list(): readonly MemoryProvider[];
  has(providerId: string): boolean;
  healthCheck(): Promise<Result<Record<string, { status: string; latencyMs?: number }>>>;
}

export class DefaultMemoryProviderRegistry implements MemoryProviderRegistry {
  private readonly _providers = new Map<string, MemoryProvider>();
  private _defaultProviderId: string | null = null;

  public constructor(config: MemoryProviderRegistryConfig = {}) {
    if (config.defaultProvider) {
      this._defaultProviderId = config.defaultProvider;
    }
    if (config.providers) {
      for (const provider of config.providers) {
        this.register(provider);
      }
    }
  }

  public get providers(): ReadonlyMap<string, MemoryProvider> {
    return this._providers;
  }

  public get defaultProvider(): MemoryProvider | null {
    if (!this._defaultProviderId) {
      return null;
    }
    return this._providers.get(this._defaultProviderId) ?? null;
  }

  public register(provider: MemoryProvider): Result<void> {
    if (!provider || !provider.info) {
      return fail(new MemoryError("Invalid provider", "INVALID_PROVIDER"));
    }

    const providerId = provider.info.name;

    if (this._providers.has(providerId)) {
      return fail(
        new MemoryError(`Provider already registered: ${providerId}`, "DUPLICATE_PROVIDER")
      );
    }

    this._providers.set(providerId, provider);

    if (!this._defaultProviderId) {
      this._defaultProviderId = providerId;
    }

    return ok(undefined);
  }

  public unregister(providerId: string): Result<void> {
    if (!this._providers.has(providerId)) {
      return fail(new MemoryError(`Provider not found: ${providerId}`, "PROVIDER_NOT_FOUND"));
    }

    this._providers.delete(providerId);

    if (this._defaultProviderId === providerId) {
      const remaining = Array.from(this._providers.keys());
      this._defaultProviderId = remaining.length > 0 ? remaining[0] : null;
    }

    return ok(undefined);
  }

  public get(providerId: string): MemoryProvider | undefined {
    return this._providers.get(providerId);
  }

  public require(providerId: string): MemoryProvider {
    const provider = this._providers.get(providerId);
    if (!provider) {
      throw new Error(`Required provider not found: ${providerId}`);
    }
    return provider;
  }

  public list(): readonly MemoryProvider[] {
    return Array.from(this._providers.values());
  }

  public has(providerId: string): boolean {
    return this._providers.has(providerId);
  }

  public async healthCheck(): Promise<
    Result<Record<string, { status: string; latencyMs?: number }>>
  > {
    const results: Record<string, { status: string; latencyMs?: number }> = {};
    const errors: string[] = [];

    const checks = Array.from(this._providers.entries()).map(
      async ([id, provider]): Promise<void> => {
        try {
          const startTime = Date.now();
          const healthResult = await provider.health();
          const latencyMs = Date.now() - startTime;

          if (healthResult.ok) {
            results[id] = {
              status: healthResult.value.status,
              latencyMs,
            };
          } else {
            results[id] = { status: "unavailable" };
            errors.push(`${id}: ${healthResult.error.message}`);
          }
        } catch (error) {
          results[id] = { status: "unavailable" };
          errors.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    );

    await Promise.all(checks);

    if (errors.length > 0) {
      return fail(
        new MemoryError(`Health check failures: ${errors.join("; ")}`, "HEALTH_CHECK_FAILED")
      );
    }

    return ok(results);
  }
}