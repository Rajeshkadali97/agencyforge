// Parallel workflow demo with rollback demonstration
const { ExecutionContextFactory, ContextRegistry } = require('./dist/context/ExecutionContextFactory');
const { InMemoryWorkflowStore } = require('./dist/workflow/WorkflowEngine');
const { WorkflowEngine } = require('./dist/workflow/WorkflowEngineImpl');
const { ConsoleLogger } = require('./dist/utils/ConsoleLogger');
const { EnhancedEventBus } = require('./dist/events/EnhancedEventBus');

(async () => {
  const logger = new ConsoleLogger();
  const eventBus = new EnhancedEventBus(logger);
  const store = new InMemoryWorkflowStore();
  const engine = new WorkflowEngine(store, eventBus, logger);

  const contextRegistry = new ContextRegistry();
  const execContextFactory = new ExecutionContextFactory(contextRegistry);
  const createContext = () => execContextFactory.createContext({
    workflowId: `wf_${Date.now()}`,
    taskId: `task_${Date.now()}`,
    userId: 'demo',
    projectId: 'demo',
    logger,
    config: {},
    eventBus,
    memoryScope: undefined,
  });

  // Helper step that waits for a given ms and optionally fails
   const makeStep = (id, name, waitMs, shouldFail = false, retryPolicy = undefined) => ({
    id,
    name,
    type: 'parallel',
    retryPolicy,
    dependencies: [],
    execute: async (ctx) => {
      const start = Date.now();
      await new Promise(r => setTimeout(r, waitMs));
      const elapsed = Date.now() - start;
      console.log(`Step ${name} executed in ${elapsed}ms`);
      if (shouldFail) throw new Error('Intentional failure');
      return { success: true, output: elapsed };
    },
    // Rollback just logs
    rollback: async (ctx) => {
      console.log(`Rollback for step ${name}`);
    },
  });

    const steps = [
    makeStep('s1', 'StepOne', 2000),
    // This step will fail and has no retries, triggering rollback of previous step
    makeStep('s2', 'StepTwo', 2000, true, { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 }),
  ];

  const definition = {
    id: 'demo-workflow',
    name: 'Parallel Demo',
    version: '1.0.0',
    steps,
  };

  console.log('Executing parallel workflow (should finish ~2s and then rollback)');
  const exec = await engine.execute(definition, createContext());
  console.log('Workflow final status:', exec.status);
  console.log('Step metrics:', exec.stepMetrics);
})();
