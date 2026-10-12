export type Result<T, E extends RevenueEngineError = RevenueEngineError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface RevenueEngineError {
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
  readonly retryable?: boolean;
}

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = (error: RevenueEngineError): Result<never> => ({
  ok: false,
  error
});
