/**
 * Shared governance helpers for review stage management.
 *
 * Used by: Targets, and future DB-backed Meetings/Initiatives.
 * Consistent with Event.reviewStage pattern (ReviewWorkflowStage enum).
 *
 * --- Architecture TODOs (Governance Phase 2+) ---
 *
 * TODO: org-unit governance
 *   - Add org-unit-level governance settings per module (e.g. "U16 trainers can
 *     self-approve targets in training domain, board always requires four-eye")
 *   - Link org-unit restrictions to RoleWorkflowRule at review time
 *
 * TODO: module-level governance settings
 *   - Persist module-specific governance config (requiresFourEye, stageLock,
 *     allowedActors per stage) in a ModuleGovernanceConfig DB table.
 *   - Load config at API request time, not just from static policy files.
 *
 * TODO: reviewer assignment
 *   - When an entity enters SUBMITTED stage, auto-assign reviewers from
 *     RoleWorkflowReviewAssignment linked to the matching RoleWorkflowRule.
 *   - Surface "pending review" queue per role in UI.
 *
 * TODO: approval chains
 *   - Allow multi-step approval (e.g. head coach → board chair) via ordered
 *     RoleWorkflowReviewAssignment.sortOrder.
 *   - Track partial approval state; block APPROVED until all required reviewers sign.
 *
 * TODO: notifications/reminders
 *   - Fire reminder nudges when entities remain in SUBMITTED for N days.
 *   - Integrate with nudgeJson architecture already on Target model.
 *   - Later: email/Slack/push hooks per governance event type.
 */

import { ReviewWorkflowStage } from "@prisma/client";

// ---------------------------------------------------------------------------
// Stage metadata
// ---------------------------------------------------------------------------

export type ReviewStageInfo = {
  stage: ReviewWorkflowStage;
  label: string;
  badgeClasses: string;
  isDraft: boolean;
  isSubmitted: boolean;
  isApproved: boolean;
  isRejected: boolean;
  isPublished: boolean;
};

const STAGE_META: Record<ReviewWorkflowStage, Omit<ReviewStageInfo, "stage" | "isDraft" | "isSubmitted" | "isApproved" | "isRejected" | "isPublished">> = {
  [ReviewWorkflowStage.DRAFT]: {
    label: "Entwurf",
    badgeClasses: "border-slate-200 bg-slate-50 text-slate-600",
  },
  [ReviewWorkflowStage.SUBMITTED]: {
    label: "Zur Prüfung",
    badgeClasses: "border-amber-200 bg-amber-50 text-amber-700",
  },
  [ReviewWorkflowStage.APPROVED]: {
    label: "Genehmigt",
    badgeClasses: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  [ReviewWorkflowStage.REJECTED]: {
    label: "Abgelehnt",
    badgeClasses: "border-rose-200 bg-rose-50 text-rose-700",
  },
  [ReviewWorkflowStage.PUBLISHED]: {
    label: "Veröffentlicht",
    badgeClasses: "border-blue-200 bg-blue-50 text-[#0b4aa2]",
  },
};

export function getReviewStageInfo(stage: ReviewWorkflowStage): ReviewStageInfo {
  const meta = STAGE_META[stage];
  return {
    stage,
    ...meta,
    isDraft: stage === ReviewWorkflowStage.DRAFT,
    isSubmitted: stage === ReviewWorkflowStage.SUBMITTED,
    isApproved: stage === ReviewWorkflowStage.APPROVED,
    isRejected: stage === ReviewWorkflowStage.REJECTED,
    isPublished: stage === ReviewWorkflowStage.PUBLISHED,
  };
}

// ---------------------------------------------------------------------------
// State machine helpers
// ---------------------------------------------------------------------------

/**
 * Allowed transitions per stage.
 * Conservative: stages can always return to DRAFT or move forward one step.
 * Reviewers can send back to DRAFT (e.g. needs more info).
 */
const ALLOWED_TRANSITIONS: Record<ReviewWorkflowStage, ReviewWorkflowStage[]> = {
  [ReviewWorkflowStage.DRAFT]: [
    ReviewWorkflowStage.SUBMITTED,
  ],
  [ReviewWorkflowStage.SUBMITTED]: [
    ReviewWorkflowStage.APPROVED,
    ReviewWorkflowStage.REJECTED,
    ReviewWorkflowStage.DRAFT,
  ],
  [ReviewWorkflowStage.APPROVED]: [
    ReviewWorkflowStage.PUBLISHED,
    ReviewWorkflowStage.REJECTED,
  ],
  [ReviewWorkflowStage.REJECTED]: [
    ReviewWorkflowStage.DRAFT,
    ReviewWorkflowStage.SUBMITTED,
  ],
  [ReviewWorkflowStage.PUBLISHED]: [],
};

export function canTransitionTo(
  from: ReviewWorkflowStage,
  to: ReviewWorkflowStage,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(
  from: ReviewWorkflowStage,
): ReviewWorkflowStage[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

// ---------------------------------------------------------------------------
// Semantic helpers
// ---------------------------------------------------------------------------

/** Entity is editable only in DRAFT or REJECTED state. */
export function canEditDraft(stage: ReviewWorkflowStage): boolean {
  return stage === ReviewWorkflowStage.DRAFT || stage === ReviewWorkflowStage.REJECTED;
}

/** Entity is awaiting review action. */
export function isReviewPending(stage: ReviewWorkflowStage): boolean {
  return stage === ReviewWorkflowStage.SUBMITTED;
}

/** Entity has passed review (approved or published). */
export function isPublishedLikeState(stage: ReviewWorkflowStage): boolean {
  return (
    stage === ReviewWorkflowStage.APPROVED ||
    stage === ReviewWorkflowStage.PUBLISHED
  );
}

/** Entity is in a terminal state (no further transitions possible). */
export function isTerminalState(stage: ReviewWorkflowStage): boolean {
  return getAllowedTransitions(stage).length === 0;
}

/** Whether moving to this stage should record a reviewer stamp. */
export function requiresReviewerStamp(to: ReviewWorkflowStage): boolean {
  return (
    to === ReviewWorkflowStage.APPROVED ||
    to === ReviewWorkflowStage.REJECTED
  );
}

// ---------------------------------------------------------------------------
// Policy helpers — lightweight, no DB reads
// ---------------------------------------------------------------------------

export type GovernanceDomain =
  | "targets"
  | "meetings"
  | "initiatives"
  | "events";

/** Default stage on entity creation per domain. */
export function getDefaultReviewStage(
  domain: GovernanceDomain,
): ReviewWorkflowStage {
  // All strategic domains start as DRAFT; actors with elevated rights can
  // immediately submit or approve at creation time via API.
  switch (domain) {
    case "events":
      return ReviewWorkflowStage.SUBMITTED;
    default:
      return ReviewWorkflowStage.DRAFT;
  }
}
