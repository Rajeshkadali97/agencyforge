import { randomUUID } from "crypto";
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
  CogneeConfig,
} from "../types.js";
import type {
  MemoryProvider,
  BusinessProfile,
  AgentProfile,
  ProjectProfile,
} from "../interfaces/memory-provider.js";

// Local mirror of memory-engine's IMemoryEngine — avoids ESM import boundary.
// Runtime injects the real memory-engine instance at boot via dynamic import().
export interface ICognitiveMemoryEngine {
  store(item: {
    type: string;
    owner: string;
    rawContent: string;
    summary: string;
    tags: string[];
    importance: number;
    visibility: string;
    security: string;
    source: string;
    confidence: number;
    entities: unknown[];
    relationships: unknown[];
    metadata: Record<string, unknown>;
  }): Promise<{ id: string; type: string; rawContent: string; metadata: Record<string, unknown> }>;

  retrieve(id: string): Promise<{ id: string; type: string; rawContent: string; metadata: Record<string, unknown> } | null>;

  search(query: { query: string; types?: string[]; owner?: string; tags?: string[] }): Promise<Array<{ id: string; type: string; rawContent: string; metadata: Record<string, unknown>; similarity?: number }>>;

  summarize(ids: string[]): Promise<string>;

  delete(id: string, permanent?: boolean): Promise<boolean>;

  health(): Promise<{ status: string; details?: Record<string, unknown> }>;
}

export const COGNITIVE_MEMORY_PROVIDER_INFO: MemoryProviderInfo = {
  name: "memory-engine",
  displayName: "AgencyForge Cognitive Memory Engine",
  version: "1.0.0",
  category: "memory",
  supports: ["store", "retrieve", "search", "summarize", "delete", "archive", "entity_management", "business_profiles", "agent_profiles", "project_profiles"],
  reliabilityScore: 0.95,
  requiresApiKey: false,
};

function makeMemory(raw: { id: string; type: string; rawContent: string; metadata: Record<string, unknown> }): Memory {
  const now = new Date();
  return {
    id: raw.id,
    content: { text: raw.rawContent, raw: raw.metadata },
    metadata: {
      tier: 1,
      priority: "medium",
      type: (raw.type as Memory["metadata"]["type"]) ?? "document",
      createdAt: (raw.metadata["createdAt"] as Date | undefined) ?? now,
      updatedAt: (raw.metadata["updatedAt"] as Date | undefined) ?? now,
      archived: false,
      tags: (raw.metadata["tags"] as string[] | undefined) ?? [],
      source: (raw.metadata["source"] as string | undefined) ?? "memory-engine",
    },
  };
}

export class CognitiveMemoryProvider implements MemoryProvider {
  readonly info: MemoryProviderInfo = COGNITIVE_MEMORY_PROVIDER_INFO;
  private engine: ICognitiveMemoryEngine;

  constructor(engine: ICognitiveMemoryEngine) {
    this.engine = engine;
  }

  async initialize(_config: CogneeConfig): Promise<Result<void>> {
    return ok(undefined);
  }

  async shutdown(): Promise<Result<void>> {
    return ok(undefined);
  }

  async health(): Promise<Result<HealthStatus>> {
    try {
      const h = await this.engine.health();
      const status = h.status === "healthy" ? "available" : h.status === "degraded" ? "degraded" : "unavailable";
      return ok({ status: status as HealthStatus["status"] });
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async store(options: MemoryStoreOptions): Promise<Result<Memory>> {
    try {
      const item = await this.engine.store({
        type: options.metadata.type ?? "document",
        owner: options.metadata.ownerId ?? "system",
        rawContent: options.content.text ?? JSON.stringify(options.content.raw ?? {}),
        summary: (options.content.text ?? "").slice(0, 200),
        tags: [...(options.metadata.tags ?? [])],
        importance: options.priority === "critical" ? 1.0 : options.priority === "high" ? 0.8 : 0.5,
        visibility: "private",
        security: "internal",
        source: "kernel",
        confidence: 1.0,
        entities: [],
        relationships: [],
        metadata: {},
      });
      return ok(makeMemory(item));
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async retrieve(options: RetrievalOptions): Promise<Result<Memory | null>> {
    try {
      const item = await this.engine.retrieve(options.memoryId);
      return ok(item ? makeMemory(item) : null);
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async search(options: SearchOptions): Promise<Result<SearchResult[]>> {
    try {
      const results = await this.engine.search({
        query: options.query,
        types: options.types ? [...options.types] : undefined,
        owner: options.ownerId,
        tags: options.tags ? [...options.tags] : undefined,
      });
      return ok(
        results.map((r) => ({
          memory: makeMemory(r),
          score: r.similarity ?? 0.5,
        }))
      );
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async summarize(options: SummarizeOptions): Promise<Result<string>> {
    try {
      const summary = await this.engine.summarize([...options.memoryIds]);
      return ok(summary);
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async delete(memoryId: string): Promise<Result<void>> {
    try {
      await this.engine.delete(memoryId);
      return ok(undefined);
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async archive(_options: ArchiveOptions): Promise<Result<void>> {
    return ok(undefined);
  }

  async createEntity(entity: Omit<Entity, "id" | "metadata">): Promise<Result<Entity>> {
    try {
      const id = randomUUID();
      const item = await this.engine.store({
        type: "relationship",
        owner: "system",
        rawContent: entity.content.text ?? JSON.stringify(entity.content.raw ?? {}),
        summary: (entity.content.text ?? "").slice(0, 200),
        tags: [],
        importance: 0.8,
        visibility: "private",
        security: "internal",
        source: "kernel-entity",
        confidence: 1.0,
        entities: [],
        relationships: [],
        metadata: { entityId: id, entityType: entity.entityType, properties: entity.properties },
      });
      const memory = makeMemory(item);
      return ok({ ...memory, entityType: entity.entityType, properties: entity.properties } as Entity);
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async createRelationship(relate: RelateOptions): Promise<Result<Relationship>> {
    try {
      const id = randomUUID();
      const item = await this.engine.store({
        type: "relationship",
        owner: "system",
        rawContent: `${relate.sourceId} -[${relate.relationshipType}]-> ${relate.targetId}`,
        summary: `${relate.relationshipType} relationship`,
        tags: ["relationship"],
        importance: 0.6,
        visibility: "private",
        security: "internal",
        source: "kernel-relationship",
        confidence: 1.0,
        entities: [],
        relationships: [],
        metadata: { relationshipId: id, ...relate },
      });
      const memory = makeMemory(item);
      return ok({
        ...memory,
        sourceId: relate.sourceId,
        targetId: relate.targetId,
        relationshipType: relate.relationshipType,
        properties: relate.properties ?? {},
      } as Relationship);
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async getEntity(entityId: string): Promise<Result<Entity | null>> {
    try {
      const results = await this.engine.search({ query: entityId, tags: ["entity"] });
      const match = results.find((r) => r.metadata["entityId"] === entityId);
      if (!match) return ok(null);
      const mem = makeMemory(match);
      return ok({ ...mem, entityType: (match.metadata["entityType"] as Entity["entityType"]) ?? "document", properties: (match.metadata["properties"] as Record<string, unknown>) ?? {} } as Entity);
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async getRelationships(entityId: string): Promise<Result<Relationship[]>> {
    try {
      const results = await this.engine.search({ query: entityId, tags: ["relationship"] });
      const rels: Relationship[] = results
        .filter((r) => r.metadata["sourceId"] === entityId || r.metadata["targetId"] === entityId)
        .map((r) => ({
          ...makeMemory(r),
          sourceId: r.metadata["sourceId"] as string,
          targetId: r.metadata["targetId"] as string,
          relationshipType: r.metadata["relationshipType"] as string,
          properties: (r.metadata["properties"] as Record<string, unknown>) ?? {},
        }));
      return ok(rels);
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async getRelatedEntities(entityId: string, relationshipType?: string): Promise<Result<Entity[]>> {
    const relsResult = await this.getRelationships(entityId);
    if (!relsResult.ok) return fail(relsResult.error);
    const rels = relsResult.value.filter((r) => !relationshipType || r.relationshipType === relationshipType);
    const targetIds = rels.map((r) => (r.sourceId === entityId ? r.targetId : r.sourceId));
    const entities: Entity[] = [];
    for (const id of targetIds) {
      const e = await this.getEntity(id);
      if (e.ok && e.value) entities.push(e.value);
    }
    return ok(entities);
  }

  async addFact(fact: Omit<Fact, "id" | "metadata">): Promise<Result<Fact>> {
    try {
      const item = await this.engine.store({
        type: "knowledge",
        owner: "system",
        rawContent: `${fact.subject} ${fact.predicate} ${fact.object}`,
        summary: `Fact: ${fact.subject} ${fact.predicate} ${fact.object}`,
        tags: ["fact"],
        importance: fact.confidence,
        visibility: "private",
        security: "internal",
        source: "kernel-fact",
        confidence: fact.confidence,
        entities: [],
        relationships: [],
        metadata: { subject: fact.subject, predicate: fact.predicate, object: fact.object, confidence: fact.confidence },
      });
      const mem = makeMemory(item);
      return ok({ ...mem, subject: fact.subject, predicate: fact.predicate, object: fact.object, confidence: fact.confidence } as Fact);
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async getFacts(subject?: string): Promise<Result<Fact[]>> {
    try {
      const results = await this.engine.search({ query: subject ?? "", tags: ["fact"] });
      const facts: Fact[] = results
        .filter((r) => !subject || r.metadata["subject"] === subject)
        .map((r) => ({
          ...makeMemory(r),
          subject: r.metadata["subject"] as string,
          predicate: r.metadata["predicate"] as string,
          object: r.metadata["object"] as string,
          confidence: (r.metadata["confidence"] as number) ?? 1.0,
        }));
      return ok(facts);
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async storeBusinessProfile(business: BusinessProfile): Promise<Result<Entity>> {
    try {
      const item = await this.engine.store({
        type: "business",
        owner: business.id ?? "system",
        rawContent: JSON.stringify(business),
        summary: `Business: ${business.name}`,
        tags: ["business-profile"],
        importance: 0.9,
        visibility: "private",
        security: "internal",
        source: "kernel-business",
        confidence: 1.0,
        entities: [],
        relationships: [],
        metadata: { ...business, profileType: "business" },
      });
      const mem = makeMemory(item);
      return ok({ ...mem, entityType: "business" as const, properties: business as unknown as Record<string, unknown> });
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async storeAgentProfile(agent: AgentProfile): Promise<Result<Entity>> {
    try {
      const item = await this.engine.store({
        type: "agent",
        owner: agent.id ?? "system",
        rawContent: JSON.stringify(agent),
        summary: `Agent: ${agent.name} (${agent.type})`,
        tags: ["agent-profile"],
        importance: 0.9,
        visibility: "private",
        security: "internal",
        source: "kernel-agent",
        confidence: 1.0,
        entities: [],
        relationships: [],
        metadata: { ...agent, profileType: "agent" },
      });
      const mem = makeMemory(item);
      return ok({ ...mem, entityType: "agent" as const, properties: agent as unknown as Record<string, unknown> });
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }

  async storeProjectProfile(project: ProjectProfile): Promise<Result<Entity>> {
    try {
      const item = await this.engine.store({
        type: "project",
        owner: project.id ?? "system",
        rawContent: JSON.stringify(project),
        summary: `Project: ${project.name}`,
        tags: ["project-profile"],
        importance: 0.9,
        visibility: "private",
        security: "internal",
        source: "kernel-project",
        confidence: 1.0,
        entities: [],
        relationships: [],
        metadata: { ...project, profileType: "project" },
      });
      const mem = makeMemory(item);
      return ok({ ...mem, entityType: "project" as const, properties: project as unknown as Record<string, unknown> });
    } catch (err) {
      return fail(new Error(err instanceof Error ? err.message : String(err)));
    }
  }
}
