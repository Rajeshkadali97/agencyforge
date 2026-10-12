import { CancellationToken } from '../utils/cancellation';
import { ILogger } from '../interfaces';
import { ExecutionContext } from '../context';
import { RuntimeEvent, createRuntimeEvent, RuntimeEventTypes } from '../contracts';

export type WorkflowStatus =
  | 'CREATED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'WAITING_FOR_APPROVAL';

export type StepStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'
  | 'WAITING_FOR_APPROVAL'
  | 'RETRYING';

export type StepType = 'sequential' | 'parallel' | 'conditional' | 'approval' | 'retry';

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  execute: (context: ExecutionContext) => Promise<StepResult>;
  // Optional rollback for compensating actions when a workflow fails
  rollback?: (context: ExecutionContext) => Promise<void>;
  dependencies: string[];
  retryPolicy?: RetryPolicy;
  condition?: (context: ExecutionContext) => boolean;
  approvalConfig?: ApprovalConfig;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export interface ApprovalConfig {
  requiredApprovers: string[];
  timeoutMs: number;
  autoApproveOnTimeout?: boolean;
  metadata?: Record<string, unknown>;
}

export interface StepResult {
  success: boolean;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
  nextSteps?: string[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  steps: WorkflowStep[];
  globalTimeoutMs?: number;
  retryPolicy?: RetryPolicy;
}

export interface WorkflowExecution {
  workflowId: string;
  definition: WorkflowDefinition;
  status: WorkflowStatus;
  currentStepId?: string;
  completedSteps: string[];
  failedSteps: string[];
  stepResults: Map<string, StepResult>;
  context: ExecutionContext;
  startTime: Date;
  endTime?: Date;
  error?: string;
  pausedAt?: Date;
  // Optional metrics per step (timestamps in ms)
  stepMetrics?: Record<string, { start: number; end?: number }>;
}

export interface IWorkflowEngine {
  registerWorkflow(definition: WorkflowDefinition): void;
  unregisterWorkflow(workflowId: string): boolean;
  getWorkflow(workflowId: string): WorkflowDefinition | undefined;
  execute(definition: WorkflowDefinition, context: ExecutionContext): Promise<WorkflowExecution>;
  pause(workflowId: string): Promise<void>;
  resume(workflowId: string): Promise<void>;
  cancel(workflowId: string, reason?: string): Promise<void>;
  getExecution(workflowId: string): WorkflowExecution | undefined;
  approveStep(workflowId: string, stepId: string, approved: boolean, comment?: string): Promise<void>;
}

export interface IWorkflowStore {
  save(execution: WorkflowExecution): Promise<void>;
  get(workflowId: string): Promise<WorkflowExecution | undefined>;
  update(execution: WorkflowExecution): Promise<void>;
  list(status?: WorkflowStatus): Promise<WorkflowExecution[]>;
  delete(workflowId: string): Promise<boolean>;
}

export class InMemoryWorkflowStore implements IWorkflowStore {
  private store: Map<string, WorkflowExecution> = new Map();

  async save(execution: WorkflowExecution): Promise<void> {
    this.store.set(execution.workflowId, execution);
  }

  async get(workflowId: string): Promise<WorkflowExecution | undefined> {
    return this.store.get(workflowId);
  }

  async update(execution: WorkflowExecution): Promise<void> {
    this.store.set(execution.workflowId, execution);
  }

  async list(status?: WorkflowStatus): Promise<WorkflowExecution[]> {
    const executions = Array.from(this.store.values());
    if (status) {
      return executions.filter((e) => e.status === status);
    }
    return executions;
  }

  async delete(workflowId: string): Promise<boolean> {
    return this.store.delete(workflowId);
  }
}