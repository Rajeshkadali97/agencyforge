import type { Entity, Traceable } from "../shared/entity.js";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "INR" | "AUD" | "CAD" | string;

export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export interface BusinessIdentity {
  readonly legalName?: string;
  readonly displayName: string;
  readonly domain?: string;
  readonly websiteUrl?: string;
  readonly location?: BusinessLocation;
  readonly industry?: string;
}

export interface BusinessLocation {
  readonly country?: string;
  readonly region?: string;
  readonly city?: string;
  readonly postalCode?: string;
}

export interface BusinessLead extends Entity, Traceable {
  readonly identity: BusinessIdentity;
  readonly signals: readonly LeadSignal[];
  readonly contacts: readonly LeadContact[];
  readonly consent?: ConsentState;
}

export interface LeadContact {
  readonly id: string;
  readonly name?: string;
  readonly role?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly profileUrl?: string;
  readonly sourceRefs: readonly string[];
}

export interface LeadSignal {
  readonly key: string;
  readonly label: string;
  readonly value: string | number | boolean;
  readonly confidence: number;
}

export interface ConsentState {
  readonly lawfulBasis?: "consent" | "contract" | "legitimate_interest" | "public_task" | "legal_obligation";
  readonly canEmail: boolean;
  readonly canCall: boolean;
  readonly canMessageSocial: boolean;
  readonly notes?: string;
}
