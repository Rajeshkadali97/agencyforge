"use client";

import * as React from "react";
import { Activity, Zap, AlertCircle, CheckCircle, Clock, RefreshCw, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { RUNTIME_ENDPOINTS } from "@/lib/runtime-config";
import { PageHeader, Surface } from "@/components/page-header";

interface ProviderStatus {
  id: string;
  name: string;
  isAvailable: boolean;
  isConfigured: boolean;
  health: "healthy" | "degraded" | "unavailable";
  latencyMs?: number;
  reason?: string;
}

interface AIMetrics {
  requestsTotal: number;
  requestsByProvider: Record<string, number>;
  errorsByProvider: Record<string, number>;
  averageLatencyMs: Record<string, number>;
  failoverCount: number;
}

interface RoutingData {
  health: Record<string, ProviderStatus>;
  metrics: AIMetrics;
  timestamp: string;
}

const PROVIDER_ORDER = ["ninerouter", "ollama", "openrouter", "gemini", "nim", "anthropic", "openai"];

type DisplayState = "healthy" | "degraded" | "unavailable" | "not-configured";

/** A provider without credentials is not "healthy" — show it as not configured. */
function displayState(p: ProviderStatus): DisplayState {
  if (!p.isConfigured && p.health !== "unavailable") return "not-configured";
  return p.health;
}

const STATE_STYLE: Record<DisplayState, { label: string; badge: string; icon: React.ReactNode }> = {
  healthy: {
    label: "healthy",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  },
  degraded: {
    label: "degraded",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
  },
  unavailable: {
    label: "unavailable",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    icon: <AlertCircle className="h-4 w-4 text-rose-500" />,
  },
  "not-configured": {
    label: "not configured",
    badge: "bg-neutral-100 text-neutral-500 border-neutral-200",
    icon: <MinusCircle className="h-4 w-4 text-neutral-400" />,
  },
};

export default function AIRoutingPage() {
  const [data, setData] = React.useState<RoutingData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = React.useState<Date | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      const res = await fetch(RUNTIME_ENDPOINTS.aiRouting, { cache: "no-store" });
      if (!res.ok) throw new Error(`Runtime returned ${res.status}`);
      const json: RoutingData = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch routing data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const providers = React.useMemo(() => {
    if (!data) return [];
    const ordered = PROVIDER_ORDER.map((id) => data.health[id]).filter(Boolean);
    const rest = Object.values(data.health).filter((p) => !PROVIDER_ORDER.includes(p.id));
    return [...ordered, ...rest];
  }, [data]);

  const totalRequests = data?.metrics.requestsTotal ?? 0;
  const failovers = data?.metrics.failoverCount ?? 0;
  const activeProvider =
    providers.find((p) => p.isConfigured && p.health === "healthy")?.name ??
    providers.find((p) => p.health === "healthy" && p.isConfigured !== false)?.name ??
    "None configured";

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <PageHeader
        icon={<Activity className="h-6 w-6" />}
        title="AI Routing"
        subtitle="Provider chain, health and automatic failover"
        actions={
          <>
            {lastRefresh && (
              <span className="text-xs font-medium text-neutral-400">
                Updated <span suppressHydrationWarning>{lastRefresh.toLocaleTimeString()}</span>
              </span>
            )}
            <button
              onClick={fetchData}
              aria-label="Refresh provider status"
              className="rounded-xl border border-white/70 bg-white/70 p-2.5 text-neutral-500 shadow-sm transition hover:bg-white hover:text-neutral-800"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </>
        }
      />

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span className="font-semibold">Runtime unreachable:</span> {error}
          <span className="ml-2 text-rose-500">Start it with <code className="font-mono">pnpm start:runtime</code>.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Active gateway", value: activeProvider, icon: <Zap className="h-4 w-4 text-violet-500" /> },
          { label: "Total requests", value: totalRequests.toLocaleString(), icon: <Activity className="h-4 w-4 text-sky-500" /> },
          { label: "Failovers", value: failovers.toLocaleString(), icon: <RefreshCw className="h-4 w-4 text-amber-500" /> },
        ].map(({ label, value, icon }) => (
          <Surface key={label} className="space-y-2 p-5">
            <div className="flex items-center gap-2 text-neutral-500">
              {icon}
              <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <p className="truncate text-2xl font-extrabold tracking-tight text-neutral-900">{value}</p>
          </Surface>
        ))}
      </div>

      <Surface className="overflow-hidden">
        <div className="border-b border-black/5 px-5 py-4">
          <h2 className="text-[15px] font-extrabold text-neutral-900">Provider chain</h2>
          <p className="mt-0.5 text-xs font-medium text-neutral-500">
            Ordered by priority. The first available provider answers; the next one takes over on failure.
          </p>
        </div>
        {loading && !data ? (
          <div className="p-10 text-center text-sm text-neutral-400">Loading providers…</div>
        ) : providers.length === 0 ? (
          <div className="p-10 text-center text-sm text-neutral-400">No provider data. Is the runtime running?</div>
        ) : (
          <ul className="divide-y divide-black/5">
            {providers.map((provider, idx) => {
              const requests = data?.metrics.requestsByProvider[provider.id] ?? 0;
              const errors = data?.metrics.errorsByProvider[provider.id] ?? 0;
              const avgLatency = data?.metrics.averageLatencyMs[provider.id];
              const state = displayState(provider);
              const style = STATE_STYLE[state];
              const latency = provider.latencyMs ?? (avgLatency != null ? Math.round(avgLatency) : undefined);

              return (
                <li key={provider.id} className="flex items-center gap-4 px-5 py-3.5 text-sm">
                  <span className="w-5 font-mono text-xs text-neutral-300">{idx + 1}</span>
                  {style.icon}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-neutral-800">{provider.name}</span>
                      {idx === 0 && (
                        <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                          PRIMARY
                        </span>
                      )}
                    </div>
                    {provider.reason && <p className="mt-0.5 truncate text-xs text-neutral-400">{provider.reason}</p>}
                  </div>
                  <span className={cn("rounded-lg border px-2 py-0.5 text-xs font-semibold", style.badge)}>{style.label}</span>
                  <div className="w-20 text-right">
                    {latency != null ? (
                      <span className="flex items-center justify-end gap-1 text-xs font-medium text-neutral-500">
                        <Clock className="h-3 w-3" />
                        {latency}ms
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-300">–</span>
                    )}
                  </div>
                  <div className="w-24 space-y-0.5 text-right text-xs font-medium text-neutral-400">
                    <div>{requests} reqs</div>
                    {errors > 0 && <div className="text-rose-500">{errors} err</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>

      <p className="text-center text-xs font-medium text-neutral-400">
        The gateway runs locally at <code className="font-mono text-neutral-500">localhost:20128</code>. Start it with{" "}
        <code className="font-mono text-neutral-500">npx 9router</code>. Other providers are direct fallbacks.
      </p>
    </div>
  );
}
