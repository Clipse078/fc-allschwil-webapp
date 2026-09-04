import { prisma } from "@/lib/db/prisma";
import {
  ingestInboundAttachment,
} from "@/lib/communication/attachment-service";
import type {
  CommunicationAttachmentStorage,
} from "@/lib/communication/attachment-storage";
import {
  readLegacyCommunicationAttachments,
} from "@/lib/communication/attachment-metadata";
import {
  validateCommunicationAttachmentSet,
} from "@/lib/communication/attachment-validation";
import type {
  InboundEmailAttachment,
  InboundEmailAttachmentRetriever,
} from "@/lib/communication/inbound-email-types";

export type InboundAttachmentProcessingResult = {
  processed: number;
  failed: number;
};

function mergeInboundAttachmentMetadata(
  primary: InboundEmailAttachment,
  fallback?: InboundEmailAttachment,
): InboundEmailAttachment {
  if (!fallback) return primary;
  return {
    id: primary.id,
    filename: primary.filename ?? fallback.filename,
    contentType: primary.contentType ?? fallback.contentType,
    contentDisposition: primary.contentDisposition ?? fallback.contentDisposition,
    contentId: primary.contentId ?? fallback.contentId,
    size: primary.size ?? fallback.size,
    processingStatus: primary.processingStatus ?? fallback.processingStatus,
  };
}

function dedupeInboundAttachments(
  attachments: InboundEmailAttachment[],
): InboundEmailAttachment[] {
  const byId = new Map<string, InboundEmailAttachment>();
  for (const attachment of attachments) {
    const id = attachment.id.trim();
    if (!id) continue;
    byId.set(id, mergeInboundAttachmentMetadata(attachment, byId.get(id)));
  }
  return [...byId.values()];
}

/**
 * Merges provider-normalized references with any legacy metadata already stored
 * on the inbound message, then excludes attachments that already have durable
 * relational storage.
 */
export async function resolveInboundAttachmentsToProcess(input: {
  tenantId: string;
  messageId: string;
  normalizedAttachments: InboundEmailAttachment[] | null;
  legacyAttachments?: unknown;
}): Promise<InboundEmailAttachment[]> {
  const legacy = readLegacyCommunicationAttachments(input.legacyAttachments);
  const candidates = dedupeInboundAttachments([
    ...(input.normalizedAttachments ?? []),
    ...legacy.filter(
      (attachment) => attachment.processingStatus !== "FAILED",
    ),
  ]);
  if (candidates.length === 0) {
    return [];
  }

  const storedLinks = await prisma.communicationMessageAttachment.findMany({
    where: {
      tenantId: input.tenantId,
      messageId: input.messageId,
      attachment: {
        tenantId: input.tenantId,
        sourceType: "INBOUND",
      },
    },
    select: {
      attachment: {
        select: {
          ingestionMetadata: true,
        },
      },
    },
  });
  const storedProviderIds = new Set(
    storedLinks.flatMap((link) => {
      const metadata = link.attachment.ingestionMetadata;
      if (
        !metadata ||
        typeof metadata !== "object" ||
        Array.isArray(metadata)
      ) {
        return [];
      }
      const providerAttachmentId = (metadata as { providerAttachmentId?: unknown })
        .providerAttachmentId;
      return typeof providerAttachmentId === "string" &&
        providerAttachmentId.trim()
        ? [providerAttachmentId.trim()]
        : [];
    }),
  );

  return candidates.filter((attachment) => !storedProviderIds.has(attachment.id.trim()));
}

async function recordFailures(input: {
  tenantId: string;
  messageId: string;
  failed: InboundEmailAttachment[];
}) {
  await prisma.communicationMessage.updateMany({
    where: {
      id: input.messageId,
      tenantId: input.tenantId,
      direction: "INBOUND",
    },
    data: {
      attachments:
        input.failed.length === 0
          ? []
          : input.failed.map((attachment) => ({
              ...attachment,
              processingStatus: "FAILED" as const,
            })),
    },
  });
}

/**
 * Processes provider references only after the inbound message is durable.
 * Individual failures are reduced to safe message metadata; the message itself
 * remains visible and successful attachments remain downloadable.
 */
export async function processInboundEmailAttachments(input: {
  tenantId: string;
  messageId: string;
  provider: string;
  providerMessageId: string;
  attachments: InboundEmailAttachment[];
  retrieve: InboundEmailAttachmentRetriever;
  storage?: CommunicationAttachmentStorage;
}): Promise<InboundAttachmentProcessingResult> {
  if (input.attachments.length === 0) {
    return { processed: 0, failed: 0 };
  }

  try {
    validateCommunicationAttachmentSet(
      input.attachments.map((attachment) => ({
        sizeBytes: attachment.size ?? -1,
      })),
    );
  } catch {
    await recordFailures({
      tenantId: input.tenantId,
      messageId: input.messageId,
      failed: input.attachments,
    });
    return { processed: 0, failed: input.attachments.length };
  }

  const failed: InboundEmailAttachment[] = [];
  let processed = 0;
  for (const [sortOrder, metadata] of input.attachments.entries()) {
    try {
      const retrieved = await input.retrieve(metadata);
      if (
        retrieved.providerAttachmentId !== metadata.id ||
        retrieved.buffer.byteLength !== retrieved.sizeBytes
      ) {
        throw new Error("Provider attachment metadata mismatch.");
      }
      await ingestInboundAttachment({
        tenantId: input.tenantId,
        messageId: input.messageId,
        provider: input.provider,
        providerMessageId: input.providerMessageId,
        providerAttachmentId: retrieved.providerAttachmentId,
        filename: retrieved.filename,
        declaredContentType: retrieved.contentType,
        buffer: retrieved.buffer,
        sortOrder,
        storage: input.storage,
      });
      processed += 1;
    } catch {
      failed.push(metadata);
    }
  }

  await recordFailures({
    tenantId: input.tenantId,
    messageId: input.messageId,
    failed,
  });
  return { processed, failed: failed.length };
}
