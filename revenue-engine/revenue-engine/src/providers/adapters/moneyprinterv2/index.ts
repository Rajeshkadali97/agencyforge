import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig, ProviderCategory, ProviderPriority } from "../../interfaces/provider-base.js";
import type { ProviderCapability } from "../../interfaces/provider-capability.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";

export class MoneyPrinterV2Provider extends ProviderAdapter {
  readonly id = "moneyprinterv2";
  readonly displayName = "MoneyPrinterV2";
  readonly version = "1.0.0";
  readonly category = "content" as ProviderCategory;
  readonly capabilities = [
    "content.script",
    "content.storyboard",
    "content.voice",
    "content.image",
    "content.video",
    "content.thumbnail",
    "content.publish",
    "analytics.metrics",
  ] as ReadonlyArray<ProviderCapability>;
  readonly priority = "normal" as ProviderPriority;

  protected async onInitialize(_config: ProviderConfig): Promise<void> {}
  protected async onDispose(): Promise<void> {}
  protected async onHealthCheck(): Promise<Result<ProviderHealth>> {
    return ok({ status: "available", checkedAt: new Date() });
  }
}
