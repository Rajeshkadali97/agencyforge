import { IDependencyInjectionContainer, ServiceToken } from '../interfaces/IDependencyInjection';

interface ServiceEntry<T> {
  factory?: () => T;
  value?: T;
  singleton: boolean;
  resolved: boolean;
}

export class DependencyInjectionContainer implements IDependencyInjectionContainer {
  private services: Map<string | symbol, ServiceEntry<unknown>> = new Map();
  private readonly parent: DependencyInjectionContainer | undefined;

  constructor(parent?: DependencyInjectionContainer) {
    this.parent = parent;
  }

  public register<T>(
    token: ServiceToken<T>,
    factory: () => T,
    singleton = false
  ): void {
    const key = this.tokenKey(token);
    this.services.set(key, {
      factory,
      singleton,
      resolved: false,
    });
  }

  public registerValue<T>(token: ServiceToken<T>, value: T): void {
    const key = this.tokenKey(token);
    this.services.set(key, {
      value,
      singleton: true,
      resolved: true,
    });
  }

  public resolve<T>(token: ServiceToken<T>): T {
    const key = this.tokenKey(token);
    const entry = this.services.get(key) as ServiceEntry<T> | undefined;

    if (entry) {
      if (entry.singleton) {
        if (!entry.resolved && entry.factory) {
          entry.value = entry.factory();
          entry.resolved = true;
        }
        if (entry.value !== undefined) {
          return entry.value;
        }
      } else {
        if (entry.factory) {
          return entry.factory();
        }
      }
    }

    if (this.parent) {
      return this.parent.resolve(token);
    }

    throw new Error(`Service not registered: ${String(token)}`);
  }

  public has<T>(token: ServiceToken<T>): boolean {
    const key = this.tokenKey(token);
    return this.services.has(key) || (this.parent?.has(token) ?? false);
  }

  public remove<T>(token: ServiceToken<T>): boolean {
    const key = this.tokenKey(token);
    return this.services.delete(key);
  }

  public createChild(): IDependencyInjectionContainer {
    return new DependencyInjectionContainer(this);
  }

  private tokenKey(token: ServiceToken<unknown>): string {
    return typeof token === 'symbol' ? token.toString() : token;
  }
}
