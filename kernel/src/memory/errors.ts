export class MemoryEngineError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "MemoryEngineError";
  }

  public toString(): string {
    return `[${this.code}] ${this.message}`;
  }
}

export class CogneeProviderError extends MemoryEngineError {
  public constructor(message: string, details?: unknown) {
    super(message, "COGNEE_PROVIDER_ERROR", details);
    this.name = "CogneeProviderError";
  }
}

export class ConnectionError extends MemoryEngineError {
  public constructor(message: string, details?: unknown) {
    super(message, "CONNECTION_ERROR", details);
    this.name = "ConnectionError";
  }
}

export class ValidationError extends MemoryEngineError {
  public constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends MemoryEngineError {
  public constructor(memoryId: string) {
    super(`Memory not found: ${memoryId}`, "NOT_FOUND_ERROR", { memoryId });
    this.name = "NotFoundError";
  }
}

export class SearchError extends MemoryEngineError {
  public constructor(message: string, details?: unknown) {
    super(message, "SEARCH_ERROR", details);
    this.name = "SearchError";
  }
}

export class SummarizationError extends MemoryEngineError {
  public constructor(message: string, details?: unknown) {
    super(message, "SUMMARIZATION_ERROR", details);
    this.name = "SummarizationError";
  }
}