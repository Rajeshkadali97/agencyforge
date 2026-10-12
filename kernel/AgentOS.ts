import { Kernel } from './kernel.js';
import { MemoryEngineImpl } from './src/memory/memory-engine.js';
import { RuntimeMemoryIntegrator, type MemoryIntegrationConfig, type ResearchIntegration, type RevenueIntegration, type ProjectIntegration, type AgentIntegration } from './src/memory/runtime-integration.js';
import { CogneeMemoryProvider } from './src/memory/cognee/cognee-memory-provider.js';
import type { IMemoryEngine } from './src/memory/interfaces/memory-engine.js';
import type { EventType } from './types/event.js';

export interface AgencyForgeConfig {
  memoryEngine?: IMemoryEngine;
}

export interface ModuleEventHandlers {
  onResearchComplete?: (data: { businessId: string; businessData: unknown }) => Promise<void>;
  onLeadScored?: (data: { businessId: string; businessData: unknown }) => Promise<void>;
  onProposalGenerated?: (data: { businessId: string; proposalId: string; proposalData: unknown }) => Promise<void>;
  onProjectCreated?: (data: { projectId: string; projectData: unknown }) => Promise<void>;
  onAgentTaskComplete?: (data: { agentId: string; agentData: unknown }) => Promise<void>;
}

export interface AgencyForge {
  kernel: Kernel;
  memory: IMemoryEngine;
  integrations: RuntimeMemoryIntegrator;
  registerModuleHandlers(handlers: ModuleEventHandlers): void;
  shutdown(): Promise<void>;
}

export async function createAgencyForge(config: AgencyForgeConfig = {}): Promise<AgencyForge> {
  const kernel = new Kernel();
  await kernel.initialize();

  let memory: IMemoryEngine;
  if (config.memoryEngine) {
    memory = config.memoryEngine;
  } else {
    memory = new MemoryEngineImpl();
    const cogneeProvider = new CogneeMemoryProvider();
    await memory.initialize({
      providers: [cogneeProvider],
    });
  }

  const memoryConfig: MemoryIntegrationConfig = { memoryEngine: memory };
  const integrations = new RuntimeMemoryIntegrator(memoryConfig);

  const agentOS: AgencyForge = {
    kernel,
    memory,
    integrations,
    registerModuleHandlers(handlers: ModuleEventHandlers) {
      if (handlers.onResearchComplete) {
        kernel.eventBus.subscribe('task.completed', async (event) => {
          const payload = event.payload as Record<string, unknown>;
          if (payload.capability === 'research' && payload.result) {
            await handlers.onResearchComplete!({
              businessId: String(payload.businessId || payload.business_id || 'unknown'),
              businessData: payload.result
            });
          }
        });
      }
      if (handlers.onLeadScored) {
        kernel.eventBus.subscribe('task.completed', async (event) => {
          const payload = event.payload as Record<string, unknown>;
          if (payload.capability === 'lead_scoring' && payload.result) {
            await handlers.onLeadScored!({
              businessId: String(payload.businessId || payload.business_id || 'unknown'),
              businessData: payload.result
            });
          }
        });
      }
      if (handlers.onProposalGenerated) {
        kernel.eventBus.subscribe('task.completed', async (event) => {
          const payload = event.payload as Record<string, unknown>;
          if (payload.capability === 'proposal_generation' && payload.result) {
            const result = payload.result as Record<string, unknown>;
            await handlers.onProposalGenerated!({
              businessId: String(payload.businessId || payload.business_id || 'unknown'),
              proposalId: String(result.proposalId || result.proposal_id || 'unknown'),
              proposalData: result
            });
          }
        });
      }
      if (handlers.onProjectCreated) {
        kernel.eventBus.subscribe('task.completed', async (event) => {
          const payload = event.payload as Record<string, unknown>;
          if (payload.capability === 'project_creation' && payload.result) {
            const result = payload.result as Record<string, unknown>;
            await handlers.onProjectCreated!({
              projectId: String(result.projectId || result.project_id || 'unknown'),
              projectData: result
            });
          }
        });
      }
      if (handlers.onAgentTaskComplete) {
        kernel.eventBus.subscribe('task.completed', async (event) => {
          const payload = event.payload as Record<string, unknown>;
          await handlers.onAgentTaskComplete!({
            agentId: String(payload.agent_id || payload.agentId || 'unknown'),
            agentData: payload
          });
        });
      }
      kernel.logger.info('Module event handlers registered');
    },
    shutdown: async () => {
      await kernel.shutdown();
    }
  };

  kernel.logger.info('AgencyForge initialized', {
    memoryEngine: memory.isInitialized ? 'ready' : 'not_initialized'
  });

  return agentOS;
}

export async function initializeMemoryIntegration(
  memory: IMemoryEngine
): Promise<RuntimeMemoryIntegrator> {
  const memoryConfig: MemoryIntegrationConfig = { memoryEngine: memory };
  return new RuntimeMemoryIntegrator(memoryConfig);
}

export { Kernel };
export { MemoryEngineImpl };
export { RuntimeMemoryIntegrator };
export type { IMemoryEngine } from './src/memory/interfaces/memory-engine.js';
export type { ResearchIntegration, RevenueIntegration, ProjectIntegration, AgentIntegration } from './src/memory/runtime-integration.js';
export { ok } from './src/shared/result.js';