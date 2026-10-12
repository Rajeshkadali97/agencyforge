import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface IConversationMemory {
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

export class ConversationMemoryModule extends BaseMemoryModule implements IConversationMemory {
  readonly type: MemoryType = 'conversation';

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async getConversation(conversationId: string): Promise<MemoryItem | null> {
    return this.retrieve(conversationId);
  }

  async createConversation(data: {
    participants: string[];
    projectId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: `conversation_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'conversation',
      owner: data.participants[0] || 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
      source: 'conversation_start',
      entities: [],
      relationships: [],
      tags: ['conversation', data.projectId || 'standalone', ...data.participants],
      importance: 0.7,
      visibility: data.projectId ? 'project' : 'private',
      security: 'internal',
      summary: `Conversation with ${data.participants.join(', ')}`,
      rawContent: JSON.stringify(data, null, 2),
      metadata: { ...data.metadata, conversation: true, participants: data.participants, projectId: data.projectId, messages: [] },
    };

    return this.store(item);
  }

  async addMessage(conversationId: string, message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem> {
    const conversation = await this.retrieve(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const messages = (conversation.metadata.messages as unknown[]) || [];
    messages.push({
      ...message,
      timestamp: new Date().toISOString(),
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    });

    await this.update(conversationId, {
      metadata: { ...conversation.metadata, messages },
      updatedAt: new Date().toISOString(),
      rawContent: conversation.rawContent + '\n' + JSON.stringify(message),
    });

    // Also store message as separate memory item for searchability
    const messageId = `message_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const messageItem: MemoryItem = {
      id: messageId,
      type: 'conversation',
      owner: conversation.owner,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
      source: 'conversation_message',
      entities: [],
      relationships: [{ id: `rel_${Date.now()}`, sourceEntityId: messageId, targetEntityId: conversationId, type: 'part_of_conversation', properties: {}, confidence: 1.0, createdAt: new Date().toISOString() }],
      tags: ['message', message.role, ...conversation.tags],
      importance: 0.5,
      visibility: conversation.visibility,
      security: conversation.security,
      summary: message.content.slice(0, 200),
      rawContent: JSON.stringify(message),
      metadata: { ...message.metadata, message: true, conversationId, role: message.role },
    };

    return this.store(messageItem);
  }

  async getMessages(conversationId: string, limit: number = 50, offset: number = 0): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['conversation'],
      tags: ['message', conversationId],
      limit: limit + offset,
    };
    const results = await this.search(query);
    return results.slice(offset, offset + limit).map(r => r.item);
  }

  async summarizeConversation(conversationId: string): Promise<string> {
    const conversation = await this.retrieve(conversationId);
    if (!conversation) return '';

    return this.engine.summarize([conversationId]);
  }

  async linkConversationToProject(conversationId: string, projectId: string): Promise<void> {
    await this.engine.relate(conversationId, projectId, 'belongs_to_project');
  }

  async linkConversationToUser(conversationId: string, userId: string): Promise<void> {
    await this.engine.relate(conversationId, userId, 'participated_by');
  }
}