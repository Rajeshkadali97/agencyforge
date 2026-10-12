/**
 * AutomationEngine coordinates automation tasks using node‑cron.
 * It registers tasks, schedules them via cron expressions, and provides
 * lifecycle methods for task management.
 */
import cron from 'node-cron';

export interface AutomationTask {
  id: string;
  schedule: string;
  action: () => Promise<void>;
}

interface MinimalLogger {
  error(msg: string, meta?: Record<string, unknown>): void;
}

export class AutomationEngine {
  private tasks: Map<string, AutomationTask> = new Map();
  private cronTasks: Map<string, any> = new Map();
  private logger?: MinimalLogger;

  constructor(logger?: MinimalLogger) {
    this.logger = logger;
  }

  register(task: AutomationTask): void {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task ${task.id} already registered`);
    }
    this.tasks.set(task.id, task);
    if (task.schedule) {
      try {
        const cronTask = cron.schedule(task.schedule, () => {
          task.action().catch(err => this.logger?.error('AutomationEngine: Task error', { taskId: task.id, error: String(err) }));
        });
        this.cronTasks.set(task.id, cronTask);
      } catch (e) {
        this.logger?.error('AutomationEngine: Failed to schedule task', { taskId: task.id, error: String(e) });
      }
    }
  }

  unregister(taskId: string): void {
    this.tasks.delete(taskId);
    const cronTask = this.cronTasks.get(taskId);
    if (cronTask) {
      cronTask.stop();
      this.cronTasks.delete(taskId);
    }
  }

  list(): AutomationTask[] {
    return Array.from(this.tasks.values());
  }
}
