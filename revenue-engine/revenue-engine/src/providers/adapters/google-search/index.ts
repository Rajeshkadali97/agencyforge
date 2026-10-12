import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig } from "../../interfaces/provider-base.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok, fail } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";

interface SearchInput {
  operation: string;
  parameters: Record<string, unknown>;
}

interface SerperResult {
  organic?: Array<{ title: string; link: string; snippet: string }>;
}

export class GoogleSearchProvider extends ProviderAdapter {
  readonly id = "google-search";
  readonly displayName = "GoogleSearch";
  readonly version = "1.0.0";
  readonly category = "discovery" as const;
  readonly capabilities = [
    "business.discovery",
    "lead.extraction",
    "lead.enrichment",
  ] as const;
  readonly priority = "high" as const;

  private apiKey = "";

  protected async onInitialize(config: ProviderConfig): Promise<void> {
    this.apiKey = (config["apiKey"] as string | undefined) ?? process.env["SERPER_API_KEY"] ?? "";
  }

  protected async onDispose(): Promise<void> {}

  protected async onHealthCheck(): Promise<Result<ProviderHealth>> {
    return ok({ status: this.apiKey ? ("available" as const) : ("degraded" as const), checkedAt: new Date() });
  }

  protected override async onExecute<TInput = unknown, TOutput = unknown>(
    input: TInput
  ): Promise<Result<TOutput>> {
    const { operation, parameters } = input as SearchInput;

    if (!this.apiKey) {
      return ok({ leads: [], source: "google-search", note: "Set SERPER_API_KEY for real results" }) as Result<TOutput>;
    }

    const query = parameters["query"] as string | undefined;
    if (!query) {
      return fail({ code: "GOOGLE_SEARCH_MISSING_QUERY", message: "parameters.query is required", retryable: false }) as Result<TOutput>;
    }

    try {
      if (operation === "business.discovery" || operation === "lead.extraction") {
        return await this.searchBusinesses(query, parameters) as Result<TOutput>;
      }
      if (operation === "lead.enrichment") {
        return await this.enrichLead(query) as Result<TOutput>;
      }
      return fail({ code: "GOOGLE_SEARCH_UNKNOWN_OP", message: `Unknown operation: ${operation}`, retryable: false }) as Result<TOutput>;
    } catch (err) {
      return fail({ code: "GOOGLE_SEARCH_ERROR", message: err instanceof Error ? err.message : String(err), cause: err, retryable: true }) as Result<TOutput>;
    }
  }

  private async searchBusinesses(query: string, parameters: Record<string, unknown>): Promise<Result<unknown>> {
    const location = parameters["location"] as string | undefined;
    const limit = (parameters["limit"] as number | undefined) ?? 10;
    const searchQuery = location ? `${query} ${location}` : query;

    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": this.apiKey },
      body: JSON.stringify({ q: searchQuery, num: Math.min(limit, 10) }),
    });

    if (!res.ok) {
      return fail({ code: "SERPER_HTTP_ERROR", message: `Serper API ${res.status}`, retryable: res.status >= 500 });
    }

    const data = await res.json() as SerperResult;
    const leads = (data.organic ?? []).map((item) => ({
      name: item.title,
      website: item.link,
      description: item.snippet,
      source: "google-search",
    }));

    return ok({ leads, total: leads.length, query: searchQuery });
  }

  private async enrichLead(domain: string): Promise<Result<unknown>> {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": this.apiKey },
      body: JSON.stringify({ q: `site:${domain}`, num: 5 }),
    });

    if (!res.ok) {
      return fail({ code: "SERPER_HTTP_ERROR", message: `Serper HTTP ${res.status}`, retryable: res.status >= 500 });
    }

    const data = await res.json() as SerperResult;
    return ok({ domain, pages: data.organic ?? [], source: "google-search" });
  }
}
