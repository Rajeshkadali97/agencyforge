import { describe, it, expect, beforeEach } from 'vitest';
import { DashboardStore } from '../lib/store-context';
import type { CEOBriefingItem, TeamActivity, VoiceMessage } from '../lib/store-context';

function makeBriefing(id: string, urgent = false): CEOBriefingItem {
  return { id, text: `Briefing ${id}`, agent: 'research', department: 'research', urgent, timestamp: new Date() };
}

function makeActivity(id: string): TeamActivity {
  return { id, agentId: 'research', agentName: 'Research', department: 'research', action: `Action ${id}`, timestamp: new Date(), type: 'lead_found' };
}

function makeVoiceMessage(id: string, role: 'user' | 'agent' = 'user'): VoiceMessage {
  return { id, role, text: `Message ${id}`, timestamp: new Date() };
}

describe('DashboardStore — initialization', () => {
  it('starts with 10 agents', () => {
    const store = new DashboardStore();
    expect(store.getAllAgents()).toHaveLength(10);
  });

  it('starts disconnected', () => {
    const store = new DashboardStore();
    expect(store.getState().isConnected).toBe(false);
  });

  it('starts with empty briefings', () => {
    const store = new DashboardStore();
    expect(store.getState().briefings).toHaveLength(0);
  });

  it('starts with empty activities', () => {
    const store = new DashboardStore();
    expect(store.getState().activities).toHaveLength(0);
  });

  it('starts with empty voice messages', () => {
    const store = new DashboardStore();
    expect(store.getState().voiceMessages).toHaveLength(0);
  });

  it('initializes all 10 expected departments', () => {
    const store = new DashboardStore();
    const ids = store.getAllAgents().map((a) => a.id);
    ['research', 'marketing', 'sales', 'automation', 'website', 'creative', 'content', 'motion', 'seo', 'analytics'].forEach((id) => {
      expect(ids).toContain(id);
    });
  });

  it('CEO starts with default welcome message', () => {
    const store = new DashboardStore();
    expect(store.getCEO().message).toBe('Welcome. How can I assist you today?');
    expect(store.getCEO().isListening).toBe(false);
  });
});

describe('DashboardStore — connection state', () => {
  let store: DashboardStore;
  beforeEach(() => { store = new DashboardStore(); });

  it('setConnected(true) sets isConnected to true', () => {
    store.setConnected(true);
    expect(store.getState().isConnected).toBe(true);
  });

  it('setConnected(false) sets isConnected to false', () => {
    store.setConnected(true);
    store.setConnected(false);
    expect(store.getState().isConnected).toBe(false);
  });

  it('setConnected updates lastSync', () => {
    const before = store.getState().lastSync;
    store.setConnected(true);
    expect(store.getState().lastSync).not.toBe(before);
  });
});

describe('DashboardStore — agent updates', () => {
  let store: DashboardStore;
  beforeEach(() => { store = new DashboardStore(); });

  it('updateAgent updates status and message', () => {
    store.updateAgent('research', { status: 'busy', message: 'Analyzing leads' });
    const agent = store.getAgent('research');
    expect(agent?.status).toBe('busy');
    expect(agent?.message).toBe('Analyzing leads');
  });

  it('updateAgent updates progress', () => {
    store.updateAgent('sales', { progress: 75 });
    expect(store.getAgent('sales')?.progress).toBe(75);
  });

  it('updateAgent sets lastUpdate', () => {
    const before = store.getAgent('marketing')?.lastUpdate;
    store.updateAgent('marketing', { status: 'online' });
    const after = store.getAgent('marketing')?.lastUpdate;
    expect(after).not.toBe(before);
  });

  it('updateAgent for unknown agent is a no-op', () => {
    expect(() => store.updateAgent('nonexistent_agent', { status: 'busy' })).not.toThrow();
    expect(store.getAgent('research')?.status).toBe('idle');
  });

  it('updateAgent preserves unrelated fields', () => {
    const before = store.getAgent('research');
    store.updateAgent('research', { status: 'busy' });
    const after = store.getAgent('research');
    expect(after?.id).toBe(before?.id);
    expect(after?.name).toBe(before?.name);
    expect(after?.department).toBe(before?.department);
  });

  it('updateCEO updates CEO state', () => {
    store.updateCEO({ message: 'New briefing incoming', isListening: true });
    const ceo = store.getCEO();
    expect(ceo.message).toBe('New briefing incoming');
    expect(ceo.isListening).toBe(true);
  });

  it('updateCEO preserves other CEO fields', () => {
    const before = store.getCEO();
    store.updateCEO({ isListening: true });
    expect(store.getCEO().emotion).toBe(before.emotion);
  });
});

describe('DashboardStore — briefings', () => {
  let store: DashboardStore;
  beforeEach(() => { store = new DashboardStore(); });

  it('addBriefing adds one item', () => {
    store.addBriefing(makeBriefing('b1'));
    expect(store.getState().briefings).toHaveLength(1);
  });

  it('addBriefing prepends (newest first)', () => {
    store.addBriefing(makeBriefing('b1'));
    store.addBriefing(makeBriefing('b2'));
    expect(store.getState().briefings[0].id).toBe('b2');
  });

  it('addBriefing caps at 10 items', () => {
    for (let i = 0; i < 15; i++) store.addBriefing(makeBriefing(`b${i}`));
    expect(store.getState().briefings).toHaveLength(10);
  });

  it('after cap, newest items are kept', () => {
    for (let i = 0; i < 15; i++) store.addBriefing(makeBriefing(`b${i}`));
    const ids = store.getState().briefings.map((b) => b.id);
    expect(ids).toContain('b14');
    expect(ids).not.toContain('b0');
  });

  it('urgent briefing preserved correctly', () => {
    store.addBriefing(makeBriefing('urgent_1', true));
    expect(store.getState().briefings[0].urgent).toBe(true);
  });
});

describe('DashboardStore — activities', () => {
  let store: DashboardStore;
  beforeEach(() => { store = new DashboardStore(); });

  it('addActivity adds one item', () => {
    store.addActivity(makeActivity('a1'));
    expect(store.getState().activities).toHaveLength(1);
  });

  it('addActivity prepends (newest first)', () => {
    store.addActivity(makeActivity('a1'));
    store.addActivity(makeActivity('a2'));
    expect(store.getState().activities[0].id).toBe('a2');
  });

  it('addActivity caps at 20 items', () => {
    for (let i = 0; i < 25; i++) store.addActivity(makeActivity(`a${i}`));
    expect(store.getState().activities).toHaveLength(20);
  });

  it('after cap, newest 20 activities are kept', () => {
    for (let i = 0; i < 25; i++) store.addActivity(makeActivity(`a${i}`));
    const ids = store.getState().activities.map((a) => a.id);
    expect(ids).toContain('a24');
    expect(ids).not.toContain('a4');
  });
});

describe('DashboardStore — voice messages', () => {
  let store: DashboardStore;
  beforeEach(() => { store = new DashboardStore(); });

  it('addVoiceMessage appends in order', () => {
    store.addVoiceMessage(makeVoiceMessage('v1', 'user'));
    store.addVoiceMessage(makeVoiceMessage('v2', 'agent'));
    expect(store.getState().voiceMessages).toHaveLength(2);
    expect(store.getState().voiceMessages[0].id).toBe('v1');
  });

  it('clearVoiceMessages empties the list', () => {
    store.addVoiceMessage(makeVoiceMessage('v1'));
    store.clearVoiceMessages();
    expect(store.getState().voiceMessages).toHaveLength(0);
  });

  it('removeOldestVoiceMessage removes first item', () => {
    store.addVoiceMessage(makeVoiceMessage('v1'));
    store.addVoiceMessage(makeVoiceMessage('v2'));
    store.removeOldestVoiceMessage();
    const msgs = store.getState().voiceMessages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe('v2');
  });

  it('removeOldestVoiceMessage on empty list is a no-op', () => {
    expect(() => store.removeOldestVoiceMessage()).not.toThrow();
    expect(store.getState().voiceMessages).toHaveLength(0);
  });
});

describe('DashboardStore — processKernelMessage', () => {
  let store: DashboardStore;
  beforeEach(() => { store = new DashboardStore(); });

  it('agent_update updates agent status', () => {
    store.processKernelMessage({ type: 'agent_update', payload: { agentId: 'sales', status: 'thinking', message: 'Processing leads' } });
    expect(store.getAgent('sales')?.status).toBe('thinking');
    expect(store.getAgent('sales')?.message).toBe('Processing leads');
  });

  it('agent_update with progress updates progress field', () => {
    store.processKernelMessage({ type: 'agent_update', payload: { agentId: 'marketing', status: 'busy', progress: 60 } });
    expect(store.getAgent('marketing')?.progress).toBe(60);
  });

  it('agent_update for unknown agentId is a no-op', () => {
    expect(() =>
      store.processKernelMessage({ type: 'agent_update', payload: { agentId: 'nonexistent', status: 'busy' } }),
    ).not.toThrow();
  });

  it('briefing adds to briefings array with correct fields', () => {
    store.processKernelMessage({
      type: 'briefing',
      payload: { text: 'Hot lead found', agent: 'research', department: 'research', urgent: true },
    });
    const b = store.getState().briefings;
    expect(b).toHaveLength(1);
    expect(b[0].text).toBe('Hot lead found');
    expect(b[0].urgent).toBe(true);
    expect(b[0].agent).toBe('research');
  });

  it('activity adds to activities array with correct fields', () => {
    store.processKernelMessage({
      type: 'activity',
      payload: { agentId: 'sales', agentName: 'Sales', department: 'sales', action: 'Deal closed', activityType: 'workflow_finished' },
    });
    const a = store.getState().activities;
    expect(a).toHaveLength(1);
    expect(a[0].action).toBe('Deal closed');
    expect(a[0].type).toBe('workflow_finished');
    expect(a[0].agentId).toBe('sales');
  });

  it('voice_response adds agent voice message', () => {
    store.processKernelMessage({
      type: 'voice_response',
      payload: { agentId: 'research', agentName: 'Research', text: 'Found 5 new prospects' },
    });
    const v = store.getState().voiceMessages;
    expect(v).toHaveLength(1);
    expect(v[0].role).toBe('agent');
    expect(v[0].text).toBe('Found 5 new prospects');
    expect(v[0].agentId).toBe('research');
  });

  it('unknown message type does not throw', () => {
    const before = store.getState().briefings.length;
    expect(() => store.processKernelMessage({ type: 'completely_unknown_type' })).not.toThrow();
    expect(store.getState().briefings.length).toBe(before);
  });
});

describe('DashboardStore — processSnapshot', () => {
  let store: DashboardStore;
  beforeEach(() => { store = new DashboardStore(); });

  it('null snapshot is a no-op', () => {
    const before = store.getState().isConnected;
    store.processSnapshot(null);
    expect(store.getState().isConnected).toBe(before);
  });

  it('any snapshot sets isConnected to true', () => {
    store.processSnapshot({ context: {} });
    expect(store.getState().isConnected).toBe(true);
  });

  it('updates agent status from context.agentStates', () => {
    store.processSnapshot({
      context: { agentStates: { research: { status: 'busy', message: 'Searching databases' } } },
    });
    expect(store.getAgent('research')?.status).toBe('busy');
    expect(store.getAgent('research')?.message).toBe('Searching databases');
  });

  it('unknown agentId in agentStates is ignored safely', () => {
    expect(() =>
      store.processSnapshot({ context: { agentStates: { nonexistent_xyz: { status: 'busy' } } } }),
    ).not.toThrow();
  });

  it('replaces activities from dashboard.activities', () => {
    store.addActivity(makeActivity('old'));
    store.processSnapshot({
      dashboard: {
        activities: [
          { id: 'new1', agentId: 'sales', agentName: 'Sales', action: 'New action', timestamp: new Date().toISOString(), type: 'lead_found' },
        ],
      },
    });
    const acts = store.getState().activities;
    expect(acts).toHaveLength(1);
    expect(acts[0].action).toBe('New action');
  });

  it('caps activities from snapshot at 20', () => {
    store.processSnapshot({
      dashboard: {
        activities: Array.from({ length: 25 }, (_, i) => ({
          id: `a${i}`, agentId: 'research', agentName: 'Research', action: `A${i}`,
          timestamp: new Date().toISOString(), type: 'lead_found',
        })),
      },
    });
    expect(store.getState().activities).toHaveLength(20);
  });

  it('updates kernel status from snapshot.kernel', () => {
    store.processSnapshot({ kernel: { status: 'processing', activeGoals: 2 } });
    expect(store.getState().kernelStatus).toEqual({ status: 'processing', activeGoals: 2 });
  });

  it('updates briefings from dashboard.lastBriefing', () => {
    store.processSnapshot({
      dashboard: {
        lastBriefing: {
          timestamp: new Date().toISOString(),
          items: [{ id: 'br1', text: 'Morning brief', agent: 'ceo', department: 'research', urgent: false }],
        },
      },
    });
    const b = store.getState().briefings;
    expect(b).toHaveLength(1);
    expect(b[0].text).toBe('Morning brief');
  });

  it('updates notifications into agent.notifications', () => {
    store.processSnapshot({
      dashboard: {
        notifications: [
          { notificationId: 'n1', agentId: 'sales', type: 'lead', title: 'New lead', message: 'Hot lead found', timestamp: new Date().toISOString(), read: false, urgent: true },
        ],
      },
    });
    const agent = store.getAgent('sales');
    expect(agent?.notifications).toHaveLength(1);
    expect(agent?.notifications[0].title).toBe('New lead');
    expect(agent?.notifications[0].urgent).toBe(true);
  });

  it('clears previous notifications on each snapshot', () => {
    store.processSnapshot({
      dashboard: {
        notifications: [{ notificationId: 'n1', agentId: 'sales', type: 'lead', title: 'Old', message: '', timestamp: new Date().toISOString(), read: false, urgent: false }],
      },
    });
    store.processSnapshot({
      dashboard: {
        notifications: [],
      },
    });
    expect(store.getAgent('sales')?.notifications).toHaveLength(0);
  });
});

describe('DashboardStore — subscribe / notify', () => {
  let store: DashboardStore;
  beforeEach(() => { store = new DashboardStore(); });

  it('subscriber is called when state changes', () => {
    let count = 0;
    store.subscribe(() => { count++; });
    store.setConnected(true);
    expect(count).toBe(1);
  });

  it('multiple subscribers all receive notification', () => {
    let a = 0, b = 0;
    store.subscribe(() => a++);
    store.subscribe(() => b++);
    store.setConnected(true);
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('unsubscribe stops further notifications', () => {
    let count = 0;
    const unsub = store.subscribe(() => { count++; });
    store.setConnected(true);
    unsub();
    store.setConnected(false);
    expect(count).toBe(1);
  });

  it('unsubscribe does not affect other subscribers', () => {
    let a = 0, b = 0;
    const unsubA = store.subscribe(() => a++);
    store.subscribe(() => b++);
    store.setConnected(true);
    unsubA();
    store.setConnected(false);
    expect(a).toBe(1);
    expect(b).toBe(2);
  });

  it('getAgent returns undefined for nonexistent id', () => {
    expect(store.getAgent('nonexistent')).toBeUndefined();
  });

  it('getAllAgents returns stable array', () => {
    const agents = store.getAllAgents();
    expect(Array.isArray(agents)).toBe(true);
    expect(agents.length).toBeGreaterThan(0);
  });
});
