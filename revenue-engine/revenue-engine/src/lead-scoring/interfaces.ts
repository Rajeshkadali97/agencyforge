import type { Provider } from "../interfaces/index.js";
import type { Result } from "../shared/index.js";
import type { LeadScore, LeadScoringRequest } from "./types.js";

export interface LeadScoringProvider extends Provider {
  score(request: LeadScoringRequest): Promise<Result<LeadScore>>;
}

export interface LeadScoringService {
  score(request: LeadScoringRequest): Promise<Result<LeadScore>>;
}
