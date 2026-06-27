/**
 * lib/homepage/approval-constants.ts
 *
 * Re-exports the shared CMS publishing engine constants for HomepageSection.
 *
 * HomepageSection and WebsitePageSection share the same publishing lifecycle.
 * The single source of truth is lib/cms/section-publishing.ts.
 *
 * This file is kept as a backwards-compatible re-export layer so that
 * existing consumers (HomepageSectionList, ReviewQueueClient, review page,
 * homepage admin-queries) continue to work without changes.
 *
 * Safe to import from both Server Components and Client Components
 * (lib/cms/section-publishing.ts has no server-side imports).
 */

import {
  SECTION_APPROVAL_STATUS,
  SECTION_APPROVAL_STATUS_LABELS,
  APPROVAL_PUBLISH_ALLOWED_STATUSES,
  type SectionApprovalStatus,
} from "@/lib/cms/section-publishing";

/** Valid approval status values — re-exported from the shared publishing engine. */
export const APPROVAL_STATUS = SECTION_APPROVAL_STATUS;

/** Approval status type — alias for SectionApprovalStatus. */
export type ApprovalStatus = SectionApprovalStatus;

/**
 * Statuses that allow publishing/scheduling.
 * Re-exported from the shared publishing engine.
 */
export const APPROVAL_PUBLISH_ALLOWED: ReadonlySet<ApprovalStatus> =
  APPROVAL_PUBLISH_ALLOWED_STATUSES;

/** Human-readable labels for approval statuses (German). */
export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> =
  SECTION_APPROVAL_STATUS_LABELS;
