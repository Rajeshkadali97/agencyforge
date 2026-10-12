import type { Result } from "../shared/index.js";
import type { Provider } from "../interfaces/index.js";
import type { BusinessDiscoveryBatch, BusinessDiscoveryCriteria } from "./types.js";

export interface BusinessDiscoveryProvider extends Provider {
  discover(criteria: BusinessDiscoveryCriteria): Promise<Result<BusinessDiscoveryBatch>>;
}

export interface BusinessDiscoveryService {
  discover(request: import("./types.js").BusinessDiscoveryRequest): Promise<Result<BusinessDiscoveryBatch>>;
}
