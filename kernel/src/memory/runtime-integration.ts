import type { IMemoryEngine } from "./interfaces/memory-engine.js";
import type { BusinessProfile, AgentProfile, ProjectProfile } from "./interfaces/memory-provider.js";
import type { Result } from "../shared/result.js";
import type { Entity } from "./types.js";

export interface MemoryIntegrationConfig {
  memoryEngine: IMemoryEngine;
}

export interface ResearchIntegration {
  onResearchComplete(data: {
    businessId: string;
    businessData: BusinessProfile;
  }): Promise<Result<Entity>>;
}

export interface RevenueIntegration {
  onLeadScored(data: {
    businessId: string;
    businessData: Partial<BusinessProfile>;
  }): Promise<Result<Entity>>;
  onProposalGenerated(data: {
    businessId: string;
    proposalId: string;
    proposalData: unknown;
  }): Promise<Result<Entity>>;
}

export interface ProjectIntegration {
  onProjectCreated(data: {
    projectId: string;
    projectData: ProjectProfile;
  }): Promise<Result<Entity>>;
  onProjectUpdated(data: {
    projectId: string;
    updates: Partial<ProjectProfile>;
  }): Promise<Result<Entity>>;
}

export interface AgentIntegration {
  onAgentTaskComplete(data: {
    agentId: string;
    agentData: Partial<AgentProfile>;
  }): Promise<Result<Entity>>;
}

export class RuntimeMemoryIntegrator
  implements ResearchIntegration, RevenueIntegration, ProjectIntegration, AgentIntegration
{
  private readonly _engine: IMemoryEngine;

  public constructor(config: MemoryIntegrationConfig) {
    this._engine = config.memoryEngine;
  }

  public async onResearchComplete(data: {
    businessId: string;
    businessData: BusinessProfile;
  }): Promise<Result<Entity>> {
    return this._engine.storeBusinessProfile(data.businessData);
  }

  public async onLeadScored(data: {
    businessId: string;
    businessData: Partial<BusinessProfile>;
  }): Promise<Result<Entity>> {
    const existingResult = await this._engine.getEntity(data.businessId);

    if (existingResult.ok && existingResult.value) {
      const existingProps = existingResult.value.properties as unknown as BusinessProfile;
      return this._engine.storeBusinessProfile({
        ...existingProps,
        ...data.businessData,
        name: existingProps.name,
      });
    }

    return this._engine.storeBusinessProfile(data.businessData as BusinessProfile);
  }

  public async onProposalGenerated(data: {
    businessId: string;
    proposalId: string;
    proposalData: unknown;
  }): Promise<Result<Entity>> {
    const entityResult = await this._engine.getEntity(data.businessId);

    if (!entityResult.ok || !entityResult.value) {
      return this._engine.storeProjectProfile({
        name: `Proposal ${data.proposalId}`,
        description: `Proposal for business ${data.businessId}`,
        deliverables: [data.proposalId],
      });
    }

    const entity = entityResult.value;
    const existingProps = entity.properties as Record<string, unknown>;
    const proposals = (existingProps.proposals as string[]) ?? [];

    return this._engine.createEntity({
      content: {
        text: `Proposal ${data.proposalId}: ${JSON.stringify(data.proposalData)}`,
      },
      entityType: "document",
      properties: {
        ...existingProps,
        proposals: [...proposals, data.proposalId],
      },
    });
  }

  public async onProjectCreated(data: {
    projectId: string;
    projectData: ProjectProfile;
  }): Promise<Result<Entity>> {
    return this._engine.storeProjectProfile(data.projectData);
  }

  public async onProjectUpdated(data: {
    projectId: string;
    updates: Partial<ProjectProfile>;
  }): Promise<Result<Entity>> {
    return this._engine.storeProjectProfile({
      name: data.updates.name ?? "Unknown Project",
      ...data.updates,
    });
  }

  public async onAgentTaskComplete(data: {
    agentId: string;
    agentData: Partial<AgentProfile>;
  }): Promise<Result<Entity>> {
    const existingResult = await this._engine.getEntity(data.agentId);

    if (existingResult.ok && existingResult.value) {
      const existingProps = existingResult.value.properties as unknown as AgentProfile;
      return this._engine.storeAgentProfile({
        ...existingProps,
        ...data.agentData,
        name: existingProps.name,
        type: existingProps.type,
      });
    }

    return this._engine.storeAgentProfile({
      name: data.agentId,
      type: "agent",
      ...data.agentData,
    });
  }
}