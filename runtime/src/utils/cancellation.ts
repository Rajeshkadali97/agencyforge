export class CancellationToken {
  private cancelled = false;
  private reason?: string;
  private listeners: Array<() => void> = [];

  get isCancelled(): boolean {
    return this.cancelled;
  }

  get cancellationReason(): string | undefined {
    return this.reason;
  }

  cancel(reason?: string): void {
    if (!this.cancelled) {
      this.cancelled = true;
      this.reason = reason;
      this.listeners.forEach((listener) => listener());
      this.listeners = [];
    }
  }

  onCancelled(listener: () => void): () => void {
    if (this.cancelled) {
      listener();
      return () => {};
    }
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  throwIfCancelled(): void {
    if (this.cancelled) {
      throw new CancellationError(this.reason || 'Operation cancelled');
    }
  }

  static none(): CancellationToken {
    const token = new CancellationToken();
    token.cancel = () => {}; // Override to make it never cancel
    return token;
  }
}

export class CancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CancellationError';
  }
}

export function isCancellationError(error: unknown): error is CancellationError {
  return error instanceof CancellationError;
}

export interface Cancellable {
  cancellationToken: CancellationToken;
}