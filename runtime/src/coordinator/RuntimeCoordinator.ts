import { randomUUID } from 'crypto';
import { ILogger, IConfiguration, IEventBus } from '../interfaces';
import { ExecutionContext, CreateContextParams, ExecutionContextFactory, ContextRegistry } from '../context';
import { WorkflowDefinition, WorkflowExecution, IWorkflowEngine, WorkflowEngine, InMemoryWorkflowStore } from '../workflow';
import { AgentRegistry, IAgentRegistry, IAgentRuntime, AgentMetadata } from '../agent';
import { EnhancedEventBus } from '../events/EnhancedEventBus';
import { InMemoryRuntimeStateStore, SQLiteRuntimeStateStore, IRuntimeStateStore } from '../state';
import { Configuration, RuntimeConfig, defaultConfig } from '../config';
import { ServiceContainer, ServiceTokens } from '../container';
import { ErrorRecovery, IErrorRecovery, RecoveryStrategyConfig } from '../recovery';
import {
  RuntimeEvent,
  createRuntimeEvent,
  RuntimeEventTypes,
  GoalReceivedPayload,
  WorkflowStartedPayload,
  WorkflowCompletedPayload,
  WorkflowFailedPayload,
  BaseEventPayload,
} from '../contracts';
import { CancellationToken } from '../utils/cancellation';
import { ConsoleLogger } from '../utils/ConsoleLogger';

export interface RuntimeCoordinatorConfig {
  config?: Partial<RuntimeConfig>;
  logger?: ILogger;
}

export interface GoalInput {
  id?: string;
  objective: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  projectId?: string;
  userId?: string;
  context?: Record<string, unknown>;
  constraints?: string[];
}

export interface ExecutionResult {
  success: boolean;
  workflowId: string;
  result?: unknown;
  error?: string;
  durationMs: number;
}

export interface IRuntimeCoordinator {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  executeGoal(goal: GoalInput): Promise<ExecutionResult>;
  registerWorkflow(definition: WorkflowDefinition): void;
  registerAgent(agent: IAgentRuntime): void;
  pauseWorkflow(workflowId: string): Promise<void>;
  resumeWorkflow(workflowId: string): Promise<void>;
  cancelWorkflow(workflowId: string, reason?: string): Promise<void>;
  getWorkflowStatus(workflowId: string): WorkflowExecution | undefined;
  getState(): IRuntimeStateStore;
  getEventBus(): IEventBus;
}

export class RuntimeCoordinator implements IRuntimeCoordinator {
  private config: Configuration;
  private logger: ILogger;
  private eventBus: EnhancedEventBus;
  private stateStore: IRuntimeStateStore;
  private workflowEngine: IWorkflowEngine;
  private agentRegistry: IAgentRegistry;
  private contextRegistry: ContextRegistry;
  private contextFactory: ExecutionContextFactory;
  private container: ServiceContainer;
  private isInitialized = false;
  private isShuttingDown = false;

  constructor(config: RuntimeCoordinatorConfig = {}) {
    this.config = new Configuration(config.config);
    this.logger = config.logger ?? new ConsoleLogger(this.config);
    this.eventBus = new EnhancedEventBus(this.logger);
    const dbPath = process.env['AGENCYFORGE_DB_PATH'];
    this.stateStore = dbPath
      ? new SQLiteRuntimeStateStore(dbPath)
      : new InMemoryRuntimeStateStore();
    this.agentRegistry = new AgentRegistry({}, this.logger, this.eventBus);
    this.contextRegistry = new ContextRegistry();
    this.contextFactory = new ExecutionContextFactory(this.contextRegistry);

    const workflowStore = new InMemoryWorkflowStore();
    this.workflowEngine = new WorkflowEngine(workflowStore, this.eventBus as unknown as IEventBus, this.logger); // EnhancedEventBus is structurally compatible with IEventBus

    this.container = new ServiceContainer();
    this.setupContainer();
  }

  private setupContainer(): void {
    this.container.register(ServiceTokens.Configuration, this.config);
    this.container.register(ServiceTokens.EventBus, this.eventBus);
    this.container.register(ServiceTokens.StateStore, this.stateStore);
    this.container.register(ServiceTokens.WorkflowEngine, this.workflowEngine);
    this.container.register(ServiceTokens.AgentRegistry, this.agentRegistry);
    this.container.register(ServiceTokens.Logger, this.logger);
    this.container.register(ServiceTokens.RuntimeCoordinator, this);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.logger.info('RuntimeCoordinator initializing', {
      environment: this.config.get('environment'),
    });

    this.setupEventHandlers();
    this.isInitialized = true;

    this.logger.info('RuntimeCoordinator initialized');
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('RuntimeCoordinator shutting down');

    const workflows = this.stateStore.listWorkflows('RUNNING');
    await Promise.all(
      workflows.map((wf) => this.cancelWorkflow(wf.workflowId, 'System shutdown'))
    );

    const agents = this.agentRegistry.list();
    await Promise.all(agents.map((agent) => agent.dispose()));

    this.eventBus.clearHistory();
    this.stateStore.clear();

    this.logger.info('RuntimeCoordinator shut down');
  }

  async executeGoal(goal: GoalInput): Promise<ExecutionResult> {
    if (!this.isInitialized) {
      throw new Error('RuntimeCoordinator not initialized');
    }

    const goalId = goal.id ?? `goal_${randomUUID()}`;
    const workflowId = `wf_${randomUUID()}`;
    const startTime = Date.now();

    this.logger.info('Executing goal', {
      goalId,
      workflowId,
      objective: goal.objective,
    });

    const cancellationToken = new CancellationToken();
    const context = this.createExecutionContext(goal, workflowId, cancellationToken);

    try {
      this.emitEvent(RuntimeEventTypes.GOAL_RECEIVED, {
        goalId,
        workflowId,
        objective: goal.objective,
        priority: goal.priority ?? 'NORMAL',
        projectId: goal.projectId,
        userId: goal.userId ?? 'system',
        context: goal.context,
      });

      const workflowDefinition = this.createWorkflowDefinition(goal, workflowId);
      this.workflowEngine.registerWorkflow(workflowDefinition);

      const execution = await this.workflowEngine.execute(workflowDefinition, context);

      this.stateStore.setWorkflow(execution);

      if (execution.status === 'COMPLETED') {
        this.emitEvent(RuntimeEventTypes.WORKFLOW_COMPLETED, {
          workflowId,
          goalId,
          result: execution.stepResults,
          durationMs: Date.now() - startTime,
        });

        return {
          success: true,
          workflowId,
          result: execution.stepResults,
          durationMs: Date.now() - startTime,
        };
      } else {
        this.emitEvent(RuntimeEventTypes.WORKFLOW_FAILED, {
          workflowId,
          goalId,
          error: execution.error ?? 'Unknown error',
          durationMs: Date.now() - startTime,
        });

        return {
          success: false,
          workflowId,
          error: execution.error ?? 'Unknown error',
          durationMs: Date.now() - startTime,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Goal execution failed', { goalId, workflowId, error: errorMessage });

      this.emitEvent(RuntimeEventTypes.WORKFLOW_FAILED, {
        workflowId,
        goalId,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });

      return {
        success: false,
        workflowId,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  registerWorkflow(definition: WorkflowDefinition): void {
    this.workflowEngine.registerWorkflow(definition);
    this.logger.info('Workflow registered', { workflowId: definition.id, name: definition.name });
  }

  registerAgent(agent: IAgentRuntime): void {
    this.agentRegistry.register(agent);
    this.logger.info('Agent registered', { agentId: agent.metadata.id, name: agent.metadata.name });
  }

  async pauseWorkflow(workflowId: string): Promise<void> {
    await this.workflowEngine.pause(workflowId);
    this.logger.info('Workflow paused', { workflowId });
  }

  async resumeWorkflow(workflowId: string): Promise<void> {
    await this.workflowEngine.resume(workflowId);
    this.logger.info('Workflow resumed', { workflowId });
  }

  async cancelWorkflow(workflowId: string, reason?: string): Promise<void> {
    await this.workflowEngine.cancel(workflowId, reason);
    this.logger.info('Workflow cancelled', { workflowId, reason });
  }

  getWorkflowStatus(workflowId: string): WorkflowExecution | undefined {
    return this.workflowEngine.getExecution(workflowId);
  }

  getState(): IRuntimeStateStore {
    return this.stateStore;
  }

  getEventBus(): IEventBus {
    return this.eventBus as unknown as IEventBus;
  }

  private createExecutionContext(goal: GoalInput, workflowId: string, cancellationToken: CancellationToken): ExecutionContext {
    const taskId = `task_${randomUUID()}`;

    const params: CreateContextParams = {
      workflowId,
      taskId,
      userId: goal.userId ?? 'system',
      projectId: goal.projectId ?? 'default',
      memoryScope: `scope_${workflowId}`,
      currentAgentId: undefined,
      logger: this.logger.child({ workflowId, taskId }),
      config: this.config,
      eventBus: this.eventBus,
      cancellationToken,
      metadata: {
        goalId: goal.id ?? workflowId,
        objective: goal.objective,
        priority: goal.priority,
      },
    };

    return this.contextFactory.createContext(params);
  }

  private createWorkflowDefinition(goal: GoalInput, workflowId: string): WorkflowDefinition {
    const agentRegistry = this.agentRegistry;
    const emitEvent = this.emitEvent.bind(this);
    const logger = this.logger;

    return {
      id: workflowId,
      name: `Workflow for: ${goal.objective.slice(0, 50)}...`,
      version: '1.0',
      steps: [
        {
          id: 'step_research',
          name: 'Research Phase',
          type: 'sequential',
          execute: async (context: ExecutionContext) => {
            emitEvent(RuntimeEventTypes.TASK_STARTED, {
              workflowId,
              taskId: context.taskId,
              traceId: workflowId,
              spanId: context.taskId,
              timestamp: new Date().toISOString(),
              objective: goal.objective,
            });

            const agents = agentRegistry.findByCapability('research');
            if (agents.length > 0) {
              const agent = agents[0];
              logger.info('Invoking research agent', { agentId: agent.metadata.id, workflowId });
              await agent.initialize(context);
              const result = await agent.execute(context, {
                query: goal.objective,
                depth: (goal.context?.['depth'] as 'basic' | 'standard' | 'deep') ?? 'standard',
              });

              if (result.success) {
                const output = result.output as Record<string, unknown>;
                emitEvent(RuntimeEventTypes.RESEARCH_COMPLETED, {
                  workflowId,
                  taskId: context.taskId,
                  traceId: workflowId,
                  spanId: context.taskId,
                  timestamp: new Date().toISOString(),
                  researchId: workflowId,
                  report: output?.['report'] ?? { overallInsights: [], priorityActions: [] },
                  durationMs: 0,
                  result: output,
                });
                return { success: true, output };
              }
              return { success: false, error: result.error ?? 'Research agent failed' };
            }

            logger.info('No research agent registered — using default goal acknowledgement', { workflowId });
            return {
              success: true,
              output: { goalId: goal.id ?? workflowId, objective: goal.objective, agentUsed: false },
            };
          },
          dependencies: [],
        },
        {
          id: 'step_lead_scoring',
          name: 'Lead Scoring Phase',
          type: 'sequential',
          execute: async (context: ExecutionContext) => {
            const agents = agentRegistry.findByCapability('bant-scoring');
            if (agents.length > 0) {
              const agent = agents[0];
              logger.info('Invoking lead scoring agent', { agentId: agent.metadata.id, workflowId });
              await agent.initialize(context);
              const result = await agent.execute(context, { action: 'get-lead-scores' });
              if (result.success) {
                emitEvent(RuntimeEventTypes.LEAD_SCORED, {
                  workflowId,
                  taskId: context.taskId,
                  traceId: workflowId,
                  spanId: context.taskId,
                  timestamp: new Date().toISOString(),
                  leadId: `lead_${workflowId}`,
                  score: 75,
                  tier: 'warm' as const,
                  factors: ['research completed', 'goal aligned'],
                });
                return { success: true, output: result.output };
              }
            }
            return { success: true, output: { skipped: true, reason: 'No lead scoring agent' } };
          },
          dependencies: ['step_research'],
        },
      ],
      globalTimeoutMs: this.config.get('workflow.defaultTimeoutMs'),
      retryPolicy: {
        maxRetries: this.config.get('workflow.maxRetries'),
        baseDelayMs: this.config.get('workflow.retryBaseDelayMs'),
        maxDelayMs: this.config.get('workflow.retryMaxDelayMs'),
        backoffMultiplier: this.config.get('workflow.retryBackoffMultiplier'),
      },
    };
  }

  private setupEventHandlers(): void {
    this.eventBus.subscribe(RuntimeEventTypes.WORKFLOW_STARTED, async (event) => {
      const payload = event.payload as WorkflowStartedPayload;
      this.logger.info('Workflow started', {
        workflowId: payload.workflowId,
        workflowType: payload.workflowType,
      });

      this.stateStore.addEvent(event);
    });

    this.eventBus.subscribe(RuntimeEventTypes.WORKFLOW_COMPLETED, async (event) => {
      const payload = event.payload as WorkflowCompletedPayload;
      this.logger.info('Workflow completed', {
        workflowId: payload.workflowId,
        durationMs: payload.durationMs,
      });

      this.stateStore.addEvent(event);
    });

    this.eventBus.subscribe(RuntimeEventTypes.WORKFLOW_FAILED, async (event) => {
      const payload = event.payload as WorkflowFailedPayload;
      this.logger.error('Workflow failed', {
        workflowId: payload.workflowId,
        error: payload.error,
      });

      this.stateStore.addEvent(event);
    });

    this.eventBus.subscribe(RuntimeEventTypes.TASK_STARTED, async (event) => {
      this.stateStore.addEvent(event);
    });

    this.eventBus.subscribe(RuntimeEventTypes.TASK_COMPLETED, async (event) => {
      this.stateStore.addEvent(event);
    });

    this.eventBus.subscribe(RuntimeEventTypes.TASK_FAILED, async (event) => {
      this.stateStore.addEvent(event);
    });

    this.eventBus.subscribe(RuntimeEventTypes.AGENT_REGISTERED, async (event) => {
      this.stateStore.addEvent(event);
    });

    this.eventBus.subscribe(RuntimeEventTypes.RESEARCH_STARTED, async (event) => {
      this.stateStore.addEvent(event);
    });

    this.eventBus.subscribe(RuntimeEventTypes.RESEARCH_COMPLETED, async (event) => {
      this.stateStore.addEvent(event);
    });

    this.eventBus.subscribe(RuntimeEventTypes.LEAD_FOUND, async (event) => {
      this.stateStore.addEvent(event);
    });

    this.eventBus.subscribe(RuntimeEventTypes.PROPOSAL_GENERATED, async (event) => {
      this.stateStore.addEvent(event);
    });

    this.eventBus.subscribe(RuntimeEventTypes.CHARACTER_EMOTION_CHANGED, async (event) => {
      this.stateStore.addEvent(event);
    });

    this.eventBus.subscribe(RuntimeEventTypes.VOICE_COMMAND, async (event) => {
      this.stateStore.addEvent(event);
    });

    this.eventBus.subscribe(RuntimeEventTypes.DASHBOARD_NOTIFICATION, async (event) => {
      this.stateStore.addEvent(event);
    });
  }

  private emitEvent<T extends Record<string, unknown>>(type: string, payload: T): void {
    const event = createRuntimeEvent(
      type,
      payload as unknown as BaseEventPayload,
      payload.workflowId as string ?? randomUUID(),
      payload.taskId as string ?? randomUUID()
    );
    this.eventBus.publish(event);
  }
}

export function createRuntimeCoordinator(config: RuntimeCoordinatorConfig = {}): RuntimeCoordinator {
  return new RuntimeCoordinator(config);
}