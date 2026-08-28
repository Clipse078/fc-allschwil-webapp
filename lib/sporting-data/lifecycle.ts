/**
 * lib/sporting-data/lifecycle.ts
 *
 * TEAM-SFV-02B — canonical sporting-match lifecycle classifier.
 *
 * Combines provider state, SCE Event.status, kickoff time, and score hints
 * into one deterministic lifecycle. Does not mutate the database.
 */

import { classifyProviderMatchDisposition } from "./provider-state";

export type SportingMatchLifecycle =
  | "UPCOMING"
  | "LIVE"
  | "COMPLETED"
  | "POSTPONED"
  | "CANCELLED"
  | "NEEDS_RECONCILIATION";

export type SportingReconciliationIssue =
  | "PAST_FIXTURE_PROVIDER_NOT_PLAYED"
  | "PROVIDER_COMPLETED_EVENT_NOT_COMPLETED"
  | "PROVIDER_LIVE_EVENT_NOT_LIVE";

export type SportingLifecycleInput = {
  status: string;
  startAt: Date;
  providerMatchStateName?: string | null;
  now?: Date;
};

export type SportingLifecycleClassification = {
  lifecycle: SportingMatchLifecycle;
  reconciliationIssue: SportingReconciliationIssue | null;
};

function normalizedStatus(status: string): string {
  return status.trim().toUpperCase();
}

function isPastKickoff(startAt: Date, now: Date): boolean {
  return startAt.getTime() < now.getTime();
}

function isEventCancelled(status: string): boolean {
  return status === "CANCELLED" || status === "CANCELED";
}

function isEventPostponed(status: string): boolean {
  return status === "POSTPONED";
}

function isEventLive(status: string): boolean {
  return status === "LIVE";
}

function isEventCompleted(status: string): boolean {
  return status === "COMPLETED";
}

/**
 * Canonical sporting lifecycle for one match.
 *
 * Meaningful provider disposition takes precedence over Event.status. An
 * UNKNOWN disposition falls back to Event.status so manual matches and genuine
 * persisted completions remain authoritative when provider evidence is absent.
 */
export function classifySportingMatchLifecycle(
  input: SportingLifecycleInput,
): SportingLifecycleClassification {
  const status = normalizedStatus(input.status);
  const now = input.now ?? new Date();
  const providerDisposition = classifyProviderMatchDisposition(
    input.providerMatchStateName,
  );
  const past = isPastKickoff(input.startAt, now);

  if (providerDisposition === "CANCELLED") {
    return { lifecycle: "CANCELLED", reconciliationIssue: null };
  }

  if (providerDisposition === "POSTPONED") {
    return { lifecycle: "POSTPONED", reconciliationIssue: null };
  }

  if (providerDisposition === "LIVE") {
    const reconciliationIssue =
      !isEventLive(status)
        ? "PROVIDER_LIVE_EVENT_NOT_LIVE"
        : null;
    return { lifecycle: "LIVE", reconciliationIssue };
  }

  if (providerDisposition === "COMPLETED") {
    const reconciliationIssue =
      !isEventCompleted(status)
        ? "PROVIDER_COMPLETED_EVENT_NOT_COMPLETED"
        : null;
    return { lifecycle: "COMPLETED", reconciliationIssue };
  }

  if (providerDisposition === "NOT_PLAYED") {
    if (!past) {
      return { lifecycle: "UPCOMING", reconciliationIssue: null };
    }

    return {
      lifecycle: "NEEDS_RECONCILIATION",
      reconciliationIssue: "PAST_FIXTURE_PROVIDER_NOT_PLAYED",
    };
  }

  if (isEventCancelled(status)) {
    return { lifecycle: "CANCELLED", reconciliationIssue: null };
  }

  if (isEventPostponed(status)) {
    return { lifecycle: "POSTPONED", reconciliationIssue: null };
  }

  if (isEventLive(status)) {
    return { lifecycle: "LIVE", reconciliationIssue: null };
  }

  if (isEventCompleted(status)) {
    return { lifecycle: "COMPLETED", reconciliationIssue: null };
  }

  if (past) {
    return {
      lifecycle: "NEEDS_RECONCILIATION",
      reconciliationIssue: "PAST_FIXTURE_PROVIDER_NOT_PLAYED",
    };
  }

  return { lifecycle: "UPCOMING", reconciliationIssue: null };
}

export function isSportingMatchCompleted(lifecycle: SportingMatchLifecycle): boolean {
  return lifecycle === "COMPLETED";
}

export function isSportingMatchUpcoming(lifecycle: SportingMatchLifecycle): boolean {
  return lifecycle === "UPCOMING";
}

export function isSportingMatchLive(lifecycle: SportingMatchLifecycle): boolean {
  return lifecycle === "LIVE";
}

export function isSportingMatchCancelled(lifecycle: SportingMatchLifecycle): boolean {
  return lifecycle === "CANCELLED";
}

export function isSportingMatchPostponed(lifecycle: SportingMatchLifecycle): boolean {
  return lifecycle === "POSTPONED";
}

export function isSportingMatchNeedsReconciliation(
  lifecycle: SportingMatchLifecycle,
): boolean {
  return lifecycle === "NEEDS_RECONCILIATION";
}

export type SportingUpcomingListOptions = {
  /**
   * When true, POSTPONED fixtures with a future effective kickoff may appear
   * in Spielplanung. Past postponed fixtures are always excluded.
   */
  includePostponed?: boolean;
  /** Effective scheduled kickoff — required when includePostponed is true. */
  startAt?: Date;
  now?: Date;
};

/**
 * Spielplanung bucket — operational upcoming fixtures.
 *
 * Includes UPCOMING and LIVE. POSTPONED is included only when the effective
 * kickoff is still in the future (rescheduled/postponed-to-future continuity).
 * Past postponed fixtures must not remain in normal Spielplanung.
 */
export function isSportingMatchInUpcomingList(
  lifecycle: SportingMatchLifecycle,
  options: SportingUpcomingListOptions = {},
): boolean {
  if (lifecycle === "UPCOMING" || lifecycle === "LIVE") {
    return true;
  }

  if (options.includePostponed && lifecycle === "POSTPONED") {
    if (!options.startAt || !options.now) {
      return false;
    }
    return !isPastKickoff(options.startAt, options.now);
  }

  return false;
}

/** True when kickoff is strictly before the reference instant. */
export function isSportingMatchPastKickoff(
  startAt: Date,
  now: Date = new Date(),
): boolean {
  return isPastKickoff(startAt, now);
}

/** Resultate bucket — only definitively completed matches. */
export function isSportingMatchInResultsList(
  lifecycle: SportingMatchLifecycle,
): boolean {
  return lifecycle === "COMPLETED";
}
