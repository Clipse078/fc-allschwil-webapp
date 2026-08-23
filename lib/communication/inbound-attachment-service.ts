import { prisma } from "@/lib/db/prisma";
import {
  ingestInboundAttachment,
} from "@/lib/communication/attachment-service";
import type {
  CommunicationAttachmentStorage,
} from "@/lib/communication/attachment-storage";
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
      attachments: input.failed.map((attachment) => ({
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
        retrieved.sizeBytes !== metadata.size ||
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
