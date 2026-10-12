import { Workflow, TaskPriority } from '../types';

export interface IWorkflowQueue {
  /** Enqueue a workflow for execution */
  enqueue(workflow: Workflow): void;

  /** Dequeue the next workflow to process */
  dequeue(): Workflow | undefined;

  /** Peek at the next workflow without removing it */
  peek(): Workflow | undefined;

  /** Get the number of workflows in the queue */
  size(): number;

  /** Check if the queue is empty */
  isEmpty(): boolean;

  /** Get all workflows in the queue */
  getAll(): Workflow[];

  /** Remove a specific workflow from the queue */
  remove(workflowId: string): boolean;

  /** Clear all workflows from the queue */
  clear(): void;
}
