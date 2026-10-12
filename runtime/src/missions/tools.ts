import type { FetchLike, ToolId, ToolOutput } from './types';

/**
 * Agent tools backed by free, key-less public APIs listed in the public-apis catalog.
 * Every tool takes an injectable `fetch` so tests never touch the network.
 */

const USER_AGENT = 'AgencyForge/0.2 (open-source AI agency OS; https://github.com/Rajeshkadali97/agencyforge)';
const DEFAULT_TIMEOUT_MS = 8000;

export interface MissionToolContext {
  fetch: FetchLike;
  timeoutMs?: number;
}

export interface MissionToolDefinition {
  id: ToolId;
  label: string;
  /** Dashboard department that owns this tool. */
  agent: string;
  /** Name of the matching entry in the public-apis catalog. */
  catalogName: string;
  run(args: Record<string, string>, ctx: MissionToolContext): Promise<ToolOutput>;
}

async function getJson(ctx: MissionToolContext, url: string): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await ctx.fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return { status: res.status, body: null };
    return { status: res.status, body: await res.json() };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error(`Request timed out: ${new URL(url).hostname}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function trimTo(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, '')) + (lastStop > max * 0.5 ? '' : '…');
}

// ── Wikipedia ────────────────────────────────────────────────────────────────

/** Progressively shorter phrases so a noisy topic still finds an article. */
export function topicCandidates(topic: string): string[] {
  const words = topic.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const add = (t: string) => {
    const v = t.trim();
    if (v && !out.includes(v)) out.push(v);
  };
  add(topic);
  for (let n = words.length - 1; n >= 2; n--) add(words.slice(0, n).join(' '));
  for (const w of [...words].sort((x, y) => y.length - x.length)) if (w.length > 3) add(w);
  return out.slice(0, 5);
}

async function wikipediaLookup(ctx: MissionToolContext, topic: string): Promise<{ title: string; body: Record<string, unknown> } | null> {
  const summaryUrl = (title: string) =>
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;

  const direct = await getJson(ctx, summaryUrl(topic));
  if (direct.body && str(asRecord(direct.body)['extract'])) return { title: topic, body: asRecord(direct.body) };

  const search = await getJson(
    ctx,
    `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(topic)}&limit=1`,
  );
  const pages = asRecord(search.body)['pages'];
  const hit = asRecord(Array.isArray(pages) ? pages[0] : null);
  const found = str(hit['title']);
  if (!found) return null;
  const page = await getJson(ctx, summaryUrl(found));
  const body = asRecord(page.body);
  return str(body['extract']) ? { title: found, body } : null;
}

export const wikipediaTool: MissionToolDefinition = {
  id: 'wikipedia',
  label: 'Wikipedia summary',
  agent: 'research',
  catalogName: 'Wikipedia',
  async run(args, ctx) {
    const topic = (args['topic'] ?? '').trim();
    if (!topic) throw new Error('wikipedia: "topic" argument is required');

    let found: { title: string; body: Record<string, unknown> } | null = null;
    for (const candidate of topicCandidates(topic)) {
      found = await wikipediaLookup(ctx, candidate);
      if (found) break;
    }
    if (!found) throw new Error(`No Wikipedia article found for "${topic}"`);

    const { title, body } = found;
    const extract = str(body['extract']);
    const pageUrl =
      str(asRecord(asRecord(body['content_urls'])['desktop'])['page']) ||
      `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;

    return {
      summary: trimTo(extract, 420),
      data: { title: str(body['title']) || title, description: str(body['description']), extract },
      sourceName: 'Wikipedia',
      sourceUrl: pageUrl,
    };
  },
};

// ── Open-Meteo ───────────────────────────────────────────────────────────────

interface GeoHit {
  name: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}

async function geocode(ctx: MissionToolContext, place: string): Promise<GeoHit | null> {
  const geo = await getJson(
    ctx,
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`,
  );
  const first = asRecord(Array.isArray(asRecord(geo.body)['results']) ? (asRecord(geo.body)['results'] as unknown[])[0] : null);
  const latitude = num(first['latitude']);
  const longitude = num(first['longitude']);
  if (latitude === undefined || longitude === undefined) return null;
  return {
    name: str(first['name']) || place,
    country: str(first['country']),
    countryCode: str(first['country_code']),
    latitude,
    longitude,
  };
}

export const weatherTool: MissionToolDefinition = {
  id: 'weather',
  label: 'Current weather',
  agent: 'analytics',
  catalogName: 'Open-Meteo',
  async run(args, ctx) {
    const place = (args['place'] ?? '').trim();
    if (!place) throw new Error('weather: "place" argument is required');

    const hit = await geocode(ctx, place);
    if (!hit) throw new Error(`Could not locate "${place}"`);

    const forecast = await getJson(
      ctx,
      `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}` +
        `&current=temperature_2m,wind_speed_10m,relative_humidity_2m&timezone=auto`,
    );
    const current = asRecord(asRecord(forecast.body)['current']);
    const temperature = num(current['temperature_2m']);
    if (temperature === undefined) throw new Error(`No weather data for "${hit.name}"`);
    const wind = num(current['wind_speed_10m']);
    const humidity = num(current['relative_humidity_2m']);

    const where = hit.country ? `${hit.name}, ${hit.country}` : hit.name;
    const parts = [`${temperature.toFixed(1)} °C`];
    if (wind !== undefined) parts.push(`wind ${wind.toFixed(0)} km/h`);
    if (humidity !== undefined) parts.push(`humidity ${humidity.toFixed(0)}%`);

    return {
      summary: `Right now in ${where}: ${parts.join(', ')}.`,
      data: { place: where, latitude: hit.latitude, longitude: hit.longitude, temperatureC: temperature, windKmh: wind, humidityPct: humidity },
      sourceName: 'Open-Meteo',
      sourceUrl: 'https://open-meteo.com/',
    };
  },
};

// ── World Bank ───────────────────────────────────────────────────────────────

function formatPopulation(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} million`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} thousand`;
  return String(n);
}

async function latestIndicator(ctx: MissionToolContext, iso2: string, indicator: string): Promise<{ value: number; year: string } | null> {
  try {
    const res = await getJson(ctx, `https://api.worldbank.org/v2/country/${iso2}/indicator/${indicator}?format=json&mrnev=1`);
    const rows = Array.isArray(res.body) ? (res.body as unknown[])[1] : null;
    const row = asRecord(Array.isArray(rows) ? rows[0] : null);
    const value = num(row['value']);
    return value === undefined ? null : { value, year: str(row['date']) };
  } catch {
    return null;
  }
}

export const countryTool: MissionToolDefinition = {
  id: 'country',
  label: 'Market profile',
  agent: 'marketing',
  catalogName: 'World Bank',
  async run(args, ctx) {
    const place = (args['place'] ?? '').trim();
    if (!place) throw new Error('country: "place" argument is required');

    // City or country name -> ISO country code through the geocoder.
    const hit = await geocode(ctx, place);
    const iso2 = hit?.countryCode;
    if (!iso2) throw new Error(`Could not resolve a country for "${place}"`);

    const [info, population, gdp] = await Promise.all([
      getJson(ctx, `https://api.worldbank.org/v2/country/${iso2}?format=json`),
      latestIndicator(ctx, iso2, 'SP.POP.TOTL'),
      latestIndicator(ctx, iso2, 'NY.GDP.PCAP.CD'),
    ]);

    const rows = Array.isArray(info.body) ? (info.body as unknown[])[1] : null;
    const c = asRecord(Array.isArray(rows) ? rows[0] : null);
    const country = str(c['name']) || hit?.country || iso2;
    const capital = str(c['capitalCity']);
    const region = str(asRecord(c['region'])['value']);
    const income = str(asRecord(c['incomeLevel'])['value']);

    const bits: string[] = [];
    if (capital) bits.push(`capital ${capital}`);
    if (population) bits.push(`population ${formatPopulation(population.value)} (${population.year})`);
    if (gdp) bits.push(`GDP per capita about $${Math.round(gdp.value).toLocaleString('en-US')} (${gdp.year})`);
    if (income) bits.push(income.toLowerCase());
    if (region) bits.push(region);
    if (bits.length === 0) throw new Error(`No market data found for "${place}"`);

    const label = hit && hit.name.toLowerCase() !== country.toLowerCase() ? `${country} (market for ${hit.name})` : country;
    return {
      summary: `${label}: ${bits.join('; ')}.`,
      data: { country, iso2, capital, region, incomeLevel: income, population: population?.value, gdpPerCapitaUsd: gdp?.value },
      sourceName: 'World Bank',
      sourceUrl: 'https://data.worldbank.org/country/' + iso2.toLowerCase(),
    };
  },
};

// ── Hacker News ──────────────────────────────────────────────────────────────

export const hackerNewsTool: MissionToolDefinition = {
  id: 'hackernews',
  label: 'Tech trend scan',
  agent: 'content',
  catalogName: 'Hacker News',
  async run(args, ctx) {
    const keyword = (args['keyword'] ?? '').trim().toLowerCase();
    const ids = await getJson(ctx, 'https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!Array.isArray(ids.body)) throw new Error('Hacker News returned no stories');

    const top = (ids.body as unknown[]).filter((v): v is number => typeof v === 'number').slice(0, 15);
    const stories = await Promise.all(
      top.map(async (id) => {
        try {
          const item = asRecord((await getJson(ctx, `https://hacker-news.firebaseio.com/v0/item/${id}.json`)).body);
          const title = str(item['title']);
          if (!title) return null;
          return {
            id,
            title,
            score: num(item['score']) ?? 0,
            url: str(item['url']) || `https://news.ycombinator.com/item?id=${id}`,
          };
        } catch {
          return null;
        }
      }),
    );

    const clean = stories.filter((s): s is NonNullable<typeof s> => s !== null);
    if (clean.length === 0) throw new Error('Hacker News stories could not be loaded');

    const ranked = keyword
      ? [...clean].sort((a, b) => Number(b.title.toLowerCase().includes(keyword)) - Number(a.title.toLowerCase().includes(keyword)) || b.score - a.score)
      : clean;
    const picks = ranked.slice(0, 5);

    return {
      summary: `Top stories on Hacker News right now: ${picks.map((s) => `“${trimTo(s.title, 70)}” (${s.score} pts)`).join('; ')}.`,
      data: { stories: picks },
      sourceName: 'Hacker News',
      sourceUrl: 'https://news.ycombinator.com/',
    };
  },
};

export const MISSION_TOOLS: Record<ToolId, MissionToolDefinition> = {
  wikipedia: wikipediaTool,
  weather: weatherTool,
  country: countryTool,
  hackernews: hackerNewsTool,
};

export function getMissionTool(id: ToolId): MissionToolDefinition {
  return MISSION_TOOLS[id];
}
