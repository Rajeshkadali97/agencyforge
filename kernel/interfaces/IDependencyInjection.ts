export type ServiceToken<T = unknown> = symbol | string;

export interface IDependencyInjectionContainer {
  /** Register a service factory */
  register<T>(token: ServiceToken<T>, factory: () => T, singleton?: boolean): void;

  /** Register a value directly */
  registerValue<T>(token: ServiceToken<T>, value: T): void;

  /** Resolve a service by token */
  resolve<T>(token: ServiceToken<T>): T;

  /** Check if a service is registered */
  has<T>(token: ServiceToken<T>): boolean;

  /** Remove a registered service */
  remove<T>(token: ServiceToken<T>): boolean;

  /** Create a child container (scoped DI) */
  createChild(): IDependencyInjectionContainer;
}
