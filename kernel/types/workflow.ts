// ============================================================
// Workflow Types
// ============================================================
import { Task, TaskGraph, TaskStatus, TaskPriority, TaskResult } from './task.js';

export type WorkflowStatus =
  | 'CREATED'
  | 'PENDING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RETRYING';

export type WorkflowStep = {
  stepId: string;
  taskId: string;
  status: TaskStatus;
  startedAt?: string;
  completedAt?: string;
  result?: TaskResult;
};

export interface Workflow {
  id: string;
  goalId: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  taskGraph: TaskGraph;
  steps: WorkflowStep[];
  currentStepIndex: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  failedAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  priority: TaskPriority;
  executionContext?: ExecutionContext;
}

export interface ExecutionContext {
  workflowId: string;
  goalId: string;
  variables: Map<string, unknown>;
  artifacts: ExecutionArtifact[];
  currentTaskId?: string;
  parentExecutionId?: string;
  startTime: string;
}

export interface ExecutionArtifact {
  id: string;
  type: string;
  data: unknown;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowHistoryEntry {
  id: string;
  workflowId: string;
  timestamp: string;
  action: WorkflowHistoryAction;
  details: Record<string, unknown>;
}

export type WorkflowHistoryAction =
  | 'workflow_created'
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'workflow_cancelled'
  | 'task_assigned'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_retried'
  | 'task_cancelled';

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  tasks: TaskDefinition[];
  retryPolicy?: RetryPolicy;
}

export interface TaskDefinition {
  id: string;
  name: string;
  objective: string;
  requiredCapabilities: string[];
  dependencies: string[];
  priority: TaskPriority;
  retryPolicy?: RetryPolicy;
}
