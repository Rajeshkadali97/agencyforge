import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig } from "../../interfaces/provider-base.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";

export class ClutchProvider extends ProviderAdapter {
  readonly id = "clutch";
  readonly displayName = "Clutch";
  readonly version = "1.0.0";
  readonly category = "research" as const;
  readonly capabilities = [
    "business.discovery",
    "lead.scoring",
  ] as const;
  readonly priority = "normal" as const;

  protected async onInitialize(_config: ProviderConfig): Promise<void> {}
  protected async onDispose(): Promise<void> {}
  protected async onHealthCheck(): Promise<Result<ProviderHealth>> {
    return ok({ status: "available", checkedAt: new Date() });
  }
}
