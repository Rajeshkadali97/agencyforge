import { EnhancedEventBus } from '../events/EnhancedEventBus';
import { getPluginRegistry } from '../plugins/PluginRegistry';
import { RuntimeEventTypes } from '../contracts';
import { ILogger } from '../interfaces';

export interface ResearchRequest {
  company_name?: string;
  domain?: string;
  website_url?: string;
  industry?: string;
  location?: string;
  depth?: 'basic' | 'standard' | 'deep';
}

export interface ResearchBridgeConfig {
  eventBus: EnhancedEventBus;
  logger: ILogger;
}

/**
 * Bridges the runtime to @agencyforge/research via the plugin system.
 * Runtime never imports research directly — delegates to 'research.company'
 * plugin capability if registered, returns not-available otherwise.
 */
export class ResearchBridge {
  private eventBus: EnhancedEventBus;
  private logger: ILogger;

  constructor(config: ResearchBridgeConfig) {
    this.eventBus = config.eventBus;
    this.logger = config.logger;
  }

  isAvailable(): boolean {
    return getPluginRegistry().getByCapability('research.company').length > 0;
  }

  async research(request: ResearchRequest, workflowId: string): Promise<unknown> {
    const instances = getPluginRegistry().getByCapability('research.company');
    if (instances.length === 0) {
      this.logger.warn('ResearchBridge: no research plugin registered', {});
      return { available: false, message: 'Research plugin not registered' };
    }

    this.logger.info('ResearchBridge: starting research', { workflowId, domain: request.domain });

    try {
      const result = await instances[0].invoke('research.company', request);
      const now = new Date().toISOString();
      this.eventBus.publish({
        id: `research_${Date.now()}`,
        type: RuntimeEventTypes.RESEARCH_COMPLETED,
        version: '1.0',
        timestamp: now,
        traceId: workflowId,
        spanId: `research_span_${Date.now()}`,
        payload: {
          workflowId,
          taskId: undefined,
          timestamp: now,
          traceId: workflowId,
          spanId: `research_span_${Date.now()}`,
          result,
        },
      });
      return result;
    } catch (error) {
      this.logger.error('ResearchBridge: research failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
