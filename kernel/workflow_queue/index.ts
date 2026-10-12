import { Workflow, TaskPriority } from '../types';
import { IWorkflowQueue } from '../interfaces/IWorkflowQueue';

export class PriorityWorkflowQueue implements IWorkflowQueue {
  private queue: Workflow[] = [];

  public enqueue(workflow: Workflow): void {
    this.queue.push(workflow);
    this.sortQueue();
  }

  public dequeue(): Workflow | undefined {
    return this.queue.shift();
  }

  public peek(): Workflow | undefined {
    return this.queue[0];
  }

  public size(): number {
    return this.queue.length;
  }

  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  public getAll(): Workflow[] {
    return [...this.queue];
  }

  public remove(workflowId: string): boolean {
    const idx = this.queue.findIndex((w) => w.id === workflowId);
    if (idx === -1) return false;
    this.queue.splice(idx, 1);
    return true;
  }

  public clear(): void {
    this.queue = [];
  }

  private sortQueue(): void {
    const priorityOrder: Record<TaskPriority, number> = {
      CRITICAL: 0,
      HIGH: 1,
      NORMAL: 2,
      LOW: 3,
    };

    this.queue.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return (
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }
}
