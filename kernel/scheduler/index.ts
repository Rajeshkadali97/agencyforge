import { Task, TaskStatus } from '../types';
import { IScheduler } from '../interfaces/IScheduler';

export class DependencyAwareScheduler implements IScheduler {
  private tasks: Map<string, Task> = new Map();
  private completedTasks: Set<string> = new Set();

  public schedule(task: Task): void {
    this.tasks.set(task.id, task);
  }

  public next(): Task | undefined {
    for (const task of this.tasks.values()) {
      if (this.isReady(task.id) && task.status !== 'RUNNING') {
        return task;
      }
    }
    return undefined;
  }

  public isReady(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'COMPLETED' || task.status === 'RUNNING') {
      return false;
    }

    return task.dependencies.every((depId) =>
      this.completedTasks.has(depId)
    );
  }

  public completeTask(taskId: string): void {
    this.completedTasks.add(taskId);
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'COMPLETED';
    }
  }

  public getScheduledTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  public cancelScheduled(taskId: string): boolean {
    return this.tasks.delete(taskId);
  }

  public getBlockedTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(
      (task) => !this.isReady(task.id) && !this.completedTasks.has(task.id)
    );
  }

  public getReadyTasks(): Task[] {
    return Array.from(this.tasks.values()).filter((task) =>
      this.isReady(task.id)
    );
  }

  public clear(): void {
    this.tasks.clear();
    this.completedTasks.clear();
  }
}
