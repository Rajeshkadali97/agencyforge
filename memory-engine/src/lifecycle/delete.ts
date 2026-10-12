import { MemoryItem } from '../types';
import { IMemoryProvider } from '../interfaces';

export interface DeleteContext {
  id: string;
  permanent: boolean;
  provider: IMemoryProvider;
  item: MemoryItem | null;
  startTime: number;
}

export interface DeleteResult {
  success: boolean;
  providerId: string;
  durationMs: number;
  archived: boolean;
  itemId: string;
}

export interface IDeletePipeline {
  execute(context: DeleteContext): Promise<DeleteResult>;
  addStep(step: DeleteStep): void;
  removeStep(name: string): boolean;
  getSteps(): DeleteStep[];
}

export interface DeleteStep {
  name: string;
  execute(context: DeleteContext): Promise<DeleteContext>;
  canSkip?(context: DeleteContext): boolean;
}

export class DeletePipeline implements IDeletePipeline {
  private steps: DeleteStep[] = [];

  addStep(step: DeleteStep): void {
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

  getSteps(): DeleteStep[] {
    return [...this.steps];
  }

  async execute(context: DeleteContext): Promise<DeleteResult> {
    let currentContext = context;
    currentContext.item = await currentContext.provider.retrieve(currentContext.id);

    if (!currentContext.item) {
      return {
        success: false,
        providerId: currentContext.provider.metadata.id,
        durationMs: Date.now() - currentContext.startTime,
        archived: false,
        itemId: currentContext.id,
      };
    }

    for (const step of this.steps) {
      if (step.canSkip && step.canSkip(currentContext)) {
        continue;
      }
      currentContext = await step.execute(currentContext);
    }

    return {
      success: true,
      providerId: currentContext.provider.metadata.id,
      durationMs: Date.now() - currentContext.startTime,
      archived: !currentContext.permanent,
      itemId: currentContext.id,
    };
  }
}

export class RetrieveForDeleteStep implements DeleteStep {
  name = 'retrieve_for_delete';

  async execute(context: DeleteContext): Promise<DeleteContext> {
    context.item = await context.provider.retrieve(context.id);
    return context;
  }
}

export class ArchiveBeforeDeleteStep implements DeleteStep {
  name = 'archive_before_delete';

  canSkip(context: DeleteContext): boolean {
    return context.permanent;
  }

  async execute(context: DeleteContext): Promise<DeleteContext> {
    if (context.item) {
      await context.provider.archive(context.id, { reason: 'Deleted by user', archiveLocation: 'deleted' });
    }
    return context;
  }
}

export class DeleteFromProviderStep implements DeleteStep {
  name = 'delete_from_provider';

  async execute(context: DeleteContext): Promise<DeleteContext> {
    await context.provider.delete(context.id, context.permanent);
    return context;
  }
}

export class CleanupRelationshipsStep implements DeleteStep {
  name = 'cleanup_relationships';

  async execute(context: DeleteContext): Promise<DeleteContext> {
    // Clean up relationships pointing to this item
    // This would be implemented by the provider
    return context;
  }
}

export class CleanupIndexStep implements DeleteStep {
  name = 'cleanup_index';

  async execute(context: DeleteContext): Promise<DeleteContext> {
    // Remove from search indexes
    // This would be implemented by the provider
    return context;
  }
}