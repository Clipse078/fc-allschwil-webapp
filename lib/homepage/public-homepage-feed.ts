/**
 * lib/homepage/public-homepage-feed.ts
 *
 * Server-side loader for the public homepage layout API.
 *
 * Returns only sections that pass ALL of the following gates:
 *   1. isEnabled = true
 *   2. publishStatus = "PUBLISHED" OR scheduledPublishAt <= now()
 *
 * These two gates together mean:
 *   - Drafts are never exposed publicly.
 *   - Disabled sections are never exposed publicly.
 *   - Scheduled sections become live automatically once their scheduled time passes.
 *
 * Never exposes: tenantId, createdAt, updatedAt, isEnabled, publishStatus,
 * publishedAt, unpublishedAt, lastPublishedAt, scheduledPublishAt.
 * Approval fields (approvalStatus, reviewerUserId, approvalNote, approvedAt,
 * rejectedAt, etc.) are NEVER exposed on the public endpoint.
 * Only fields safe for public consumption are returned.
 *
 * Each section item includes a `block` field with public-safe block metadata
 * from the block registry (category and datadriven flag). Backwards-compatible
 * addition: existing consumers that don't use `block` will safely ignore it.
 *
 * The section config is projected through the block registry's
 * projectPublicConfig() to ensure no admin-only config fields ever leak to
 * the public API. All current block types pass config through unchanged; the
 * mechanism is in place for future types that may need filtering.
 *
 * Called by: GET /api/public/[tenant]/website/homepage
 */

import { prisma } from "@/lib/db/prisma";
import {
  getPublicBlockMeta,
  projectBlockPublicConfig,
  type PublicBlockMeta,
} from "@/lib/homepage/block-registry";

// ---------------------------------------------------------------------------
// Public shape
// ---------------------------------------------------------------------------

/**
 * Single homepage section safe for public API exposure.
 *
 * Intentionally omits: tenantId, createdAt, updatedAt, isEnabled,
 * publishStatus, publishedAt, unpublishedAt, lastPublishedAt, scheduledPublishAt.
 * Config is projected through the block registry's public-safe projection.
 *
 * The `block` field carries public-safe block metadata from the registry.
 * It is null for any unregistered type keys (safe fallback for unknown types).
 */
export type PublicHomepageSectionItem = {
  id: string;
  type: string;
  label: string;
  sortOrder: number;
  /**
   * Type-specific display configuration, projected to public-safe fields.
   * Consumers should treat unknown keys as ignorable extras.
   */
  config: Record<string, unknown>;
  /**
   * Public-safe block metadata from the block registry.
   * Null for unregistered type keys.
   * Added in CMS V2 Slice 3 (backwards-compatible).
   */
  block: PublicBlockMeta | null;
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads the public homepage section list for a tenant.
 *
 * Filtering:
 *   - isEnabled = true (gate 1)
 *   - publishStatus = "PUBLISHED" OR scheduledPublishAt <= now() (gate 2 — added Slice 5)
 *
 * Order: sortOrder ascending, then createdAt ascending as tiebreaker.
 *
 * Note on backwards compatibility: the publishStatus default is "PUBLISHED"
 * for all pre-Slice-5 rows, so no existing public section is ever hidden by
 * the migration alone.
 */
export async function getPublicHomepageSections(
  tenantId: string,
): Promise<PublicHomepageSectionItem[]> {
  const now = new Date();

  const rows = await prisma.homepageSection.findMany({
    where: {
      tenantId,
      isEnabled: true,
      OR: [
        { publishStatus: "PUBLISHED" },
        // Treat scheduled sections as published once their scheduled time passes
        { scheduledPublishAt: { lte: now } },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      label: true,
      sortOrder: true,
      config: true,
      // Publishing fields intentionally not selected — never exposed publicly
    },
  });

  return rows.map((row) => {
    const rawConfig =
      row.config !== null && typeof row.config === "object"
        ? (row.config as Record<string, unknown>)
        : {};

    return {
      id: row.id,
      type: row.type,
      label: row.label,
      sortOrder: row.sortOrder,
      config: projectBlockPublicConfig(row.type, rawConfig),
      block: getPublicBlockMeta(row.type),
    };
  });
}

// ---------------------------------------------------------------------------
// Admin preview loader (all non-deleted sections regardless of publish status)
// ---------------------------------------------------------------------------

/**
 * Loads ALL homepage sections for a tenant regardless of isEnabled or publishStatus.
 * Used by the admin preview endpoint — caller must verify WEBSITE_MANAGE permission.
 *
 * Returns sections ordered by sortOrder ascending, with extra admin-only flags
 * so the preview UI can visually distinguish draft and pending-review sections.
 *
 * Approval fields are intentionally included here because this is an admin-only
 * function gated behind WEBSITE_MANAGE. They MUST NOT appear on the public API.
 *
 * This function intentionally exposes more fields than the public loader because
 * it is called only from authenticated admin endpoints.
 */
export type PreviewHomepageSectionItem = PublicHomepageSectionItem & {
  /** True if the section is not yet published (publishStatus = "DRAFT" and no active schedule). */
  isDraft: boolean;
  /** True if the section is disabled (isEnabled = false). */
  isDisabled: boolean;
  /** Scheduled publish time, if any. */
  scheduledPublishAt: Date | null;
  // ── Approval metadata (admin-only, never on public endpoint) ──────────────
  /** Editorial approval status. Never exposed on public API. */
  approvalStatus: string;
  /** Reviewer user ID if assigned. Never exposed on public API. */
  reviewerUserId: string | null;
  /** Most recent review note left by the reviewer. Never exposed on public API. */
  approvalNote: string | null;
  /** When review was most recently requested. Never exposed on public API. */
  reviewRequestedAt: Date | null;
  /** When the most recent review action was taken. Never exposed on public API. */
  reviewedAt: Date | null;
  /** When most recently approved. Never exposed on public API. */
  approvedAt: Date | null;
};

export async function getPreviewHomepageSections(
  tenantId: string,
): Promise<PreviewHomepageSectionItem[]> {
  const now = new Date();

  const rows = await prisma.homepageSection.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      label: true,
      sortOrder: true,
      config: true,
      isEnabled: true,
      publishStatus: true,
      scheduledPublishAt: true,
      approvalStatus: true,
      reviewerUserId: true,
      approvalNote: true,
      reviewRequestedAt: true,
      reviewedAt: true,
      approvedAt: true,
    },
  });

  return rows.map((row) => {
    const rawConfig =
      row.config !== null && typeof row.config === "object"
        ? (row.config as Record<string, unknown>)
        : {};

    const isScheduledAndLive =
      row.scheduledPublishAt !== null && row.scheduledPublishAt <= now;
    const isDraft =
      row.publishStatus !== "PUBLISHED" && !isScheduledAndLive;

    return {
      id: row.id,
      type: row.type,
      label: row.label,
      sortOrder: row.sortOrder,
      config: projectBlockPublicConfig(row.type, rawConfig),
      block: getPublicBlockMeta(row.type),
      isDraft,
      isDisabled: !row.isEnabled,
      scheduledPublishAt: row.scheduledPublishAt,
      approvalStatus: row.approvalStatus,
      reviewerUserId: row.reviewerUserId,
      approvalNote: row.approvalNote,
      reviewRequestedAt: row.reviewRequestedAt,
      reviewedAt: row.reviewedAt,
      approvedAt: row.approvedAt,
    };
  });
}
