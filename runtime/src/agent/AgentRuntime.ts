import { ExecutionContext } from '../context';
import { CancellationToken } from '../utils/cancellation';
import { ILogger } from '../interfaces';
import { RuntimeEvent } from '../contracts';
import { AgentCapability } from './AgentDefinition';

export interface AgentMetadata {
  id: string;
  name: string;
  version: string;
  capabilities: AgentCapability[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  dependencies?: string[];
}

export interface AgentHealth {
  status: 'healthy' | 'degraded' | 'unavailable';
  lastCheck: Date;
  details?: Record<string, unknown>;
}

export interface AgentStatus {
  state: 'initializing' | 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'shutting_down' | 'disposed';
  currentTaskId?: string;
  progress?: number;
  message?: string;
}

export interface AgentEvent {
  type: string;
  payload: unknown;
  timestamp: Date;
}

export interface IAgentRuntime {
  metadata: AgentMetadata;
  initialize(context: ExecutionContext): Promise<void>;
  execute(context: ExecutionContext, input: unknown): Promise<AgentResult>;
  pause(context: ExecutionContext): Promise<void>;
  resume(context: ExecutionContext): Promise<void>;
  cancel(context: ExecutionContext): Promise<void>;
  health(): Promise<AgentHealth>;
  status(): Promise<AgentStatus>;
  events(): AsyncIterable<AgentEvent>;
  dispose(): Promise<void>;
}

export interface AgentResult {
  success: boolean;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface IAgentFactory {
  createAgent(metadata: AgentMetadata): IAgentRuntime;
  getAgent(id: string): IAgentRuntime | undefined;
  listAgents(): IAgentRuntime[];
}

export interface IAgentRegistry {
  register(agent: IAgentRuntime): void;
  unregister(agentId: string): boolean;
  get(agentId: string): IAgentRuntime | undefined;
  list(): IAgentRuntime[];
  findByCapability(capability: string): IAgentRuntime[];
}

export interface IAgentLifecycleHooks {
  onInitialize?(agent: IAgentRuntime, context: ExecutionContext): Promise<void>;
  onExecute?(agent: IAgentRuntime, context: ExecutionContext, input: unknown): Promise<void>;
  onPause?(agent: IAgentRuntime, context: ExecutionContext): Promise<void>;
  onResume?(agent: IAgentRuntime, context: ExecutionContext): Promise<void>;
  onCancel?(agent: IAgentRuntime, context: ExecutionContext): Promise<void>;
  onDispose?(agent: IAgentRuntime): Promise<void>;
}

export abstract class BaseAgent implements IAgentRuntime {
  public readonly metadata: AgentMetadata;
  protected context: ExecutionContext | null = null;
  protected state: AgentStatus = { state: 'initializing' };
  protected healthStatus: AgentHealth = {
    status: 'healthy',
    lastCheck: new Date(),
  };
  protected eventQueue: AgentEvent[] = [];
  protected eventSubscribers: Array<(event: AgentEvent) => void> = [];
  protected isDisposed = false;

  constructor(metadata: AgentMetadata) {
    this.metadata = metadata;
  }

  async initialize(context: ExecutionContext): Promise<void> {
    this.context = context;
    this.state = { state: 'idle' };
    await this.onInitialize(context);
    this.emitEvent({ type: 'agent.initialized', payload: { agentId: this.metadata.id }, timestamp: new Date() });
  }

  async execute(context: ExecutionContext, input: unknown): Promise<AgentResult> {
    this.context = context;
    this.state = { state: 'running', currentTaskId: context.taskId, progress: 0 };
    this.emitEvent({ type: 'agent.execution.started', payload: { agentId: this.metadata.id, input }, timestamp: new Date() });

    try {
      const result = await this.onExecute(context, input);
      this.state = { state: 'completed', currentTaskId: context.taskId, progress: 100 };
      this.emitEvent({ type: 'agent.execution.completed', payload: { agentId: this.metadata.id, result }, timestamp: new Date() });
      return result;
    } catch (error) {
      this.state = { state: 'failed', currentTaskId: context.taskId, message: error instanceof Error ? error.message : String(error) };
      this.emitEvent({ type: 'agent.execution.failed', payload: { agentId: this.metadata.id, error }, timestamp: new Date() });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async pause(context: ExecutionContext): Promise<void> {
    if (this.state.state === 'running') {
      this.state = { state: 'paused', currentTaskId: context.taskId, progress: this.state.progress };
      await this.onPause(context);
      this.emitEvent({ type: 'agent.paused', payload: { agentId: this.metadata.id }, timestamp: new Date() });
    }
  }

  async resume(context: ExecutionContext): Promise<void> {
    if (this.state.state === 'paused') {
      this.state = { state: 'running', currentTaskId: context.taskId, progress: this.state.progress };
      await this.onResume(context);
      this.emitEvent({ type: 'agent.resumed', payload: { agentId: this.metadata.id }, timestamp: new Date() });
    }
  }

  async cancel(context: ExecutionContext): Promise<void> {
    if (['running', 'paused'].includes(this.state.state)) {
      this.state = { state: 'failed', currentTaskId: context.taskId, message: 'Cancelled' };
      await this.onCancel(context);
      this.emitEvent({ type: 'agent.cancelled', payload: { agentId: this.metadata.id }, timestamp: new Date() });
    }
  }

  async health(): Promise<AgentHealth> {
    this.healthStatus.lastCheck = new Date();
    return this.healthStatus;
  }

  async status(): Promise<AgentStatus> {
    return this.state;
  }

  async *events(): AsyncIterable<AgentEvent> {
    for (const event of this.eventQueue) {
      yield event;
    }
    while (!this.isDisposed) {
      await new Promise<void>((resolve) => {
        const subscriber = (event: AgentEvent) => {
          this.eventSubscribers = this.eventSubscribers.filter((s) => s !== subscriber);
          resolve();
        };
        this.eventSubscribers.push(subscriber);
      });
      if (this.eventQueue.length > 0) {
        yield this.eventQueue.shift()!;
      }
    }
  }

  async dispose(): Promise<void> {
    this.isDisposed = true;
    this.state = { state: 'disposed' };
    await this.onDispose();
    this.emitEvent({ type: 'agent.disposed', payload: { agentId: this.metadata.id }, timestamp: new Date() });
    this.eventSubscribers = [];
  }

  protected emitEvent(event: AgentEvent): void {
    this.eventQueue.push(event);
    this.eventSubscribers.forEach((subscriber) => subscriber(event));
  }

  protected abstract onInitialize(context: ExecutionContext): Promise<void>;
  protected abstract onExecute(context: ExecutionContext, input: unknown): Promise<AgentResult>;
  protected abstract onPause(context: ExecutionContext): Promise<void>;
  protected abstract onResume(context: ExecutionContext): Promise<void>;
  protected abstract onCancel(context: ExecutionContext): Promise<void>;
  protected abstract onDispose(): Promise<void>;
}