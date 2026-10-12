import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig } from "../../interfaces/provider-base.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok, fail } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";

const APOLLO_BASE = "https://api.apollo.io/v1";

interface ApolloInput {
  operation: string;
  parameters: Record<string, unknown>;
}

export class ApolloProvider extends ProviderAdapter {
  readonly id = "apollo";
  readonly displayName = "Apollo";
  readonly version = "1.0.0";
  readonly category = "business-enrichment" as const;
  readonly capabilities = [
    "business.discovery",
    "lead.extraction",
    "lead.enrichment",
    "lead.scoring",
  ] as const;
  readonly priority = "high" as const;

  protected async onInitialize(_config: ProviderConfig): Promise<void> {}
  protected async onDispose(): Promise<void> {}
  protected async onHealthCheck(): Promise<Result<ProviderHealth>> {
    return ok({ status: "available" as const, checkedAt: new Date() });
  }

  protected override async onExecute<TInput = unknown, TOutput = unknown>(
    input: TInput
  ): Promise<Result<TOutput>> {
    const { operation, parameters } = input as ApolloInput;
    const apiKey = process.env["APOLLO_API_KEY"] ?? "";

    if (!apiKey) {
      return ok({ leads: [], companies: [], total: 0, source: "apollo", unavailable: true, reason: "APOLLO_API_KEY not configured" } as TOutput);
    }

    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    };

    try {
      if (operation === "business.discovery" || operation === "lead.extraction") {
        const query = parameters["query"] as string | undefined;
        const domain = parameters["domain"] as string | undefined;
        const industry = parameters["industry"] as string | undefined;
        const limit = (parameters["limit"] as number | undefined) ?? 10;

        const body: Record<string, unknown> = { page: 1, per_page: limit };
        if (query) body["q_organization_name"] = query;
        if (domain) body["q_organization_domains"] = [domain];
        if (industry) body["organization_industry_tag_ids"] = [industry];

        const res = await fetch(`${APOLLO_BASE}/mixed_companies/search`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          return fail({ code: "APOLLO_SEARCH_ERROR", message: `Apollo companies search ${res.status}`, retryable: res.status >= 500 }) as Result<TOutput>;
        }

        const data = await res.json() as { organizations?: unknown[]; total_entries?: number };
        return ok({ companies: data.organizations ?? [], total: data.total_entries ?? 0, source: "apollo" } as TOutput);
      }

      if (operation === "lead.enrichment") {
        const email = parameters["email"] as string | undefined;
        const name = parameters["name"] as string | undefined;
        const domain = parameters["domain"] as string | undefined;

        if (!email && !domain) {
          return fail({ code: "APOLLO_MISSING_PARAM", message: "Apollo lead.enrichment requires email or domain", retryable: false }) as Result<TOutput>;
        }

        const body: Record<string, unknown> = {};
        if (email) body["email"] = email;
        if (name) body["name"] = name;
        if (domain) body["domain"] = domain;

        const res = await fetch(`${APOLLO_BASE}/people/match`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          return fail({ code: "APOLLO_ENRICH_ERROR", message: `Apollo people match ${res.status}`, retryable: res.status >= 500 }) as Result<TOutput>;
        }

        const data = await res.json() as { person?: unknown };
        return ok({ person: data.person ?? null, source: "apollo" } as TOutput);
      }

      if (operation === "lead.scoring") {
        const leads = parameters["leads"] as Array<Record<string, unknown>> | undefined;
        if (!leads || leads.length === 0) {
          return ok({ scored: [], source: "apollo" } as TOutput);
        }
        const emails = leads.map((l) => l["email"]).filter(Boolean) as string[];

        const res = await fetch(`${APOLLO_BASE}/contacts/bulk_match`, {
          method: "POST",
          headers,
          body: JSON.stringify({ emails }),
        });

        if (!res.ok) {
          return fail({ code: "APOLLO_SCORE_ERROR", message: `Apollo bulk match ${res.status}`, retryable: res.status >= 500 }) as Result<TOutput>;
        }

        const data = await res.json() as { matches?: unknown[] };
        return ok({ scored: data.matches ?? [], total: (data.matches ?? []).length, source: "apollo" } as TOutput);
      }

      return fail({ code: "APOLLO_UNKNOWN_OP", message: `Apollo: unknown operation "${operation}"`, retryable: false }) as Result<TOutput>;
    } catch (err) {
      return fail({ code: "APOLLO_ERROR", message: err instanceof Error ? err.message : String(err), retryable: false }) as Result<TOutput>;
    }
  }
}
