import { randomUUID } from "crypto";
import { ok } from "../../shared/result.js";
import type { Result } from "../../shared/result.js";
import { MemoryEngineError } from "../errors.js";
import {
  CogneeProviderError,
  ConnectionError,
  ValidationError,
  NotFoundError,
  SearchError,
  SummarizationError,
} from "../errors.js";
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
  MemoryMetadata,
  CogneeConfig,
} from "../types.js";
import type {
  MemoryProvider,
  BusinessProfile,
  AgentProfile,
  ProjectProfile,
} from "../interfaces/memory-provider.js";

function returnFail<T>(error: Error): Result<T> {
  return { ok: false, error };
}

export const COGNEE_PROVIDER_INFO = {
  name: "cognee",
  displayName: "Cognee Memory Provider",
  version: "1.0.0",
  category: "memory" as const,
  supports: [
    "store",
    "retrieve",
    "search",
    "summarize",
    "delete",
    "archive",
    "health",
    "entity_management",
    "relationship_management",
    "fact_management",
    "semantic_search",
    "vector_search",
    "knowledge_graph",
    "business_profiles",
    "agent_profiles",
    "project_profiles",
  ],
  reliabilityScore: 0.95,
  requiresApiKey: false,
} as const;

interface CogneeMemory extends Omit<Memory, "metadata"> {
  metadata: MemoryMetadata & {
    provider?: string;
    cogneeId?: string;
  };
}

interface CogneeResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class CogneeMemoryProvider implements MemoryProvider {
  public readonly info = COGNEE_PROVIDER_INFO;

  private config: CogneeConfig | null = null;
  private initialized = false;
  private memories: Map<string, CogneeMemory> = new Map();
  private entities: Map<string, Entity> = new Map();
  private relationships: Map<string, Relationship> = new Map();
  private facts: Map<string, Fact> = new Map();
  private archivedIds: Set<string> = new Set();

  public async initialize(config: CogneeConfig): Promise<Result<void>> {
    try {
      if (this.initialized) {
        return returnFail(
          new CogneeProviderError("Provider already initialized")
        );
      }

      this.config = {
        apiKey: config.apiKey,
        endpoint: config.endpoint ?? "https://api.cognee.ai",
        model: config.model ?? "gpt-4",
        embeddingModel: config.embeddingModel ?? "text-embedding-3-small",
        maxRetries: config.maxRetries ?? 3,
        timeout: config.timeout ?? 30000,
        defaultTier: config.defaultTier ?? 4,
        namespace: config.namespace ?? "default",
        ...config,
      };

      await this.initializeStorage();

      this.initialized = true;
      return ok(undefined);
    } catch (error) {
      return returnFail(
        new CogneeProviderError(
          "Failed to initialize Cognee provider",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }

  private async initializeStorage(): Promise<void> {
    const endpoint = this.config?.endpoint;
    if (!endpoint) {
      throw new ConnectionError("Cognee endpoint not configured");
    }

    const healthCheck = await this.checkCogneeHealth(endpoint);
    if (!healthCheck) {
      throw new ConnectionError("Unable to connect to Cognee service");
    }
  }

  private async checkCogneeHealth(endpoint: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${endpoint}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  public async shutdown(): Promise<Result<void>> {
    try {
      if (!this.initialized) {
        return returnFail(new CogneeProviderError("Provider not initialized"));
      }

      this.memories.clear();
      this.entities.clear();
      this.relationships.clear();
      this.facts.clear();
      this.archivedIds.clear();
      this.config = null;
      this.initialized = false;

      return ok(undefined);
    } catch (error) {
      return returnFail(
        new CogneeProviderError(
          "Failed to shutdown Cognee provider",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }

  public async health(): Promise<Result<HealthStatus>> {
    const startTime = Date.now();

    if (!this.initialized || !this.config) {
      return ok({
        status: "unavailable",
        details: "Provider not initialized",
      });
    }

    try {
      const endpoint = this.config?.endpoint ?? "unknown";
      const isHealthy = await this.checkCogneeHealth(endpoint);

      return ok({
        status: isHealthy ? "available" : "degraded",
        latencyMs: Date.now() - startTime,
        details: isHealthy
          ? `Connected to ${this.config.endpoint}`
          : "Cognee service health check failed",
      });
    } catch (error) {
      return ok({
        status: "degraded",
        latencyMs: Date.now() - startTime,
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  public async store(options: MemoryStoreOptions): Promise<Result<Memory>> {
    try {
      if (!this.initialized) {
        return returnFail(new CogneeProviderError("Provider not initialized"));
      }

      this.validateStoreOptions(options);

      const id = this.generateId();
      const now = new Date();

      const metadata: MemoryMetadata = {
        ...options.metadata,
        createdAt: now,
        updatedAt: now,
        accessedAt: now,
      };

      const memory: CogneeMemory = {
        id,
        content: options.content,
        metadata,
      };

      await this.persistToCognee(memory);

      this.memories.set(id, memory);

      return ok(memory);
    } catch (error) {
      if (error instanceof MemoryEngineError) {
        return returnFail(error);
      }
      return returnFail(
        new CogneeProviderError(
          "Failed to store memory",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }

  private validateStoreOptions(options: MemoryStoreOptions): void {
    if (!options.content || (!options.content.text && !options.content.embedding)) {
      throw new ValidationError("Memory content must have text or embedding");
    }
    if (!options.metadata || !options.metadata.tier || !options.metadata.type) {
      throw new ValidationError("Memory metadata must include tier and type");
    }
  }

  public async retrieve(options: RetrievalOptions): Promise<Result<Memory | null>> {
    try {
      if (!this.initialized) {
        return returnFail(new CogneeProviderError("Provider not initialized"));
      }

      const memory = this.memories.get(options.memoryId);

      if (!memory) {
        return ok(null);
      }

      if (!options.includeArchived && this.archivedIds.has(options.memoryId)) {
        return ok(null);
      }

      const updatedMemory = {
        ...memory,
        metadata: {
          ...memory.metadata,
          accessedAt: new Date(),
        },
      };

      this.memories.set(options.memoryId, updatedMemory);

      return ok(updatedMemory);
    } catch (error) {
      return returnFail(
        new CogneeProviderError(
          "Failed to retrieve memory",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }

  public async search(options: SearchOptions): Promise<Result<SearchResult[]>> {
    try {
      if (!this.initialized) {
        return returnFail(new CogneeProviderError("Provider not initialized"));
      }

      if (!options.query && !options.types && !options.tags) {
        return returnFail(new ValidationError("Search must have query, types, or tags"));
      }

      const results = await this.performSearch(options);

      const filtered = results.filter((result) => {
        if (!options.includeArchived && this.archivedIds.has(result.memory.id)) {
          return false;
        }
        if (options.types && !options.types.includes(result.memory.metadata.type)) {
          return false;
        }
        if (options.fromDate && result.memory.metadata.createdAt < options.fromDate) {
          return false;
        }
        if (options.toDate && result.memory.metadata.createdAt > options.toDate) {
          return false;
        }
        return true;
      });

      return ok(filtered.slice(0, options.limit ?? 50));
    } catch (error) {
      return returnFail(
        new SearchError(
          "Failed to search memories",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }

  private async performSearch(options: SearchOptions): Promise<SearchResult[]> {
    const allMemories = Array.from(this.memories.values());

    if (options.query) {
      const queryLower = options.query.toLowerCase();
      return allMemories
        .filter((memory) => {
          const text = memory.content.text?.toLowerCase() ?? "";
          return text.includes(queryLower);
        })
        .map((memory) => ({
          memory,
          score: this.calculateRelevanceScore(memory, options.query),
          highlights: this.extractHighlights(memory.content.text ?? "", options.query),
        }))
        .sort((a, b) => b.score - a.score);
    }

    return allMemories.map((memory) => ({
      memory,
      score: 1.0,
      highlights: [],
    }));
  }

  private calculateRelevanceScore(memory: Memory, query: string): number {
    const text = memory.content.text?.toLowerCase() ?? "";
    const queryTerms = query.toLowerCase().split(/\s+/);
    let score = 0;

    for (const term of queryTerms) {
      if (text.includes(term)) {
        score += 1;
        if (text.startsWith(term)) {
          score += 0.5;
        }
      }
    }

    const position = text.indexOf(query.toLowerCase());
    if (position >= 0) {
      score += 1 - position / text.length;
    }

    return score;
  }

  private extractHighlights(text: string, query: string): string[] {
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    const index = textLower.indexOf(queryLower);

    if (index !== -1) {
      const start = Math.max(0, index - 50);
      const end = Math.min(text.length, index + query.length + 50);
      highlights.push("..." + text.slice(start, end) + "...");
    }

    return highlights;
  }

  public async summarize(options: SummarizeOptions): Promise<Result<string>> {
    try {
      if (!this.initialized) {
        return returnFail(new CogneeProviderError("Provider not initialized"));
      }

      if (!options.memoryIds || options.memoryIds.length === 0) {
        return returnFail(new ValidationError("Cannot summarize empty memory list"));
      }

      const memories: Memory[] = [];
      for (const id of options.memoryIds) {
        const result = this.memories.get(id);
        if (result) {
          memories.push(result);
        }
      }

      if (memories.length === 0) {
        return ok("");
      }

      const summary = await this.generateSummary(memories, options);

      return ok(summary);
    } catch (error) {
      return returnFail(
        new SummarizationError(
          "Failed to summarize memories",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }

  private async generateSummary(memories: Memory[], options: SummarizeOptions): Promise<string> {
    const texts = memories
      .map((m) => m.content.text)
      .filter((t): t is string => t !== undefined);

    const combinedText = texts.join("\n\n");
    const maxLength = options.maxLength ?? 500;

    if (options.format === "bullet") {
      return this.generateBulletSummary(texts, maxLength);
    }

    if (options.format === "brief") {
      return this.generateBriefSummary(texts, maxLength);
    }

    return this.generateDetailedSummary(texts, maxLength);
  }

  private generateBulletSummary(texts: string[], maxLength: number): string {
    const bullets = texts.slice(0, 10).map((text, i) => {
      const truncated = text.length > 100 ? text.slice(0, 100) + "..." : text;
      return `- ${truncated}`;
    });

    const result = bullets.join("\n");
    return result.length > maxLength ? result.slice(0, maxLength) + "..." : result;
  }

  private generateBriefSummary(texts: string[], maxLength: number): string {
    const summary = texts.slice(0, 3).join(". ");
    return summary.length > maxLength ? summary.slice(0, maxLength) + "..." : summary;
  }

  private generateDetailedSummary(texts: string[], maxLength: number): string {
    const paragraphs = texts.map((text) => {
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      return sentences.slice(0, 2).join(". ").trim();
    });

    const result = paragraphs.join("\n\n");
    return result.length > maxLength ? result.slice(0, maxLength) + "..." : result;
  }

  public async delete(memoryId: string): Promise<Result<void>> {
    try {
      if (!this.initialized) {
        return returnFail(new CogneeProviderError("Provider not initialized"));
      }

      if (!this.memories.has(memoryId)) {
        return returnFail(new NotFoundError(memoryId));
      }

      await this.deleteFromCognee(memoryId);

      this.memories.delete(memoryId);
      this.entities.delete(memoryId);
      this.relationships.delete(memoryId);
      this.facts.delete(memoryId);
      this.archivedIds.delete(memoryId);

      return ok(undefined);
    } catch (error) {
      if (error instanceof MemoryEngineError) {
        return returnFail(error);
      }
      return returnFail(
        new CogneeProviderError(
          "Failed to delete memory",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }

  public async archive(options: ArchiveOptions): Promise<Result<void>> {
    try {
      if (!this.initialized) {
        return returnFail(new CogneeProviderError("Provider not initialized"));
      }

      if (!options.memoryIds || options.memoryIds.length === 0) {
        return returnFail(new ValidationError("Cannot archive empty memory list"));
      }

      for (const id of options.memoryIds) {
        const memory = this.memories.get(id);
        if (memory) {
          const archivedMemory = {
            ...memory,
            metadata: {
              ...memory.metadata,
              archived: true,
              updatedAt: new Date(),
            },
          };
          this.memories.set(id, archivedMemory);
          this.archivedIds.add(id);

          if (options.permanent) {
            await this.deleteFromCognee(id);
          }
        }
      }

      return ok(undefined);
    } catch (error) {
      return returnFail(
        new CogneeProviderError(
          "Failed to archive memories",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }

  public async createEntity(
    entity: Omit<Entity, "id" | "metadata">
  ): Promise<Result<Entity>> {
    try {
      if (!this.initialized) {
        return returnFail(new CogneeProviderError("Provider not initialized"));
      }

      const id = this.generateId();
      const now = new Date();

      const entityData: Entity = {
        ...entity,
        id,
        metadata: {
          tier: 4,
          priority: "medium",
          type: "entity",
          createdAt: now,
          updatedAt: now,
          archived: false,
        },
      };

      await this.persistEntityToCognee(entityData);

      this.entities.set(id, entityData);

      const memoryResult = await this.store({
        content: { text: JSON.stringify(entityData) },
        metadata: {
          tier: 4,
          priority: "medium",
          type: "entity",
          archived: false,
        },
      });

      if (memoryResult.ok) {
        const cogneeMemory = this.memories.get(memoryResult.value.id);
        if (cogneeMemory) {
          cogneeMemory.metadata.cogneeId = id;
        }
      }

      return ok(entityData);
    } catch (error) {
      return returnFail(
        new CogneeProviderError(
          "Failed to create entity",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }

  public async createRelationship(
    relate: RelateOptions
  ): Promise<Result<Relationship>> {
    try {
      if (!this.initialized) {
        return returnFail(new CogneeProviderError("Provider not initialized"));
      }

      if (!this.memories.has(relate.sourceId) || !this.memories.has(relate.targetId)) {
        return returnFail(new ValidationError("Source or target memory not found"));
      }

      const id = this.generateId();
      const now = new Date();

      const relationship: Relationship = {
        id,
        content: {
          text: `Relationship: ${relate.relationshipType} between ${relate.sourceId} and ${relate.targetId}`,
        },
        metadata: {
          tier: 4,
          priority: "medium",
          type: "relationship",
          createdAt: now,
          updatedAt: now,
          archived: false,
        },
        sourceId: relate.sourceId,
        targetId: relate.targetId,
        relationshipType: relate.relationshipType,
        properties: relate.properties ?? {},
      };

      await this.persistRelationshipToCognee(relationship);

      this.relationships.set(id, relationship);

      if (relate.bidirectional) {
        const reverseRelationship: Relationship = {
          ...relationship,
          id: this.generateId(),
          sourceId: relate.targetId,
          targetId: relate.sourceId,
        };
        this.relationships.set(reverseRelationship.id, reverseRelationship);
      }

      return ok(relationship);
    } catch (error) {
      return returnFail(
        new CogneeProviderError(
          "Failed to create relationship",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }

  public async getEntity(entityId: string): Promise<Result<Entity | null>> {
    const entity = this.entities.get(entityId) ?? null;
    return ok(entity);
  }

  public async getRelationships(entityId: string): Promise<Result<Relationship[]>> {
    const relationships = Array.from(this.relationships.values()).filter(
      (rel) => rel.sourceId === entityId || rel.targetId === entityId
    );
    return ok(relationships);
  }

  public async getRelatedEntities(entityId: string, relationshipType?: string): Promise<Result<Entity[]>> {
    const relationships = await this.getRelationships(entityId);

    if (!relationships.ok) {
      return returnFail(relationships.error);
    }

    const relatedIds = new Set<string>();

    for (const rel of relationships.value) {
      if (!relationshipType || rel.relationshipType === relationshipType) {
        if (rel.sourceId === entityId) {
          relatedIds.add(rel.targetId);
        } else if (rel.targetId === entityId) {
          relatedIds.add(rel.sourceId);
        }
      }
    }

    const entities: Entity[] = [];
    for (const id of relatedIds) {
      const entity = this.entities.get(id);
      if (entity) {
        entities.push(entity);
      }
    }

    return ok(entities);
  }

  public async addFact(fact: Omit<Fact, "id" | "metadata">): Promise<Result<Fact>> {
    try {
      if (!this.initialized) {
        return returnFail(new CogneeProviderError("Provider not initialized"));
      }

      const id = this.generateId();
      const now = new Date();

      const factData: Fact = {
        ...fact,
        id,
        metadata: {
          tier: 4,
          priority: "medium",
          type: "fact",
          createdAt: now,
          updatedAt: now,
          archived: false,
        },
      };

      await this.persistFactToCognee(factData);

      this.facts.set(id, factData);

      return ok(factData);
    } catch (error) {
      return returnFail(
        new CogneeProviderError(
          "Failed to add fact",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }

  public async getFacts(subject?: string): Promise<Result<Fact[]>> {
    const allFacts = Array.from(this.facts.values());

    if (subject) {
      const filtered = allFacts.filter(
        (fact) => fact.subject.toLowerCase().includes(subject.toLowerCase())
      );
      return ok(filtered);
    }

    return ok(allFacts);
  }

  public async storeBusinessProfile(
    business: BusinessProfile
  ): Promise<Result<Entity>> {
    const properties: Record<string, unknown> = {
      name: business.name,
      website: business.website,
      socialProfiles: business.socialProfiles,
      contacts: business.contacts,
      technology: business.technology,
      seoData: business.seoData,
      projects: business.projects,
      proposals: business.proposals,
      emails: business.emails,
      meetings: business.meetings,
      history: business.history,
      relationships: business.relationships,
    };

    const entity = await this.createEntity({
      content: {
        text: `Business Profile: ${business.name}${business.website ? ` (${business.website})` : ""}`,
      },
      entityType: "business",
      properties,
    });

    if (!entity.ok) {
      return returnFail(entity.error);
    }

    const businessEntity = entity.value;

    if (business.contacts) {
      for (const contact of business.contacts) {
        const contactEntity = await this.createEntity({
          content: {
            text: `Contact: ${contact.name}${contact.email ? ` (${contact.email})` : ""}`,
          },
          entityType: "person",
          properties: {
            ...contact,
            businessId: businessEntity.id,
          },
        });

        if (contactEntity.ok) {
          await this.createRelationship({
            sourceId: businessEntity.id,
            targetId: contactEntity.value.id,
            relationshipType: "has_contact",
            properties: { role: contact.role },
          });
        }
      }
    }

    if (business.relationships) {
      for (const rel of business.relationships) {
        await this.createRelationship({
          sourceId: businessEntity.id,
          targetId: rel.businessId,
          relationshipType: rel.relationshipType,
          properties: { details: rel.details },
        });
      }
    }

    return ok(businessEntity);
  }

  public async storeAgentProfile(agent: AgentProfile): Promise<Result<Entity>> {
    const properties: Record<string, unknown> = {
      name: agent.name,
      type: agent.type,
      capabilities: agent.capabilities,
      pastWork: agent.pastWork,
      preferences: agent.preferences,
      mistakes: agent.mistakes,
      successfulWorkflows: agent.successfulWorkflows,
      currentContext: agent.currentContext,
      currentGoals: agent.currentGoals,
    };

    const entity = await this.createEntity({
      content: {
        text: `Agent Profile: ${agent.name} (${agent.type})`,
      },
      entityType: "agent",
      properties,
    });

    if (!entity.ok) {
      return returnFail(entity.error);
    }

    const agentEntity = entity.value;

    if (agent.pastWork) {
      for (const work of agent.pastWork) {
        await this.addFact({
          subject: agentEntity.id,
          predicate: "completed",
          object: work.description,
          confidence: 0.9,
          content: {
            text: `${agent.name} worked on ${work.description} for project ${work.projectId}`,
          },
        });
      }
    }

    if (agent.mistakes) {
      for (const mistake of agent.mistakes) {
        await this.addFact({
          subject: agentEntity.id,
          predicate: "learned_from",
          object: mistake.description,
          confidence: 0.95,
          content: {
            text: `${agent.name} learned: ${mistake.description}${mistake.lesson ? ` -> ${mistake.lesson}` : ""}`,
          },
        });
      }
    }

    return ok(agentEntity);
  }

  public async storeProjectProfile(project: ProjectProfile): Promise<Result<Entity>> {
    const properties: Record<string, unknown> = {
      name: project.name,
      description: project.description,
      timeline: project.timeline,
      files: project.files,
      versions: project.versions,
      conversations: project.conversations,
      decisions: project.decisions,
      tasks: project.tasks,
      deliverables: project.deliverables,
      dependencies: project.dependencies,
    };

    const entity = await this.createEntity({
      content: {
        text: `Project: ${project.name}${project.description ? ` - ${project.description}` : ""}`,
      },
      entityType: "project",
      properties,
    });

    if (!entity.ok) {
      return returnFail(entity.error);
    }

    const projectEntity = entity.value;

    if (project.decisions) {
      for (const decision of project.decisions) {
        await this.addFact({
          subject: projectEntity.id,
          predicate: "decided",
          object: decision.decision,
          confidence: 0.95,
          content: {
            text: `[${decision.date.toISOString()}] Decision: ${decision.decision}${decision.rationale ? ` (Rationale: ${decision.rationale})` : ""}`,
          },
        });
      }
    }

    if (project.dependencies) {
      for (const depId of project.dependencies) {
        await this.createRelationship({
          sourceId: projectEntity.id,
          targetId: depId,
          relationshipType: "depends_on",
        });
      }
    }

    return ok(projectEntity);
  }

  private generateId(): string {
    return randomUUID();
  }

  private async persistToCognee(memory: CogneeMemory): Promise<void> {
    if (!this.config?.endpoint) {
      return;
    }

    try {
      const response = await fetch(`${this.config.endpoint}/memories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          id: memory.id,
          content: memory.content,
          metadata: memory.metadata,
        }),
        signal: AbortSignal.timeout(this.config.timeout ?? 30000),
      });

      if (!response.ok) {
        throw new Error(`Cognee API error: ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ConnectionError("Cognee request timed out");
      }
      throw error;
    }
  }

  private async persistEntityToCognee(entity: Entity): Promise<void> {
    if (!this.config?.endpoint) {
      return;
    }

    try {
      const response = await fetch(`${this.config.endpoint}/entities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(entity),
        signal: AbortSignal.timeout(this.config.timeout ?? 30000),
      });

      if (!response.ok) {
        throw new Error(`Cognee API error: ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ConnectionError("Cognee request timed out");
      }
      throw error;
    }
  }

  private async persistRelationshipToCognee(relationship: Relationship): Promise<void> {
    if (!this.config?.endpoint) {
      return;
    }

    try {
      const response = await fetch(`${this.config.endpoint}/relationships`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(relationship),
        signal: AbortSignal.timeout(this.config.timeout ?? 30000),
      });

      if (!response.ok) {
        throw new Error(`Cognee API error: ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ConnectionError("Cognee request timed out");
      }
      throw error;
    }
  }

  private async persistFactToCognee(fact: Fact): Promise<void> {
    if (!this.config?.endpoint) {
      return;
    }

    try {
      const response = await fetch(`${this.config.endpoint}/facts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(fact),
        signal: AbortSignal.timeout(this.config.timeout ?? 30000),
      });

      if (!response.ok) {
        throw new Error(`Cognee API error: ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ConnectionError("Cognee request timed out");
      }
      throw error;
    }
  }

  private async deleteFromCognee(memoryId: string): Promise<void> {
    if (!this.config?.endpoint) {
      return;
    }

    try {
      const response = await fetch(`${this.config.endpoint}/memories/${memoryId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        signal: AbortSignal.timeout(this.config.timeout ?? 30000),
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Cognee API error: ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ConnectionError("Cognee request timed out");
      }
      throw error;
    }
  }
}