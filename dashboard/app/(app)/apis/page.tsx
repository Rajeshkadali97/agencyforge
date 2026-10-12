"use client";

import * as React from "react";
import { Library, Search, ExternalLink, ShieldCheck, KeyRound, Loader2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, Surface } from "@/components/page-header";
import { RUNTIME_ENDPOINTS } from "@/lib/runtime-config";
import { runtimeJson } from "@/lib/runtime-api";
import type { CatalogApi, CatalogPage } from "@/lib/missions";

const PAGE_SIZE = 24;

function AuthBadge({ auth }: { auth: string }) {
  const free = auth === "none";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase",
        free ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
      )}
    >
      {free ? <ShieldCheck className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}
      {free ? "No key" : auth}
    </span>
  );
}

function ApiCard({ api }: { api: CatalogApi }) {
  return (
    <a
      href={api.url}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full flex-col rounded-2xl border border-white/80 bg-white/60 p-4 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-extrabold leading-snug text-neutral-900 group-hover:text-emerald-700">{api.name}</h3>
        <ExternalLink className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-neutral-300 group-hover:text-emerald-600" />
      </div>
      {api.featured && (
        <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
          Built-in agent tool
        </span>
      )}
      <p className="mt-1.5 flex-1 text-[13px] font-medium leading-relaxed text-neutral-500">{api.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <AuthBadge auth={api.auth} />
        {api.https && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-sky-700">HTTPS</span>
        )}
        {api.cors === "yes" && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-violet-700">CORS</span>
        )}
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-neutral-400">{api.category}</span>
      </div>
    </a>
  );
}

export default function ApiExplorerPage() {
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [freeOnly, setFreeOnly] = React.useState(true);
  const [categories, setCategories] = React.useState<Array<{ name: string; count: number }>>([]);
  const [page, setPage] = React.useState<CatalogPage | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    runtimeJson<{ total: number; categories: Array<{ name: string; count: number }> }>(RUNTIME_ENDPOINTS.apiCategories)
      .then((res) => setCategories(res.categories))
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    setOffset(0);
  }, [debounced, category, freeOnly]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (debounced) params.set("q", debounced);
    if (category) params.set("category", category);
    if (freeOnly) {
      params.set("auth", "none");
      params.set("https", "1");
    }
    runtimeJson<CatalogPage>(`${RUNTIME_ENDPOINTS.apis}?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setPage(res);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load the catalog");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, category, freeOnly, offset]);

  const total = page?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 p-6 lg:p-8">
      <PageHeader
        icon={<Library className="h-6 w-6" />}
        title="API Explorer"
        subtitle="Free public APIs your agents can use as tools"
        actions={
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            {page ? `${total.toLocaleString()} match${total === 1 ? "" : "es"}` : "…"}
          </span>
        }
      />

      <Surface className="flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search weather, maps, finance, books…"
            aria-label="Search APIs"
            className="w-full rounded-2xl border border-black/10 bg-white/80 py-2.5 pl-10 pr-4 text-sm font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
          className="rounded-2xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm font-semibold text-neutral-700 outline-none focus:border-emerald-400"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.count})
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-neutral-600">
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(e) => setFreeOnly(e.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
          Free, no key, HTTPS only
        </label>
      </Surface>

      {error ? (
        <Surface className="flex items-center gap-3 border-rose-200 p-5 text-sm font-semibold text-rose-600">
          <WifiOff className="h-5 w-5" />
          {error}. Start the runtime with <code className="font-mono">pnpm start:runtime</code>.
        </Surface>
      ) : loading && !page ? (
        <div className="flex items-center justify-center py-20 text-neutral-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : page && page.items.length === 0 ? (
        <Surface className="p-10 text-center text-sm font-semibold text-neutral-500">
          No APIs match. Try a broader search or untick the free-only filter.
        </Surface>
      ) : (
        <>
          <ul className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3", loading && "opacity-60 transition-opacity")}>
            {page?.items.map((api) => (
              <li key={`${api.category}-${api.name}-${api.url}`}>
                <ApiCard api={api} />
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-neutral-500">
              Showing {from}–{to} of {total.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="rounded-xl border border-black/10 bg-white/70 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-white disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={to >= total || loading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="rounded-xl border border-black/10 bg-white/70 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <p className="text-center text-xs font-medium text-neutral-400">
        Catalog sourced from the MIT-licensed{" "}
        <a href="https://github.com/public-apis/public-apis" target="_blank" rel="noreferrer" className="font-bold text-neutral-500 underline">
          public-apis
        </a>{" "}
        project.
      </p>
    </div>
  );
}
