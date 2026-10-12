import { createHash } from 'crypto';
import type { Lead, DeduplicationResult } from './deduplication.types.js';

const DEDUP_ATTRS = ['companyName', 'website', 'phone', 'email', 'address'] as const;

type LeadAttr = (typeof DEDUP_ATTRS)[number];

function getAttr(lead: Lead, attr: LeadAttr): string | null {
  return lead[attr] ?? null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        (dp[i - 1]![j] ?? 0) + 1,
        (dp[i]![j - 1] ?? 0) + 1,
        (dp[i - 1]![j - 1] ?? 0) + cost
      );
    }
  }
  return dp[m]![n]!;
}

function generateDeterministicId(lead: Lead): string {
  const base = `${lead.companyName}-${lead.website ?? ''}-${lead.phone ?? ''}-${lead.email ?? ''}`;
  return createHash('md5').update(base).digest('hex').substring(0, 8);
}

function attributeScore(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  return 100 - (levenshtein(a, b) / Math.max(a.length, b.length)) * 100;
}

function fuzzyMatch(leads: Lead[]): Lead[][] {
  const matrix: Lead[][] = [];

  for (let i = 0; i < leads.length; i++) {
    const group: Lead[] = [leads[i]!];
    for (let j = i + 1; j < leads.length; j++) {
      const scores = DEDUP_ATTRS.map((attr) =>
        attributeScore(getAttr(leads[i]!, attr), getAttr(leads[j]!, attr))
      );
      const minScore = Math.min(...scores);
      if (minScore >= 75) {
        group.push(leads[j]!);
      }
    }
    matrix.push(group);
  }

  return matrix.filter((g) => g.length > 1);
}

function mergeLeads(leads: Lead[]): Lead {
  const first = leads[0]!;
  const merged: Lead = {
    id: first.id,
    companyName: leads.reduce((acc, l) => (acc.includes(l.companyName) ? acc : acc + '|' + l.companyName), ''),
    website: leads.find((l) => l.website)?.website ?? null,
    phone: leads.find((l) => l.phone)?.phone ?? null,
    email: leads.find((l) => l.email)?.email ?? null,
    address: leads.find((l) => l.address)?.address ?? null,
    sources: [...new Set(leads.flatMap((l) => l.sources))],
    isDuplicate: true,
    confidence: 0,
  };

  let confidence = 1;
  for (const attr of DEDUP_ATTRS) {
    const mergedVal = getAttr(merged, attr);
    const matches = leads.filter((l) => getAttr(l, attr) === mergedVal);
    confidence *= matches.length / leads.length;
  }
  merged.confidence = Math.min(leads.length * 20, confidence * 100);

  return merged;
}

export class DeduplicationEngine {
  async deduplicate(leads: Lead[]): Promise<DeduplicationResult> {
    const fuzzyGroups = fuzzyMatch(leads);
    const results = new Map<string, Lead[]>();

    for (const lead of leads) {
      const key = generateDeterministicId(lead);
      const existing = results.get(key);
      if (existing) {
        existing.push(lead);
      } else {
        results.set(key, [lead]);
      }
    }

    const duplicates: Lead[] = [];
    const events: Array<{ type: string; data: Record<string, unknown> }> = [];

    for (const [, group] of results) {
      if (group.length > 1) {
        const fuzzyMatches = fuzzyGroups.find((g) => g.some((l) => group.includes(l)));
        if (fuzzyMatches) {
          const merged = mergeLeads(fuzzyMatches);
          duplicates.push(...fuzzyMatches);
          events.push({ type: 'DuplicateMerged', data: { merged, confidence: merged.confidence } });
        } else {
          duplicates.push(...group);
          events.push({ type: 'DuplicateDetected', data: { duplicates: group } });
        }
      }
    }

    return {
      duplicates,
      merged: duplicates.length > 0 ? duplicates[0]! : null,
      confidence: duplicates.length > 0 ? (duplicates[0]!.confidence ?? 0) : 0,
      events,
    };
  }
}
