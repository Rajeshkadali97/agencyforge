import { IProviderRegistry } from "../interfaces/provider-registry.js";
import { IProvider, ProviderHealth, ProviderCapability } from "../interfaces/index.js";
import { Result } from "../../shared/result.js";

/**
 * ProviderHealthManager tracks and manages the health status of all providers
 */
export class ProviderHealthManager {
  private readonly providerRegistry: IProviderRegistry;
  private readonly healthRecords: Map<string, ProviderHealth> = new Map();
  private readonly healthCheckIntervalMs: number;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    providerRegistry: IProviderRegistry,
    options: { 
      healthCheckIntervalMs?: number; 
      autoStart?: boolean 
    } = {}
  ) {
    this.providerRegistry = providerRegistry;
    this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? 30000; // 30 seconds default
    
    if (options.autoStart !== false) {
      this.startMonitoring();
    }
  }

  /**
   * Start periodic health monitoring of all providers
   */
  startMonitoring(): void {
    if (this.healthCheckTimer) return;
    
    this.healthCheckTimer = setInterval(() => {
      this.checkAllProvidersHealth();
    }, this.healthCheckIntervalMs);
    
    // Do an initial check immediately
    this.checkAllProvidersHealth();
  }

  /**
   * Stop periodic health monitoring
   */
  stopMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Check health of all providers and update records
   */
  async checkAllProvidersHealth(): Promise<void> {
    const providers = this.providerRegistry.list();
    
    for (const provider of providers) {
      try {
        const healthResult = await provider.healthCheck();
        if (healthResult.ok) {
          this.healthRecords.set(provider.id, healthResult.value);
        } else {
          // Create a default unhealthy status when health check fails
          this.healthRecords.set(provider.id, {
            status: "unavailable",
            checkedAt: new Date(),
            details: healthResult.error.message
          });
        }
      } catch (error) {
        // Handle unexpected errors
        this.healthRecords.set(provider.id, {
          status: "unavailable",
          checkedAt: new Date(),
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Get current health status for a provider
   * @param providerId The provider ID
   * @returns Health status or null if unknown
   */
  getProviderHealth(providerId: string): ProviderHealth | null {
    return this.healthRecords.get(providerId) ?? null;
  }

  /**
   * Get health status for all providers
   * @returns Map of provider IDs to their health status
   */
  getAllProvidersHealth(): ReadonlyMap<string, ProviderHealth> {
    return new Map(this.healthRecords);
  }

  /**
   * Check if a provider is healthy enough to use
   * @param providerId The provider ID
   * @returns True if provider is healthy or degraded (usable)
   */
  isProviderUsable(providerId: string): boolean {
    const health = this.getProviderHealth(providerId);
    if (!health) return false; // Unknown health = not usable
    
    return health.status === "available" || health.status === "degraded";
  }

  /**
   * Get a list of usable providers for a given capability
   * @param capability The capability needed
   * @returns Array of usable providers
   */
  getUsableProvidersForCapability(capability: string): IProvider[] {
    const capableProviders = this.providerRegistry.byCapability(capability as ProviderCapability);
    return capableProviders.filter(provider => 
      this.isProviderUsable(provider.id)
    );
  }

  /**
   * Get providers sorted by health status (healthiest first)
   * @param providers Array of providers to sort
   * @returns Providers sorted by health status
   */
  sortByHealth(providers: IProvider[]): IProvider[] {
    return [...providers].sort((a, b) => {
      const healthA = this.getProviderHealth(a.id);
      const healthB = this.getProviderHealth(b.id);
      
      // Unknown health goes to the end
      if (!healthA && !healthB) return 0;
      if (!healthA) return 1;
      if (!healthB) return -1;
      
      // Define health status order: healthy > degraded > unavailable
      const statusOrder: Record<string, number> = {
        healthy: 3,
        degraded: 2,
        unavailable: 1
      };
      
      return (statusOrder[healthB.status] || 0) - (statusOrder[healthA.status] || 0);
    });
  }
}