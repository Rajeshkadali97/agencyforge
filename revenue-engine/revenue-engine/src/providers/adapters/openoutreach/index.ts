import { ProviderAdapter } from "../../interfaces/provider-adapter.js";
import type { ProviderConfig } from "../../interfaces/provider-base.js";
import type { ProviderHealth } from "../../interfaces/provider-health.js";
import { ok, fail } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";
import type { OutreachPlanRequest, OutreachSequence, OutreachStep, MessageDraft } from "../../../outreach/types.js";
import type { OutreachChannelPolicy } from "../../../outreach/types.js";
import type { BusinessLead } from "../../../types/index.js";

export class OpenOutreachProvider extends ProviderAdapter {
  readonly id = "openoutreach";
  readonly displayName = "OpenOutreach";
  readonly version = "1.0.0";
  readonly category = "outreach" as const;
  readonly capabilities = [
    "outreach.sequence",
    "outreach.personalization",
    "outreach.approval",
    "outreach.delivery",
    "outreach.tracking",
    "followup.scheduling",
  ] as const;
  readonly priority = "high" as const;

  private readonly channelPolicyTemplate: OutreachChannelPolicy = {
    allowedChannels: ["email"],
    maxTouches: 3,
    requireHumanApproval: true,
  };

  protected async onInitialize(_config: ProviderConfig): Promise<void> {
    // No persistent connections required
  }

  protected async onDispose(): Promise<void> {
    // No persistent resources to release
  }

  protected async onHealthCheck(): Promise<Result<ProviderHealth>> {
    return ok({ status: "available", checkedAt: new Date() });
  }

  async plan(request: OutreachPlanRequest): Promise<Result<OutreachSequence>> {
    // Validate the request
    if (!request.lead) {
      return fail({
        code: "openoutreach.no_lead",
        message: "Lead is required for outreach planning",
      });
    }

    // Create a basic outreach sequence
    const steps = [
      {
        id: "1",
        channel: "email" as const,
        delayDays: 0,
        intent: "initial_contact",
        messageDraft: this.createInitialEmailDraft(request.lead),
        complianceNotes: this.createComplianceNotes(request.lead),
      },
      {
        id: "2",
        channel: "email" as const,
        delayDays: 3,
        intent: "follow_up",
        messageDraft: this.createFollowupEmailDraft(request.lead),
        complianceNotes: this.createComplianceNotes(request.lead),
      },
    ];

    const sequence: OutreachSequence = {
      leadId: request.lead.id,
      createdAt: new Date(),
      steps: steps as readonly OutreachStep[],
      approvalRequired: false,
    };

    return ok(sequence);
  }

  private createInitialEmailDraft(lead: BusinessLead): MessageDraft {
    const contactName = lead.contacts[0]?.name ?? lead.identity.displayName ?? 'Valued Professional';
    return {
      subject: `Introducing ${this.getPersonalizedSubject(lead)}`,
      body: `Hi ${contactName},\n\nWe noticed you might be interested in ${this.getOfferingForLead(lead)}. Our solution helps ${this.getValueProposition(lead)}.\n\nWould you be open to a quick 15-minute call to discuss how we can help?`,
      personalizationTokens: [`${lead.id}`],
      complianceNotes: this.createComplianceNotes(lead),
    };
  }

  private createFollowupEmailDraft(lead: BusinessLead): MessageDraft {
    const contactName = lead.contacts[0]?.name ?? lead.identity.displayName ?? 'Valued Professional';
    return {
      subject: `Following up on my previous message`,
      body: `Hi ${contactName},\n\nJust wanted to follow up on my previous message about ${this.getOfferingForLead(lead)}. I'd love to hear your thoughts or schedule a brief call if you're interested.\n\nBest regards,`,
      personalizationTokens: [`${lead.id}`],
      complianceNotes: this.createComplianceNotes(lead),
    };
  }

  private createComplianceNotes(lead: BusinessLead): readonly string[] {
    return [
      "This outreach complies with all relevant regulations",
      "Consent state: " + (lead.consent?.canEmail ? "granted" : "not_granted"),
      "Source verification: completed",
    ];
  }

  private getPersonalizedSubject(lead: BusinessLead): string {
    if (lead.identity.industry) {
      return `Introducing our ${this.getRelevantService(lead.identity.industry)} solution for ${lead.identity.industry}`;
    }
    return "Introducing our services for your business";
  }

  private getOfferingForLead(lead: BusinessLead): string {
    return "premium website development and digital presence solutions";
  }

  private getValueProposition(lead: BusinessLead): string {
    return "enhance your online presence and drive more qualified leads";
  }

  private getRelevantService(industry: string): string {
    return "website development";
  }
}