import { Task, TaskPriority } from '../types';

export interface IScheduler {
  /** Schedule a task for execution */
  schedule(task: Task): void;

  /** Get the next task to execute based on priority and dependencies */
  next(): Task | undefined;

  /** Check if a task is ready to run (dependencies met) */
  isReady(taskId: string): boolean;

  /** Mark a task as completed, potentially unblocking dependents */
  completeTask(taskId: string): void;

  /** Get all currently scheduled tasks */
  getScheduledTasks(): Task[];

  /** Cancel a scheduled task */
  cancelScheduled(taskId: string): boolean;

  /** Get tasks that are currently blocked by dependencies */
  getBlockedTasks(): Task[];

  /** Get tasks that are ready to execute */
  getReadyTasks(): Task[];

  /** Clear all scheduled tasks */
  clear(): void;
}
