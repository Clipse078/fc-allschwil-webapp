/**
 * Website Management Foundation — Data layer
 *
 * All queries are tenant-scoped. TenantId MUST be resolved from the session
 * before calling any function in this module.
 */

import { prisma } from "@/lib/db/prisma";
import type { WebsitePublishStatus, WebsiteSectionType } from "@prisma/client";

// ── Types ────────────────────────────────────────────────────────────────────

export type WebsiteSectionRow = {
  id: string;
  tenantId: string;
  sectionType: WebsiteSectionType;
  status: WebsitePublishStatus;
  label: string | null;
  sortOrder: number;
  isEnabled: boolean;
  lastPublishedAt: Date | null;
  lastPublishedByUserId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WebsiteConfigSummary = {
  websiteDomain: string | null;
  websiteEnabled: boolean;
  approvedDataOnly: boolean;
};

export type WebsiteStatusSummary = {
  tenantId: string;
  tenantName: string;
  config: WebsiteConfigSummary;
  sections: WebsiteSectionRow[];
  totalSections: number;
  publishedCount: number;
  approvedCount: number;
  draftCount: number;
  inReviewCount: number;
};

// ── Default sections seed helper ─────────────────────────────────────────────

/**
 * Canonical section definitions. Ordered by sortOrder for consistent display.
 * SPONSORS and CONTENT are preparatory stubs for future modules.
 */
export const WEBSITE_SECTION_DEFAULTS: Array<{
  sectionType: WebsiteSectionType;
  label: string;
  sortOrder: number;
}> = [
  { sectionType: "TEAMS", label: "Teams", sortOrder: 10 },
  { sectionType: "EVENTS", label: "Events", sortOrder: 20 },
  { sectionType: "WEEKPLAN", label: "Wochenplan", sortOrder: 30 },
  { sectionType: "NEWS", label: "News", sortOrder: 40 },
  { sectionType: "SPONSORS", label: "Sponsoren", sortOrder: 50 },
  { sectionType: "CONTENT", label: "Inhalte", sortOrder: 60 },
];

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns all WebsiteSection rows for the given tenant, ordered by sortOrder.
 * If no sections exist yet, seeds the defaults and returns them.
 */
export async function getWebsiteSections(tenantId: string): Promise<WebsiteSectionRow[]> {
  const existing = await prisma.websiteSection.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });

  if (existing.length > 0) return existing;

  // First access: seed default sections for this tenant
  await prisma.websiteSection.createMany({
    data: WEBSITE_SECTION_DEFAULTS.map((d) => ({
      tenantId,
      sectionType: d.sectionType,
      label: d.label,
      sortOrder: d.sortOrder,
    })),
    skipDuplicates: true,
  });

  return prisma.websiteSection.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Returns the tenant's website config fields.
 */
export async function getWebsiteConfig(tenantId: string): Promise<WebsiteConfigSummary | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      websiteDomain: true,
      websiteEnabled: true,
      approvedDataOnly: true,
    },
  });
  return tenant ?? null;
}

/**
 * Returns a full WebsiteStatusSummary for the tenant dashboard widget.
 */
export async function getWebsiteStatusSummary(tenantId: string): Promise<WebsiteStatusSummary | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      websiteDomain: true,
      websiteEnabled: true,
      approvedDataOnly: true,
    },
  });

  if (!tenant) return null;

  const sections = await getWebsiteSections(tenantId);

  const publishedCount = sections.filter((s) => s.status === "PUBLISHED").length;
  const approvedCount = sections.filter((s) => s.status === "APPROVED").length;
  const draftCount = sections.filter((s) => s.status === "DRAFT").length;
  const inReviewCount = sections.filter((s) => s.status === "IN_REVIEW").length;

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    config: {
      websiteDomain: tenant.websiteDomain,
      websiteEnabled: tenant.websiteEnabled,
      approvedDataOnly: tenant.approvedDataOnly,
    },
    sections,
    totalSections: sections.length,
    publishedCount,
    approvedCount,
    draftCount,
    inReviewCount,
  };
}

/**
 * Updates a single WebsiteSection's publish status and records a PublishedSnapshot.
 * Returns the updated section.
 */
export async function updateWebsiteSectionStatus(
  tenantId: string,
  sectionId: string,
  status: WebsitePublishStatus,
  publishedByUserId: string | null,
): Promise<WebsiteSectionRow> {
  const now = new Date();

  const [updated] = await prisma.$transaction([
    prisma.websiteSection.update({
      where: { id: sectionId, tenantId },
      data: {
        status,
        lastPublishedAt: status === "PUBLISHED" ? now : undefined,
        lastPublishedByUserId: status === "PUBLISHED" ? publishedByUserId : undefined,
        updatedAt: now,
      },
    }),
    prisma.publishedSnapshot.create({
      data: {
        tenantId,
        sectionId,
        status,
        publishedByUserId,
      },
    }),
  ]);

  return updated;
}

/**
 * Updates the tenant's website config fields.
 */
export async function updateWebsiteConfig(
  tenantId: string,
  data: Partial<WebsiteConfigSummary>,
): Promise<WebsiteConfigSummary> {
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      websiteDomain: data.websiteDomain !== undefined ? data.websiteDomain : undefined,
      websiteEnabled: data.websiteEnabled !== undefined ? data.websiteEnabled : undefined,
      approvedDataOnly: data.approvedDataOnly !== undefined ? data.approvedDataOnly : undefined,
    },
    select: {
      websiteDomain: true,
      websiteEnabled: true,
      approvedDataOnly: true,
    },
  });
  return updated;
}
