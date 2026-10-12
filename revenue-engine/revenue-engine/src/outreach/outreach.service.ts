import type { DomainEventPublisher } from "../interfaces/index.js";
import { ProviderRegistry, fail, type Result } from "../shared/index.js";
import type { OutreachDeliveryProvider, OutreachPlanningProvider, OutreachService } from "./interfaces.js";
import type {
  OutreachDeliveryRequest,
  OutreachDeliveryResult,
  OutreachPlanRequest,
  OutreachSequence
} from "./types.js";

export class ProviderBasedOutreachService implements OutreachService {
  constructor(
    private readonly planners: ProviderRegistry<OutreachPlanningProvider>,
    private readonly deliveryProviders: ProviderRegistry<OutreachDeliveryProvider>,
    private readonly defaultPlannerId?: string,
    private readonly defaultDeliveryProviderId?: string,
    private readonly events?: DomainEventPublisher
  ) {}

  async plan(request: OutreachPlanRequest): Promise<Result<OutreachSequence>> {
    const providerId = request.providerId ?? this.defaultPlannerId;

    if (!providerId) {
      return fail({
        code: "outreach.no_planner",
        message: "No outreach planning provider was selected."
      });
    }

    const result = await this.planners.require(providerId).plan(request);

    if (result.ok) {
      await this.events?.publish({
        id: crypto.randomUUID(),
        type: "outreach.sequence_planned",
        occurredAt: new Date(),
        payload: {
          leadId: result.value.leadId,
          stepCount: result.value.steps.length,
          traceId: request.traceId
        }
      });
    }

    return result;
  }

  async deliver(request: OutreachDeliveryRequest): Promise<Result<OutreachDeliveryResult>> {
    if (request.sequence.approvalRequired && !request.approvedBy) {
      return fail({
        code: "outreach.approval_required",
        message: "This outreach sequence requires human approval before delivery."
      });
    }

    const providerId = request.providerId ?? this.defaultDeliveryProviderId;

    if (!providerId) {
      return fail({
        code: "outreach.no_delivery_provider",
        message: "No outreach delivery provider was selected."
      });
    }

    const result = await this.deliveryProviders.require(providerId).deliver(request);

    if (result.ok) {
      await this.events?.publish({
        id: crypto.randomUUID(),
        type: "outreach.delivery_queued",
        occurredAt: new Date(),
        payload: {
          leadId: result.value.leadId,
          deliveryRefCount: result.value.deliveryRefs.length,
          traceId: request.traceId
        }
      });
    }

    return result;
  }
}
