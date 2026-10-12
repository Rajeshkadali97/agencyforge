import { Task, TaskStatus, TaskPriority } from '../types';

export interface ITaskQueue {
  enqueue(task: Task): void;
  dequeue(): Task | undefined;
  peek(): Task | undefined;
  cancel(taskId: string): boolean;
  retry(taskId: string): boolean;
  getStatus(taskId: string): TaskStatus | undefined;
  getAllTasks(): Task[];
  getTasksByPriority(priority: TaskPriority): Task[];
  getTasksByStatus(status: TaskStatus): Task[];
  size(): number;
}
