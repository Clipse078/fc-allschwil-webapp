/**
 * lib/wochenplan/publication-queries.ts
 *
 * Database queries for WochenplanPublication — the active plan variant
 * record that powers the public display "KW N | Variantname aktiv".
 *
 * One record per (tenantId, weekId), upserted on every admin publish action.
 */

import { prisma } from "@/lib/db/prisma";
export { formatWochenplanVariantBadge, parseWeekNumber } from "@/lib/wochenplan/format-variant-badge";

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns the active publication for a given week.
 * Returns null when the week has not been published yet.
 */
export async function getWochenplanPublication(
  tenantId: string,
  weekId: string,
) {
  return prisma.wochenplanPublication.findUnique({
    where: { tenantId_weekId: { tenantId, weekId } },
    select: {
      id: true,
      weekId: true,
      variantLabel: true,
      isPublished: true,
      publishedAt: true,
    },
  });
}

/**
 * Returns the most recent published week for a tenant.
 * Used by the public feed when no weekId is specified.
 */
export async function getLatestPublishedWochenplan(tenantId: string) {
  return prisma.wochenplanPublication.findFirst({
    where: { tenantId, isPublished: true },
    orderBy: { weekId: "desc" },
    select: {
      id: true,
      weekId: true,
      variantLabel: true,
      isPublished: true,
      publishedAt: true,
    },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PublicationSummary = NonNullable<
  Awaited<ReturnType<typeof getWochenplanPublication>>
>;

// ── Write ─────────────────────────────────────────────────────────────────────

export type UpsertPublicationInput = {
  tenantId: string;
  weekId: string;
  variantLabel: string;
  isPublished: boolean;
  publishedByUserId?: string | null;
};

/**
 * Create or update the publication record for a week.
 * Called from the admin publish API whenever the admin publishes the week plan.
 */
export async function upsertWochenplanPublication(input: UpsertPublicationInput) {
  const now = input.isPublished ? new Date() : undefined;
  return prisma.wochenplanPublication.upsert({
    where: {
      tenantId_weekId: { tenantId: input.tenantId, weekId: input.weekId },
    },
    update: {
      variantLabel: input.variantLabel,
      isPublished: input.isPublished,
      publishedAt: now,
      publishedByUserId: input.publishedByUserId,
    },
    create: {
      tenantId: input.tenantId,
      weekId: input.weekId,
      variantLabel: input.variantLabel,
      isPublished: input.isPublished,
      publishedAt: now ?? null,
      publishedByUserId: input.publishedByUserId,
    },
  });
}

// ── Display formatting ────────────────────────────────────────────────────────
// formatWochenplanVariantBadge and parseWeekNumber are re-exported from
// lib/wochenplan/format-variant-badge (client-safe, no Prisma dependency).
