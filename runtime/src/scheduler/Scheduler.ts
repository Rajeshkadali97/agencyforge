import { ILogger } from '../interfaces';
import { EnhancedEventBus } from '../events/EnhancedEventBus';
import { RuntimeEventTypes, createRuntimeEvent, BaseEventPayload } from '../contracts';
import cron from 'node-cron';

export type ScheduleType = 'once' | 'interval' | 'cron';

export interface ScheduleConfig {
  id: string;
  name: string;
  type: ScheduleType;
  handler: () => Promise<void> | void;
  enabled: boolean;
  runAt?: Date;
  intervalMs?: number;
  cronExpression?: string;
  maxRuns?: number;
  runCount: number;
  lastRunAt?: string;
  nextRunAt?: string;
  errorCount: number;
  createdAt: string;
}

export interface SchedulerJobResult {
  jobId: string;
  success: boolean;
  durationMs: number;
  error?: string;
  timestamp: string;
}

export class Scheduler {
  private jobs: Map<string, ScheduleConfig> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private running = false;
  private nextJobId = 0;
  private jobHistory: SchedulerJobResult[] = [];
  private maxHistorySize = 500;
  private tickInterval?: NodeJS.Timeout;
  private cronTasks: Map<string, any> = new Map();

  constructor(
    private eventBus: EnhancedEventBus,
    private logger: ILogger
  ) {}

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.logger.info('Scheduler: Started');

    this.tickInterval = setInterval(() => {
      this.tick();
    }, 1000);
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }

    for (const [id, timer] of this.timers) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    for (const [id, interval] of this.intervals) {
      clearInterval(interval);
      this.intervals.delete(id);
    }

    this.logger.info('Scheduler: Stopped');
  }

  schedule(config: Omit<ScheduleConfig, 'runCount' | 'errorCount' | 'createdAt' | 'lastRunAt' | 'nextRunAt'>): string {
    const id = config.id ?? `job_${++this.nextJobId}_${Date.now()}`;
    const job: ScheduleConfig = {
      ...config,
      id,
      runCount: 0,
      errorCount: 0,
      createdAt: new Date().toISOString(),
      nextRunAt: config.runAt?.toISOString() ?? (config.type === 'interval' ? new Date(Date.now() + (config.intervalMs ?? 0)).toISOString() : undefined),
    };

    this.jobs.set(id, job);

    if (this.running && job.enabled) {
      this.activateJob(job);
    }

    this.logger.info('Scheduler: Job scheduled', { jobId: id, type: config.type, name: config.name });
    return id;
  }

  unschedule(jobId: string): boolean {
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }
    const interval = this.intervals.get(jobId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(jobId);
    }

    const result = this.jobs.delete(jobId);
    if (result) {
      this.logger.info('Scheduler: Job unscheduled', { jobId });
    }
    return result;
  }

  pauseJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.enabled = false;
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }
    const interval = this.intervals.get(jobId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(jobId);
    }
    // Stop cron task if any
    if (job.type === 'cron') {
      const task = this.cronTasks.get(jobId);
      if (task) task.stop();
    }

    return true;
  }

  resumeJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.enabled = true;
    if (job.type === 'cron') {
      const task = this.cronTasks.get(jobId);
      if (task) task.start();
    } else if (this.running) {
      this.activateJob(job);
    }
    return true;
  }

  getJob(jobId: string): ScheduleConfig | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): ScheduleConfig[] {
    return Array.from(this.jobs.values());
  }

  getJobHistory(limit?: number): SchedulerJobResult[] {
    return limit ? this.jobHistory.slice(-limit) : [...this.jobHistory];
  }

  isRunning(): boolean {
    return this.running;
  }

  private activateJob(job: ScheduleConfig): void {
    switch (job.type) {
      case 'once':
        if (job.runAt) {
          const delayMs = job.runAt.getTime() - Date.now();
          if (delayMs <= 0) {
            this.executeJob(job);
          } else {
            const timer = setTimeout(() => this.executeJob(job), delayMs);
            this.timers.set(job.id, timer);
          }
        }
        break;

      case 'interval':
        if (job.intervalMs) {
          const interval = setInterval(() => this.executeJob(job), job.intervalMs);
          this.intervals.set(job.id, interval);
        }
        break;

case 'cron':
          if (job.cronExpression) {
              const task = cron.schedule(job.cronExpression, () => this.executeJob(job), { scheduled: job.enabled } as any);
            this.cronTasks.set(job.id, task);
          }
          break;
    }
  }

  private tick(): void {
    const now = Date.now();
    for (const [, job] of this.jobs) {
      if (!job.enabled) continue;
      if (job.maxRuns !== undefined && job.runCount >= job.maxRuns) continue;

      if (job.type === 'once' && job.runAt) {
        if (now >= job.runAt.getTime() && job.runCount === 0) {
          this.executeJob(job);
        }
      }
    }
  }

  private async executeJob(job: ScheduleConfig): Promise<void> {
    const startTime = Date.now();
    try {
      await job.handler();
      job.runCount++;
      job.lastRunAt = new Date().toISOString();
      job.errorCount = 0;

      if (job.type === 'interval' && job.intervalMs) {
        job.nextRunAt = new Date(Date.now() + job.intervalMs).toISOString();
      }

      this.jobHistory.push({
        jobId: job.id,
        success: true,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      job.errorCount++;
      const errorMessage = err instanceof Error ? err.message : String(err);

      this.jobHistory.push({
        jobId: job.id,
        success: false,
        durationMs: Date.now() - startTime,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      this.logger.error('Scheduler: Job execution failed', {
        jobId: job.id,
        error: errorMessage,
      });

      if (job.errorCount >= 5) {
        job.enabled = false;
        this.logger.warn('Scheduler: Job disabled after 5 consecutive errors', { jobId: job.id });
      }
    }

    if (this.jobHistory.length > this.maxHistorySize) {
      this.jobHistory = this.jobHistory.slice(-this.maxHistorySize);
    }

    if (job.type === 'once') {
      const timer = this.timers.get(job.id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(job.id);
      }
      if (job.maxRuns !== undefined && job.runCount >= job.maxRuns) {
        job.enabled = false;
      }
    }
  }
}
