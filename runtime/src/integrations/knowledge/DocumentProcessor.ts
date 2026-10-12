export interface DocumentEntity {
  type: string;
  value: string;
  confidence: number;
}

export class DocumentProcessor {
  process(content: string): DocumentEntity[] {
    const entities: DocumentEntity[] = [];
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const urlRegex = /https?:\/\/[^\s]+/g;
    
    let match;
    while ((match = emailRegex.exec(content)) !== null) {
      entities.push({ type: 'email', value: match[0], confidence: 0.95 });
    }
    while ((match = urlRegex.exec(content)) !== null) {
      entities.push({ type: 'url', value: match[0], confidence: 0.9 });
    }
    
    return entities;
  }
}