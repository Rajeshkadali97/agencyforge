import {
  Workflow,
  WorkflowDefinition,
  WorkflowStatus,
  WorkflowHistoryEntry,
  Task,
  TaskResult,
  ExecutionContext,
  RetryPolicy,
} from '../types';
export interface IWorkflowEngine {
  /** Create a workflow from a definition */
  createWorkflow(definition: WorkflowDefinition): Workflow;

  /** Start executing a workflow */
  startWorkflow(workflowId: string): Promise<void>;

  /** Pause a running workflow */
  pauseWorkflow(workflowId: string): boolean;

  /** Resume a paused workflow */
  resumeWorkflow(workflowId: string): Promise<void>;

  /** Cancel a workflow */
  cancelWorkflow(workflowId: string): boolean;

  getWorkflowStatus(workflowId: string): WorkflowStatus;

  /** Get a workflow by ID */
  getWorkflow(workflowId: string): Workflow | undefined;

  /** List all workflows with optional status filter */
  listWorkflows(status?: WorkflowStatus): Workflow[];

  /** Get the execution context for a workflow */
  getExecutionContext(workflowId: string): ExecutionContext | undefined;

  /** Retry a failed workflow or task */
  retry(workflowId: string, taskId?: string): Promise<boolean>;

  /** Set retry policy for a workflow */
  setRetryPolicy(workflowId: string, policy: RetryPolicy): void;

  /** Get workflow history */
  getWorkflowHistory(workflowId: string): WorkflowHistoryEntry[];

  /** Register a callback for workflow lifecycle events */
  onWorkflowEvent(
    workflowId: string,
    event: 'started' | 'completed' | 'failed' | 'cancelled',
    callback: (workflow: Workflow) => void
  ): void;
}
