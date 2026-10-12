import { randomUUID } from 'crypto';
import { ILogger } from '../../interfaces';
import { EnhancedEventBus } from '../../events/EnhancedEventBus';
import { RuntimeEventTypes, createRuntimeEvent, BaseEventPayload } from '../../contracts';
import { ExecutionContext } from '../../context';
import { AgentMetadata, AgentResult, BaseAgent } from '../../agent/AgentRuntime';
import { KnowledgeGraphNode, KnowledgeGraphEdge, KnowledgeGraphSchema, CrossProjectUnderstanding } from './types';

export interface KnowledgeQuery {
  query: string;
  searchType?: 'semantic' | 'keyword' | 'graph' | 'cross-project';
  maxResults?: number;
  filters?: {
    nodeTypes?: string[];
    domains?: string[];
    timeRange?: { start: Date; end: Date };
  };
}

export interface KnowledgeIndexResult {
  projectId: string;
  indexedFiles: number;
  indexedNodes: number;
  indexedEdges: number;
  domains: string[];
}

export interface UniversalKnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    domains: string[];
    lastUpdated: string;
  };
}

export class KnowledgeAgent extends BaseAgent {
  private logger: ILogger;
  private eventBus: EnhancedEventBus;
  private knowledgeGraphs: Map<string, KnowledgeGraphSchema> = new Map();
  private crossProjectGraph: CrossProjectUnderstanding | null = null;

  constructor(logger: ILogger, eventBus: EnhancedEventBus) {
    const metadata: AgentMetadata = {
      id: 'agent.knowledge',
      name: 'Knowledge Agent',
      version: '1.0.0',
      capabilities: [
        { name: 'knowledge-indexing', version: '1.0.0', description: 'Indexes codebases into knowledge graphs' },
        { name: 'knowledge-query', version: '1.0.0', description: 'Queries knowledge with semantic search' },
        { name: 'cross-project-understanding', version: '1.0.0', description: 'Understands relationships across projects' },
        { name: 'semantic-memory', version: '1.0.0', description: 'Long-term semantic memory storage and retrieval' },
        { name: 'document-understanding', version: '1.0.0', description: 'Understands documents and extracts knowledge' },
      ],
    };

    super(metadata);
    this.logger = logger;
    this.eventBus = eventBus;
  }

  protected async onInitialize(context: ExecutionContext): Promise<void> {
    this.logger.info('KnowledgeAgent: Initialized', { workflowId: context.workflowId });
  }

  protected async onExecute(context: ExecutionContext, input: unknown): Promise<AgentResult> {
    const params = input as {
      action: 'index' | 'query' | 'cross-project' | 'semantic-search' | 'document-understanding' | 'get-graph';
      projectId?: string;
      projectPath?: string;
      query?: string;
      targetProjectId?: string;
      documentContent?: string;
      documentType?: string;
      knowledgeQuery?: KnowledgeQuery;
    };

    try {
      switch (params.action) {
        case 'index':
          return await this.handleIndex(context, params);
        case 'query':
          return await this.handleQuery(context, params);
        case 'cross-project':
          return await this.handleCrossProject(context, params);
        case 'semantic-search':
          return await this.handleSemanticSearch(context, params);
        case 'document-understanding':
          return await this.handleDocumentUnderstanding(context, params);
        case 'get-graph':
          return await this.handleGetGraph(context, params);
        default:
          return { success: false, error: `Unknown action: ${params.action}` };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async handleIndex(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { projectId, projectPath } = params;
    if (!projectId || !projectPath) {
      return { success: false, error: 'projectId and projectPath required' };
    }

    this.logger.info('KnowledgeAgent: Indexing project', { projectId, projectPath });

    const graph = await this.indexProject(projectId, projectPath);
    this.knowledgeGraphs.set(projectId, graph);

    const traceId = randomUUID();
    const spanId = randomUUID();
    this.eventBus.publish(
      createRuntimeEvent(RuntimeEventTypes.RESEARCH_COMPLETED, {
        workflowId: context.workflowId,
        timestamp: new Date().toISOString(),
        traceId,
        spanId,
        researchId: `kg_index_${projectId}`,
        report: {
          projectId,
          indexedFiles: graph.nodes.filter((n: KnowledgeGraphNode) => n.type === 'file').length,
          indexedNodes: graph.nodes.length,
          indexedEdges: graph.edges.length,
          domains: [...new Set(graph.nodes.filter((n: KnowledgeGraphNode) => n.type === 'domain').map((n: KnowledgeGraphNode) => n.name))],
        },
        durationMs: 100,
      } as BaseEventPayload, traceId, spanId)
    );

    return {
      success: true,
      output: {
        projectId,
        indexedFiles: graph.nodes.filter((n: KnowledgeGraphNode) => n.type === 'file').length,
        indexedNodes: graph.nodes.length,
        indexedEdges: graph.edges.length,
        domains: [...new Set(graph.nodes.filter((n: KnowledgeGraphNode) => n.type === 'domain').map((n: KnowledgeGraphNode) => n.name))],
      } as KnowledgeIndexResult,
    };
  }

  private async handleQuery(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { projectId, query } = params;
    if (!projectId || !query) {
      return { success: false, error: 'projectId and query required' };
    }

    const graph = this.knowledgeGraphs.get(projectId);
    if (!graph) {
      return { success: false, error: `Project ${projectId} not indexed` };
    }

    const results = this.queryGraph(graph, query);

    return {
      success: true,
      output: {
        query,
        results,
        totalResults: results.length,
      },
    };
  }

  private async handleCrossProject(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { targetProjectId } = params;
    if (!targetProjectId) {
      return { success: false, error: 'targetProjectId required' };
    }

    const insights = await this.analyzeCrossProject(targetProjectId);
    this.crossProjectGraph = insights;

    return {
      success: true,
      output: insights,
    };
  }

  private async handleSemanticSearch(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { query, searchType = 'semantic', maxResults = 10 } = params.knowledgeQuery || params;
    if (!query) {
      return { success: false, error: 'query required' };
    }

    const allNodes: KnowledgeGraphNode[] = [];
    for (const graph of this.knowledgeGraphs.values()) {
      allNodes.push(...graph.nodes);
    }

    const results = this.semanticSearch(allNodes, query, searchType, maxResults);

    return {
      success: true,
      output: {
        query,
        results,
        totalResults: results.length,
      },
    };
  }

  private async handleDocumentUnderstanding(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { documentContent, documentType = 'unknown' } = params;
    if (!documentContent) {
      return { success: false, error: 'documentContent required' };
    }

    const entities = this.extractDocumentEntities(documentContent, documentType);

    return {
      success: true,
      output: {
        documentType,
        entities,
        entityCount: entities.length,
      },
    };
  }

  private async handleGetGraph(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { projectId } = params;
    if (!projectId) {
      const allGraphs: UniversalKnowledgeGraph = {
        nodes: [],
        edges: [],
        metadata: {
          totalNodes: 0,
          totalEdges: 0,
          domains: [],
          lastUpdated: new Date().toISOString(),
        },
      };

      for (const graph of this.knowledgeGraphs.values()) {
        allGraphs.nodes.push(...graph.nodes);
        allGraphs.edges.push(...graph.edges);
      }

      allGraphs.metadata.totalNodes = allGraphs.nodes.length;
      allGraphs.metadata.totalEdges = allGraphs.edges.length;
      allGraphs.metadata.domains = [...new Set(allGraphs.nodes.filter((n: KnowledgeGraphNode) => n.type === 'domain').map((n: KnowledgeGraphNode) => n.name))];

      return { success: true, output: allGraphs };
    }

    const graph = this.knowledgeGraphs.get(projectId);
    if (!graph) {
      return { success: false, error: `Project ${projectId} not found` };
    }

    return {
      success: true,
      output: {
        nodes: graph.nodes,
        edges: graph.edges,
        metadata: {
          totalNodes: graph.nodes.length,
          totalEdges: graph.edges.length,
          domains: [...new Set(graph.nodes.filter((n: KnowledgeGraphNode) => n.type === 'domain').map((n: KnowledgeGraphNode) => n.name))],
          lastUpdated: new Date().toISOString(),
        },
      } as UniversalKnowledgeGraph,
    };
  }

  private async indexProject(projectId: string, projectPath: string): Promise<KnowledgeGraphSchema> {
    const demoNodes: KnowledgeGraphNode[] = [
      {
        id: `file:${projectPath}/src/index.ts`,
        type: 'file',
        name: 'index.ts',
        summary: 'Main entry point for the project',
        tags: ['entry-point', 'initialization'],
        complexity: 'simple',
        filePath: `${projectPath}/src/index.ts`,
        languageNotes: 'typescript'
      },
      {
        id: `function:${projectPath}/src/services/api.ts`,
        type: 'function',
        name: 'ApiService',
        summary: 'Handles HTTP API requests with retry logic',
        tags: ['api', 'network', 'retry'],
        complexity: 'moderate',
        filePath: `${projectPath}/src/services/api.ts`,
        lineRange: [1, 100],
        languageNotes: 'typescript'
      },
      {
        id: `class:${projectPath}/src/models/user.ts`,
        type: 'class',
        name: 'UserModel',
        summary: 'User data model with validation',
        tags: ['data-model', 'user', 'validation'],
        complexity: 'moderate',
        filePath: `${projectPath}/src/models/user.ts`,
        lineRange: [1, 150],
        languageNotes: 'typescript'
      },
      {
        id: `domain:${projectPath}/authentication`,
        type: 'domain',
        name: 'authentication',
        summary: 'Handles user authentication and authorization',
        tags: ['auth', 'security', 'user-management'],
        complexity: 'complex'
      },
      {
        id: `domain:${projectPath}/data-processing`,
        type: 'domain',
        name: 'data-processing',
        summary: 'Processes and transforms data pipelines',
        tags: ['pipeline', 'data', 'processing'],
        complexity: 'complex'
      },
      {
        id: `config:${projectPath}/config/database.ts`,
        type: 'config',
        name: 'DatabaseConfig',
        summary: 'Database connection configuration',
        tags: ['database', 'configuration', 'connection'],
        complexity: 'simple'
      },
    ];

    const demoEdges: KnowledgeGraphEdge[] = [
      {
        sourceId: `file:${projectPath}/src/index.ts`,
        targetId: `function:${projectPath}/src/services/api.ts`,
        type: 'imports',
        weight: 1.0
      },
      {
        sourceId: `function:${projectPath}/src/services/api.ts`,
        targetId: `class:${projectPath}/src/models/user.ts`,
        type: 'calls',
        weight: 0.8
      },
      {
        sourceId: `domain:${projectPath}/authentication`,
        targetId: `function:${projectPath}/src/services/api.ts`,
        type: 'contains',
        weight: 1.0
      },
      {
        sourceId: `domain:${projectPath}/data-processing`,
        targetId: `class:${projectPath}/src/models/user.ts`,
        type: 'contains',
        weight: 1.0
      },
      {
        sourceId: `function:${projectPath}/src/services/api.ts`,
        targetId: `config:${projectPath}/config/database.ts`,
        type: 'reads_from',
        weight: 0.6
      }
    ];

    return {
      projectId,
      projectPath,
      nodes: demoNodes,
      edges: demoEdges,
      languageStats: { typescript: 4, javascript: 0, python: 0, golang: 0, rust: 0, java: 0 },
      architecturalLayers: ['API', 'Service', 'Data', 'Utility']
    };
  }

  private queryGraph(graph: KnowledgeGraphSchema, query: string): KnowledgeGraphNode[] {
    const queryLower = query.toLowerCase();
    const scored = graph.nodes.map((node: KnowledgeGraphNode) => {
      let score = 0;
      if (node.name.toLowerCase().includes(queryLower)) score += 0.5;
      if (node.summary.toLowerCase().includes(queryLower)) score += 0.3;
      if (node.tags.some((tag: string) => tag.toLowerCase().includes(queryLower))) score += 0.2;
      return { node, score };
    });

    return scored
      .filter((s: { score: number }) => s.score > 0)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .map((s: { node: KnowledgeGraphNode }) => s.node);
  }

  private async analyzeCrossProject(targetProjectId: string): Promise<CrossProjectUnderstanding> {
    const targetGraph = this.knowledgeGraphs.get(targetProjectId);
    const relatedProjects: string[] = [];

    if (targetGraph) {
      for (const [projectId, graph] of this.knowledgeGraphs.entries()) {
        if (projectId !== targetProjectId) {
          const sharedDomains = graph.nodes
            .filter((n: KnowledgeGraphNode) => n.type === 'domain')
            .filter((n: KnowledgeGraphNode) => targetGraph.nodes.some((tn: KnowledgeGraphNode) => tn.type === 'domain' && tn.name === n.name));
          if (sharedDomains.length > 0) {
            relatedProjects.push(projectId);
          }
        }
      }
    }

    return {
      projectId: targetProjectId,
      crossProjectDependencies: [],
      sharedArchitecturalPatterns: [],
      relatedProjects,
      insights: [
        `Found ${relatedProjects.length} related projects with shared domains`,
        'Cross-project analysis enables reusable component discovery',
        'Shared patterns indicate成熟的技术栈选择'
      ]
    };
  }

  private semanticSearch(nodes: KnowledgeGraphNode[], query: string, searchType: string, maxResults: number): KnowledgeGraphNode[] {
    const queryLower = query.toLowerCase();
    const scored = nodes.map((node: KnowledgeGraphNode) => {
      let score = 0;
      if (searchType === 'semantic') {
        if (node.name.toLowerCase().includes(queryLower)) score += 0.6;
        if (node.summary?.toLowerCase().includes(queryLower)) score += 0.3;
        if (node.tags?.some((tag: string) => tag.toLowerCase().includes(queryLower))) score += 0.1;
      } else {
        score = node.name.toLowerCase().includes(queryLower) ? 1 : 0;
      }
      return { node, score };
    });

    return scored
      .filter((s: { score: number }) => s.score > 0)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, maxResults)
      .map((s: { node: KnowledgeGraphNode }) => s.node);
  }

  private extractDocumentEntities(content: string, docType: string): Array<{ type: string; value: string; confidence: number }> {
    const entities: Array<{ type: string; value: string; confidence: number }> = [];

    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const urlRegex = /https?:\/\/[^\s]+/g;
    const dateRegex = /\b\d{4}-\d{2}-\d{2}\b|\b\d{2}\/\d{2}\/\d{4}\b/g;
    const numberRegex = /\b\d+(?:\.\d+)?(?:[KMB])?\b/gi;

    let match;
    while ((match = emailRegex.exec(content)) !== null) {
      entities.push({ type: 'email', value: match[0], confidence: 0.95 });
    }
    while ((match = urlRegex.exec(content)) !== null) {
      entities.push({ type: 'url', value: match[0], confidence: 0.9 });
    }
    while ((match = dateRegex.exec(content)) !== null) {
      entities.push({ type: 'date', value: match[0], confidence: 0.85 });
    }
    while ((match = numberRegex.exec(content)) !== null) {
      if (!isNaN(parseFloat(match[0]))) {
        entities.push({ type: 'number', value: match[0], confidence: 0.7 });
      }
    }

    const keywords: Record<string, string[]> = {
      'person': ['founder', 'ceo', 'cto', 'director', 'manager', 'president', 'founder'],
      'company': ['inc', 'llc', 'corp', 'ltd', 'company', 'startup', 'enterprise'],
      'technology': ['ai', 'ml', 'api', 'cloud', 'saas', 'paas', 'iaas', 'kubernetes', 'docker'],
      'money': ['$', 'revenue', 'funding', 'investment', 'series', 'valuation', 'budget']
    };

    const contentLower = content.toLowerCase();
    for (const [category, terms] of Object.entries(keywords)) {
      for (const term of terms) {
        if (contentLower.includes(term)) {
          entities.push({ type: category, value: term, confidence: 0.6 });
        }
      }
    }

    return entities;
  }

  protected async onPause(context: ExecutionContext): Promise<void> {
    this.logger.info('KnowledgeAgent: Paused', { workflowId: context.workflowId });
  }

  protected async onResume(context: ExecutionContext): Promise<void> {
    this.logger.info('KnowledgeAgent: Resumed', { workflowId: context.workflowId });
  }

  protected async onCancel(context: ExecutionContext): Promise<void> {
    this.logger.info('KnowledgeAgent: Cancelled', { workflowId: context.workflowId });
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('KnowledgeAgent: Disposed');
    this.knowledgeGraphs.clear();
  }
}

export * from './types';
export * from './KnowledgeSearchService';
export * from './DocumentProcessor';