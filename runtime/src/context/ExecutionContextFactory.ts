import { ILogger } from '../interfaces';
import { IConfiguration } from '../interfaces';
import { IEventBus } from '../interfaces';
import { CancellationToken } from '../utils/cancellation';
import {
  ExecutionContext,
  CreateContextParams,
  IExecutionContextFactory,
  IContextRegistry,
  IMemoryScope,
} from './ExecutionContext';
import { randomUUID } from 'crypto';

export class InMemoryScope implements IMemoryScope {
  private store: Map<string, unknown> = new Map();

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

export class ExecutionContextFactory implements IExecutionContextFactory {
  private contextRegistry: IContextRegistry;

  constructor(contextRegistry: IContextRegistry) {
    this.contextRegistry = contextRegistry;
  }

  createContext(params: CreateContextParams): ExecutionContext {
    const context: ExecutionContext = {
      workflowId: params.workflowId,
      taskId: params.taskId,
      userId: params.userId,
      projectId: params.projectId,
      memoryScope: params.memoryScope,
      currentAgentId: params.currentAgentId ?? null,
      logger: params.logger,
      config: params.config,
      startTime: new Date(),
      cancellationToken: params.cancellationToken ?? new CancellationToken(),
      metadata: params.metadata ?? {},
      eventBus: params.eventBus,
    };

    this.contextRegistry.register(context);
    return context;
  }

  createChildContext(parent: ExecutionContext, overrides: Partial<CreateContextParams>): ExecutionContext {
    const childContext: ExecutionContext = {
      workflowId: overrides.workflowId ?? parent.workflowId,
      taskId: overrides.taskId ?? parent.taskId,
      userId: overrides.userId ?? parent.userId,
      projectId: overrides.projectId ?? parent.projectId,
      memoryScope: overrides.memoryScope ?? parent.memoryScope,
      currentAgentId: overrides.currentAgentId ?? parent.currentAgentId,
      logger: overrides.logger ?? parent.logger.child({ child: true }),
      config: overrides.config ?? parent.config,
      startTime: new Date(),
      cancellationToken: overrides.cancellationToken ?? parent.cancellationToken,
      metadata: { ...parent.metadata, ...overrides.metadata },
      eventBus: overrides.eventBus ?? parent.eventBus,
    };

    this.contextRegistry.register(childContext);
    return childContext;
  }
}

export class ContextRegistry implements IContextRegistry {
  private contexts: Map<string, ExecutionContext> = new Map();
  private taskIndex: Map<string, string> = new Map();

  register(context: ExecutionContext): void {
    this.contexts.set(context.workflowId, context);
    this.taskIndex.set(context.taskId, context.workflowId);
  }

  get(workflowId: string): ExecutionContext | undefined {
    return this.contexts.get(workflowId);
  }

  getByTask(taskId: string): ExecutionContext | undefined {
    const workflowId = this.taskIndex.get(taskId);
    if (workflowId) {
      return this.contexts.get(workflowId);
    }
    return undefined;
  }

  remove(workflowId: string): boolean {
    const context = this.contexts.get(workflowId);
    if (context) {
      this.taskIndex.delete(context.taskId);
      return this.contexts.delete(workflowId);
    }
    return false;
  }

  getAll(): ExecutionContext[] {
    return Array.from(this.contexts.values());
  }
}

export function createExecutionContextId(): string {
  return `ctx_${randomUUID()}`;
}