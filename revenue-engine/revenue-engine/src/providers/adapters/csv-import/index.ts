import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig } from "../../interfaces/provider-base.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok, fail } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";

interface CsvInput {
  operation: string;
  parameters: Record<string, unknown>;
}

export class CsvImportProvider extends ProviderAdapter {
  readonly id = "csv-import";
  readonly displayName = "CsvImport";
  readonly version = "1.0.0";
  readonly category = "crm" as const;
  readonly capabilities = [
    "crm.sync",
    "crm.read",
    "crm.write",
  ] as const;
  readonly priority = "normal" as const;

  protected async onInitialize(_config: ProviderConfig): Promise<void> {}
  protected async onDispose(): Promise<void> {}
  protected async onHealthCheck(): Promise<Result<ProviderHealth>> {
    return ok({ status: "available" as const, checkedAt: new Date() });
  }

  protected override async onExecute<TInput = unknown, TOutput = unknown>(
    input: TInput
  ): Promise<Result<TOutput>> {
    const { operation, parameters } = input as CsvInput;

    try {
      if (operation === "crm.read") {
        return this.parseCsv(parameters) as Result<TOutput>;
      }
      if (operation === "crm.write" || operation === "crm.sync") {
        return this.serializeCsv(parameters) as Result<TOutput>;
      }
      return fail({ code: "CSV_UNKNOWN_OP", message: `Unknown operation: ${operation}`, retryable: false }) as Result<TOutput>;
    } catch (err) {
      return fail({ code: "CSV_ERROR", message: err instanceof Error ? err.message : String(err), retryable: false }) as Result<TOutput>;
    }
  }

  private parseCsv(parameters: Record<string, unknown>): Result<unknown> {
    const csv = parameters["csv"] as string | undefined;
    if (!csv) {
      return fail({ code: "CSV_MISSING_DATA", message: "parameters.csv string is required for crm.read", retryable: false });
    }

    const lines = csv.trim().split(/\r?\n/);
    const header = lines[0];
    if (!header) {
      return ok({ records: [], total: 0 });
    }

    const keys = header.split(",").map((k) => k.trim().replace(/^"|"$/g, ""));
    const records = lines.slice(1).map((line) => {
      const values = splitCsvLine(line);
      const record: Record<string, string> = {};
      keys.forEach((key, i) => {
        record[key] = values[i] ?? "";
      });
      return record;
    });

    return ok({ records, total: records.length, source: "csv-import" });
  }

  private serializeCsv(parameters: Record<string, unknown>): Result<unknown> {
    const entries = parameters["entries"] as Array<Record<string, unknown>> | undefined;
    if (!entries || entries.length === 0) {
      return ok({ csv: "", total: 0 });
    }

    const first = entries[0];
    if (!first) return ok({ csv: "", total: 0 });

    const keys = Object.keys(first);
    const header = keys.map(csvEscape).join(",");
    const rows = entries.map((entry) => keys.map((k) => csvEscape(String(entry[k] ?? ""))).join(","));
    const csv = [header, ...rows].join("\n");

    return ok({ csv, total: entries.length });
  }
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
