import type { ContinuousLeadScanPlan, LeadScanCadence } from "./types.js";

export const MINIMUM_CORE_SCAN_INTERVAL_SECONDS = 60;

export function normalizeScanCadence(requestedIntervalSeconds: number): LeadScanCadence {
  if (requestedIntervalSeconds < MINIMUM_CORE_SCAN_INTERVAL_SECONDS) {
    return {
      requestedIntervalSeconds,
      effectiveIntervalSeconds: MINIMUM_CORE_SCAN_INTERVAL_SECONDS,
      reason: "Core protects providers and platforms from one-second polling; lower intervals require a reviewed streaming/webhook adapter."
    };
  }

  return {
    requestedIntervalSeconds,
    effectiveIntervalSeconds: requestedIntervalSeconds,
    reason: "Requested interval accepted."
  };
}

export function validateLeadScanPlan(plan: ContinuousLeadScanPlan): readonly string[] {
  const blockers: string[] = [];

  if (plan.sources.length === 0) {
    blockers.push("At least one lead source must be enabled.");
  }

  for (const source of plan.sources) {
    if (!source.enabled) {
      continue;
    }

    if (source.requiresTermsReview && source.allowedUse === "approved_scraper") {
      blockers.push(`${source.sourceId} requires terms review before scraper execution.`);
    }

    if (source.minScanIntervalSeconds < MINIMUM_CORE_SCAN_INTERVAL_SECONDS) {
      blockers.push(`${source.sourceId} scan interval is below the core minimum.`);
    }
  }

  if (plan.deliveryPolicy.sendProposalOnMatch && !plan.deliveryPolicy.requireHumanApproval) {
    blockers.push("Automatic proposal delivery requires an explicit approved provider policy before human approval can be disabled.");
  }

  if (plan.deliveryPolicy.followUpAfterDays < 1) {
    blockers.push("Follow-up delay must be at least one day.");
  }

  return blockers;
}
