import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membership: vi.fn(),
  attachment: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenantMembership: { findFirst: mocks.membership },
    communicationAttachment: { findFirst: mocks.attachment },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({ logAction: mocks.audit }));

import {
  downloadCommunicationAttachment,
} from "@/lib/communication/attachment-download-service";

const record = {
  id: "attachment-a",
  storageKey: "communication/tenant-a/attachment-a/file.pdf",
  sanitizedFilename: "file.pdf",
  contentType: "application/pdf",
  sizeBytes: 3,
  lifecycleStatus: "READY",
  scanStatus: "PENDING",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.membership.mockResolvedValue({ id: "membership-a" });
  mocks.attachment.mockResolvedValue(record);
  mocks.audit.mockResolvedValue(undefined);
});

describe("communication attachment download service", () => {
  it("streams a legitimately associated tenant attachment without storage internals", async () => {
    const stream = new ReadableStream<Uint8Array>();
    const storage = {
      upload: vi.fn(),
      download: vi.fn().mockResolvedValue({
        stream,
        contentType: "application/pdf",
        sizeBytes: 3,
      }),
      delete: vi.fn(),
    };
    const result = await downloadCommunicationAttachment({
      tenantId: "tenant-a",
      actorUserId: "user-a",
      attachmentId: "attachment-a",
      storage,
    });
    expect(mocks.attachment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-a",
          messageLinks: expect.any(Object),
        }),
      }),
    );
    expect(result).toEqual({
      stream,
      filename: "file.pdf",
      contentType: "application/pdf",
      sizeBytes: 3,
    });
    expect(result).not.toHaveProperty("storageKey");
  });

  it("blocks unauthorized users and foreign-tenant attachments", async () => {
    mocks.membership.mockResolvedValue(null);
    await expect(
      downloadCommunicationAttachment({
        tenantId: "tenant-a",
        actorUserId: "outsider",
        attachmentId: "attachment-a",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    mocks.membership.mockResolvedValue({ id: "membership-a" });
    mocks.attachment.mockResolvedValue(null);
    await expect(
      downloadCommunicationAttachment({
        tenantId: "tenant-a",
        actorUserId: "user-a",
        attachmentId: "foreign",
      }),
    ).rejects.toMatchObject({ code: "ATTACHMENT_NOT_FOUND" });
  });

  it.each(["QUARANTINED", "FAILED"])(
    "blocks %s scan state before reading Blob",
    async (scanStatus) => {
      const storage = {
        upload: vi.fn(),
        download: vi.fn(),
        delete: vi.fn(),
      };
      mocks.attachment.mockResolvedValue({ ...record, scanStatus });
      await expect(
        downloadCommunicationAttachment({
          tenantId: "tenant-a",
          actorUserId: "user-a",
          attachmentId: "attachment-a",
          storage,
        }),
      ).rejects.toMatchObject({ code: "ATTACHMENT_UNAVAILABLE" });
      expect(storage.download).not.toHaveBeenCalled();
    },
  );
});
