import type { Entity } from "../shared/entity.js";
import type { Money } from "./common.js";

export interface CrmContact extends Entity {
  readonly leadId: string;
  readonly externalId?: string;
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly role?: string;
}

export interface CrmDeal extends Entity {
  readonly leadId: string;
  readonly externalId?: string;
  readonly stage: CrmDealStage;
  readonly expectedValue?: Money;
  readonly ownerId?: string;
}

export type CrmDealStage =
  | "new"
  | "qualified"
  | "audit_ready"
  | "proposal_ready"
  | "contacted"
  | "meeting_booked"
  | "won"
  | "lost";

export interface CrmActivity extends Entity {
  readonly leadId: string;
  readonly externalId?: string;
  readonly type: "note" | "email" | "call" | "meeting" | "task" | "status_change";
  readonly occurredAt: Date;
  readonly summary: string;
}
