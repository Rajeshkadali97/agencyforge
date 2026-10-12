import { IProviderRegistry } from "../interfaces/provider-registry.js";
import { IProvider, ProviderCapability, ProviderCategory } from "../interfaces/index.js";

/**
 * CapabilityResolver finds providers that can fulfill specific capability requirements
 * with intelligent scoring based on health, performance, cost, and other factors.
 */
export class CapabilityResolver {
  constructor(private readonly providerRegistry: IProviderRegistry) {}

  /**
   * Find providers capable of fulfilling a specific capability
   * @param capability The capability to resolve
   * @param criteria Optional selection criteria
   * @returns Array of capable providers sorted by suitability score
   */
  resolveCapability(capability: ProviderCapability, criteria?: any): IProvider[] {
    // Get all providers that support this capability
    const capableProviders = this.providerRegistry.byCapability(capability);
    
    if (capableProviders.length === 0) {
      return [];
    }

    // Score and sort providers
    return capableProviders
      .map(provider => ({
        provider,
        score: this.calculateProviderScore(provider, capability, criteria)
      }))
      .filter(item => item.score > 0) // Filter out unsuitable providers
      .sort((a, b) => b.score - a.score) // Sort by descending score
      .map(item => item.provider);
  }

  /**
   * Find providers capable of fulfilling multiple capabilities
   * @param capabilities Array of capabilities required
   * @param criteria Optional selection criteria
   * @returns Array of providers that can fulfill ALL capabilities
   */
  resolveCapabilities(capabilities: ProviderCapability[], criteria?: any): IProvider[] {
    if (capabilities.length === 0) return [];
    
    const firstCapability = capabilities[0];
    if (!firstCapability) return [];
    
    let candidates = this.providerRegistry.byCapability(firstCapability);
    
    for (let i = 1; i < capabilities.length; i++) {
      const capability = capabilities[i];
      if (!capability) continue;
      const capabilityProviders = this.providerRegistry.byCapability(capability);
      candidates = candidates.filter(provider => 
        capabilityProviders.some(p => p.id === provider.id)
      );
      
      if (candidates.length === 0) break;
    }

    // Score and sort the final candidates
    return candidates
      .map(provider => ({
        provider,
        score: this.calculateProviderScore(provider, firstCapability, criteria) // Use first capability for scoring
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.provider);
  }

  /**
   * Calculate a suitability score for a provider (0-100)
   * @param provider The provider to score
   * @param capability The capability being requested
   * @param criteria Optional selection criteria
   * @returns Score from 0-100 (higher is better)
   */
  private calculateProviderScore(provider: IProvider, capability: ProviderCapability, criteria?: any): number {
    let score = 100; // Start with perfect score

    // Apply penalties based on various factors
    
    // 1. Health penalty (if we had health metrics)
    // This would integrate with HealthManager in a full implementation
    
    // 2. Priority preference (higher priority = better)
    const priorityScores: Record<string, number> = {
      critical: 100,
      high: 80,
      normal: 60,
      low: 40,
      fallback: 20
    };
    score = score * ((priorityScores[provider.priority] ?? 100) / 100);
    
    // 3. Apply custom criteria if provided
    if (criteria) {
      // Preferred provider bonus
      if (criteria.preferredProvider && provider.id === criteria.preferredProvider) {
        score *= 1.2; // 20% bonus
      }
      
      // Penalty for non-fallback providers when fallback is preferred
      if (criteria.preferFallback && provider.priority !== 'fallback') {
        score *= 0.8; // 20% penalty
      }
      
      // Minimum health score requirement (would come from HealthManager)
      if (criteria.minHealthScore !== undefined) {
        // In a real implementation, we'd get actual health score
        // For now, we'll simulate based on priority
        const healthScore = this.estimateHealthScore(provider);
        if (healthScore < criteria.minHealthScore) {
          return 0; // Unacceptable
        }
      }
    }
    
    return Math.max(0, Math.min(100, score)); // Clamp to 0-100
  }

  /**
   * Estimate health score based on available provider properties
   * In a full implementation, this would come from HealthManager
   */
  private estimateHealthScore(provider: IProvider): number {
    // Simple heuristic based on priority - in reality this would come from health checks
    const priorityHealthMap: Record<string, number> = {
      critical: 95,
      high: 85,
      normal: 75,
      low: 60,
      fallback: 50
    };
    
    return priorityHealthMap[provider.priority] || 50;
  }
}