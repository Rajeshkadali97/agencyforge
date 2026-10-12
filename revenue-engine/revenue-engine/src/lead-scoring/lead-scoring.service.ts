import type { DomainEventPublisher } from "../interfaces/index.js";
import { ProviderRegistry, fail, type Result } from "../shared/index.js";
import type { LeadScoringProvider, LeadScoringService } from "./interfaces.js";
import type { LeadScore, LeadScoringRequest } from "./types.js";

export class ProviderBasedLeadScoringService implements LeadScoringService {
  constructor(
    private readonly providers: ProviderRegistry<LeadScoringProvider>,
    private readonly defaultProviderId?: string,
    private readonly events?: DomainEventPublisher
  ) {}

  async score(request: LeadScoringRequest): Promise<Result<LeadScore>> {
    const providerId = request.modelId ?? this.defaultProviderId;

    if (!providerId) {
      return fail({
        code: "lead_scoring.no_provider",
        message: "No lead scoring provider was selected."
      });
    }

    const result = await this.providers.require(providerId).score(request);

    if (result.ok) {
      await this.events?.publish({
        id: crypto.randomUUID(),
        type: "lead_scoring.completed",
        occurredAt: new Date(),
        payload: {
          leadId: result.value.leadId,
          grade: result.value.grade,
          score: result.value.score,
          traceId: request.traceId
        }
      });
    }

    return result;
  }
}
