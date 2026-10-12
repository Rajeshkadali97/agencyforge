/**
 * Shared Kernel
 * Cross-cutting concerns: errors, validation, identifiers, and provider contracts.
 * Kept minimal and dependency-free to remain portable across all modules.
 */

// ─── Identifier ───
export type EntityId = string;

export function createId(): EntityId {
  return crypto.randomUUID();
}

// ─── Result type (Railway-oriented) ───
export interface Ok<T> {
  success: true;
  data: T;
}

export interface Err<E> {
  success: false;
  error: E;
}

export type Result<T, E = RevenueEngineError> = Ok<T> | Err<E>;

export function ok<T>(data: T): Ok<T> {
  return { success: true, data };
}

export function err<E>(error: E): Err<E> {
  return { success: false, error };
}

// ─── Domain Error Base ───
export abstract class RevenueEngineError extends Error {
  abstract readonly code: string;
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends RevenueEngineError {
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
  }
}

export class NotFoundError extends RevenueEngineError {
  readonly code = 'NOT_FOUND';
  constructor(message: string) {
    super(message);
  }
}

export class ConfigurationError extends RevenueEngineError {
  readonly code = 'CONFIGURATION_ERROR';
  constructor(message: string) {
    super(message);
  }
}

// ─── Provider Contract ───
export interface Provider<T> {
  name: string;
  connect(): Promise<void>;
  disconnect?(): Promise<void>;
  getClient(): T;
}

export interface UseCase<I, O> {
  execute(input: I): Promise<O>;
}
