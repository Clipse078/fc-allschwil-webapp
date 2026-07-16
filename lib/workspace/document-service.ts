import {
  WorkspaceDocumentStatus,
  WorkspaceDocumentVersionStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type {
  CreateWorkspaceDocumentInput,
  WorkspaceDocumentDto,
} from "@/lib/workspace/document-dto";

export type WorkspaceDocumentServiceErrorCode =
  "INVALID_INPUT" | "FOLDER_NOT_FOUND" | "DUPLICATE_DOCUMENT_NAME";

export class WorkspaceDocumentServiceError extends Error {
  readonly code: WorkspaceDocumentServiceErrorCode;

  constructor(code: WorkspaceDocumentServiceErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceDocumentServiceError";
    this.code = code;
  }
}

function normalizeRequiredText(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new WorkspaceDocumentServiceError(
      "INVALID_INPUT",
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function validateSizeBytes(sizeBytes: number): number {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
    throw new WorkspaceDocumentServiceError(
      "INVALID_INPUT",
      "sizeBytes must be a non-negative safe integer.",
    );
  }

  return sizeBytes;
}

export async function createWorkspaceDocumentWithInitialVersion(
  input: CreateWorkspaceDocumentInput,
): Promise<WorkspaceDocumentDto> {
  const documentId = normalizeRequiredText(
    input.documentId,
    "documentId",
  );
  const tenantId = normalizeRequiredText(input.tenantId, "tenantId");
  const actorUserId = normalizeRequiredText(input.actorUserId, "actorUserId");
  const name = normalizeRequiredText(input.name, "name");
  const filename = normalizeRequiredText(input.filename, "filename");
  const mimeType = normalizeRequiredText(input.mimeType, "mimeType");
  const storageKey = normalizeRequiredText(input.storageKey, "storageKey");
  const sizeBytes = validateSizeBytes(input.sizeBytes);

  const folderId = normalizeOptionalText(input.folderId);
  const storageUrl = normalizeOptionalText(input.storageUrl);
  const checksum = normalizeOptionalText(input.checksum);
  const changeNote = normalizeOptionalText(input.changeNote);

  if (folderId) {
    const folder = await prisma.workspaceFolder.findFirst({
      where: {
        id: folderId,
        tenantId,
        archivedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!folder) {
      throw new WorkspaceDocumentServiceError(
        "FOLDER_NOT_FOUND",
        "The selected Workspace folder does not exist or is archived.",
      );
    }
  }

  const duplicate = await prisma.workspaceDocument.findFirst({
    where: {
      tenantId,
      folderId,
      status: WorkspaceDocumentStatus.ACTIVE,
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (duplicate) {
    throw new WorkspaceDocumentServiceError(
      "DUPLICATE_DOCUMENT_NAME",
      "An active document with this name already exists in the selected folder.",
    );
  }

  return prisma.$transaction(async (transaction) => {
    const document = await transaction.workspaceDocument.create({
      data: {
        id: documentId,
        tenantId,
        folderId,
        name,
        status: WorkspaceDocumentStatus.ACTIVE,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
      select: {
        id: true,
      },
    });

    const version = await transaction.workspaceDocumentVersion.create({
      data: {
        tenantId,
        documentId: document.id,
        versionNumber: 1,
        status: WorkspaceDocumentVersionStatus.CURRENT,
        filename,
        mimeType,
        sizeBytes,
        storageKey,
        storageUrl,
        checksum,
        changeNote,
        createdByUserId: actorUserId,
      },
      select: {
        id: true,
      },
    });

    return transaction.workspaceDocument.update({
      where: {
        id: document.id,
      },
      data: {
        currentVersionId: version.id,
      },
      select: {
        id: true,
        tenantId: true,
        folderId: true,
        name: true,
        status: true,
        currentVersionId: true,
        createdByUserId: true,
        updatedByUserId: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        currentVersion: {
          select: {
            id: true,
            documentId: true,
            versionNumber: true,
            status: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            storageKey: true,
            storageUrl: true,
            checksum: true,
            changeNote: true,
            createdByUserId: true,
            createdAt: true,
          },
        },
      },
    });
  });
}
