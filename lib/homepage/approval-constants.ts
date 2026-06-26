/**
 * lib/homepage/approval-constants.ts
 *
 * Client-safe approval status constants for HomepageSection.
 * This file has NO server-side imports (no Prisma, no DB) so it is
 * safe to import from both Server Components and Client Components.
 *
 * admin-queries.ts re-exports these for server-side callers.
 */

/** Valid approval status values for HomepageSection. */
export const APPROVAL_STATUS = {
  NOT_REQUIRED: "NOT_REQUIRED",
  DRAFT: "DRAFT",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
} as const;

export type ApprovalStatus = (typeof APPROVAL_STATUS)[keyof typeof APPROVAL_STATUS];

/**
 * Statuses that allow publishing/scheduling.
 * Enforced in publishHomepageSection and scheduleHomepageSectionPublish.
 */
export const APPROVAL_PUBLISH_ALLOWED: ReadonlySet<ApprovalStatus> = new Set([
  APPROVAL_STATUS.APPROVED,
  APPROVAL_STATUS.NOT_REQUIRED,
]);

/** Human-readable labels for approval statuses (German). */
export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  NOT_REQUIRED: "Keine Freigabe erforderlich",
  DRAFT: "Entwurf",
  IN_REVIEW: "In Überprüfung",
  APPROVED: "Freigegeben",
  CHANGES_REQUESTED: "Änderungen erforderlich",
};
