import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig } from "../../interfaces/provider-base.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";

export class ScrapeGraphAIProvider extends ProviderAdapter {
  readonly id = "scrapegraph-ai";
  readonly displayName = "ScrapeGraphAI";
  readonly version = "1.0.0";
  readonly category = "website-analysis" as const;
  readonly capabilities = [
    "website.audit",
    "website.scrape",
  ] as const;
  readonly priority = "high" as const;

  protected async onInitialize(_config: ProviderConfig): Promise<void> {}
  protected async onDispose(): Promise<void> {}
  protected async onHealthCheck(): Promise<Result<ProviderHealth>> {
    return ok({ status: "available", checkedAt: new Date() });
  }
}
