import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig } from "../../interfaces/provider-base.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";

export class GrowChiefProvider extends ProviderAdapter {
  readonly id = "growchief";
  readonly displayName = "GrowChief";
  readonly version = "1.0.0";
  readonly category = "growth" as const;
  readonly capabilities = [
    "growth.plan",
    "growth.seo",
    "growth.lead-magnet",
    "growth.newsletter",
    "growth.traffic",
    "growth.analytics",
  ] as const;
  readonly priority = "normal" as const;

  protected async onInitialize(_config: ProviderConfig): Promise<void> {}
  protected async onDispose(): Promise<void> {}
  protected async onHealthCheck(): Promise<Result<ProviderHealth>> {
    return ok({ status: "available", checkedAt: new Date() });
  }
}
