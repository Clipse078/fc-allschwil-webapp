import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  messageUpdateMany: vi.fn(),
  ingestInboundAttachment: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    communicationMessage: { updateMany: mocks.messageUpdateMany },
  },
}));
vi.mock("@/lib/communication/attachment-service", () => ({
  ingestInboundAttachment: mocks.ingestInboundAttachment,
}));

import { processInboundEmailAttachments } from "@/lib/communication/inbound-attachment-service";

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
  mocks.ingestInboundAttachment.mockResolvedValue({
    attachment: { id: "stored" },
    link: { id: "link" },
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
