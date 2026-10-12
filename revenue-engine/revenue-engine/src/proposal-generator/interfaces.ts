import type { Provider } from "../interfaces/index.js";
import type { Result } from "../shared/index.js";
import type { ProposalGenerationRequest, ProposalPackage } from "./types.js";

export interface ProposalGenerationProvider extends Provider {
  generate(request: ProposalGenerationRequest): Promise<Result<ProposalPackage>>;
}

export interface ProposalGeneratorService {
  generate(request: ProposalGenerationRequest): Promise<Result<ProposalPackage>>;
}
