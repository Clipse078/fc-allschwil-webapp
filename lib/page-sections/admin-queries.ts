/**
 * lib/page-sections/admin-queries.ts
 *
 * Admin query layer for WebsitePageSection management (CMS V2 Slice 8+9).
 *
 * All queries are tenant-scoped AND page-scoped. Callers must verify:
 *   - tenantId from the authenticated session (never from request body)
 *   - pageId ownership (page must belong to the same tenant)
 *
 * Publishing strategy (Slice 9):
 *   Section visibility on the public API requires both:
 *     1. isEnabled = true (section gate)
 *     2. publishStatus = "PUBLISHED" AND (publishUntil IS NULL OR publishUntil > now())
 *     3. Parent WebsitePage.status = "PUBLISHED" AND publishedAt <= now() (page gate)
 *   Full section-level publish/approval workflow added in Slice 9.
 *
 * Reuses the shared publishing engine from lib/cms/section-publishing.ts.
 * Block type validation is delegated to the API layer (route handlers).
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { logAction } from "@/lib/audit/log-action";
import { captureRevision } from "@/lib/cms/revision-engine";
import {
  SECTION_PUBLISH_STATUS,
  SECTION_APPROVAL_STATUS,
  APPROVAL_PUBLISH_ALLOWED_STATUSES,
  type SectionPublishStatus,
  type SectionApprovalStatus,
  type ApprovalGateError,
} from "@/lib/cms/section-publishing";

export {
  SECTION_PUBLISH_STATUS,
  SECTION_APPROVAL_STATUS,
  APPROVAL_PUBLISH_ALLOWED_STATUSES,
  type SectionPublishStatus,
  type SectionApprovalStatus,
  type ApprovalGateError,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PageSectionAdminItem = {
  id: string;
  tenantId: string;
  pageId: string;
  type: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  config: Record<string, unknown>;
  // ── Publishing workflow fields (CMS V2 Slice 9) ──────────────────────────
  publishStatus: SectionPublishStatus;
  publishedAt: Date | null;
  unpublishedAt: Date | null;
  lastPublishedAt: Date | null;
  scheduledPublishAt: Date | null;
  publishUntil: Date | null;
  // ── Approval workflow fields (CMS V2 Slice 9) ──────────────────────────
  approvalStatus: SectionApprovalStatus;
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
  pageId: true,
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
  publishUntil: true,
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
} as const satisfies Prisma.WebsitePageSectionSelect;

function mapRow(
  row: Prisma.WebsitePageSectionGetPayload<{ select: typeof adminSelect }>,
): PageSectionAdminItem {
  return {
    ...row,
    config:
      row.config !== null && typeof row.config === "object"
        ? (row.config as Record<string, unknown>)
        : {},
    publishStatus: (row.publishStatus as SectionPublishStatus) ?? SECTION_PUBLISH_STATUS.PUBLISHED,
    approvalStatus: (row.approvalStatus as SectionApprovalStatus) ?? SECTION_APPROVAL_STATUS.NOT_REQUIRED,
  };
}

// ---------------------------------------------------------------------------
// Page ownership guard
// ---------------------------------------------------------------------------

/**
 * Verifies that a WebsitePage with the given id belongs to tenantId.
 * Returns the page (id only) if found, null otherwise.
 * Callers must 404 when this returns null.
 */
export async function getPageForTenant(
  tenantId: string,
  pageId: string,
): Promise<{ id: string } | null> {
  return prisma.websitePage.findFirst({
    where: { id: pageId, tenantId },
    select: { id: true },
  });
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * Returns all sections for a page, ordered by sortOrder ascending then createdAt ascending.
 */
export async function listPageSections(
  tenantId: string,
  pageId: string,
): Promise<PageSectionAdminItem[]> {
  const rows = await prisma.websitePageSection.findMany({
    where: { tenantId, pageId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminSelect,
  });
  return rows.map(mapRow);
}

// ---------------------------------------------------------------------------
// Get single
// ---------------------------------------------------------------------------

export async function getPageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
): Promise<PageSectionAdminItem | null> {
  const row = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: adminSelect,
  });
  return row ? mapRow(row) : null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreatePageSectionInput = {
  tenantId: string;
  pageId: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
  actorUserId?: string | null;
};

export async function createPageSection(
  input: CreatePageSectionInput,
): Promise<PageSectionAdminItem> {
  const last = await prisma.websitePageSection.findFirst({
    where: { tenantId: input.tenantId, pageId: input.pageId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -10) + 10;

  const row = await prisma.websitePageSection.create({
    data: {
      tenantId: input.tenantId,
      pageId: input.pageId,
      type: input.type,
      label: input.label,
      config: (input.config ?? {}) as Prisma.InputJsonValue,
      sortOrder,
      isEnabled: true,
      publishStatus: SECTION_PUBLISH_STATUS.PUBLISHED,
      approvalStatus: SECTION_APPROVAL_STATUS.NOT_REQUIRED,
    },
    select: adminSelect,
  });

  const section = mapRow(row);

  void captureRevision({
    tenantId: input.tenantId,
    entityType: "WebsitePageSection",
    entityId: section.id,
    snapshot: sectionSnapshot(section),
    createdByUserId: input.actorUserId ?? null,
    changeNote: "Sektion erstellt",
  });

  void logAction({
    actorUserId: input.actorUserId ?? null,
    moduleKey: "page-sections",
    entityType: "WebsitePageSection",
    entityId: section.id,
    action: "CREATE",
    afterJson: sectionSnapshot(section),
    metadataJson: { tenantId: input.tenantId, pageId: input.pageId },
  });

  return section;
}

// ---------------------------------------------------------------------------
// Update config / label
// ---------------------------------------------------------------------------

export type UpdatePageSectionInput = {
  label?: string;
  config?: Record<string, unknown>;
  actorUserId?: string | null;
  changeNote?: string | null;
  /** True when this update was triggered by a revision restore action. */
  isRestore?: boolean;
  /** ID of the source revision when isRestore = true. */
  parentRevisionId?: string | null;
};

export async function updatePageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  input: UpdatePageSectionInput,
): Promise<PageSectionAdminItem | null> {
  const existing = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: adminSelect,
  });
  if (!existing) return null;

  const row = await prisma.websitePageSection.update({
    where: { id: sectionId },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.config !== undefined
        ? { config: input.config as Prisma.InputJsonValue }
        : {}),
    },
    select: adminSelect,
  });
  const updated = mapRow(row);

  void captureRevision({
    tenantId,
    entityType: "WebsitePageSection",
    entityId: sectionId,
    snapshot: sectionSnapshot(updated),
    createdByUserId: input.actorUserId ?? null,
    changeNote: input.changeNote ?? "Konfiguration aktualisiert",
    isRestore: input.isRestore ?? false,
    parentRevisionId: input.parentRevisionId ?? null,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Toggle isEnabled
// ---------------------------------------------------------------------------

export async function togglePageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  _actorUserId?: string | null,
): Promise<PageSectionAdminItem | null> {
  const row = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: adminSelect,
  });
  if (!row) return null;

  const updated = await prisma.websitePageSection.update({
    where: { id: sectionId },
    data: { isEnabled: !row.isEnabled },
    select: adminSelect,
  });
  return mapRow(updated);
}

// ---------------------------------------------------------------------------
// Move (up / down)
// ---------------------------------------------------------------------------

/**
 * Swaps the sortOrder of the given section with its immediate neighbour.
 * Returns the full updated section list after the swap, or null if the
 * section is not found or is already at the boundary.
 */
export async function movePageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  direction: "up" | "down",
): Promise<PageSectionAdminItem[] | null> {
  const all = await prisma.websitePageSection.findMany({
    where: { tenantId, pageId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminSelect,
  });

  const idx = all.findIndex((s) => s.id === sectionId);
  if (idx === -1) return null;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) {
    return all.map(mapRow);
  }

  const current = all[idx];
  const swap = all[swapIdx];

  await prisma.$transaction([
    prisma.websitePageSection.update({
      where: { id: current.id },
      data: { sortOrder: swap.sortOrder },
    }),
    prisma.websitePageSection.update({
      where: { id: swap.id },
      data: { sortOrder: current.sortOrder },
    }),
  ]);

  return listPageSections(tenantId, pageId);
}

// ---------------------------------------------------------------------------
// Bulk reorder (for drag-and-drop)
// ---------------------------------------------------------------------------

/**
 * Accepts a new ordered array of section IDs for a page.
 * Reassigns sortOrder = index * 10 for each section.
 * All IDs must belong to the given page and tenant.
 * Returns the updated section list, or null if any ID is invalid.
 */
export async function reorderPageSections(
  tenantId: string,
  pageId: string,
  orderedIds: string[],
): Promise<PageSectionAdminItem[] | null> {
  const existing = await prisma.websitePageSection.findMany({
    where: { tenantId, pageId },
    select: { id: true },
  });

  const existingIds = new Set(existing.map((s) => s.id));
  // Reject any unknown IDs (protects tenant + page isolation)
  if (orderedIds.some((id) => !existingIds.has(id))) return null;
  // Reject duplicates within the ordered list
  if (new Set(orderedIds).size !== orderedIds.length) return null;
  // Reject if not exactly the same count as existing sections
  if (orderedIds.length !== existingIds.size) return null;

  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.websitePageSection.update({
        where: { id },
        data: { sortOrder: idx * 10 },
      }),
    ),
  );

  return listPageSections(tenantId, pageId);
}

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------

/**
 * Creates a copy of a section appended at the end of the page.
 * The duplicate starts with the same type, config, and label (with " (Kopie)" suffix).
 * Returns the newly created section.
 */
export async function duplicatePageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  actorUserId?: string | null,
): Promise<PageSectionAdminItem | null> {
  const source = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: adminSelect,
  });
  if (!source) return null;

  const last = await prisma.websitePageSection.findFirst({
    where: { tenantId, pageId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -10) + 10;

  const row = await prisma.websitePageSection.create({
    data: {
      tenantId,
      pageId,
      type: source.type,
      label: `${source.label} (Kopie)`,
      config: source.config as Prisma.InputJsonValue,
      sortOrder,
      isEnabled: false,
      publishStatus: SECTION_PUBLISH_STATUS.DRAFT,
      approvalStatus: SECTION_APPROVAL_STATUS.NOT_REQUIRED,
    },
    select: adminSelect,
  });

  const section = mapRow(row);

  void captureRevision({
    tenantId,
    entityType: "WebsitePageSection",
    entityId: section.id,
    snapshot: sectionSnapshot(section),
    createdByUserId: actorUserId ?? null,
    changeNote: `Kopie von Sektion ${sectionId}`,
  });

  return section;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deletePageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  actorUserId?: string | null,
): Promise<boolean> {
  const existing = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: adminSelect,
  });
  if (!existing) return false;

  void logAction({
    actorUserId: actorUserId ?? null,
    moduleKey: "page-sections",
    entityType: "WebsitePageSection",
    entityId: sectionId,
    action: "DELETE",
    beforeJson: sectionSnapshot(mapRow(existing)),
    metadataJson: { tenantId, pageId },
  });

  await prisma.websitePageSection.delete({ where: { id: sectionId } });
  return true;
}

// ---------------------------------------------------------------------------
// Publishing workflow (CMS V2 Slice 9)
// ---------------------------------------------------------------------------

/**
 * Publishes a page section.
 * Sets publishStatus=PUBLISHED, records publishedAt and lastPublishedAt.
 * Clears any pending scheduledPublishAt (the section is already live).
 * Clears publishUntil if in the past.
 *
 * Approval gate: only APPROVED or NOT_REQUIRED sections may be published.
 */
export async function publishPageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  actorUserId?: string | null,
): Promise<PageSectionAdminItem | null | ApprovalGateError> {
  const existing = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: { id: true, approvalStatus: true },
  });
  if (!existing) return null;

  const approvalStatus = existing.approvalStatus as SectionApprovalStatus;
  if (!APPROVAL_PUBLISH_ALLOWED_STATUSES.has(approvalStatus)) {
    return { blocked: true, approvalStatus };
  }

  const now = new Date();
  const row = await prisma.websitePageSection.update({
    where: { id: sectionId },
    data: {
      publishStatus: SECTION_PUBLISH_STATUS.PUBLISHED,
      publishedAt: now,
      lastPublishedAt: now,
      scheduledPublishAt: null,
    },
    select: adminSelect,
  });

  void logAction({
    actorUserId: actorUserId ?? null,
    moduleKey: "page-sections",
    entityType: "WebsitePageSection",
    entityId: sectionId,
    action: "PUBLISH",
    afterJson: { publishStatus: SECTION_PUBLISH_STATUS.PUBLISHED },
    metadataJson: { tenantId, pageId },
  });

  return mapRow(row);
}

/**
 * Unpublishes a page section.
 * Sets publishStatus=DRAFT, records unpublishedAt.
 * Retains lastPublishedAt for the audit trail.
 */
export async function unpublishPageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  actorUserId?: string | null,
): Promise<PageSectionAdminItem | null> {
  const existing = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.websitePageSection.update({
    where: { id: sectionId },
    data: {
      publishStatus: SECTION_PUBLISH_STATUS.DRAFT,
      unpublishedAt: new Date(),
      scheduledPublishAt: null,
    },
    select: adminSelect,
  });

  void logAction({
    actorUserId: actorUserId ?? null,
    moduleKey: "page-sections",
    entityType: "WebsitePageSection",
    entityId: sectionId,
    action: "UNPUBLISH",
    afterJson: { publishStatus: SECTION_PUBLISH_STATUS.DRAFT },
    metadataJson: { tenantId, pageId },
  });

  return mapRow(row);
}

/**
 * Schedules a future publish for a page section.
 * Approval gate: only APPROVED or NOT_REQUIRED sections may be scheduled.
 */
export async function schedulePageSectionPublish(
  tenantId: string,
  pageId: string,
  sectionId: string,
  scheduledPublishAt: Date,
  publishUntil?: Date | null,
  actorUserId?: string | null,
): Promise<PageSectionAdminItem | null | ApprovalGateError> {
  const existing = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: { id: true, approvalStatus: true },
  });
  if (!existing) return null;

  const approvalStatus = existing.approvalStatus as SectionApprovalStatus;
  if (!APPROVAL_PUBLISH_ALLOWED_STATUSES.has(approvalStatus)) {
    return { blocked: true, approvalStatus };
  }

  const row = await prisma.websitePageSection.update({
    where: { id: sectionId },
    data: {
      publishStatus: SECTION_PUBLISH_STATUS.DRAFT,
      scheduledPublishAt,
      ...(publishUntil !== undefined ? { publishUntil: publishUntil ?? null } : {}),
    },
    select: adminSelect,
  });

  void logAction({
    actorUserId: actorUserId ?? null,
    moduleKey: "page-sections",
    entityType: "WebsitePageSection",
    entityId: sectionId,
    action: "SCHEDULE",
    afterJson: { scheduledPublishAt, publishUntil },
    metadataJson: { tenantId, pageId },
  });

  return mapRow(row);
}

// ---------------------------------------------------------------------------
// Approval workflow (CMS V2 Slice 9)
// ---------------------------------------------------------------------------

/**
 * Requests editorial review for a section.
 * Allowed from all states except IN_REVIEW (idempotent guard).
 */
export async function requestReviewPageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  actorUserId: string,
  reviewerUserId?: string | null,
): Promise<PageSectionAdminItem | null | "already_in_review"> {
  const existing = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: { id: true, approvalStatus: true, label: true },
  });
  if (!existing) return null;

  if (existing.approvalStatus === SECTION_APPROVAL_STATUS.IN_REVIEW) {
    return "already_in_review";
  }

  const prevStatus = existing.approvalStatus as SectionApprovalStatus;
  const now = new Date();

  if (reviewerUserId) {
    const reviewerExists = await prisma.user.findFirst({
      where: { id: reviewerUserId, tenantId },
      select: { id: true },
    });
    if (!reviewerExists) reviewerUserId = null;
  }

  const row = await prisma.websitePageSection.update({
    where: { id: sectionId },
    data: {
      approvalStatus: SECTION_APPROVAL_STATUS.IN_REVIEW,
      reviewRequestedAt: now,
      ...(reviewerUserId !== undefined
        ? { reviewerUserId: reviewerUserId ?? null }
        : {}),
      rejectedAt: null,
      rejectedByUserId: null,
    },
    select: adminSelect,
  });

  void logAction({
    actorUserId,
    moduleKey: "page-sections",
    entityType: "WebsitePageSection",
    entityId: sectionId,
    action: "APPROVAL_REQUEST",
    beforeJson: { approvalStatus: prevStatus },
    afterJson: { approvalStatus: SECTION_APPROVAL_STATUS.IN_REVIEW },
    metadataJson: { tenantId, pageId, label: existing.label, reviewerUserId },
  });

  return mapRow(row);
}

/**
 * Approves a page section. Allowed only when IN_REVIEW.
 */
export async function approvePageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  actorUserId: string,
  note?: string | null,
): Promise<PageSectionAdminItem | null | "not_in_review"> {
  const existing = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: { id: true, approvalStatus: true, label: true },
  });
  if (!existing) return null;

  if (existing.approvalStatus !== SECTION_APPROVAL_STATUS.IN_REVIEW) {
    return "not_in_review";
  }

  const now = new Date();
  const row = await prisma.websitePageSection.update({
    where: { id: sectionId },
    data: {
      approvalStatus: SECTION_APPROVAL_STATUS.APPROVED,
      approvedAt: now,
      reviewedAt: now,
      approvedByUserId: actorUserId,
      approvalNote: note ?? null,
      rejectedAt: null,
      rejectedByUserId: null,
    },
    select: adminSelect,
  });

  void logAction({
    actorUserId,
    moduleKey: "page-sections",
    entityType: "WebsitePageSection",
    entityId: sectionId,
    action: "APPROVE",
    beforeJson: { approvalStatus: SECTION_APPROVAL_STATUS.IN_REVIEW },
    afterJson: { approvalStatus: SECTION_APPROVAL_STATUS.APPROVED },
    metadataJson: { tenantId, pageId, label: existing.label, note },
  });

  return mapRow(row);
}

/**
 * Rejects (requests changes for) a page section. Allowed only when IN_REVIEW.
 */
export async function rejectPageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  actorUserId: string,
  note?: string | null,
): Promise<PageSectionAdminItem | null | "not_in_review"> {
  const existing = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: { id: true, approvalStatus: true, label: true },
  });
  if (!existing) return null;

  if (existing.approvalStatus !== SECTION_APPROVAL_STATUS.IN_REVIEW) {
    return "not_in_review";
  }

  const now = new Date();
  const row = await prisma.websitePageSection.update({
    where: { id: sectionId },
    data: {
      approvalStatus: SECTION_APPROVAL_STATUS.CHANGES_REQUESTED,
      rejectedAt: now,
      reviewedAt: now,
      rejectedByUserId: actorUserId,
      approvalNote: note ?? null,
      approvedAt: null,
      approvedByUserId: null,
    },
    select: adminSelect,
  });

  void logAction({
    actorUserId,
    moduleKey: "page-sections",
    entityType: "WebsitePageSection",
    entityId: sectionId,
    action: "REJECT",
    beforeJson: { approvalStatus: SECTION_APPROVAL_STATUS.IN_REVIEW },
    afterJson: { approvalStatus: SECTION_APPROVAL_STATUS.CHANGES_REQUESTED },
    metadataJson: { tenantId, pageId, label: existing.label, note },
  });

  return mapRow(row);
}

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

export async function archivePageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  actorUserId?: string | null,
): Promise<PageSectionAdminItem | null> {
  const existing = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.websitePageSection.update({
    where: { id: sectionId },
    data: {
      isEnabled: false,
      publishStatus: SECTION_PUBLISH_STATUS.DRAFT,
    },
    select: adminSelect,
  });

  void logAction({
    actorUserId: actorUserId ?? null,
    moduleKey: "page-sections",
    entityType: "WebsitePageSection",
    entityId: sectionId,
    action: "ARCHIVE",
    metadataJson: { tenantId, pageId },
  });

  return mapRow(row);
}

// ---------------------------------------------------------------------------
// Preview (admin-only: all sections regardless of publishStatus)
// ---------------------------------------------------------------------------

/**
 * Returns all sections for a page for admin preview purposes.
 * Ignores publishStatus — returns both DRAFT and PUBLISHED sections.
 * Used by the admin preview panel; never exposed publicly.
 */
export async function getPageSectionsForPreview(
  tenantId: string,
  pageId: string,
): Promise<PageSectionAdminItem[]> {
  const rows = await prisma.websitePageSection.findMany({
    where: { tenantId, pageId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminSelect,
  });
  return rows.map(mapRow);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sectionSnapshot(section: PageSectionAdminItem): Record<string, unknown> {
  return {
    id: section.id,
    type: section.type,
    label: section.label,
    sortOrder: section.sortOrder,
    isEnabled: section.isEnabled,
    config: section.config,
    publishStatus: section.publishStatus,
    approvalStatus: section.approvalStatus,
    updatedAt: section.updatedAt,
  };
}
