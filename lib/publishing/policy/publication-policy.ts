/**
 * lib/publishing/policy/publication-policy.ts
 *
 * Channel publication policy for the SportClubEvo Publishing Platform.
 *
 * Pure functions only — no Prisma, no I/O, no framework imports.
 *
 * Six explicit publication channels.
 * Ten explicit decision reasons.
 * Evaluation order: tenant → status → type → visibility → channel-specific → eligible.
 *
 * Infoboard Screen 1 and Screen 2 share the same policy evaluation.
 */

import type { PublishingEventStatus, PublishingEventType } from "../event-types";

// ── Publication channels ───────────────────────────────────────────────────────

export const PublicationChannel = {
  INFOBOARD_SCREEN_1: "INFOBOARD_SCREEN_1",
  INFOBOARD_SCREEN_2: "INFOBOARD_SCREEN_2",
  WEBSITE_MATCHES: "WEBSITE_MATCHES",
  WEBSITE_TRAININGSPLAN: "WEBSITE_TRAININGSPLAN",
  WEBSITE_TOURNAMENTS: "WEBSITE_TOURNAMENTS",
  WEBSITE_CLUB_EVENTS: "WEBSITE_CLUB_EVENTS",
} as const;

export type PublicationChannel =
  (typeof PublicationChannel)[keyof typeof PublicationChannel];

// ── Decision reasons ───────────────────────────────────────────────────────────

export const DecisionReason = {
  /** Tenant step: the tenant is not active. */
  TENANT_INACTIVE: "TENANT_INACTIVE",
  /** Status step: the event is a draft. */
  STATUS_DRAFT: "STATUS_DRAFT",
  /** Status step: the event has been cancelled. */
  STATUS_CANCELLED: "STATUS_CANCELLED",
  /** Status step: the event has been archived. */
  STATUS_ARCHIVED: "STATUS_ARCHIVED",
  /** Type step: the event type is not supported by this channel. */
  TYPE_NOT_SUPPORTED: "TYPE_NOT_SUPPORTED",
  /** Visibility step: the event's general visibility flag is off (infoboard channels). */
  NOT_VISIBLE: "NOT_VISIBLE",
  /** Channel-specific (infoboard): a match must be HOME to appear on the infoboard. */
  INFOBOARD_MATCH_NOT_HOME: "INFOBOARD_MATCH_NOT_HOME",
  /** Visibility / channel-specific (website channels): websiteVisible flag is not set. */
  WEBSITE_VISIBILITY_REQUIRED: "WEBSITE_VISIBILITY_REQUIRED",
  /** Channel-specific (website trainingsplan): trainingsplanVisible flag is not set. */
  TRAININGSPLAN_VISIBILITY_REQUIRED: "TRAININGSPLAN_VISIBILITY_REQUIRED",
  /** All checks passed — the event is eligible for this channel. */
  ELIGIBLE: "ELIGIBLE",
} as const;

export type DecisionReason =
  (typeof DecisionReason)[keyof typeof DecisionReason];

// ── Event input type ───────────────────────────────────────────────────────────

/**
 * Minimum event shape required for publication policy evaluation.
 *
 * Intentionally decoupled from Prisma models. Callers map their domain
 * objects to this shape before calling `evaluateForChannel`.
 */
export type PolicyEvent = {
  /** Whether the tenant that owns this event is currently active. */
  tenantActive: boolean;
  /** Current lifecycle status of the event. */
  status: PublishingEventStatus;
  /** Categorisation of the event. */
  type: PublishingEventType;
  /**
   * Match location — relevant only for MATCH events.
   * Must be null for non-match event types.
   */
  matchLocation: "HOME" | "AWAY" | "NEUTRAL" | null;
  /**
   * General event visibility toggle.
   * Governs infoboard channels: when false the event is hidden from all
   * infoboard screens regardless of other flags.
   */
  isVisible: boolean;
  /**
   * Website publication flag.
   * Required for all website channels.
   */
  websiteVisible: boolean;
  /**
   * Training-schedule publication flag.
   * Required in addition to `websiteVisible` for WEBSITE_TRAININGSPLAN.
   */
  trainingsplanVisible: boolean;
};

// ── Publication decision ───────────────────────────────────────────────────────

export type PublicationDecision = {
  eligible: boolean;
  reason: DecisionReason;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const INELIGIBLE_STATUSES = new Set<PublishingEventStatus>([
  "DRAFT",
  "CANCELLED",
  "ARCHIVED",
]);

function checkTenant(event: PolicyEvent): PublicationDecision | null {
  if (!event.tenantActive) {
    return { eligible: false, reason: DecisionReason.TENANT_INACTIVE };
  }
  return null;
}

function checkStatus(event: PolicyEvent): PublicationDecision | null {
  if (event.status === "DRAFT") {
    return { eligible: false, reason: DecisionReason.STATUS_DRAFT };
  }
  if (event.status === "CANCELLED") {
    return { eligible: false, reason: DecisionReason.STATUS_CANCELLED };
  }
  if (event.status === "ARCHIVED") {
    return { eligible: false, reason: DecisionReason.STATUS_ARCHIVED };
  }
  return null;
}

function checkType(
  event: PolicyEvent,
  allowed: ReadonlySet<PublishingEventType>,
): PublicationDecision | null {
  if (!allowed.has(event.type)) {
    return { eligible: false, reason: DecisionReason.TYPE_NOT_SUPPORTED };
  }
  return null;
}

// ── Allowed types per channel ──────────────────────────────────────────────────

const INFOBOARD_TYPES = new Set<PublishingEventType>([
  "TRAINING",
  "MATCH",
  "TOURNAMENT",
]);

const WEBSITE_MATCH_TYPES = new Set<PublishingEventType>(["MATCH"]);
const WEBSITE_TRAINING_TYPES = new Set<PublishingEventType>(["TRAINING"]);
const WEBSITE_TOURNAMENT_TYPES = new Set<PublishingEventType>(["TOURNAMENT"]);
const WEBSITE_CLUB_EVENT_TYPES = new Set<PublishingEventType>(["OTHER"]);

// ── Infoboard shared policy (Screen 1 and Screen 2) ───────────────────────────

function evaluateInfoboard(event: PolicyEvent): PublicationDecision {
  const tenantCheck = checkTenant(event);
  if (tenantCheck) return tenantCheck;

  const statusCheck = checkStatus(event);
  if (statusCheck) return statusCheck;

  const typeCheck = checkType(event, INFOBOARD_TYPES);
  if (typeCheck) return typeCheck;

  if (!event.isVisible) {
    return { eligible: false, reason: DecisionReason.NOT_VISIBLE };
  }

  // Channel-specific: MATCH must be HOME.
  if (event.type === "MATCH" && event.matchLocation !== "HOME") {
    return { eligible: false, reason: DecisionReason.INFOBOARD_MATCH_NOT_HOME };
  }

  return { eligible: true, reason: DecisionReason.ELIGIBLE };
}

// ── Website channel policies ───────────────────────────────────────────────────

function evaluateWebsiteMatches(event: PolicyEvent): PublicationDecision {
  const tenantCheck = checkTenant(event);
  if (tenantCheck) return tenantCheck;

  const statusCheck = checkStatus(event);
  if (statusCheck) return statusCheck;

  const typeCheck = checkType(event, WEBSITE_MATCH_TYPES);
  if (typeCheck) return typeCheck;

  if (!event.websiteVisible) {
    return { eligible: false, reason: DecisionReason.WEBSITE_VISIBILITY_REQUIRED };
  }

  // Both HOME and AWAY matches are eligible for the website.
  return { eligible: true, reason: DecisionReason.ELIGIBLE };
}

function evaluateWebsiteTrainingsplan(event: PolicyEvent): PublicationDecision {
  const tenantCheck = checkTenant(event);
  if (tenantCheck) return tenantCheck;

  const statusCheck = checkStatus(event);
  if (statusCheck) return statusCheck;

  const typeCheck = checkType(event, WEBSITE_TRAINING_TYPES);
  if (typeCheck) return typeCheck;

  if (!event.websiteVisible) {
    return { eligible: false, reason: DecisionReason.WEBSITE_VISIBILITY_REQUIRED };
  }

  if (!event.trainingsplanVisible) {
    return {
      eligible: false,
      reason: DecisionReason.TRAININGSPLAN_VISIBILITY_REQUIRED,
    };
  }

  return { eligible: true, reason: DecisionReason.ELIGIBLE };
}

function evaluateWebsiteTournaments(event: PolicyEvent): PublicationDecision {
  const tenantCheck = checkTenant(event);
  if (tenantCheck) return tenantCheck;

  const statusCheck = checkStatus(event);
  if (statusCheck) return statusCheck;

  const typeCheck = checkType(event, WEBSITE_TOURNAMENT_TYPES);
  if (typeCheck) return typeCheck;

  if (!event.websiteVisible) {
    return { eligible: false, reason: DecisionReason.WEBSITE_VISIBILITY_REQUIRED };
  }

  return { eligible: true, reason: DecisionReason.ELIGIBLE };
}

function evaluateWebsiteClubEvents(event: PolicyEvent): PublicationDecision {
  const tenantCheck = checkTenant(event);
  if (tenantCheck) return tenantCheck;

  const statusCheck = checkStatus(event);
  if (statusCheck) return statusCheck;

  const typeCheck = checkType(event, WEBSITE_CLUB_EVENT_TYPES);
  if (typeCheck) return typeCheck;

  if (!event.websiteVisible) {
    return { eligible: false, reason: DecisionReason.WEBSITE_VISIBILITY_REQUIRED };
  }

  return { eligible: true, reason: DecisionReason.ELIGIBLE };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Evaluates whether a given event is eligible for publication on the
 * specified channel.
 *
 * The returned `PublicationDecision` carries both a boolean `eligible` flag
 * and a `reason` that identifies the first failing check (or `ELIGIBLE` when
 * all checks pass).
 *
 * Evaluation order: tenant → status → type → visibility → channel-specific → eligible.
 *
 * Infoboard Screen 1 and Screen 2 share identical policy logic.
 */
export function evaluateForChannel(
  event: PolicyEvent,
  channel: PublicationChannel,
): PublicationDecision {
  switch (channel) {
    case PublicationChannel.INFOBOARD_SCREEN_1:
    case PublicationChannel.INFOBOARD_SCREEN_2:
      return evaluateInfoboard(event);

    case PublicationChannel.WEBSITE_MATCHES:
      return evaluateWebsiteMatches(event);

    case PublicationChannel.WEBSITE_TRAININGSPLAN:
      return evaluateWebsiteTrainingsplan(event);

    case PublicationChannel.WEBSITE_TOURNAMENTS:
      return evaluateWebsiteTournaments(event);

    case PublicationChannel.WEBSITE_CLUB_EVENTS:
      return evaluateWebsiteClubEvents(event);
  }
}
