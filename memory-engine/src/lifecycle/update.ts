import { MemoryItem, MemoryUpdateOptions, MemoryType } from '../types';
import { IMemoryProvider } from '../interfaces';

const VALID_MEMORY_TYPES: MemoryType[] = [
  'short-term', 'long-term', 'semantic', 'episodic', 'procedural', 'working',
  'business', 'user', 'project', 'workflow', 'agent', 'knowledge',
  'conversation', 'document', 'decision', 'task', 'relationship'
];

export interface UpdateContext {
  id: string;
  updates: Partial<MemoryItem>;
  options: MemoryUpdateOptions;
  provider: IMemoryProvider;
  originalItem: MemoryItem | null;
  startTime: number;
}

export interface UpdateResult {
  item: MemoryItem;
  providerId: string;
  durationMs: number;
  operations: UpdateOperation[];
  changedFields: string[];
}

export type UpdateOperation =
  | 'validate'
  | 'update_embedding'
  | 'update_entities'
  | 'update_relationships'
  | 'update_summary'
  | 'update_importance'
  | 'persist';

export interface IUpdatePipeline {
  execute(context: UpdateContext): Promise<UpdateResult>;
  addStep(step: UpdateStep): void;
  removeStep(name: string): boolean;
  getSteps(): UpdateStep[];
}

export interface UpdateStep {
  name: UpdateOperation;
  execute(context: UpdateContext): Promise<UpdateContext>;
  canSkip?(context: UpdateContext): boolean;
}

export class UpdatePipeline implements IUpdatePipeline {
  private steps: UpdateStep[] = [];

  addStep(step: UpdateStep): void {
    this.steps.push(step);
  }

  removeStep(name: string): boolean {
    const index = this.steps.findIndex(s => s.name === name);
    if (index !== -1) {
      this.steps.splice(index, 1);
      return true;
    }
    return false;
  }

  getSteps(): UpdateStep[] {
    return [...this.steps];
  }

  async execute(context: UpdateContext): Promise<UpdateResult> {
    const operations: UpdateOperation[] = [];
    const changedFields: string[] = [];
    let currentContext = context;

    // Get original item
    currentContext.originalItem = await currentContext.provider.retrieve(currentContext.id);
    if (!currentContext.originalItem) {
      throw new Error(`Memory item not found: ${currentContext.id}`);
    }

    for (const step of this.steps) {
      if (step.canSkip && step.canSkip(currentContext)) {
        continue;
      }
      operations.push(step.name);
      currentContext = await step.execute(currentContext);
    }

    // Track changed fields
    for (const key of Object.keys(currentContext.updates)) {
      const original = currentContext.originalItem[key as keyof MemoryItem];
      const updated = currentContext.updates[key as keyof MemoryItem];
      if (original !== updated) {
        changedFields.push(key);
      }
    }

    return {
      item: currentContext.originalItem!,
      providerId: currentContext.provider.metadata.id,
      durationMs: Date.now() - currentContext.startTime,
      operations,
      changedFields,
    };
  }
}

export class ValidateUpdateStep implements UpdateStep {
  name: UpdateOperation = 'validate';

  async execute(context: UpdateContext): Promise<UpdateContext> {
    const { updates } = context;
    if (updates.confidence !== undefined && (updates.confidence < 0 || updates.confidence > 1)) {
      throw new Error('Confidence must be between 0 and 1');
    }
    if (updates.importance !== undefined && (updates.importance < 0 || updates.importance > 1)) {
      throw new Error('Importance must be between 0 and 1');
    }
    if (updates.type && !VALID_MEMORY_TYPES.includes(updates.type)) {
      throw new Error(`Invalid memory type: ${updates.type}`);
    }
    return context;
  }
}

export class UpdateEmbeddingStep implements UpdateStep {
  name: UpdateOperation = 'update_embedding';

  canSkip(context: UpdateContext): boolean {
    return !context.options.updateEmbedding || !context.updates.rawContent;
  }

  async execute(context: UpdateContext): Promise<UpdateContext> {
    // Embedding update would be handled by the provider
    return context;
  }
}

export class UpdateEntitiesStep implements UpdateStep {
  name: UpdateOperation = 'update_entities';

  canSkip(context: UpdateContext): boolean {
    return !context.options.updateEntities;
  }

  async execute(context: UpdateContext): Promise<UpdateContext> {
    // Entity update would be handled by the provider
    return context;
  }
}

export class UpdateRelationshipsStep implements UpdateStep {
  name: UpdateOperation = 'update_relationships';

  canSkip(context: UpdateContext): boolean {
    return !context.options.updateRelationships;
  }

  async execute(context: UpdateContext): Promise<UpdateContext> {
    // Relationship update would be handled by the provider
    return context;
  }
}

export class UpdateSummaryStep implements UpdateStep {
  name: UpdateOperation = 'update_summary';

  canSkip(context: UpdateContext): boolean {
    return !context.options.updateSummary || !context.updates.rawContent;
  }

  async execute(context: UpdateContext): Promise<UpdateContext> {
    // Summary update would be handled by the provider
    return context;
  }
}

export class UpdateImportanceStep implements UpdateStep {
  name: UpdateOperation = 'update_importance';

  canSkip(context: UpdateContext): boolean {
    return !context.options.updateImportance;
  }

  async execute(context: UpdateContext): Promise<UpdateContext> {
    // Importance update logic
    return context;
  }
}

export class PersistUpdateStep implements UpdateStep {
  name: UpdateOperation = 'persist';

  async execute(context: UpdateContext): Promise<UpdateContext> {
    const updatedItem = await context.provider.update(
      context.id,
      context.updates,
      context.options
    );
    return { ...context, originalItem: updatedItem };
  }
}