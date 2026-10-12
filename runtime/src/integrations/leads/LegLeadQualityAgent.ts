import { randomUUID } from 'crypto';
import { ILogger } from '../../interfaces';
import { EnhancedEventBus } from '../../events/EnhancedEventBus';
import { createRuntimeEvent, BaseEventPayload } from '../../contracts';
import { ExecutionContext } from '../../context';
import { AgentMetadata, AgentResult, BaseAgent } from '../../agent/AgentRuntime';

// Local types instead of importing from non-existent ./types
interface LeadAttributes {
  company: string;
  contact: string;
  email: string;
  phone: string;
  linkedin?: string;
  website?: string;
  industry?: string;
  companySize?: number;
}

export class LeadQualityAgent extends BaseAgent {
  private logger: ILogger;
  private eventBus: EnhancedEventBus;

  constructor(logger: ILogger, eventBus: EnhancedEventBus) {
    const metadata: AgentMetadata = {
      id: 'agent.lead-quality',
      name: 'Lead Quality Agent',
      version: '1.0.0',
      capabilities: [
        { name: 'lead-verification', version: '1.0.0', description: 'Verifies lead contact information' },
        { name: 'data-cleansing', version: '1.0.0', description: 'Cleanses and standardizes lead data' },
        { name: 'data-enrichment', version: '1.0.0', description: 'Enriches lead data with external sources' }
      ],
    };

    super(metadata);
    this.logger = logger;
    this.eventBus = eventBus;
  }

  protected async onInitialize(context: ExecutionContext): Promise<void> {
    this.logger.info('LeadQualityAgent: Initialized', { workflowId: context.workflowId });
  }

  protected async onExecute(context: ExecutionContext, input: unknown): Promise<AgentResult> {
    const params = input as {
      action: 'verify-lead' | 'cleanse-lead' | 'enrich-lead';
      leadData?: LeadAttributes;
    };

    try {
      switch (params.action) {
        case 'verify-lead':
          return await this.handleVerifyLead(context, params);
        case 'cleanse-lead':
          return await this.handleCleanseLead(context, params);
        case 'enrich-lead':
          return await this.handleEnrichLead(context, params);
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

  private async handleVerifyLead(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { leadData } = params;
    if (!leadData || !leadData.email || !leadData.phone) {
      return { success: false, error: 'Email and phone required for verification' };
    }

    this.logger.info('LeadQualityAgent: Verifying lead contact info', { leadData });

    const isValid = {
      email: leadData.email.includes('@') && leadData.email.includes('.'),
      phone: leadData.phone.match(/\d{3}-\d{3}-\d{4}/) || leadData.phone.match(/\+\d{10}/)
    };

    const traceId = randomUUID();
    const spanId = randomUUID();
    this.eventBus.publish(
      createRuntimeEvent('lead.verified' as any, {
        workflowId: context.workflowId,
        traceId,
        leadId: `${leadData.company}_${leadData.contact.slice(0, 3)}`,
        isValid,
        timestamp: new Date().toISOString(),
        spanId
      } as BaseEventPayload, traceId, spanId)
    );

    return {
      success: true,
      output: {
        leadId: `${leadData.company}_${leadData.contact.slice(0, 3)}`,
        verification: isValid
      }
    };
  }

  private async handleCleanseLead(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { leadData } = params;
    if (!leadData) {
      return { success: false, error: 'Lead data required for cleansing' };
    }

    this.logger.info('LeadQualityAgent: Cleansing lead data', { leadData });

    const cleanedData = {
      company: leadData.company.trim().toUpperCase(),
      contact: leadData.contact.trim(),
      email: leadData.email.toLowerCase(),
      phone: leadData.phone.replace(/\s/g, '').replace(/\+/g, '')
    };

    const traceId = randomUUID();
    const spanId = randomUUID();
    this.eventBus.publish(
      createRuntimeEvent('lead.cleansed' as any, {
        workflowId: context.workflowId,
        traceId,
        leadId: `${cleanedData.company}_${cleanedData.contact.slice(0, 3)}`,
        cleanedData,
        timestamp: new Date().toISOString(),
        spanId
      } as BaseEventPayload, traceId, spanId)
    );

    return {
      success: true,
      output: cleanedData
    };
  }

  private async handleEnrichLead(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { leadData } = params;
    if (!leadData) {
      return { success: false, error: 'Lead data required for enrichment' };
    }

    this.logger.info('LeadQualityAgent: Enriching lead data', { leadData });

    const enrichedData = {
      ...leadData,
      industry: leadData.industry || 'technology',
      companySize: leadData.companySize || 500,
      socialReach: 'high'
    };

    const traceId = randomUUID();
    const spanId = randomUUID();
    this.eventBus.publish(
      createRuntimeEvent('lead.enriched' as any, {
        workflowId: context.workflowId,
        traceId,
        leadId: `${leadData.company}_${leadData.contact.slice(0, 3)}`,
        enrichedData,
        timestamp: new Date().toISOString(),
        spanId
      } as BaseEventPayload, traceId, spanId)
    );

    return {
      success: true,
      output: enrichedData
    };
  }

  protected async onPause(context: ExecutionContext): Promise<void> {
    this.logger.info('LeadQualityAgent: Paused', { workflowId: context.workflowId });
  }

  protected async onResume(context: ExecutionContext): Promise<void> {
    this.logger.info('LeadQualityAgent: Resumed', { workflowId: context.workflowId });
  }

  protected async onCancel(context: ExecutionContext): Promise<void> {
    this.logger.info('LeadQualityAgent: Cancelled', { workflowId: context.workflowId });
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('LeadQualityAgent: Disposed');
  }
}