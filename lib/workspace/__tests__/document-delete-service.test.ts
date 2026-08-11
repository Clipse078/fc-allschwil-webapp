/**
 * lib/workspace/__tests__/document-delete-service.test.ts
 *
 * ADMIN-DELETE-03A — Unit tests for the WorkspaceDocument permanent-delete
 * service. All DB and storage interactions are mocked.
 *
 * TEST COVERAGE MAP:
 *   1. getWorkspaceDocumentDeletionImpact — returns versionCount for own-tenant doc.
 *   2. getWorkspaceDocumentDeletionImpact — returns null for missing doc.
 *   3. getWorkspaceDocumentDeletionImpact — returns null for wrong-tenant doc (cross-tenant safety).
 *   4. deleteWorkspaceDocumentPermanently — happy path: DB deleted, storage cleaned up.
 *   5. deleteWorkspaceDocumentPermanently — throws DOCUMENT_NOT_FOUND for missing doc.
 *   6. deleteWorkspaceDocumentPermanently — throws TENANT_FORBIDDEN for wrong-tenant doc.
 *   7. deleteWorkspaceDocumentPermanently — storage cleanup called for all versions.
 *   8. deleteWorkspaceDocumentPermanently — storage failure does not throw (best-effort).
 *   9. deleteWorkspaceDocumentPermanently — INVALID_INPUT for blank tenantId.
 *  10. deleteWorkspaceDocumentPermanently — INVALID_INPUT for blank documentId.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workspaceDocumentFindUnique: vi.fn(),
  workspaceDocumentDelete: vi.fn(),
  storageDelete: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    workspaceDocument: {
      findUnique: (...args: unknown[]) => mocks.workspaceDocumentFindUnique(...args),
      delete: (...args: unknown[]) => mocks.workspaceDocumentDelete(...args),
    },
  },
}));

vi.mock("@/lib/workspace/upload-storage", () => ({
  workspaceStorageProvider: {
    delete: (...args: unknown[]) => mocks.storageDelete(...args),
  },
}));

import {
  deleteWorkspaceDocumentPermanently,
  getWorkspaceDocumentDeletionImpact,
  WorkspaceDocumentDeleteServiceError,
} from "../document-delete-service";

const DOC_ID = "doc-test-01";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeDocumentWithVersions(versions: { id: string; storageKey: string; storageUrl?: string | null }[]) {
  return {
    id: DOC_ID,
    tenantId: TENANT_A,
    name: "Test Document",
    versions,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspaceDocumentDelete.mockResolvedValue({ id: DOC_ID });
  mocks.storageDelete.mockResolvedValue(undefined);
});

describe("getWorkspaceDocumentDeletionImpact", () => {
  it("1 — returns versionCount for own-tenant document", async () => {
    mocks.workspaceDocumentFindUnique.mockResolvedValueOnce({
      id: DOC_ID,
      tenantId: TENANT_A,
      _count: { versions: 3 },
    });

    const result = await getWorkspaceDocumentDeletionImpact(TENANT_A, DOC_ID);

    expect(result).toEqual({ versionCount: 3 });
  });

  it("2 — returns null when document does not exist", async () => {
    mocks.workspaceDocumentFindUnique.mockResolvedValueOnce(null);

    const result = await getWorkspaceDocumentDeletionImpact(TENANT_A, DOC_ID);

    expect(result).toBeNull();
  });

  it("3 — returns null for wrong-tenant document (cross-tenant safety)", async () => {
    mocks.workspaceDocumentFindUnique.mockResolvedValueOnce({
      id: DOC_ID,
      tenantId: TENANT_B,
      _count: { versions: 1 },
    });

    const result = await getWorkspaceDocumentDeletionImpact(TENANT_A, DOC_ID);

    expect(result).toBeNull();
  });
});

describe("deleteWorkspaceDocumentPermanently", () => {
  it("4 — happy path: DB deleted, storage cleaned up, correct result returned", async () => {
    mocks.workspaceDocumentFindUnique.mockResolvedValueOnce(
      makeDocumentWithVersions([
        { id: "v1", storageKey: "workspace/tenant-a/doc/v1/file.pdf", storageUrl: "https://blob.example/file.pdf" },
        { id: "v2", storageKey: "workspace/tenant-a/doc/v2/file.pdf", storageUrl: null },
      ]),
    );

    const result = await deleteWorkspaceDocumentPermanently(TENANT_A, DOC_ID);

    expect(mocks.workspaceDocumentDelete).toHaveBeenCalledWith({
      where: { id: DOC_ID },
    });
    expect(result.documentId).toBe(DOC_ID);
    expect(result.documentName).toBe("Test Document");
    expect(result.impact.versionCount).toBe(2);
  });

  it("5 — throws DOCUMENT_NOT_FOUND for missing document", async () => {
    mocks.workspaceDocumentFindUnique.mockResolvedValueOnce(null);

    await expect(
      deleteWorkspaceDocumentPermanently(TENANT_A, DOC_ID),
    ).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND",
    });

    expect(mocks.workspaceDocumentDelete).not.toHaveBeenCalled();
    expect(mocks.storageDelete).not.toHaveBeenCalled();
  });

  it("6 — throws TENANT_FORBIDDEN for wrong-tenant document", async () => {
    mocks.workspaceDocumentFindUnique.mockResolvedValueOnce(
      makeDocumentWithVersions([]),
    );

    await expect(
      deleteWorkspaceDocumentPermanently(TENANT_B, DOC_ID),
    ).rejects.toMatchObject({
      code: "TENANT_FORBIDDEN",
    });

    expect(mocks.workspaceDocumentDelete).not.toHaveBeenCalled();
  });

  it("7 — storage delete called for all version blobs (storageUrl preferred over storageKey)", async () => {
    mocks.workspaceDocumentFindUnique.mockResolvedValueOnce(
      makeDocumentWithVersions([
        { id: "v1", storageKey: "workspace/key1", storageUrl: "https://blob.example/url1" },
        { id: "v2", storageKey: "workspace/key2", storageUrl: null },
      ]),
    );

    await deleteWorkspaceDocumentPermanently(TENANT_A, DOC_ID);

    expect(mocks.storageDelete).toHaveBeenCalledTimes(2);
    expect(mocks.storageDelete).toHaveBeenNthCalledWith(1, "https://blob.example/url1");
    expect(mocks.storageDelete).toHaveBeenNthCalledWith(2, "workspace/key2");
  });

  it("8 — storage failure does not throw (best-effort cleanup; DB delete already committed)", async () => {
    mocks.workspaceDocumentFindUnique.mockResolvedValueOnce(
      makeDocumentWithVersions([
        { id: "v1", storageKey: "workspace/key1", storageUrl: "https://blob.example/url1" },
      ]),
    );
    mocks.storageDelete.mockRejectedValueOnce(new Error("Blob unreachable"));

    // Should resolve without throwing
    await expect(
      deleteWorkspaceDocumentPermanently(TENANT_A, DOC_ID),
    ).resolves.toBeDefined();
  });

  it("9 — throws INVALID_INPUT for blank tenantId", async () => {
    await expect(
      deleteWorkspaceDocumentPermanently("  ", DOC_ID),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    expect(mocks.workspaceDocumentFindUnique).not.toHaveBeenCalled();
  });

  it("10 — throws INVALID_INPUT for blank documentId", async () => {
    await expect(
      deleteWorkspaceDocumentPermanently(TENANT_A, ""),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    expect(mocks.workspaceDocumentFindUnique).not.toHaveBeenCalled();
  });

  it("WorkspaceDocumentDeleteServiceError is instanceof Error", () => {
    const err = new WorkspaceDocumentDeleteServiceError("DOCUMENT_NOT_FOUND", "test");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("DOCUMENT_NOT_FOUND");
  });
});
