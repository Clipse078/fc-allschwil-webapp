/**
 * lib/workspace/document-delete-service.ts
 *
 * ADMIN-DELETE-03A — permanent hard-delete for a WorkspaceDocument.
 *
 * Ownership/dependency rules applied here:
 *
 *   - WorkspaceDocumentVersion rows are exclusively owned by their parent
 *     WorkspaceDocument and are cascade-deleted by Prisma/DB (onDelete: Cascade
 *     on the "WorkspaceDocumentVersions" relation in prisma/schema.prisma).
 *     There is therefore no "independent canonical record" at risk — every
 *     version and every blob belongs solely to its parent document.
 *
 *   - Each version carries a `storageKey` (always present) and an optional
 *     `storageUrl`. Both are collected before the DB row is removed and
 *     passed to workspaceStorageProvider.delete on a best-effort basis after
 *     the DB transaction succeeds, mirroring the already-accepted cleanup
 *     pattern in the document creation route (app/api/workspace/documents/
 *     route.ts POST).
 *
 *   - Folder references (folderId) are nullable foreign keys on
 *     WorkspaceDocument — the folder row is NOT owned by the document and
 *     must NOT be touched.
 *
 *   - User references (createdByUserId, updatedByUserId,
 *     WorkspaceDocumentVersion.createdByUserId) use SetNull on delete in the
 *     schema — no action needed here; Prisma handles them automatically.
 *
 *   - There are NO outbound foreign-key references from other tables into
 *     WorkspaceDocument (verified by schema inspection — no model holds a
 *     required FK to WorkspaceDocument). The only FK is
 *     WorkspaceDocumentVersion → WorkspaceDocument which cascades.
 *
 * Storage cleanup:
 *   The blobs are deleted AFTER the DB transaction succeeds. If blob deletion
 *   fails it is logged as a warning (same as the existing upload-cleanup
 *   strategy in VercelBlobWorkspaceStorage.delete). A failed blob cleanup
 *   leaves orphaned storage but never corrupts the DB.
 *
 *   The DB delete is NOT retried or rolled back if blob cleanup fails —
 *   orphaned blobs are an acceptable storage-cost concern; corrupt DB state
 *   is not. This matches the existing pattern.
 */

import { prisma } from "@/lib/db/prisma";
import { workspaceStorageProvider } from "@/lib/workspace/upload-storage";

// ── Error ─────────────────────────────────────────────────────────────────────

export type WorkspaceDocumentDeleteServiceErrorCode =
  | "INVALID_INPUT"
  | "DOCUMENT_NOT_FOUND"
  | "TENANT_FORBIDDEN";

export class WorkspaceDocumentDeleteServiceError extends Error {
  readonly code: WorkspaceDocumentDeleteServiceErrorCode;

  constructor(
    code: WorkspaceDocumentDeleteServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceDocumentDeleteServiceError";
    this.code = code;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type DocumentDeletionImpact = {
  /** Total number of stored file versions owned by this document. */
  versionCount: number;
};

export type DeleteWorkspaceDocumentResult = {
  documentId: string;
  documentName: string;
  impact: DocumentDeletionImpact;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeRequiredText(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new WorkspaceDocumentDeleteServiceError(
      "INVALID_INPUT",
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

// ── Impact inspection (non-mutating) ─────────────────────────────────────────

/**
 * Returns the deletion impact for a document. Resolves to null when the
 * document does not belong to the given tenant or does not exist.
 *
 * This is a read-only inspection — it never mutates any data.
 */
export async function getWorkspaceDocumentDeletionImpact(
  tenantId: string,
  documentId: string,
): Promise<DocumentDeletionImpact | null> {
  const cleanTenantId = normalizeRequiredText(tenantId, "tenantId");
  const cleanDocumentId = normalizeRequiredText(documentId, "documentId");

  const document = await prisma.workspaceDocument.findUnique({
    where: { id: cleanDocumentId },
    select: {
      id: true,
      tenantId: true,
      _count: {
        select: { versions: true },
      },
    },
  });

  if (!document || document.tenantId !== cleanTenantId) {
    return null;
  }

  return {
    versionCount: document._count.versions,
  };
}

// ── Permanent deletion ────────────────────────────────────────────────────────

/**
 * Permanently deletes a WorkspaceDocument and all its owned data.
 *
 * Steps:
 *   1. Load the document + all version storage references (tenant-checked).
 *   2. Delete the DB row (cascade removes all versions).
 *   3. Delete every blob on a best-effort basis (failure is logged, not thrown).
 */
export async function deleteWorkspaceDocumentPermanently(
  tenantId: string,
  documentId: string,
): Promise<DeleteWorkspaceDocumentResult> {
  const cleanTenantId = normalizeRequiredText(tenantId, "tenantId");
  const cleanDocumentId = normalizeRequiredText(documentId, "documentId");

  // Step 1: Load + tenant-check + collect storage references.
  const document = await prisma.workspaceDocument.findUnique({
    where: { id: cleanDocumentId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      versions: {
        select: {
          id: true,
          storageKey: true,
          storageUrl: true,
        },
      },
    },
  });

  if (!document) {
    throw new WorkspaceDocumentDeleteServiceError(
      "DOCUMENT_NOT_FOUND",
      "Dokument nicht gefunden.",
    );
  }

  if (document.tenantId !== cleanTenantId) {
    throw new WorkspaceDocumentDeleteServiceError(
      "TENANT_FORBIDDEN",
      "Das Dokument gehört nicht zu diesem Mandanten.",
    );
  }

  const storageReferences = document.versions.map(
    (v) => v.storageUrl ?? v.storageKey,
  );

  const versionCount = document.versions.length;
  const documentName = document.name;

  // Step 2: Delete DB row. Cascade removes all WorkspaceDocumentVersion rows.
  await prisma.workspaceDocument.delete({
    where: { id: cleanDocumentId },
  });

  // Step 3: Best-effort blob cleanup. workspaceStorageProvider.delete already
  // logs and swallows internal failures; the outer try/catch is a defence layer
  // that prevents any unexpected throw from surfacing to the caller — the DB
  // transaction is already committed and must not be rolled back due to a
  // storage issue.
  for (const ref of storageReferences) {
    try {
      await workspaceStorageProvider.delete(ref);
    } catch (err) {
      console.warn("[workspace-document-delete] storage cleanup failed", {
        operation: "delete",
        documentId: cleanDocumentId,
        errorCategory:
          err instanceof Error && err.name ? err.name : "UnknownError",
      });
    }
  }

  return {
    documentId: cleanDocumentId,
    documentName,
    impact: { versionCount },
  };
}
