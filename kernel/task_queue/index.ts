import { Task, TaskStatus, TaskPriority } from '../types';
import { ITaskQueue } from '../interfaces/ITaskQueue';

export class TaskQueue implements ITaskQueue {
  private tasks: Task[] = [];

  public enqueue(task: Task): void {
    this.tasks.push(task);
    this.sortQueue();
  }

  public dequeue(): Task | undefined {
    return this.tasks.shift();
  }

  public peek(): Task | undefined {
    return this.tasks[0];
  }

  public cancel(taskId: string): boolean {
    const idx = this.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return false;
    this.tasks.splice(idx, 1);
    return true;
  }

  public retry(taskId: string): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return false;
    if (task.retry_count >= task.max_retries) return false;

    task.retry_count += 1;
    task.status = 'PENDING';
    this.sortQueue();
    return true;
  }

  public getStatus(taskId: string): TaskStatus | undefined {
    const task = this.tasks.find((t) => t.id === taskId);
    return task?.status;
  }

  public getAllTasks(): Task[] {
    return [...this.tasks];
  }

  public getTasksByPriority(priority: TaskPriority): Task[] {
    return this.tasks.filter((t) => t.priority === priority);
  }

  public getTasksByStatus(status: TaskStatus): Task[] {
    return this.tasks.filter((t) => t.status === status);
  }

  public size(): number {
    return this.tasks.length;
  }

  private sortQueue(): void {
    const priorityOrder: Record<TaskPriority, number> = {
      CRITICAL: 0,
      HIGH: 1,
      NORMAL: 2,
      LOW: 3,
    };

    this.tasks.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }
}
