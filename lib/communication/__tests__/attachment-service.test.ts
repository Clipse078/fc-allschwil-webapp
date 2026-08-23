import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  tenantMembershipFindFirst: vi.fn(),
  attachmentCreate: vi.fn(),
  attachmentDelete: vi.fn(),
  attachmentFindFirst: vi.fn(),
  attachmentFindMany: vi.fn(),
  messageFindFirst: vi.fn(),
  messageFindMany: vi.fn(),
  linkFindMany: vi.fn(),
  linkCreate: vi.fn(),
  linkCreateMany: vi.fn(),
  versionFindFirst: vi.fn(),
  logAction: vi.fn(),
}));

const tx = {
  communicationMessage: {
    findFirst: mocks.messageFindFirst,
    findMany: mocks.messageFindMany,
  },
  communicationAttachment: {
    findFirst: mocks.attachmentFindFirst,
  },
  communicationMessageAttachment: {
    findMany: mocks.linkFindMany,
    create: mocks.linkCreate,
    createMany: mocks.linkCreateMany,
  },
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenantMembership: { findFirst: mocks.tenantMembershipFindFirst },
    communicationAttachment: {
      create: mocks.attachmentCreate,
      delete: mocks.attachmentDelete,
      findFirst: mocks.attachmentFindFirst,
      findMany: mocks.attachmentFindMany,
    },
    communicationMessage: { findFirst: mocks.messageFindFirst },
    communicationMessageAttachment: { findMany: mocks.linkFindMany },
    workspaceDocumentVersion: { findFirst: mocks.versionFindFirst },
    $transaction: vi.fn((callback) => callback(tx)),
  },
}));
vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import {
  attachToMessage,
  cloneMessageAttachmentsForRetry,
  createUploadedAttachment,
  ingestInboundAttachment,
  loadMessageAttachmentsForDelivery,
  snapshotWorkspaceDocumentVersion,
  validateOutboundAttachmentSelection,
} from "@/lib/communication/attachment-service";

const pdf = new TextEncoder().encode("%PDF-1.7\nattachment");

function storage() {
  return {
    upload: vi.fn().mockImplementation(async ({ storageKey, buffer }) => ({
      storageKey,
      checksumSha256:
        "0d830bd8610558881ae41896c63f79a818024acf7ac04889db66e88a255fb836",
      sizeBytes: buffer.byteLength,
    })),
    download: vi.fn(),
    delete: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tenantMembershipFindFirst.mockResolvedValue({ id: "membership-a" });
  mocks.attachmentDelete.mockResolvedValue({ id: "attachment-a" });
  mocks.logAction.mockResolvedValue(undefined);
});

describe("communication attachment domain service", () => {
  it("persists tenant metadata, checksum, sanitized filename and PENDING scan state", async () => {
    const provider = storage();
    mocks.attachmentCreate.mockImplementation(async ({ data }) => data);

    const result = await createUploadedAttachment({
      tenantId: "tenant-a",
      actorUserId: "user-a",
      filename: "../Contract: Final.pdf",
      declaredContentType: "application/pdf",
      buffer: pdf,
      storage: provider,
    });

    expect(result).toMatchObject({
      tenantId: "tenant-a",
      originalFilename: "../Contract: Final.pdf",
      sanitizedFilename: "Contract- Final.pdf",
      sourceType: "UPLOAD",
      lifecycleStatus: "READY",
      scanStatus: "PENDING",
    });
    expect(result.storageKey).toMatch(
      /^communication\/tenant-a\/[a-f0-9-]+\/Contract- Final\.pdf$/,
    );
    expect(result.checksumSha256).toHaveLength(64);
    expect(result).not.toHaveProperty("storageUrl");
  });

  it("ingests inbound bytes through canonical validation and private storage", async () => {
    const provider = storage();
    mocks.messageFindFirst.mockResolvedValue({ id: "message-inbound" });
    mocks.attachmentCreate.mockImplementation(async ({ data }) => data);
    mocks.linkFindMany.mockResolvedValue([]);
    mocks.linkCreate.mockImplementation(async ({ data }) => data);

    const result = await ingestInboundAttachment({
      tenantId: "tenant-a",
      messageId: "message-inbound",
      provider: "resend",
      providerMessageId: "email-a",
      providerAttachmentId: "provider-attachment-a",
      filename: "../Antwort Final.pdf",
      declaredContentType: "application/pdf",
      buffer: pdf,
      sortOrder: 0,
      storage: provider,
    });

    expect(result.attachment).toMatchObject({
      tenantId: "tenant-a",
      sanitizedFilename: "Antwort Final.pdf",
      sourceType: "INBOUND",
      createdByUserId: null,
      lifecycleStatus: "READY",
    });
    expect(result.link).toMatchObject({
      tenantId: "tenant-a",
      messageId: "message-inbound",
      attachmentId: result.attachment.id,
      sortOrder: 0,
    });
    expect(provider.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        storageKey: expect.stringMatching(/^communication\/tenant-a\//),
        buffer: pdf,
      }),
    );
    expect(mocks.tenantMembershipFindFirst).not.toHaveBeenCalled();
  });

  it("best-effort deletes the private object when metadata persistence fails", async () => {
    const provider = storage();
    mocks.attachmentCreate.mockRejectedValue(new Error("database unavailable"));
    await expect(
      createUploadedAttachment({
        tenantId: "tenant-a",
        actorUserId: "user-a",
        filename: "file.pdf",
        declaredContentType: "application/pdf",
        buffer: pdf,
        storage: provider,
      }),
    ).rejects.toMatchObject({ code: "PERSISTENCE_FAILED" });
    expect(provider.delete).toHaveBeenCalledWith(
      expect.stringMatching(/^communication\/tenant-a\//),
    );
  });

  it("copies immutable Workspace version bytes with source provenance", async () => {
    const provider = storage();
    provider.download.mockResolvedValue({
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(pdf);
          controller.close();
        },
      }),
      contentType: "application/pdf",
      sizeBytes: pdf.byteLength,
    });
    mocks.versionFindFirst.mockResolvedValue({
      id: "version-a",
      tenantId: "tenant-a",
      documentId: "document-a",
      filename: "contract.pdf",
      mimeType: "application/pdf",
      storageKey: "workspace/tenant-a/document-a/v1/contract.pdf",
    });
    mocks.attachmentCreate.mockImplementation(async ({ data }) => data);

    const result = await snapshotWorkspaceDocumentVersion({
      tenantId: "tenant-a",
      actorUserId: "user-a",
      workspaceDocumentVersionId: "version-a",
      storage: provider,
    });
    expect(result).toMatchObject({
      sourceType: "WORKSPACE_DOCUMENT_VERSION",
      sourceDocumentId: "document-a",
      sourceDocumentVersionId: "version-a",
    });
    expect(provider.download).toHaveBeenCalledWith({
      storageKey: "workspace/tenant-a/document-a/v1/contract.pdf",
      filename: "contract.pdf",
      contentType: "application/pdf",
    });
    expect(provider.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        storageKey: expect.stringMatching(/^communication\/tenant-a\//),
        buffer: pdf,
      }),
    );
  });

  it("blocks cross-tenant linking and duplicate ordering conflicts", async () => {
    mocks.messageFindFirst.mockResolvedValue({
      id: "message-a",
      threadId: "thread-a",
    });
    mocks.attachmentFindFirst.mockResolvedValue(null);
    mocks.linkFindMany.mockResolvedValue([]);
    await expect(
      attachToMessage({
        tenantId: "tenant-a",
        actorUserId: "user-a",
        messageId: "message-a",
        attachmentId: "foreign-attachment",
        sortOrder: 0,
      }),
    ).rejects.toMatchObject({ code: "ATTACHMENT_NOT_FOUND" });

    mocks.attachmentFindFirst.mockResolvedValue({
      id: "attachment-a",
      sizeBytes: 1,
    });
    mocks.linkFindMany.mockResolvedValue([
      {
        id: "link-existing",
        attachmentId: "attachment-other",
        sortOrder: 0,
        attachment: { sizeBytes: 1 },
      },
    ]);
    await expect(
      attachToMessage({
        tenantId: "tenant-a",
        actorUserId: "user-a",
        messageId: "message-a",
        attachmentId: "attachment-a",
        sortOrder: 0,
      }),
    ).rejects.toMatchObject({ code: "ORDER_CONFLICT" });
  });

  it("links in order idempotently without creating a duplicate", async () => {
    mocks.messageFindFirst.mockResolvedValue({
      id: "message-a",
      threadId: "thread-a",
    });
    mocks.attachmentFindFirst.mockResolvedValue({
      id: "attachment-a",
      sizeBytes: 1,
    });
    const existing = {
      id: "link-a",
      attachmentId: "attachment-a",
      sortOrder: 2,
      attachment: { sizeBytes: 1 },
    };
    mocks.linkFindMany.mockResolvedValue([existing]);
    await expect(
      attachToMessage({
        tenantId: "tenant-a",
        actorUserId: "user-a",
        messageId: "message-a",
        attachmentId: "attachment-a",
        sortOrder: 2,
      }),
    ).resolves.toEqual(existing);
    expect(mocks.linkCreate).not.toHaveBeenCalled();
  });

  it("allows validated PENDING and CLEAN selections while preserving client order", async () => {
    mocks.attachmentFindMany.mockResolvedValue([
      {
        id: "clean",
        lifecycleStatus: "READY",
        scanStatus: "CLEAN",
        sizeBytes: 2,
      },
      {
        id: "pending",
        lifecycleStatus: "READY",
        scanStatus: "PENDING",
        sizeBytes: 1,
      },
    ]);

    await expect(
      validateOutboundAttachmentSelection({
        tenantId: "tenant-a",
        actorUserId: "user-a",
        attachmentIds: ["pending", "clean"],
      }),
    ).resolves.toEqual(["pending", "clean"]);
    expect(mocks.attachmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-a", id: { in: ["pending", "clean"] } } }),
    );
  });

  it.each(["QUARANTINED", "FAILED"] as const)(
    "blocks %s attachments from outbound delivery",
    async (scanStatus) => {
      mocks.attachmentFindMany.mockResolvedValue([
        {
          id: "blocked",
          lifecycleStatus: "READY",
          scanStatus,
          sizeBytes: 1,
        },
      ]);
      await expect(
        validateOutboundAttachmentSelection({
          tenantId: "tenant-a",
          actorUserId: "user-a",
          attachmentIds: ["blocked"],
        }),
      ).rejects.toMatchObject({ code: "ATTACHMENT_UNAVAILABLE" });
    },
  );

  it("enforces outbound count, total size, duplicate, and tenant-scoped existence", async () => {
    await expect(
      validateOutboundAttachmentSelection({
        tenantId: "tenant-a",
        actorUserId: "user-a",
        attachmentIds: Array.from({ length: 11 }, (_, index) => `a-${index}`),
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      validateOutboundAttachmentSelection({
        tenantId: "tenant-a",
        actorUserId: "user-a",
        attachmentIds: ["same", "same"],
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    mocks.attachmentFindMany.mockResolvedValueOnce([]);
    await expect(
      validateOutboundAttachmentSelection({
        tenantId: "tenant-a",
        actorUserId: "user-a",
        attachmentIds: ["foreign"],
      }),
    ).rejects.toMatchObject({ code: "ATTACHMENT_NOT_FOUND" });

    mocks.attachmentFindMany.mockResolvedValueOnce([
      {
        id: "a",
        lifecycleStatus: "READY",
        scanStatus: "PENDING",
        sizeBytes: 10 * 1024 * 1024 + 1,
      },
      {
        id: "b",
        lifecycleStatus: "READY",
        scanStatus: "CLEAN",
        sizeBytes: 10 * 1024 * 1024,
      },
    ]);
    await expect(
      validateOutboundAttachmentSelection({
        tenantId: "tenant-a",
        actorUserId: "user-a",
        attachmentIds: ["a", "b"],
      }),
    ).rejects.toMatchObject({ code: "TOTAL_SIZE_EXCEEDED" });
  });

  it("loads exact associated bytes in sort order and verifies immutable integrity", async () => {
    const bytes = new TextEncoder().encode("immutable attachment");
    mocks.linkFindMany.mockResolvedValue([
      {
        attachmentId: "attachment-a",
        sortOrder: 0,
        attachment: {
          storageKey: "communication/tenant-a/attachment-a/file.txt",
          sanitizedFilename: "file.txt",
          contentType: "text/plain",
          sizeBytes: bytes.byteLength,
          checksumSha256: createHash("sha256").update(bytes).digest("hex"),
          lifecycleStatus: "READY",
          scanStatus: "PENDING",
        },
      },
    ]);
    const provider = storage();
    provider.download.mockResolvedValue({
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      contentType: "text/plain",
      sizeBytes: bytes.byteLength,
    });

    const result = await loadMessageAttachmentsForDelivery({
      tenantId: "tenant-a",
      messageId: "message-a",
      storage: provider,
    });
    expect(result).toEqual([
      {
        attachmentId: "attachment-a",
        filename: "file.txt",
        contentType: "text/plain",
        sizeBytes: bytes.byteLength,
        content: Buffer.from(bytes),
      },
    ]);
  });

  it("clones ordered associations to the same objects and leaves source untouched", async () => {
    mocks.messageFindMany.mockResolvedValue([
      { id: "source" },
      { id: "retry" },
    ]);
    const source = [
      { attachmentId: "attachment-a", sortOrder: 0 },
      { attachmentId: "attachment-b", sortOrder: 1 },
    ];
    mocks.linkFindMany
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce([]);
    mocks.linkCreateMany.mockResolvedValue({ count: 2 });
    await expect(
      cloneMessageAttachmentsForRetry({
        tenantId: "tenant-a",
        actorUserId: "user-a",
        sourceMessageId: "source",
        retryMessageId: "retry",
      }),
    ).resolves.toEqual(source);
    expect(mocks.linkCreateMany).toHaveBeenCalledWith({
      data: [
        {
          tenantId: "tenant-a",
          messageId: "retry",
          attachmentId: "attachment-a",
          sortOrder: 0,
        },
        {
          tenantId: "tenant-a",
          messageId: "retry",
          attachmentId: "attachment-b",
          sortOrder: 1,
        },
      ],
    });
    expect(mocks.linkCreate).not.toHaveBeenCalled();
  });
});
