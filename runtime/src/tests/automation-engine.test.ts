import { AutomationEngine } from '../automation';

describe('AutomationEngine', () => {
  it('registers and lists tasks', async () => {
    const engine = new AutomationEngine();
    const task = {
      id: 't1',
      schedule: '* * * * *',
      action: async () => {},
    };
    engine.register(task);
    expect(engine.list()).toEqual([task]);
    engine.unregister('t1');
    expect(engine.list()).toEqual([]);
  });
});
