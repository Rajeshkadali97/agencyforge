import { ILogger } from '../interfaces';
import { EnhancedEventBus } from '../events/EnhancedEventBus';
import { RuntimeEventTypes, RuntimeEvent, BaseEventPayload, createRuntimeEvent } from '../contracts';

export type ToolParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface ToolParameter {
  name: string;
  type: ToolParameterType;
  description: string;
  required: boolean;
  defaultValue?: unknown;
  enumValues?: string[];
}

export interface ToolDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
  capabilities: string[];
  timeoutMs: number;
  maxRetries: number;
  dangerous?: boolean;
  requiresApproval?: boolean;
}

export interface ToolExecution {
  id: string;
  toolId: string;
  agentId: string;
  taskId: string;
  workflowId: string;
  parameters: Record<string, unknown>;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out' | 'awaiting_approval';
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  result?: unknown;
  error?: string;
  retryCount: number;
}

export interface ToolExecutionContext {
  execution: ToolExecution;
  cancellationToken?: AbortSignal;
  logger: ILogger;
}

export type ToolHandler = (context: ToolExecutionContext) => Promise<unknown>;

export interface IToolRegistry {
  register(definition: ToolDefinition, handler: ToolHandler): void;
  unregister(toolId: string): boolean;
  get(toolId: string): ToolDefinition | undefined;
  getHandler(toolId: string): ToolHandler | undefined;
  list(category?: string): ToolDefinition[];
  has(toolId: string): boolean;
}

export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private handlers: Map<string, ToolHandler> = new Map();

  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.id, definition);
    this.handlers.set(definition.id, handler);
  }

  unregister(toolId: string): boolean {
    this.handlers.delete(toolId);
    return this.tools.delete(toolId);
  }

  get(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  getHandler(toolId: string): ToolHandler | undefined {
    return this.handlers.get(toolId);
  }

  list(category?: string): ToolDefinition[] {
    const all = Array.from(this.tools.values());
    if (category) {
      return all.filter((t) => t.category === category);
    }
    return all;
  }

  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }
}

export interface ToolExecutionEngineConfig {
  maxConcurrentExecutions?: number;
  defaultTimeoutMs?: number;
  defaultMaxRetries?: number;
}

export class ToolExecutionEngine {
  private registry: ToolRegistry;
  private activeExecutions: Map<string, ToolExecution> = new Map();
  private executionHistory: ToolExecution[] = [];
  private maxHistorySize = 1000;
  private maxConcurrentExecutions: number;
  private defaultTimeoutMs: number;
  private defaultMaxRetries: number;
  private nextExecutionId = 0;

  constructor(
    registry: ToolRegistry,
    private eventBus: EnhancedEventBus,
    private logger: ILogger,
    config: ToolExecutionEngineConfig = {}
  ) {
    this.registry = registry;
    this.maxConcurrentExecutions = config.maxConcurrentExecutions ?? 10;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30000;
    this.defaultMaxRetries = config.defaultMaxRetries ?? 2;
  }

  getRegistry(): IToolRegistry {
    return this.registry;
  }

  async execute(
    toolId: string,
    agentId: string,
    taskId: string,
    workflowId: string,
    parameters: Record<string, unknown>,
    traceId: string,
    spanId: string
  ): Promise<ToolExecution> {
    const definition = this.registry.get(toolId);
    if (!definition) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    const handler = this.registry.getHandler(toolId);
    if (!handler) {
      throw new Error(`Tool handler not found: ${toolId}`);
    }

    const validationError = this.validateParameters(definition, parameters);
    if (validationError) {
      throw new Error(`Parameter validation failed for tool ${toolId}: ${validationError}`);
    }

    const execution: ToolExecution = {
      id: `tool_exec_${++this.nextExecutionId}_${Date.now()}`,
      toolId,
      agentId,
      taskId,
      workflowId,
      parameters,
      status: 'queued',
      queuedAt: new Date().toISOString(),
      retryCount: 0,
    };

    if (definition.requiresApproval) {
      execution.status = 'awaiting_approval';
      this.activeExecutions.set(execution.id, execution);
      this.publishToolEvent(execution, traceId, spanId, 'tool.approval_required');
      return execution;
    }

    return this.runExecution(execution, handler, definition, traceId, spanId);
  }

  async approveExecution(executionId: string, traceId: string, spanId: string): Promise<ToolExecution> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || execution.status !== 'awaiting_approval') {
      throw new Error(`Execution not found or not awaiting approval: ${executionId}`);
    }

    const handler = this.registry.getHandler(execution.toolId);
    if (!handler) {
      throw new Error(`Tool handler not found: ${execution.toolId}`);
    }

    const definition = this.registry.get(execution.toolId)!;
    return this.runExecution(execution, handler, definition, traceId, spanId);
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return false;

    if (execution.status === 'running' || execution.status === 'queued') {
      execution.status = 'cancelled';
      execution.completedAt = new Date().toISOString();
      this.moveToHistory(execution);
      return true;
    }
    return false;
  }

  getActiveExecutions(): ToolExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  getExecutionHistory(limit?: number): ToolExecution[] {
    return limit ? this.executionHistory.slice(-limit) : [...this.executionHistory];
  }

  getExecution(executionId: string): ToolExecution | undefined {
    return this.activeExecutions.get(executionId) ?? this.executionHistory.find((e) => e.id === executionId);
  }

  private async runExecution(
    execution: ToolExecution,
    handler: ToolHandler,
    definition: ToolDefinition,
    traceId: string,
    spanId: string
  ): Promise<ToolExecution> {
    if (this.activeExecutions.size >= this.maxConcurrentExecutions) {
      const waiting = Array.from(this.activeExecutions.values()).filter((e) => e.status === 'queued');
      if (waiting.length >= this.maxConcurrentExecutions) {
        throw new Error(`Max concurrent executions reached (${this.maxConcurrentExecutions})`);
      }
    }

    execution.status = 'running';
    execution.startedAt = new Date().toISOString();
    this.activeExecutions.set(execution.id, execution);

    this.publishToolEvent(execution, traceId, spanId, 'tool.execution_started');

    const timeoutMs = definition.timeoutMs || this.defaultTimeoutMs;
    const maxRetries = definition.maxRetries ?? this.defaultMaxRetries;

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const result = await this.executeWithRetry(
        handler,
        {
          execution,
          cancellationToken: abortController.signal,
          logger: this.logger.child({ toolId: definition.id, executionId: execution.id }),
        },
        maxRetries
      );

      clearTimeout(timeoutHandle);
      execution.status = 'completed';
      execution.result = result;
      execution.completedAt = new Date().toISOString();
      execution.durationMs = Date.now() - new Date(execution.startedAt).getTime();

      this.publishToolEvent(execution, traceId, spanId, 'tool.execution_completed');
      this.moveToHistory(execution);
      return execution;
    } catch (err) {
      clearTimeout(timeoutHandle);
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (abortController.signal.aborted) {
        execution.status = 'timed_out';
        execution.error = `Timeout after ${timeoutMs}ms`;
      } else {
        execution.status = 'failed';
        execution.error = errorMessage;
      }

      execution.completedAt = new Date().toISOString();
      execution.durationMs = Date.now() - new Date(execution.startedAt).getTime();

      this.publishToolEvent(execution, traceId, spanId, 'tool.execution_failed');
      this.moveToHistory(execution);
      return execution;
    }
  }

  private async executeWithRetry(
    handler: ToolHandler,
    context: ToolExecutionContext,
    maxRetries: number
  ): Promise<unknown> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await handler(context);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        context.execution.retryCount = attempt;

        if (attempt < maxRetries && this.isRetryableError(lastError)) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
        throw lastError;
      }
    }

    throw lastError ?? new Error('Unknown error during tool execution');
  }

  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('temporary') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused')
    );
  }

  private validateParameters(definition: ToolDefinition, params: Record<string, unknown>): string | null {
    for (const param of definition.parameters) {
      if (param.required && !(param.name in params)) {
        if (param.defaultValue === undefined) {
          return `Missing required parameter: ${param.name}`;
        }
      }

      if (param.name in params) {
        const value = params[param.name];
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== param.type && value !== null && value !== undefined) {
          return `Parameter ${param.name} expected type ${param.type}, got ${actualType}`;
        }
        if (param.enumValues && typeof value === 'string' && !param.enumValues.includes(value)) {
          return `Parameter ${param.name} value "${value}" not in allowed values: ${param.enumValues.join(', ')}`;
        }
      }
    }
    return null;
  }

  private publishToolEvent(execution: ToolExecution, traceId: string, spanId: string, eventType: string): void {
    this.eventBus.publish(
      createRuntimeEvent(
        eventType,
        {
          workflowId: execution.workflowId,
          timestamp: new Date().toISOString(),
          traceId,
          spanId,
          taskId: execution.taskId,
        } as BaseEventPayload,
        traceId,
        spanId
      )
    );
  }

  private moveToHistory(execution: ToolExecution): void {
    this.activeExecutions.delete(execution.id);
    this.executionHistory.push({ ...execution });
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
  }
}
