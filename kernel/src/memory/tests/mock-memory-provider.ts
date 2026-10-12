import { ok, fail } from "../../shared/result.js";
import type { Result } from "../../shared/result.js";
import type {
  Memory,
  Entity,
  Relationship,
  Fact,
  SearchOptions,
  SearchResult,
  RetrievalOptions,
  SummarizeOptions,
  RelateOptions,
  ArchiveOptions,
  HealthStatus,
  MemoryStoreOptions,
  MemoryProviderInfo,
} from "../types.js";
import type { MemoryProvider, BusinessProfile, AgentProfile, ProjectProfile } from "../interfaces/memory-provider.js";

export class MockMemoryProvider implements MemoryProvider {
  public readonly info: MemoryProviderInfo = {
    name: "mock",
    displayName: "Mock Memory Provider",
    version: "1.0.0",
    category: "memory",
    supports: [
      "store",
      "retrieve",
      "search",
      "summarize",
      "delete",
      "archive",
      "entity_management",
      "relationship_management",
      "fact_management",
      "business_profiles",
      "agent_profiles",
      "project_profiles",
    ],
    reliabilityScore: 1.0,
    requiresApiKey: false,
  };

  private _initialized = false;
  private _memories = new Map<string, Memory>();
  private _entities = new Map<string, Entity>();
  private _relationships = new Map<string, Relationship>();
  private _facts = new Map<string, Fact>();
  private _healthStatus: HealthStatus = { status: "available", latencyMs: 5 };

  public async initialize(): Promise<Result<void>> {
    this._initialized = true;
    return ok(undefined);
  }

  public async shutdown(): Promise<Result<void>> {
    this._initialized = false;
    this._memories.clear();
    this._entities.clear();
    this._relationships.clear();
    this._facts.clear();
    return ok(undefined);
  }

  public async health(): Promise<Result<HealthStatus>> {
    return ok(this._healthStatus);
  }

  public setHealthStatus(status: HealthStatus): void {
    this._healthStatus = status;
  }

  public async store(options: MemoryStoreOptions): Promise<Result<Memory>> {
    const id = `memory-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const memory: Memory = {
      id,
      content: options.content,
      metadata: {
        ...options.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        archived: false,
      },
    };
    this._memories.set(id, memory);
    return ok(memory);
  }

  public async retrieve(options: RetrievalOptions): Promise<Result<Memory | null>> {
    const memory = this._memories.get(options.memoryId) ?? null;
    return ok(memory);
  }

  public async search(options: SearchOptions): Promise<Result<SearchResult[]>> {
    const results: SearchResult[] = [];
    const query = options.query.toLowerCase();

    for (const memory of this._memories.values()) {
      if (memory.content.text?.toLowerCase().includes(query)) {
        results.push({
          memory,
          score: 1.0,
          highlights: [memory.content.text],
        });
      }
    }

    return ok(results.slice(0, options.limit ?? 50));
  }

  public async summarize(options: SummarizeOptions): Promise<Result<string>> {
    const texts: string[] = [];
    for (const id of options.memoryIds) {
      const memory = this._memories.get(id);
      if (memory?.content.text) {
        texts.push(memory.content.text);
      }
    }
    return ok(texts.join("\n\n").slice(0, options.maxLength ?? 500));
  }

  public async delete(memoryId: string): Promise<Result<void>> {
    this._memories.delete(memoryId);
    return ok(undefined);
  }

  public async archive(options: ArchiveOptions): Promise<Result<void>> {
    for (const id of options.memoryIds) {
      const memory = this._memories.get(id);
      if (memory) {
        this._memories.set(id, {
          ...memory,
          metadata: { ...memory.metadata, archived: true },
        });
      }
    }
    return ok(undefined);
  }

  public async createEntity(entity: Omit<Entity, "id" | "metadata">): Promise<Result<Entity>> {
    const id = `entity-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fullEntity: Entity = {
      ...entity,
      id,
      metadata: {
        tier: 4,
        priority: "medium",
        type: "entity",
        createdAt: new Date(),
        updatedAt: new Date(),
        archived: false,
      },
    };
    this._entities.set(id, fullEntity);
    return ok(fullEntity);
  }

  public async createRelationship(relate: RelateOptions): Promise<Result<Relationship>> {
    const id = `rel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const relationship: Relationship = {
      id,
      content: { text: `Relationship: ${relate.relationshipType}` },
      metadata: {
        tier: 4,
        priority: "medium",
        type: "relationship",
        createdAt: new Date(),
        updatedAt: new Date(),
        archived: false,
      },
      sourceId: relate.sourceId,
      targetId: relate.targetId,
      relationshipType: relate.relationshipType,
      properties: relate.properties ?? {},
    };
    this._relationships.set(id, relationship);
    return ok(relationship);
  }

  public async getEntity(entityId: string): Promise<Result<Entity | null>> {
    return ok(this._entities.get(entityId) ?? null);
  }

  public async getRelationships(entityId: string): Promise<Result<Relationship[]>> {
    const relationships = Array.from(this._relationships.values()).filter(
      (r) => r.sourceId === entityId || r.targetId === entityId
    );
    return ok(relationships);
  }

  public async getRelatedEntities(entityId: string, relationshipType?: string): Promise<Result<Entity[]>> {
    const relatedIds = new Set<string>();

    for (const rel of this._relationships.values()) {
      if (rel.sourceId === entityId) {
        relatedIds.add(rel.targetId);
      } else if (rel.targetId === entityId) {
        relatedIds.add(rel.sourceId);
      }
    }

    const entities: Entity[] = [];
    for (const id of relatedIds) {
      const entity = this._entities.get(id);
      if (entity && (!relationshipType || this.hasRelationshipType(entityId, id, relationshipType))) {
        entities.push(entity);
      }
    }

    return ok(entities);
  }

  private hasRelationshipType(sourceId: string, targetId: string, type: string): boolean {
    for (const rel of this._relationships.values()) {
      if (
        (rel.sourceId === sourceId && rel.targetId === targetId) ||
        (rel.sourceId === targetId && rel.targetId === sourceId)
      ) {
        if (rel.relationshipType === type) {
          return true;
        }
      }
    }
    return false;
  }

  public async addFact(fact: Omit<Fact, "id" | "metadata">): Promise<Result<Fact>> {
    const id = `fact-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fullFact: Fact = {
      ...fact,
      id,
      metadata: {
        tier: 4,
        priority: "medium",
        type: "fact",
        createdAt: new Date(),
        updatedAt: new Date(),
        archived: false,
      },
    };
    this._facts.set(id, fullFact);
    return ok(fullFact);
  }

  public async getFacts(subject?: string): Promise<Result<Fact[]>> {
    const facts = Array.from(this._facts.values());
    if (subject) {
      return ok(facts.filter((f) => f.subject.toLowerCase().includes(subject.toLowerCase())));
    }
    return ok(facts);
  }

  public async storeBusinessProfile(business: BusinessProfile): Promise<Result<Entity>> {
    return this.createEntity({
      content: { text: `Business: ${business.name}` },
      entityType: "business",
      properties: business as unknown as Record<string, unknown>,
    });
  }

  public async storeAgentProfile(agent: AgentProfile): Promise<Result<Entity>> {
    return this.createEntity({
      content: { text: `Agent: ${agent.name}` },
      entityType: "agent",
      properties: agent as unknown as Record<string, unknown>,
    });
  }

  public async storeProjectProfile(project: ProjectProfile): Promise<Result<Entity>> {
    return this.createEntity({
      content: { text: `Project: ${project.name}` },
      entityType: "project",
      properties: project as unknown as Record<string, unknown>,
    });
  }

  public get memoryCount(): number {
    return this._memories.size;
  }

  public get entityCount(): number {
    return this._entities.size;
  }

  public get relationshipCount(): number {
    return this._relationships.size;
  }

  public get factCount(): number {
    return this._facts.size;
  }
}