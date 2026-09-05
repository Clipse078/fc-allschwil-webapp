import { WorkspaceDocumentStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { writeAuditRecord } from "@/lib/audit/audit-record";

export type WorkspaceDocumentArchiveServiceErrorCode =
  | "INVALID_INPUT"
  | "DOCUMENT_NOT_FOUND"
  | "TENANT_FORBIDDEN"
  | "DOCUMENT_ALREADY_ARCHIVED";

export class WorkspaceDocumentArchiveServiceError extends Error {
  readonly code: WorkspaceDocumentArchiveServiceErrorCode;

  constructor(
    code: WorkspaceDocumentArchiveServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceDocumentArchiveServiceError";
    this.code = code;
  }
}

export type ArchiveWorkspaceDocumentInput = {
  tenantId: string;
  actorUserId: string;
  documentId: string;
};

export type ArchiveWorkspaceDocumentResult = {
  documentId: string;
  status: WorkspaceDocumentStatus;
  archivedAt: Date;
  updatedByUserId: string;
};

function normalizeRequiredText(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new WorkspaceDocumentArchiveServiceError(
      "INVALID_INPUT",
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

/**
 * Soft-archives one Workspace document.
 *
 * The document record and every immutable version remain stored.
 * Blob storage is deliberately not accessed or modified.
 *
 * Prisma updates updatedAt automatically because the schema uses @updatedAt.
 */
export async function archiveWorkspaceDocument(
  input: ArchiveWorkspaceDocumentInput,
): Promise<ArchiveWorkspaceDocumentResult> {
  const tenantId = normalizeRequiredText(
    input.tenantId,
    "tenantId",
  );
  const actorUserId = normalizeRequiredText(
    input.actorUserId,
    "actorUserId",
  );
  const documentId = normalizeRequiredText(
    input.documentId,
    "documentId",
  );

  const existingDocument =
    await prisma.workspaceDocument.findUnique({
      where: {
        id: documentId,
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        archivedAt: true,
      },
    });

  if (!existingDocument) {
    throw new WorkspaceDocumentArchiveServiceError(
      "DOCUMENT_NOT_FOUND",
      "Dokument nicht gefunden.",
    );
  }

  if (existingDocument.tenantId !== tenantId) {
    throw new WorkspaceDocumentArchiveServiceError(
      "TENANT_FORBIDDEN",
      "Das Dokument gehört nicht zu diesem Mandanten.",
    );
  }

  if (
    existingDocument.status ===
      WorkspaceDocumentStatus.ARCHIVED ||
    existingDocument.archivedAt !== null
  ) {
    throw new WorkspaceDocumentArchiveServiceError(
      "DOCUMENT_ALREADY_ARCHIVED",
      "Das Dokument ist bereits archiviert.",
    );
  }

  const archivedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const document = await tx.workspaceDocument.update({
      where: {
        id: documentId,
      },
      data: {
        status: WorkspaceDocumentStatus.ARCHIVED,
        archivedAt,
        updatedByUserId: actorUserId,
      },
      select: {
        id: true,
        status: true,
        archivedAt: true,
        updatedByUserId: true,
      },
    });
    if (!document.archivedAt || !document.updatedByUserId) {
      throw new Error(
        "Archived document did not return the required archive metadata.",
      );
    }
    await writeAuditRecord(tx, {
      tenantId,
      actorUserId,
      moduleKey: "workspace",
      entityType: "WorkspaceDocument",
      entityId: document.id,
      action: "PRIVATE_DOCUMENT_ARCHIVED",
      beforeJson: { status: existingDocument.status },
      afterJson: { status: document.status },
    });

    return {
      documentId: document.id,
      status: document.status,
      archivedAt: document.archivedAt,
      updatedByUserId: document.updatedByUserId,
    };
  });
}
