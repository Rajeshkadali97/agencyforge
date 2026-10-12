import type { Provider } from "../interfaces/index.js";
import type { Result } from "../shared/index.js";
import type { CrmSyncRequest, CrmSyncResult } from "./types.js";

export interface CrmProvider extends Provider {
  sync(request: CrmSyncRequest): Promise<Result<CrmSyncResult>>;
}

export interface CrmSyncService {
  sync(request: CrmSyncRequest): Promise<Result<CrmSyncResult>>;
}
