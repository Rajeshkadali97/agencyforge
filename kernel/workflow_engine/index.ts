import { randomUUID } from 'crypto';
import {
  Workflow,
  WorkflowDefinition,
  WorkflowStatus,
  WorkflowStep,
  WorkflowHistoryEntry,
  WorkflowHistoryAction,
  Task,
  TaskStatus,
  TaskResult,
  ExecutionContext,
  RetryPolicy,
  TaskGraph,
} from '../types';
import { IWorkflowEngine } from '../interfaces/IWorkflowEngine';
import { IEventBus } from '../interfaces/IEventBus';
import { ILogger } from '../interfaces/ILogger';
import { IExecutionContextManager } from '../interfaces/IExecutionContext';
import { IAgentRegistry } from '../interfaces/IAgentRegistry';
import { ExecutionContextManager } from '../execution_context';
import { EventBus } from '../event_bus';
import { ConsoleLogger } from '../logging';
import { AgentRegistry } from '../agent_registry';

export class WorkflowEngine implements IWorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();
  private history: Map<string, WorkflowHistoryEntry[]> = new Map();
  private eventCallbacks: Map<
    string,
    Map<string, ((workflow: Workflow) => void)[]>
  > = new Map();
  private retryPolicies: Map<string, RetryPolicy> = new Map();
  private ctxManager: IExecutionContextManager;
  private entryIndex = 0;

  constructor(
    private readonly eventBus: IEventBus = new EventBus(),
    private readonly logger: ILogger = new ConsoleLogger(),
    private readonly agentRegistry: IAgentRegistry = new AgentRegistry(),
    ctxManager?: IExecutionContextManager
  ) {
    this.ctxManager = ctxManager ?? new ExecutionContextManager();
  }

  public createWorkflow(definition: WorkflowDefinition): Workflow {
    const workflowId = randomUUID();
    const now = new Date().toISOString();

    const steps: WorkflowStep[] = definition.tasks.map((taskDef) => ({
      stepId: randomUUID(),
      taskId: taskDef.id,
      status: 'CREATED' as TaskStatus,
    }));

    const taskGraph: TaskGraph = {
      id: randomUUID(),
      goal_id: workflowId,
      tasks: definition.tasks.map((td) => ({
        id: td.id,
        objective: td.objective,
        required_capabilities: td.requiredCapabilities,
        dependencies: td.dependencies,
        status: 'CREATED' as TaskStatus,
        priority: td.priority,
        retry_count: 0,
        max_retries: td.retryPolicy?.maxRetries ?? 3,
        created_at: now,
      })),
      root_task_id: definition.tasks[0]?.id ?? '',
      created_at: now,
    };

    const workflow: Workflow = {
      id: workflowId,
      goalId: workflowId,
      name: definition.name,
      description: definition.description,
      status: 'CREATED',
      taskGraph,
      steps,
      currentStepIndex: 0,
      createdAt: now,
      priority: definition.tasks[0]?.priority ?? 'NORMAL',
    };

    this.workflows.set(workflowId, workflow);
    this.history.set(workflowId, []);

    if (definition.retryPolicy) {
      this.retryPolicies.set(workflowId, definition.retryPolicy);
    }

    this.recordHistory(workflowId, 'workflow_created', {
      workflowId,
      name: definition.name,
    });

    this.eventBus.emit('workflow.created', {
      workflow_id: workflowId,
      name: definition.name,
    });

    return workflow;
  }

  public async startWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = 'RUNNING';
    workflow.startedAt = new Date().toISOString();

    this.ctxManager.createContext(workflowId, workflow.goalId);
    workflow.executionContext = this.ctxManager.getContext(workflowId);

    this.recordHistory(workflowId, 'workflow_started', {
      workflowId,
      startedAt: workflow.startedAt,
    });

    this.eventBus.emit('workflow.started', {
      workflow_id: workflowId,
      name: workflow.name,
    });

    this.logger.info('Workflow started', {
      workflowId,
      name: workflow.name,
    });

    await this.executeSteps(workflowId);
  }

  public pauseWorkflow(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'RUNNING') {
      return false;
    }
    workflow.status = 'PAUSED';
    this.eventBus.emit('workflow.paused', { workflow_id: workflowId });
    this.logger.info('Workflow paused', { workflowId });
    return true;
  }

  public async resumeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'PAUSED') {
      throw new Error(`Cannot resume workflow ${workflowId}: not in PAUSED status`);
    }
    workflow.status = 'RUNNING';
    this.eventBus.emit('workflow.resumed', { workflow_id: workflowId });
    this.logger.info('Workflow resumed', { workflowId });
    await this.executeSteps(workflowId);
  }

  public cancelWorkflow(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return false;
    }

    const cancelledAt = new Date().toISOString();
    workflow.status = 'CANCELLED';
    workflow.cancelledAt = cancelledAt;

    this.recordHistory(workflowId, 'workflow_cancelled', {
      workflowId,
      cancelledAt,
    });

    this.eventBus.emit('workflow.cancelled', {
      workflow_id: workflowId,
      reason: 'User cancelled',
    });

    const callbacks = this.eventCallbacks.get(workflowId)?.get('cancelled');
    if (callbacks) {
      for (const cb of callbacks) {
        cb(workflow);
      }
    }

    this.logger.info('Workflow cancelled', { workflowId });
    return true;
  }

  public getWorkflowStatus(workflowId: string): WorkflowStatus {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    return workflow.status;
  }

  public getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  public listWorkflows(status?: WorkflowStatus): Workflow[] {
    const workflows = Array.from(this.workflows.values());
    if (status) {
      return workflows.filter((w) => w.status === status);
    }
    return workflows;
  }

  public getExecutionContext(workflowId: string): ExecutionContext | undefined {
    return this.ctxManager.getContext(workflowId);
  }

  public async retry(workflowId: string, taskId?: string): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    const policy = this.retryPolicies.get(workflowId);
    const maxRetries = policy?.maxRetries ?? 3;

    if (taskId) {
      const step = workflow.steps.find((s) => s.taskId === taskId);
      if (!step) return false;

      const task = workflow.taskGraph.tasks.find((t) => t.id === taskId);
      if (!task) return false;

      if (task.retry_count >= maxRetries) {
        this.logger.warning('Task exceeded max retries', {
          workflowId,
          taskId,
          retryCount: task.retry_count,
        });
        return false;
      }

      task.retry_count += 1;
      task.status = 'PENDING';
      step.status = 'PENDING';

      this.recordHistory(workflowId, 'task_retried', {
        workflowId,
        taskId,
        retryCount: task.retry_count,
      });

      this.eventBus.emit('task.retrying', {
        workflow_id: workflowId,
        task_id: taskId,
      });

      this.logger.info('Retrying task', { workflowId, taskId });

      if (workflow.status !== 'RUNNING') {
        workflow.status = 'RUNNING';
      }
      await this.executeSingleTask(workflowId, task);
      return true;
    }

    workflow.status = 'RETRYING';
    this.recordHistory(workflowId, 'workflow_failed', {
      workflowId,
      reason: 'Retrying entire workflow',
    });
    return true;
  }

  public setRetryPolicy(workflowId: string, policy: RetryPolicy): void {
    this.retryPolicies.set(workflowId, policy);
  }

  public getWorkflowHistory(workflowId: string): WorkflowHistoryEntry[] {
    return this.history.get(workflowId) ?? [];
  }

  public onWorkflowEvent(
    workflowId: string,
    event: 'started' | 'completed' | 'failed' | 'cancelled',
    callback: (workflow: Workflow) => void
  ): void {
    if (!this.eventCallbacks.has(workflowId)) {
      this.eventCallbacks.set(workflowId, new Map());
    }
    const callbacks = this.eventCallbacks.get(workflowId)!;
    const existing = callbacks.get(event) ?? [];
    existing.push(callback);
    callbacks.set(event, existing);
  }

  private async executeSteps(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'RUNNING') {
      return;
    }

    for (let i = workflow.currentStepIndex; i < workflow.steps.length; i++) {
      if (workflow.status !== 'RUNNING') {
        workflow.currentStepIndex = i;
        return;
      }

      const step = workflow.steps[i];
      const task = workflow.taskGraph.tasks.find((t) => t.id === step.taskId);
      if (!task) {
        await this.failWorkflow(workflowId, `Task ${step.taskId} not found`);
        return;
      }

      workflow.currentStepIndex = i + 1;
      await this.executeSingleTask(workflowId, task);

      if (task.status === 'FAILED') {
        const policy = this.retryPolicies.get(workflowId);
        const maxRetries = policy?.maxRetries ?? task.max_retries;
        if (task.retry_count < maxRetries) {
          task.retry_count += 1;
          task.status = 'PENDING';
          this.recordHistory(workflowId, 'task_retried', {
            workflowId,
            taskId: task.id,
            retryCount: task.retry_count,
          });
          this.eventBus.emit('task.retrying', {
            workflow_id: workflowId,
            task_id: task.id,
          });
          i--;
          workflow.currentStepIndex = i + 1;
          const delay = this.computeDelay(task.retry_count, policy);
          if (delay > 0) {
            await this.sleep(delay);
          }
          continue;
        }
        await this.failWorkflow(workflowId, `Task ${task.id} failed after ${task.retry_count} retries`);
        return;
      }
    }

    if (workflow.status === 'RUNNING') {
      await this.completeWorkflow(workflowId);
    }
  }

  private async executeSingleTask(
    workflowId: string,
    task: Task
  ): Promise<void> {
    const workflow = this.workflows.get(workflowId)!;
    const step = workflow.steps.find((s) => s.taskId === task.id)!;

    task.status = 'RUNNING';
    task.started_at = new Date().toISOString();
    step.status = 'RUNNING';
    step.startedAt = task.started_at;

    workflow.executionContext = this.ctxManager.getContext(workflowId);
    if (workflow.executionContext) {
      workflow.executionContext.currentTaskId = task.id;
    }

    this.assignAgent(task);

    this.recordHistory(workflowId, 'task_assigned', {
      workflowId,
      taskId: task.id,
      agentId: task.assigned_agent_id,
    });

    this.eventBus.emit('task.assigned', {
      workflow_id: workflowId,
      task_id: task.id,
      agent_id: task.assigned_agent_id,
    });

    this.recordHistory(workflowId, 'task_started', {
      workflowId,
      taskId: task.id,
    });

    this.eventBus.emit('task.started', {
      workflow_id: workflowId,
      task_id: task.id,
    });

    try {
      const result: TaskResult = {
        success: true,
        output: `Task "${task.objective}" completed by ${task.assigned_agent_id ?? 'system'}`,
        metadata: { taskId: task.id, agentId: task.assigned_agent_id },
      };

      task.status = 'COMPLETED';
      task.completed_at = new Date().toISOString();
      task.result = result;
      step.status = 'COMPLETED';
      step.completedAt = task.completed_at;
      step.result = result;

      this.ctxManager.storeTaskResult(workflowId, task, result);

      this.recordHistory(workflowId, 'task_completed', {
        workflowId,
        taskId: task.id,
        success: true,
      });

      this.eventBus.emit('task.completed', {
        workflow_id: workflowId,
        task_id: task.id,
        success: true,
        output: result.output,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      task.status = 'FAILED';
      task.completed_at = new Date().toISOString();
      task.result = { success: false, error: errorMessage };
      step.status = 'FAILED';
      step.completedAt = task.completed_at;

      this.recordHistory(workflowId, 'task_failed', {
        workflowId,
        taskId: task.id,
        error: errorMessage,
      });

      this.eventBus.emit('task.failed', {
        workflow_id: workflowId,
        task_id: task.id,
        error: errorMessage,
      });
    }
  }

  private assignAgent(task: Task): void {
    if (task.assigned_agent_id) return;
    for (const cap of task.required_capabilities) {
      const candidates = this.agentRegistry.listAgentsByCapability(cap);
      if (candidates.length > 0) {
        task.assigned_agent_id = candidates[0].agent_id;
        return;
      }
    }
  }

  private async completeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'COMPLETED';
    workflow.completedAt = new Date().toISOString();

    const ctx = this.ctxManager.deliverContext(workflowId);
    if (ctx) {
      workflow.executionContext = ctx;
    }

    this.recordHistory(workflowId, 'workflow_completed', {
      workflowId,
      completedAt: workflow.completedAt,
    });

    this.eventBus.emit('workflow.completed', {
      workflow_id: workflowId,
      name: workflow.name,
    });

    const callbacks = this.eventCallbacks.get(workflowId)?.get('completed');
    if (callbacks) {
      for (const cb of callbacks) {
        cb(workflow);
      }
    }

    this.logger.info('Workflow completed', { workflowId });
  }

  private async failWorkflow(workflowId: string, error: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'FAILED';
    workflow.failedAt = new Date().toISOString();
    workflow.error = error;

    this.recordHistory(workflowId, 'workflow_failed', {
      workflowId,
      error,
    });

    this.eventBus.emit('workflow.failed', {
      workflow_id: workflowId,
      error,
    });

    const callbacks = this.eventCallbacks.get(workflowId)?.get('failed');
    if (callbacks) {
      for (const cb of callbacks) {
        cb(workflow);
      }
    }

    this.logger.error('Workflow failed', { workflowId, error });
  }

  private recordHistory(
    workflowId: string,
    action: WorkflowHistoryAction,
    details: Record<string, unknown>
  ): void {
    const entries = this.history.get(workflowId);
    if (!entries) return;

    const entry: WorkflowHistoryEntry = {
      id: `hist_${++this.entryIndex}`,
      workflowId,
      timestamp: new Date().toISOString(),
      action,
      details,
    };
    entries.push(entry);
  }

  private computeDelay(retryCount: number, policy?: RetryPolicy): number {
    if (!policy) return 0;
    const base = policy.baseDelayMs;
    switch (policy.backoffStrategy) {
      case 'fixed':
        return base;
      case 'linear':
        return base * retryCount;
      case 'exponential':
        return Math.min(base * Math.pow(2, retryCount - 1), policy.maxDelayMs);
      default:
        return base;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
