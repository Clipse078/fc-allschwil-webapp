/**
 * Website Pages — Admin query layer.
 *
 * All queries are tenant-scoped. Callers must verify the tenantId
 * from the authenticated session before passing it here.
 *
 * Mirrors lib/news/admin-queries.ts for the WebsitePage model.
 */

import { prisma } from "@/lib/db/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PageStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "SCHEDULED"
  | "PUBLISHED"
  | "ARCHIVED";

export type WebsitePageAuthorPersonSnippet = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
} | null;

export type WebsitePageAdminListItem = {
  id: string;
  slug: string;
  title: string;
  status: PageStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  authorPersonId: string | null;
  reviewNotes: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  authorPerson: WebsitePageAuthorPersonSnippet;
};

export type WebsitePageAdminDetail = WebsitePageAdminListItem & {
  body: string;
};

// ── Select shapes ─────────────────────────────────────────────────────────────

const authorPersonSelect = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
} as const;

const adminListSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  publishedAt: true,
  scheduledAt: true,
  authorPersonId: true,
  reviewNotes: true,
  seoTitle: true,
  seoDescription: true,
  createdAt: true,
  updatedAt: true,
  authorPerson: { select: authorPersonSelect },
} as const;

const adminDetailSelect = {
  ...adminListSelect,
  body: true,
} as const;

// ── List ──────────────────────────────────────────────────────────────────────

export type ListWebsitePagesInput = {
  tenantId: string;
  status?: PageStatus;
  limit?: number;
  offset?: number;
};

export async function listWebsitePagesAdmin(
  input: ListWebsitePagesInput,
): Promise<WebsitePageAdminListItem[]> {
  const limit = Math.min(input.limit ?? 50, 200);
  const offset = input.offset ?? 0;

  const rows = await prisma.websitePage.findMany({
    where: {
      tenantId: input.tenantId,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
    skip: offset,
    select: adminListSelect,
  });

  return rows as unknown as WebsitePageAdminListItem[];
}

export async function countWebsitePagesAdmin(
  tenantId: string,
  status?: PageStatus,
): Promise<number> {
  return prisma.websitePage.count({
    where: { tenantId, ...(status ? { status } : {}) },
  });
}

// ── Detail ────────────────────────────────────────────────────────────────────

export async function getWebsitePageAdminById(
  tenantId: string,
  id: string,
): Promise<WebsitePageAdminDetail | null> {
  const row = await prisma.websitePage.findFirst({
    where: { id, tenantId },
    select: adminDetailSelect,
  });
  if (!row) return null;
  return row as unknown as WebsitePageAdminDetail;
}

export async function getWebsitePageAdminBySlug(
  tenantId: string,
  slug: string,
): Promise<WebsitePageAdminDetail | null> {
  const row = await prisma.websitePage.findFirst({
    where: { tenantId, slug },
    select: adminDetailSelect,
  });
  if (!row) return null;
  return row as unknown as WebsitePageAdminDetail;
}

// ── Slug availability ─────────────────────────────────────────────────────────

export async function isPageSlugAvailable(
  tenantId: string,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const existing = await prisma.websitePage.findFirst({
    where: {
      tenantId,
      slug,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !existing;
}

// ── Create ────────────────────────────────────────────────────────────────────

export type CreateWebsitePageInput = {
  tenantId: string;
  slug: string;
  title: string;
  body?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  scheduledAt?: Date | null;
  authorPersonId?: string | null;
};

export async function createWebsitePage(
  input: CreateWebsitePageInput,
): Promise<WebsitePageAdminDetail> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    tenantId: input.tenantId,
    slug: input.slug,
    title: input.title,
    body: input.body ?? "",
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
    scheduledAt: input.scheduledAt ?? null,
    authorPersonId: input.authorPersonId ?? null,
    status: "DRAFT",
  };

  const row = await prisma.websitePage.create({ data, select: adminDetailSelect });
  return row as unknown as WebsitePageAdminDetail;
}

// ── Update ────────────────────────────────────────────────────────────────────

export type UpdateWebsitePageInput = {
  slug?: string;
  title?: string;
  body?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  scheduledAt?: Date | null;
  authorPersonId?: string | null;
  reviewNotes?: string | null;
};

export async function updateWebsitePage(
  tenantId: string,
  id: string,
  input: UpdateWebsitePageInput,
): Promise<WebsitePageAdminDetail | null> {
  const existing = await prisma.websitePage.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, scheduledAt: true },
  });
  if (!existing) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  if (input.slug !== undefined) data.slug = input.slug;
  if (input.title !== undefined) data.title = input.title;
  if (input.body !== undefined) data.body = input.body;
  if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle;
  if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription;
  if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;
  if (input.authorPersonId !== undefined) {
    data.authorPerson = input.authorPersonId
      ? { connect: { id: input.authorPersonId } }
      : { disconnect: true };
  }
  if (input.reviewNotes !== undefined) data.reviewNotes = input.reviewNotes;

  // Auto-transition DRAFT → SCHEDULED when a future scheduledAt is set
  const effectiveScheduledAt =
    input.scheduledAt !== undefined ? input.scheduledAt : existing.scheduledAt;
  if (
    effectiveScheduledAt &&
    effectiveScheduledAt > new Date() &&
    (existing.status === "DRAFT" || existing.status === "IN_REVIEW")
  ) {
    data.status = "SCHEDULED";
  }
  // Clear SCHEDULED back to DRAFT if scheduledAt is removed
  if (input.scheduledAt === null && existing.status === "SCHEDULED") {
    data.status = "DRAFT";
  }

  const row = await prisma.websitePage.update({
    where: { id },
    data,
    select: adminDetailSelect,
  });
  return row as unknown as WebsitePageAdminDetail;
}

// ── Publish / Unpublish / Archive ─────────────────────────────────────────────

export async function publishWebsitePage(
  tenantId: string,
  id: string,
): Promise<WebsitePageAdminDetail | null> {
  const existing = await prisma.websitePage.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, scheduledAt: true },
  });
  if (!existing) return null;

  const now = new Date();
  const isScheduledForFuture = existing.scheduledAt && existing.scheduledAt > now;

  const row = await prisma.websitePage.update({
    where: { id },
    data: {
      status: isScheduledForFuture ? "SCHEDULED" : "PUBLISHED",
      ...(existing.status !== "PUBLISHED" && !isScheduledForFuture
        ? { publishedAt: now }
        : {}),
    },
    select: adminDetailSelect,
  });
  return row as unknown as WebsitePageAdminDetail;
}

export async function unpublishWebsitePage(
  tenantId: string,
  id: string,
): Promise<WebsitePageAdminDetail | null> {
  const existing = await prisma.websitePage.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.websitePage.update({
    where: { id },
    data: { status: "DRAFT" },
    select: adminDetailSelect,
  });
  return row as unknown as WebsitePageAdminDetail;
}

export async function archiveWebsitePage(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.websitePage.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.websitePage.update({ where: { id }, data: { status: "ARCHIVED" } });
  return true;
}

// ── Review workflow ───────────────────────────────────────────────────────────

export async function submitWebsitePageForReview(
  tenantId: string,
  id: string,
): Promise<WebsitePageAdminDetail | null> {
  const existing = await prisma.websitePage.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) return null;
  if (!["DRAFT", "ARCHIVED"].includes(existing.status)) return null;

  const row = await prisma.websitePage.update({
    where: { id },
    data: { status: "IN_REVIEW", reviewNotes: null },
    select: adminDetailSelect,
  });
  return row as unknown as WebsitePageAdminDetail;
}

export async function approveWebsitePage(
  tenantId: string,
  id: string,
): Promise<WebsitePageAdminDetail | null> {
  const existing = await prisma.websitePage.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, scheduledAt: true },
  });
  if (!existing) return null;

  const now = new Date();
  const isScheduledForFuture = existing.scheduledAt && existing.scheduledAt > now;

  const row = await prisma.websitePage.update({
    where: { id },
    data: {
      status: isScheduledForFuture ? "SCHEDULED" : "PUBLISHED",
      reviewNotes: null,
      ...(!isScheduledForFuture ? { publishedAt: now } : {}),
    },
    select: adminDetailSelect,
  });
  return row as unknown as WebsitePageAdminDetail;
}

export async function rejectWebsitePage(
  tenantId: string,
  id: string,
  notes?: string | null,
): Promise<WebsitePageAdminDetail | null> {
  const existing = await prisma.websitePage.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) return null;

  const row = await prisma.websitePage.update({
    where: { id },
    data: {
      status: "DRAFT",
      reviewNotes: notes ?? null,
    },
    select: adminDetailSelect,
  });
  return row as unknown as WebsitePageAdminDetail;
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteWebsitePage(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.websitePage.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.websitePage.delete({ where: { id } });
  return true;
}

// ── Slug generation helper ────────────────────────────────────────────────────

export function slugifyPage(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "seite"
  );
}
