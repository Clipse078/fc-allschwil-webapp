/**
 * lib/reusable-components/public-reusable-component-feed.ts
 *
 * Server-side loader for the public reusable component API.
 *
 * Returns only components that pass ALL of the following gates:
 *   1. archivedAt IS NULL
 *   2. publishStatus = "PUBLISHED" OR scheduledPublishAt <= now()
 *
 * For ANNOUNCEMENT type, config-level publishFrom / publishUntil windows are
 * also enforced: if the current time is outside the configured display window
 * the component is treated as not available (returns null).
 *
 * Never exposes: tenantId, publishStatus, publishedAt, scheduledPublishAt,
 * unpublishedAt, lastPublishedAt, archivedAt, createdAt, approvalStatus,
 * reviewerUserId, approvalNote, reviewRequestedAt, reviewedAt, approvedAt,
 * rejectedAt, createdByUserId, slug, or description.
 * Only public-safe fields are returned.
 *
 * Called by: GET /api/public/[tenant]/website/components/[id]
 */

import { prisma } from "@/lib/db/prisma";

// ---------------------------------------------------------------------------
// Public DTO
// ---------------------------------------------------------------------------

export type PublicReusableComponent = {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads a single published reusable component by id for a tenant.
 *
 * Returns null when:
 *   - Component does not exist or belongs to a different tenant.
 *   - Component is archived (archivedAt IS NOT NULL).
 *   - Component is not yet published (publishStatus = DRAFT AND scheduledPublishAt is null or future).
 *   - ANNOUNCEMENT type: current time is before config.publishFrom or after config.publishUntil.
 */
export async function getPublicReusableComponent(
  tenantId: string,
  id: string,
): Promise<PublicReusableComponent | null> {
  const now = new Date();

  const row = await prisma.reusableComponent.findFirst({
    where: {
      id,
      tenantId,
      archivedAt: null,
      OR: [
        { publishStatus: "PUBLISHED" },
        // Treat scheduled components as published once their scheduled time passes,
        // matching the HomepageSection / WebsitePageSection feed pattern.
        { scheduledPublishAt: { lte: now } },
      ],
    },
    select: {
      id: true,
      type: true,
      title: true,
      config: true,
      updatedAt: true,
    },
  });

  if (!row) return null;

  const config =
    row.config !== null && typeof row.config === "object"
      ? (row.config as Record<string, unknown>)
      : {};

  // Config-level scheduling window for ANNOUNCEMENT components.
  // publishFrom / publishUntil are ISO date strings stored in the config JSON.
  // The DB-level gates above confirm the component is published; these config
  // fields let editors schedule the display window independently.
  if (row.type === "ANNOUNCEMENT") {
    const publishFrom = config.publishFrom as string | null | undefined;
    const publishUntil = config.publishUntil as string | null | undefined;

    if (publishFrom && new Date(publishFrom) > now) {
      // Display window has not started yet.
      return null;
    }
    if (publishUntil && new Date(publishUntil) <= now) {
      // Display window has expired.
      return null;
    }
  }

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    config,
    updatedAt: row.updatedAt,
  };
}
