export function generateId(prefix: string = 'mem'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateEmbeddingId(): string {
  return `emb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateEntityId(): string {
  return `ent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateRelationshipId(): string {
  return `rel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateArchiveId(): string {
  return `archive_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function sanitizeForStorage(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return data.replace(/[\x00-\x1F\x7F]/g, '');
  if (Array.isArray(data)) return data.map(sanitizeForStorage);
  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeForStorage(value);
    }
    return sanitized;
  }
  return data;
}

export function calculateImportance(content: string, metadata: Record<string, unknown>): number {
  let importance = 0.5;

  // Length factor
  if (content.length > 10000) importance += 0.1;
  else if (content.length > 1000) importance += 0.05;

  // Metadata factors
  if (metadata.pinned) importance = 1.0;
  if (metadata.archived) importance = Math.max(0.1, importance - 0.3);
  if (metadata.verified) importance += 0.1;
  if (metadata.deprecated) importance = Math.max(0.1, importance - 0.5);

  // Tag factors
  const tags = (metadata.tags as string[]) || [];
  if (tags.includes('important')) importance += 0.2;
  if (tags.includes('critical')) importance += 0.3;
  if (tags.includes('reference')) importance += 0.1;

  return Math.min(1.0, Math.max(0.0, importance));
}

export function calculateConfidence(source: string, metadata: Record<string, unknown>): number {
  let confidence = 0.5;

  // Source factor
  const sourceConfidence: Record<string, number> = {
    'user_input': 0.9,
    'agent_output': 0.8,
    'document_extraction': 0.7,
    'web_scraping': 0.6,
    'api_response': 0.8,
    'inference': 0.5,
    'heuristic': 0.4,
  };
  confidence = sourceConfidence[source] || 0.5;

  // Metadata factors
  if (metadata.verified) confidence = Math.min(1.0, confidence + 0.2);
  if (metadata.crossReferenced) confidence = Math.min(1.0, confidence + 0.1);
  if (metadata.confidence) confidence = (confidence + (metadata.confidence as number)) / 2;

  return Math.min(1.0, Math.max(0.0, confidence));
}

export function extractTags(content: string, existingTags: string[] = []): string[] {
  const tags = new Set(existingTags);

  // Extract hashtags
  const hashtags = content.match(/#(\w+)/g);
  if (hashtags) {
    hashtags.forEach(tag => tags.add(tag.slice(1).toLowerCase()));
  }

  // Extract @mentions
  const mentions = content.match(/@(\w+)/g);
  if (mentions) {
    mentions.forEach(mention => tags.add(`mention:${mention.slice(1).toLowerCase()}`));
  }

  // Extract URLs domains
  const urls = content.match(/https?:\/\/([^\/\s]+)/g);
  if (urls) {
    urls.forEach(url => {
      const domain = url.replace(/https?:\/\//, '').split('/')[0];
      tags.add(`domain:${domain}`);
    });
  }

  return Array.from(tags);
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + '...';
}

export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0;

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

export function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec;
  return vec.map(v => v / norm);
}

export function chunkText(text: string, chunkSize: number = 512, overlap: number = 128): string[] {
  const chunks: string[] = [];
  const tokens = text.split(/\s+/);
  let start = 0;

  while (start < tokens.length) {
    const end = Math.min(start + chunkSize, tokens.length);
    chunks.push(tokens.slice(start, end).join(' '));
    start = end - overlap;
    if (start >= tokens.length) break;
  }

  return chunks;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelay: number; maxDelay: number; backoffMultiplier: number } = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  }
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === options.maxRetries) break;

      const delay = Math.min(
        options.baseDelay * Math.pow(options.backoffMultiplier, attempt),
        options.maxDelay
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export function createEventEmitter<T extends Record<string, unknown>>(): {
  on: <K extends keyof T>(event: K, handler: (data: T[K]) => void) => () => void;
  emit: <K extends keyof T>(event: K, data: T[K]) => void;
  off: <K extends keyof T>(event: K, handler: (data: T[K]) => void) => void;
} {
  const handlers: Map<string, Set<Function>> = new Map();

  return {
    on(event, handler) {
      if (!handlers.has(event as string)) {
        handlers.set(event as string, new Set());
      }
      handlers.get(event as string)!.add(handler);
      return () => handlers.get(event as string)?.delete(handler);
    },
    emit(event, data) {
      handlers.get(event as string)?.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${String(event)}:`, error);
        }
      });
    },
    off(event, handler) {
      handlers.get(event as string)?.delete(handler);
    },
  };
}