import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType } from '../types';
import { IMemoryProvider, IProviderRegistry } from '../interfaces';

export interface RetrieveContext {
  query: MemoryQuery;
  providers: IMemoryProvider[];
  options: RetrieveOptions;
  startTime: number;
  results: MemorySearchResult[];
}

export interface RetrieveOptions {
  searchMode: 'semantic' | 'keyword' | 'vector' | 'graph' | 'hybrid' | 'timeline' | 'entity';
  includeEmbeddings?: boolean;
  includeEntities?: boolean;
  includeRelationships?: boolean;
  maxResults?: number;
  rerank?: boolean;
  minScore?: number;
}

export interface RetrieveResult {
  results: MemorySearchResult[];
  providerId: string;
  durationMs: number;
  totalScanned: number;
  searchMode: string;
}

export interface IRetrievePipeline {
  execute(context: RetrieveContext): Promise<RetrieveResult>;
  addStep(step: RetrieveStep): void;
  removeStep(name: string): boolean;
  getSteps(): RetrieveStep[];
}

export interface RetrieveStep {
  name: string;
  execute(context: RetrieveContext): Promise<RetrieveContext>;
  canSkip?(context: RetrieveContext): boolean;
}

export class RetrievePipeline implements IRetrievePipeline {
  private steps: RetrieveStep[] = [];
  private providerRegistry: IProviderRegistry;

  constructor(providerRegistry: IProviderRegistry) {
    this.providerRegistry = providerRegistry;
  }

  addStep(step: RetrieveStep): void {
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

  getSteps(): RetrieveStep[] {
    return [...this.steps];
  }

  async execute(context: RetrieveContext): Promise<RetrieveResult> {
    let currentContext = context;
    const allResults: MemorySearchResult[] = [];

    for (const step of this.steps) {
      if (step.canSkip && step.canSkip(currentContext)) {
        continue;
      }
      currentContext = await step.execute(currentContext);
      allResults.push(...currentContext.results);
    }

    // Deduplicate and sort by score
    const uniqueResults = this.deduplicateResults(allResults);
    const sortedResults = uniqueResults.sort((a, b) => b.score - a.score);
    const limitedResults = currentContext.options.maxResults
      ? sortedResults.slice(0, currentContext.options.maxResults)
      : sortedResults;

    return {
      results: limitedResults,
      providerId: currentContext.providers[0]?.metadata.id || 'unknown',
      durationMs: Date.now() - currentContext.startTime,
      totalScanned: allResults.length,
      searchMode: currentContext.options.searchMode,
    };
  }

  private deduplicateResults(results: MemorySearchResult[]): MemorySearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.item.id)) {
        return false;
      }
      seen.add(result.item.id);
      return true;
    });
  }
}

export class SelectProvidersStep implements RetrieveStep {
  name = 'select_providers';
  private providerRegistry: IProviderRegistry;

  constructor(providerRegistry: IProviderRegistry) {
    this.providerRegistry = providerRegistry;
  }

  async execute(context: RetrieveContext): Promise<RetrieveContext> {
    const { query } = context;
    const providers = this.providerRegistry.listByMemoryType(query.types?.[0] || 'knowledge');
    return { ...context, providers };
  }
}

export class SearchStep implements RetrieveStep {
  name = 'search';

  async execute(context: RetrieveContext): Promise<RetrieveContext> {
    const allResults: MemorySearchResult[] = [];

    for (const provider of context.providers) {
      try {
        const results = await provider.search(context.query);
        allResults.push(...results);
      } catch (error) {
        console.error(`Provider ${provider.metadata.id} search failed:`, error);
      }
    }

    return { ...context, results: allResults };
  }
}

export class RetrieveByQueryStep implements RetrieveStep {
  name = 'retrieve_by_query';

  async execute(context: RetrieveContext): Promise<RetrieveContext> {
    const allResults: MemorySearchResult[] = [];

    for (const provider of context.providers) {
      try {
        const results = await provider.retrieveByQuery(context.query, {
          includeEmbeddings: context.options.includeEmbeddings,
          includeEntities: context.options.includeEntities,
          includeRelationships: context.options.includeRelationships,
        });
        allResults.push(...results);
      } catch (error) {
        console.error(`Provider ${provider.metadata.id} retrieve failed:`, error);
      }
    }

    return { ...context, results: allResults };
  }
}

export class RerankStep implements RetrieveStep {
  name = 'rerank';

  canSkip(context: RetrieveContext): boolean {
    return !context.options.rerank || context.results.length <= 1;
  }

  async execute(context: RetrieveContext): Promise<RetrieveContext> {
    // Reranking would use a cross-encoder model
    // For now, just return the results as-is
    return context;
  }
}

export class FilterStep implements RetrieveStep {
  name = 'filter';

  async execute(context: RetrieveContext): Promise<RetrieveContext> {
    let filtered = context.results;

    if (context.options.minScore) {
      filtered = filtered.filter(r => r.score >= context.options.minScore!);
    }

    if (context.query.tags && context.query.tags.length > 0) {
      filtered = filtered.filter(r =>
        context.query.tags!.some(tag => r.item.tags.includes(tag))
      );
    }

    if (context.query.minImportance !== undefined) {
      filtered = filtered.filter(r => r.item.importance >= context.query.minImportance!);
    }

    if (context.query.minConfidence !== undefined) {
      filtered = filtered.filter(r => r.item.confidence >= context.query.minConfidence!);
    }

    if (context.query.visibility && context.query.visibility.length > 0) {
      filtered = filtered.filter(r => context.query.visibility!.includes(r.item.visibility));
    }

    if (context.query.security && context.query.security.length > 0) {
      filtered = filtered.filter(r => context.query.security!.includes(r.item.security));
    }

    return { ...context, results: filtered };
  }
}

export class EnrichStep implements RetrieveStep {
  name = 'enrich';

  canSkip(context: RetrieveContext): boolean {
    return !context.options.includeEmbeddings &&
           !context.options.includeEntities &&
           !context.options.includeRelationships;
  }

  async execute(context: RetrieveContext): Promise<RetrieveContext> {
    // Enrichment would fetch additional data from providers
    // For now, just return the results as-is
    return context;
  }
}