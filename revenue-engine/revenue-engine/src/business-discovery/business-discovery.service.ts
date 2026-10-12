import type { DomainEventPublisher } from "../interfaces/index.js";
import { ProviderRegistry, fail, ok, type Result } from "../shared/index.js";
import type { BusinessDiscoveryProvider, BusinessDiscoveryService } from "./interfaces.js";
import type { BusinessDiscoveryBatch, BusinessDiscoveryRequest } from "./types.js";

export class ProviderBasedBusinessDiscoveryService implements BusinessDiscoveryService {
  constructor(
    private readonly providers: ProviderRegistry<BusinessDiscoveryProvider>,
    private readonly events?: DomainEventPublisher
  ) {}

  async discover(request: BusinessDiscoveryRequest): Promise<Result<BusinessDiscoveryBatch>> {
    const selectedProviders = this.selectProviders(request.providerIds);

    if (selectedProviders.length === 0) {
      return fail({
        code: "business_discovery.no_provider",
        message: "No business discovery providers are registered for the request."
      });
    }

    const batches: BusinessDiscoveryBatch[] = [];

    for (const provider of selectedProviders) {
      const result = await provider.discover(request.criteria);

      if (!result.ok) {
        return result;
      }

      batches.push(result.value);
    }

    const batch = this.mergeBatches(batches);
    await this.events?.publish({
      id: crypto.randomUUID(),
      type: "business_discovery.completed",
      occurredAt: new Date(),
      payload: { traceId: request.traceId, leadCount: batch.leads.length }
    });

    return ok(batch);
  }

  private selectProviders(providerIds?: readonly string[]): readonly BusinessDiscoveryProvider[] {
    if (!providerIds || providerIds.length === 0) {
      return this.providers.list();
    }

    return providerIds.map((providerId) => this.providers.require(providerId));
  }

  private mergeBatches(batches: readonly BusinessDiscoveryBatch[]): BusinessDiscoveryBatch {
    const leadsByDomainOrId = new Map<string, BusinessDiscoveryBatch["leads"][number]>();

    for (const lead of batches.flatMap((batch) => batch.leads)) {
      const key = lead.identity.domain ?? lead.identity.websiteUrl ?? lead.id;
      leadsByDomainOrId.set(key, lead);
    }

    return {
      leads: Array.from(leadsByDomainOrId.values()),
      providerSummaries: batches.flatMap((batch) => batch.providerSummaries)
    };
  }
}
