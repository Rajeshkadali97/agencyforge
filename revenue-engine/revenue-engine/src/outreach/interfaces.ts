import type { Provider } from "../interfaces/index.js";
import type { Result } from "../shared/index.js";
import type {
  OutreachDeliveryRequest,
  OutreachDeliveryResult,
  OutreachPlanRequest,
  OutreachSequence,
  OutreachTrackingRequest,
  OutreachTrackingResult
} from "./types.js";

export interface OutreachPlanningProvider extends Provider {
  plan(request: OutreachPlanRequest): Promise<Result<OutreachSequence>>;
}

export interface OutreachDeliveryProvider extends Provider {
  deliver(request: OutreachDeliveryRequest): Promise<Result<OutreachDeliveryResult>>;
}

export interface OutreachTrackingProvider extends Provider {
  track(request: OutreachTrackingRequest): Promise<Result<OutreachTrackingResult>>;
}

export interface OutreachService {
  plan(request: OutreachPlanRequest): Promise<Result<OutreachSequence>>;
  deliver(request: OutreachDeliveryRequest): Promise<Result<OutreachDeliveryResult>>;
}
