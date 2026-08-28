/**
 * TEAM-COCKPIT-PREMIUM-01J-A — Team-bound private document service.
 *
 * Handles list, create (upload), rename title, download, and delete for
 * TeamDocument records, enforcing:
 *   1. Tenant isolation: tenantId checked on every operation.
 *   2. Team ownership: teamId must belong to the given tenantId.
 *   3. Permission boundaries: callers pass pre-resolved permission booleans;
 *      the service does NOT re-resolve permissions.
 *   4. Private file storage: binary data stored via teamDocumentStorage under
 *      the dedicated "team-docs/" namespace. Storage keys are opaque to clients.
 *   5. No public URL exposure: download returns a server-side stream only.
 */

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import {
  getTeamDocumentStorageKey,
  teamDocumentStorage,
  type TeamDocumentStorage,
} from "@/lib/teams/team-document-storage";
import {
  TeamDocumentValidationError,
  validateTeamDocumentUpload,
} from "@/lib/teams/team-document-validation";

export type TeamDocumentServiceErrorCode =
  | "INVALID_INPUT"
  | "TEAM_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "STORAGE_FAILURE"
  | "STORAGE_NOT_CONFIGURED"
  | "PERSISTENCE_FAILED";

export class TeamDocumentServiceError extends Error {
  readonly code: TeamDocumentServiceErrorCode;

  constructor(code: TeamDocumentServiceErrorCode, message: string) {
    super(message);
    this.name = "TeamDocumentServiceError";
    this.code = code;
  }
}

export type TeamDocumentRecord = {
  id: string;
  tenantId: string;
  teamId: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Internal storage key — never sent to clients directly */
  _storageKey: string;
};

export type CreateTeamDocumentInput = {
  tenantId: string;
  teamId: string;
  actorUserId: string;
  tenantKey: string;
  title: string;
  fileBuffer: Uint8Array;
  filename: string;
  mimeType: string;
  storage?: TeamDocumentStorage;
};

export type RenameTeamDocumentInput = {
  tenantId: string;
  teamId: string;
  documentId: string;
  actorUserId: string;
  title: string;
};

export type DeleteTeamDocumentInput = {
  tenantId: string;
  teamId: string;
  documentId: string;
  actorUserId: string;
  storage?: TeamDocumentStorage;
};

export type DownloadTeamDocumentInput = {
  tenantId: string;
  teamId: string;
  documentId: string;
  storage?: TeamDocumentStorage;
};

const documentSelect = {
  id: true,
  tenantId: true,
  teamId: true,
  title: true,
  storageKey: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  uploadedByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function resolveTeam(tenantId: string, teamId: string) {
  return prisma.team.findFirst({
    where: { id: teamId, tenantId },
    select: { id: true, tenantId: true },
  });
}

async function resolveDocument(
  tenantId: string,
  teamId: string,
  documentId: string,
) {
  const doc = await prisma.teamDocument.findUnique({
    where: { id: documentId },
    select: documentSelect,
  });

  if (!doc) return null;
  if (doc.tenantId !== tenantId) return null;
  if (doc.teamId !== teamId) return null;
  return doc;
}

function toRecord(
  doc: NonNullable<Awaited<ReturnType<typeof resolveDocument>>>,
): TeamDocumentRecord {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    teamId: doc.teamId,
    title: doc.title,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    uploadedByUserId: doc.uploadedByUserId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    _storageKey: doc.storageKey,
  };
}

function mapValidationError(error: TeamDocumentValidationError): TeamDocumentServiceError {
  return new TeamDocumentServiceError("INVALID_INPUT", error.message);
}

function mapStorageError(error: unknown): TeamDocumentServiceError {
  if (
    error instanceof Error &&
    error.message.includes("storage path characters")
  ) {
    return new TeamDocumentServiceError("INVALID_INPUT", error.message);
  }

  return new TeamDocumentServiceError(
    "STORAGE_FAILURE",
    error instanceof Error ? error.message : "Speichervorgang fehlgeschlagen.",
  );
}

export async function listTeamDocuments(
  tenantId: string,
  teamId: string,
): Promise<TeamDocumentRecord[]> {
  const team = await resolveTeam(tenantId, teamId);
  if (!team) {
    throw new TeamDocumentServiceError("TEAM_NOT_FOUND", "Team nicht gefunden.");
  }

  const docs = await prisma.teamDocument.findMany({
    where: { tenantId, teamId },
    orderBy: { createdAt: "desc" },
    select: documentSelect,
  });

  return docs.map(toRecord);
}

export async function getTeamDocument(
  tenantId: string,
  teamId: string,
  documentId: string,
): Promise<TeamDocumentRecord | null> {
  const doc = await resolveDocument(tenantId, teamId, documentId);
  return doc ? toRecord(doc) : null;
}

export async function createTeamDocument(
  input: CreateTeamDocumentInput,
): Promise<TeamDocumentRecord> {
  const team = await resolveTeam(input.tenantId, input.teamId);
  if (!team) {
    throw new TeamDocumentServiceError("TEAM_NOT_FOUND", "Team nicht gefunden.");
  }

  const title = input.title.trim();
  if (!title) {
    throw new TeamDocumentServiceError("INVALID_INPUT", "Titel ist erforderlich.");
  }
  if (title.length > 200) {
    throw new TeamDocumentServiceError(
      "INVALID_INPUT",
      "Titel darf maximal 200 Zeichen lang sein.",
    );
  }

  let validated;
  try {
    validated = await validateTeamDocumentUpload({
      filename: input.filename,
      declaredContentType: input.mimeType,
      buffer: input.fileBuffer,
    });
  } catch (error) {
    if (error instanceof TeamDocumentValidationError) {
      throw mapValidationError(error);
    }
    throw error;
  }

  const storage = input.storage ?? teamDocumentStorage;
  const documentId = randomUUID();
  let storageKey: string;
  try {
    storageKey = getTeamDocumentStorageKey({
      tenantKey: input.tenantKey,
      teamId: input.teamId,
      documentId,
      filename: validated.sanitizedFilename,
    });
  } catch (error) {
    throw mapStorageError(error);
  }

  let uploaded;
  try {
    uploaded = await storage.upload({
      storageKey,
      contentType: validated.contentType,
      buffer: input.fileBuffer,
    });
  } catch (error) {
    throw mapStorageError(error);
  }

  try {
    const doc = await prisma.teamDocument.create({
      data: {
        id: documentId,
        tenantId: input.tenantId,
        teamId: input.teamId,
        title,
        storageKey: uploaded.storageKey,
        originalFilename: validated.sanitizedFilename,
        mimeType: validated.contentType,
        sizeBytes: uploaded.sizeBytes,
        uploadedByUserId: input.actorUserId,
      },
      select: documentSelect,
    });

    await logAction({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      moduleKey: "teams",
      entityType: "TeamDocument",
      entityId: doc.id,
      action: "team_document_uploaded",
      afterJson: {
        teamId: input.teamId,
        title,
        originalFilename: validated.sanitizedFilename,
        mimeType: validated.contentType,
        sizeBytes: uploaded.sizeBytes,
      },
    });

    return toRecord(doc);
  } catch (error) {
    await storage.delete(uploaded.storageKey).catch(() => {});
    throw new TeamDocumentServiceError(
      "PERSISTENCE_FAILED",
      error instanceof Error ? error.message : "Speichern fehlgeschlagen.",
    );
  }
}

export async function renameTeamDocument(
  input: RenameTeamDocumentInput,
): Promise<TeamDocumentRecord> {
  const existing = await resolveDocument(
    input.tenantId,
    input.teamId,
    input.documentId,
  );
  if (!existing) {
    throw new TeamDocumentServiceError(
      "DOCUMENT_NOT_FOUND",
      "Dokument nicht gefunden.",
    );
  }

  const title = input.title.trim();
  if (!title) {
    throw new TeamDocumentServiceError("INVALID_INPUT", "Titel ist erforderlich.");
  }
  if (title.length > 200) {
    throw new TeamDocumentServiceError(
      "INVALID_INPUT",
      "Titel darf maximal 200 Zeichen lang sein.",
    );
  }

  const doc = await prisma.teamDocument.update({
    where: { id: input.documentId },
    data: { title },
    select: documentSelect,
  });

  await logAction({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    moduleKey: "teams",
    entityType: "TeamDocument",
    entityId: doc.id,
    action: "team_document_renamed",
    afterJson: {
      teamId: input.teamId,
      title: doc.title,
      originalFilename: doc.originalFilename,
    },
  });

  return toRecord(doc);
}

export async function deleteTeamDocument(
  input: DeleteTeamDocumentInput,
): Promise<void> {
  const doc = await resolveDocument(
    input.tenantId,
    input.teamId,
    input.documentId,
  );
  if (!doc) {
    throw new TeamDocumentServiceError(
      "DOCUMENT_NOT_FOUND",
      "Dokument nicht gefunden.",
    );
  }

  const storage = input.storage ?? teamDocumentStorage;
  const storageKey = doc.storageKey;

  await prisma.teamDocument.delete({ where: { id: input.documentId } });

  await logAction({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    moduleKey: "teams",
    entityType: "TeamDocument",
    entityId: input.documentId,
    action: "team_document_deleted",
    beforeJson: {
      teamId: input.teamId,
      title: doc.title,
      originalFilename: doc.originalFilename,
    },
  });

  await storage.delete(storageKey).catch((err: unknown) => {
    console.warn("[team-document-service] blob deletion failed after DB delete", {
      documentId: input.documentId,
      error: String(err),
    });
  });
}

export async function downloadTeamDocument(input: DownloadTeamDocumentInput) {
  const doc = await resolveDocument(
    input.tenantId,
    input.teamId,
    input.documentId,
  );
  if (!doc) {
    throw new TeamDocumentServiceError(
      "DOCUMENT_NOT_FOUND",
      "Dokument nicht gefunden.",
    );
  }

  const storage = input.storage ?? teamDocumentStorage;

  try {
    const result = await storage.download({
      storageKey: doc.storageKey,
      filename: doc.originalFilename,
      contentType: doc.mimeType,
    });

    return {
      stream: result.stream,
      filename: doc.originalFilename,
      contentType: result.contentType,
      sizeBytes: result.sizeBytes,
    };
  } catch (error) {
    throw mapStorageError(error);
  }
}

export { validateTeamDocumentUpload };
