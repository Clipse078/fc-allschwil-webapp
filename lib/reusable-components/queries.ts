/**
 * lib/reusable-components/queries.ts
 *
 * Server-side query layer for the Reusable Component Library (CMS V2 Slice 12).
 *
 * All functions are tenant-scoped. Callers must supply tenantId from the
 * authenticated session — never from request body.
 *
 * Publishing and approval follow the same pattern as HomepageSection /
 * WebsitePageSection (lib/cms/section-publishing.ts).
 *
 * Revisions are tracked via ContentRevision (entityType = "ReusableComponent").
 * Usage is tracked via ReusableComponentUsage.
 * Audit events use moduleKey = "reusable-components".
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
} from "@/lib/cms/section-publishing";
import type {
  ReusableComponentAdminItem,
  ReusableComponentUsageItem,
  ListReusableComponentsFilter,
  CreateReusableComponentInput,
  UpdateReusableComponentInput,
} from "./types";
import { getDefaultConfig } from "./component-types";
import type { ReusableComponentType } from "./component-types";

export {
  SECTION_PUBLISH_STATUS,
  SECTION_APPROVAL_STATUS,
  APPROVAL_PUBLISH_ALLOWED_STATUSES,
};

// ---------------------------------------------------------------------------
// Select shape
// ---------------------------------------------------------------------------

const adminSelect = {
  id: true,
  tenantId: true,
  type: true,
  title: true,
  slug: true,
  description: true,
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
  createdByUserId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ReusableComponentSelect;

const adminSelectWithUsers = {
  ...adminSelect,
  createdByUser: { select: { firstName: true, lastName: true } },
  approvedByUser: { select: { firstName: true, lastName: true } },
} as const satisfies Prisma.ReusableComponentSelect;

function mapRow(
  row: Prisma.ReusableComponentGetPayload<{ select: typeof adminSelect }>,
): ReusableComponentAdminItem {
  return {
    ...row,
    config:
      row.config !== null && typeof row.config === "object"
        ? (row.config as Record<string, unknown>)
        : {},
    publishStatus: (row.publishStatus as SectionPublishStatus) ?? SECTION_PUBLISH_STATUS.DRAFT,
    approvalStatus: (row.approvalStatus as SectionApprovalStatus) ?? SECTION_APPROVAL_STATUS.NOT_REQUIRED,
  };
}

function mapRowWithUsers(
  row: Prisma.ReusableComponentGetPayload<{ select: typeof adminSelectWithUsers }>,
): ReusableComponentAdminItem {
  return {
    ...mapRow(row as Prisma.ReusableComponentGetPayload<{ select: typeof adminSelect }>),
    createdByUser: (row as { createdByUser?: { firstName: string; lastName: string } | null }).createdByUser ?? null,
    approvedByUser: (row as { approvedByUser?: { firstName: string; lastName: string } | null }).approvedByUser ?? null,
  };
}

// ---------------------------------------------------------------------------
// Slug generation helper
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function ensureUniqueSlug(tenantId: string, base: string, excludeId?: string): Promise<string> {
  const candidate = base || "component";
  let suffix = 0;
  while (true) {
    const slug = suffix === 0 ? candidate : `${candidate}-${suffix}`;
    const existing = await prisma.reusableComponent.findFirst({
      where: { tenantId, slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return slug;
    suffix++;
  }
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * Lists reusable components for a tenant with optional filtering.
 * Excludes archived components by default.
 */
export async function listReusableComponents(
  tenantId: string,
  filter: ListReusableComponentsFilter = {},
): Promise<ReusableComponentAdminItem[]> {
  const {
    type,
    publishStatus,
    includeArchived = false,
    search,
    limit = 200,
    offset = 0,
  } = filter;

  const where: Prisma.ReusableComponentWhereInput = {
    tenantId,
    ...(includeArchived ? {} : { archivedAt: null }),
    ...(type ? { type } : {}),
    ...(publishStatus ? { publishStatus } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.reusableComponent.findMany({
    where,
    select: adminSelectWithUsers,
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
    skip: offset,
  });

  return rows.map(mapRowWithUsers);
}

// ---------------------------------------------------------------------------
// Get single
// ---------------------------------------------------------------------------

/**
 * Returns a single component by id, tenant-scoped.
 * Returns null when not found or belongs to a different tenant.
 */
export async function getReusableComponent(
  tenantId: string,
  id: string,
): Promise<ReusableComponentAdminItem | null> {
  const row = await prisma.reusableComponent.findFirst({
    where: { id, tenantId },
    select: adminSelectWithUsers,
  });
  return row ? mapRowWithUsers(row) : null;
}

// ---------------------------------------------------------------------------
// Get by slug (for rendering)
// ---------------------------------------------------------------------------

/**
 * Returns a published component by slug for public rendering.
 * Only returns components with publishStatus = "PUBLISHED".
 */
export async function getReusableComponentBySlug(
  tenantId: string,
  slug: string,
): Promise<ReusableComponentAdminItem | null> {
  const row = await prisma.reusableComponent.findFirst({
    where: {
      tenantId,
      slug,
      publishStatus: SECTION_PUBLISH_STATUS.PUBLISHED,
      archivedAt: null,
    },
    select: adminSelect,
  });
  return row ? mapRow(row) : null;
}

// ---------------------------------------------------------------------------
// Render helper (public-facing, resolves latest published version)
// ---------------------------------------------------------------------------

/**
 * Resolves a componentId to its published config for embedding in pages.
 * Returns null when the component does not exist or is not published.
 */
export async function renderReusableComponent(
  tenantId: string,
  componentId: string,
): Promise<{ type: string; config: Record<string, unknown> } | null> {
  const row = await prisma.reusableComponent.findFirst({
    where: {
      id: componentId,
      tenantId,
      publishStatus: SECTION_PUBLISH_STATUS.PUBLISHED,
      archivedAt: null,
    },
    select: { type: true, config: true },
  });
  if (!row) return null;
  return {
    type: row.type,
    config:
      row.config !== null && typeof row.config === "object"
        ? (row.config as Record<string, unknown>)
        : {},
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createReusableComponent(
  tenantId: string,
  input: CreateReusableComponentInput,
): Promise<ReusableComponentAdminItem> {
  const baseSlug = input.slug
    ? slugify(input.slug)
    : slugify(input.title);
  const slug = await ensureUniqueSlug(tenantId, baseSlug);

  const defaultConfig = getDefaultConfig(input.type as ReusableComponentType);
  const config = { ...defaultConfig, ...(input.config ?? {}) };

  const row = await prisma.reusableComponent.create({
    data: {
      tenantId,
      type: input.type,
      title: input.title,
      slug,
      description: input.description ?? null,
      config: config as Prisma.InputJsonValue,
      publishStatus: SECTION_PUBLISH_STATUS.DRAFT,
      approvalStatus: SECTION_APPROVAL_STATUS.NOT_REQUIRED,
      createdByUserId: input.createdByUserId ?? null,
    },
    select: adminSelectWithUsers,
  });

  const mapped = mapRowWithUsers(row);

  await Promise.all([
    captureRevision({
      tenantId,
      entityType: "ReusableComponent",
      entityId: row.id,
      snapshot: mapped as unknown as Record<string, unknown>,
      createdByUserId: input.createdByUserId,
      changeNote: "Erstellt",
    }),
    logAction({
      actorUserId: input.createdByUserId,
      moduleKey: "reusable-components",
      entityType: "ReusableComponent",
      entityId: row.id,
      action: "CREATE",
      afterJson: mapped,
    }),
  ]);

  return mapped;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateReusableComponent(
  tenantId: string,
  id: string,
  input: UpdateReusableComponentInput,
  actorUserId?: string,
): Promise<ReusableComponentAdminItem | null> {
  const existing = await prisma.reusableComponent.findFirst({
    where: { id, tenantId },
    select: adminSelect,
  });
  if (!existing) return null;

  const before = mapRow(existing);

  const updateData: Prisma.ReusableComponentUpdateInput = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.config !== undefined) updateData.config = input.config as Prisma.InputJsonValue;

  if (input.slug !== undefined) {
    const base = slugify(input.slug);
    updateData.slug = await ensureUniqueSlug(tenantId, base, id);
  } else if (input.title !== undefined && !input.slug) {
    // Do not auto-regenerate slug on title update — slug is stable once set.
  }

  const row = await prisma.reusableComponent.update({
    where: { id },
    data: updateData,
    select: adminSelectWithUsers,
  });

  const after = mapRowWithUsers(row);

  await Promise.all([
    captureRevision({
      tenantId,
      entityType: "ReusableComponent",
      entityId: id,
      snapshot: after as unknown as Record<string, unknown>,
      createdByUserId: actorUserId,
      changeNote: "Aktualisiert",
    }),
    logAction({
      actorUserId,
      moduleKey: "reusable-components",
      entityType: "ReusableComponent",
      entityId: id,
      action: "UPDATE",
      beforeJson: before,
      afterJson: after,
    }),
  ]);

  return after;
}

// ---------------------------------------------------------------------------
// Publish / Unpublish
// ---------------------------------------------------------------------------

export async function publishReusableComponent(
  tenantId: string,
  id: string,
  actorUserId?: string,
): Promise<ReusableComponentAdminItem | null> {
  const existing = await prisma.reusableComponent.findFirst({
    where: { id, tenantId },
    select: { approvalStatus: true },
  });
  if (!existing) return null;

  const approvalStatus = existing.approvalStatus as SectionApprovalStatus;
  if (!APPROVAL_PUBLISH_ALLOWED_STATUSES.has(approvalStatus)) {
    return null; // Blocked by approval gate
  }

  const now = new Date();
  const row = await prisma.reusableComponent.update({
    where: { id },
    data: {
      publishStatus: SECTION_PUBLISH_STATUS.PUBLISHED,
      publishedAt: now,
      lastPublishedAt: now,
      scheduledPublishAt: null,
    },
    select: adminSelectWithUsers,
  });

  const after = mapRowWithUsers(row);
  await logAction({
    actorUserId,
    moduleKey: "reusable-components",
    entityType: "ReusableComponent",
    entityId: id,
    action: "PUBLISH",
    afterJson: after,
  });

  return after;
}

export async function unpublishReusableComponent(
  tenantId: string,
  id: string,
  actorUserId?: string,
): Promise<ReusableComponentAdminItem | null> {
  const existing = await prisma.reusableComponent.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.reusableComponent.update({
    where: { id },
    data: {
      publishStatus: SECTION_PUBLISH_STATUS.DRAFT,
      unpublishedAt: new Date(),
    },
    select: adminSelectWithUsers,
  });

  const after = mapRowWithUsers(row);
  await logAction({
    actorUserId,
    moduleKey: "reusable-components",
    entityType: "ReusableComponent",
    entityId: id,
    action: "UNPUBLISH",
    afterJson: after,
  });

  return after;
}

// ---------------------------------------------------------------------------
// Approval workflow
// ---------------------------------------------------------------------------

export type WorkflowAction =
  | "request-review"
  | "approve"
  | "reject"
  | "reset-to-draft";

export async function applyWorkflowAction(
  tenantId: string,
  id: string,
  action: WorkflowAction,
  actorUserId?: string,
  note?: string,
): Promise<ReusableComponentAdminItem | null> {
  const existing = await prisma.reusableComponent.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const now = new Date();
  let data: Prisma.ReusableComponentUncheckedUpdateInput = {};

  switch (action) {
    case "request-review":
      data = {
        approvalStatus: SECTION_APPROVAL_STATUS.IN_REVIEW,
        reviewRequestedAt: now,
        reviewerUserId: actorUserId ?? null,
      };
      break;
    case "approve":
      data = {
        approvalStatus: SECTION_APPROVAL_STATUS.APPROVED,
        approvedAt: now,
        reviewedAt: now,
        approvedByUserId: actorUserId ?? null,
        approvalNote: note ?? null,
      };
      break;
    case "reject":
      data = {
        approvalStatus: SECTION_APPROVAL_STATUS.CHANGES_REQUESTED,
        rejectedAt: now,
        reviewedAt: now,
        rejectedByUserId: actorUserId ?? null,
        approvalNote: note ?? null,
      };
      break;
    case "reset-to-draft":
      data = {
        approvalStatus: SECTION_APPROVAL_STATUS.DRAFT,
      };
      break;
  }

  const row = await prisma.reusableComponent.update({
    where: { id },
    data,
    select: adminSelectWithUsers,
  });

  const after = mapRowWithUsers(row);
  await logAction({
    actorUserId,
    moduleKey: "reusable-components",
    entityType: "ReusableComponent",
    entityId: id,
    action: action.toUpperCase().replace(/-/g, "_"),
    afterJson: after,
    metadataJson: note ? { note } : undefined,
  });

  return after;
}

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------

/**
 * Creates a copy of a component as a new DRAFT.
 * The duplicate gets a new slug, title suffixed with " (Kopie)", and no publishing state.
 */
export async function duplicateReusableComponent(
  tenantId: string,
  id: string,
  actorUserId?: string,
): Promise<ReusableComponentAdminItem | null> {
  const source = await prisma.reusableComponent.findFirst({
    where: { id, tenantId },
    select: adminSelect,
  });
  if (!source) return null;

  const copyTitle = `${source.title} (Kopie)`;
  const baseSlug = slugify(copyTitle);
  const slug = await ensureUniqueSlug(tenantId, baseSlug);

  const row = await prisma.reusableComponent.create({
    data: {
      tenantId,
      type: source.type,
      title: copyTitle,
      slug,
      description: source.description,
      config: source.config as Prisma.InputJsonValue,
      publishStatus: SECTION_PUBLISH_STATUS.DRAFT,
      approvalStatus: SECTION_APPROVAL_STATUS.NOT_REQUIRED,
      createdByUserId: actorUserId ?? null,
    },
    select: adminSelectWithUsers,
  });

  const mapped = mapRowWithUsers(row);

  await Promise.all([
    captureRevision({
      tenantId,
      entityType: "ReusableComponent",
      entityId: row.id,
      snapshot: mapped as unknown as Record<string, unknown>,
      createdByUserId: actorUserId,
      changeNote: `Dupliziert von ${id}`,
    }),
    logAction({
      actorUserId,
      moduleKey: "reusable-components",
      entityType: "ReusableComponent",
      entityId: row.id,
      action: "DUPLICATE",
      afterJson: { ...mapped, sourceId: id },
    }),
  ]);

  return mapped;
}

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

export async function archiveReusableComponent(
  tenantId: string,
  id: string,
  actorUserId?: string,
): Promise<ReusableComponentAdminItem | null> {
  const existing = await prisma.reusableComponent.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.reusableComponent.update({
    where: { id },
    data: {
      archivedAt: new Date(),
      publishStatus: SECTION_PUBLISH_STATUS.DRAFT,
    },
    select: adminSelectWithUsers,
  });

  const after = mapRowWithUsers(row);
  await logAction({
    actorUserId,
    moduleKey: "reusable-components",
    entityType: "ReusableComponent",
    entityId: id,
    action: "ARCHIVE",
    afterJson: after,
  });

  return after;
}

export async function unarchiveReusableComponent(
  tenantId: string,
  id: string,
  actorUserId?: string,
): Promise<ReusableComponentAdminItem | null> {
  const existing = await prisma.reusableComponent.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.reusableComponent.update({
    where: { id },
    data: { archivedAt: null },
    select: adminSelectWithUsers,
  });

  const after = mapRowWithUsers(row);
  await logAction({
    actorUserId,
    moduleKey: "reusable-components",
    entityType: "ReusableComponent",
    entityId: id,
    action: "UNARCHIVE",
    afterJson: after,
  });

  return after;
}

// ---------------------------------------------------------------------------
// Usage tracking
// ---------------------------------------------------------------------------

type UpsertUsageInput = {
  tenantId: string;
  componentId: string;
  entityType: string;
  entityId: string;
  fieldPath?: string;
};

export async function upsertComponentUsage(input: UpsertUsageInput): Promise<void> {
  const fieldPath = input.fieldPath ?? "config";
  const existing = await prisma.reusableComponentUsage.findFirst({
    where: {
      componentId: input.componentId,
      entityType: input.entityType,
      entityId: input.entityId,
      fieldPath,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.reusableComponentUsage.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
  } else {
    const id = `rcu${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    await prisma.reusableComponentUsage.create({
      data: {
        id,
        tenantId: input.tenantId,
        componentId: input.componentId,
        entityType: input.entityType,
        entityId: input.entityId,
        fieldPath,
      },
    });
  }
}

export async function deleteComponentUsage(
  componentId: string,
  entityType: string,
  entityId: string,
  fieldPath?: string,
): Promise<void> {
  await prisma.reusableComponentUsage.deleteMany({
    where: { componentId, entityType, entityId, fieldPath: fieldPath ?? "config" },
  });
}

export async function getComponentUsage(
  tenantId: string,
  componentId: string,
): Promise<ReusableComponentUsageItem[]> {
  const rows = await prisma.reusableComponentUsage.findMany({
    where: { tenantId, componentId },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    fieldPath: r.fieldPath,
    createdAt: r.createdAt,
    label: formatUsageLabel(r.entityType, r.entityId),
    href: formatUsageHref(r.entityType, r.entityId),
  }));
}

function formatUsageLabel(entityType: string, entityId: string): string {
  const labels: Record<string, string> = {
    HomepageSection:    "Homepage-Sektion",
    WebsitePageSection: "Seitenbereich",
    WebsitePage:        "Website-Seite",
    NewsArticle:        "News-Artikel",
    Event:              "Event",
  };
  return `${labels[entityType] ?? entityType} (${entityId.slice(0, 8)}…)`;
}

function formatUsageHref(entityType: string, entityId: string): string | undefined {
  if (entityType === "HomepageSection") return "/dashboard/website/homepage";
  if (entityType === "WebsitePage") return `/dashboard/website/pages/${entityId}/edit`;
  if (entityType === "NewsArticle") return `/dashboard/website/news/${entityId}/edit`;
  if (entityType === "WebsitePageSection") return undefined;
  return undefined;
}

// ---------------------------------------------------------------------------
// Usage count (lightweight, for library list view)
// ---------------------------------------------------------------------------

export async function getComponentUsageCounts(
  tenantId: string,
  componentIds: string[],
): Promise<Record<string, number>> {
  if (componentIds.length === 0) return {};

  const rows = await prisma.reusableComponentUsage.groupBy({
    by: ["componentId"],
    where: { tenantId, componentId: { in: componentIds } },
    _count: { componentId: true },
  });

  return Object.fromEntries(rows.map((r) => [r.componentId, r._count.componentId]));
}
