import { MemoryItem } from '../types';
import { IMemoryProvider, ISummarizationProvider } from '../types';

export interface SummarizeContext {
  ids: string[];
  provider: IMemoryProvider;
  summarizer?: ISummarizationProvider;
  options: SummarizeOptions;
  items: MemoryItem[];
  summary: string;
  startTime: number;
}

export interface SummarizeOptions {
  maxLength?: number;
  style?: 'concise' | 'detailed' | 'bullet' | 'narrative';
  includeEntities?: boolean;
  includeRelationships?: boolean;
  focusAreas?: string[];
}

export interface SummarizeResult {
  summary: string;
  providerId: string;
  durationMs: number;
  itemCount: number;
  compressionRatio: number;
}

export interface ISummarizePipeline {
  execute(context: SummarizeContext): Promise<SummarizeResult>;
  addStep(step: SummarizeStep): void;
  removeStep(name: string): boolean;
  getSteps(): SummarizeStep[];
}

export interface SummarizeStep {
  name: string;
  execute(context: SummarizeContext): Promise<SummarizeContext>;
  canSkip?(context: SummarizeContext): boolean;
}

export class SummarizePipeline implements ISummarizePipeline {
  private steps: SummarizeStep[] = [];

  addStep(step: SummarizeStep): void {
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

  getSteps(): SummarizeStep[] {
    return [...this.steps];
  }

  async execute(context: SummarizeContext): Promise<SummarizeResult> {
    let currentContext = context;

    for (const step of this.steps) {
      if (step.canSkip && step.canSkip(currentContext)) {
        continue;
      }
      currentContext = await step.execute(currentContext);
    }

    const totalLength = currentContext.items.reduce((sum, item) => sum + item.rawContent.length, 0);
    const compressionRatio = totalLength > 0 ? currentContext.summary.length / totalLength : 0;

    return {
      summary: currentContext.summary,
      providerId: currentContext.provider.metadata.id,
      durationMs: Date.now() - currentContext.startTime,
      itemCount: currentContext.items.length,
      compressionRatio,
    };
  }
}

export class RetrieveItemsStep implements SummarizeStep {
  name = 'retrieve_items';

  async execute(context: SummarizeContext): Promise<SummarizeContext> {
    const items: MemoryItem[] = [];
    for (const id of context.ids) {
      const item = await context.provider.retrieve(id);
      if (item) {
        items.push(item);
      }
    }
    return { ...context, items };
  }
}

export class PrepareContentStep implements SummarizeStep {
  name = 'prepare_content';

  async execute(context: SummarizeContext): Promise<SummarizeContext> {
    // Combine content from all items
    const combinedContent = context.items
      .map(item => {
        let content = item.rawContent;
        if (context.options.includeEntities && item.entities.length > 0) {
          content += '\nEntities: ' + item.entities.map(e => e.name).join(', ');
        }
        if (context.options.includeRelationships && item.relationships.length > 0) {
          content += '\nRelationships: ' + item.relationships.map(r => `${r.type}(${r.sourceEntityId}->${r.targetEntityId})`).join(', ');
        }
        return content;
      })
      .join('\n\n---\n\n');

    return { ...context, summary: combinedContent };
  }
}

export class GenerateSummaryStep implements SummarizeStep {
  name = 'generate_summary';

  async execute(context: SummarizeContext): Promise<SummarizeContext> {
    if (context.summarizer) {
      context.summary = await context.summarizer.summarize(context.summary, context.options);
    } else if (context.provider.summarize) {
      context.summary = await context.provider.summarize(context.ids);
    }
    return context;
  }
}

export class FormatSummaryStep implements SummarizeStep {
  name = 'format_summary';

  async execute(context: SummarizeContext): Promise<SummarizeContext> {
    // Apply formatting based on style
    switch (context.options.style) {
      case 'bullet':
        context.summary = this.formatAsBullets(context.summary);
        break;
      case 'narrative':
        context.summary = this.formatAsNarrative(context.summary);
        break;
      case 'concise':
        context.summary = this.formatConcise(context.summary);
        break;
      default:
        context.summary = this.formatDetailed(context.summary);
    }
    return context;
  }

  private formatAsBullets(text: string): string {
    const sentences = text.split('. ').filter(s => s.trim());
    return sentences.map(s => `• ${s.trim()}.`).join('\n');
  }

  private formatAsNarrative(text: string): string {
    return text;
  }

  private formatConcise(text: string): string {
    const sentences = text.split('. ').filter(s => s.trim());
    return sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '...' : '');
  }

  private formatDetailed(text: string): string {
    return text;
  }
}