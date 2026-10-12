import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig } from "../../interfaces/provider-base.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok, fail } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";

interface FirecrawlInput {
  operation: string;
  parameters: Record<string, unknown>;
}

export class FirecrawlProvider extends ProviderAdapter {
  readonly id = "firecrawl";
  readonly displayName = "Firecrawl";
  readonly version = "1.0.0";
  readonly category = "website-analysis" as const;
  readonly capabilities = [
    "website.audit",
    "website.scrape",
  ] as const;
  readonly priority = "high" as const;

  private apiKey = "";
  private baseUrl = "https://api.firecrawl.dev";

  protected async onInitialize(config: ProviderConfig): Promise<void> {
    this.apiKey = (config["apiKey"] as string | undefined) ?? process.env["FIRECRAWL_API_KEY"] ?? "";
    this.baseUrl = (config["baseUrl"] as string | undefined) ?? process.env["FIRECRAWL_API_URL"] ?? "https://api.firecrawl.dev";
  }

  protected async onDispose(): Promise<void> {}

  protected async onHealthCheck(): Promise<Result<ProviderHealth>> {
    if (!this.apiKey) {
      return ok({ status: "degraded" as const, checkedAt: new Date() });
    }
    return ok({ status: "available" as const, checkedAt: new Date() });
  }

  protected override async onExecute<TInput = unknown, TOutput = unknown>(
    input: TInput
  ): Promise<Result<TOutput>> {
    const { operation, parameters } = input as FirecrawlInput;

    if (!this.apiKey) {
      return fail({
        code: "FIRECRAWL_NO_API_KEY",
        message: "Set FIRECRAWL_API_KEY to enable web scraping",
        retryable: false,
      }) as Result<TOutput>;
    }

    const url = parameters["url"] as string | undefined;
    if (!url) {
      return fail({
        code: "FIRECRAWL_MISSING_URL",
        message: "parameters.url is required",
        retryable: false,
      }) as Result<TOutput>;
    }

    try {
      if (operation === "website.scrape") {
        return await this.scrape(url) as Result<TOutput>;
      }
      if (operation === "website.audit") {
        return await this.audit(url, parameters["limit"] as number | undefined) as Result<TOutput>;
      }
      return fail({
        code: "FIRECRAWL_UNKNOWN_OP",
        message: `Unknown operation: ${operation}`,
        retryable: false,
      }) as Result<TOutput>;
    } catch (err) {
      return fail({
        code: "FIRECRAWL_ERROR",
        message: err instanceof Error ? err.message : String(err),
        cause: err,
        retryable: true,
      }) as Result<TOutput>;
    }
  }

  private async scrape(url: string): Promise<Result<unknown>> {
    const res = await fetch(`${this.baseUrl}/v1/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ url, formats: ["markdown"] }),
    });
    if (!res.ok) {
      return fail({ code: "FIRECRAWL_HTTP_ERROR", message: `Firecrawl scrape ${res.status}`, retryable: res.status >= 500 });
    }
    const data = await res.json() as Record<string, unknown>;
    return ok(data);
  }

  private async audit(url: string, limit = 10): Promise<Result<unknown>> {
    const res = await fetch(`${this.baseUrl}/v1/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ url, limit, scrapeOptions: { formats: ["markdown"] } }),
    });
    if (!res.ok) {
      return fail({ code: "FIRECRAWL_HTTP_ERROR", message: `Firecrawl crawl ${res.status}`, retryable: res.status >= 500 });
    }
    const data = await res.json() as Record<string, unknown>;
    return ok(data);
  }
}
