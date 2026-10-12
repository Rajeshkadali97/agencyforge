import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface IDocumentMemory {
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

export class DocumentMemoryModule extends BaseMemoryModule implements IDocumentMemory {
  readonly type: MemoryType = 'document';

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async getDocument(documentId: string): Promise<MemoryItem | null> {
    return this.retrieve(documentId);
  }

  async createDocument(data: {
    title: string;
    content: string;
    type: string;
    projectId?: string;
    owner: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: `document_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'document',
      owner: data.owner,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
      source: 'document_creation',
      entities: [],
      relationships: [],
      tags: ['document', data.type, data.projectId || 'standalone'],
      importance: 0.7,
      visibility: data.projectId ? 'project' : 'private',
      security: 'internal',
      summary: data.title,
      rawContent: data.content,
      metadata: { ...data.metadata, document: true, documentType: data.type, projectId: data.projectId, version: 1 },
    };

    return this.store(item);
  }

  async updateDocument(documentId: string, updates: Partial<MemoryItem>): Promise<MemoryItem> {
    const document = await this.retrieve(documentId);
    if (!document) throw new Error(`Document not found: ${documentId}`);

    const newVersion = (document.metadata.version as number || 1) + 1;

    return this.update(documentId, {
      ...updates,
      updatedAt: new Date().toISOString(),
      metadata: { ...document.metadata, ...updates.metadata, version: newVersion },
    });
  }

  async getDocumentVersions(documentId: string): Promise<MemoryItem[]> {
    // Would query version history from provider
    const document = await this.retrieve(documentId);
    return document ? [document] : [];
  }

  async searchDocuments(query: string, projectId?: string, limit: number = 20): Promise<MemorySearchResult[]> {
    const memoryQuery: MemoryQuery = {
      query,
      types: ['document'],
      tags: projectId ? [projectId] : undefined,
      limit,
    };
    return this.search(memoryQuery);
  }

  async linkDocumentToProject(documentId: string, projectId: string): Promise<void> {
    await this.engine.relate(documentId, projectId, 'belongs_to_project');
  }

  async linkDocumentToConversation(documentId: string, conversationId: string): Promise<void> {
    await this.engine.relate(documentId, conversationId, 'referenced_in_conversation');
  }
}