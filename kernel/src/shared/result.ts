export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = <T, E>(error: E): Result<T, E> => ({
  ok: false,
  error,
});