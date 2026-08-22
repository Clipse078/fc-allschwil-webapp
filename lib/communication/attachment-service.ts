import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import {
  communicationAttachmentStorage,
  getCommunicationStorageKey,
  readStorageStream,
  type CommunicationAttachmentStorage,
} from "@/lib/communication/attachment-storage";
import {
  MAX_COMMUNICATION_ATTACHMENT_SIZE_BYTES,
  validateCommunicationAttachment,
  validateCommunicationAttachmentSet,
} from "@/lib/communication/attachment-validation";

export type CommunicationAttachmentServiceErrorCode =
  | "INVALID_INPUT"
  | "FORBIDDEN"
  | "ATTACHMENT_NOT_FOUND"
  | "MESSAGE_NOT_FOUND"
  | "DOCUMENT_VERSION_NOT_FOUND"
  | "ATTACHMENT_UNAVAILABLE"
  | "ORDER_CONFLICT"
  | "STORAGE_FAILED"
  | "PERSISTENCE_FAILED";

export class CommunicationAttachmentServiceError extends Error {
  constructor(
    readonly code: CommunicationAttachmentServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CommunicationAttachmentServiceError";
  }
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new CommunicationAttachmentServiceError(
      "INVALID_INPUT",
      `${field} is required.`,
    );
  }
  return normalized;
}

async function requireTenantActor(tenantId: string, actorUserId: string) {
  const membership = await prisma.tenantMembership.findFirst({
    where: {
      tenantId,
      userId: actorUserId,
      isActive: true,
      tenant: { status: "ACTIVE" },
      user: { isActive: true },
    },
    select: { id: true },
  });
  if (!membership) {
    throw new CommunicationAttachmentServiceError(
      "FORBIDDEN",
      "Der Benutzer gehört nicht zum aktiven Mandanten.",
    );
  }
}

type PersistBytesInput = {
  tenantId: string;
  actorUserId: string;
  originalFilename: string;
  declaredContentType: string;
  buffer: Uint8Array;
  sourceType: "UPLOAD" | "WORKSPACE_DOCUMENT_VERSION";
  sourceDocumentId?: string;
  sourceDocumentVersionId?: string;
  ingestionMetadata?: Prisma.InputJsonValue;
  storage: CommunicationAttachmentStorage;
};

async function persistBytes(input: PersistBytesInput) {
  const validated = await validateCommunicationAttachment({
    filename: input.originalFilename,
    declaredContentType: input.declaredContentType,
    buffer: input.buffer,
  });
  const id = randomUUID();
  const expectedStorageKey = getCommunicationStorageKey({
    tenantId: input.tenantId,
    attachmentId: id,
    filename: validated.sanitizedFilename,
  });

  let uploaded;
  try {
    uploaded = await input.storage.upload({
      storageKey: expectedStorageKey,
      contentType: validated.contentType,
      buffer: input.buffer,
    });
  } catch {
    throw new CommunicationAttachmentServiceError(
      "STORAGE_FAILED",
      "Der Anhang konnte nicht im privaten Speicher abgelegt werden.",
    );
  }

  try {
    const attachment = await prisma.communicationAttachment.create({
      data: {
        id,
        tenantId: input.tenantId,
        storageKey: uploaded.storageKey,
        originalFilename: validated.originalFilename,
        sanitizedFilename: validated.sanitizedFilename,
        contentType: validated.contentType,
        sizeBytes: uploaded.sizeBytes,
        checksumSha256: uploaded.checksumSha256,
        sourceType: input.sourceType,
        sourceDocumentId: input.sourceDocumentId ?? null,
        sourceDocumentVersionId: input.sourceDocumentVersionId ?? null,
        ingestionMetadata: input.ingestionMetadata,
        lifecycleStatus: "READY",
        // Transitional policy: no scanner is integrated. Strong content
        // validation succeeds, while scanStatus remains explicitly PENDING.
        scanStatus: "PENDING",
        createdByUserId: input.actorUserId,
      },
    });
    await logAction({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      moduleKey: "registrations",
      entityType: "CommunicationAttachment",
      entityId: attachment.id,
      action: "COMMUNICATION_ATTACHMENT_CREATED",
      afterJson: {
        sourceType: input.sourceType,
        filename: validated.sanitizedFilename,
        contentType: validated.contentType,
        sizeBytes: uploaded.sizeBytes,
        checksumSha256: uploaded.checksumSha256,
      },
    });
    return attachment;
  } catch {
    await input.storage.delete(uploaded.storageKey);
    throw new CommunicationAttachmentServiceError(
      "PERSISTENCE_FAILED",
      "Die Anhangsmetadaten konnten nicht gespeichert werden.",
    );
  }
}

export async function createUploadedAttachment(input: {
  tenantId: string;
  actorUserId: string;
  filename: string;
  declaredContentType: string;
  buffer: Uint8Array;
  ingestionMetadata?: Prisma.InputJsonValue;
  storage?: CommunicationAttachmentStorage;
}) {
  const tenantId = required(input.tenantId, "tenantId");
  const actorUserId = required(input.actorUserId, "actorUserId");
  await requireTenantActor(tenantId, actorUserId);
  return persistBytes({
    tenantId,
    actorUserId,
    originalFilename: input.filename,
    declaredContentType: input.declaredContentType,
    buffer: input.buffer,
    sourceType: "UPLOAD",
    ingestionMetadata: input.ingestionMetadata,
    storage: input.storage ?? communicationAttachmentStorage,
  });
}

export async function snapshotWorkspaceDocumentVersion(input: {
  tenantId: string;
  actorUserId: string;
  workspaceDocumentVersionId: string;
  storage?: CommunicationAttachmentStorage;
}) {
  const tenantId = required(input.tenantId, "tenantId");
  const actorUserId = required(input.actorUserId, "actorUserId");
  const versionId = required(
    input.workspaceDocumentVersionId,
    "workspaceDocumentVersionId",
  );
  await requireTenantActor(tenantId, actorUserId);

  const version = await prisma.workspaceDocumentVersion.findFirst({
    where: { id: versionId, tenantId },
    select: {
      id: true,
      tenantId: true,
      documentId: true,
      filename: true,
      mimeType: true,
      storageKey: true,
    },
  });
  if (!version) {
    throw new CommunicationAttachmentServiceError(
      "DOCUMENT_VERSION_NOT_FOUND",
      "Dokumentversion nicht gefunden.",
    );
  }

  const storage = input.storage ?? communicationAttachmentStorage;
  let source;
  try {
    source = await storage.download({
      storageKey: version.storageKey,
      filename: version.filename,
      contentType: version.mimeType,
    });
  } catch {
    throw new CommunicationAttachmentServiceError(
      "STORAGE_FAILED",
      "Die Dokumentversion konnte nicht gelesen werden.",
    );
  }
  const buffer = await readStorageStream(
    source.stream,
    MAX_COMMUNICATION_ATTACHMENT_SIZE_BYTES,
  );

  return persistBytes({
    tenantId,
    actorUserId,
    originalFilename: version.filename,
    declaredContentType: version.mimeType,
    buffer,
    sourceType: "WORKSPACE_DOCUMENT_VERSION",
    sourceDocumentId: version.documentId,
    sourceDocumentVersionId: version.id,
    storage,
  });
}

export async function attachToMessage(input: {
  tenantId: string;
  actorUserId: string;
  messageId: string;
  attachmentId: string;
  sortOrder: number;
}) {
  const tenantId = required(input.tenantId, "tenantId");
  const actorUserId = required(input.actorUserId, "actorUserId");
  if (!Number.isSafeInteger(input.sortOrder) || input.sortOrder < 0) {
    throw new CommunicationAttachmentServiceError(
      "INVALID_INPUT",
      "sortOrder must be a non-negative safe integer.",
    );
  }
  await requireTenantActor(tenantId, actorUserId);

  const result = await prisma.$transaction(async (tx) => {
    const [message, attachment, existingLinks] = await Promise.all([
      tx.communicationMessage.findFirst({
        where: { id: required(input.messageId, "messageId"), tenantId },
        select: { id: true, threadId: true },
      }),
      tx.communicationAttachment.findFirst({
        where: {
          id: required(input.attachmentId, "attachmentId"),
          tenantId,
          lifecycleStatus: "READY",
          scanStatus: { notIn: ["QUARANTINED", "FAILED"] },
        },
        select: { id: true, sizeBytes: true },
      }),
      tx.communicationMessageAttachment.findMany({
        where: { tenantId, messageId: input.messageId.trim() },
        select: {
          id: true,
          attachmentId: true,
          sortOrder: true,
          attachment: { select: { sizeBytes: true } },
        },
      }),
    ]);
    if (!message) {
      throw new CommunicationAttachmentServiceError(
        "MESSAGE_NOT_FOUND",
        "Nachricht nicht gefunden.",
      );
    }
    if (!attachment) {
      throw new CommunicationAttachmentServiceError(
        "ATTACHMENT_NOT_FOUND",
        "Anhang nicht gefunden oder nicht verfügbar.",
      );
    }
    const duplicate = existingLinks.find(
      (link) => link.attachmentId === attachment.id,
    );
    if (duplicate) return duplicate;
    if (existingLinks.some((link) => link.sortOrder === input.sortOrder)) {
      throw new CommunicationAttachmentServiceError(
        "ORDER_CONFLICT",
        "Die Anhangsposition ist bereits belegt.",
      );
    }
    validateCommunicationAttachmentSet([
      ...existingLinks.map((link) => link.attachment),
      attachment,
    ]);
    return tx.communicationMessageAttachment.create({
      data: {
        tenantId,
        messageId: message.id,
        attachmentId: attachment.id,
        sortOrder: input.sortOrder,
      },
    });
  });

  await logAction({
    tenantId,
    actorUserId,
    moduleKey: "registrations",
    entityType: "CommunicationMessage",
    entityId: input.messageId.trim(),
    action: "COMMUNICATION_ATTACHMENT_LINKED",
    afterJson: {
      attachmentId: input.attachmentId.trim(),
      sortOrder: input.sortOrder,
    },
  });
  return result;
}

export async function cloneMessageAttachmentsForRetry(input: {
  tenantId: string;
  actorUserId: string;
  sourceMessageId: string;
  retryMessageId: string;
}) {
  const tenantId = required(input.tenantId, "tenantId");
  const actorUserId = required(input.actorUserId, "actorUserId");
  const sourceMessageId = required(input.sourceMessageId, "sourceMessageId");
  const retryMessageId = required(input.retryMessageId, "retryMessageId");
  await requireTenantActor(tenantId, actorUserId);

  return prisma.$transaction(async (tx) => {
    const messages = await tx.communicationMessage.findMany({
      where: { tenantId, id: { in: [sourceMessageId, retryMessageId] } },
      select: { id: true },
    });
    if (messages.length !== 2) {
      throw new CommunicationAttachmentServiceError(
        "MESSAGE_NOT_FOUND",
        "Quell- oder Wiederholungsnachricht nicht gefunden.",
      );
    }

    const [sourceLinks, retryLinks] = await Promise.all([
      tx.communicationMessageAttachment.findMany({
        where: { tenantId, messageId: sourceMessageId },
        select: { attachmentId: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      }),
      tx.communicationMessageAttachment.findMany({
        where: { tenantId, messageId: retryMessageId },
        select: { attachmentId: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    if (retryLinks.length > 0) {
      const same =
        retryLinks.length === sourceLinks.length &&
        retryLinks.every(
          (link, index) =>
            link.attachmentId === sourceLinks[index]?.attachmentId &&
            link.sortOrder === sourceLinks[index]?.sortOrder,
        );
      if (!same) {
        throw new CommunicationAttachmentServiceError(
          "ORDER_CONFLICT",
          "Die Wiederholungsnachricht besitzt bereits andere Anhänge.",
        );
      }
      return retryLinks;
    }

    if (sourceLinks.length > 0) {
      await tx.communicationMessageAttachment.createMany({
        data: sourceLinks.map((link) => ({
          tenantId,
          messageId: retryMessageId,
          attachmentId: link.attachmentId,
          sortOrder: link.sortOrder,
        })),
      });
    }
    return sourceLinks;
  });
}
