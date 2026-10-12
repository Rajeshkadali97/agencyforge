import type { DomainEventPublisher } from "../interfaces/index.js";
import { ProviderRegistry, fail, type Result } from "../shared/index.js";
import type { CrmProvider, CrmSyncService } from "./interfaces.js";
import type { CrmSyncRequest, CrmSyncResult } from "./types.js";

export class ProviderBasedCrmSyncService implements CrmSyncService {
  constructor(
    private readonly providers: ProviderRegistry<CrmProvider>,
    private readonly defaultProviderId?: string,
    private readonly events?: DomainEventPublisher
  ) {}

  async sync(request: CrmSyncRequest): Promise<Result<CrmSyncResult>> {
    const providerId = request.providerId ?? this.defaultProviderId;

    if (!providerId) {
      return fail({
        code: "crm.no_provider",
        message: "No CRM provider was selected."
      });
    }

    const result = await this.providers.require(providerId).sync(request);

    if (result.ok) {
      await this.events?.publish({
        id: crypto.randomUUID(),
        type: "crm.synced",
        occurredAt: new Date(),
        payload: {
          leadId: result.value.leadId,
          externalRefCount: result.value.externalRefs.length,
          traceId: request.traceId
        }
      });
    }

    return result;
  }
}
