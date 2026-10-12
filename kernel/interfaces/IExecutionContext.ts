import { ExecutionContext, ExecutionArtifact, Task, TaskResult } from '../types';

export interface IExecutionContextManager {
  /** Create a new execution context for a workflow */
  createContext(workflowId: string, goalId: string, parentId?: string): ExecutionContext;

  /** Get an execution context by workflow ID */
  getContext(workflowId: string): ExecutionContext | undefined;

  /** Update a variable in the execution context */
  setVariable(workflowId: string, key: string, value: unknown): void;

  /** Get a variable from the execution context */
  getVariable(workflowId: string, key: string): unknown | undefined;

  /** Add an artifact to the execution context */
  addArtifact(workflowId: string, artifact: ExecutionArtifact): void;

  /** Get all artifacts from the execution context */
  getArtifacts(workflowId: string): ExecutionArtifact[];

  /** Store the result of a task in the context */
  storeTaskResult(workflowId: string, task: Task, result: TaskResult): void;

  /** Deliver the final execution context when workflow completes */
  deliverContext(workflowId: string): ExecutionContext | undefined;

  /** Clean up a context when workflow is done */
  disposeContext(workflowId: string): void;
}
