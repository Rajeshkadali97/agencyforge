import type { CrmSyncService } from "../crm/index.js";
import type { DomainEventPublisher } from "../interfaces/index.js";
import type { LeadScoringService } from "../lead-scoring/index.js";
import type { OutreachService } from "../outreach/index.js";
import type { ProposalGeneratorService } from "../proposal-generator/index.js";
import { ProviderRegistry, fail, ok, type Result } from "../shared/index.js";
import type {
  FollowUpSchedulerProvider,
  LeadExtractionProvider,
  LeadPipelineService,
  NeedsAnalysisProvider,
  OfferPitchProvider
} from "./interfaces.js";
import type {
  ExtractedLeadProfile,
  LeadPipelineRunRequest,
  LeadPipelineRunResult,
  ProcessedLeadOutcome
} from "./types.js";
import { validateLeadScanPlan } from "./lead-pipeline-policy.js";

export interface LeadPipelineDependencies {
  readonly extractors: ProviderRegistry<LeadExtractionProvider>;
  readonly needsAnalyzers: ProviderRegistry<NeedsAnalysisProvider>;
  readonly pitchProviders: ProviderRegistry<OfferPitchProvider>;
  readonly followUpSchedulers: ProviderRegistry<FollowUpSchedulerProvider>;
  readonly leadScoring: LeadScoringService;
  readonly proposalGenerator: ProposalGeneratorService;
  readonly outreach: OutreachService;
  readonly crm?: CrmSyncService;
  readonly defaultNeedsAnalyzerId: string;
  readonly defaultPitchProviderId: string;
  readonly defaultFollowUpSchedulerId?: string;
  readonly events?: DomainEventPublisher;
}

export class ProviderBasedLeadPipelineService implements LeadPipelineService {
  constructor(private readonly dependencies: LeadPipelineDependencies) {}

  async run(request: LeadPipelineRunRequest): Promise<Result<LeadPipelineRunResult>> {
    const planBlockers = validateLeadScanPlan(request.plan);

    if (planBlockers.length > 0) {
      return fail({
        code: "lead_pipeline.plan_blocked",
        message: planBlockers.join(" ")
      });
    }

    const extractedProfiles = await this.extractProfiles(request);
    if (!extractedProfiles.ok) {
      return extractedProfiles;
    }

    const processed: ProcessedLeadOutcome[] = [];
    const limitedProfiles = extractedProfiles.value.slice(0, request.plan.deliveryPolicy.maxNewLeadsPerRun);

    for (const profile of limitedProfiles) {
      processed.push(await this.processProfile(profile, request));
    }

    const result: LeadPipelineRunResult = {
      runId: crypto.randomUUID(),
      scannedAt: new Date(),
      discoveredCount: extractedProfiles.value.length,
      matchedCount: processed.length,
      processed
    };

    await this.dependencies.events?.publish({
      id: crypto.randomUUID(),
      type: "lead_pipeline.run_completed",
      occurredAt: new Date(),
      payload: {
        runId: result.runId,
        discoveredCount: result.discoveredCount,
        matchedCount: result.matchedCount,
        traceId: request.traceId
      }
    });

    return ok(result);
  }

  private async extractProfiles(request: LeadPipelineRunRequest): Promise<Result<readonly ExtractedLeadProfile[]>> {
    const profiles: ExtractedLeadProfile[] = [];

    for (const source of request.plan.sources.filter((candidate) => candidate.enabled)) {
      const extractor = this.dependencies.extractors.list().find((provider) => provider.sourceId === source.sourceId);

      if (!extractor) {
        return fail({
          code: "lead_pipeline.extractor_missing",
          message: `No lead extraction provider registered for source: ${source.sourceId}`
        });
      }

      const result = await extractor.extract(request.plan);
      if (!result.ok) {
        return result;
      }

      profiles.push(...result.value);
    }

    return ok(profiles);
  }

  private async processProfile(
    profile: ExtractedLeadProfile,
    request: LeadPipelineRunRequest
  ): Promise<ProcessedLeadOutcome> {
    const blockers: string[] = [];
    const score = await this.dependencies.leadScoring.score({
      lead: profile.lead,
      ...(request.traceId ? { traceId: request.traceId } : {})
    });

    if (!score.ok || score.value.score < request.plan.matchingRules.minimumScore) {
      return {
        leadId: profile.lead.id,
        sourceId: profile.sourceId,
        ...(score.ok ? { score: score.value } : {}),
        status: "blocked",
        blockers: [score.ok ? "Lead score is below the minimum threshold." : score.error.message]
      };
    }

    const needs = await this.dependencies.needsAnalyzers
      .require(this.dependencies.defaultNeedsAnalyzerId)
      .analyze(profile);

    if (!needs.ok) {
      blockers.push(needs.error.message);
    }

    const pitch =
      needs.ok
        ? await this.dependencies.pitchProviders
            .require(this.dependencies.defaultPitchProviderId)
            .createPitch(profile, needs.value)
        : undefined;

    if (pitch && !pitch.ok) {
      blockers.push(pitch.error.message);
    }

    const proposal =
      needs.ok && pitch?.ok
        ? await this.dependencies.proposalGenerator.generate({
            lead: profile.lead,
            score: score.value,
            ...(request.traceId ? { traceId: request.traceId } : {})
          })
        : undefined;

    if (proposal && !proposal.ok) {
      blockers.push(proposal.error.message);
    }

    const sequence =
      proposal?.ok
        ? await this.dependencies.outreach.plan({
            lead: profile.lead,
            score: score.value,
            proposal: proposal.value,
            channelPolicy: {
              allowedChannels: ["email"],
              maxTouches: request.plan.deliveryPolicy.maxMessagesPerLead,
              requireHumanApproval: request.plan.deliveryPolicy.requireHumanApproval
            },
            ...(request.traceId ? { traceId: request.traceId } : {})
          })
        : undefined;

    if (sequence && !sequence.ok) {
      blockers.push(sequence.error.message);
    }

    const delivery =
      sequence?.ok && request.plan.deliveryPolicy.sendProposalOnMatch
        ? await this.dependencies.outreach.deliver({
            sequence: sequence.value,
            ...(request.traceId ? { traceId: request.traceId } : {})
          })
        : undefined;

    if (delivery && !delivery.ok) {
      blockers.push(delivery.error.message);
    }

    if (delivery?.ok && this.dependencies.defaultFollowUpSchedulerId) {
      await this.dependencies.followUpSchedulers
        .require(this.dependencies.defaultFollowUpSchedulerId)
        .scheduleFollowUp(profile.lead.id, request.plan.deliveryPolicy.followUpAfterDays, request.traceId);
    }

    const outcome: ProcessedLeadOutcome = {
      leadId: profile.lead.id,
      sourceId: profile.sourceId,
      score: score.value,
      ...(needs.ok ? { needs: needs.value } : {}),
      ...(pitch?.ok ? { pitch: pitch.value } : {}),
      ...(proposal?.ok ? { proposal: proposal.value } : {}),
      ...(sequence?.ok ? { outreachSequence: sequence.value } : {}),
      ...(delivery?.ok ? { delivery: delivery.value } : {}),
      status: blockers.length > 0 ? "needs_review" : delivery?.ok ? "sent" : proposal?.ok ? "proposal_ready" : "matched",
      blockers
    };

    return outcome;
  }
}
