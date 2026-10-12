import { ILogger } from '../interfaces';
import { EnhancedEventBus } from '../events/EnhancedEventBus';
import { RuntimeEventTypes, RuntimeEvent, BaseEventPayload, createRuntimeEvent } from '../contracts';
import { IAgentRuntime, AgentMetadata, AgentResult, IAgentRegistry } from './AgentRuntime';
import { AgentCapability } from './AgentDefinition';
import { AgentRegistry } from './AgentRegistry';
import { ExecutionContext, CreateContextParams, ExecutionContextFactory } from '../context';
import { ToolExecutionEngine } from '../tools';
import { SharedContextManager } from '../shared-context';
import { ConsoleLogger } from '../utils/ConsoleLogger';
import { Configuration } from '../config';

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  objective: string;
  requiredCapabilities: string[];
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  dependencies: string[];
  input?: unknown;
  workflowId: string;
  traceId: string;
  spanId: string;
}

export interface AgentOrchestrationConfig {
  maxConcurrentTasks: number;
  maxRetries: number;
  retryDelayMs: number;
  enableParallelExecution: boolean;
  defaultTimeoutMs: number;
}

export interface AgentOrchestrationResult {
  taskId: string;
  agentId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
  retryCount?: number;
}

const DEFAULT_ORCHESTRATION_CONFIG: AgentOrchestrationConfig = {
  maxConcurrentTasks: 10,
  maxRetries: 3,
  retryDelayMs: 2000,
  enableParallelExecution: true,
  defaultTimeoutMs: 120000,
};

export class AgentOrchestrator {
  private registry: AgentRegistry;
  private activeAssignments: Map<string, TaskAssignment> = new Map();
  private activeExecutions: Map<string, Promise<AgentOrchestrationResult>> = new Map();
  private subscriptions: string[] = [];
  private initialized = false;
  private config: AgentOrchestrationConfig;

  constructor(
    private eventBus: EnhancedEventBus,
    private contextFactory: ExecutionContextFactory,
    private toolEngine: ToolExecutionEngine,
    private sharedContext: SharedContextManager,
    private logger: ILogger,
    config?: Partial<AgentOrchestrationConfig>
  ) {
    this.config = { ...DEFAULT_ORCHESTRATION_CONFIG, ...config };
    this.registry = new AgentRegistry({}, this.logger, this.eventBus);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.AGENT_REGISTERED,
        (event: RuntimeEvent<BaseEventPayload & { agentId: string; name: string; capabilities: string[]; version: string }>) => {
          this.logger.info('AgentOrchestrator: Agent registered', {
            agentId: event.payload.agentId,
            name: event.payload.name,
          });
        },
        { label: 'orchestrator-agent-registered' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.AGENT_STATUS_CHANGED,
        (event: RuntimeEvent<BaseEventPayload & { agentId: string; currentStatus: string }>) => {
          if (event.payload.currentStatus === 'idle') {
            this.tryAssignPendingTask(event.payload.agentId);
          }
        },
        { label: 'orchestrator-agent-status' }
      )
    );

    this.initialized = true;
    this.logger.info('AgentOrchestrator: Initialized');
  }

  async shutdown(): Promise<void> {
    for (const subId of this.subscriptions) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptions = [];
    this.initialized = false;
    this.logger.info('AgentOrchestrator: Shutdown');
  }

  registerAgent(agent: IAgentRuntime): void {
    this.registry.register(agent);
    this.eventBus.publish(
      createRuntimeEvent(
        RuntimeEventTypes.AGENT_REGISTERED,
        {
          workflowId: 'system',
          timestamp: new Date().toISOString(),
          traceId: `trc_${Date.now()}`,
          spanId: `spn_${Date.now()}`,
          agentId: agent.metadata.id,
          name: agent.metadata.name,
          capabilities: agent.metadata.capabilities.map((c) => c.name),
          version: agent.metadata.version,
        } as BaseEventPayload & { agentId: string; name: string; capabilities: string[]; version: string },
        'system',
        'orchestrator'
      )
    );
  }

  async assignTask(assignment: TaskAssignment): Promise<AgentOrchestrationResult> {
    return this.executeWithRetry(assignment, 0);
  }

  private async executeWithRetry(assignment: TaskAssignment, retryCount: number): Promise<AgentOrchestrationResult> {
    const agent = this.selectAgent(assignment);
    if (!agent) {
      return {
        taskId: assignment.taskId,
        agentId: 'none',
        success: false,
        error: `No agent available with capabilities: ${assignment.requiredCapabilities.join(', ')}`,
        durationMs: 0,
        retryCount,
      };
    }

    this.activeAssignments.set(assignment.taskId, assignment);
    const startTime = Date.now();

    const context = this.contextFactory.createContext({
      workflowId: assignment.workflowId,
      taskId: assignment.taskId,
      userId: 'system',
      projectId: 'default',
      memoryScope: undefined as any,
      logger: this.logger instanceof ConsoleLogger ? this.logger : new ConsoleLogger(new Configuration()),
      config: new Configuration() as any,
      eventBus: this.eventBus,
    });

    try {
      if (agent.status) {
        const status = await agent.status();
        if (status.state === 'initializing') {
          await agent.initialize(context);
        }
      }

      const result: AgentResult = await this.executeWithTimeout(agent, context, assignment);

      this.activeAssignments.delete(assignment.taskId);

      const durationMs = Date.now() - startTime;

      this.eventBus.publish(
        createRuntimeEvent(
          result.success ? RuntimeEventTypes.TASK_COMPLETED : RuntimeEventTypes.TASK_FAILED,
          {
            workflowId: assignment.workflowId,
            timestamp: new Date().toISOString(),
            traceId: assignment.traceId,
            spanId: assignment.spanId,
            taskId: assignment.taskId,
            agentId: agent.metadata.id,
            ...(result.success
              ? { output: result.output, durationMs }
              : { error: result.error ?? 'Unknown error', retryCount, maxRetries: this.config.maxRetries, willRetry: retryCount < this.config.maxRetries && !result.success, agentId: agent.metadata.id, durationMs }),
          } as BaseEventPayload,
          assignment.traceId,
          assignment.spanId
        )
      );

      return {
        taskId: assignment.taskId,
        agentId: agent.metadata.id,
        success: result.success,
        output: result.output,
        error: result.error,
        durationMs,
        retryCount,
      };
    } catch (err) {
      this.activeAssignments.delete(assignment.taskId);
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      const shouldRetry = retryCount < this.config.maxRetries;
      if (shouldRetry) {
        const delay = this.config.retryDelayMs * Math.pow(2, retryCount);
        this.logger.info('AgentOrchestrator: Scheduling retry', {
          taskId: assignment.taskId,
          retryCount: retryCount + 1,
          delayMs: delay,
        });

        await this.sleep(delay);
        return this.executeWithRetry(assignment, retryCount + 1);
      }

      this.eventBus.publish(
        createRuntimeEvent(
          RuntimeEventTypes.TASK_FAILED,
          {
            workflowId: assignment.workflowId,
            timestamp: new Date().toISOString(),
            traceId: assignment.traceId,
            spanId: assignment.spanId,
            taskId: assignment.taskId,
            agentId: agent.metadata.id,
            error: errorMessage,
            retryCount,
            maxRetries: this.config.maxRetries,
            willRetry: false,
            durationMs,
          } as BaseEventPayload,
          assignment.traceId,
          assignment.spanId
        )
      );

      return {
        taskId: assignment.taskId,
        agentId: agent.metadata.id,
        success: false,
        error: errorMessage,
        durationMs,
        retryCount,
      };
    }
  }

  private async executeWithTimeout(
    agent: IAgentRuntime,
    context: ExecutionContext,
    assignment: TaskAssignment
  ): Promise<AgentResult> {
    return new Promise<AgentResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${assignment.taskId} timed out after ${this.config.defaultTimeoutMs}ms`));
      }, this.config.defaultTimeoutMs);

      agent
        .execute(context, assignment.input)
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  async assignParallelTasks(assignments: TaskAssignment[]): Promise<AgentOrchestrationResult[]> {
    if (!this.config.enableParallelExecution) {
      const results: AgentOrchestrationResult[] = [];
      for (const assignment of assignments) {
        const result = await this.assignTask(assignment);
        results.push(result);
      }
      return results;
    }

    const promises = assignments.map((assignment) => this.assignTask(assignment));
    const results = await Promise.all(promises);
    return results;
  }

  getAgentRegistry(): IAgentRegistry {
    return this.registry;
  }

  getActiveAssignments(): TaskAssignment[] {
    return Array.from(this.activeAssignments.values());
  }

  getActiveExecutions(): Promise<AgentOrchestrationResult>[] {
    return Array.from(this.activeExecutions.values());
  }

  private selectAgent(assignment: TaskAssignment): IAgentRuntime | undefined {
    const candidates = this.registry.findByCapability(assignment.requiredCapabilities[0]);

    if (candidates.length === 0) {
      return this.registry.list().find((a: IAgentRuntime) => {
        const caps = a.metadata.capabilities.map((c: AgentCapability) => c.name);
        return assignment.requiredCapabilities.every((req) => caps.includes(req));
      });
    }

    for (const agent of candidates) {
      const caps = agent.metadata.capabilities.map((c: AgentCapability) => c.name);
      if (assignment.requiredCapabilities.every((req) => caps.includes(req))) {
        return agent;
      }
    }

    return candidates[0] ?? undefined;
  }

  private tryAssignPendingTask(_agentId: string): void {
    // Future: check for pending tasks in queue that match this agent's capabilities
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStats(): {
    activeAssignments: number;
    totalAgents: number;
    loadedAgents: number;
    maxRetries: number;
    enableParallelExecution: boolean;
  } {
    const registryStats = this.registry.getStats();
    return {
      activeAssignments: this.activeAssignments.size,
      totalAgents: registryStats.totalDefinitions,
      loadedAgents: registryStats.loadedInstances,
      maxRetries: this.config.maxRetries,
      enableParallelExecution: this.config.enableParallelExecution,
    };
  }
}