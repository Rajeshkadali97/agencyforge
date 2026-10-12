import type { CatalogApi, SuggestedApi } from './types';
import raw from './data/public-apis.json';

/**
 * Catalog of free public APIs, generated from https://github.com/public-apis/public-apis (MIT).
 * Rebuild with `node scripts/build-api-catalog.mjs <path to public-apis/README.md>`.
 */
/** APIs wired up as built-in agent tools. They are listed first and flagged as featured. */
const FEATURED = new Set(['Wikipedia', 'Open-Meteo', 'World Bank', 'Hacker News']);

const CATALOG: CatalogApi[] = (raw as CatalogApi[]).map((api) =>
  FEATURED.has(api.name) && api.auth === 'none' ? { ...api, featured: true } : api,
);

export interface CatalogQuery {
  q?: string;
  category?: string;
  auth?: string;
  httpsOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface CatalogPage {
  total: number;
  items: CatalogApi[];
  limit: number;
  offset: number;
}

export function getCatalog(): readonly CatalogApi[] {
  return CATALOG;
}

export function searchCatalog(query: CatalogQuery = {}, source: readonly CatalogApi[] = CATALOG): CatalogPage {
  const limit = Math.min(Math.max(query.limit ?? 24, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);
  const terms = (query.q ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const category = query.category?.toLowerCase();
  const auth = query.auth?.toLowerCase();

  const matches = source.filter((api) => {
    if (category && api.category.toLowerCase() !== category) return false;
    if (auth && api.auth.toLowerCase() !== auth) return false;
    if (query.httpsOnly && !api.https) return false;
    if (terms.length === 0) return true;
    const hay = `${api.name} ${api.description} ${api.category}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });

  // Without a search the built-in tools come first; afterwards the order is the catalog order.
  const ordered =
    terms.length === 0 && !category ? [...matches.filter((a) => a.featured), ...matches.filter((a) => !a.featured)] : matches;

  return { total: ordered.length, items: ordered.slice(offset, offset + limit), limit, offset };
}

export function listCategories(source: readonly CatalogApi[] = CATALOG): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const api of source) counts.set(api.category, (counts.get(api.category) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'with', 'my', 'me', 'our', 'your', 'about',
  'find', 'give', 'make', 'build', 'create', 'research', 'plan', 'show', 'tell', 'please', 'brief', 'report',
  'get', 'need', 'want', 'can', 'you', 'how', 'what', 'is', 'are', 'from', 'into', 'new',
]);

/** Suggest free, key-less, HTTPS APIs whose name or description overlaps the goal. */
export function suggestApis(goal: string, max = 5, source: readonly CatalogApi[] = CATALOG): SuggestedApi[] {
  const words = goal
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  if (words.length === 0) return [];

  const scored: Array<{ api: CatalogApi; score: number }> = [];
  for (const api of source) {
    if (api.auth !== 'none' || !api.https) continue;
    const name = api.name.toLowerCase();
    const hay = `${name} ${api.description.toLowerCase()} ${api.category.toLowerCase()}`;
    let score = 0;
    for (const w of words) {
      if (name.includes(w)) score += 3;
      else if (hay.includes(w)) score += 1;
    }
    if (score > 0) scored.push({ api, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.api.name.localeCompare(b.api.name))
    .slice(0, max)
    .map(({ api }) => ({
      name: api.name,
      description: api.description,
      category: api.category,
      url: api.url,
      auth: api.auth,
    }));
}
