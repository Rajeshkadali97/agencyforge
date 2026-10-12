import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import {
  Kernel,
  EventBus,
  AgentRegistry,
  SequentialPlanner,
  TaskQueue,
  BasicExecutor,
  ConsoleLogger,
  WorkflowEngine,
  KernelRuntime,
  DependencyInjectionContainer,
  ExecutionContextManager,
  DependencyAwareScheduler,
  PriorityWorkflowQueue,
  defaultConfig,
} from '../index';
import {
  Goal,
  Task,
  TaskGraph,
  Workflow,
  WorkflowDefinition,
  WorkflowStatus,
  RetryPolicy,
  Agent,
} from '../types';

function createGoal(objective: string, priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' = 'NORMAL'): Goal {
  return {
    id: randomUUID(),
    objective,
    priority,
    created_at: new Date().toISOString(),
  };
}

function createAgent(id: string, capabilities: string[]): Agent {
  return {
    agent_id: id,
    name: id,
    version: '1.0.0',
    capabilities: capabilities.map((c) => ({ name: c, version: '1.0.0' })),
    health: 'healthy',
    status: 'idle',
  };
}

function createWorkflowDefinition(objective: string): WorkflowDefinition {
  return {
    id: randomUUID(),
    name: objective,
    description: `Workflow for: ${objective}`,
    version: '1.0.0',
    tasks: [
      {
        id: 'task_1',
        name: 'search',
        objective: `Search: ${objective}`,
        requiredCapabilities: ['web_search'],
        dependencies: [],
        priority: 'HIGH',
      },
      {
        id: 'task_2',
        name: 'analyze',
        objective: `Analyze: ${objective}`,
        requiredCapabilities: ['data_analysis'],
        dependencies: ['task_1'],
        priority: 'NORMAL',
      },
      {
        id: 'task_3',
        name: 'compile',
        objective: `Compile results: ${objective}`,
        requiredCapabilities: ['compilation'],
        dependencies: ['task_2'],
        priority: 'NORMAL',
      },
    ],
    retryPolicy: {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      baseDelayMs: 10,
      maxDelayMs: 100,
    },
  };
}

describe('Kernel', () => {
  it('should initialize and create a kernel', () => {
    const kernel = new Kernel();
    expect(kernel.id).toMatch(/^kernel_/);
    expect(kernel.eventBus).toBeDefined();
    expect(kernel.agentRegistry).toBeDefined();
    expect(kernel.planner).toBeDefined();
    expect(kernel.taskQueue).toBeDefined();
    expect(kernel.executor).toBeDefined();
    expect(kernel.logger).toBeDefined();
  });

  it('should accept custom deps via DI', () => {
    const eventBus = new EventBus();
    const logger = new ConsoleLogger();
    const kernel = new Kernel({ eventBus, logger });
    expect(kernel.eventBus).toBe(eventBus);
    expect(kernel.logger).toBe(logger);
  });

  it('should ingest a goal and return a task graph', async () => {
    const kernel = new Kernel();
    await kernel.initialize();
    const goal = createGoal('Find dentists in Dallas');
    const graph = await kernel.ingestGoal(goal);
    expect(graph).toBeDefined();
    expect(graph.goal_id).toBe(goal.id);
    expect(graph.tasks.length).toBeGreaterThan(0);
  });

  it('should emit events via the kernel', () => {
    const kernel = new Kernel();
    const events: unknown[] = [];
    kernel.eventBus.subscribe('system.warning', (event) => {
      events.push(event);
    });
    kernel.emit('system.warning', { message: 'test' });
    expect(events.length).toBe(1);
  });
});

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('should emit and subscribe to events', () => {
    const received: unknown[] = [];
    bus.subscribe('task.completed', (event) => {
      received.push(event);
    });
    bus.emit('task.completed', { task_id: 't1' });
    expect(received.length).toBe(1);
  });

  it('should support unsubscribe', () => {
    const received: unknown[] = [];
    const subId = bus.subscribe('task.failed', (event) => {
      received.push(event);
    });
    bus.emit('task.failed', { task_id: 't1' });
    expect(received.length).toBe(1);
    bus.unsubscribe(subId);
    bus.emit('task.failed', { task_id: 't2' });
    expect(received.length).toBe(1);
  });

  it('should track event history', () => {
    bus.emit('task.started', { task_id: 't1' });
    bus.emit('task.completed', { task_id: 't1' });
    const history = bus.getHistory();
    expect(history.length).toBe(2);
  });

  it('should filter history by event type', () => {
    bus.emit('task.started', { task_id: 't1' });
    bus.emit('task.completed', { task_id: 't1' });
    const history = bus.getHistory({ eventType: 'task.completed' });
    expect(history.length).toBe(1);
    expect(history[0].event_type).toBe('task.completed');
  });

  it('should clear history', () => {
    bus.emit('task.started', {});
    bus.clearHistory();
    expect(bus.getHistory().length).toBe(0);
  });
});

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it('should register and retrieve agents', () => {
    const agent = createAgent('agent.search', ['web_search']);
    registry.registerAgent(agent);
    expect(registry.getAgent('agent.search')).toBe(agent);
  });

  it('should list agents by capability', () => {
    registry.registerAgent(createAgent('agent.search', ['web_search']));
    registry.registerAgent(createAgent('agent.analysis', ['data_analysis']));
    registry.registerAgent(createAgent('agent.search2', ['web_search']));

    const searchAgents = registry.listAgentsByCapability('web_search');
    expect(searchAgents.length).toBe(2);
  });

  it('should check agent health', () => {
    const agent = createAgent('agent.1', ['general']);
    registry.registerAgent(agent);
    expect(registry.healthCheck('agent.1')).toBe('healthy');
  });

  it('should unregister agents', () => {
    const agent = createAgent('agent.1', ['general']);
    registry.registerAgent(agent);
    expect(registry.unregisterAgent('agent.1')).toBe(true);
    expect(registry.getAgent('agent.1')).toBeUndefined();
  });
});

describe('SequentialPlanner', () => {
  it('should decompose a goal into a task graph', () => {
    const planner = new SequentialPlanner();
    const goal = createGoal('Find dentists in Dallas');
    const graph = planner.plan(goal);
    expect(graph).toBeDefined();
    expect(graph.goal_id).toBe(goal.id);
    expect(graph.tasks.length).toBeGreaterThan(0);
    expect(graph.root_task_id).toBeDefined();
  });

  it('should generate a workflow definition from a goal', () => {
    const planner = new SequentialPlanner();
    const goal = createGoal('Find dentists in Dallas');
    const def = planner.planToDefinition(goal);
    expect(def).toBeDefined();
    expect(def.name).toBe(goal.objective);
    expect(def.tasks.length).toBeGreaterThan(0);
    expect(def.tasks[0].dependencies).toEqual([]);
  });
});

describe('TaskQueue', () => {
  it('should enqueue and dequeue tasks by priority', () => {
    const queue = new TaskQueue();
    const lowTask: Task = {
      id: 'low',
      objective: 'Low priority',
      required_capabilities: [],
      status: 'PENDING',
      priority: 'LOW',
      dependencies: [],
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };
    const criticalTask: Task = {
      id: 'critical',
      objective: 'Critical priority',
      required_capabilities: [],
      status: 'PENDING',
      priority: 'CRITICAL',
      dependencies: [],
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };

    queue.enqueue(lowTask);
    queue.enqueue(criticalTask);

    expect(queue.dequeue()?.id).toBe('critical');
    expect(queue.dequeue()?.id).toBe('low');
  });

  it('should cancel a task', () => {
    const queue = new TaskQueue();
    const task: Task = {
      id: 't1',
      objective: 'test',
      required_capabilities: [],
      status: 'PENDING',
      priority: 'NORMAL',
      dependencies: [],
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };
    queue.enqueue(task);
    expect(queue.cancel('t1')).toBe(true);
    expect(queue.size()).toBe(0);
  });

  it('should retry a task', () => {
    const queue = new TaskQueue();
    const task: Task = {
      id: 't1',
      objective: 'test',
      required_capabilities: [],
      status: 'FAILED',
      priority: 'NORMAL',
      dependencies: [],
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };
    queue.enqueue(task);
    expect(queue.retry('t1')).toBe(true);
    expect(queue.getStatus('t1')).toBe('PENDING');
  });
});

describe('BasicExecutor', () => {
  it('should execute a task and return result', async () => {
    const registry = new AgentRegistry();
    const bus = new EventBus();
    const logger = new ConsoleLogger();
    registry.registerAgent(createAgent('agent.general', ['general']));

    const executor = new BasicExecutor(registry, bus, logger);
    const task: Task = {
      id: 't1',
      objective: 'Do something',
      required_capabilities: ['general'],
      status: 'PENDING',
      priority: 'NORMAL',
      dependencies: [],
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };

    const result = await executor.execute(task);
    expect(result.success).toBe(true);
  });
});

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    const logger = new ConsoleLogger();
    engine = new WorkflowEngine(bus, logger);
  });

  it('should create a workflow from a definition', () => {
    const def = createWorkflowDefinition('Find dentists in Dallas');
    const workflow = engine.createWorkflow(def);
    expect(workflow).toBeDefined();
    expect(workflow.status).toBe('CREATED');
    expect(workflow.taskGraph.tasks.length).toBe(3);
    expect(workflow.steps.length).toBe(3);
  });

  it('should start and complete a workflow', async () => {
    const def = createWorkflowDefinition('Find dentists in Dallas');
    const workflow = engine.createWorkflow(def);
    await engine.startWorkflow(workflow.id);
    expect(engine.getWorkflowStatus(workflow.id)).toBe('COMPLETED');
  });

  it('should deliver execution context on completion', async () => {
    const def = createWorkflowDefinition('Find dentists in Dallas');
    const workflow = engine.createWorkflow(def);
    await engine.startWorkflow(workflow.id);
    const ctx = engine.getExecutionContext(workflow.id);
    expect(ctx).toBeDefined();
    expect(ctx!.workflowId).toBe(workflow.id);
    expect(ctx!.artifacts.length).toBeGreaterThan(0);
  });

  it('should publish events during workflow execution', async () => {
    const events: string[] = [];
    bus.subscribe('workflow.started', () => { events.push('started'); });
    bus.subscribe('workflow.completed', () => { events.push('completed'); });
    bus.subscribe('task.started', () => { events.push('task.started'); });

    const def = createWorkflowDefinition('Find dentists in Dallas');
    const workflow = engine.createWorkflow(def);
    await engine.startWorkflow(workflow.id);

    expect(events).toContain('started');
    expect(events).toContain('completed');
    expect(events.filter((e) => e === 'task.started').length).toBeGreaterThanOrEqual(1);
  });

  it('should cancel a workflow', async () => {
    const def = createWorkflowDefinition('Test cancel');
    const workflow = engine.createWorkflow(def);
    engine.cancelWorkflow(workflow.id);
    expect(engine.getWorkflowStatus(workflow.id)).toBe('CANCELLED');
  });

  it('should pause and resume a workflow', async () => {
    const def = createWorkflowDefinition('Test pause');
    const workflow = engine.createWorkflow(def);
    workflow.status = 'RUNNING';
    const paused = engine.pauseWorkflow(workflow.id);
    expect(paused).toBe(true);
    expect(engine.getWorkflowStatus(workflow.id)).toBe('PAUSED');
  });

  it('should track workflow history', async () => {
    const def = createWorkflowDefinition('Find dentists in Dallas');
    const workflow = engine.createWorkflow(def);
    await engine.startWorkflow(workflow.id);
    const history = engine.getWorkflowHistory(workflow.id);
    expect(history.length).toBeGreaterThan(0);
    expect(history.some((h) => h.action === 'workflow_created')).toBe(true);
    expect(history.some((h) => h.action === 'workflow_started')).toBe(true);
    expect(history.some((h) => h.action === 'workflow_completed')).toBe(true);
  });

  it('should fire onWorkflowEvent callback', async () => {
    const def = createWorkflowDefinition('Find dentists in Dallas');
    const workflow = engine.createWorkflow(def);
    let completed = false;
    engine.onWorkflowEvent(workflow.id, 'completed', () => {
      completed = true;
    });
    await engine.startWorkflow(workflow.id);
    expect(completed).toBe(true);
  });

  it('should set and use retry policy', async () => {
    const def = createWorkflowDefinition('Retry test');
    const workflow = engine.createWorkflow(def);
    const policy: RetryPolicy = {
      maxRetries: 5,
      backoffStrategy: 'linear',
      baseDelayMs: 50,
      maxDelayMs: 1000,
    };
    engine.setRetryPolicy(workflow.id, policy);
    const result = await engine.retry(workflow.id);
    expect(result).toBe(true);
  });

  it('should list workflows by status', async () => {
    const def1 = createWorkflowDefinition('Workflow A');
    const def2 = createWorkflowDefinition('Workflow B');
    engine.createWorkflow(def1);
    engine.createWorkflow(def2);

    const created = engine.listWorkflows('CREATED');
    expect(created.length).toBe(2);
  });
});

describe('KernelRuntime', () => {
  let runtime: KernelRuntime;

  beforeEach(async () => {
    runtime = new KernelRuntime();
    await runtime.initialize();
  });

  it('should initialize and start', async () => {
    await runtime.start();
    expect(runtime.id).toMatch(/^runtime_/);
  });

  it('should submit a workflow and track status', async () => {
    await runtime.start();
    const def = createWorkflowDefinition('Find dentists in Dallas');
    const workflow = await runtime.submitWorkflow(def);
    expect(workflow).toBeDefined();
    expect(runtime.getWorkflowStatus(workflow.id)).toBe('COMPLETED');
  });

  it('should accept a goal end-to-end: Find dentists in Dallas', async () => {
    await runtime.start();

    const planner = new SequentialPlanner();
    const goal = createGoal('Find dentists in Dallas');
    const definition = planner.planToDefinition(goal);

    const workflow = await runtime.submitWorkflow(definition);
    expect(workflow.status).toBe('COMPLETED');

    const ctx = runtime.workflowEngine.getExecutionContext(workflow.id);
    expect(ctx).toBeDefined();
    expect(ctx!.artifacts.length).toBeGreaterThan(0);

    const history = runtime.workflowEngine.getWorkflowHistory(workflow.id);
    expect(history.length).toBeGreaterThan(0);
  });

  it('should cancel a workflow', async () => {
    await runtime.start();
    const def = createWorkflowDefinition('Cancel test');
    const workflow = runtime.workflowEngine.createWorkflow(def);
    const cancelled = runtime.cancelWorkflow(workflow.id);
    expect(cancelled).toBe(true);
    expect(runtime.getWorkflowStatus(workflow.id)).toBe('CANCELLED');
  });

  it('should pause and resume', async () => {
    await runtime.start();
    runtime.pause();
    runtime.resume();
  });

  it('should shutdown cleanly', async () => {
    await runtime.start();
    await runtime.shutdown();
  });

  it('should reject workflows when paused', async () => {
    await runtime.start();
    runtime.pause();
    const def = createWorkflowDefinition('Paused test');
    await expect(runtime.submitWorkflow(def)).rejects.toThrow('paused');
  });

  it('should register services in DI container', async () => {
    await runtime.initialize();
    expect(runtime.container.has('IEventBus')).toBe(true);
    expect(runtime.container.has('ILogger')).toBe(true);
    expect(runtime.container.has('IRuntime')).toBe(true);
  });
});

describe('DependencyInjectionContainer', () => {
  it('should register and resolve values', () => {
    const container = new DependencyInjectionContainer();
    container.registerValue('config', { maxRetries: 3 });
    const config = container.resolve<{ maxRetries: number }>('config');
    expect(config.maxRetries).toBe(3);
  });

  it('should register and resolve factories', () => {
    const container = new DependencyInjectionContainer();
    container.register('logger', () => new ConsoleLogger());
    const logger = container.resolve<ConsoleLogger>('logger');
    expect(logger).toBeInstanceOf(ConsoleLogger);
  });

  it('should support singleton factories', () => {
    const container = new DependencyInjectionContainer();
    let count = 0;
    container.register('counter', () => ({ count: ++count }), true);
    const a = container.resolve<{ count: number }>('counter');
    const b = container.resolve<{ count: number }>('counter');
    expect(a).toBe(b);
    expect(a.count).toBe(1);
  });

  it('should support non-singleton factories', () => {
    const container = new DependencyInjectionContainer();
    let count = 0;
    container.register('counter', () => ({ count: ++count }), false);
    const a = container.resolve<{ count: number }>('counter');
    const b = container.resolve<{ count: number }>('counter');
    expect(a.count).toBe(1);
    expect(b.count).toBe(2);
  });

  it('should create child containers', () => {
    const parent = new DependencyInjectionContainer();
    parent.registerValue('service', 'from-parent');
    const child = parent.createChild();
    expect(child.has('service')).toBe(true);
    expect(child.resolve<string>('service')).toBe('from-parent');
  });

  it('should remove services', () => {
    const container = new DependencyInjectionContainer();
    container.registerValue('service', 'value');
    expect(container.remove('service')).toBe(true);
    expect(container.has('service')).toBe(false);
  });

  it('should throw on missing service', () => {
    const container = new DependencyInjectionContainer();
    expect(() => container.resolve('missing')).toThrow('Service not registered');
  });
});

describe('ExecutionContextManager', () => {
  let manager: ExecutionContextManager;

  beforeEach(() => {
    manager = new ExecutionContextManager();
  });

  it('should create and retrieve context', () => {
    const ctx = manager.createContext('wf-1', 'goal-1');
    expect(ctx).toBeDefined();
    expect(ctx.workflowId).toBe('wf-1');
    expect(manager.getContext('wf-1')).toBe(ctx);
  });

  it('should set and get variables', () => {
    manager.createContext('wf-1', 'goal-1');
    manager.setVariable('wf-1', 'key', 'value');
    expect(manager.getVariable('wf-1', 'key')).toBe('value');
  });

  it('should add and get artifacts', () => {
    manager.createContext('wf-1', 'goal-1');
    manager.addArtifact('wf-1', {
      id: 'a1',
      type: 'result',
      data: { name: 'Dr. Smith' },
      createdAt: new Date().toISOString(),
    });
    const artifacts = manager.getArtifacts('wf-1');
    expect(artifacts.length).toBe(1);
  });

  it('should store task results', () => {
    manager.createContext('wf-1', 'goal-1');
    const task: Task = {
      id: 't1',
      objective: 'test',
      required_capabilities: [],
      status: 'COMPLETED',
      priority: 'NORMAL',
      dependencies: [],
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };
    manager.storeTaskResult('wf-1', task, { success: true, output: 'done' });
    const result = manager.getVariable('wf-1', 'result:t1');
    expect(result).toBeDefined();
  });

  it('should dispose a context', () => {
    manager.createContext('wf-1', 'goal-1');
    manager.disposeContext('wf-1');
    expect(manager.getContext('wf-1')).toBeUndefined();
  });
});

describe('DependencyAwareScheduler', () => {
  let scheduler: DependencyAwareScheduler;

  beforeEach(() => {
    scheduler = new DependencyAwareScheduler();
  });

  it('should schedule and get next ready task', () => {
    const task: Task = {
      id: 't1',
      objective: 'test',
      required_capabilities: [],
      status: 'PENDING',
      priority: 'NORMAL',
      dependencies: [],
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };
    scheduler.schedule(task);
    const next = scheduler.next();
    expect(next?.id).toBe('t1');
  });

  it('should block tasks with unmet dependencies', () => {
    const task1: Task = {
      id: 't1',
      objective: 'first',
      required_capabilities: [],
      status: 'PENDING',
      priority: 'NORMAL',
      dependencies: [],
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };
    const task2: Task = {
      id: 't2',
      objective: 'second',
      required_capabilities: [],
      status: 'PENDING',
      priority: 'NORMAL',
      dependencies: ['t1'],
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };
    scheduler.schedule(task1);
    scheduler.schedule(task2);

    expect(scheduler.isReady('t2')).toBe(false);
    expect(scheduler.getBlockedTasks().length).toBe(1);

    scheduler.completeTask('t1');
    expect(scheduler.isReady('t2')).toBe(true);
  });

  it('should cancel a scheduled task', () => {
    const task: Task = {
      id: 't1',
      objective: 'test',
      required_capabilities: [],
      status: 'PENDING',
      priority: 'NORMAL',
      dependencies: [],
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };
    scheduler.schedule(task);
    expect(scheduler.cancelScheduled('t1')).toBe(true);
  });

  it('should clear all tasks', () => {
    scheduler.schedule({
      id: 't1',
      objective: 'test',
      required_capabilities: [],
      status: 'PENDING',
      priority: 'NORMAL',
      dependencies: [],
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    });
    scheduler.clear();
    expect(scheduler.getScheduledTasks().length).toBe(0);
  });
});

describe('PriorityWorkflowQueue', () => {
  let queue: PriorityWorkflowQueue;

  beforeEach(() => {
    queue = new PriorityWorkflowQueue();
  });

  it('should prioritize workflows by priority', () => {
    const normalWf: Workflow = {
      id: 'wf-normal',
      goalId: 'g1',
      name: 'Normal workflow',
      status: 'PENDING',
      taskGraph: { id: 'tg1', goal_id: 'g1', tasks: [], root_task_id: '', created_at: '' },
      steps: [],
      currentStepIndex: 0,
      createdAt: new Date().toISOString(),
      priority: 'NORMAL',
    };
    const criticalWf: Workflow = {
      id: 'wf-critical',
      goalId: 'g2',
      name: 'Critical workflow',
      status: 'PENDING',
      taskGraph: { id: 'tg2', goal_id: 'g2', tasks: [], root_task_id: '', created_at: '' },
      steps: [],
      currentStepIndex: 0,
      createdAt: new Date().toISOString(),
      priority: 'CRITICAL',
    };

    queue.enqueue(normalWf);
    queue.enqueue(criticalWf);

    expect(queue.dequeue()?.id).toBe('wf-critical');
    expect(queue.dequeue()?.id).toBe('wf-normal');
  });

  it('should remove a specific workflow', () => {
    const wf: Workflow = {
      id: 'wf-1',
      goalId: 'g1',
      name: 'Test',
      status: 'PENDING',
      taskGraph: { id: 'tg1', goal_id: 'g1', tasks: [], root_task_id: '', created_at: '' },
      steps: [],
      currentStepIndex: 0,
      createdAt: new Date().toISOString(),
      priority: 'NORMAL',
    };
    queue.enqueue(wf);
    expect(queue.remove('wf-1')).toBe(true);
    expect(queue.size()).toBe(0);
  });

  it('should report isEmpty', () => {
    expect(queue.isEmpty()).toBe(true);
    const wf: Workflow = {
      id: 'wf-1',
      goalId: 'g1',
      name: 'Test',
      status: 'PENDING',
      taskGraph: { id: 'tg1', goal_id: 'g1', tasks: [], root_task_id: '', created_at: '' },
      steps: [],
      currentStepIndex: 0,
      createdAt: new Date().toISOString(),
      priority: 'NORMAL',
    };
    queue.enqueue(wf);
    expect(queue.isEmpty()).toBe(false);
  });

  it('should clear all workflows', () => {
    queue.enqueue({
      id: 'wf-1',
      goalId: 'g1',
      name: 'Test',
      status: 'PENDING',
      taskGraph: { id: 'tg1', goal_id: 'g1', tasks: [], root_task_id: '', created_at: '' },
      steps: [],
      currentStepIndex: 0,
      createdAt: new Date().toISOString(),
      priority: 'NORMAL',
    });
    queue.clear();
    expect(queue.size()).toBe(0);
  });
});

describe('Smoke: Find dentists in Dallas', () => {
  it('should complete the full end-to-end workflow', async () => {
    const bus = new EventBus();
    const registry = new AgentRegistry();
    const logger = new ConsoleLogger();

    registry.registerAgent(createAgent('agent.web_search', ['web_search']));
    registry.registerAgent(createAgent('agent.data_analysis', ['data_analysis']));
    registry.registerAgent(createAgent('agent.compilation', ['compilation']));

    const collectedEvents: string[] = [];
    const eventTypes: string[] = [
      'workflow.created',
      'workflow.started',
      'task.started',
      'task.completed',
      'task.assigned',
      'workflow.completed',
    ];
    for (const et of eventTypes) {
      bus.subscribe(et as any, () => { collectedEvents.push(et); });
    }

    const runtime = new KernelRuntime({
      eventBus: bus,
      logger,
      workflowEngine: new WorkflowEngine(bus, logger, registry),
    });
    await runtime.initialize();
    await runtime.start();

    const planner = new SequentialPlanner();
    const goal = createGoal('Find dentists in Dallas', 'HIGH');
    const definition = planner.planToDefinition(goal);

    const workflow = await runtime.submitWorkflow(definition);

    expect(workflow.status).toBe('COMPLETED');
    expect(collectedEvents).toContain('workflow.created');
    expect(collectedEvents).toContain('workflow.started');
    expect(collectedEvents).toContain('workflow.completed');

    const ctx = runtime.workflowEngine.getExecutionContext(workflow.id);
    expect(ctx).toBeDefined();
    expect(ctx!.artifacts.length).toBeGreaterThan(0);

    const history = runtime.workflowEngine.getWorkflowHistory(workflow.id);
    expect(history.some((h) => h.action === 'workflow_created')).toBe(true);
    expect(history.some((h) => h.action === 'workflow_started')).toBe(true);
    expect(history.some((h) => h.action === 'task_assigned')).toBe(true);
    expect(history.some((h) => h.action === 'task_started')).toBe(true);
    expect(history.some((h) => h.action === 'task_completed')).toBe(true);
    expect(history.some((h) => h.action === 'workflow_completed')).toBe(true);

    await runtime.shutdown();
  });
});

describe('Config', () => {
  it('should provide default configuration', () => {
    expect(defaultConfig.maxRetries).toBe(3);
    expect(defaultConfig.defaultTaskPriority).toBe('NORMAL');
    expect(defaultConfig.logLevel).toBe('INFO');
  });
});
