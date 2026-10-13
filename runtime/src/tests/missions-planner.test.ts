import { describe, it, expect } from 'vitest';
import { extractPlaces, extractTopic, planMission } from '../missions/planner';

describe('extractPlaces', () => {
  it('finds capitalised names after a preposition', () => {
    expect(extractPlaces('Research the dental clinic market in Germany')).toEqual(['Germany']);
    expect(extractPlaces('Find clients near New York for our studio')).toEqual(['New York']);
    expect(extractPlaces('Find fintech startups in São Paulo and Nairobi')[0]).toBe('São Paulo');
  });

  it('finds capitalised names without a preposition when the goal is about a location', () => {
    expect(extractPlaces('Compare Tokyo and Osaka for a ramen franchise')).toEqual(['Tokyo', 'Osaka']);
    expect(extractPlaces('What is the best time to visit Kyoto')).toEqual(['Kyoto']);
  });

  it('finds a lowercase place only with weather or travel intent', () => {
    expect(extractPlaces('weather in paris and the market')).toEqual(['Paris']);
    expect(extractPlaces('plan a trip to lisbon next spring')).toEqual(['Lisbon']);
    expect(extractPlaces('ship the report in production')).toEqual([]);
    expect(extractPlaces('summarise this in order')).toEqual([]);
  });

  it('does not treat technology or company names as places', () => {
    expect(extractPlaces('Tell me about the Rust programming language and trends')).toEqual([]);
    expect(extractPlaces('Research the Tesla market')).toEqual([]);
    expect(extractPlaces('Scan today’s top tech trends for AI agents')).toEqual([]);
  });

  it('ignores acronyms, months and weekdays', () => {
    expect(extractPlaces('Launch in March on Monday for SEO')).toEqual([]);
  });

  it('returns at most the requested number of places', () => {
    expect(extractPlaces('Compare Tokyo, Osaka and Kyoto for a franchise', 2)).toHaveLength(2);
  });
});

describe('extractTopic', () => {
  it('drops question words and place names', () => {
    expect(extractTopic('Compare Tokyo and Osaka for a ramen franchise', ['Tokyo', 'Osaka'])).toBe('ramen franchise');
    expect(extractTopic('What is the best time to visit Kyoto', ['Kyoto'])).toBe('Kyoto');
  });
});

describe('planMission', () => {
  it('adds weather for every place when the goal asks about conditions', () => {
    const plan = planMission('Compare the weather in Tokyo and Osaka for a ramen franchise');
    const weather = plan.tasks.filter((t) => t.tool === 'weather').map((t) => t.args['place']);
    expect(weather).toEqual(['Tokyo', 'Osaka']);
  });

  it('builds a market profile for the first place only', () => {
    const plan = planMission('Compare Tokyo and Osaka for a ramen franchise');
    const country = plan.tasks.filter((t) => t.tool === 'country');
    expect(country).toHaveLength(1);
    expect(country[0]?.args['place']).toBe('Tokyo');
  });

  it('handles a lowercase place with a weather request', () => {
    const plan = planMission('weather in paris and the market');
    expect(plan.places).toEqual(['Paris']);
    expect(plan.tasks.map((t) => t.tool)).toContain('weather');
    expect(plan.tasks.map((t) => t.tool)).toContain('country');
  });

  it('plans a travel question with weather and a market profile', () => {
    const plan = planMission('What is the best time to visit Kyoto in spring');
    expect(plan.tasks.map((t) => t.tool)).toEqual(expect.arrayContaining(['wikipedia', 'weather']));
  });
});
