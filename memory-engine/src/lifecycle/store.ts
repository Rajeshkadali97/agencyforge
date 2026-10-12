import { MemoryItem, MemoryType, MemoryStoreOptions } from '../types';
import { IMemoryProvider, IProviderRegistry } from '../interfaces';

const VALID_MEMORY_TYPES: MemoryType[] = [
  'short-term', 'long-term', 'semantic', 'episodic', 'procedural', 'working',
  'business', 'user', 'project', 'workflow', 'agent', 'knowledge',
  'conversation', 'document', 'decision', 'task', 'relationship'
];

export interface StoreContext {
  item: MemoryItem;
  options: MemoryStoreOptions;
  provider: IMemoryProvider;
  startTime: number;
}

export interface StoreResult {
  item: MemoryItem;
  providerId: string;
  durationMs: number;
  operations: StoreOperation[];
}

export type StoreOperation =
  | 'validate'
  | 'extract_facts'
  | 'classify'
  | 'index'
  | 'embed'
  | 'relate'
  | 'summarize'
  | 'persist';

export interface IStorePipeline {
  execute(context: StoreContext): Promise<StoreResult>;
  addStep(step: StoreStep): void;
  removeStep(name: string): boolean;
  getSteps(): StoreStep[];
}

export interface StoreStep {
  name: StoreOperation;
  execute(context: StoreContext): Promise<StoreContext>;
  canSkip?(context: StoreContext): boolean;
}

export class StorePipeline implements IStorePipeline {
  private steps: StoreStep[] = [];
  private providerRegistry: IProviderRegistry;

  constructor(providerRegistry: IProviderRegistry) {
    this.providerRegistry = providerRegistry;
  }

  addStep(step: StoreStep): void {
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

  getSteps(): StoreStep[] {
    return [...this.steps];
  }

  async execute(context: StoreContext): Promise<StoreResult> {
    const operations: StoreOperation[] = [];
    let currentContext = context;

    for (const step of this.steps) {
      if (step.canSkip && step.canSkip(currentContext)) {
        continue;
      }
      operations.push(step.name);
      currentContext = await step.execute(currentContext);
    }

    return {
      item: currentContext.item,
      providerId: currentContext.provider.metadata.id,
      durationMs: Date.now() - currentContext.startTime,
      operations,
    };
  }
}

export class ValidateStep implements StoreStep {
  name: StoreOperation = 'validate';

  async execute(context: StoreContext): Promise<StoreContext> {
    const { item } = context;
    if (!item.type || !VALID_MEMORY_TYPES.includes(item.type)) {
      throw new Error(`Invalid memory type: ${item.type}`);
    }
    if (!item.owner) {
      throw new Error('Memory item must have an owner');
    }
    if (!item.rawContent && !item.summary) {
      throw new Error('Memory item must have rawContent or summary');
    }
    if (item.confidence < 0 || item.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
    if (item.importance < 0 || item.importance > 1) {
      throw new Error('Importance must be between 0 and 1');
    }
    return context;
  }
}

export class ExtractFactsStep implements StoreStep {
  name: StoreOperation = 'extract_facts';

  canSkip(context: StoreContext): boolean {
    return !context.options.extractFacts;
  }

  async execute(context: StoreContext): Promise<StoreContext> {
    // Fact extraction would be implemented by a provider
    // This step coordinates with the provider's fact extraction capability
    return context;
  }
}

export class ClassifyStep implements StoreStep {
  name: StoreOperation = 'classify';

  canSkip(context: StoreContext): boolean {
    return !context.options.classify || context.item.type !== 'knowledge';
  }

  async execute(context: StoreContext): Promise<StoreContext> {
    // Classification would be implemented by a provider
    return context;
  }
}

export class IndexStep implements StoreStep {
  name: StoreOperation = 'index';

  canSkip(context: StoreContext): boolean {
    return !context.options.index;
  }

  async execute(context: StoreContext): Promise<StoreContext> {
    // Indexing would be implemented by the provider
    return context;
  }
}

export class EmbedStep implements StoreStep {
  name: StoreOperation = 'embed';

  canSkip(context: StoreContext): boolean {
    return !context.options.embed;
  }

  async execute(context: StoreContext): Promise<StoreContext> {
    // Embedding would be implemented by the provider
    return context;
  }
}

export class RelateStep implements StoreStep {
  name: StoreOperation = 'relate';

  canSkip(context: StoreContext): boolean {
    return !context.options.relate;
  }

  async execute(context: StoreContext): Promise<StoreContext> {
    // Relationship extraction would be implemented by the provider
    return context;
  }
}

export class SummarizeStep implements StoreStep {
  name: StoreOperation = 'summarize';

  canSkip(context: StoreContext): boolean {
    return !context.options.summarize;
  }

  async execute(context: StoreContext): Promise<StoreContext> {
    // Summarization would be implemented by the provider
    return context;
  }
}

export class PersistStep implements StoreStep {
  name: StoreOperation = 'persist';

  async execute(context: StoreContext): Promise<StoreContext> {
    const storedItem = await context.provider.store(context.item, context.options);
    return { ...context, item: storedItem };
  }
}