/**
 * lib/cms/revision-engine.ts
 *
 * Append-only version history engine for CMS content.
 *
 * Every significant edit to a CMS entity creates an immutable revision
 * capturing the full entity state at that point in time.
 *
 * Design invariants:
 *   - Revisions are NEVER updated or deleted.
 *   - Version numbers are monotonically increasing per (entityType, entityId).
 *   - Restoring a revision creates a NEW revision; history is never overwritten.
 *   - isRestore = true marks restore-created revisions.
 *   - parentRevisionId links a restore revision to its source for rollback chains.
 *   - All writes are best-effort (errors are logged, never thrown to callers).
 *
 * Supported entityTypes (generic — no schema change required for new types):
 *   "WebsitePageSection" | "WebsitePage" | "HomepageSection"
 *   Future: "NewsArticle" | "Event" | "LandingPage" | any future CMS entity
 */

import { prisma } from "@/lib/db/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContentRevisionItem = {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  versionNumber: number;
  createdByUserId: string | null;
  changeNote: string | null;
  snapshot: Record<string, unknown>;
  isRestore: boolean;
  parentRevisionId: string | null;
  createdAt: Date;
  createdByUser?: { firstName: string; lastName: string } | null;
};

export type CaptureRevisionInput = {
  tenantId: string;
  entityType: string;
  entityId: string;
  snapshot: Record<string, unknown>;
  createdByUserId?: string | null;
  changeNote?: string | null;
  isRestore?: boolean;
  parentRevisionId?: string | null;
};

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

/**
 * Captures a new revision for a CMS entity.
 *
 * Atomically determines the next version number and creates the revision row.
 * Best-effort: errors are logged and swallowed so callers are never interrupted.
 *
 * Returns the created revision, or null on failure.
 */
export async function captureRevision(
  input: CaptureRevisionInput,
): Promise<ContentRevisionItem | null> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const last = await tx.contentRevision.findFirst({
        where: { entityType: input.entityType, entityId: input.entityId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const nextVersion = (last?.versionNumber ?? 0) + 1;

      return tx.contentRevision.create({
        data: {
          tenantId: input.tenantId,
          entityType: input.entityType,
          entityId: input.entityId,
          versionNumber: nextVersion,
          createdByUserId: input.createdByUserId ?? null,
          changeNote: input.changeNote ?? null,
          snapshot: input.snapshot as never,
          isRestore: input.isRestore ?? false,
          parentRevisionId: input.parentRevisionId ?? null,
        },
        select: revisionSelect,
      });
    });

    return mapRevision(result);
  } catch (error) {
    console.error("[revision-engine] captureRevision failed:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * Lists all revisions for an entity, newest first.
 * Tenant-scoped: only revisions matching tenantId are returned.
 */
export async function listRevisions(
  tenantId: string,
  entityType: string,
  entityId: string,
  limit = 50,
): Promise<ContentRevisionItem[]> {
  const rows = await prisma.contentRevision.findMany({
    where: { tenantId, entityType, entityId },
    orderBy: { versionNumber: "desc" },
    take: limit,
    select: revisionWithUserSelect,
  });
  return rows.map(mapRevisionWithUser);
}

// ---------------------------------------------------------------------------
// Get single
// ---------------------------------------------------------------------------

export async function getRevision(
  tenantId: string,
  entityType: string,
  entityId: string,
  versionNumber: number,
): Promise<ContentRevisionItem | null> {
  const row = await prisma.contentRevision.findFirst({
    where: { tenantId, entityType, entityId, versionNumber },
    select: revisionWithUserSelect,
  });
  return row ? mapRevisionWithUser(row) : null;
}

export async function getRevisionById(
  tenantId: string,
  id: string,
): Promise<ContentRevisionItem | null> {
  const row = await prisma.contentRevision.findFirst({
    where: { id, tenantId },
    select: revisionWithUserSelect,
  });
  return row ? mapRevisionWithUser(row) : null;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const revisionSelect = {
  id: true,
  tenantId: true,
  entityType: true,
  entityId: true,
  versionNumber: true,
  createdByUserId: true,
  changeNote: true,
  snapshot: true,
  isRestore: true,
  parentRevisionId: true,
  createdAt: true,
} as const;

const revisionWithUserSelect = {
  ...revisionSelect,
  createdByUser: {
    select: { firstName: true, lastName: true },
  },
} as const;

type RawRevision = {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  versionNumber: number;
  createdByUserId: string | null;
  changeNote: string | null;
  snapshot: unknown;
  isRestore: boolean;
  parentRevisionId: string | null;
  createdAt: Date;
};

type RawRevisionWithUser = RawRevision & {
  createdByUser: { firstName: string; lastName: string } | null;
};

function mapRevision(row: RawRevision): ContentRevisionItem {
  return {
    ...row,
    snapshot:
      row.snapshot !== null && typeof row.snapshot === "object"
        ? (row.snapshot as Record<string, unknown>)
        : {},
  };
}

function mapRevisionWithUser(row: RawRevisionWithUser): ContentRevisionItem {
  return {
    ...mapRevision(row),
    createdByUser: row.createdByUser ?? null,
  };
}
