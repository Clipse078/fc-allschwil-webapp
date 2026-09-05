import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  personDocumentFindUnique: vi.fn(),
  personDocumentDelete: vi.fn(),
  storageDownload: vi.fn(),
  storageDelete: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    personDocument: {
      findUnique: mocks.personDocumentFindUnique,
      delete: mocks.personDocumentDelete,
    },
  },
}));

vi.mock("@/lib/workspace/upload-storage", () => ({
  workspaceStorageProvider: {
    download: mocks.storageDownload,
    delete: mocks.storageDelete,
  },
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import {
  deletePersonDocument,
  downloadPersonDocument,
} from "@/lib/people/person-document-service";

function tenantBDocument() {
  return {
    id: "document-b",
    tenantId: "tenant-b",
    personId: "person-b",
    category: "IDENTITY_DOCUMENT",
    title: "Identity document",
    storageKey:
      "workspace/tenant-b/document-b/v1/identity.pdf",
    storageUrl: null,
    originalFilename: "identity.pdf",
    mimeType: "application/pdf",
    sizeBytes: 100,
    issueDate: null,
    expiryDate: null,
    notes: null,
    uploadedByUserId: "user-b",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  };
}

describe("SECURITY-GO-LIVE-01L Person document isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.personDocumentFindUnique.mockResolvedValue(
      tenantBDocument(),
    );
  });

  it("Tenant A cannot download Tenant B private document by ID", async () => {
    await expect(
      downloadPersonDocument({
        tenantId: "tenant-a",
        personId: "person-b",
        documentId: "document-b",
      }),
    ).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND",
    });

    expect(mocks.storageDownload).not.toHaveBeenCalled();
  });

  it("Tenant A cannot delete Tenant B private document or Blob", async () => {
    await expect(
      deletePersonDocument({
        tenantId: "tenant-a",
        personId: "person-b",
        documentId: "document-b",
        actorUserId: "user-a",
      }),
    ).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND",
    });

    expect(mocks.personDocumentDelete).not.toHaveBeenCalled();
    expect(mocks.storageDelete).not.toHaveBeenCalled();
    expect(mocks.logAction).not.toHaveBeenCalled();
  });
});
