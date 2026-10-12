import type { Provider } from "../interfaces/index.js";
import type { Result } from "../shared/index.js";
import type {
  ContinuousLeadScanPlan,
  ExtractedLeadProfile,
  LeadNeedsAnalysis,
  LeadPipelineRunRequest,
  LeadPipelineRunResult,
  LeadSourceId,
  OfferPitchStrategy
} from "./types.js";

export interface LeadExtractionProvider extends Provider {
  readonly sourceId: LeadSourceId;
  extract(plan: ContinuousLeadScanPlan): Promise<Result<readonly ExtractedLeadProfile[]>>;
}

export interface NeedsAnalysisProvider extends Provider {
  analyze(profile: ExtractedLeadProfile): Promise<Result<LeadNeedsAnalysis>>;
}

export interface OfferPitchProvider extends Provider {
  createPitch(profile: ExtractedLeadProfile, needs: LeadNeedsAnalysis): Promise<Result<OfferPitchStrategy>>;
}

export interface FollowUpSchedulerProvider extends Provider {
  scheduleFollowUp(leadId: string, afterDays: number, traceId?: string): Promise<Result<void>>;
}

export interface LeadPipelineService {
  run(request: LeadPipelineRunRequest): Promise<Result<LeadPipelineRunResult>>;
}
