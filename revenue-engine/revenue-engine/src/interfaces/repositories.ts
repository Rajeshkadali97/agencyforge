import type { BusinessLead, CrmActivity, CrmContact, CrmDeal } from "../types/index.js";

export interface LeadRepository {
  save(lead: BusinessLead): Promise<void>;
  findById(id: string): Promise<BusinessLead | undefined>;
}

export interface CrmRepository {
  saveContact(contact: CrmContact): Promise<void>;
  saveDeal(deal: CrmDeal): Promise<void>;
  saveActivity(activity: CrmActivity): Promise<void>;
}
