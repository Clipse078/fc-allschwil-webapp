/**
 * lib/website-redirects/queries.ts
 *
 * Query helpers for WebsiteRedirect — tenant-scoped HTTP redirect rules.
 * Introduced in CMS V4.2 (Website Platform UX Unification).
 *
 * All functions are tenant-scoped; tenantId is always resolved from the
 * session, never from the request body, for cross-tenant isolation.
 */

import { prisma } from "@/lib/db/prisma";

// ── Shape ─────────────────────────────────────────────────────────────────────

export type WebsiteRedirectItem = {
  id: string;
  tenantId: string;
  fromPath: string;
  toPath: string;
  isPermanent: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const redirectSelect = {
  id: true,
  tenantId: true,
  fromPath: true,
  toPath: true,
  isPermanent: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ── List ──────────────────────────────────────────────────────────────────────

export async function listWebsiteRedirects(tenantId: string): Promise<WebsiteRedirectItem[]> {
  return prisma.websiteRedirect.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: redirectSelect,
  });
}

// ── Get one ───────────────────────────────────────────────────────────────────

export async function getWebsiteRedirect(
  tenantId: string,
  id: string,
): Promise<WebsiteRedirectItem | null> {
  return prisma.websiteRedirect.findFirst({
    where: { id, tenantId },
    select: redirectSelect,
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

export type CreateWebsiteRedirectInput = {
  fromPath: string;
  toPath: string;
  isPermanent?: boolean;
  isActive?: boolean;
};

export async function createWebsiteRedirect(
  tenantId: string,
  input: CreateWebsiteRedirectInput,
): Promise<WebsiteRedirectItem> {
  return prisma.websiteRedirect.create({
    data: {
      tenantId,
      fromPath: input.fromPath.trim(),
      toPath: input.toPath.trim(),
      isPermanent: input.isPermanent ?? true,
      isActive: input.isActive ?? true,
    },
    select: redirectSelect,
  });
}

// ── Update ────────────────────────────────────────────────────────────────────

export type UpdateWebsiteRedirectInput = Partial<CreateWebsiteRedirectInput>;

export async function updateWebsiteRedirect(
  tenantId: string,
  id: string,
  input: UpdateWebsiteRedirectInput,
): Promise<WebsiteRedirectItem | null> {
  const existing = await prisma.websiteRedirect.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.websiteRedirect.update({
    where: { id },
    data: {
      ...(input.fromPath !== undefined ? { fromPath: input.fromPath.trim() } : {}),
      ...(input.toPath !== undefined ? { toPath: input.toPath.trim() } : {}),
      ...(input.isPermanent !== undefined ? { isPermanent: input.isPermanent } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: redirectSelect,
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteWebsiteRedirect(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.websiteRedirect.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.websiteRedirect.delete({ where: { id } });
  return true;
}

// ── Active redirects for public middleware ────────────────────────────────────

export type ActiveRedirect = {
  fromPath: string;
  toPath: string;
  isPermanent: boolean;
};

export async function getActiveRedirects(tenantId: string): Promise<ActiveRedirect[]> {
  return prisma.websiteRedirect.findMany({
    where: { tenantId, isActive: true },
    select: { fromPath: true, toPath: true, isPermanent: true },
    orderBy: { createdAt: "asc" },
  });
}
