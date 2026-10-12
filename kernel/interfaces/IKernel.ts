import { Goal, TaskGraph, EventPayload, EventType } from '../types';
import { IEventBus } from './IEventBus';
import { IAgentRegistry } from './IAgentRegistry';
import { IPlanner } from './IPlanner';
import { ITaskQueue } from './ITaskQueue';
import { IExecutor } from './IExecutor'
;import { ILogger } from './ILogger';

export interface IKernel {
  id: string;
  eventBus: IEventBus;
  agentRegistry: IAgentRegistry;
  planner: IPlanner;
  taskQueue: ITaskQueue;
  executor: IExecutor;
  logger: ILogger;

  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  ingestGoal(goal: Goal): Promise<TaskGraph>;

  /** Convenience helper to emit events to the bus */
  emit(eventType: EventType, payload: EventPayload): void;
}
