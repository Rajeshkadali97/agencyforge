import { randomUUID } from 'crypto';
import { ExecutionContext, ExecutionArtifact, Task, TaskResult } from '../types';
import { IExecutionContextManager } from '../interfaces/IExecutionContext';

export class ExecutionContextManager implements IExecutionContextManager {
  private contexts: Map<string, ExecutionContext> = new Map();

  public createContext(
    workflowId: string,
    goalId: string,
    parentId?: string
  ): ExecutionContext {
    const context: ExecutionContext = {
      workflowId,
      goalId,
      variables: new Map<string, unknown>(),
      artifacts: [],
      parentExecutionId: parentId,
      startTime: new Date().toISOString(),
    };
    this.contexts.set(workflowId, context);
    return context;
  }

  public getContext(workflowId: string): ExecutionContext | undefined {
    return this.contexts.get(workflowId);
  }

  public setVariable(workflowId: string, key: string, value: unknown): void {
    const ctx = this.contexts.get(workflowId);
    if (!ctx) throw new Error(`Context not found for workflow ${workflowId}`);
    ctx.variables.set(key, value);
  }

  public getVariable(workflowId: string, key: string): unknown | undefined {
    const ctx = this.contexts.get(workflowId);
    if (!ctx) throw new Error(`Context not found for workflow ${workflowId}`);
    return ctx.variables.get(key);
  }

  public addArtifact(workflowId: string, artifact: ExecutionArtifact): void {
    const ctx = this.contexts.get(workflowId);
    if (!ctx) throw new Error(`Context not found for workflow ${workflowId}`);
    ctx.artifacts.push(artifact);
  }

  public getArtifacts(workflowId: string): ExecutionArtifact[] {
    const ctx = this.contexts.get(workflowId);
    if (!ctx) throw new Error(`Context not found for workflow ${workflowId}`);
    return [...ctx.artifacts];
  }

  public storeTaskResult(
    workflowId: string,
    task: Task,
    result: TaskResult
  ): void {
    const ctx = this.contexts.get(workflowId);
    if (!ctx) throw new Error(`Context not found for workflow ${workflowId}`);
    ctx.variables.set(`result:${task.id}`, result);
    if (result.output) {
      ctx.artifacts.push({
        id: randomUUID(),
        type: 'task_result',
        data: result.output,
        createdAt: new Date().toISOString(),
        metadata: { taskId: task.id, success: result.success },
      });
    }
  }

  public deliverContext(workflowId: string): ExecutionContext | undefined {
    return this.contexts.get(workflowId);
  }

  public disposeContext(workflowId: string): void {
    this.contexts.delete(workflowId);
  }
}
