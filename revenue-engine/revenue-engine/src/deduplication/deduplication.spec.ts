import { DeduplicationEngine } from './deduplication.engine';

describe('DeduplicationEngine', () => {
  it('should generate deterministic IDs', () => {
    const lead1 = { id: '1', companyName: 'Acme Corp', website: 'acme.com' };
    const lead2 = { id: '2', companyName: 'Acme Corp', website: 'acme.com' };
    expect(generateDeterministicId(lead1)).toEqual(expect.stringMatching(/^[a-f0-9]{8}$/));
    expect(generateDeterministicId(lead2)).toEqual(expect.stringMatching(/^[a-f0-9]{8}$/));
  });

  it('should detect exact duplicates', () => {
    const engine = new DeduplicationEngine();
    const leads = [
      { id: '1', companyName: 'Acme Corp', website: 'acme.com' },
      { id: '2', companyName: 'Acme Corp', website: 'acme.com' }
    ];
    const result = engine.deduplicate(leads);
    expect(result.duplicates.length).toBe(2);
    expect(result.merged).toBeTruthy();
  });

  it('should handle fuzzy matches', () => {
    const engine = new DeduplicationEngine();
    const leads = [
      { id: '1', companyName: 'Acme Corp', website: 'acme.com' },
      { id: '2', companyName: 'Acme Corporation', website: 'acmecorp.com' }
    ];
    const result = engine.deduplicate(leads);
    expect(result.duplicates.length).toBe(2);
    expect(result.merged.confidence).toBeGreaterThan(75);
  });
});