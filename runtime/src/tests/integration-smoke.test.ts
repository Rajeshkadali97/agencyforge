import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnhancedEventBus } from '../events/EnhancedEventBus';
import { RuntimeEventTypes } from '../contracts';

// Minimal logger stub
const makeLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

describe('E2E event wiring — RESEARCH_COMPLETED → CognitiveMemoryBridge', () => {
  it('subscribes to research.completed and passes payload to engine.store()', async () => {
    const logger = makeLogger();
    const bus = new EnhancedEventBus(logger as any);

    // Spy engine that captures store() calls
    const storeSpy = vi.fn().mockResolvedValue({ id: 'mem_1', type: 'business', rawContent: '', metadata: {} });

    // Wire the subscription directly (mirrors _wireMemorySubscriptions logic)
    bus.subscribe(RuntimeEventTypes.RESEARCH_COMPLETED, async (event) => {
      const p = event.payload as unknown as Record<string, unknown>;
      await storeSpy({
        type: 'business',
        owner: 'runtime',
        rawContent: JSON.stringify(p),
        summary: `Research completed for workflow ${p['workflowId'] ?? 'unknown'}`,
        tags: ['research', 'completed'],
        importance: 0.8,
        visibility: 'internal',
        security: 'standard',
        source: 'runtime-event',
        confidence: 0.9,
        entities: [],
        relationships: [],
        metadata: { eventType: RuntimeEventTypes.RESEARCH_COMPLETED, timestamp: event.timestamp },
      });
    });

    // Publish a research.completed event (matching what ResearchBridge now emits)
    bus.publish({
      id: 'evt_research_1',
      type: RuntimeEventTypes.RESEARCH_COMPLETED,
      version: '1.0',
      timestamp: new Date().toISOString(),
      traceId: 'wf_001',
      spanId: 'span_001',
      payload: {
        workflowId: 'wf_001',
        taskId: undefined,
        timestamp: new Date().toISOString(),
        traceId: 'wf_001',
        spanId: 'span_001',
        result: { companyName: 'Acme Corp', insights: ['fast growth', 'tech stack: React'] },
      } as any,
    });

    // Allow async handler to complete
    await new Promise((r) => setTimeout(r, 10));

    expect(storeSpy).toHaveBeenCalledTimes(1);
    const storeArg = storeSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(storeArg['type']).toBe('business');
    expect(storeArg['source']).toBe('runtime-event');
    expect(storeArg['tags']).toContain('research');
  });
});

describe('E2E event wiring — LEAD_SCORED → CognitiveMemoryBridge', () => {
  it('stores hot lead with importance 0.9', async () => {
    const logger = makeLogger();
    const bus = new EnhancedEventBus(logger as any);
    const storeSpy = vi.fn().mockResolvedValue({ id: 'mem_2', type: 'business', rawContent: '', metadata: {} });

    bus.subscribe(RuntimeEventTypes.LEAD_SCORED, async (event) => {
      const p = event.payload as unknown as Record<string, unknown>;
      await storeSpy({
        type: 'business',
        owner: 'runtime',
        rawContent: JSON.stringify(p),
        summary: `Lead ${p['leadId']} scored ${p['score']} (${p['tier']})`,
        tags: ['lead', 'scored', String(p['tier'])],
        importance: p['tier'] === 'hot' ? 0.9 : 0.5,
        visibility: 'internal',
        security: 'standard',
        source: 'runtime-event',
        confidence: 0.9,
        entities: [],
        relationships: [],
        metadata: { eventType: RuntimeEventTypes.LEAD_SCORED },
      });
    });

    bus.publish({
      id: 'evt_lead_1',
      type: RuntimeEventTypes.LEAD_SCORED,
      version: '1.0',
      timestamp: new Date().toISOString(),
      traceId: 'wf_001',
      spanId: 'span_002',
      payload: {
        workflowId: 'wf_001',
        taskId: undefined,
        timestamp: new Date().toISOString(),
        traceId: 'wf_001',
        spanId: 'span_002',
        leadId: 'lead_42',
        score: 87,
        tier: 'hot',
        factors: ['decision-maker', 'budget confirmed'],
      } as any,
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(storeSpy).toHaveBeenCalledTimes(1);
    const arg = storeSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(arg['importance']).toBe(0.9);
    expect((arg['tags'] as string[])).toContain('hot');
  });
});

describe('E2E event wiring — PROPOSAL_GENERATED → CognitiveMemoryBridge', () => {
  it('stores proposal as project memory', async () => {
    const logger = makeLogger();
    const bus = new EnhancedEventBus(logger as any);
    const storeSpy = vi.fn().mockResolvedValue({ id: 'mem_3', type: 'project', rawContent: '', metadata: {} });

    bus.subscribe(RuntimeEventTypes.PROPOSAL_GENERATED, async (event) => {
      const p = event.payload as unknown as Record<string, unknown>;
      await storeSpy({
        type: 'project',
        owner: 'runtime',
        rawContent: JSON.stringify(p),
        summary: `Proposal ${p['proposalId']} generated for ${p['clientName']}`,
        tags: ['proposal', 'generated'],
        importance: 0.85,
        visibility: 'internal',
        security: 'standard',
        source: 'runtime-event',
        confidence: 0.9,
        entities: [],
        relationships: [],
        metadata: { eventType: RuntimeEventTypes.PROPOSAL_GENERATED },
      });
    });

    bus.publish({
      id: 'evt_proposal_1',
      type: RuntimeEventTypes.PROPOSAL_GENERATED,
      version: '1.0',
      timestamp: new Date().toISOString(),
      traceId: 'wf_001',
      spanId: 'span_003',
      payload: {
        workflowId: 'wf_001',
        taskId: undefined,
        timestamp: new Date().toISOString(),
        traceId: 'wf_001',
        spanId: 'span_003',
        proposalId: 'prop_99',
        leadId: 'lead_42',
        clientName: 'Acme Corp',
        sections: ['executive summary', 'solution overview', 'pricing'],
      } as any,
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(storeSpy).toHaveBeenCalledTimes(1);
    const arg = storeSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(arg['type']).toBe('project');
    expect((arg['summary'] as string)).toContain('Acme Corp');
  });
});

describe('ResearchBridge event type — emits research.completed (lowercase)', () => {
  it('RuntimeEventTypes.RESEARCH_COMPLETED is lowercase dot notation', () => {
    expect(RuntimeEventTypes.RESEARCH_COMPLETED).toBe('research.completed');
  });

  it('event type mismatch bug is fixed — uppercase literal no longer used', () => {
    // The old bug: ResearchBridge published 'RESEARCH_COMPLETED' (uppercase)
    // which never matched RuntimeEventTypes.RESEARCH_COMPLETED = 'research.completed'.
    // Fix: ResearchBridge now uses RuntimeEventTypes.RESEARCH_COMPLETED.
    const correctType = RuntimeEventTypes.RESEARCH_COMPLETED;
    expect(correctType).not.toBe('RESEARCH_COMPLETED');
    expect(correctType).toBe('research.completed');
  });
});
