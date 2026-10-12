import { MemoryItem, MemoryRelationship } from '../types';
import { IMemoryProvider } from '../interfaces';

export interface RelateContext {
  sourceId: string;
  targetId: string;
  relationshipType: string;
  properties: Record<string, unknown>;
  provider: IMemoryProvider;
  sourceItem: MemoryItem | null;
  targetItem: MemoryItem | null;
  relationship: MemoryRelationship | null;
  startTime: number;
}

export interface RelateResult {
  relationship: MemoryRelationship;
  providerId: string;
  durationMs: number;
}

export interface IRelatePipeline {
  execute(context: RelateContext): Promise<RelateResult>;
  addStep(step: RelateStep): void;
  removeStep(name: string): boolean;
  getSteps(): RelateStep[];
}

export interface RelateStep {
  name: string;
  execute(context: RelateContext): Promise<RelateContext>;
  canSkip?(context: RelateContext): boolean;
}

export class RelatePipeline implements IRelatePipeline {
  private steps: RelateStep[] = [];

  addStep(step: RelateStep): void {
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

  getSteps(): RelateStep[] {
    return [...this.steps];
  }

  async execute(context: RelateContext): Promise<RelateResult> {
    let currentContext = context;

    for (const step of this.steps) {
      if (step.canSkip && step.canSkip(currentContext)) {
        continue;
      }
      currentContext = await step.execute(currentContext);
    }

    return {
      relationship: currentContext.relationship!,
      providerId: currentContext.provider.metadata.id,
      durationMs: Date.now() - currentContext.startTime,
    };
  }
}

export class RetrieveSourceTargetStep implements RelateStep {
  name = 'retrieve_source_target';

  async execute(context: RelateContext): Promise<RelateContext> {
    const [sourceItem, targetItem] = await Promise.all([
      context.provider.retrieve(context.sourceId),
      context.provider.retrieve(context.targetId),
    ]);

    if (!sourceItem) {
      throw new Error(`Source memory item not found: ${context.sourceId}`);
    }
    if (!targetItem) {
      throw new Error(`Target memory item not found: ${context.targetId}`);
    }

    return { ...context, sourceItem, targetItem };
  }
}

export class ValidateRelationshipStep implements RelateStep {
  name = 'validate_relationship';

  async execute(context: RelateContext): Promise<RelateContext> {
    // Check if relationship already exists
    const existing = context.sourceItem!.relationships.find(
      r => r.targetEntityId === context.targetId && r.type === context.relationshipType
    );
    if (existing) {
      throw new Error(`Relationship already exists between ${context.sourceId} and ${context.targetId}`);
    }
    return context;
  }
}

export class ExtractEntitiesStep implements RelateStep {
  name = 'extract_entities';

  async execute(context: RelateContext): Promise<RelateContext> {
    // Ensure entities exist for both items
    if (!context.sourceItem!.entities.some(e => e.id === context.sourceId)) {
      // Would extract entities from content here
    }
    if (!context.targetItem!.entities.some(e => e.id === context.targetId)) {
      // Would extract entities from content here
    }
    return context;
  }
}

export class CreateRelationshipStep implements RelateStep {
  name = 'create_relationship';

  async execute(context: RelateContext): Promise<RelateContext> {
    const relationship: MemoryRelationship = {
      id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      sourceEntityId: context.sourceId,
      targetEntityId: context.targetId,
      type: context.relationshipType,
      properties: context.properties,
      confidence: 0.9,
      createdAt: new Date().toISOString(),
    };

    await context.provider.relate(
      context.sourceId,
      context.targetId,
      context.relationshipType,
      context.properties
    );

    return { ...context, relationship };
  }
}

export class UpdateSourceItemStep implements RelateStep {
  name = 'update_source_item';

  async execute(context: RelateContext): Promise<RelateContext> {
    await context.provider.update(context.sourceId, {
      relationships: [...context.sourceItem!.relationships, context.relationship!],
    });
    return context;
  }
}

export class UpdateTargetItemStep implements RelateStep {
  name = 'update_target_item';

  async execute(context: RelateContext): Promise<RelateContext> {
    const inverseRelationship: MemoryRelationship = {
      ...context.relationship!,
      id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      sourceEntityId: context.targetId,
      targetEntityId: context.sourceId,
      type: `inverse_${context.relationshipType}`,
    };

    await context.provider.update(context.targetId, {
      relationships: [...context.targetItem!.relationships, inverseRelationship],
    });
    return context;
  }
}

export class InvalidateCacheStep implements RelateStep {
  name = 'invalidate_cache';

  async execute(context: RelateContext): Promise<RelateContext> {
    // Invalidate any cached relationship queries
    return context;
  }
}