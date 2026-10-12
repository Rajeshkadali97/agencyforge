import { Task, TaskResult } from '../types';
import { IExecutor } from '../interfaces/IExecutor';
import { IAgentRegistry } from '../interfaces/IAgentRegistry';
import { IEventBus } from '../interfaces/IEventBus';
import { ILogger } from '../interfaces/ILogger';

export class BasicExecutor implements IExecutor {
  constructor(
    private readonly agentRegistry: IAgentRegistry,
    private readonly eventBus: IEventBus,
    private readonly logger: ILogger
  ) {}

  public async execute(task: Task): Promise<TaskResult> {
    if (!task.assigned_agent_id) {
      const requiredCap = task.required_capabilities[0];
      if (requiredCap) {
        const candidates = this.agentRegistry.listAgentsByCapability(requiredCap);
        if (candidates.length > 0) {
          task.assigned_agent_id = candidates[0].agent_id;
        }
      }
    }

    const taskLogger = this.logger.child({
      task_id: task.id,
      agent_id: task.assigned_agent_id,
    });

    this.eventBus.emit('task.started', {
      task_id: task.id,
      agent_id: task.assigned_agent_id,
    });

    taskLogger.info('Starting task execution');

    try {
      const result: TaskResult = {
        success: true,
        output: `Task ${task.id} completed by ${task.assigned_agent_id ?? 'system'}`,
        metadata: {
          task_id: task.id,
          assigned_agent: task.assigned_agent_id,
        },
      };

      this.eventBus.emit('task.completed', {
        task_id: task.id,
        success: true,
        output: result.output,
      });

      taskLogger.info('Task execution completed');
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      taskLogger.error('Task execution failed', { error: errorMessage });
      this.eventBus.emit('task.failed', {
        task_id: task.id,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }
}
