import { MemoryType, MemoryItem, MemoryQuery, MemorySearchResult } from './memory';
import { KernelEvent, EventType, EventPayload } from '../kernel-bridge';

export type MemoryEventType =
  | 'memory.created'
  | 'memory.updated'
  | 'memory.deleted'
  | 'memory.archived'
  | 'memory.retrieved'
  | 'memory.merged'
  | 'memory.expired'
  | 'memory.forgotten'
  | 'memory.pinned'
  | 'memory.unpinned'
  | 'knowledge.updated'
  | 'knowledge.extracted'
  | 'relationship.created'
  | 'relationship.updated'
  | 'relationship.deleted'
  | 'entity.created'
  | 'entity.updated'
  | 'entity.deleted'
  | 'fact.extracted'
  | 'fact.verified'
  | 'fact.deprecated'
  | 'memory.indexed'
  | 'memory.embedded'
  | 'memory.summarized'
  | 'memory.classified'
  | 'search.performed'
  | 'retrieval.performed'
  | 'provider.connected'
  | 'provider.disconnected'
  | 'provider.error'
  | 'storage.quota.warning'
  | 'storage.quota.exceeded'
  | 'archive.created'
  | 'archive.restored'
  | 'batch.processing.started'
  | 'batch.processing.completed'
  | 'batch.processing.failed';

export interface MemoryEventPayload extends EventPayload {
  memoryId?: string;
  memoryType?: MemoryType;
  owner?: string;
  projectId?: string;
  userId?: string;
  agentId?: string;
  workflowId?: string;
  businessId?: string;
}

export interface MemoryCreatedPayload extends MemoryEventPayload {
  memory: MemoryItem;
  options?: Record<string, unknown>;
}

export interface MemoryUpdatedPayload extends MemoryEventPayload {
  memoryId: string;
  changes: Partial<MemoryItem>;
  previousVersion?: MemoryItem;
}

export interface MemoryDeletedPayload extends MemoryEventPayload {
  memoryId: string;
  reason?: string;
  permanent?: boolean;
}

export interface MemoryArchivedPayload extends MemoryEventPayload {
  memoryId: string;
  archiveLocation: string;
  reason: string;
}

export interface MemoryRetrievedPayload extends MemoryEventPayload {
  memoryId: string;
  query?: MemoryQuery;
  retrievalTimeMs: number;
}

export interface MemoryMergedPayload extends MemoryEventPayload {
  sourceMemoryId: string;
  targetMemoryId: string;
  strategy: string;
  resultMemoryId: string;
}

export interface MemoryExpiredPayload extends MemoryEventPayload {
  memoryId: string;
  expiryPolicy: string;
}

export interface MemoryForgottenPayload extends MemoryEventPayload {
  memoryId: string;
  reason: string;
}

export interface KnowledgeUpdatedPayload extends MemoryEventPayload {
  knowledgeId: string;
  domain: string;
  changeType: 'created' | 'updated' | 'deleted' | 'verified' | 'deprecated';
  newKnowledge?: Record<string, unknown>;
  previousKnowledge?: Record<string, unknown>;
}

export interface RelationshipCreatedPayload extends MemoryEventPayload {
  relationshipId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  confidence: number;
}

export interface RelationshipUpdatedPayload extends MemoryEventPayload {
  relationshipId: string;
  changes: Record<string, unknown>;
}

export interface RelationshipDeletedPayload extends MemoryEventPayload {
  relationshipId: string;
  reason?: string;
}

export interface EntityCreatedPayload extends MemoryEventPayload {
  entityId: string;
  entityType: string;
  name: string;
  properties: Record<string, unknown>;
}

export interface EntityUpdatedPayload extends MemoryEventPayload {
  entityId: string;
  changes: Record<string, unknown>;
}

export interface EntityDeletedPayload extends MemoryEventPayload {
  entityId: string;
  reason?: string;
}

export interface FactExtractedPayload extends MemoryEventPayload {
  factId: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  sourceMemoryId: string;
}

export interface FactVerifiedPayload extends MemoryEventPayload {
  factId: string;
  verifiedBy: string;
  verificationMethod: string;
}

export interface FactDeprecatedPayload extends MemoryEventPayload {
  factId: string;
  reason: string;
  replacementFactId?: string;
}

export interface MemoryIndexedPayload extends MemoryEventPayload {
  memoryId: string;
  indexType: 'vector' | 'keyword' | 'graph' | 'fulltext';
  provider: string;
}

export interface MemoryEmbeddedPayload extends MemoryEventPayload {
  memoryId: string;
  model: string;
  dimensions: number;
  provider: string;
}

export interface MemorySummarizedPayload extends MemoryEventPayload {
  memoryId: string;
  summary: string;
  model: string;
  compressionRatio: number;
}

export interface MemoryClassifiedPayload extends MemoryEventPayload {
  memoryId: string;
  classification: MemoryType;
  confidence: number;
  classifier: string;
}

export interface SearchPerformedPayload extends MemoryEventPayload {
  query: MemoryQuery;
  resultsCount: number;
  searchMode: string;
  durationMs: number;
  provider: string;
}

export interface RetrievalPerformedPayload extends MemoryEventPayload {
  query: MemoryQuery;
  results: MemorySearchResult[];
  durationMs: number;
  provider: string;
}

export interface ProviderConnectedPayload extends MemoryEventPayload {
  providerId: string;
  providerType: string;
  capabilities: string[];
}

export interface ProviderDisconnectedPayload extends MemoryEventPayload {
  providerId: string;
  reason?: string;
}

export interface ProviderErrorPayload extends MemoryEventPayload {
  providerId: string;
  error: string;
  operation: string;
  recoverable: boolean;
}

export interface StorageQuotaWarningPayload extends MemoryEventPayload {
  providerId: string;
  usedBytes: number;
  quotaBytes: number;
  percentage: number;
}

export interface StorageQuotaExceededPayload extends MemoryEventPayload {
  providerId: string;
  usedBytes: number;
  quotaBytes: number;
  operation: string;
}

export interface ArchiveCreatedPayload extends MemoryEventPayload {
  archiveId: string;
  memoryIds: string[];
  location: string;
}

export interface ArchiveRestoredPayload extends MemoryEventPayload {
  archiveId: string;
  restoredMemoryIds: string[];
}

export interface BatchProcessingStartedPayload extends MemoryEventPayload {
  batchId: string;
  operation: string;
  itemCount: number;
}

export interface BatchProcessingCompletedPayload extends MemoryEventPayload {
  batchId: string;
  operation: string;
  succeeded: number;
  failed: number;
  durationMs: number;
}

export interface BatchProcessingFailedPayload extends MemoryEventPayload {
  batchId: string;
  operation: string;
  error: string;
  failedItems: string[];
}

export type MemoryEvent =
  | KernelEvent<MemoryCreatedPayload>
  | KernelEvent<MemoryUpdatedPayload>
  | KernelEvent<MemoryDeletedPayload>
  | KernelEvent<MemoryArchivedPayload>
  | KernelEvent<MemoryRetrievedPayload>
  | KernelEvent<MemoryMergedPayload>
  | KernelEvent<MemoryExpiredPayload>
  | KernelEvent<MemoryForgottenPayload>
  | KernelEvent<KnowledgeUpdatedPayload>
  | KernelEvent<RelationshipCreatedPayload>
  | KernelEvent<RelationshipUpdatedPayload>
  | KernelEvent<RelationshipDeletedPayload>
  | KernelEvent<EntityCreatedPayload>
  | KernelEvent<EntityUpdatedPayload>
  | KernelEvent<EntityDeletedPayload>
  | KernelEvent<FactExtractedPayload>
  | KernelEvent<FactVerifiedPayload>
  | KernelEvent<FactDeprecatedPayload>
  | KernelEvent<MemoryIndexedPayload>
  | KernelEvent<MemoryEmbeddedPayload>
  | KernelEvent<MemorySummarizedPayload>
  | KernelEvent<MemoryClassifiedPayload>
  | KernelEvent<SearchPerformedPayload>
  | KernelEvent<RetrievalPerformedPayload>
  | KernelEvent<ProviderConnectedPayload>
  | KernelEvent<ProviderDisconnectedPayload>
  | KernelEvent<ProviderErrorPayload>
  | KernelEvent<StorageQuotaWarningPayload>
  | KernelEvent<StorageQuotaExceededPayload>
  | KernelEvent<ArchiveCreatedPayload>
  | KernelEvent<ArchiveRestoredPayload>
  | KernelEvent<BatchProcessingStartedPayload>
  | KernelEvent<BatchProcessingCompletedPayload>
  | KernelEvent<BatchProcessingFailedPayload>;

export const MemoryEventTypes: Record<MemoryEventType, EventType> = {
  'memory.created': 'memory.loaded',
  'memory.updated': 'memory.loaded',
  'memory.deleted': 'memory.loaded',
  'memory.archived': 'memory.loaded',
  'memory.retrieved': 'memory.loaded',
  'memory.merged': 'memory.loaded',
  'memory.expired': 'memory.loaded',
  'memory.forgotten': 'memory.loaded',
  'memory.pinned': 'memory.loaded',
  'memory.unpinned': 'memory.loaded',
  'knowledge.updated': 'memory.loaded',
  'knowledge.extracted': 'memory.loaded',
  'relationship.created': 'memory.loaded',
  'relationship.updated': 'memory.loaded',
  'relationship.deleted': 'memory.loaded',
  'entity.created': 'memory.loaded',
  'entity.updated': 'memory.loaded',
  'entity.deleted': 'memory.loaded',
  'fact.extracted': 'memory.loaded',
  'fact.verified': 'memory.loaded',
  'fact.deprecated': 'memory.loaded',
  'memory.indexed': 'memory.loaded',
  'memory.embedded': 'memory.loaded',
  'memory.summarized': 'memory.loaded',
  'memory.classified': 'memory.loaded',
  'search.performed': 'memory.loaded',
  'retrieval.performed': 'memory.loaded',
  'provider.connected': 'system.warning',
  'provider.disconnected': 'system.warning',
  'provider.error': 'system.error',
  'storage.quota.warning': 'system.warning',
  'storage.quota.exceeded': 'system.error',
  'archive.created': 'memory.loaded',
  'archive.restored': 'memory.loaded',
  'batch.processing.started': 'system.warning',
  'batch.processing.completed': 'memory.loaded',
  'batch.processing.failed': 'system.error',
} as const;