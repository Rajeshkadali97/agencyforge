import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface IWorkingMemory {
  addNote(owner: string, note: string, tags?: string[]): Promise<MemoryItem>;
  getNotes(owner: string, tags?: string[]): Promise<MemoryItem[]>;
  removeNote(noteId: string): Promise<boolean>;
  promoteToLongTerm(noteId: string): Promise<MemoryItem>;
  clearSession(owner: string): Promise<void>;
}

export class WorkingMemoryModule extends BaseMemoryModule implements IWorkingMemory {
  readonly type: MemoryType = 'working';
  private sessionNotes: Map<string, MemoryItem[]> = new Map();

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {
    this.sessionNotes.clear();
  }

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async addNote(owner: string, note: string, tags: string[] = []): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'working',
      owner,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
      source: 'working_memory',
      entities: [],
      relationships: [],
      tags,
      importance: 0.5,
      visibility: 'private',
      security: 'unclassified',
      summary: note.slice(0, 200),
      rawContent: note,
      metadata: { sessionNote: true },
    };

    const stored = await this.store(item);

    const notes = this.sessionNotes.get(owner) || [];
    notes.push(stored);
    this.sessionNotes.set(owner, notes);

    return stored;
  }

  async getNotes(owner: string, tags?: string[]): Promise<MemoryItem[]> {
    let notes = this.sessionNotes.get(owner) || [];

    if (tags && tags.length > 0) {
      notes = notes.filter(note => tags.some(tag => note.tags.includes(tag)));
    }

    return notes;
  }

  async removeNote(noteId: string): Promise<boolean> {
    for (const [owner, notes] of this.sessionNotes.entries()) {
      const index = notes.findIndex(n => n.id === noteId);
      if (index !== -1) {
        notes.splice(index, 1);
        await this.delete(noteId);
        return true;
      }
    }
    return false;
  }

  async promoteToLongTerm(noteId: string): Promise<MemoryItem> {
    const note = await this.retrieve(noteId);
    if (!note) throw new Error(`Note not found: ${noteId}`);

    const promoted = await this.engine.getLongTermMemory().store({
      ...note,
      type: 'long-term',
      importance: Math.max(note.importance, 0.7),
      metadata: { ...note.metadata, promotedFrom: 'working', promotedAt: new Date().toISOString() },
    });

    await this.removeNote(noteId);
    return promoted;
  }

  async clearSession(owner: string): Promise<void> {
    const notes = this.sessionNotes.get(owner) || [];
    for (const note of notes) {
      await this.delete(note.id);
    }
    this.sessionNotes.delete(owner);
  }
}