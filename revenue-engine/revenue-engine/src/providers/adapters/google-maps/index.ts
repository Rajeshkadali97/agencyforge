import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig } from "../../interfaces/provider-base.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok, fail } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";

const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";

interface MapsInput {
  operation: string;
  parameters: Record<string, unknown>;
}

export class GoogleMapsProvider extends ProviderAdapter {
  readonly id = "google-maps";
  readonly displayName = "GoogleMaps";
  readonly version = "1.0.0";
  readonly category = "discovery" as const;
  readonly capabilities = [
    "business.discovery",
    "lead.extraction",
    "lead.enrichment",
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
    const { operation, parameters } = input as MapsInput;
    const apiKey = process.env["GOOGLE_MAPS_API_KEY"] ?? "";

    if (!apiKey) {
      return ok({ places: [], total: 0, source: "google-maps", unavailable: true, reason: "GOOGLE_MAPS_API_KEY not configured" } as TOutput);
    }

    try {
      if (operation === "business.discovery" || operation === "lead.extraction") {
        const query = (parameters["query"] as string | undefined) ?? "";
        const location = parameters["location"] as string | undefined;
        const radius = (parameters["radius"] as number | undefined) ?? 50000;
        const type = (parameters["type"] as string | undefined) ?? "business";

        let url = `${PLACES_BASE}/textsearch/json?query=${encodeURIComponent(query)}&type=${type}&key=${apiKey}`;
        if (location) url += `&location=${encodeURIComponent(location)}&radius=${radius}`;

        const res = await fetch(url);
        if (!res.ok) {
          return fail({ code: "GMAPS_HTTP_ERROR", message: `Google Maps textsearch ${res.status}`, retryable: res.status >= 500 }) as Result<TOutput>;
        }

        const data = await res.json() as { results?: unknown[]; status?: string };
        if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
          return fail({ code: "GMAPS_API_ERROR", message: `Google Maps API status: ${data.status}`, retryable: false }) as Result<TOutput>;
        }

        return ok({ places: data.results ?? [], total: (data.results ?? []).length, source: "google-maps" } as TOutput);
      }

      if (operation === "lead.enrichment") {
        const placeId = parameters["place_id"] as string | undefined;
        if (!placeId) {
          return fail({ code: "GMAPS_MISSING_PLACE_ID", message: "Google Maps lead.enrichment requires place_id", retryable: false }) as Result<TOutput>;
        }

        const fields = "name,formatted_address,formatted_phone_number,website,rating,opening_hours,business_status,url,types";
        const url = `${PLACES_BASE}/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${apiKey}`;

        const res = await fetch(url);
        if (!res.ok) {
          return fail({ code: "GMAPS_HTTP_ERROR", message: `Google Maps place details ${res.status}`, retryable: res.status >= 500 }) as Result<TOutput>;
        }

        const data = await res.json() as { result?: unknown; status?: string };
        if (data.status && data.status !== "OK") {
          return fail({ code: "GMAPS_API_ERROR", message: `Google Maps API status: ${data.status}`, retryable: false }) as Result<TOutput>;
        }

        return ok({ place: data.result ?? null, source: "google-maps" } as TOutput);
      }

      return fail({ code: "GMAPS_UNKNOWN_OP", message: `GoogleMaps: unknown operation "${operation}"`, retryable: false }) as Result<TOutput>;
    } catch (err) {
      return fail({ code: "GMAPS_ERROR", message: err instanceof Error ? err.message : String(err), retryable: false }) as Result<TOutput>;
    }
  }
}
