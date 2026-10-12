import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig } from "../../interfaces/provider-base.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";

export class CompanyWebsitesProvider extends ProviderAdapter {
  readonly id = "company-websites";
  readonly displayName = "CompanyWebsites";
  readonly version = "1.0.0";
  readonly category = "website-analysis" as const;
  readonly capabilities = [
    "website.audit",
    "website.scrape",
  ] as const;
  readonly priority = "normal" as const;

  protected async onInitialize(_config: ProviderConfig): Promise<void> {}
  protected async onDispose(): Promise<void> {}
  protected async onHealthCheck(): Promise<Result<ProviderHealth>> {
    return ok({ status: "available", checkedAt: new Date() });
  }
}
