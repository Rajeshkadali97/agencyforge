import { MemoryItem, MemoryMergeOptions } from '../types';
import { IMemoryProvider } from '../interfaces';

export interface MergeContext {
  sourceId: string;
  targetId: string;
  options: MemoryMergeOptions;
  provider: IMemoryProvider;
  sourceItem: MemoryItem | null;
  targetItem: MemoryItem | null;
  mergedItem: MemoryItem | null;
  startTime: number;
}

export interface MergeResult {
  success: boolean;
  mergedItem: MemoryItem;
  providerId: string;
  durationMs: number;
  conflicts: MergeConflict[];
}

export interface MergeConflict {
  field: string;
  sourceValue: unknown;
  targetValue: unknown;
  resolution: 'source' | 'target' | 'merged' | 'manual';
  resolvedValue: unknown;
}

export interface IMergePipeline {
  execute(context: MergeContext): Promise<MergeResult>;
  addStep(step: MergeStep): void;
  removeStep(name: string): boolean;
  getSteps(): MergeStep[];
}

export interface MergeStep {
  name: string;
  execute(context: MergeContext): Promise<MergeContext>;
  canSkip?(context: MergeContext): boolean;
}

export class MergePipeline implements IMergePipeline {
  private steps: MergeStep[] = [];

  addStep(step: MergeStep): void {
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

  getSteps(): MergeStep[] {
    return [...this.steps];
  }

  async execute(context: MergeContext): Promise<MergeResult> {
    let currentContext = context;
    currentContext.sourceItem = await currentContext.provider.retrieve(currentContext.sourceId);
    currentContext.targetItem = await currentContext.provider.retrieve(currentContext.targetId);

    if (!currentContext.sourceItem || !currentContext.targetItem) {
      throw new Error('One or both memory items not found');
    }

    const conflicts: MergeConflict[] = [];

    for (const step of this.steps) {
      if (step.canSkip && step.canSkip(currentContext)) {
        continue;
      }
      currentContext = await step.execute(currentContext);
    }

    return {
      success: true,
      mergedItem: currentContext.mergedItem!,
      providerId: currentContext.provider.metadata.id,
      durationMs: Date.now() - currentContext.startTime,
      conflicts,
    };
  }
}

export class RetrieveForMergeStep implements MergeStep {
  name = 'retrieve_for_merge';

  async execute(context: MergeContext): Promise<MergeContext> {
    context.sourceItem = await context.provider.retrieve(context.sourceId);
    context.targetItem = await context.provider.retrieve(context.targetId);
    return context;
  }
}

export class DetectConflictsStep implements MergeStep {
  name = 'detect_conflicts';

  async execute(context: MergeContext): Promise<MergeContext> {
    const source = context.sourceItem!;
    const target = context.targetItem!;
    const conflicts: MergeConflict[] = [];

    // Check for conflicts in mergeable fields
    const mergeableFields: (keyof MemoryItem)[] = [
      'rawContent', 'summary', 'importance', 'tags', 'metadata', 'entities', 'relationships'
    ];

    for (const field of mergeableFields) {
      const sourceValue = source[field];
      const targetValue = target[field];

      if (this.hasConflict(sourceValue, targetValue)) {
        conflicts.push({
          field,
          sourceValue,
          targetValue,
          resolution: 'manual',
          resolvedValue: targetValue,
        });
      }
    }

    // Store conflicts in context for resolution
    (context as MergeContext & { conflicts: MergeConflict[] }).conflicts = conflicts;
    return context;
  }

  private hasConflict(source: unknown, target: unknown): boolean {
    if (source === target) return false;
    if (source === undefined && target === undefined) return false;
    if (source === undefined || target === undefined) return true;
    if (Array.isArray(source) && Array.isArray(target)) {
      return source.length !== target.length || source.some((v, i) => v !== target[i]);
    }
    if (typeof source === 'object' && typeof target === 'object') {
      return JSON.stringify(source) !== JSON.stringify(target);
    }
    return source !== target;
  }
}

export class ResolveConflictsStep implements MergeStep {
  name = 'resolve_conflicts';

  async execute(context: MergeContext): Promise<MergeContext> {
    const extendedContext = context as MergeContext & { conflicts: MergeConflict[] };
    const strategy = context.options.strategy;

    for (const conflict of extendedContext.conflicts) {
      switch (strategy) {
        case 'replace':
          conflict.resolution = 'source';
          conflict.resolvedValue = conflict.sourceValue;
          break;
        case 'merge':
        case 'smart':
          conflict.resolution = 'merged';
          conflict.resolvedValue = this.mergeValues(conflict.sourceValue, conflict.targetValue);
          break;
        case 'append':
          conflict.resolution = 'merged';
          conflict.resolvedValue = this.appendValues(conflict.sourceValue, conflict.targetValue);
          break;
        default:
          conflict.resolution = 'target';
          conflict.resolvedValue = conflict.targetValue;
      }
    }
    return context;
  }

  private mergeValues(source: unknown, target: unknown): unknown {
    if (Array.isArray(source) && Array.isArray(target)) {
      return [...new Set([...source, ...target])];
    }
    if (typeof source === 'object' && typeof target === 'object' && source !== null && target !== null) {
      return { ...(target as object), ...(source as object) };
    }
    return source;
  }

  private appendValues(source: unknown, target: unknown): unknown {
    if (Array.isArray(source) && Array.isArray(target)) {
      return [...target, ...source];
    }
    if (typeof source === 'string' && typeof target === 'string') {
      return target + '\n' + source;
    }
    return source;
  }
}

export class CreateMergedItemStep implements MergeStep {
  name = 'create_merged_item';

  async execute(context: MergeContext): Promise<MergeContext> {
    const source = context.sourceItem!;
    const target = context.targetItem!;
    const extendedContext = context as MergeContext & { conflicts: MergeConflict[] };
    const conflicts = extendedContext.conflicts || [];

    const mergedItem: MemoryItem = {
      ...target,
      id: context.sourceId, // Use source ID for merged item
      updatedAt: new Date().toISOString(),
    };

    // Apply resolved conflicts
    for (const conflict of conflicts) {
      (mergedItem as unknown as Record<string, unknown>)[conflict.field] = conflict.resolvedValue;
    }

    // Merge entities and relationships
    mergedItem.entities = this.mergeEntities(source.entities, target.entities);
    mergedItem.relationships = this.mergeRelationships(source.relationships, target.relationships);
    mergedItem.tags = this.mergeTags(source.tags, target.tags);

    // Update importance to max of both
    mergedItem.importance = Math.max(source.importance, target.importance);
    // Update confidence to weighted average
    mergedItem.confidence = (source.confidence + target.confidence) / 2;

    context.mergedItem = mergedItem;
    return context;
  }

  private mergeEntities(source: MemoryItem['entities'], target: MemoryItem['entities']): MemoryItem['entities'] {
    const map = new Map<string, MemoryItem['entities'][0]>();
    for (const e of [...target, ...source]) {
      map.set(e.id, e);
    }
    return Array.from(map.values());
  }

  private mergeRelationships(source: MemoryItem['relationships'], target: MemoryItem['relationships']): MemoryItem['relationships'] {
    const map = new Map<string, MemoryItem['relationships'][0]>();
    for (const r of [...target, ...source]) {
      map.set(r.id, r);
    }
    return Array.from(map.values());
  }

  private mergeTags(source: string[], target: string[]): string[] {
    return [...new Set([...target, ...source])];
  }
}

export class PersistMergedItemStep implements MergeStep {
  name = 'persist_merged_item';

  async execute(context: MergeContext): Promise<MergeContext> {
    const merged = await context.provider.merge(
      context.sourceId,
      context.targetId,
      context.options
    );
    context.mergedItem = merged;
    return context;
  }
}

export class CleanupSourceItemStep implements MergeStep {
  name = 'cleanup_source_item';

  async execute(context: MergeContext): Promise<MergeContext> {
    // Archive or delete source item based on strategy
    if (context.options.strategy === 'replace') {
      await context.provider.archive(context.sourceId, { reason: 'Merged into target', archiveLocation: 'merged' });
    }
    return context;
  }
}