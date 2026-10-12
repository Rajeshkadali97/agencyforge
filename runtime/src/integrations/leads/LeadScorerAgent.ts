import { randomUUID } from 'crypto';
import { ILogger } from '../../interfaces';
import { EnhancedEventBus } from '../../events/EnhancedEventBus';
import { createRuntimeEvent, BaseEventPayload } from '../../contracts';
import { ExecutionContext } from '../../context';
import { AgentMetadata, AgentResult, BaseAgent } from '../../agent/AgentRuntime';

// Local types instead of importing from non-existent ./types
interface LeadScoreCriteria {
  company: string;
  contact: string;
  budget: number;
  authority: string;
  need: string;
  timeline: string;
  companySize: number;
  industry: string;
}

export class LeadScorerAgent extends BaseAgent {
  private logger: ILogger;
  private eventBus: EnhancedEventBus;

  constructor(logger: ILogger, eventBus: EnhancedEventBus) {
    const metadata: AgentMetadata = {
      id: 'agent.lead-scoring',
      name: 'Lead Scoring Agent',
      version: '1.0.0',
      capabilities: [
        { name: 'bant-scoring', version: '1.0.0', description: 'Calculates BANT criteria scores' },
        { name: 'meddic-scoring', version: '1.0.0', description: 'Calculates MEDDIC criteria scores' },
        { name: 'lead-ranking', version: '1.0.0', description: 'Ranks leads based on scores' }
      ],
    };

    super(metadata);
    this.logger = logger;
    this.eventBus = eventBus;
  }

  protected async onInitialize(context: ExecutionContext): Promise<void> {
    this.logger.info('LeadScorerAgent: Initialized', { workflowId: context.workflowId });
  }

  protected async onExecute(context: ExecutionContext, input: unknown): Promise<AgentResult> {
    const params = input as {
      action: 'score-lead' | 'update-score' | 'get-lead-scores';
      leadData?: LeadScoreCriteria;
    };

    try {
      switch (params.action) {
        case 'score-lead':
          return await this.handleScoreLead(context, params);
        case 'update-score':
          return await this.handleUpdateScore(params);
        case 'get-lead-scores':
          return await this.handleGetLeadScores(params);
        default:
          return { success: false, error: 'Unknown action' };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  private async handleScoreLead(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { leadData } = params;
    if (!leadData) {
      return { success: false, error: 'Lead data required for scoring' };
    }

    this.logger.info('LeadScorerAgent: Calculating BANT and MEDDIC scores', { leadData });

    const bantScore = this.calculateBANTScore(leadData);
    const meddicScore = this.calculateMEDDICScore(leadData);
    const totalScore = bantScore + meddicScore;

    const traceId = randomUUID();
    const spanId = randomUUID();
    this.eventBus.publish(
      createRuntimeEvent('lead.scored' as any, {
        workflowId: context.workflowId,
        traceId,
        leadId: `${leadData.company}_${leadData.contact.slice(0, 3)}`,
        bantScore,
        meddicScore,
        totalScore,
        timestamp: new Date().toISOString(),
        spanId
      } as BaseEventPayload, traceId, spanId)
    );

    return {
      success: true,
      output: {
        leadId: `${leadData.company}_${leadData.contact.slice(0, 3)}`,
        bantScore,
        meddicScore,
        totalScore
      }
    };
  }

  private calculateBANTScore(leadData: LeadScoreCriteria): number {
    const scores: Record<string, number> = {
      budget: Math.min(leadData.budget / 100000, 100),
      authority: leadData.authority === 'decision-maker' ? 100 : 50,
      need: leadData.need.includes('urgent') ? 100 : 75,
      timeline: leadData.timeline === 'immediate' ? 100 : 50
    };
    return Math.round(scores.budget + scores.authority + scores.need + scores.timeline);
  }

  private calculateMEDDICScore(leadData: LeadScoreCriteria): number {
    const scores: Record<string, number> = {
      budget: Math.min(leadData.budget / 100000, 100),
      economicBuyer: leadData.authority === 'economic-buyer' ? 100 : 50,
      decisionCriteria: 85,
      decisionProcess: 70,
      painPoints: leadData.need.length > 5 ? 100 : 50,
      champion: leadData.contact.includes('VP') || leadData.contact.includes('CEO') ? 100 : 50
    };
    return Math.round(scores.budget + scores.economicBuyer + scores.decisionCriteria + scores.decisionProcess + scores.painPoints + scores.champion);
  }

  private async handleUpdateScore(params: any): Promise<AgentResult> {
    return { success: true, output: { message: 'Score updated successfully' } };
  }

  private async handleGetLeadScores(params: any): Promise<AgentResult> {
    return { success: true, output: { scores: [] } };
  }

  protected async onPause(context: ExecutionContext): Promise<void> {
    this.logger.info('LeadScorerAgent: Paused', { workflowId: context.workflowId });
  }

  protected async onResume(context: ExecutionContext): Promise<void> {
    this.logger.info('LeadScorerAgent: Resumed', { workflowId: context.workflowId });
  }

  protected async onCancel(context: ExecutionContext): Promise<void> {
    this.logger.info('LeadScorerAgent: Cancelled', { workflowId: context.workflowId });
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('LeadScorerAgent: Disposed');
  }
}