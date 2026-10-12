import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRuntime, RuntimeBootstrap } from '../bootstrap/RuntimeBootstrap';
import { ConsoleLogger } from '../utils/ConsoleLogger';
import { Configuration } from '../config';

describe('RuntimeBootstrap', () => {
  let bootstrap: RuntimeBootstrap | undefined;
  let logger: ConsoleLogger;

  beforeEach(() => {
    const config = new Configuration({ logging: { level: 'ERROR' } });
    logger = new ConsoleLogger(config);
  });

  afterEach(async () => {
    if (bootstrap) {
      await bootstrap.stop();
      bootstrap = undefined;
    }
  });

  describe('createRuntime', () => {
    it('should create a runtime instance', () => {
      bootstrap = createRuntime({ logger });
      expect(bootstrap).toBeDefined();
      expect(bootstrap.isRunningCheck()).toBe(false);
    });
  });

  describe('start', () => {
    it('should start the runtime successfully', async () => {
      bootstrap = createRuntime({ logger, enableConsoleLogging: false });
const result = await bootstrap.start();

        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(bootstrap.isRunningCheck()).toBe(true);

        const health = await bootstrap.getHealthManager().checkAll();
        expect(health.healthy.length).toBeGreaterThan(0);
    });

    it('should initialize all subsystems', async () => {
      bootstrap = createRuntime({ logger, enableConsoleLogging: false });
      await bootstrap.start();

      expect(bootstrap.getMemoryBinding()).toBeDefined();
      expect(bootstrap.getDashboardBinding()).toBeDefined();
      expect(bootstrap.getEventBus()).toBeDefined();
    });
  });

  describe('executeGoal', () => {
    it('should execute a goal and return result', async () => {
      bootstrap = createRuntime({ logger, enableConsoleLogging: false });
      await bootstrap.start();

      const result = await bootstrap.executeGoal('dental practice');

      expect(result.success).toBe(true);
      expect(result.workflowId).toBeDefined();
      expect(result.result).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should store leads in memory after execution', async () => {
      bootstrap = createRuntime({ logger, enableConsoleLogging: false });
      await bootstrap.start();

      await bootstrap.executeGoal('restaurant');

      const memoryBinding = bootstrap.getMemoryBinding();
      const leadList = memoryBinding.retrieve('lead.list', 'lead') as string[];

      expect(leadList).toBeDefined();
      expect(leadList.length).toBeGreaterThan(0);
    });

    it('should generate proposals for hot leads', async () => {
      bootstrap = createRuntime({ logger, enableConsoleLogging: false });
      await bootstrap.start();

      await bootstrap.executeGoal('tech startup');

      const memoryBinding = bootstrap.getMemoryBinding();
      const proposalList = memoryBinding.retrieve('proposal.list', 'proposal') as string[];

      expect(proposalList).toBeDefined();
      expect(proposalList.length).toBeGreaterThan(0);
    });
  });

  describe('stop', () => {
    it('should stop the runtime cleanly', async () => {
      bootstrap = createRuntime({ logger, enableConsoleLogging: false });
      await bootstrap.start();
      expect(bootstrap.isRunningCheck()).toBe(true);

      await bootstrap.stop();
      expect(bootstrap.isRunningCheck()).toBe(false);
    });
  });
});