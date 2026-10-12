import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig } from "../../interfaces/provider-base.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok, fail } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";

interface ManualInput {
  operation: string;
  parameters: Record<string, unknown>;
}

export class ManualEntryProvider extends ProviderAdapter {
  readonly id = "manual-entry";
  readonly displayName = "ManualEntry";
  readonly version = "1.0.0";
  readonly category = "crm" as const;
  readonly capabilities = [
    "crm.sync",
    "crm.read",
    "crm.write",
  ] as const;
  readonly priority = "low" as const;

  private store: Array<Record<string, unknown>> = [];

  protected async onInitialize(_config: ProviderConfig): Promise<void> {
    this.store = [];
  }

  protected async onDispose(): Promise<void> {
    this.store = [];
  }

  protected async onHealthCheck(): Promise<Result<ProviderHealth>> {
    return ok({ status: "available" as const, checkedAt: new Date() });
  }

  protected override async onExecute<TInput = unknown, TOutput = unknown>(
    input: TInput
  ): Promise<Result<TOutput>> {
    const { operation, parameters } = input as ManualInput;

    if (operation === "crm.write") {
      const entry = parameters["entry"] as Record<string, unknown> | undefined;
      if (!entry) {
        return fail({ code: "MANUAL_MISSING_ENTRY", message: "parameters.entry is required for crm.write", retryable: false }) as Result<TOutput>;
      }
      this.store.push({ ...entry, _source: "manual-entry", _createdAt: new Date().toISOString() });
      return ok({ stored: true, total: this.store.length }) as Result<TOutput>;
    }

    if (operation === "crm.read") {
      const filter = parameters["filter"] as Record<string, unknown> | undefined;
      const results = filter
        ? this.store.filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v))
        : [...this.store];
      return ok({ entries: results, total: results.length, source: "manual-entry" }) as Result<TOutput>;
    }

    if (operation === "crm.sync") {
      const entries = parameters["entries"] as Array<Record<string, unknown>> | undefined;
      if (entries) {
        this.store.push(...entries.map((e) => ({ ...e, _source: "manual-entry", _syncedAt: new Date().toISOString() })));
      }
      return ok({ synced: entries?.length ?? 0, total: this.store.length }) as Result<TOutput>;
    }

    return fail({ code: "MANUAL_UNKNOWN_OP", message: `Unknown operation: ${operation}`, retryable: false }) as Result<TOutput>;
  }
}
