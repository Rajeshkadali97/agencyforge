import type { IProvider, ProviderCategory, ProviderConfig, ProviderPriority } from "./provider-base.js";
import type { ProviderCapability } from "./provider-capability.js";
import type { ProviderHealth } from "./provider-health.js";
import type { Result, RevenueEngineError } from "../../shared/result.js";
import { ok, fail } from "../../shared/result.js";

export abstract class ProviderAdapter implements IProvider {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly version: string;
  abstract readonly category: ProviderCategory;
  abstract readonly capabilities: ReadonlyArray<ProviderCapability>;
  abstract readonly priority: ProviderPriority;

  private _initialized = false;

  get isInitialized(): boolean {
    return this._initialized;
  }

  async initialize(config: ProviderConfig): Promise<void> {
    if (this._initialized) {
      throw new Error(`Provider ${this.id} is already initialized.`);
    }
    await this.onInitialize(config);
    this._initialized = true;
  }

  async dispose(): Promise<void> {
    if (!this._initialized) return;
    await this.onDispose();
    this._initialized = false;
  }

  async healthCheck(): Promise<Result<ProviderHealth>> {
    if (!this._initialized) {
      return fail({
        code: "PROVIDER_NOT_INITIALIZED",
        message: `Provider ${this.id} is not initialized.`,
        retryable: false,
      });
    }
    return this.onHealthCheck();
  }

  async execute<TInput = unknown, TOutput = unknown>(input: TInput): Promise<Result<TOutput>> {
    if (!this._initialized) {
      return fail({
        code: "PROVIDER_NOT_INITIALIZED",
        message: `Provider ${this.id} is not initialized.`,
        retryable: false,
      }) as Result<TOutput>;
    }
    return this.onExecute<TInput, TOutput>(input);
  }

  protected abstract onInitialize(config: ProviderConfig): Promise<void>;
  protected abstract onDispose(): Promise<void>;
  protected abstract onHealthCheck(): Promise<Result<ProviderHealth>>;
  protected async onExecute<TInput = unknown, TOutput = unknown>(_input: TInput): Promise<Result<TOutput>> {
    return fail({
      code: "NOT_IMPLEMENTED",
      message: `Provider ${this.id} does not implement execute().`,
      retryable: false,
    }) as Result<TOutput>;
  }
}
