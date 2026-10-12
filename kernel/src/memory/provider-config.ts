import type { MemoryProvider } from "./interfaces/memory-provider.js";

export interface ProviderAuthentication {
  readonly apiKey?: string;
  readonly apiSecret?: string;
  readonly endpoint?: string;
  readonly oauth?: {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly scopes?: readonly string[];
  };
}

export interface ProviderTimeoutConfig {
  readonly connectMs: number;
  readonly requestMs: number;
  readonly healthCheckMs: number;
}

export interface ProviderRetryConfig {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
}

export interface ProviderFeatureFlags {
  readonly semanticSearch?: boolean;
  readonly vectorSearch?: boolean;
  readonly knowledgeGraph?: boolean;
  readonly caching?: boolean;
  readonly compression?: boolean;
}

export interface ProviderConfig {
  readonly id: string;
  readonly provider: MemoryProvider;
  readonly priority: number;
  readonly fallbackIds?: readonly string[];
  readonly authentication?: ProviderAuthentication;
  readonly timeout?: ProviderTimeoutConfig;
  readonly retries?: ProviderRetryConfig;
  readonly featureFlags?: ProviderFeatureFlags;
  readonly metadata?: Record<string, unknown>;
}

export interface MemoryEngineProviderConfig {
  readonly defaultProviderId: string;
  readonly providers: readonly ProviderConfig[];
  readonly globalTimeout?: ProviderTimeoutConfig;
  readonly globalRetries?: ProviderRetryConfig;
  readonly featureFlags?: ProviderFeatureFlags;
}

export class ProviderConfigBuilder {
  private _id: string;
  private _provider: MemoryProvider;
  private _priority = 0;
  private _fallbackIds: readonly string[] = [];
  private _authentication?: ProviderAuthentication;
  private _timeout?: ProviderTimeoutConfig;
  private _retries?: ProviderRetryConfig;
  private _featureFlags?: ProviderFeatureFlags;
  private _metadata: Record<string, unknown> = {};

  public constructor(id: string, provider: MemoryProvider) {
    this._id = id;
    this._provider = provider;
  }

  public withPriority(priority: number): this {
    this._priority = priority;
    return this;
  }

  public withFallbacks(fallbackIds: readonly string[]): this {
    this._fallbackIds = fallbackIds;
    return this;
  }

  public withAuthentication(auth: ProviderAuthentication): this {
    this._authentication = auth;
    return this;
  }

  public withTimeout(timeout: ProviderTimeoutConfig): this {
    this._timeout = timeout;
    return this;
  }

  public withRetries(retries: ProviderRetryConfig): this {
    this._retries = retries;
    return this;
  }

  public withFeatureFlags(flags: ProviderFeatureFlags): this {
    this._featureFlags = flags;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = metadata;
    return this;
  }

  public build(): ProviderConfig {
    return {
      id: this._id,
      provider: this._provider,
      priority: this._priority,
      fallbackIds: this._fallbackIds,
      authentication: this._authentication,
      timeout: this._timeout,
      retries: this._retries,
      featureFlags: this._featureFlags,
      metadata: this._metadata,
    };
  }
}

export const DEFAULT_TIMEOUT: ProviderTimeoutConfig = {
  connectMs: 5000,
  requestMs: 30000,
  healthCheckMs: 5000,
};

export const DEFAULT_RETRY: ProviderRetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

export function createCogneeProviderConfig(
  provider: MemoryProvider,
  options?: {
    readonly priority?: number;
    readonly fallbackIds?: readonly string[];
    readonly apiKey?: string;
    readonly endpoint?: string;
    readonly timeout?: Partial<ProviderTimeoutConfig>;
    readonly retries?: Partial<ProviderRetryConfig>;
  }
): ProviderConfig {
  const builder = new ProviderConfigBuilder("cognee", provider);

  if (options?.priority !== undefined) {
    builder.withPriority(options.priority);
  }

  if (options?.fallbackIds) {
    builder.withFallbacks(options.fallbackIds);
  }

  if (options?.apiKey || options?.endpoint) {
    builder.withAuthentication({
      apiKey: options.apiKey,
      endpoint: options.endpoint,
    });
  }

  if (options?.timeout) {
    builder.withTimeout({ ...DEFAULT_TIMEOUT, ...options.timeout });
  }

  if (options?.retries) {
    builder.withRetries({ ...DEFAULT_RETRY, ...options.retries });
  }

  return builder.build();
}