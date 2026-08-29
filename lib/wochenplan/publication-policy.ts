/**
 * lib/wochenplan/publication-policy.ts
 *
 * WOCHENPLAN-2.0-01C — publication eligibility for the public current-week
 * Wochenplan feed backed by canonical Weekplanner data.
 *
 * Reuses shared HOME-match location semantics from
 * lib/publishing/policy/publication-policy.ts (evaluateHomeMatchLocation) —
 * the same rule Infoboard applies for facility-relevant home matches.
 *
 * Pure functions only — no Prisma, no I/O.
 */

import {
  evaluateHomeMatchLocation,
  type PublicationDecision,
  type PublicationPolicyEvent,
} from "@/lib/publishing/policy/publication-policy";

const PUBLISHABLE_STATUSES = new Set([
  "SCHEDULED",
  "LIVE",
  "COMPLETED",
  "POSTPONED",
]);

const TRAINING_EXCLUDED_STATUSES = new Set(["CANCELLED", "CANCELED"]);

export function evaluateWochenplanTrainingPublication(
  tenantId: string,
  sessionTenantId: string,
  status: string,
): PublicationDecision {
  if (sessionTenantId !== tenantId) {
    return { eligible: false, reason: "TENANT_MISMATCH" };
  }

  const normalized = status.trim().toUpperCase();
  if (TRAINING_EXCLUDED_STATUSES.has(normalized)) {
    return { eligible: false, reason: "STATUS_NOT_PUBLISHABLE" };
  }

  if (!PUBLISHABLE_STATUSES.has(normalized) && normalized !== "MOVED") {
    return { eligible: false, reason: "STATUS_NOT_PUBLISHABLE" };
  }

  return { eligible: true, reason: "ELIGIBLE" };
}

export function evaluateWochenplanMatchPublication(
  event: PublicationPolicyEvent,
  tenantId: string,
): PublicationDecision {
  if (event.tenantId !== tenantId) {
    return { eligible: false, reason: "TENANT_MISMATCH" };
  }

  if (!PUBLISHABLE_STATUSES.has(event.status)) {
    return { eligible: false, reason: "STATUS_NOT_PUBLISHABLE" };
  }

  if (event.type !== "MATCH") {
    return { eligible: false, reason: "TYPE_MISMATCH" };
  }

  if (!event.websiteVisible) {
    return { eligible: false, reason: "WEBSITE_HIDDEN" };
  }

  return evaluateHomeMatchLocation(event.homeAway);
}

export function evaluateWochenplanTournamentPublication(
  event: PublicationPolicyEvent,
  tenantId: string,
): PublicationDecision {
  if (event.tenantId !== tenantId) {
    return { eligible: false, reason: "TENANT_MISMATCH" };
  }

  if (!PUBLISHABLE_STATUSES.has(event.status)) {
    return { eligible: false, reason: "STATUS_NOT_PUBLISHABLE" };
  }

  if (event.type !== "TOURNAMENT") {
    return { eligible: false, reason: "TYPE_MISMATCH" };
  }

  if (!event.websiteVisible) {
    return { eligible: false, reason: "WEBSITE_HIDDEN" };
  }

  // Weekplanner already filters to HOME tournaments; homeAway on the Event
  // row is the canonical hosting signal (null/unset => HOME per tournament-service).
  const hosting = evaluateHomeMatchLocation(event.homeAway);
  if (!hosting.eligible) {
    return hosting;
  }

  return { eligible: true, reason: "ELIGIBLE" };
}
