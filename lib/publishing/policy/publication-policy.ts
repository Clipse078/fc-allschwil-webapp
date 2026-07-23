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

// ── Publication channels ───────────────────────────────────────────────────────

export type PublicationChannel =
  | "INFOBOARD_SCREEN_1"
  | "INFOBOARD_SCREEN_2"
  | "WEBSITE_MATCHES"
  | "WEBSITE_TRAININGS"
  | "WEBSITE_TOURNAMENTS"
  | "WEBSITE_CLUB_EVENTS";

// ── Decision reasons ───────────────────────────────────────────────────────────

export type PublicationReason =
  | "ELIGIBLE"
  | "TENANT_MISMATCH"
  | "TYPE_MISMATCH"
  | "STATUS_NOT_PUBLISHABLE"
  | "INFOBOARD_HIDDEN"
  | "WEBSITE_HIDDEN"
  | "TRAININGSPLAN_HIDDEN"
  | "AWAY_MATCH"
  | "HOME_AWAY_UNKNOWN"
  | "TOURNAMENT_HOSTING_UNVERIFIED";

// ── Publication decision ───────────────────────────────────────────────────────

export type PublicationDecision = {
  eligible: boolean;
  reason: PublicationReason;
};

// ── Event input type ───────────────────────────────────────────────────────────

/**
 * Minimum event shape required for publication policy evaluation.
 *
 * Intentionally decoupled from Prisma models. Callers map their domain
 * objects to this shape before calling `evaluatePublication`.
 */
export type PublicationPolicyEvent = {
  /** The tenant that owns this event. Compared against the tenantId argument. */
  tenantId: string | null;
  /** Categorisation of the event (e.g. "MATCH", "TRAINING", "TOURNAMENT"). */
  type: string;
  /** Current lifecycle status (e.g. "SCHEDULED", "DRAFT"). */
  status: string;
  /**
   * Infoboard visibility toggle.
   * When false the event is hidden from all infoboard screens.
   */
  infoboardVisible: boolean;
  /**
   * Website publication flag.
   * Required for all website channels.
   */
  websiteVisible: boolean;
  /**
   * Training-schedule publication flag.
   * Required in addition to `websiteVisible` for WEBSITE_TRAININGS.
   */
  trainingsplanVisible: boolean;
  /**
   * Match location — relevant only for MATCH events.
   * Normalized via trim and uppercase before comparison.
   * Must be null for non-match event types.
   */
  homeAway: string | null;
};

// ── Status sets ────────────────────────────────────────────────────────────────

const PUBLISHABLE_STATUSES = new Set([
  "SCHEDULED",
  "LIVE",
  "COMPLETED",
  "POSTPONED",
]);

// ── Allowed types per channel ──────────────────────────────────────────────────

const INFOBOARD_TYPES = new Set(["TRAINING", "MATCH", "TOURNAMENT"]);
const WEBSITE_MATCH_TYPES = new Set(["MATCH"]);
const WEBSITE_TRAINING_TYPES = new Set(["TRAINING"]);
const WEBSITE_TOURNAMENT_TYPES = new Set(["TOURNAMENT"]);
const WEBSITE_CLUB_EVENT_TYPES = new Set(["OTHER"]);

// ── Private helpers ────────────────────────────────────────────────────────────

function checkTenant(
  event: PublicationPolicyEvent,
  tenantId: string,
): PublicationDecision | null {
  if (event.tenantId !== tenantId) {
    return { eligible: false, reason: "TENANT_MISMATCH" };
  }
  return null;
}

function checkStatus(event: PublicationPolicyEvent): PublicationDecision | null {
  if (!PUBLISHABLE_STATUSES.has(event.status)) {
    return { eligible: false, reason: "STATUS_NOT_PUBLISHABLE" };
  }
  return null;
}

function checkType(
  event: PublicationPolicyEvent,
  allowed: ReadonlySet<string>,
): PublicationDecision | null {
  if (!allowed.has(event.type)) {
    return { eligible: false, reason: "TYPE_MISMATCH" };
  }
  return null;
}

// ── Infoboard shared policy (Screen 1 and Screen 2) ───────────────────────────

function evaluateInfoboard(
  event: PublicationPolicyEvent,
  tenantId: string,
): PublicationDecision {
  const tenantCheck = checkTenant(event, tenantId);
  if (tenantCheck) return tenantCheck;

  const statusCheck = checkStatus(event);
  if (statusCheck) return statusCheck;

  const typeCheck = checkType(event, INFOBOARD_TYPES);
  if (typeCheck) return typeCheck;

  if (!event.infoboardVisible) {
    return { eligible: false, reason: "INFOBOARD_HIDDEN" };
  }

  if (event.type === "MATCH") {
    const normalized =
      event.homeAway != null ? event.homeAway.trim().toUpperCase() : null;

    if (normalized === "HOME") {
      return { eligible: true, reason: "ELIGIBLE" };
    }
    if (normalized === "AWAY") {
      return { eligible: false, reason: "AWAY_MATCH" };
    }
    // null, blank, NEUTRAL, or any unrecognised value
    return { eligible: false, reason: "HOME_AWAY_UNKNOWN" };
  }

  // TRAINING and TOURNAMENT: a visible event is eligible.
  // TOURNAMENT_HOSTING_UNVERIFIED is reserved for future administrative use
  // and is not returned in the current evaluation flow.
  return { eligible: true, reason: "ELIGIBLE" };
}

// ── Website channel policies ───────────────────────────────────────────────────

function evaluateWebsiteMatches(
  event: PublicationPolicyEvent,
  tenantId: string,
): PublicationDecision {
  const tenantCheck = checkTenant(event, tenantId);
  if (tenantCheck) return tenantCheck;

  const statusCheck = checkStatus(event);
  if (statusCheck) return statusCheck;

  const typeCheck = checkType(event, WEBSITE_MATCH_TYPES);
  if (typeCheck) return typeCheck;

  if (!event.websiteVisible) {
    return { eligible: false, reason: "WEBSITE_HIDDEN" };
  }

  // Both HOME and AWAY matches are eligible for the website.
  return { eligible: true, reason: "ELIGIBLE" };
}

function evaluateWebsiteTrainings(
  event: PublicationPolicyEvent,
  tenantId: string,
): PublicationDecision {
  const tenantCheck = checkTenant(event, tenantId);
  if (tenantCheck) return tenantCheck;

  const statusCheck = checkStatus(event);
  if (statusCheck) return statusCheck;

  const typeCheck = checkType(event, WEBSITE_TRAINING_TYPES);
  if (typeCheck) return typeCheck;

  if (!event.websiteVisible) {
    return { eligible: false, reason: "WEBSITE_HIDDEN" };
  }

  if (!event.trainingsplanVisible) {
    return { eligible: false, reason: "TRAININGSPLAN_HIDDEN" };
  }

  return { eligible: true, reason: "ELIGIBLE" };
}

function evaluateWebsiteTournaments(
  event: PublicationPolicyEvent,
  tenantId: string,
): PublicationDecision {
  const tenantCheck = checkTenant(event, tenantId);
  if (tenantCheck) return tenantCheck;

  const statusCheck = checkStatus(event);
  if (statusCheck) return statusCheck;

  const typeCheck = checkType(event, WEBSITE_TOURNAMENT_TYPES);
  if (typeCheck) return typeCheck;

  if (!event.websiteVisible) {
    return { eligible: false, reason: "WEBSITE_HIDDEN" };
  }

  return { eligible: true, reason: "ELIGIBLE" };
}

function evaluateWebsiteClubEvents(
  event: PublicationPolicyEvent,
  tenantId: string,
): PublicationDecision {
  const tenantCheck = checkTenant(event, tenantId);
  if (tenantCheck) return tenantCheck;

  const statusCheck = checkStatus(event);
  if (statusCheck) return statusCheck;

  const typeCheck = checkType(event, WEBSITE_CLUB_EVENT_TYPES);
  if (typeCheck) return typeCheck;

  if (!event.websiteVisible) {
    return { eligible: false, reason: "WEBSITE_HIDDEN" };
  }

  return { eligible: true, reason: "ELIGIBLE" };
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
export function evaluatePublication(
  event: PublicationPolicyEvent,
  channel: PublicationChannel,
  tenantId: string,
): PublicationDecision {
  switch (channel) {
    case "INFOBOARD_SCREEN_1":
    case "INFOBOARD_SCREEN_2":
      return evaluateInfoboard(event, tenantId);

    case "WEBSITE_MATCHES":
      return evaluateWebsiteMatches(event, tenantId);

    case "WEBSITE_TRAININGS":
      return evaluateWebsiteTrainings(event, tenantId);

    case "WEBSITE_TOURNAMENTS":
      return evaluateWebsiteTournaments(event, tenantId);

    case "WEBSITE_CLUB_EVENTS":
      return evaluateWebsiteClubEvents(event, tenantId);
  }
}
