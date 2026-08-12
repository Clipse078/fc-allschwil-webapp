/**
 * lib/workspace/folder-delete-service.ts
 *
 * ADMIN-DELETE-WORKSPACE-01 — permanent hard-delete for a WorkspaceFolder.
 *
 * Ownership / dependency rules applied here:
 *
 *   - WorkspaceFolder is a self-referential tree via parentId (nullable FK with
 *     onDelete: SetNull). Deleting a folder will SET NULL the parentId of any
 *     surviving child rows — so we must delete all descendants first (or in a
 *     single batch) to avoid orphaned subtrees.
 *
 *   - WorkspaceDocument.folderId is a nullable FK to WorkspaceFolder with
 *     onDelete: SetNull. Documents in deleted folders will have their folderId
 *     set to null by the DB constraint. They are NOT deleted — the document
 *     record survives without folder placement, consistent with the existing
 *     data model (folderId is optional in the WorkspaceDocument schema).
 *
 *   - User references (createdByUserId, updatedByUserId) use SetNull — no
 *     action required here.
 *
 *   - Tenant reference uses Cascade — handled at the Tenant level, not here.
 *
 * Subtree collection:
 *   All descendant folder IDs are collected via iterative BFS before deletion.
 *   The BFS queries all children regardless of archivedAt so that the entire
 *   sub-hierarchy is removed in one transaction (archived children are included).
 *
 * Deletion order:
 *   All collected IDs (including root) are deleted in a single deleteMany call.
 *   Because parentId uses ON DELETE SET NULL, PostgreSQL will SET NULL the
 *   parentId of any row referencing a deleted row. Since all rows in the set
 *   are deleted in the same statement, the SET NULL fires transiently before
 *   the referencing rows are also removed — the final state is clean.
 */

import { prisma } from "@/lib/db/prisma";

// ── Error ─────────────────────────────────────────────────────────────────────

export type WorkspaceFolderDeleteServiceErrorCode =
  | "INVALID_INPUT"
  | "FOLDER_NOT_FOUND"
  | "TENANT_FORBIDDEN";

export class WorkspaceFolderDeleteServiceError extends Error {
  readonly code: WorkspaceFolderDeleteServiceErrorCode;

  constructor(
    code: WorkspaceFolderDeleteServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceFolderDeleteServiceError";
    this.code = code;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type FolderDeletionImpact = {
  /** Number of direct + indirect descendant folders that will also be deleted. */
  descendantFolderCount: number;
  /** Number of documents across the entire subtree that will lose their folder placement. */
  documentCount: number;
};

export type DeleteWorkspaceFolderResult = {
  folderId: string;
  folderName: string;
  deletedFolderCount: number;
  impact: FolderDeletionImpact;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeRequiredText(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new WorkspaceFolderDeleteServiceError(
      "INVALID_INPUT",
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

/**
 * Collects the IDs of all folders in the subtree rooted at `rootFolderId`
 * (inclusive), regardless of archivedAt state. Returns an empty array when
 * the root folder does not exist within the given tenant.
 *
 * Uses iterative BFS to avoid stack overflow on deep hierarchies.
 */
async function collectSubtreeIds(
  tenantId: string,
  rootFolderId: string,
): Promise<string[]> {
  const ids: string[] = [];
  const queue: string[] = [rootFolderId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    ids.push(currentId);

    const children = await prisma.workspaceFolder.findMany({
      where: {
        tenantId,
        parentId: currentId,
      },
      select: { id: true },
    });

    for (const child of children) {
      queue.push(child.id);
    }
  }

  return ids;
}

// ── Impact inspection (non-mutating) ─────────────────────────────────────────

/**
 * Returns the deletion impact for a folder. Resolves to null when the folder
 * does not belong to the given tenant or does not exist.
 *
 * This is a read-only inspection — it never mutates any data.
 */
export async function getWorkspaceFolderDeletionImpact(
  tenantId: string,
  folderId: string,
): Promise<FolderDeletionImpact | null> {
  const cleanTenantId = normalizeRequiredText(tenantId, "tenantId");
  const cleanFolderId = normalizeRequiredText(folderId, "folderId");

  const folder = await prisma.workspaceFolder.findFirst({
    where: { id: cleanFolderId, tenantId: cleanTenantId },
    select: { id: true },
  });

  if (!folder) {
    return null;
  }

  const subtreeIds = await collectSubtreeIds(cleanTenantId, cleanFolderId);
  const descendantIds = subtreeIds.filter((id) => id !== cleanFolderId);

  const documentCount = await prisma.workspaceDocument.count({
    where: {
      tenantId: cleanTenantId,
      folderId: { in: subtreeIds },
    },
  });

  return {
    descendantFolderCount: descendantIds.length,
    documentCount,
  };
}

// ── Permanent deletion ────────────────────────────────────────────────────────

/**
 * Permanently deletes a WorkspaceFolder and its entire subtree.
 *
 * Steps:
 *   1. Load the folder + tenant check.
 *   2. Collect all descendant folder IDs (BFS).
 *   3. Count affected documents (for result reporting).
 *   4. Delete all collected folders in a single transaction.
 *      Documents in those folders will have folderId set to null by the DB.
 */
export async function deleteWorkspaceFolderPermanently(
  tenantId: string,
  folderId: string,
): Promise<DeleteWorkspaceFolderResult> {
  const cleanTenantId = normalizeRequiredText(tenantId, "tenantId");
  const cleanFolderId = normalizeRequiredText(folderId, "folderId");

  // Step 1: Load + tenant check.
  const folder = await prisma.workspaceFolder.findFirst({
    where: { id: cleanFolderId },
    select: { id: true, tenantId: true, name: true },
  });

  if (!folder) {
    throw new WorkspaceFolderDeleteServiceError(
      "FOLDER_NOT_FOUND",
      "Ordner nicht gefunden.",
    );
  }

  if (folder.tenantId !== cleanTenantId) {
    throw new WorkspaceFolderDeleteServiceError(
      "TENANT_FORBIDDEN",
      "Der Ordner gehört nicht zu diesem Mandanten.",
    );
  }

  const folderName = folder.name;

  // Step 2: Collect all folder IDs in the subtree (inclusive of root).
  const subtreeIds = await collectSubtreeIds(cleanTenantId, cleanFolderId);
  const descendantFolderCount = subtreeIds.length - 1;

  // Step 3: Count documents that will lose their folder placement.
  const documentCount = await prisma.workspaceDocument.count({
    where: {
      tenantId: cleanTenantId,
      folderId: { in: subtreeIds },
    },
  });

  // Step 4: Delete all folders in a single transaction.
  // DB constraint (ON DELETE SET NULL on parentId and folderId) handles
  // decoupling of surviving rows.
  await prisma.$transaction(async (tx) => {
    await tx.workspaceFolder.deleteMany({
      where: {
        id: { in: subtreeIds },
        tenantId: cleanTenantId,
      },
    });
  });

  return {
    folderId: cleanFolderId,
    folderName,
    deletedFolderCount: subtreeIds.length,
    impact: { descendantFolderCount, documentCount },
  };
}
