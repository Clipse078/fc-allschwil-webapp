import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  messageUpdateMany: vi.fn(),
  messageFindFirst: vi.fn(),
  linkFindMany: vi.fn(),
  ingestInboundAttachment: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    communicationMessage: {
      updateMany: mocks.messageUpdateMany,
      findFirst: mocks.messageFindFirst,
    },
    communicationMessageAttachment: {
      findMany: mocks.linkFindMany,
    },
  },
}));
vi.mock("@/lib/communication/attachment-service", () => ({
  ingestInboundAttachment: mocks.ingestInboundAttachment,
}));

import {
  processInboundEmailAttachments,
  resolveInboundAttachmentsToProcess,
} from "@/lib/communication/inbound-attachment-service";

function metadata(id: string, size = 10) {
  return {
    id,
    filename: `${id}.pdf`,
    contentType: "application/pdf",
    contentDisposition: "attachment",
    contentId: null,
    size,
  };
}

function retrieved(id: string, size = 10) {
  return {
    providerAttachmentId: id,
    filename: `${id}.pdf`,
    contentType: "application/pdf",
    sizeBytes: size,
    buffer: new Uint8Array(size),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.messageUpdateMany.mockResolvedValue({ count: 1 });
  mocks.messageFindFirst.mockResolvedValue({ attachments: null });
  mocks.linkFindMany.mockResolvedValue([]);
  mocks.ingestInboundAttachment.mockResolvedValue({
    attachment: { id: "stored" },
    link: { id: "link" },
  });
});

describe("resolveInboundAttachmentsToProcess", () => {
  it("resumes legacy metadata-only attachments on webhook replay", async () => {
    mocks.linkFindMany.mockResolvedValue([]);
    await expect(
      resolveInboundAttachmentsToProcess({
        tenantId: "tenant-a",
        messageId: "message-a",
        normalizedAttachments: null,
        legacyAttachments: [metadata("attachment-a")],
      }),
    ).resolves.toEqual([metadata("attachment-a")]);
  });

  it("skips attachments that already have durable relational storage", async () => {
    mocks.linkFindMany.mockResolvedValue([
      {
        attachment: {
          ingestionMetadata: {
            providerAttachmentId: "attachment-a",
          },
        },
      },
    ]);
    await expect(
      resolveInboundAttachmentsToProcess({
        tenantId: "tenant-a",
        messageId: "message-a",
        normalizedAttachments: [metadata("attachment-a")],
        legacyAttachments: [metadata("attachment-a")],
      }),
    ).resolves.toEqual([]);
  });
});

describe("inbound attachment lifecycle", () => {
  it("keeps inbound replies without attachments unchanged", async () => {
    const retrieve = vi.fn();
    await expect(
      processInboundEmailAttachments({
        tenantId: "tenant-a",
        messageId: "message-a",
        provider: "resend",
        providerMessageId: "email-a",
        attachments: [],
        retrieve,
      }),
    ).resolves.toEqual({ processed: 0, failed: 0 });
    expect(retrieve).not.toHaveBeenCalled();
    expect(mocks.messageUpdateMany).not.toHaveBeenCalled();
  });

  it("stores one attachment canonically and associates it with the inbound message", async () => {
    const item = metadata("attachment-a");
    const retrieve = vi.fn().mockResolvedValue(retrieved("attachment-a"));

    await expect(
      processInboundEmailAttachments({
        tenantId: "tenant-a",
        messageId: "message-a",
        provider: "resend",
        providerMessageId: "email-a",
        attachments: [item],
        retrieve,
      }),
    ).resolves.toEqual({ processed: 1, failed: 0 });
    expect(mocks.ingestInboundAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        messageId: "message-a",
        providerAttachmentId: "attachment-a",
        filename: "attachment-a.pdf",
        sortOrder: 0,
      }),
    );
    expect(mocks.messageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attachments: [] } }),
    );
  });

  it("preserves provider ordering for multiple attachments", async () => {
    const attachments = [metadata("first"), metadata("second")];
    const retrieve = vi.fn(async (item) => retrieved(item.id));

    await processInboundEmailAttachments({
      tenantId: "tenant-a",
      messageId: "message-a",
      provider: "resend",
      providerMessageId: "email-a",
      attachments,
      retrieve,
    });

    expect(mocks.ingestInboundAttachment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ providerAttachmentId: "first", sortOrder: 0 }),
    );
    expect(mocks.ingestInboundAttachment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ providerAttachmentId: "second", sortOrder: 1 }),
    );
  });

  it("preserves the message and records a safe state for retrieval or storage failures", async () => {
    const attachments = [metadata("provider-fail"), metadata("storage-fail")];
    const retrieve = vi.fn()
      .mockRejectedValueOnce(new Error("signed URL expired"))
      .mockResolvedValueOnce(retrieved("storage-fail"));
    mocks.ingestInboundAttachment.mockRejectedValueOnce(
      new Error("private storage unavailable"),
    );

    await expect(
      processInboundEmailAttachments({
        tenantId: "tenant-a",
        messageId: "message-a",
        provider: "resend",
        providerMessageId: "email-a",
        attachments,
        retrieve,
      }),
    ).resolves.toEqual({ processed: 0, failed: 2 });
    expect(mocks.messageUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "message-a",
        tenantId: "tenant-a",
        direction: "INBOUND",
      },
      data: {
        attachments: attachments.map((item) => ({
          ...item,
          processingStatus: "FAILED",
        })),
      },
    });
  });

  it("enforces the canonical file-count limit before provider retrieval", async () => {
    const attachments = Array.from({ length: 11 }, (_, index) =>
      metadata(`attachment-${index}`, 1),
    );
    const retrieve = vi.fn();
    await expect(
      processInboundEmailAttachments({
        tenantId: "tenant-a",
        messageId: "message-a",
        provider: "resend",
        providerMessageId: "email-a",
        attachments,
        retrieve,
      }),
    ).resolves.toEqual({ processed: 0, failed: 11 });
    expect(retrieve).not.toHaveBeenCalled();
    expect(mocks.ingestInboundAttachment).not.toHaveBeenCalled();
  });

  it("accepts provider bytes when receiving metadata size differs", async () => {
    const item = metadata("attachment-a", 10);
    const retrieve = vi.fn().mockResolvedValue({
      ...retrieved("attachment-a", 17),
      sizeBytes: 17,
      buffer: new Uint8Array(17),
    });

    await expect(
      processInboundEmailAttachments({
        tenantId: "tenant-a",
        messageId: "message-a",
        provider: "resend",
        providerMessageId: "email-a",
        attachments: [item],
        retrieve,
      }),
    ).resolves.toEqual({ processed: 1, failed: 0 });
    expect(mocks.ingestInboundAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        providerAttachmentId: "attachment-a",
        buffer: expect.any(Uint8Array),
      }),
    );
  });

  it("rejects malformed size metadata before provider retrieval", async () => {
    const retrieve = vi.fn();
    await processInboundEmailAttachments({
      tenantId: "tenant-a",
      messageId: "message-a",
      provider: "resend",
      providerMessageId: "email-a",
      attachments: [metadata("bad-size", -1)],
      retrieve,
    });
    expect(retrieve).not.toHaveBeenCalled();
    expect(mocks.messageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          attachments: [
            expect.objectContaining({ processingStatus: "FAILED" }),
          ],
        },
      }),
    );
  });
});
