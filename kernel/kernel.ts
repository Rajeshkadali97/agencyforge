import { randomUUID } from 'crypto';
import { Goal, TaskGraph, EventPayload, EventType } from './types';
import {
  IKernel,
  IEventBus,
  IAgentRegistry,
  IPlanner,
  ITaskQueue,
  IExecutor,
  ILogger,
} from './interfaces';
import { EventBus } from './event_bus';
import { AgentRegistry } from './agent_registry';
import { SequentialPlanner } from './planner';
import { TaskQueue } from './task_queue';
import { BasicExecutor } from './executor';
import { ConsoleLogger } from './logging';
import { KernelConfig, defaultConfig } from './config';

export interface KernelDeps {
  eventBus?: IEventBus;
  agentRegistry?: IAgentRegistry;
  planner?: IPlanner;
  taskQueue?: ITaskQueue;
  executor?: IExecutor;
  logger?: ILogger;
  config?: Partial<KernelConfig>;
}

export class Kernel implements IKernel {
  public readonly id: string;
  public readonly eventBus: IEventBus;
  public readonly agentRegistry: IAgentRegistry;
  public readonly planner: IPlanner;
  public readonly taskQueue: ITaskQueue;
  public readonly executor: IExecutor;
  public readonly logger: ILogger;
  private config: KernelConfig;

  constructor(deps: KernelDeps = {}) {
    this.id = `kernel_${randomUUID()}`;
    this.config = { ...defaultConfig, ...deps.config };

    this.eventBus = deps.eventBus ?? new EventBus();
    this.agentRegistry = deps.agentRegistry ?? new AgentRegistry();
    this.planner = deps.planner ?? new SequentialPlanner();
    this.taskQueue = deps.taskQueue ?? new TaskQueue();
    this.logger = deps.logger ?? new ConsoleLogger();
    this.executor =
      deps.executor ??
      new BasicExecutor(this.agentRegistry, this.eventBus, this.logger);
  }

  public async initialize(): Promise<void> {
    this.logger.info('Kernel initializing', { kernel_id: this.id });
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Kernel shutting down', { kernel_id: this.id });
  }

  public async ingestGoal(goal: Goal): Promise<TaskGraph> {
    const traceLogger = this.logger.child({
      trace_id: goal.id,
      goal_id: goal.id,
    });
    traceLogger.info('Goal ingested', { objective: goal.objective });

    const graph = this.planner.plan(goal);
    traceLogger.info('Goal planned', { graph_id: graph.id });

    const rootTask = graph.tasks.find((t) => t.id === graph.root_task_id);
    if (rootTask) {
      this.taskQueue.enqueue(rootTask);
    }

    const task = this.taskQueue.dequeue();
    if (task) {
      await this.executor.execute(task);
    }

    traceLogger.info('Goal execution complete', { goal_id: goal.id });
    return graph;
  }

  public emit(eventType: EventType, payload: EventPayload): void {
    this.eventBus.emit(eventType, payload);
  }
}
