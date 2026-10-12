import type { Provider } from "../interfaces/index.js";
import type { Result } from "../shared/index.js";
import type { WebsiteAuditReport, WebsiteAuditRequest } from "./types.js";

export interface WebsiteAuditProvider extends Provider {
  audit(request: WebsiteAuditRequest): Promise<Result<WebsiteAuditReport>>;
}

export interface WebsiteAuditService {
  audit(request: WebsiteAuditRequest): Promise<Result<WebsiteAuditReport>>;
}
