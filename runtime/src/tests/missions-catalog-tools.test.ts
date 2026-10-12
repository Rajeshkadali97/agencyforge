import { describe, it, expect } from 'vitest';
import { searchCatalog } from '../missions/catalog';
import { topicCandidates, wikipediaTool, weatherTool, hackerNewsTool, countryTool } from '../missions/tools';
import type { FetchLike } from '../missions/types';

function jsonFetch(routes: Record<string, unknown>): FetchLike & { urls: string[] } {
  const urls: string[] = [];
  const fn = (async (url: string) => {
    urls.push(url);
    for (const [key, body] of Object.entries(routes)) {
      if (url.includes(key)) return { ok: true, status: 200, json: async () => body };
    }
    return { ok: false, status: 404, json: async () => null };
  }) as FetchLike & { urls: string[] };
  fn.urls = urls;
  return fn;
}

describe('catalog ordering', () => {
  it('lists the built-in agent tools first when nothing is searched', () => {
    const page = searchCatalog({ auth: 'none', httpsOnly: true, limit: 10 });
    const featured = page.items.filter((a) => a.featured).map((a) => a.name);
    expect(featured.length).toBeGreaterThanOrEqual(3);
    expect(page.items.slice(0, featured.length).every((a) => a.featured)).toBe(true);
  });

  it('keeps normal relevance order for a search', () => {
    const page = searchCatalog({ q: 'cat facts', limit: 5 });
    expect(page.items.length).toBeGreaterThan(0);
  });
});

describe('topicCandidates', () => {
  it('returns the full topic first, then shorter phrases and long single words', () => {
    const c = topicCandidates('outdoor coffee pop-up');
    expect(c[0]).toBe('outdoor coffee pop-up');
    expect(c).toContain('outdoor coffee');
    expect(c).toContain('outdoor');
    expect(c.length).toBeLessThanOrEqual(5);
  });

  it('never returns duplicates or empties', () => {
    const c = topicCandidates('coffee');
    expect(c).toEqual(['coffee']);
  });
});

describe('wikipedia tool', () => {
  it('falls back to title search, then to a shorter topic', async () => {
    const fetch = jsonFetch({
      'rest.php/v1/search/title?q=coffee': { pages: [{ title: 'Coffee' }] },
      'page/summary/Coffee': {
        title: 'Coffee',
        extract: 'Coffee is a beverage brewed from roasted, ground coffee beans.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Coffee' } },
      },
    });
    const out = await wikipediaTool.run({ topic: 'coffee pop-up launch' }, { fetch });
    expect(out.sourceName).toBe('Wikipedia');
    expect(out.summary).toContain('Coffee is a beverage');
    expect(out.sourceUrl).toContain('wikipedia.org/wiki/Coffee');
  });

  it('throws a clear error when nothing is found', async () => {
    await expect(wikipediaTool.run({ topic: 'zzzz qqqq' }, { fetch: jsonFetch({}) })).rejects.toThrow(/No Wikipedia article/);
  });

  it('requires a topic', async () => {
    await expect(wikipediaTool.run({}, { fetch: jsonFetch({}) })).rejects.toThrow(/topic/);
  });
});

describe('weather tool', () => {
  it('geocodes then reads current conditions', async () => {
    const fetch = jsonFetch({
      'geocoding-api.open-meteo.com': { results: [{ name: 'Lisbon', country: 'Portugal', country_code: 'PT', latitude: 38.7, longitude: -9.1 }] },
      'api.open-meteo.com/v1/forecast': { current: { temperature_2m: 21.5, wind_speed_10m: 9, relative_humidity_2m: 55 } },
    });
    const out = await weatherTool.run({ place: 'Lisbon' }, { fetch });
    expect(out.summary).toContain('Lisbon, Portugal');
    expect(out.summary).toContain('21.5 °C');
  });

  it('reports unknown places', async () => {
    const fetch = jsonFetch({ 'geocoding-api.open-meteo.com': { results: [] } });
    await expect(weatherTool.run({ place: 'Nowhereville' }, { fetch })).rejects.toThrow(/Could not locate/);
  });
});

describe('country (World Bank) tool', () => {
  it('builds a market profile from a city name', async () => {
    const fetch = jsonFetch({
      'geocoding-api.open-meteo.com': { results: [{ name: 'Lisbon', country: 'Portugal', country_code: 'PT', latitude: 38.7, longitude: -9.1 }] },
      'indicator/SP.POP.TOTL': [{}, [{ value: 10800000, date: '2025' }]],
      'indicator/NY.GDP.PCAP.CD': [{}, [{ value: 32082.2, date: '2025' }]],
      'api.worldbank.org/v2/country/PT?': [{}, [{ name: 'Portugal', capitalCity: 'Lisbon', region: { value: 'Europe & Central Asia' }, incomeLevel: { value: 'High income' } }]],
    });
    const out = await countryTool.run({ place: 'Lisbon' }, { fetch });
    expect(out.summary).toContain('Portugal (market for Lisbon)');
    expect(out.summary).toContain('10.8 million');
    expect(out.sourceUrl).toBe('https://data.worldbank.org/country/pt');
  });

  it('survives missing indicators as long as one fact exists', async () => {
    const fetch = jsonFetch({
      'geocoding-api.open-meteo.com': { results: [{ name: 'Germany', country: 'Germany', country_code: 'DE', latitude: 51, longitude: 10 }] },
      'api.worldbank.org/v2/country/DE?': [{}, [{ name: 'Germany', capitalCity: 'Berlin' }]],
    });
    const out = await countryTool.run({ place: 'Germany' }, { fetch });
    expect(out.summary).toContain('capital Berlin');
  });
});

describe('hacker news tool', () => {
  it('ranks keyword matches first', async () => {
    const fetch = jsonFetch({
      'topstories.json': [1, 2, 3],
      'item/1.json': { title: 'Quantum chips', score: 500, url: 'https://e.com/1' },
      'item/2.json': { title: 'Agents in production', score: 100 },
      'item/3.json': { title: 'Linux 7.0', score: 300 },
    });
    const out = await hackerNewsTool.run({ keyword: 'agents' }, { fetch });
    const stories = (out.data as { stories: Array<{ title: string }> }).stories;
    expect(stories[0]?.title).toBe('Agents in production');
  });
});
