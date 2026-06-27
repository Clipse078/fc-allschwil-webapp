/**
 * lib/homepage/admin-queries.ts
 *
 * Admin query layer for HomepageSection management.
 *
 * All queries are tenant-scoped. Callers must verify the tenantId
 * from the authenticated session before passing it here.
 *
 * This layer intentionally does not validate section type keys —
 * that is the responsibility of the API layer (route handlers).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import {
  DEFAULT_HOMEPAGE_SECTIONS,
  type HomepageSectionConfig,
} from "@/lib/homepage/section-types";
import {
  APPROVAL_STATUS,
  APPROVAL_PUBLISH_ALLOWED,
  APPROVAL_STATUS_LABELS,
  type ApprovalStatus,
} from "@/lib/homepage/approval-constants";
import {
  SECTION_PUBLISH_STATUS,
  type SectionPublishStatus,
} from "@/lib/cms/section-publishing";

// Re-export so callers can import everything from admin-queries
export {
  APPROVAL_STATUS,
  APPROVAL_PUBLISH_ALLOWED,
  APPROVAL_STATUS_LABELS,
  type ApprovalStatus,
};

// ---------------------------------------------------------------------------
// Publishing constants — re-exported from the shared engine
// ---------------------------------------------------------------------------

/**
 * Valid publish status values for HomepageSection.
 * Alias for SECTION_PUBLISH_STATUS from lib/cms/section-publishing.ts.
 */
export const PUBLISH_STATUS = SECTION_PUBLISH_STATUS;

/** Publish status type — alias for SectionPublishStatus. */
export type PublishStatus = SectionPublishStatus;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HomepageSectionAdminItem = {
  id: string;
  tenantId: string;
  type: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  config: HomepageSectionConfig;
  publishStatus: PublishStatus;
  publishedAt: Date | null;
  unpublishedAt: Date | null;
  lastPublishedAt: Date | null;
  scheduledPublishAt: Date | null;
  // ── Approval workflow fields (CMS V2 Slice 6) ──────────────────────────
  approvalStatus: ApprovalStatus;
  reviewerUserId: string | null;
  reviewRequestedAt: Date | null;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  approvalNote: string | null;
  approvedByUserId: string | null;
  rejectedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Select shape
// ---------------------------------------------------------------------------

const adminSelect = {
  id: true,
  tenantId: true,
  type: true,
  label: true,
  sortOrder: true,
  isEnabled: true,
  config: true,
  publishStatus: true,
  publishedAt: true,
  unpublishedAt: true,
  lastPublishedAt: true,
  scheduledPublishAt: true,
  approvalStatus: true,
  reviewerUserId: true,
  reviewRequestedAt: true,
  reviewedAt: true,
  approvedAt: true,
  rejectedAt: true,
  approvalNote: true,
  approvedByUserId: true,
  rejectedByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * Returns all homepage sections for a tenant, ordered by sortOrder ascending.
 */
export async function listHomepageSections(
  tenantId: string,
): Promise<HomepageSectionAdminItem[]> {
  const rows = await prisma.homepageSection.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminSelect,
  });
  return rows as HomepageSectionAdminItem[];
}

/**
 * Returns the count of homepage sections for a tenant.
 */
export async function countHomepageSections(tenantId: string): Promise<number> {
  return prisma.homepageSection.count({ where: { tenantId } });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Creates the default section set for a tenant.
 * Safe to call only when the tenant has no sections yet.
 * Returns the number of sections created.
 */
export async function bootstrapDefaultSections(
  tenantId: string,
): Promise<number> {
  const existing = await countHomepageSections(tenantId);
  if (existing > 0) return 0;

  await prisma.homepageSection.createMany({
    data: DEFAULT_HOMEPAGE_SECTIONS.map((s) => ({
      tenantId,
      type: s.type,
      label: s.label,
      sortOrder: s.sortOrder,
      isEnabled: s.isEnabled,
      config: s.config,
      // New sections bootstrapped via admin start as DRAFT (publish) and
      // DRAFT (approval) to require explicit review before going live.
      publishStatus: PUBLISH_STATUS.DRAFT,
      approvalStatus: APPROVAL_STATUS.DRAFT,
    })),
    skipDuplicates: true,
  });

  return DEFAULT_HOMEPAGE_SECTIONS.length;
}

// ---------------------------------------------------------------------------
// Toggle enabled/disabled
// ---------------------------------------------------------------------------

/**
 * Toggles the isEnabled flag for a section.
 * Returns the updated section, or null if the section does not exist
 * or belongs to a different tenant.
 */
export async function toggleHomepageSectionEnabled(
  tenantId: string,
  id: string,
): Promise<HomepageSectionAdminItem | null> {
  const existing = await prisma.homepageSection.findFirst({
    where: { id, tenantId },
    select: { id: true, isEnabled: true },
  });
  if (!existing) return null;

  const updated = await prisma.homepageSection.update({
    where: { id },
    data: { isEnabled: !existing.isEnabled },
    select: adminSelect,
  });
  return updated as HomepageSectionAdminItem;
}

// ---------------------------------------------------------------------------
// Reorder (simple up/down)
// ---------------------------------------------------------------------------

/**
 * Moves a section one position up (lower sortOrder) or down (higher sortOrder)
 * relative to its current neighbors.
 *
 * Uses a swap strategy: swaps sortOrder values with the adjacent section.
 * Returns the full updated section list for the tenant after the swap,
 * or null if the section does not exist or is already at the boundary.
 */
export async function moveHomepageSection(
  tenantId: string,
  id: string,
  direction: "up" | "down",
): Promise<HomepageSectionAdminItem[] | null> {
  const sections = await listHomepageSections(tenantId);
  const idx = sections.findIndex((s) => s.id === id);
  if (idx < 0) return null;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sections.length) return null;

  const current = sections[idx];
  const neighbor = sections[swapIdx];

  // Swap sortOrder values in a transaction
  await prisma.$transaction([
    prisma.homepageSection.update({
      where: { id: current.id },
      data: { sortOrder: neighbor.sortOrder },
    }),
    prisma.homepageSection.update({
      where: { id: neighbor.id },
      data: { sortOrder: current.sortOrder },
    }),
  ]);

  return listHomepageSections(tenantId);
}

// ---------------------------------------------------------------------------
// Update label and/or config
// ---------------------------------------------------------------------------

export type HomepageSectionUpdateInput = {
  /** New admin label. Must be non-empty after trimming. */
  label?: string;
  /**
   * Replacement config object. Must have been validated by the caller
   * against the appropriate Zod schema before passing here.
   * Only provided keys are written; existing keys not in the update are
   * replaced entirely (full-replace semantics — no deep merge).
   */
  config?: Record<string, unknown>;
};

/**
 * Updates the label and/or config of a homepage section.
 * Both fields are optional; at least one must be provided.
 *
 * Returns the updated section, or null if the section does not exist
 * or belongs to a different tenant.
 */
export async function updateHomepageSection(
  tenantId: string,
  id: string,
  input: HomepageSectionUpdateInput,
): Promise<HomepageSectionAdminItem | null> {
  const existing = await prisma.homepageSection.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const updated = await prisma.homepageSection.update({
    where: { id },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.config !== undefined
        ? { config: input.config as Prisma.InputJsonValue }
        : {}),
    },
    select: adminSelect,
  });
  return updated as HomepageSectionAdminItem;
}

// ---------------------------------------------------------------------------
// Get by ID (tenant-safe)
// ---------------------------------------------------------------------------

export async function getHomepageSectionById(
  tenantId: string,
  id: string,
): Promise<HomepageSectionAdminItem | null> {
  const row = await prisma.homepageSection.findFirst({
    where: { id, tenantId },
    select: adminSelect,
  });
  return row as HomepageSectionAdminItem | null;
}

// ---------------------------------------------------------------------------
// Publish / Unpublish / Schedule
// ---------------------------------------------------------------------------

/**
 * Error returned when publishing is blocked by the approval gate.
 */
export type ApprovalGateError = {
  blocked: true;
  approvalStatus: ApprovalStatus;
};

/**
 * Publishes a homepage section.
 * Sets publishStatus=PUBLISHED, records publishedAt and lastPublishedAt.
 * Clears any pending scheduledPublishAt (the section is already live).
 *
 * Approval gate: only sections with approvalStatus APPROVED or NOT_REQUIRED
 * may be published. Returns { blocked: true, approvalStatus } if blocked.
 *
 * Returns the updated section, null if not found, or an ApprovalGateError.
 */
export async function publishHomepageSection(
  tenantId: string,
  id: string,
): Promise<HomepageSectionAdminItem | null | ApprovalGateError> {
  const existing = await prisma.homepageSection.findFirst({
    where: { id, tenantId },
    select: { id: true, approvalStatus: true },
  });
  if (!existing) return null;

  const approvalStatus = existing.approvalStatus as ApprovalStatus;
  if (!APPROVAL_PUBLISH_ALLOWED.has(approvalStatus)) {
    return { blocked: true, approvalStatus };
  }

  const now = new Date();
  const updated = await prisma.homepageSection.update({
    where: { id },
    data: {
      publishStatus: PUBLISH_STATUS.PUBLISHED,
      publishedAt: now,
      lastPublishedAt: now,
      // Clear any pending scheduled publish since we're publishing immediately
      scheduledPublishAt: null,
    },
    select: adminSelect,
  });
  return updated as HomepageSectionAdminItem;
}

/**
 * Unpublishes a homepage section.
 * Sets publishStatus=DRAFT, records unpublishedAt.
 * Retains lastPublishedAt for the audit trail.
 *
 * No approval gate on unpublish — always allowed.
 *
 * Returns the updated section, or null if not found / different tenant.
 */
export async function unpublishHomepageSection(
  tenantId: string,
  id: string,
): Promise<HomepageSectionAdminItem | null> {
  const existing = await prisma.homepageSection.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const updated = await prisma.homepageSection.update({
    where: { id },
    data: {
      publishStatus: PUBLISH_STATUS.DRAFT,
      unpublishedAt: new Date(),
      // Clear any pending scheduled publish when explicitly unpublishing
      scheduledPublishAt: null,
      // lastPublishedAt intentionally NOT cleared — preserved for audit trail
    },
    select: adminSelect,
  });
  return updated as HomepageSectionAdminItem;
}

/**
 * Schedules a future publish for a homepage section.
 * Sets publishStatus=DRAFT and scheduledPublishAt to the given future date.
 * The public API will treat the section as published once scheduledPublishAt <= now().
 *
 * Approval gate: only sections with approvalStatus APPROVED or NOT_REQUIRED
 * may be scheduled. Returns { blocked: true, approvalStatus } if blocked.
 *
 * Constraints:
 *   - scheduledPublishAt must be in the future (caller should validate).
 *   - Section remains DRAFT until the scheduled time (or until manually published).
 *
 * Returns the updated section, null if not found, or an ApprovalGateError.
 */
export async function scheduleHomepageSectionPublish(
  tenantId: string,
  id: string,
  scheduledPublishAt: Date,
): Promise<HomepageSectionAdminItem | null | ApprovalGateError> {
  const existing = await prisma.homepageSection.findFirst({
    where: { id, tenantId },
    select: { id: true, approvalStatus: true },
  });
  if (!existing) return null;

  const approvalStatus = existing.approvalStatus as ApprovalStatus;
  if (!APPROVAL_PUBLISH_ALLOWED.has(approvalStatus)) {
    return { blocked: true, approvalStatus };
  }

  const updated = await prisma.homepageSection.update({
    where: { id },
    data: {
      publishStatus: PUBLISH_STATUS.DRAFT,
      scheduledPublishAt,
    },
    select: adminSelect,
  });
  return updated as HomepageSectionAdminItem;
}

// ---------------------------------------------------------------------------
// Approval workflow (CMS V2 Slice 6)
// ---------------------------------------------------------------------------

/**
 * Requests editorial review for a section.
 *
 * Allowed from: NOT_REQUIRED, DRAFT, APPROVED, CHANGES_REQUESTED.
 * Blocked from: IN_REVIEW (already in review — idempotent guard).
 *
 * Optionally assigns a reviewer user. Reviewer must belong to the same tenant.
 * Audit trail: written to AuditLog (best-effort, never throws).
 *
 * Returns the updated section, null if not found, or "already_in_review" if blocked.
 */
export async function requestReviewHomepageSection(
  tenantId: string,
  id: string,
  actorUserId: string,
  reviewerUserId?: string | null,
): Promise<HomepageSectionAdminItem | null | "already_in_review"> {
  const existing = await prisma.homepageSection.findFirst({
    where: { id, tenantId },
    select: { id: true, approvalStatus: true, label: true },
  });
  if (!existing) return null;

  if (existing.approvalStatus === APPROVAL_STATUS.IN_REVIEW) {
    return "already_in_review";
  }

  const prevStatus = existing.approvalStatus as ApprovalStatus;
  const now = new Date();

  // If a reviewerUserId is provided, verify it belongs to the same tenant
  if (reviewerUserId) {
    const reviewerExists = await prisma.user.findFirst({
      where: { id: reviewerUserId, tenantId },
      select: { id: true },
    });
    if (!reviewerExists) reviewerUserId = undefined;
  }

  const updated = await prisma.homepageSection.update({
    where: { id },
    data: {
      approvalStatus: APPROVAL_STATUS.IN_REVIEW,
      reviewRequestedAt: now,
      // Only update reviewerUserId if explicitly provided
      ...(reviewerUserId !== undefined
        ? { reviewerUserId: reviewerUserId ?? null }
        : {}),
      // Clear previous rejection timestamp when re-submitting
      rejectedAt: null,
      rejectedByUserId: null,
    },
    select: adminSelect,
  });

  void logAction({
    actorUserId,
    moduleKey: "homepage",
    entityType: "HomepageSection",
    entityId: id,
    action: "APPROVAL_REQUEST",
    beforeJson: { approvalStatus: prevStatus },
    afterJson: { approvalStatus: APPROVAL_STATUS.IN_REVIEW },
    metadataJson: {
      tenantId,
      label: existing.label,
      reviewerUserId: reviewerUserId ?? null,
    },
  });

  return updated as HomepageSectionAdminItem;
}

/**
 * Approves a homepage section.
 *
 * Allowed from: IN_REVIEW only.
 * Transitions approvalStatus to APPROVED.
 * Records approvedAt, approvedByUserId, reviewedAt, optional approvalNote.
 * Audit trail: written to AuditLog (best-effort, never throws).
 *
 * Returns the updated section, null if not found, or
 * "not_in_review" if the section is not currently in review.
 */
export async function approveHomepageSection(
  tenantId: string,
  id: string,
  actorUserId: string,
  note?: string | null,
): Promise<HomepageSectionAdminItem | null | "not_in_review"> {
  const existing = await prisma.homepageSection.findFirst({
    where: { id, tenantId },
    select: { id: true, approvalStatus: true, label: true },
  });
  if (!existing) return null;

  if (existing.approvalStatus !== APPROVAL_STATUS.IN_REVIEW) {
    return "not_in_review";
  }

  const now = new Date();
  const updated = await prisma.homepageSection.update({
    where: { id },
    data: {
      approvalStatus: APPROVAL_STATUS.APPROVED,
      approvedAt: now,
      reviewedAt: now,
      approvedByUserId: actorUserId,
      approvalNote: note ?? null,
      // Clear any rejection data from a previous cycle
      rejectedAt: null,
      rejectedByUserId: null,
    },
    select: adminSelect,
  });

  void logAction({
    actorUserId,
    moduleKey: "homepage",
    entityType: "HomepageSection",
    entityId: id,
    action: "APPROVE",
    beforeJson: { approvalStatus: APPROVAL_STATUS.IN_REVIEW },
    afterJson: { approvalStatus: APPROVAL_STATUS.APPROVED },
    metadataJson: { tenantId, label: existing.label, note: note ?? null },
  });

  return updated as HomepageSectionAdminItem;
}

/**
 * Rejects (requests changes for) a homepage section.
 *
 * Allowed from: IN_REVIEW only.
 * Transitions approvalStatus to CHANGES_REQUESTED.
 * Records rejectedAt, rejectedByUserId, reviewedAt, optional approvalNote.
 * Audit trail: written to AuditLog (best-effort, never throws).
 *
 * Returns the updated section, null if not found, or
 * "not_in_review" if the section is not currently in review.
 */
export async function rejectHomepageSection(
  tenantId: string,
  id: string,
  actorUserId: string,
  note?: string | null,
): Promise<HomepageSectionAdminItem | null | "not_in_review"> {
  const existing = await prisma.homepageSection.findFirst({
    where: { id, tenantId },
    select: { id: true, approvalStatus: true, label: true },
  });
  if (!existing) return null;

  if (existing.approvalStatus !== APPROVAL_STATUS.IN_REVIEW) {
    return "not_in_review";
  }

  const now = new Date();
  const updated = await prisma.homepageSection.update({
    where: { id },
    data: {
      approvalStatus: APPROVAL_STATUS.CHANGES_REQUESTED,
      rejectedAt: now,
      reviewedAt: now,
      rejectedByUserId: actorUserId,
      approvalNote: note ?? null,
      // Clear any previous approval data
      approvedAt: null,
      approvedByUserId: null,
    },
    select: adminSelect,
  });

  void logAction({
    actorUserId,
    moduleKey: "homepage",
    entityType: "HomepageSection",
    entityId: id,
    action: "REJECT",
    beforeJson: { approvalStatus: APPROVAL_STATUS.IN_REVIEW },
    afterJson: { approvalStatus: APPROVAL_STATUS.CHANGES_REQUESTED },
    metadataJson: { tenantId, label: existing.label, note: note ?? null },
  });

  return updated as HomepageSectionAdminItem;
}

// ---------------------------------------------------------------------------
// Review queue (CMS V2 Slice 6)
// ---------------------------------------------------------------------------

/**
 * Returns all sections in the review queue for a tenant.
 * Includes: IN_REVIEW, CHANGES_REQUESTED, DRAFT sections.
 * Ordered by: reviewRequestedAt desc (most recently submitted first),
 *             then createdAt asc as tiebreaker.
 */
export async function listSectionsForReview(
  tenantId: string,
): Promise<HomepageSectionAdminItem[]> {
  const rows = await prisma.homepageSection.findMany({
    where: {
      tenantId,
      approvalStatus: {
        in: [
          APPROVAL_STATUS.IN_REVIEW,
          APPROVAL_STATUS.CHANGES_REQUESTED,
          APPROVAL_STATUS.DRAFT,
        ],
      },
    },
    orderBy: [{ reviewRequestedAt: "desc" }, { createdAt: "asc" }],
    select: adminSelect,
  });
  return rows as HomepageSectionAdminItem[];
}

/**
 * Returns recently approved sections for a tenant (up to 10).
 * Used by the review queue to show the approved history.
 */
export async function listRecentlyApprovedSections(
  tenantId: string,
  limit = 10,
): Promise<HomepageSectionAdminItem[]> {
  const rows = await prisma.homepageSection.findMany({
    where: {
      tenantId,
      approvalStatus: APPROVAL_STATUS.APPROVED,
    },
    orderBy: [{ approvedAt: "desc" }],
    take: limit,
    select: adminSelect,
  });
  return rows as HomepageSectionAdminItem[];
}

/**
 * Returns reviewer info (firstName, lastName) for a user ID.
 * Used by the review queue UI to display reviewer names.
 * Returns null if userId is null or user not found.
 */
export async function getReviewerInfo(
  userId: string | null,
): Promise<{ firstName: string; lastName: string } | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });
  return user ?? null;
}
