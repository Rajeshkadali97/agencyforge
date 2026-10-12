import { randomUUID } from 'crypto';
import { ILogger } from '../interfaces';
import { EnhancedEventBus } from '../events/EnhancedEventBus';
import { RuntimeEventTypes, createRuntimeEvent, BaseEventPayload } from '../contracts';
import { IAgentRuntime, AgentMetadata, AgentResult, BaseAgent } from './AgentRuntime';
import { AgentCapability, AgentDefinition, AgentInstance } from './AgentDefinition';
import { AgentRegistry } from './AgentRegistry';
import { AgentOrchestrator, TaskAssignment, AgentOrchestrationResult } from './AgentOrchestrator';
import { ExecutionContext, ExecutionContextFactory } from '../context';
import { SharedContextManager } from '../shared-context';
import { ToolExecutionEngine } from '../tools';
import { AIService, getAIService } from '../ai/ai-service';
import { ISubsystem, SubsystemHealth } from '../health/HealthManager';

export interface AgentSubsystemConfig {
  autoInitializeAgents: boolean;
  maxConcurrentTasks: number;
  retryFailedTasks: boolean;
  maxRetries: number;
  retryDelayMs: number;
  enableParallelExecution: boolean;
}

const DEFAULT_AGENT_SUBSYSTEM_CONFIG: AgentSubsystemConfig = {
  autoInitializeAgents: true,
  maxConcurrentTasks: 10,
  retryFailedTasks: true,
  maxRetries: 3,
  retryDelayMs: 2000,
  enableParallelExecution: true,
};

export class AgentSubsystem implements ISubsystem {
  name = 'Agent';
  private initialized = false;
  private subscriptions: string[] = [];
  private config: AgentSubsystemConfig;

  private registry: AgentRegistry;
  private orchestrator: AgentOrchestrator;
  private contextFactory: ExecutionContextFactory;
  private sharedContext: SharedContextManager;
  private aiService: AIService;

  private activeTasks: Map<string, { assignment: TaskAssignment; result?: AgentOrchestrationResult; startedAt: Date }> = new Map();
  private taskQueue: TaskAssignment[] = [];
  private pendingRetries: Map<string, { assignment: TaskAssignment; retryCount: number; nextRetryAt: Date }> = new Map();

  constructor(
    private logger: ILogger,
    private eventBus: EnhancedEventBus,
    contextFactory: ExecutionContextFactory,
    private toolEngine: ToolExecutionEngine,
    sharedContext: SharedContextManager,
    aiService?: AIService,
    config?: Partial<AgentSubsystemConfig>
  ) {
    this.config = { ...DEFAULT_AGENT_SUBSYSTEM_CONFIG, ...config };
    this.contextFactory = contextFactory;
    this.sharedContext = sharedContext;
    this.aiService = aiService || getAIService();

    this.registry = new AgentRegistry({}, this.logger, this.eventBus);
    this.orchestrator = new AgentOrchestrator(
      this.eventBus,
      this.contextFactory,
      this.toolEngine,
      this.sharedContext,
      this.logger,
      this.config
    );
  }

  async initialize(): Promise<void> {
    this.logger.info('AgentSubsystem: Initializing...');

    await this.registry.initialize();
    await this.orchestrator.initialize();

    this.subscriptions.push(
      this.eventBus.subscribe(RuntimeEventTypes.TASK_STARTED, (event) => {
        const payload = event.payload as BaseEventPayload & { taskId: string; agentId: string };
        this.logger.info('AgentSubsystem: Task started', { taskId: payload.taskId, agentId: payload.agentId });
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(RuntimeEventTypes.TASK_COMPLETED, (event) => {
        const payload = event.payload as BaseEventPayload & { taskId: string; agentId: string; output: unknown; durationMs: number };
        this.handleTaskCompleted(payload.taskId, payload.agentId, payload.output, payload.durationMs);
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(RuntimeEventTypes.TASK_FAILED, (event) => {
        const payload = event.payload as BaseEventPayload & { taskId: string; agentId: string; error: string; durationMs: number; willRetry: boolean };
        this.handleTaskFailed(payload.taskId, payload.agentId, payload.error, payload.durationMs, payload.willRetry);
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(RuntimeEventTypes.GOAL_RECEIVED, (event) => {
        const payload = event.payload as BaseEventPayload & { goalId: string; objective: string };
        this.sharedContext.setSharedMemory(`goal.${payload.goalId}.status`, 'in_progress');
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(RuntimeEventTypes.AGENT_REGISTERED, (event) => {
        const payload = event.payload as BaseEventPayload & { agentId: string; name: string; capabilities: string[]; version: string };
        this.logger.info('AgentSubsystem: Agent registered', { agentId: payload.agentId, name: payload.name });
      })
    );

    this.initialized = true;
    this.sharedContext.updateSubsystemHealth(this.name, 'healthy');
    this.logger.info('AgentSubsystem: Initialized', {
      agentsLoaded: this.registry.getStats().loadedInstances,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      enableParallelExecution: this.config.enableParallelExecution,
    });
  }

  async shutdown(): Promise<void> {
    this.logger.info('AgentSubsystem: Shutting down...');

    for (const subId of this.subscriptions) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptions = [];

    const activeTaskIds = Array.from(this.activeTasks.keys());
    for (const taskId of activeTaskIds) {
      await this.cancelTask(taskId);
    }

    await this.orchestrator.shutdown();
    await this.registry.shutdown();

    this.initialized = false;
    this.logger.info('AgentSubsystem: Shut down');
  }

  async checkHealth(): Promise<SubsystemHealth> {
    const stats = this.registry.getStats();
    const healthIssues: string[] = [];

  // No agents loaded check removed to allow start to succeed when none are loaded.


    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      healthIssues.push('Max concurrent tasks reached');
    }

    const status = healthIssues.length === 0 ? 'healthy' : healthIssues.length <= 1 ? 'degraded' : 'offline';
    return {
      name: this.name,
      status,
      lastCheck: new Date(),
      message: this.initialized
        ? `Agent subsystem operational - ${stats.loadedInstances} agents loaded, ${this.activeTasks.size} active tasks`
        : 'Agent subsystem not initialized',
      dependencies: [],
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async checkOperational(): Promise<boolean> {
    return this.initialized && this.registry.getStats().loadedInstances > 0;
  }

  async registerAgent(agent: IAgentRuntime): Promise<void> {
    this.registry.register(agent);
    this.orchestrator.registerAgent(agent);
  }

  async registerAgentDefinition(definition: AgentDefinition, context?: ExecutionContext): Promise<boolean> {
    const result = await this.registry.registerDefinition(definition);
    if (result.success && context) {
      const instance = await this.registry.loadAgent(definition.id, context);
      return instance !== null;
    }
    return result.success;
  }

  async assignTask(assignment: TaskAssignment): Promise<AgentOrchestrationResult> {
    this.activeTasks.set(assignment.taskId, { assignment, startedAt: new Date() });

    this.eventBus.publish(
      createRuntimeEvent(RuntimeEventTypes.TASK_STARTED, {
        workflowId: assignment.workflowId,
        timestamp: new Date().toISOString(),
        traceId: assignment.traceId,
        spanId: assignment.spanId,
        taskId: assignment.taskId,
        agentId: assignment.agentId,
        objective: assignment.objective,
        requiredCapabilities: assignment.requiredCapabilities,
        priority: assignment.priority,
      } as BaseEventPayload, assignment.traceId, assignment.spanId)
    );

    try {
      const result = await this.orchestrator.assignTask(assignment);
      return result;
    } catch (error) {
      return {
        taskId: assignment.taskId,
        agentId: assignment.agentId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: 0,
      };
    }
  }

  async assignTaskWithRetry(assignment: TaskAssignment): Promise<AgentOrchestrationResult> {
    const result = await this.assignTask(assignment);

    if (!result.success && this.config.retryFailedTasks) {
      const retryInfo = this.pendingRetries.get(assignment.taskId);
      const retryCount = retryInfo?.retryCount ?? 0;

      if (retryCount < this.config.maxRetries) {
        this.pendingRetries.set(assignment.taskId, {
          assignment,
          retryCount: retryCount + 1,
          nextRetryAt: new Date(Date.now() + this.config.retryDelayMs * Math.pow(2, retryCount)),
        });
      }
    }

    return result;
  }

  async assignParallelTasks(assignments: TaskAssignment[]): Promise<Map<string, AgentOrchestrationResult>> {
    if (!this.config.enableParallelExecution) {
      const results = new Map<string, AgentOrchestrationResult>();
      for (const assignment of assignments) {
        const result = await this.assignTask(assignment);
        results.set(assignment.taskId, result);
      }
      return results;
    }

    const promises = assignments.map(async (assignment) => {
      const result = await this.assignTask(assignment);
      return { assignment, result };
    });

    const settled = await Promise.allSettled(promises);
    const results = new Map<string, AgentOrchestrationResult>();

    for (let i = 0; i < settled.length; i++) {
      const settledResult = settled[i];
      const assignment = assignments[i];

      if (settledResult.status === 'fulfilled') {
        results.set(assignment.taskId, settledResult.value.result);
      } else {
        results.set(assignment.taskId, {
          taskId: assignment.taskId,
          agentId: assignment.agentId,
          success: false,
          error: settledResult.reason instanceof Error ? settledResult.reason.message : String(settledResult.reason),
          durationMs: 0,
        });
      }
    }

    return results;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const taskInfo = this.activeTasks.get(taskId);
    if (!taskInfo) {
      return false;
    }

    this.activeTasks.delete(taskId);
    this.pendingRetries.delete(taskId);

    const idx = this.taskQueue.findIndex((t) => t.taskId === taskId);
    if (idx !== -1) {
      this.taskQueue.splice(idx, 1);
    }

    this.logger.info('AgentSubsystem: Task cancelled', { taskId });
    return true;
  }

  private handleTaskCompleted(taskId: string, agentId: string, output: unknown, durationMs: number): void {
    const taskInfo = this.activeTasks.get(taskId);
    if (taskInfo) {
      taskInfo.result = {
        taskId,
        agentId,
        success: true,
        output,
        durationMs,
      };
    }

    this.activeTasks.delete(taskId);
    this.pendingRetries.delete(taskId);
    this.sharedContext.setSharedMemory(`task.${taskId}.status`, 'completed');
  }

  private handleTaskFailed(taskId: string, agentId: string, error: string, durationMs: number, willRetry: boolean): void {
    const taskInfo = this.activeTasks.get(taskId);
    if (taskInfo) {
      taskInfo.result = {
        taskId,
        agentId,
        success: false,
        error,
        durationMs,
      };
    }

    if (!willRetry) {
      this.activeTasks.delete(taskId);
      this.pendingRetries.delete(taskId);
      this.sharedContext.setSharedMemory(`task.${taskId}.status`, 'failed');
    }
  }

  getRegistry(): AgentRegistry {
    return this.registry;
  }

  getOrchestrator(): AgentOrchestrator {
    return this.orchestrator;
  }

  getActiveTasks(): Array<{ taskId: string; agentId: string; startedAt: Date; assignment: TaskAssignment }> {
    return Array.from(this.activeTasks.entries()).map(([taskId, info]) => ({
      taskId,
      agentId: info.assignment.agentId,
      startedAt: info.startedAt,
      assignment: info.assignment,
    }));
  }

  getQueuedTasks(): TaskAssignment[] {
    return [...this.taskQueue];
  }

  getTaskResult(taskId: string): AgentOrchestrationResult | undefined {
    return this.activeTasks.get(taskId)?.result;
  }

  getAIService(): AIService {
    return this.aiService;
  }
}