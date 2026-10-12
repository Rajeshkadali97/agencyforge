import { randomUUID } from 'crypto';
import { ILogger } from '../interfaces';
import { ExecutionContext } from '../context';
import { IEventBus } from '../interfaces';
import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStatus,
  StepStatus,
  StepResult,
  WorkflowStep,
  IWorkflowEngine,
  IWorkflowStore,
  RetryPolicy,
  ApprovalConfig,
} from './WorkflowEngine';
import { RuntimeEventTypes, createRuntimeEvent, BaseEventPayload } from '../contracts';

export class WorkflowEngine implements IWorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private store: IWorkflowStore;
  private eventBus: IEventBus;
  private logger: ILogger;
  private defaultRetryPolicy: RetryPolicy = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  };

  constructor(store: IWorkflowStore, eventBus: IEventBus, logger: ILogger) {
    this.store = store;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  registerWorkflow(definition: WorkflowDefinition): void {
    this.workflows.set(definition.id, definition);
    this.logger.info('Workflow registered', { workflowId: definition.id, name: definition.name });
  }

  unregisterWorkflow(workflowId: string): boolean {
    return this.workflows.delete(workflowId);
  }

  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  async execute(definition: WorkflowDefinition, context: ExecutionContext): Promise<WorkflowExecution> {
    const workflowId = `wf_${randomUUID()}`;
    const execution: WorkflowExecution = {
      workflowId,
      definition,
      status: 'CREATED',
      completedSteps: [],
      failedSteps: [],
      stepResults: new Map(),
      context,
      startTime: new Date(),
    };

    this.executions.set(workflowId, execution);
    await this.store.save(execution);

    this.emitWorkflowEvent(workflowId, RuntimeEventTypes.WORKFLOW_STARTED, {
      workflowId,
      workflowName: definition.name,
      traceId: context.workflowId,
      spanId: context.taskId,
    });

    context.cancellationToken.onCancelled(() => {
      this.cancel(workflowId, 'Cancelled by context').catch((err) =>
        this.logger.error('Error cancelling workflow', { error: err })
      );
    });

    try {
      execution.status = 'RUNNING';
      await this.store.update(execution);

      const sortedSteps = this.topologicalSort(definition.steps);
      const stepMap = new Map(definition.steps.map((s) => [s.id, s]));

// Execute steps respecting dependencies, allowing parallel execution where possible.
        const remainingSteps = new Map(sortedSteps.map(s => [s.id, s]));
        const executedStepIds = new Set<string>();
        const stepMetrics: Record<string, { start: number; end?: number }> = {};
        
        while (remainingSteps.size > 0) {
          if (context.cancellationToken.isCancelled) {
            execution.status = 'CANCELLED';
            execution.error = 'Cancelled';
            break;
          }
          // Determine steps whose dependencies are satisfied and not yet executed
          const readySteps: WorkflowStep[] = [];
          for (const [id, step] of remainingSteps.entries()) {
            const depsMet = step.dependencies.every(dep => executedStepIds.has(dep));
            if (depsMet) readySteps.push(step);
          }
          if (readySteps.length === 0) {
            // Circular dependency or unsatisfiable
            execution.status = 'FAILED';
            execution.error = 'Unresolvable dependencies among remaining steps';
            break;
          }
          // Execute all ready steps concurrently (Promise.all)
          const stepPromises = readySteps.map(async (step) => {
            const stepStart = Date.now();
            stepMetrics[step.id] = { start: stepStart };
            const result = await this.executeStep(step, execution, context);
            stepMetrics[step.id].end = Date.now();
            execution.stepResults.set(step.id, result);
            if (result.success) {
              execution.completedSteps.push(step.id);
            } else {
              execution.failedSteps.push(step.id);
            }
            // Remove from remainingSteps and mark as executed
            remainingSteps.delete(step.id);
            executedStepIds.add(step.id);
            return { step, result };
          });
          const stepResults = await Promise.all(stepPromises);
          // Handle failures and retry logic per step
          for (const { step, result } of stepResults) {
            if (!result.success) {
              const retryPolicy = step.retryPolicy ?? definition.retryPolicy ?? this.defaultRetryPolicy;
              const shouldRetry = await this.handleRetry(step, execution, context, retryPolicy);
              if (!shouldRetry) {
                execution.status = 'FAILED';
                execution.error = result.error || `Step ${step.name} failed`;
                break;
              }
            }
          }
          await this.store.update(execution);
          if (execution.status === 'FAILED') break;
        }
        // If workflow failed, attempt rollback on completed steps in reverse order
        if (execution.status === 'FAILED') {
          // Store step execution metrics for observability
          execution.stepMetrics = stepMetrics;
          for (let i = execution.completedSteps.length - 1; i >= 0; i--) {
            const stepId = execution.completedSteps[i];
            const step = definition.steps.find(s => s.id === stepId);
            if (step && step.rollback) {
              try {
                await step.rollback(context);
                this.logger.info('Rollback succeeded', { stepId });
              } catch (rbErr) {
                this.logger.error('Rollback failed', { stepId, error: rbErr instanceof Error ? rbErr.message : String(rbErr) });
              }
            }
          }
        }


      if (execution.status === 'RUNNING') {
        execution.status = 'COMPLETED';
        this.emitWorkflowEvent(workflowId, RuntimeEventTypes.WORKFLOW_COMPLETED, {
          workflowId,
          workflowName: definition.name,
          traceId: context.workflowId,
          spanId: context.taskId,
        });
      }
    } catch (error) {
      execution.status = 'FAILED';
      execution.error = error instanceof Error ? error.message : String(error);
      this.emitWorkflowEvent(workflowId, RuntimeEventTypes.WORKFLOW_FAILED, {
        workflowId,
        workflowName: definition.name,
        error: execution.error,
        traceId: context.workflowId,
        spanId: context.taskId,
      });
    } finally {
      execution.endTime = new Date();
      await this.store.update(execution);
    }

    return execution;
  }

  private async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    context: ExecutionContext
  ): Promise<StepResult> {
    execution.currentStepId = step.id;

    this.emitWorkflowEvent(execution.workflowId, RuntimeEventTypes.TASK_STARTED, {
      workflowId: execution.workflowId,
      stepId: step.id,
      stepName: step.name,
      traceId: context.workflowId,
      spanId: context.taskId,
    });

    this.logger.info('Executing workflow step', {
      workflowId: execution.workflowId,
      stepId: step.id,
      stepName: step.name,
    });

    const stepContext = this.createStepContext(context, step);

    try {
      let result: StepResult;

      switch (step.type) {
        case 'sequential':
        case 'parallel':
          result = await step.execute(stepContext);
          break;
        case 'conditional':
          if (step.condition && !step.condition(stepContext)) {
            result = { success: true, output: 'Condition not met, step skipped' };
          } else {
            result = await step.execute(stepContext);
          }
          break;
        case 'approval':
          result = await this.executeApprovalStep(step, stepContext, execution);
          break;
        case 'retry':
          result = await this.executeWithRetry(step, stepContext, execution);
          break;
        default:
          result = await step.execute(stepContext);
      }

      if (result.success) {
        this.emitWorkflowEvent(execution.workflowId, RuntimeEventTypes.TASK_COMPLETED, {
          workflowId: execution.workflowId,
          stepId: step.id,
          stepName: step.name,
          output: result.output,
          traceId: context.workflowId,
          spanId: context.taskId,
        });
      } else {
        this.emitWorkflowEvent(execution.workflowId, RuntimeEventTypes.TASK_FAILED, {
          workflowId: execution.workflowId,
          stepId: step.id,
          stepName: step.name,
          error: result.error,
          traceId: context.workflowId,
          spanId: context.taskId,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private createStepContext(context: ExecutionContext, step: WorkflowStep): ExecutionContext {
    return {
      ...context,
      metadata: {
        ...context.metadata,
        currentStep: step.id,
        currentStepName: step.name,
        stepType: step.type,
      },
    };
  }

  private async executeApprovalStep(
    step: WorkflowStep,
    context: ExecutionContext,
    execution: WorkflowExecution
  ): Promise<StepResult> {
    const approvalConfig = step.approvalConfig!;

    this.emitWorkflowEvent(execution.workflowId, RuntimeEventTypes.CHECKPOINT_APPROVAL, {
      workflowId: execution.workflowId,
      stepId: step.id,
      stepName: step.name,
      requiredApprovers: approvalConfig.requiredApprovers,
      timeoutMs: approvalConfig.timeoutMs,
      traceId: context.workflowId,
      spanId: context.taskId,
    });

    execution.status = 'WAITING_FOR_APPROVAL';
    execution.pausedAt = new Date();
    await this.store.update(execution);

    return new Promise<StepResult>((resolve) => {
      let settled = false;
      let handlerId = '';
      let removeCancelListener: () => void = () => {};

      const settle = (result: StepResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.eventBus.unsubscribe(handlerId);
        removeCancelListener();
        resolve(result);
      };

      const timeout = setTimeout(() => {
        if (approvalConfig.autoApproveOnTimeout) {
          settle({ success: true, output: 'Auto-approved on timeout' });
        } else {
          settle({ success: false, error: 'Approval timeout' });
        }
      }, approvalConfig.timeoutMs);

      const handler = async (event: { type: string; payload: { workflowId: string; stepId: string; approved: boolean } }) => {
        if (event.payload.workflowId === execution.workflowId && event.payload.stepId === step.id) {
          settle({
            success: event.payload.approved,
            output: event.payload.approved ? 'Approved' : 'Rejected',
            error: event.payload.approved ? undefined : 'Rejected by approver',
          });
        }
      };

      handlerId = this.eventBus.subscribe(RuntimeEventTypes.CHECKPOINT_APPROVED, handler);
      // Release timeout + subscription immediately when the workflow is cancelled
      removeCancelListener = context.cancellationToken.onCancelled(() => {
        settle({ success: false, error: 'Approval cancelled' });
      });
    });
  }

  private async executeWithRetry(
    step: WorkflowStep,
    context: ExecutionContext,
    execution: WorkflowExecution
  ): Promise<StepResult> {
    const retryPolicy = step.retryPolicy ?? this.defaultRetryPolicy;
    let attempt = 0;
    let lastError: string | undefined;

    while (attempt <= retryPolicy.maxRetries) {
      if (context.cancellationToken.isCancelled) {
        return { success: false, error: 'Cancelled during retry' };
      }

      const result = await step.execute(context);

      if (result.success) {
        return result;
      }

      lastError = result.error;
      attempt++;

      if (attempt <= retryPolicy.maxRetries) {
        const delay = Math.min(
          retryPolicy.baseDelayMs * Math.pow(retryPolicy.backoffMultiplier, attempt - 1),
          retryPolicy.maxDelayMs
        );

        this.emitWorkflowEvent(execution.workflowId, RuntimeEventTypes.TASK_RETRYING, {
          workflowId: execution.workflowId,
          stepId: step.id,
          attempt,
          maxRetries: retryPolicy.maxRetries,
          delayMs: delay,
          traceId: context.workflowId,
          spanId: context.taskId,
        });

        await this.sleep(delay);
      }
    }

    return { success: false, error: lastError };
  }

  private async handleRetry(
    step: WorkflowStep,
    execution: WorkflowExecution,
    _context: ExecutionContext,
    _retryPolicy: RetryPolicy
  ): Promise<boolean> {
    // Step is already removed from remainingSteps when this is called — returning true
    // would suppress the failure without re-running the step (silent success bug).
    // Actual retry logic lives in executeWithRetry() for type:'retry' steps.
    // Always return false so failures propagate to workflow status correctly.
    const stepResult = execution.stepResults.get(step.id);
    if (!stepResult || stepResult.success) return false;
    return false;
  }

  private canExecuteStep(step: WorkflowStep, execution: WorkflowExecution): boolean {
    return step.dependencies.every((depId) => execution.completedSteps.includes(depId));
  }

  private topologicalSort(steps: WorkflowStep[]): WorkflowStep[] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const result: WorkflowStep[] = [];
    const stepMap = new Map(steps.map((s) => [s.id, s]));

    const visit = (id: string) => {
      if (temp.has(id)) {
        throw new Error(`Circular dependency detected: ${id}`);
      }
      if (visited.has(id)) return;

      temp.add(id);
      const step = stepMap.get(id);
      if (step) {
        for (const dep of step.dependencies) {
          visit(dep);
        }
      }
      temp.delete(id);
      visited.add(id);
      result.push(step!);
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        visit(step.id);
      }
    }

    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async pause(workflowId: string): Promise<void> {
    const execution = this.executions.get(workflowId);
    if (execution && execution.status === 'RUNNING') {
      execution.status = 'PAUSED';
      execution.pausedAt = new Date();
      execution.context.cancellationToken.cancel('Paused by user');
      await this.store.update(execution);
      this.emitWorkflowEvent(workflowId, RuntimeEventTypes.WORKFLOW_PAUSED, {
        workflowId,
        traceId: execution.context.workflowId,
        spanId: execution.context.taskId,
      });
    }
  }

  async resume(workflowId: string): Promise<void> {
    const execution = this.executions.get(workflowId);
    if (execution && execution.status === 'PAUSED') {
      execution.status = 'RUNNING';
      execution.pausedAt = undefined;
      execution.context.cancellationToken = new (await import('../utils/cancellation')).CancellationToken();
      await this.store.update(execution);
      this.emitWorkflowEvent(workflowId, RuntimeEventTypes.WORKFLOW_RESUMED, {
        workflowId,
        traceId: execution.context.workflowId,
        spanId: execution.context.taskId,
      });
    }
  }

  async cancel(workflowId: string, reason?: string): Promise<void> {
    const execution = this.executions.get(workflowId);
    if (execution && ['CREATED', 'RUNNING', 'PAUSED', 'WAITING_FOR_APPROVAL'].includes(execution.status)) {
      execution.status = 'CANCELLED';
      execution.error = reason || 'Cancelled';
      execution.endTime = new Date();
      execution.context.cancellationToken.cancel(reason);
      await this.store.update(execution);
      this.emitWorkflowEvent(workflowId, RuntimeEventTypes.WORKFLOW_CANCELLED, {
        workflowId,
        reason,
        traceId: execution.context.workflowId,
        spanId: execution.context.taskId,
      });
    }
  }

  async approveStep(
    workflowId: string,
    stepId: string,
    approved: boolean,
    comment?: string
  ): Promise<void> {
    const execution = this.executions.get(workflowId);
    if (execution && execution.status === 'WAITING_FOR_APPROVAL') {
      const event = createRuntimeEvent(RuntimeEventTypes.CHECKPOINT_APPROVED, {
        workflowId,
        stepId,
        approved,
        comment,
        taskId: execution.context.taskId,
      } as unknown as BaseEventPayload, execution.context.workflowId, execution.context.taskId);
      this.eventBus.publish({
        type: event.type,
        payload: event.payload as unknown as Record<string, unknown>,
        traceId: event.traceId,
        spanId: event.spanId,
      });
    }
  }

  getExecution(workflowId: string): WorkflowExecution | undefined {
    return this.executions.get(workflowId);
  }

  private emitWorkflowEvent(workflowId: string, type: string, payload: Record<string, unknown>): void {
    const execution = this.executions.get(workflowId);
    const traceId = execution?.context.workflowId || workflowId;
    const spanId = execution?.context.taskId || workflowId;

    const event = createRuntimeEvent(type, payload as unknown as BaseEventPayload, traceId, spanId);
    this.eventBus.publish({
      type: event.type,
      payload: event.payload as unknown as Record<string, unknown>,
      traceId: event.traceId,
      spanId: event.spanId,
    });
  }
}