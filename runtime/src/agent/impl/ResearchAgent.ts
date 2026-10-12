import { randomUUID } from 'crypto';
import { ILogger } from '../../interfaces';
import { EnhancedEventBus } from '../../events/EnhancedEventBus';
import { RuntimeEventTypes, createRuntimeEvent, BaseEventPayload } from '../../contracts';
import { ExecutionContext } from '../../context';
import { AgentMetadata, AgentResult, BaseAgent } from '../AgentRuntime';
import { AgentCapability } from '../AgentDefinition';
import { DataService } from '../../services/DataService';
import { AIService } from '../../ai/ai-service';
import { AIMessage } from '../../ai/providers/base';

export class ResearchAgent extends BaseAgent {
  private logger: ILogger;
  private eventBus: EnhancedEventBus;
  private dataService: DataService;
  private aiService: AIService;

  constructor(
    logger: ILogger,
    eventBus: EnhancedEventBus,
    dataService: DataService,
    aiService?: AIService
  ) {
    const metadata: AgentMetadata = {
      id: 'agent.research',
      name: 'Research Agent',
      version: '1.0.0',
      capabilities: [
        { name: 'research', version: '1.0.0', description: 'Performs business research' },
        { name: 'web-scraping', version: '1.0.0', description: 'Extracts data from websites' },
        { name: 'competitor-analysis', version: '1.0.0', description: 'Analyzes competitor businesses' },
      ],
    };

    super(metadata);
    this.logger = logger;
    this.eventBus = eventBus;
    this.dataService = dataService;
    this.aiService = aiService!;
  }

  protected async onInitialize(context: ExecutionContext): Promise<void> {
    this.logger.info('ResearchAgent: Initialized', { workflowId: context.workflowId });
  }

  protected async onExecute(context: ExecutionContext, input: unknown): Promise<AgentResult> {
    const params = input as { query: string; depth?: 'basic' | 'standard' | 'deep' };

    try {
      const businesses = await this.dataService.getBusinesses(params.query, 5);

      const researchResults = [];
      for (const business of businesses) {
        const report = await this.dataService.generateResearchReport(business);

        let enhancedInsights = report.overallInsights;
        if (this.aiService) {
          try {
            const messages: AIMessage[] = [
              { role: 'system', content: `You are a business research analyst. Analyze the following business info and provide enhanced insights. Return ONLY valid JSON with fields: insights (string array), priorityActions (string array), riskFactors (string array).` },
              { role: 'user', content: JSON.stringify({
                businessName: business.name,
                domain: business.domain,
                industry: business.industry,
                description: business.description,
              }) },
            ];

            const aiResponse = await this.aiService.complete(messages, { maxTokens: 1024 });
            const aiData = JSON.parse(aiResponse.content);
            enhancedInsights = [...report.overallInsights, ...(aiData.insights || [])];
            report.priorityActions = [...report.priorityActions, ...(aiData.priorityActions || [])];
          } catch (aiError) {
            this.logger.warn('ResearchAgent: AI enhancement failed, using base insights', {
              business: business.name,
              error: aiError instanceof Error ? aiError.message : String(aiError),
            });
          }
        }

        researchResults.push({
          business: {
            name: business.name,
            domain: business.domain,
            location: business.location,
          },
          insights: enhancedInsights,
          priorityActions: report.priorityActions,
        });

        const traceId = randomUUID();
        const spanId = randomUUID();

        this.eventBus.publish(
          createRuntimeEvent(RuntimeEventTypes.RESEARCH_COMPLETED, {
            workflowId: context.workflowId,
            timestamp: new Date().toISOString(),
            traceId,
            spanId,
            researchId: `research_${business.id}`,
            report: {
              companyProfile: report.companyProfile,
              websiteAnalysis: report.websiteAnalysis,
              competitorAnalysis: undefined,
              technologyDetection: report.technologyDetection,
              seoAnalysis: report.seoAnalysis,
              overallInsights: enhancedInsights,
              priorityActions: report.priorityActions,
            },
            durationMs: 1000,
          } as BaseEventPayload, traceId, spanId)
        );
      }

      return {
        success: true,
        output: {
          query: params.query,
          businessesFound: businesses.length,
          results: researchResults,
        },
        metadata: {
          agentId: this.metadata.id,
          timestamp: new Date().toISOString(),
          aiEnhanced: !!this.aiService,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        metadata: {
          agentId: this.metadata.id,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  protected async onPause(context: ExecutionContext): Promise<void> {
    this.logger.info('ResearchAgent: Paused', { workflowId: context.workflowId });
  }

  protected async onResume(context: ExecutionContext): Promise<void> {
    this.logger.info('ResearchAgent: Resumed', { workflowId: context.workflowId });
  }

  protected async onCancel(context: ExecutionContext): Promise<void> {
    this.logger.info('ResearchAgent: Cancelled', { workflowId: context.workflowId });
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('ResearchAgent: Disposed');
  }
}

export class RevenueAgent extends BaseAgent {
  private logger: ILogger;
  private eventBus: EnhancedEventBus;
  private dataService: DataService;
  private aiService: AIService;

  constructor(
    logger: ILogger,
    eventBus: EnhancedEventBus,
    dataService: DataService,
    aiService?: AIService
  ) {
    const metadata: AgentMetadata = {
      id: 'agent.revenue',
      name: 'Revenue Agent',
      version: '1.0.0',
      capabilities: [
        { name: 'lead-scoring', version: '1.0.0', description: 'Scores business leads' },
        { name: 'proposal-generation', version: '1.0.0', description: 'Generates sales proposals' },
        { name: 'revenue-tracking', version: '1.0.0', description: 'Tracks revenue opportunities' },
      ],
    };

    super(metadata);
    this.logger = logger;
    this.eventBus = eventBus;
    this.dataService = dataService;
    this.aiService = aiService!;
  }

  protected async onInitialize(context: ExecutionContext): Promise<void> {
    this.logger.info('RevenueAgent: Initialized', { workflowId: context.workflowId });
  }

  protected async onExecute(context: ExecutionContext, input: unknown): Promise<AgentResult> {
    const params = input as { action: 'score-lead' | 'generate-proposal'; data: Record<string, unknown> };

    try {
      if (params.action === 'score-lead') {
        const businessName = params.data.businessName as string;
        const businesses = await this.dataService.getBusinesses(businessName, 1);

        if (businesses.length === 0) {
          return { success: false, error: 'No business found' };
        }

        const lead = await this.dataService.scoreLead(businesses[0]);
        const traceId = randomUUID();
        const spanId = randomUUID();

        this.eventBus.publish(
          createRuntimeEvent(RuntimeEventTypes.LEAD_SCORED, {
            workflowId: context.workflowId,
            timestamp: new Date().toISOString(),
            traceId,
            spanId,
            leadId: lead.id,
            score: lead.score,
            tier: lead.tier,
            factors: lead.factors,
          } as BaseEventPayload, traceId, spanId)
        );

        return {
          success: true,
          output: lead,
        };
      }

      if (params.action === 'generate-proposal') {
        const leadData = params.data.lead as { id: string; business: any };
        const lead = await this.dataService.scoreLead(leadData.business);
        let proposal = await this.dataService.generateProposal(lead);

        if (this.aiService) {
          try {
            const messages: AIMessage[] = [
              { role: 'system', content: `You are a professional proposal writer. Given the lead information, enhance the proposal sections. Return ONLY valid JSON with fields: executiveSummary (string), keyChallenges (string array), proposedSolutions (string array), timelineWeeks (number), investmentAmount (string).` },
              { role: 'user', content: JSON.stringify({
                clientName: leadData.business.name,
                industry: leadData.business.industry,
                score: lead.score,
                factors: lead.factors,
              }) },
            ];

            const aiResponse = await this.aiService.complete(messages, { maxTokens: 1500 });
            const aiData = JSON.parse(aiResponse.content);

            proposal = {
              ...proposal,
              sections: [
                `Executive Summary: ${aiData.executiveSummary || ''}`,
                ...proposal.sections,
                `Key Challenges: ${(aiData.keyChallenges || []).join(', ')}`,
                `Proposed Solutions: ${(aiData.proposedSolutions || []).join(', ')}`,
                `Timeline: ${aiData.timelineWeeks || 8} weeks`,
                `Investment: ${aiData.investmentAmount || 'Contact for quote'}`,
              ],
            };
          } catch (aiError) {
            this.logger.warn('RevenueAgent: AI proposal enhancement failed', {
              leadId: lead.id,
              error: aiError instanceof Error ? aiError.message : String(aiError),
            });
          }
        }

        const traceId = randomUUID();
        const spanId = randomUUID();

        this.eventBus.publish(
          createRuntimeEvent(RuntimeEventTypes.PROPOSAL_GENERATED, {
            workflowId: context.workflowId,
            timestamp: new Date().toISOString(),
            traceId,
            spanId,
            proposalId: proposal.id,
            leadId: proposal.leadId,
            clientName: proposal.clientName,
            sections: proposal.sections,
          } as BaseEventPayload, traceId, spanId)
        );

        return {
          success: true,
          output: proposal,
        };
      }

      return { success: false, error: 'Unknown action' };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  protected async onPause(context: ExecutionContext): Promise<void> {
    this.logger.info('RevenueAgent: Paused', { workflowId: context.workflowId });
  }

  protected async onResume(context: ExecutionContext): Promise<void> {
    this.logger.info('RevenueAgent: Resumed', { workflowId: context.workflowId });
  }

  protected async onCancel(context: ExecutionContext): Promise<void> {
    this.logger.info('RevenueAgent: Cancelled', { workflowId: context.workflowId });
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('RevenueAgent: Disposed');
  }
}

export class MemoryAgent extends BaseAgent {
  private logger: ILogger;
  private eventBus: EnhancedEventBus;
  private memoryBinding: any;

  constructor(
    logger: ILogger,
    eventBus: EnhancedEventBus,
    memoryBinding: any
  ) {
    const metadata: AgentMetadata = {
      id: 'agent.memory',
      name: 'Memory Agent',
      version: '1.0.0',
      capabilities: [
        { name: 'memory-storage', version: '1.0.0', description: 'Stores information in memory' },
        { name: 'memory-retrieval', version: '1.0.0', description: 'Retrieves information from memory' },
        { name: 'context-management', version: '1.0.0', description: 'Manages agent context' },
      ],
    };

    super(metadata);
    this.logger = logger;
    this.eventBus = eventBus;
    this.memoryBinding = memoryBinding;
  }

  protected async onInitialize(context: ExecutionContext): Promise<void> {
    this.logger.info('MemoryAgent: Initialized', { workflowId: context.workflowId });
  }

  protected async onExecute(context: ExecutionContext, input: unknown): Promise<AgentResult> {
    const params = input as { action: 'store' | 'retrieve' | 'delete'; key: string; value?: unknown; scope?: string };

    try {
      if (params.action === 'store') {
        const id = this.memoryBinding.store(params.key, params.value, params.scope ?? 'agent');
        return {
          success: true,
          output: { stored: true, id, key: params.key },
        };
      }

      if (params.action === 'retrieve') {
        const value = this.memoryBinding.retrieve(params.key, params.scope);
        return {
          success: true,
          output: { key: params.key, value, found: value !== undefined },
        };
      }

      if (params.action === 'delete') {
        const deleted = this.memoryBinding.delete(params.key, params.scope);
        return {
          success: true,
          output: { deleted, key: params.key },
        };
      }

      return { success: false, error: 'Unknown action' };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  protected async onPause(context: ExecutionContext): Promise<void> {
    this.logger.info('MemoryAgent: Paused', { workflowId: context.workflowId });
  }

  protected async onResume(context: ExecutionContext): Promise<void> {
    this.logger.info('MemoryAgent: Resumed', { workflowId: context.workflowId });
  }

  protected async onCancel(context: ExecutionContext): Promise<void> {
    this.logger.info('MemoryAgent: Cancelled', { workflowId: context.workflowId });
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('MemoryAgent: Disposed');
  }
}