import type { DomainEventPublisher } from "../interfaces/index.js";
import { ProviderRegistry, fail, type Result } from "../shared/index.js";
import type { WebsiteAuditProvider, WebsiteAuditService } from "./interfaces.js";
import type { WebsiteAuditReport, WebsiteAuditRequest } from "./types.js";

export class ProviderBasedWebsiteAuditService implements WebsiteAuditService {
  constructor(
    private readonly providers: ProviderRegistry<WebsiteAuditProvider>,
    private readonly defaultProviderId?: string,
    private readonly events?: DomainEventPublisher
  ) {}

  async audit(request: WebsiteAuditRequest): Promise<Result<WebsiteAuditReport>> {
    const providerId = request.providerId ?? this.defaultProviderId;

    if (!providerId) {
      return fail({
        code: "website_audit.no_provider",
        message: "No website audit provider was selected."
      });
    }

    if (!request.lead.identity.websiteUrl) {
      return fail({
        code: "website_audit.missing_website",
        message: "Cannot audit a lead without a website URL."
      });
    }

    const result = await this.providers.require(providerId).audit(request);

    if (result.ok) {
      await this.events?.publish({
        id: crypto.randomUUID(),
        type: "website_audit.completed",
        occurredAt: new Date(),
        payload: {
          leadId: result.value.leadId,
          findingCount: result.value.findings.length,
          traceId: request.traceId
        }
      });
    }

    return result;
  }
}
