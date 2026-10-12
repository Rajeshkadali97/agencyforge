import { Goal, TaskGraph, Task, TaskDefinition, WorkflowDefinition, RetryPolicy } from '../types/index.js';
import { IPlanner } from '../interfaces/IPlanner.js';
import { randomUUID } from 'crypto';

interface PlanningPattern {
  keywords: string[];
  taskTemplates: TaskDefinition[];
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  backoffStrategy: 'exponential',
  baseDelayMs: 100,
  maxDelayMs: 5000,
};

const planningPatterns: PlanningPattern[] = [
  {
    keywords: ['find', 'search', 'locate', 'discover'],
    taskTemplates: [
      {
        id: '',
        name: 'search',
        objective: '',
        requiredCapabilities: ['web_search'],
        dependencies: [],
        priority: 'HIGH',
        retryPolicy: DEFAULT_RETRY_POLICY,
      },
      {
        id: '',
        name: 'analyze',
        objective: '',
        requiredCapabilities: ['data_analysis'],
        dependencies: [],
        priority: 'NORMAL',
        retryPolicy: DEFAULT_RETRY_POLICY,
      },
      {
        id: '',
        name: 'compile',
        objective: '',
        requiredCapabilities: ['compilation'],
        dependencies: [],
        priority: 'NORMAL',
        retryPolicy: DEFAULT_RETRY_POLICY,
      },
    ],
  },
  {
    keywords: ['create', 'build', 'generate', 'make'],
    taskTemplates: [
      {
        id: '',
        name: 'plan',
        objective: '',
        requiredCapabilities: ['planning'],
        dependencies: [],
        priority: 'HIGH',
        retryPolicy: DEFAULT_RETRY_POLICY,
      },
      {
        id: '',
        name: 'execute',
        objective: '',
        requiredCapabilities: ['execution'],
        dependencies: [],
        priority: 'NORMAL',
        retryPolicy: DEFAULT_RETRY_POLICY,
      },
      {
        id: '',
        name: 'validate',
        objective: '',
        requiredCapabilities: ['validation'],
        dependencies: [],
        priority: 'NORMAL',
        retryPolicy: DEFAULT_RETRY_POLICY,
      },
    ],
  },
];

export class SequentialPlanner implements IPlanner {
  public plan(goal: Goal): TaskGraph {
    const now = new Date().toISOString();
    const tasks = this.decomposeGoal(goal);
    const rootTaskId = tasks[0]?.id ?? '';

    return {
      id: randomUUID(),
      goal_id: goal.id,
      tasks,
      root_task_id: rootTaskId,
      created_at: now,
    };
  }

  public planToDefinition(goal: Goal): WorkflowDefinition {
    const taskTemplates = this.matchPatterns(goal.objective);
    const tasks: TaskDefinition[] = taskTemplates.map((template, index) => ({
      ...template,
      id: `task_${index + 1}`,
      objective: this.buildObjective(goal.objective, template.name),
      dependencies: index > 0 ? [`task_${index}`] : [],
    }));

    return {
      id: randomUUID(),
      name: goal.objective,
      description: `Workflow for goal: ${goal.objective}`,
      version: '1.0.0',
      tasks,
      retryPolicy: DEFAULT_RETRY_POLICY,
    };
  }

  private decomposeGoal(goal: Goal): Task[] {
    const now = new Date().toISOString();
    const templates = this.matchPatterns(goal.objective);

    return templates.map((template, index) => {
      const task: Task = {
        id: index === 0 ? `root_${randomUUID()}` : randomUUID(),
        objective: this.buildObjective(goal.objective, template.name),
        required_capabilities: template.requiredCapabilities,
        status: 'CREATED',
        priority: goal.priority,
        dependencies: index > 0 ? [index === 1 ? `root_0` : `task_${index}`] : [],
        retry_count: 0,
        max_retries: template.retryPolicy?.maxRetries ?? 3,
        created_at: now,
      };
      return task;
    });
  }

  private matchPatterns(objective: string): TaskDefinition[] {
    const lower = objective.toLowerCase();
    for (const pattern of planningPatterns) {
      if (pattern.keywords.some((kw) => lower.includes(kw))) {
        return pattern.taskTemplates;
      }
    }
    return [
      {
        id: '',
        name: 'process',
        objective: '',
        requiredCapabilities: ['general'],
        dependencies: [],
        priority: 'NORMAL',
        retryPolicy: DEFAULT_RETRY_POLICY,
      },
    ];
  }

  private buildObjective(goalObjective: string, taskName: string): string {
    return `${taskName}: ${goalObjective}`;
  }
}
