import type { DomainEventPublisher } from "../interfaces/index.js";
import { ProviderRegistry, fail, type Result } from "../shared/index.js";
import type { ProposalGenerationProvider, ProposalGeneratorService } from "./interfaces.js";
import type { ProposalGenerationRequest, ProposalPackage } from "./types.js";

export class ProviderBasedProposalGeneratorService implements ProposalGeneratorService {
  constructor(
    private readonly providers: ProviderRegistry<ProposalGenerationProvider>,
    private readonly defaultProviderId?: string,
    private readonly events?: DomainEventPublisher
  ) {}

  async generate(request: ProposalGenerationRequest): Promise<Result<ProposalPackage>> {
    const providerId = request.providerId ?? this.defaultProviderId;

    if (!providerId) {
      return fail({
        code: "proposal_generator.no_provider",
        message: "No proposal generation provider was selected."
      });
    }

    const result = await this.providers.require(providerId).generate(request);

    if (result.ok) {
      await this.events?.publish({
        id: crypto.randomUUID(),
        type: "proposal_generator.completed",
        occurredAt: new Date(),
        payload: {
          leadId: result.value.leadId,
          traceId: request.traceId
        }
      });
    }

    return result;
  }
}
