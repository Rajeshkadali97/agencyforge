import { MemoryItem, MemoryArchiveOptions } from '../types';
import { IMemoryProvider } from '../interfaces';

export interface ArchiveContext {
  id: string;
  options: MemoryArchiveOptions;
  provider: IMemoryProvider;
  item: MemoryItem | null;
  archiveId: string;
  startTime: number;
}

export interface ArchiveResult {
  success: boolean;
  archiveId: string;
  providerId: string;
  durationMs: number;
  originalItem: MemoryItem;
}

export interface IArchivePipeline {
  execute(context: ArchiveContext): Promise<ArchiveResult>;
  addStep(step: ArchiveStep): void;
  removeStep(name: string): boolean;
  getSteps(): ArchiveStep[];
}

export interface ArchiveStep {
  name: string;
  execute(context: ArchiveContext): Promise<ArchiveContext>;
  canSkip?(context: ArchiveContext): boolean;
}

export class ArchivePipeline implements IArchivePipeline {
  private steps: ArchiveStep[] = [];

  addStep(step: ArchiveStep): void {
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

  getSteps(): ArchiveStep[] {
    return [...this.steps];
  }

  async execute(context: ArchiveContext): Promise<ArchiveResult> {
    let currentContext = context;
    currentContext.item = await currentContext.provider.retrieve(currentContext.id);

    if (!currentContext.item) {
      throw new Error(`Memory item not found: ${currentContext.id}`);
    }

    currentContext.archiveId = `archive_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    for (const step of this.steps) {
      if (step.canSkip && step.canSkip(currentContext)) {
        continue;
      }
      currentContext = await step.execute(currentContext);
    }

    return {
      success: true,
      archiveId: currentContext.archiveId,
      providerId: currentContext.provider.metadata.id,
      durationMs: Date.now() - currentContext.startTime,
      originalItem: currentContext.item!,
    };
  }
}

export class RetrieveForArchiveStep implements ArchiveStep {
  name = 'retrieve_for_archive';

  async execute(context: ArchiveContext): Promise<ArchiveContext> {
    context.item = await context.provider.retrieve(context.id);
    return context;
  }
}

export class CreateArchiveRecordStep implements ArchiveStep {
  name = 'create_archive_record';

  async execute(context: ArchiveContext): Promise<ArchiveContext> {
    // Create archive record in storage
    return context;
  }
}

export class MoveToArchiveStorageStep implements ArchiveStep {
  name = 'move_to_archive_storage';

  async execute(context: ArchiveContext): Promise<ArchiveContext> {
    await context.provider.archive(context.id, context.options);
    return context;
  }
}

export class RemoveFromActiveIndexStep implements ArchiveStep {
  name = 'remove_from_active_index';

  async execute(context: ArchiveContext): Promise<ArchiveContext> {
    // Remove from active search indexes
    return context;
  }
}

export class UpdateArchiveIndexStep implements ArchiveStep {
  name = 'update_archive_index';

  async execute(context: ArchiveContext): Promise<ArchiveContext> {
    // Add to archive index
    return context;
  }
}