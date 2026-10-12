import { CancellationToken } from '../utils/cancellation';
import { ILogger, IConfiguration } from '../interfaces';
import { RuntimeEvent } from '../contracts';

export interface ExecutionContext {
  workflowId: string;
  taskId: string;
  userId: string;
  projectId: string;
  memoryScope: string;
  currentAgentId: string | null;
  logger: ILogger;
  config: IConfiguration;
  startTime: Date;
  cancellationToken: CancellationToken;
  metadata: Record<string, unknown>;
  eventBus: IEventBus;
}

export interface IEventBus {
  publish<TPayload extends RuntimeEvent['payload']>(event: RuntimeEvent<TPayload>): void;
  subscribe<TPayload extends RuntimeEvent['payload']>(
    eventType: string,
    handler: (event: RuntimeEvent<TPayload>) => void | Promise<void>
  ): string;
  unsubscribe(subscriptionId: string): boolean;
}

export interface IMemoryScope {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  delete(key: string): boolean;
  has(key: string): boolean;
  clear(): void;
  keys(): string[];
}

export interface IExecutionContextFactory {
  createContext(params: CreateContextParams): ExecutionContext;
  createChildContext(parent: ExecutionContext, overrides: Partial<CreateContextParams>): ExecutionContext;
}

export interface CreateContextParams {
  workflowId: string;
  taskId: string;
  userId: string;
  projectId: string;
  memoryScope: string;
  currentAgentId?: string;
  logger: ILogger;
  config: IConfiguration;
  eventBus: IEventBus;
  metadata?: Record<string, unknown>;
  cancellationToken?: CancellationToken;
}

export interface IContextRegistry {
  register(context: ExecutionContext): void;
  get(workflowId: string): ExecutionContext | undefined;
  getByTask(taskId: string): ExecutionContext | undefined;
  remove(workflowId: string): boolean;
  getAll(): ExecutionContext[];
}