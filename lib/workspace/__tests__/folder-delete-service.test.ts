/**
 * lib/workspace/__tests__/folder-delete-service.test.ts
 *
 * ADMIN-DELETE-WORKSPACE-01 — Unit tests for the WorkspaceFolder permanent-
 * delete service. All DB interactions are mocked.
 *
 * TEST COVERAGE MAP:
 *   getWorkspaceFolderDeletionImpact
 *     1.  Returns impact for a leaf folder (no descendants, no documents).
 *     2.  Returns correct descendant and document counts for a folder with children.
 *     3.  Returns null when folder does not exist.
 *     4.  Returns null for a wrong-tenant folder (cross-tenant safety).
 *     5.  Throws INVALID_INPUT for a blank tenantId.
 *     6.  Throws INVALID_INPUT for a blank folderId.
 *
 *   deleteWorkspaceFolderPermanently
 *     7.  Happy path: active folder with no descendants is deleted.
 *     8.  Happy path: archived folder is deleted (archivedAt state is irrelevant).
 *     9.  Entire subtree is collected and deleted in one transaction.
 *    10.  Throws FOLDER_NOT_FOUND for a missing folder.
 *    11.  Throws TENANT_FORBIDDEN for a wrong-tenant folder.
 *    12.  Throws INVALID_INPUT for a blank tenantId.
 *    13.  Throws INVALID_INPUT for a blank folderId.
 *    14.  WorkspaceFolderDeleteServiceError is instanceof Error with typed code.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workspaceFolderFindFirst: vi.fn(),
  workspaceFolderFindMany: vi.fn(),
  workspaceFolderDeleteMany: vi.fn(),
  workspaceDocumentCount: vi.fn(),
  transactionFn: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    workspaceFolder: {
      findFirst: (...args: unknown[]) => mocks.workspaceFolderFindFirst(...args),
      findMany: (...args: unknown[]) => mocks.workspaceFolderFindMany(...args),
      deleteMany: (...args: unknown[]) => mocks.workspaceFolderDeleteMany(...args),
    },
    workspaceDocument: {
      count: (...args: unknown[]) => mocks.workspaceDocumentCount(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        workspaceFolder: {
          deleteMany: (...args: unknown[]) => mocks.workspaceFolderDeleteMany(...args),
        },
      }),
  },
}));

import {
  deleteWorkspaceFolderPermanently,
  getWorkspaceFolderDeletionImpact,
  WorkspaceFolderDeleteServiceError,
} from "../folder-delete-service";

const FOLDER_ID = "folder-root-01";
const CHILD_ID_A = "folder-child-a";
const CHILD_ID_B = "folder-child-b";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspaceFolderDeleteMany.mockResolvedValue({ count: 1 });
  mocks.workspaceDocumentCount.mockResolvedValue(0);
});

// ── getWorkspaceFolderDeletionImpact ─────────────────────────────────────────

describe("getWorkspaceFolderDeletionImpact", () => {
  it("1 — leaf folder: zero descendants and zero documents", async () => {
    mocks.workspaceFolderFindFirst.mockResolvedValueOnce({ id: FOLDER_ID });
    mocks.workspaceFolderFindMany.mockResolvedValueOnce([]);
    mocks.workspaceDocumentCount.mockResolvedValueOnce(0);

    const result = await getWorkspaceFolderDeletionImpact(TENANT_A, FOLDER_ID);

    expect(result).toEqual({ descendantFolderCount: 0, documentCount: 0 });
  });

  it("2 — folder with two children and three documents", async () => {
    mocks.workspaceFolderFindFirst.mockResolvedValueOnce({ id: FOLDER_ID });
    // BFS: first call returns root's children; child calls return no grandchildren.
    mocks.workspaceFolderFindMany
      .mockResolvedValueOnce([{ id: CHILD_ID_A }, { id: CHILD_ID_B }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mocks.workspaceDocumentCount.mockResolvedValueOnce(3);

    const result = await getWorkspaceFolderDeletionImpact(TENANT_A, FOLDER_ID);

    expect(result).toEqual({ descendantFolderCount: 2, documentCount: 3 });
  });

  it("3 — returns null when folder does not exist", async () => {
    mocks.workspaceFolderFindFirst.mockResolvedValueOnce(null);

    const result = await getWorkspaceFolderDeletionImpact(TENANT_A, FOLDER_ID);

    expect(result).toBeNull();
    expect(mocks.workspaceFolderFindMany).not.toHaveBeenCalled();
  });

  it("4 — returns null for wrong-tenant folder (cross-tenant safety)", async () => {
    // findFirst scoped to tenantId returns null for wrong tenant
    mocks.workspaceFolderFindFirst.mockResolvedValueOnce(null);

    const result = await getWorkspaceFolderDeletionImpact(TENANT_B, FOLDER_ID);

    expect(result).toBeNull();
  });

  it("5 — throws INVALID_INPUT for blank tenantId", async () => {
    await expect(
      getWorkspaceFolderDeletionImpact("  ", FOLDER_ID),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    expect(mocks.workspaceFolderFindFirst).not.toHaveBeenCalled();
  });

  it("6 — throws INVALID_INPUT for blank folderId", async () => {
    await expect(
      getWorkspaceFolderDeletionImpact(TENANT_A, ""),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    expect(mocks.workspaceFolderFindFirst).not.toHaveBeenCalled();
  });
});

// ── deleteWorkspaceFolderPermanently ─────────────────────────────────────────

describe("deleteWorkspaceFolderPermanently", () => {
  it("7 — happy path: leaf folder deleted, result returned", async () => {
    mocks.workspaceFolderFindFirst.mockResolvedValueOnce({
      id: FOLDER_ID,
      tenantId: TENANT_A,
      name: "Trainers",
    });
    mocks.workspaceFolderFindMany.mockResolvedValueOnce([]);
    mocks.workspaceDocumentCount.mockResolvedValueOnce(0);
    mocks.workspaceFolderDeleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await deleteWorkspaceFolderPermanently(TENANT_A, FOLDER_ID);

    expect(mocks.workspaceFolderDeleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: [FOLDER_ID] },
        tenantId: TENANT_A,
      },
    });
    expect(result.folderId).toBe(FOLDER_ID);
    expect(result.folderName).toBe("Trainers");
    expect(result.deletedFolderCount).toBe(1);
    expect(result.impact.descendantFolderCount).toBe(0);
    expect(result.impact.documentCount).toBe(0);
  });

  it("8 — archived folder is deleted (archivedAt state is not checked)", async () => {
    mocks.workspaceFolderFindFirst.mockResolvedValueOnce({
      id: FOLDER_ID,
      tenantId: TENANT_A,
      name: "Archived Folder",
    });
    mocks.workspaceFolderFindMany.mockResolvedValueOnce([]);
    mocks.workspaceDocumentCount.mockResolvedValueOnce(0);
    mocks.workspaceFolderDeleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await deleteWorkspaceFolderPermanently(TENANT_A, FOLDER_ID);

    expect(result.folderId).toBe(FOLDER_ID);
    expect(mocks.workspaceFolderDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [FOLDER_ID] } }),
      }),
    );
  });

  it("9 — subtree (root + 2 children) collected and deleted in single call", async () => {
    mocks.workspaceFolderFindFirst.mockResolvedValueOnce({
      id: FOLDER_ID,
      tenantId: TENANT_A,
      name: "Root",
    });
    // BFS: root children
    mocks.workspaceFolderFindMany
      .mockResolvedValueOnce([{ id: CHILD_ID_A }, { id: CHILD_ID_B }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mocks.workspaceDocumentCount.mockResolvedValueOnce(2);
    mocks.workspaceFolderDeleteMany.mockResolvedValueOnce({ count: 3 });

    const result = await deleteWorkspaceFolderPermanently(TENANT_A, FOLDER_ID);

    const deletedIds = mocks.workspaceFolderDeleteMany.mock.calls[0][0].where.id.in;
    expect(deletedIds).toHaveLength(3);
    expect(deletedIds).toContain(FOLDER_ID);
    expect(deletedIds).toContain(CHILD_ID_A);
    expect(deletedIds).toContain(CHILD_ID_B);

    expect(result.deletedFolderCount).toBe(3);
    expect(result.impact.descendantFolderCount).toBe(2);
    expect(result.impact.documentCount).toBe(2);
  });

  it("10 — throws FOLDER_NOT_FOUND for missing folder", async () => {
    mocks.workspaceFolderFindFirst.mockResolvedValueOnce(null);

    await expect(
      deleteWorkspaceFolderPermanently(TENANT_A, FOLDER_ID),
    ).rejects.toMatchObject({ code: "FOLDER_NOT_FOUND" });

    expect(mocks.workspaceFolderDeleteMany).not.toHaveBeenCalled();
  });

  it("11 — throws TENANT_FORBIDDEN for wrong-tenant folder", async () => {
    mocks.workspaceFolderFindFirst.mockResolvedValueOnce({
      id: FOLDER_ID,
      tenantId: TENANT_B,
      name: "Other Tenant Folder",
    });

    await expect(
      deleteWorkspaceFolderPermanently(TENANT_A, FOLDER_ID),
    ).rejects.toMatchObject({ code: "TENANT_FORBIDDEN" });

    expect(mocks.workspaceFolderDeleteMany).not.toHaveBeenCalled();
  });

  it("12 — throws INVALID_INPUT for blank tenantId", async () => {
    await expect(
      deleteWorkspaceFolderPermanently("  ", FOLDER_ID),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    expect(mocks.workspaceFolderFindFirst).not.toHaveBeenCalled();
  });

  it("13 — throws INVALID_INPUT for blank folderId", async () => {
    await expect(
      deleteWorkspaceFolderPermanently(TENANT_A, ""),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    expect(mocks.workspaceFolderFindFirst).not.toHaveBeenCalled();
  });

  it("14 — WorkspaceFolderDeleteServiceError is instanceof Error with typed code", () => {
    const err = new WorkspaceFolderDeleteServiceError("FOLDER_NOT_FOUND", "test");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("FOLDER_NOT_FOUND");
    expect(err.name).toBe("WorkspaceFolderDeleteServiceError");
  });
});
