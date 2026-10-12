import { ModelRouter } from '../model-routing';
import { ConsoleLogger } from '../utils/ConsoleLogger';
import { Configuration } from '../config';

describe('ModelRouter', () => {
  const configData = {
    providers: {
      openai: { priority: 1, models: ['gpt-4', 'gpt-3.5'], enabled: true },
      anthropic: { priority: 2, models: ['claude-2'], enabled: true },
    },
  } as any;
  const config = new Configuration(configData);
  const logger = new ConsoleLogger(config);
  const router = new ModelRouter(logger, config);

  it('selects correct provider based on model', () => {
    expect(router.getProviderForModel('gpt-4')).toBe('openai');
    expect(router.getProviderForModel('claude-2')).toBe('anthropic');
  });

  it('throws on unknown model', () => {
    expect(() => router.getProviderForModel('unknown-model')).toThrow();
  });
});
