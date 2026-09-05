import { WorkspaceDocumentStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { writeAuditRecord } from "@/lib/audit/audit-record";

export type WorkspaceDocumentRestoreServiceErrorCode =
  | "INVALID_INPUT"
  | "DOCUMENT_NOT_FOUND"
  | "TENANT_FORBIDDEN"
  | "DOCUMENT_ALREADY_ACTIVE";

export class WorkspaceDocumentRestoreServiceError extends Error {
  readonly code: WorkspaceDocumentRestoreServiceErrorCode;

  constructor(
    code: WorkspaceDocumentRestoreServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceDocumentRestoreServiceError";
    this.code = code;
  }
}

export type RestoreWorkspaceDocumentInput = {
  tenantId: string;
  actorUserId: string;
  documentId: string;
};

export type RestoreWorkspaceDocumentResult = {
  documentId: string;
  status: WorkspaceDocumentStatus;
  archivedAt: null;
  updatedByUserId: string;
};

function normalizeRequiredText(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new WorkspaceDocumentRestoreServiceError(
      "INVALID_INPUT",
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

export async function restoreWorkspaceDocument(
  input: RestoreWorkspaceDocumentInput,
): Promise<RestoreWorkspaceDocumentResult> {
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
    throw new WorkspaceDocumentRestoreServiceError(
      "DOCUMENT_NOT_FOUND",
      "Dokument nicht gefunden.",
    );
  }

  if (existingDocument.tenantId !== tenantId) {
    throw new WorkspaceDocumentRestoreServiceError(
      "TENANT_FORBIDDEN",
      "Das Dokument gehört nicht zu diesem Mandanten.",
    );
  }

  if (
    existingDocument.status === WorkspaceDocumentStatus.ACTIVE ||
    existingDocument.archivedAt === null
  ) {
    throw new WorkspaceDocumentRestoreServiceError(
      "DOCUMENT_ALREADY_ACTIVE",
      "Das Dokument ist bereits aktiv.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const restoredDocument = await tx.workspaceDocument.update({
      where: {
        id: documentId,
      },
      data: {
        status: WorkspaceDocumentStatus.ACTIVE,
        archivedAt: null,
        updatedByUserId: actorUserId,
      },
      select: {
        id: true,
        status: true,
        archivedAt: true,
        updatedByUserId: true,
      },
    });

    if (
      restoredDocument.archivedAt !== null ||
      !restoredDocument.updatedByUserId
    ) {
      throw new Error(
        "Restored document did not return valid restore metadata.",
      );
    }
    await writeAuditRecord(tx, {
      tenantId,
      actorUserId,
      moduleKey: "workspace",
      entityType: "WorkspaceDocument",
      entityId: restoredDocument.id,
      action: "PRIVATE_DOCUMENT_RESTORED",
      beforeJson: { status: existingDocument.status },
      afterJson: { status: restoredDocument.status },
    });

    return {
      documentId: restoredDocument.id,
      status: restoredDocument.status,
      archivedAt: null,
      updatedByUserId: restoredDocument.updatedByUserId,
    };
  });
}
