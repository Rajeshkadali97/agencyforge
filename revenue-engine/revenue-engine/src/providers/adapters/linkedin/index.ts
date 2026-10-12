import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig } from "../../interfaces/provider-base.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok, fail } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";

// LinkedIn API v2. Requires a pre-obtained OAuth 2.0 bearer token.
// Set LINKEDIN_ACCESS_TOKEN in env (complete OAuth flow separately).
const LINKEDIN_BASE = "https://api.linkedin.com/v2";

interface LinkedInInput {
  operation: string;
  parameters: Record<string, unknown>;
}

export class LinkedInProvider extends ProviderAdapter {
  readonly id = "linkedin";
  readonly displayName = "LinkedIn";
  readonly version = "1.0.0";
  readonly category = "business-enrichment" as const;
  readonly capabilities = [
    "business.discovery",
    "lead.extraction",
    "lead.enrichment",
    "needs.analysis",
  ] as const;
  readonly priority = "critical" as const;

  protected async onInitialize(_config: ProviderConfig): Promise<void> {}
  protected async onDispose(): Promise<void> {}
  protected async onHealthCheck(): Promise<Result<ProviderHealth>> {
    return ok({ status: "available" as const, checkedAt: new Date() });
  }

  protected override async onExecute<TInput = unknown, TOutput = unknown>(
    input: TInput
  ): Promise<Result<TOutput>> {
    const { operation, parameters } = input as LinkedInInput;
    const token = process.env["LINKEDIN_ACCESS_TOKEN"] ?? "";

    if (!token) {
      return ok({
        companies: [], people: [], profile: null, analysis: null,
        source: "linkedin", unavailable: true,
        reason: "LINKEDIN_ACCESS_TOKEN not configured — complete OAuth 2.0 flow first",
      } as TOutput);
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
    };

    try {
      if (operation === "business.discovery") {
        const query = (parameters["query"] as string | undefined) ?? "";
        const limit = (parameters["limit"] as number | undefined) ?? 10;

        const url = `${LINKEDIN_BASE}/search?q=companiesV2&keywords=${encodeURIComponent(query)}&count=${limit}`;
        const res = await fetch(url, { headers });

        if (!res.ok) {
          return fail({ code: "LINKEDIN_SEARCH_ERROR", message: `LinkedIn company search ${res.status}`, retryable: res.status >= 500 }) as Result<TOutput>;
        }

        const data = await res.json() as { elements?: unknown[]; paging?: { total?: number } };
        return ok({ companies: data.elements ?? [], total: data.paging?.total ?? 0, source: "linkedin" } as TOutput);
      }

      if (operation === "lead.extraction") {
        const companyId = parameters["company_id"] as string | undefined;
        const keywords = (parameters["keywords"] as string | undefined) ?? "";
        const limit = (parameters["limit"] as number | undefined) ?? 10;

        const params = new URLSearchParams({ q: "people", keywords, count: String(limit) });
        if (companyId) params.set("facetCurrentCompany", companyId);

        const res = await fetch(`${LINKEDIN_BASE}/search?${params.toString()}`, { headers });
        if (!res.ok) {
          return fail({ code: "LINKEDIN_PEOPLE_ERROR", message: `LinkedIn people search ${res.status}`, retryable: res.status >= 500 }) as Result<TOutput>;
        }

        const data = await res.json() as { elements?: unknown[]; paging?: { total?: number } };
        return ok({ people: data.elements ?? [], total: data.paging?.total ?? 0, source: "linkedin" } as TOutput);
      }

      if (operation === "lead.enrichment") {
        const profileId = parameters["profile_id"] as string | undefined;
        if (!profileId) {
          return fail({ code: "LINKEDIN_MISSING_PROFILE_ID", message: "LinkedIn lead.enrichment requires profile_id", retryable: false }) as Result<TOutput>;
        }

        const fields = "id,firstName,lastName,headline,profilePicture,publicProfileUrl,positions";
        const res = await fetch(`${LINKEDIN_BASE}/people/${encodeURIComponent(profileId)}?fields=${fields}`, { headers });
        if (!res.ok) {
          return fail({ code: "LINKEDIN_PROFILE_ERROR", message: `LinkedIn profile ${res.status}`, retryable: res.status >= 500 }) as Result<TOutput>;
        }

        const profile = await res.json() as unknown;
        return ok({ profile, source: "linkedin" } as TOutput);
      }

      if (operation === "needs.analysis") {
        const companyData = parameters["company_data"] as Record<string, unknown> | undefined;
        if (!companyData) {
          return fail({ code: "LINKEDIN_MISSING_COMPANY_DATA", message: "LinkedIn needs.analysis requires company_data", retryable: false }) as Result<TOutput>;
        }

        const headcount = companyData["employeeCount"] as number | undefined;
        const industry = companyData["industries"] as string[] | undefined;
        const specialties = companyData["specialties"] as string[] | undefined;

        const signals: string[] = [];
        if (headcount && headcount > 100) signals.push("mid-market scale");
        if (headcount && headcount > 1000) signals.push("enterprise scale");
        if (industry?.some((i) => /tech|software|saas/i.test(i))) signals.push("tech-forward");
        if (specialties?.some((s) => /digital|cloud|ai|automation/i.test(s))) signals.push("digital transformation interest");

        return ok({ analysis: { signals, confidence: signals.length > 0 ? 0.7 : 0.3 }, source: "linkedin" } as TOutput);
      }

      return fail({ code: "LINKEDIN_UNKNOWN_OP", message: `LinkedIn: unknown operation "${operation}"`, retryable: false }) as Result<TOutput>;
    } catch (err) {
      return fail({ code: "LINKEDIN_ERROR", message: err instanceof Error ? err.message : String(err), retryable: false }) as Result<TOutput>;
    }
  }
}
