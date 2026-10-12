import {
  MemoryItem,
  MemoryQuery,
  MemorySearchResult,
  MemoryStoreOptions,
  MemoryUpdateOptions,
  MemoryArchiveOptions,
  MemoryMergeOptions,
  MemoryStats,
  MemoryHealth,
  MemoryType,
} from '../types';
import { IEventBus } from '../kernel-bridge';
import { IMemoryProvider, ProviderHealth } from '../types/providers';

export interface IMemoryEngine {
  readonly id: string;
  readonly eventBus: IEventBus;

  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  health(): Promise<MemoryHealth>;

  store(item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>, options?: MemoryStoreOptions): Promise<MemoryItem>;
  retrieve(id: string): Promise<MemoryItem | null>;
  update(id: string, updates: Partial<MemoryItem>, options?: MemoryUpdateOptions): Promise<MemoryItem>;
  delete(id: string, permanent?: boolean): Promise<boolean>;
  archive(id: string, options: MemoryArchiveOptions): Promise<void>;
  merge(sourceId: string, targetId: string, options: MemoryMergeOptions): Promise<MemoryItem>;
  forget(id: string, reason: string): Promise<boolean>;
  pin(id: string): Promise<void>;
  unpin(id: string): Promise<void>;

  search(query: MemoryQuery): Promise<MemorySearchResult[]>;
  retrieveByQuery(query: MemoryQuery): Promise<MemorySearchResult[]>;

  summarize(ids: string[]): Promise<string>;
  relate(sourceId: string, targetId: string, relationshipType: string, properties?: Record<string, unknown>): Promise<void>;

  getStats(): Promise<MemoryStats>;
  getMemoryTypes(): MemoryType[];

  registerProvider(provider: IMemoryProvider): void;
  unregisterProvider(providerId: string): boolean;
  getProvider(providerId: string): IMemoryProvider | undefined;
  listProviders(): IMemoryProvider[];

  getShortTermMemory(): IShortTermMemory;
  getLongTermMemory(): ILongTermMemory;
  getSemanticMemory(): ISemanticMemory;
  getEpisodicMemory(): IEpisodicMemory;
  getProceduralMemory(): IProceduralMemory;
  getWorkingMemory(): IWorkingMemory;
  getBusinessMemory(): IBusinessMemory;
  getUserMemory(): IUserMemory;
  getProjectMemory(): IProjectMemory;
  getWorkflowMemory(): IWorkflowMemory;
  getAgentMemory(): IAgentMemory;
  getKnowledgeMemory(): IKnowledgeMemory;
  getConversationMemory(): IConversationMemory;
  getDocumentMemory(): IDocumentMemory;
  getDecisionMemory(): IDecisionMemory;
  getTaskMemory(): ITaskMemory;
  getRelationshipMemory(): IRelationshipMemory;
}

export interface IMemoryModule {
  readonly type: MemoryType;
  readonly engine: IMemoryEngine;

  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }>;

  store(item: MemoryItem, options?: MemoryStoreOptions): Promise<MemoryItem>;
  retrieve(id: string): Promise<MemoryItem | null>;
  update(id: string, updates: Partial<MemoryItem>, options?: MemoryUpdateOptions): Promise<MemoryItem>;
  delete(id: string, permanent?: boolean): Promise<boolean>;
  search(query: MemoryQuery): Promise<MemorySearchResult[]>;
}

export interface IShortTermMemory extends IMemoryModule {
  getActiveContext(owner: string): Promise<MemoryItem[]>;
  setActiveContext(owner: string, items: MemoryItem[]): Promise<void>;
  clearContext(owner: string): Promise<void>;
  getContextWindow(owner: string, maxTokens: number): Promise<MemoryItem[]>;
}

export interface ILongTermMemory extends IMemoryModule {
  consolidate(owner: string): Promise<number>;
  archiveOldItems(olderThanDays: number): Promise<string[]>;
  getImportantMemories(owner: string, limit: number): Promise<MemoryItem[]>;
}

export interface ISemanticMemory extends IMemoryModule {
  extractConcepts(text: string): Promise<Array<{ concept: string; confidence: number; type: string }>>;
  findSimilar(id: string, limit: number): Promise<MemorySearchResult[]>;
  getConceptGraph(concept: string, depth: number): Promise<{ nodes: unknown[]; edges: unknown[] }>;
}

export interface IEpisodicMemory extends IMemoryModule {
  getTimeline(owner: string, dateRange: { start: string; end: string }): Promise<MemoryItem[]>;
  getEpisode(episodeId: string): Promise<MemoryItem | null>;
  linkEpisodes(sourceId: string, targetId: string, relationship: string): Promise<void>;
  getRelatedEpisodes(episodeId: string): Promise<MemoryItem[]>;
}

export interface IProceduralMemory extends IMemoryModule {
  getProcedures(owner: string, domain?: string): Promise<MemoryItem[]>;
  getProcedure(procedureId: string): Promise<MemoryItem | null>;
  recordExecution(procedureId: string, success: boolean, durationMs: number, context: Record<string, unknown>): Promise<void>;
  getBestPractices(domain: string): Promise<MemoryItem[]>;
}

export interface IWorkingMemory extends IMemoryModule {
  addNote(owner: string, note: string, tags?: string[]): Promise<MemoryItem>;
  getNotes(owner: string, tags?: string[]): Promise<MemoryItem[]>;
  removeNote(noteId: string): Promise<boolean>;
  promoteToLongTerm(noteId: string): Promise<MemoryItem>;
  clearSession(owner: string): Promise<void>;
}

export interface IBusinessMemory extends IMemoryModule {
  getBusinessProfile(businessId: string): Promise<MemoryItem | null>;
  createBusinessProfile(data: {
    name: string;
    website?: string;
    industry?: string;
    size?: string;
    location?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateBusinessProfile(businessId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
  getBusinessContacts(businessId: string): Promise<MemoryItem[]>;
  getBusinessProjects(businessId: string): Promise<MemoryItem[]>;
  getBusinessProposals(businessId: string): Promise<MemoryItem[]>;
  getBusinessCommunications(businessId: string): Promise<MemoryItem[]>;
  getBusinessTechnology(businessId: string): Promise<MemoryItem[]>;
  getBusinessSEO(businessId: string): Promise<MemoryItem[]>;
  linkBusinessToProject(businessId: string, projectId: string): Promise<void>;
  linkBusinessToUser(businessId: string, userId: string, role: string): Promise<void>;
}

export interface IUserMemory extends IMemoryModule {
  getUserProfile(userId: string): Promise<MemoryItem | null>;
  createUserProfile(data: {
    name: string;
    email?: string;
    preferences?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateUserProfile(userId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
  getUserPreferences(userId: string): Promise<Record<string, unknown>>;
  setUserPreference(userId: string, key: string, value: unknown): Promise<void>;
  getUserHistory(userId: string, limit?: number): Promise<MemoryItem[]>;
  getUserProjects(userId: string): Promise<MemoryItem[]>;
  getUserAgents(userId: string): Promise<MemoryItem[]>;
  getUserWorkflows(userId: string): Promise<MemoryItem[]>;
}

export interface IProjectMemory extends IMemoryModule {
  getProjectContext(projectId: string): Promise<MemoryItem | null>;
  createProjectContext(data: {
    name: string;
    description?: string;
    owner: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateProjectContext(projectId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
  getProjectTimeline(projectId: string): Promise<MemoryItem[]>;
  getProjectFiles(projectId: string): Promise<MemoryItem[]>;
  getProjectDecisions(projectId: string): Promise<MemoryItem[]>;
  getProjectTasks(projectId: string): Promise<MemoryItem[]>;
  getProjectDeliverables(projectId: string): Promise<MemoryItem[]>;
  getProjectDependencies(projectId: string): Promise<MemoryItem[]>;
  getProjectConversations(projectId: string): Promise<MemoryItem[]>;
  linkProjectToBusiness(projectId: string, businessId: string): Promise<void>;
  linkProjectToUser(projectId: string, userId: string, role: string): Promise<void>;
  linkProjectToAgent(projectId: string, agentId: string): Promise<void>;
}

export interface IWorkflowMemory extends IMemoryModule {
  getWorkflowContext(workflowId: string): Promise<MemoryItem | null>;
  createWorkflowContext(data: {
    workflowId: string;
    name: string;
    definition: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateWorkflowContext(workflowId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
  getWorkflowExecutions(workflowId: string): Promise<MemoryItem[]>;
  getWorkflowSteps(workflowId: string): Promise<MemoryItem[]>;
  getWorkflowDecisions(workflowId: string): Promise<MemoryItem[]>;
  linkWorkflowToProject(workflowId: string, projectId: string): Promise<void>;
  linkWorkflowToAgent(workflowId: string, agentId: string): Promise<void>;
}

export interface IAgentMemory extends IMemoryModule {
  getAgentContext(agentId: string): Promise<MemoryItem | null>;
  createAgentContext(data: {
    agentId: string;
    name: string;
    capabilities: string[];
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateAgentContext(agentId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
  getAgentPastWork(agentId: string, limit?: number): Promise<MemoryItem[]>;
  getAgentPreferences(agentId: string): Promise<Record<string, unknown>>;
  setAgentPreference(agentId: string, key: string, value: unknown): Promise<void>;
  getAgentMistakes(agentId: string): Promise<MemoryItem[]>;
  getAgentSuccessfulWorkflows(agentId: string): Promise<MemoryItem[]>;
  getAgentCurrentGoals(agentId: string): Promise<MemoryItem[]>;
  linkAgentToProject(agentId: string, projectId: string): Promise<void>;
  linkAgentToWorkflow(agentId: string, workflowId: string): Promise<void>;
}

export interface IKnowledgeMemory extends IMemoryModule {
  getKnowledgeBase(domain: string): Promise<MemoryItem[]>;
  addKnowledge(data: {
    domain: string;
    title: string;
    content: string;
    source: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateKnowledge(knowledgeId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
  verifyKnowledge(knowledgeId: string, verifiedBy: string): Promise<void>;
  deprecateKnowledge(knowledgeId: string, reason: string, replacementId?: string): Promise<void>;
  searchKnowledge(query: string, domain?: string, limit?: number): Promise<MemorySearchResult[]>;
  getKnowledgeGraph(domain: string): Promise<{ nodes: unknown[]; edges: unknown[] }>;
}

export interface IConversationMemory extends IMemoryModule {
  getConversation(conversationId: string): Promise<MemoryItem | null>;
  createConversation(data: {
    participants: string[];
    projectId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  addMessage(conversationId: string, message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  getMessages(conversationId: string, limit?: number, offset?: number): Promise<MemoryItem[]>;
  summarizeConversation(conversationId: string): Promise<string>;
  linkConversationToProject(conversationId: string, projectId: string): Promise<void>;
  linkConversationToUser(conversationId: string, userId: string): Promise<void>;
}

export interface IDocumentMemory extends IMemoryModule {
  getDocument(documentId: string): Promise<MemoryItem | null>;
  createDocument(data: {
    title: string;
    content: string;
    type: string;
    projectId?: string;
    owner: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateDocument(documentId: string, updates: Partial<MemoryItem>): Promise<MemoryItem>;
  getDocumentVersions(documentId: string): Promise<MemoryItem[]>;
  searchDocuments(query: string, projectId?: string, limit?: number): Promise<MemorySearchResult[]>;
  linkDocumentToProject(documentId: string, projectId: string): Promise<void>;
  linkDocumentToConversation(documentId: string, conversationId: string): Promise<void>;
}

export interface IDecisionMemory extends IMemoryModule {
  getDecision(decisionId: string): Promise<MemoryItem | null>;
  recordDecision(data: {
    title: string;
    description: string;
    rationale: string;
    alternatives: string[];
    projectId?: string;
    owner: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  getProjectDecisions(projectId: string): Promise<MemoryItem[]>;
  getUserDecisions(userId: string): Promise<MemoryItem[]>;
  getDecisionHistory(decisionId: string): Promise<MemoryItem[]>;
  linkDecisionToTask(decisionId: string, taskId: string): Promise<void>;
}

export interface ITaskMemory extends IMemoryModule {
  getTaskContext(taskId: string): Promise<MemoryItem | null>;
  createTaskContext(data: {
    taskId: string;
    objective: string;
    projectId?: string;
    assignee?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateTaskContext(taskId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
  getTaskHistory(taskId: string): Promise<MemoryItem[]>;
  getProjectTasks(projectId: string): Promise<MemoryItem[]>;
  getUserTasks(userId: string): Promise<MemoryItem[]>;
  getAgentTasks(agentId: string): Promise<MemoryItem[]>;
  linkTaskToDecision(taskId: string, decisionId: string): Promise<void>;
  linkTaskToDocument(taskId: string, documentId: string): Promise<void>;
}

export interface IRelationshipMemory extends IMemoryModule {
  getRelationship(relationshipId: string): Promise<MemoryItem | null>;
  createRelationship(data: {
    sourceType: string;
    sourceId: string;
    targetType: string;
    targetId: string;
    relationshipType: string;
    properties?: Record<string, unknown>;
    confidence?: number;
  }): Promise<MemoryItem>;
  getRelationships(entityType: string, entityId: string, direction?: 'incoming' | 'outgoing' | 'both'): Promise<MemoryItem[]>;
  getRelatedEntities(entityType: string, entityId: string, relationshipType?: string): Promise<Array<{ entity: MemoryItem; relationship: MemoryItem }>>;
  deleteRelationship(relationshipId: string): Promise<boolean>;
  updateRelationship(relationshipId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
}