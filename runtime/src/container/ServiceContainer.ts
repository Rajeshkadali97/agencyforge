import { IConfiguration } from '../interfaces';

export enum ServiceLifetime {
  Singleton = 'singleton',
  Scoped = 'scoped',
  Transient = 'transient',
}

export interface ServiceRegistration<T = unknown> {
  token: ServiceToken<T>;
  lifetime: ServiceLifetime;
  factory?: ServiceFactory<T>;
  instance?: T;
  lazy: boolean;
  dependencies: ServiceToken<unknown>[];
  interfaceToken?: ServiceToken<unknown>;
  initialized: boolean;
}

export type ServiceToken<T> = symbol & { __type: T };

export type ServiceFactory<T> = (container: IServiceContainer) => T;

export interface ServiceOptions {
  lifetime?: ServiceLifetime;
  lazy?: boolean;
  dependencies?: ServiceToken<unknown>[];
  interfaceToken?: ServiceToken<unknown>;
}

export interface ModuleConfig {
  name: string;
  dependencies?: string[];
  register?(container: IServiceContainer): void;
  initialize?(container: IServiceContainer): Promise<void>;
  shutdown?(container: IServiceContainer): Promise<void>;
  validate?(): boolean;
}

export interface ModuleRegistration {
  config: ModuleConfig;
  initialized: boolean;
}

export interface IServiceRegistry {
  register<T>(token: ServiceToken<T>, implementation: T | ServiceFactory<T>, options?: ServiceOptions): void;
  get<T>(token: ServiceToken<T>): T;
  getOptional<T>(token: ServiceToken<T>): T | undefined;
  has<T>(token: ServiceToken<T>): boolean;
  unregister<T>(token: ServiceToken<T>): boolean;
  resolveInterface<T>(interfaceToken: ServiceToken<T>): T;
}

export interface IServiceContainer extends IServiceRegistry {
  createScope(): IServiceScope;
  discoverServices(): ServiceToken<unknown>[];
  getRegistration<T>(token: ServiceToken<T>): ServiceRegistration<T> | undefined;
  getAllRegistrations(): ServiceRegistration[];
  registerModule(moduleConfig: ModuleConfig): void;
  getModule(name: string): ModuleRegistration | undefined;
  getAllModules(): ModuleRegistration[];
  initializeModules(): Promise<void>;
  shutdownModules(): Promise<void>;
  validateRegistrations(): string[];
  resolve<T>(token: ServiceToken<T>): T;
}

export interface IServiceScope extends IServiceRegistry {
  dispose(): void;
  parentId: string;
}

export class CircularDependencyError extends Error {
  constructor(public readonly chain: string[]) {
    super(`Circular dependency detected: ${chain.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

export class ServiceNotFoundError extends Error {
  constructor(public readonly token: string) {
    super(`Service not found: ${token}`);
    this.name = 'ServiceNotFoundError';
  }
}

export class ModuleInitializationError extends Error {
  constructor(public readonly moduleName: string, public readonly cause: Error) {
    super(`Module initialization failed: ${moduleName} - ${cause.message}`);
    this.name = 'ModuleInitializationError';
  }
}

export class ServiceContainer implements IServiceContainer {
  private registrations: Map<string | symbol, ServiceRegistration> = new Map();
  private modules: Map<string, ModuleRegistration> = new Map();
  private parent?: IServiceContainer;
  private scopedInstances: Map<string | symbol, unknown> = new Map();
  private resolutionStack: (string | symbol)[] = [];
  private id = `container_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  constructor(parent?: IServiceContainer) {
    this.parent = parent;
  }

  register<T>(
    token: ServiceToken<T>,
    implementation: T | ServiceFactory<T>,
    options: ServiceOptions = {}
  ): void {
    const lifetime = options.lifetime ?? ServiceLifetime.Singleton;
    const lazy = options.lazy ?? false;
    const dependencies = options.dependencies ?? [];
    const interfaceToken = options.interfaceToken;

    const registration: ServiceRegistration<T> = {
      token,
      lifetime,
      factory: typeof implementation === 'function' ? implementation as ServiceFactory<T> : undefined,
      instance: typeof implementation !== 'function' ? implementation : undefined,
      lazy,
      dependencies,
      interfaceToken,
      initialized: typeof implementation !== 'function',
    };

    this.registrations.set(token as symbol, registration as ServiceRegistration);

    if (!lazy && lifetime === ServiceLifetime.Singleton && !registration.instance) {
      this.get(token);
    }
  }

  registerSingleton<T>(token: ServiceToken<T>, implementation: T | ServiceFactory<T>, options?: Omit<ServiceOptions, 'lifetime'>): void {
    this.register(token, implementation, { ...options, lifetime: ServiceLifetime.Singleton });
  }

  registerScoped<T>(token: ServiceToken<T>, factory: ServiceFactory<T>, options?: Omit<ServiceOptions, 'lifetime'>): void {
    this.register(token, factory, { ...options, lifetime: ServiceLifetime.Scoped });
  }

  registerTransient<T>(token: ServiceToken<T>, factory: ServiceFactory<T>, options?: Omit<ServiceOptions, 'lifetime'>): void {
    this.register(token, factory, { ...options, lifetime: ServiceLifetime.Transient });
  }

  registerInstance<T>(token: ServiceToken<T>, instance: T, options?: Omit<ServiceOptions, 'lifetime'>): void {
    this.register(token, instance, { ...options, lifetime: ServiceLifetime.Singleton });
  }

  registerFactory<T>(token: ServiceToken<T>, factory: ServiceFactory<T>, options?: ServiceOptions): void {
    this.register(token, factory, options);
  }

  get<T>(token: ServiceToken<T>): T {
    return this.resolve(token);
  }

  resolve<T>(token: ServiceToken<T>): T {
    const tokenKey = this.getTokenKey(token);

    if (this.resolutionStack.includes(tokenKey)) {
      throw new CircularDependencyError([...this.resolutionStack, tokenKey].map(String));
    }

    const registration = this.registrations.get(tokenKey);

    if (!registration) {
      if (this.parent) {
        return this.parent.get(token);
      }
      throw new ServiceNotFoundError(String(tokenKey));
    }

    switch (registration.lifetime) {
      case ServiceLifetime.Singleton:
        if (registration.instance !== undefined && registration.initialized) {
          return registration.instance as T;
        }
        break;
      case ServiceLifetime.Scoped:
        if (this.scopedInstances.has(tokenKey)) {
          return this.scopedInstances.get(tokenKey) as T;
        }
        break;
      case ServiceLifetime.Transient:
        break;
    }

    this.resolutionStack.push(tokenKey);

    try {
      this.validateDependencies(registration);

      let instance: T;
      if (registration.factory) {
        instance = registration.factory(this) as T;
      } else if (registration.instance !== undefined) {
        instance = registration.instance as T;
      } else {
        throw new ServiceNotFoundError(String(tokenKey));
      }

      switch (registration.lifetime) {
        case ServiceLifetime.Singleton:
          registration.instance = instance;
          registration.initialized = true;
          break;
        case ServiceLifetime.Scoped:
          this.scopedInstances.set(tokenKey, instance);
          break;
        case ServiceLifetime.Transient:
          break;
      }

      return instance;
    } finally {
      this.resolutionStack.pop();
    }
  }

  resolveInterface<T>(interfaceToken: ServiceToken<T>): T {
    for (const [, reg] of this.registrations) {
      if (reg.interfaceToken === interfaceToken) {
        return this.get(reg.token as ServiceToken<T>);
      }
    }
    if (this.parent) {
      return this.parent.resolveInterface(interfaceToken);
    }
    throw new ServiceNotFoundError(String(this.getTokenKey(interfaceToken)));
  }

  getOptional<T>(token: ServiceToken<T>): T | undefined {
    try {
      return this.get(token);
    } catch {
      return undefined;
    }
  }

  has<T>(token: ServiceToken<T>): boolean {
    const tokenKey = this.getTokenKey(token);
    if (this.registrations.has(tokenKey)) {
      return true;
    }
    return this.parent?.has(token) ?? false;
  }

  unregister<T>(token: ServiceToken<T>): boolean {
    const tokenKey = this.getTokenKey(token);
    const result = this.registrations.delete(tokenKey);
    this.scopedInstances.delete(tokenKey);
    return result;
  }

  getRegistration<T>(token: ServiceToken<T>): ServiceRegistration<T> | undefined {
    const tokenKey = this.getTokenKey(token);
    return this.registrations.get(tokenKey) as ServiceRegistration<T> | undefined;
  }

  getAllRegistrations(): ServiceRegistration[] {
    return Array.from(this.registrations.values());
  }

  discoverServices(): ServiceToken<unknown>[] {
    return Array.from(this.registrations.keys()) as unknown as ServiceToken<unknown>[];
  }

  createScope(): IServiceScope {
    return new ServiceScope(this);
  }

  registerModule(moduleConfig: ModuleConfig): void {
    if (this.modules.has(moduleConfig.name)) {
      throw new Error(`Module already registered: ${moduleConfig.name}`);
    }
    this.modules.set(moduleConfig.name, { config: moduleConfig, initialized: false });
    if (moduleConfig.register) {
      moduleConfig.register(this);
    }
  }

  getModule(name: string): ModuleRegistration | undefined {
    return this.modules.get(name);
  }

  getAllModules(): ModuleRegistration[] {
    return Array.from(this.modules.values());
  }

  async initializeModules(): Promise<void> {
    const sorted = this.sortModulesByDependency();

    for (const mod of sorted) {
      if (mod.config.initialize) {
        try {
          await mod.config.initialize(this);
          mod.initialized = true;
        } catch (error) {
          throw new ModuleInitializationError(
            mod.config.name,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      } else {
        mod.initialized = true;
      }
    }
  }

  async shutdownModules(): Promise<void> {
    const sorted = this.sortModulesByDependency().reverse();

    for (const mod of sorted) {
      if (mod.initialized && mod.config.shutdown) {
        try {
          await mod.config.shutdown(this);
        } catch {
          // Continue shutdown even if a module fails
        }
        mod.initialized = false;
      }
    }
  }

  validateRegistrations(): string[] {
    const errors: string[] = [];

    for (const [tokenKey, reg] of this.registrations) {
      if (reg.dependencies && reg.dependencies.length > 0) {
        for (const dep of reg.dependencies) {
          if (!this.has(dep as ServiceToken<unknown>)) {
            errors.push(`Service ${String(tokenKey)} depends on unresolved token ${String(this.getTokenKey(dep as ServiceToken<unknown>))}`);
          }
        }
      }
    }

    for (const [name, mod] of this.modules) {
      if (mod.config.dependencies) {
        for (const dep of mod.config.dependencies) {
          if (!this.modules.has(dep)) {
            errors.push(`Module ${name} depends on unregistered module ${dep}`);
          }
        }
      }
    }

    for (const [name] of this.modules) {
      try {
        this.validateModuleCycle(name, []);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }

    return errors;
  }

  getContainerId(): string {
    return this.id;
  }

  private validateDependencies(registration: ServiceRegistration): void {
    if (!registration.dependencies || registration.dependencies.length === 0) return;

    for (const dep of registration.dependencies) {
      if (!this.has(dep as ServiceToken<unknown>)) {
        throw new ServiceNotFoundError(
          `Dependency ${String(this.getTokenKey(dep as ServiceToken<unknown>))} not found for ${String(this.getTokenKey(registration.token as ServiceToken<unknown>))}`
        );
      }
    }
  }

  private sortModulesByDependency(): ModuleRegistration[] {
    const modules = Array.from(this.modules.values());
    const sorted: ModuleRegistration[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new CircularDependencyError([...visiting, name].map(String));
      }
      visiting.add(name);

      const mod = this.modules.get(name);
      if (mod?.config.dependencies) {
        for (const dep of mod.config.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(mod!);
    };

    for (const mod of modules) {
      visit(mod.config.name);
    }

    return sorted;
  }

  private validateModuleCycle(name: string, path: string[]): void {
    if (path.includes(name)) {
      throw new CircularDependencyError([...path, name]);
    }
    const mod = this.modules.get(name);
    if (mod?.config.dependencies) {
      for (const dep of mod.config.dependencies) {
        this.validateModuleCycle(dep, [...path, name]);
      }
    }
  }

  private getTokenKey<T>(token: ServiceToken<T> | string | symbol): string | symbol {
    if (typeof token === 'string' || typeof token === 'symbol') {
      return token;
    }
    return token as unknown as string | symbol;
  }
}

export class ServiceScope implements IServiceScope {
  private container: ServiceContainer;
  private disposables: Array<() => void> = [];
  public parentId: string;

  constructor(parent: IServiceContainer) {
    this.container = new ServiceContainer(parent);
    this.parentId = (parent as ServiceContainer).getContainerId?.() ?? 'unknown';
  }

  register<T>(token: ServiceToken<T>, implementation: T | ServiceFactory<T>, options?: ServiceOptions): void {
    this.container.register(token, implementation, options);
  }

  get<T>(token: ServiceToken<T>): T {
    return this.container.get(token);
  }

  getOptional<T>(token: ServiceToken<T>): T | undefined {
    return this.container.getOptional(token);
  }

  has<T>(token: ServiceToken<T>): boolean {
    return this.container.has(token);
  }

  unregister<T>(token: ServiceToken<T>): boolean {
    return this.container.unregister(token);
  }

  resolveInterface<T>(interfaceToken: ServiceToken<T>): T {
    return this.container.resolveInterface(interfaceToken);
  }

  dispose(): void {
    this.disposables.forEach((dispose) => dispose());
    this.disposables = [];
  }

  registerDisposable(dispose: () => void): void {
    this.disposables.push(dispose);
  }
}

export function createServiceToken<T>(description: string): ServiceToken<T> {
  return Symbol(description) as unknown as ServiceToken<T>;
}

export const ServiceTokens: Record<string, ServiceToken<unknown>> = {
  EventBus: Symbol('EventBus') as unknown as ServiceToken<unknown>,
  EnhancedEventBus: Symbol('EnhancedEventBus') as unknown as ServiceToken<unknown>,
  StateStore: Symbol('StateStore') as unknown as ServiceToken<unknown>,
  SharedContextManager: Symbol('SharedContextManager') as unknown as ServiceToken<unknown>,
  WorkflowEngine: Symbol('WorkflowEngine') as unknown as ServiceToken<unknown>,
  AgentRegistry: Symbol('AgentRegistry') as unknown as ServiceToken<unknown>,
  Configuration: Symbol('Configuration') as unknown as ServiceToken<unknown>,
  Logger: Symbol('Logger') as unknown as ServiceToken<unknown>,
  RuntimeCoordinator: Symbol('RuntimeCoordinator') as unknown as ServiceToken<unknown>,
  DashboardBinding: Symbol('DashboardBinding') as unknown as ServiceToken<unknown>,
  CharacterBinding: Symbol('CharacterBinding') as unknown as ServiceToken<unknown>,
  VoiceBinding: Symbol('VoiceBinding') as unknown as ServiceToken<unknown>,
  MemoryBinding: Symbol('MemoryBinding') as unknown as ServiceToken<unknown>,
  KernelBinding: Symbol('KernelBinding') as unknown as ServiceToken<unknown>,
  AIProviderRouter: Symbol('AIProviderRouter') as unknown as ServiceToken<unknown>,
  ToolRegistry: Symbol('ToolRegistry') as unknown as ServiceToken<unknown>,
  Scheduler: Symbol('Scheduler') as unknown as ServiceToken<unknown>,
  Observability: Symbol('Observability') as unknown as ServiceToken<unknown>,
  ErrorRecovery: Symbol('ErrorRecovery') as unknown as ServiceToken<unknown>,
  HealthManager: Symbol('HealthManager') as unknown as ServiceToken<unknown>,
  RuntimeIntegrator: Symbol('RuntimeIntegrator') as unknown as ServiceToken<unknown>,
  ServiceDiscovery: Symbol('ServiceDiscovery') as unknown as ServiceToken<unknown>,
  LifecycleManager: Symbol('LifecycleManager') as unknown as ServiceToken<unknown>,
  StartupManager: Symbol('StartupManager') as unknown as ServiceToken<unknown>,
  ShutdownManager: Symbol('ShutdownManager') as unknown as ServiceToken<unknown>,
};
