import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig, ProviderCategory, ProviderPriority } from "../../interfaces/provider-base.js";
import type { ProviderCapability } from "../../interfaces/provider-capability.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";

export class FutureProvider extends ProviderAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly version = "0.0.0";
  readonly category = "discovery" as ProviderCategory;
  readonly capabilities: ReadonlyArray<ProviderCapability> = [];
  readonly priority = "fallback" as ProviderPriority;

  constructor(id: string, displayName: string) {
    super();
    this.id = id;
    this.displayName = displayName;
  }

  protected async onInitialize(_config: ProviderConfig): Promise<void> {}
  protected async onDispose(): Promise<void> {}
  protected async onHealthCheck(): Promise<Result<ProviderHealth>> {
    return ok({ status: "available", checkedAt: new Date() });
  }
}
