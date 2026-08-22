import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import {
  communicationAttachmentStorage,
  type CommunicationAttachmentStorage,
} from "@/lib/communication/attachment-storage";
import {
  CommunicationAttachmentServiceError,
} from "@/lib/communication/attachment-service";

export type DownloadCommunicationAttachmentResult = {
  stream: ReadableStream<Uint8Array>;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export async function downloadCommunicationAttachment(input: {
  tenantId: string;
  actorUserId: string;
  attachmentId: string;
  storage?: CommunicationAttachmentStorage;
}): Promise<DownloadCommunicationAttachmentResult> {
  const tenantId = input.tenantId.trim();
  const actorUserId = input.actorUserId.trim();
  const attachmentId = input.attachmentId.trim();
  if (!tenantId || !actorUserId || !attachmentId) {
    throw new CommunicationAttachmentServiceError(
      "INVALID_INPUT",
      "tenantId, actorUserId and attachmentId are required.",
    );
  }

  const [membership, attachment] = await Promise.all([
    prisma.tenantMembership.findFirst({
      where: {
        tenantId,
        userId: actorUserId,
        isActive: true,
        tenant: { status: "ACTIVE" },
        user: { isActive: true },
      },
      select: { id: true },
    }),
    prisma.communicationAttachment.findFirst({
      where: {
        id: attachmentId,
        tenantId,
        messageLinks: {
          some: {
            tenantId,
            message: { tenantId, thread: { tenantId } },
          },
        },
      },
      select: {
        id: true,
        storageKey: true,
        sanitizedFilename: true,
        contentType: true,
        sizeBytes: true,
        lifecycleStatus: true,
        scanStatus: true,
      },
    }),
  ]);
  if (!membership) {
    throw new CommunicationAttachmentServiceError(
      "FORBIDDEN",
      "Der Benutzer gehört nicht zum aktiven Mandanten.",
    );
  }
  if (!attachment) {
    throw new CommunicationAttachmentServiceError(
      "ATTACHMENT_NOT_FOUND",
      "Anhang nicht gefunden.",
    );
  }
  if (
    attachment.lifecycleStatus !== "READY" ||
    attachment.scanStatus === "QUARANTINED" ||
    attachment.scanStatus === "FAILED"
  ) {
    throw new CommunicationAttachmentServiceError(
      "ATTACHMENT_UNAVAILABLE",
      "Der Anhang ist nicht zum Download freigegeben.",
    );
  }

  let download;
  try {
    download = await (
      input.storage ?? communicationAttachmentStorage
    ).download({
      storageKey: attachment.storageKey,
      filename: attachment.sanitizedFilename,
      contentType: attachment.contentType,
    });
  } catch {
    throw new CommunicationAttachmentServiceError(
      "STORAGE_FAILED",
      "Der Anhang konnte nicht geladen werden.",
    );
  }

  await logAction({
    tenantId,
    actorUserId,
    moduleKey: "registrations",
    entityType: "CommunicationAttachment",
    entityId: attachment.id,
    action: "COMMUNICATION_ATTACHMENT_DOWNLOADED",
    afterJson: {
      filename: attachment.sanitizedFilename,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
    },
  });

  return {
    stream: download.stream,
    filename: attachment.sanitizedFilename,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
  };
}
