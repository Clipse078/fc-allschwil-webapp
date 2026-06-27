/**
 * lib/cms/section-publishing.ts
 *
 * Shared publishing engine for CMS section types.
 *
 * This is the single source of truth for:
 *   - Publishing status constants (DRAFT / PUBLISHED)
 *   - Approval status constants (NOT_REQUIRED / DRAFT / IN_REVIEW / APPROVED / CHANGES_REQUESTED)
 *   - Status transition rules
 *   - Human-readable labels (German)
 *
 * Used by:
 *   - lib/page-sections/admin-queries.ts (WebsitePageSection)
 *   - lib/homepage/admin-queries.ts (HomepageSection) — imports via approval-constants.ts
 *
 * This file has NO server-side imports so it is safe in both Server and
 * Client Components (import only constants/types from here on the client).
 */

// ---------------------------------------------------------------------------
// Publishing status
// ---------------------------------------------------------------------------

export const SECTION_PUBLISH_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;

export type SectionPublishStatus =
  (typeof SECTION_PUBLISH_STATUS)[keyof typeof SECTION_PUBLISH_STATUS];

export const SECTION_PUBLISH_STATUS_LABELS: Record<SectionPublishStatus, string> = {
  DRAFT: "Entwurf",
  PUBLISHED: "Veröffentlicht",
};

// ---------------------------------------------------------------------------
// Approval status
// ---------------------------------------------------------------------------

export const SECTION_APPROVAL_STATUS = {
  NOT_REQUIRED: "NOT_REQUIRED",
  DRAFT: "DRAFT",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
} as const;

export type SectionApprovalStatus =
  (typeof SECTION_APPROVAL_STATUS)[keyof typeof SECTION_APPROVAL_STATUS];

/**
 * Approval statuses that allow a section to be published or scheduled.
 * Enforced in publishPageSection and schedulePageSectionPublish.
 */
export const APPROVAL_PUBLISH_ALLOWED_STATUSES: ReadonlySet<SectionApprovalStatus> =
  new Set([
    SECTION_APPROVAL_STATUS.APPROVED,
    SECTION_APPROVAL_STATUS.NOT_REQUIRED,
  ]);

export const SECTION_APPROVAL_STATUS_LABELS: Record<SectionApprovalStatus, string> = {
  NOT_REQUIRED: "Keine Freigabe erforderlich",
  DRAFT: "Entwurf",
  IN_REVIEW: "In Überprüfung",
  APPROVED: "Freigegeben",
  CHANGES_REQUESTED: "Änderungen erforderlich",
};

// ---------------------------------------------------------------------------
// Approval gate error
// ---------------------------------------------------------------------------

/**
 * Returned by publish/schedule when the approval gate blocks the action.
 */
export type ApprovalGateError = {
  blocked: true;
  approvalStatus: SectionApprovalStatus;
};

export function isApprovalGateError(
  value: unknown,
): value is ApprovalGateError {
  return (
    typeof value === "object" &&
    value !== null &&
    "blocked" in value &&
    (value as ApprovalGateError).blocked === true
  );
}

// ---------------------------------------------------------------------------
// Transition guards
// ---------------------------------------------------------------------------

/**
 * Returns true if a publish action is allowed given the current approval status.
 */
export function canPublish(approvalStatus: SectionApprovalStatus): boolean {
  return APPROVAL_PUBLISH_ALLOWED_STATUSES.has(approvalStatus);
}

/**
 * Valid transitions for the review workflow.
 * Key = current state, Value = set of reachable states.
 */
export const APPROVAL_TRANSITIONS: Record<
  SectionApprovalStatus,
  SectionApprovalStatus[]
> = {
  NOT_REQUIRED: ["DRAFT", "IN_REVIEW"],
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "CHANGES_REQUESTED"],
  APPROVED: ["DRAFT", "IN_REVIEW"],
  CHANGES_REQUESTED: ["DRAFT", "IN_REVIEW"],
};
