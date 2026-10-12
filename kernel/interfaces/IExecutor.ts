import { Task, TaskResult } from '../types';

export interface IExecutor {
  /** Execute a single task and return its result */
  execute(task: Task): Promise<TaskResult>;
}
