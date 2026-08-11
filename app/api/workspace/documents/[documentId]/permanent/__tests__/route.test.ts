/**
 * app/api/workspace/documents/[documentId]/permanent/__tests__/route.test.ts
 *
 * ADMIN-DELETE-03A — Focused tests for the DELETE
 * /api/workspace/documents/[documentId]/permanent permanent-delete authorization
 * wiring AND the two-step "preview impact → explicit confirm" flow. The
 * resolver's own Club Admin / SCE Super Admin / delegated-user grant logic
 * is exhaustively covered at the resolver level — these tests verify the
 * ROUTE wiring only.
 *
 * All database and permission access is mocked. No live database access.
 *
 * TEST COVERAGE MAP:
 *   A. user with workspace.delete can permanently delete own-tenant Document
 *      (confirm=true → 200, delete called with correct tenant/docId).
 *   B. workspace.manage without workspace.delete: denied (403, delete not called).
 *   C. Cross-tenant deletion rejected (403, resolver called with doc's own tenantId).
 *   D. Document actually disappears — deleteWorkspaceDocumentPermanently called.
 *   E. Dependent cleanup/versions shown in impact (non-mutating preview step).
 *   F. Storage cleanup tested/mocked through service mock.
 *   G. Missing document handled safely (404, no auth or delete attempt).
 *   H. Delete inspection itself is non-mutating (no confirm → impact returned,
 *      deleteWorkspaceDocumentPermanently never called).
 *      Extra: 401 when no session.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  hasTenantDeletionAuthority: vi.fn(),
  logAction: vi.fn(),
  workspaceDocumentFindUnique: vi.fn(),
  deleteWorkspaceDocumentPermanently: vi.fn(),
  getWorkspaceDocumentDeletionImpact: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    hasTenantDeletionAuthority: mocks.hasTenantDeletionAuthority,
  }),
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    workspaceDocument: {
      findUnique: (...args: unknown[]) => mocks.workspaceDocumentFindUnique(...args),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/workspace/document-delete-service", () => {
  class WorkspaceDocumentDeleteServiceError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "WorkspaceDocumentDeleteServiceError";
      this.code = code;
    }
  }

  return {
    deleteWorkspaceDocumentPermanently: mocks.deleteWorkspaceDocumentPermanently,
    getWorkspaceDocumentDeletionImpact: mocks.getWorkspaceDocumentDeletionImpact,
    WorkspaceDocumentDeleteServiceError,
  };
});

import { DELETE } from "../route";

const DOC_ID = "doc-abc1";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeContext() {
  return { params: Promise.resolve({ documentId: DOC_ID }) };
}

function makeAuthSession(userId = "user-01", effectiveUserId?: string) {
  return { user: { id: userId, effectiveUserId: effectiveUserId ?? userId } };
}

function makeUrl(confirm?: boolean) {
  const base = `http://localhost/api/workspace/documents/${DOC_ID}/permanent`;
  return confirm ? `${base}?confirm=true` : base;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(makeAuthSession());
  mocks.workspaceDocumentFindUnique.mockResolvedValue({
    id: DOC_ID,
    tenantId: TENANT_A,
    name: "Annual Report 2025",
  });
  mocks.logAction.mockResolvedValue(undefined);
  mocks.getWorkspaceDocumentDeletionImpact.mockResolvedValue({ versionCount: 0 });
});

describe("DELETE /api/workspace/documents/[documentId]/permanent — ADMIN-DELETE-03A", () => {
  // ── A: authorized deletion ────────────────────────────────────────────────
  it("A — user with workspace.delete can permanently delete own-tenant document", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.workspaceDocumentFindUnique.mockResolvedValueOnce({
      id: DOC_ID,
      tenantId: TENANT_A,
      name: "Annual Report 2025",
    });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteWorkspaceDocumentPermanently.mockResolvedValueOnce({
      documentId: DOC_ID,
      documentName: "Annual Report 2025",
      impact: { versionCount: 3 },
    });

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toMatch(/endgültig gelöscht/);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith({
      userId: "club-admin-1",
      permission: "workspace.delete",
      tenantId: TENANT_A,
    });
    expect(mocks.deleteWorkspaceDocumentPermanently).toHaveBeenCalledWith(
      TENANT_A,
      DOC_ID,
    );
  });

  // ── B: workspace.manage-only cannot delete ────────────────────────────────
  it("B — workspace.manage without workspace.delete is denied (403), delete never called", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("manage-only-user"));
    mocks.workspaceDocumentFindUnique.mockResolvedValueOnce({
      id: DOC_ID,
      tenantId: TENANT_A,
      name: "Annual Report 2025",
    });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(false);

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ permission: "workspace.delete" }),
    );
    expect(mocks.deleteWorkspaceDocumentPermanently).not.toHaveBeenCalled();
  });

  // ── C: cross-tenant deletion rejected ────────────────────────────────────
  it("C — cross-tenant deletion rejected; resolver receives doc's own DB tenantId", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-b"));
    // Document belongs to TENANT_A, not to the user's TENANT_B
    mocks.workspaceDocumentFindUnique.mockResolvedValueOnce({
      id: DOC_ID,
      tenantId: TENANT_A,
      name: "Annual Report 2025",
    });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(false);

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(403);
    // The resolver must have been called with the document's actual tenant,
    // not any client-supplied value.
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A }),
    );
    expect(mocks.deleteWorkspaceDocumentPermanently).not.toHaveBeenCalled();
  });

  // ── D: document actually disappears ──────────────────────────────────────
  it("D — deleteWorkspaceDocumentPermanently is called with correct (tenantId, documentId)", async () => {
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteWorkspaceDocumentPermanently.mockResolvedValueOnce({
      documentId: DOC_ID,
      documentName: "Annual Report 2025",
      impact: { versionCount: 1 },
    });

    await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(mocks.deleteWorkspaceDocumentPermanently).toHaveBeenCalledWith(
      TENANT_A,
      DOC_ID,
    );
  });

  // ── E: dependent cleanup shown in impact (preview step) ──────────────────
  it("E — preview returns versionCount in impact and requiresConfirmation flag (non-mutating)", async () => {
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.getWorkspaceDocumentDeletionImpact.mockResolvedValueOnce({
      versionCount: 5,
    });

    const response = await DELETE(new NextRequest(makeUrl(false)), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresConfirmation).toBe(true);
    expect(body.impact.versionCount).toBe(5);
    expect(mocks.deleteWorkspaceDocumentPermanently).not.toHaveBeenCalled();
  });

  // ── F: storage cleanup is delegated to the service (mocked) ──────────────
  it("F — storage cleanup is handled inside the service (mocked; no direct blob call at route level)", async () => {
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteWorkspaceDocumentPermanently.mockResolvedValueOnce({
      documentId: DOC_ID,
      documentName: "Annual Report 2025",
      impact: { versionCount: 2 },
    });

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(200);
    // The service mock was called — storage cleanup responsibility is inside it.
    expect(mocks.deleteWorkspaceDocumentPermanently).toHaveBeenCalledOnce();
  });

  // ── G: missing document handled safely ───────────────────────────────────
  it("G — 404 when document does not exist (never authorizes or deletes)", async () => {
    mocks.workspaceDocumentFindUnique.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(404);
    expect(mocks.hasTenantDeletionAuthority).not.toHaveBeenCalled();
    expect(mocks.deleteWorkspaceDocumentPermanently).not.toHaveBeenCalled();
  });

  // ── H: non-mutating inspection (no confirm) ───────────────────────────────
  it("H — without confirm=true: returns impact and NEVER calls deleteWorkspaceDocumentPermanently", async () => {
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.getWorkspaceDocumentDeletionImpact.mockResolvedValueOnce({
      versionCount: 0,
    });

    const response = await DELETE(new NextRequest(makeUrl(false)), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresConfirmation).toBe(true);
    expect(mocks.deleteWorkspaceDocumentPermanently).not.toHaveBeenCalled();
  });

  // ── 401: no session ───────────────────────────────────────────────────────
  it("401 when there is no session", async () => {
    mocks.auth.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(401);
    expect(mocks.workspaceDocumentFindUnique).not.toHaveBeenCalled();
    expect(mocks.deleteWorkspaceDocumentPermanently).not.toHaveBeenCalled();
  });

  // ── SCE Super Admin cross-tenant ─────────────────────────────────────────
  it("SCE Super Admin: allowed for a document in a different ACTIVE tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("sce-super-admin-1"));
    mocks.workspaceDocumentFindUnique.mockResolvedValueOnce({
      id: DOC_ID,
      tenantId: TENANT_B,
      name: "Annual Report 2025",
    });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteWorkspaceDocumentPermanently.mockResolvedValueOnce({
      documentId: DOC_ID,
      documentName: "Annual Report 2025",
      impact: { versionCount: 0 },
    });

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith({
      userId: "sce-super-admin-1",
      permission: "workspace.delete",
      tenantId: TENANT_B,
    });
  });

  // ── client-supplied tenantId is ignored ──────────────────────────────────
  it("a client-supplied tenantId (query string) is ignored; the document's own DB tenantId is used", async () => {
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteWorkspaceDocumentPermanently.mockResolvedValueOnce({
      documentId: DOC_ID,
      documentName: "Annual Report 2025",
      impact: { versionCount: 0 },
    });

    const response = await DELETE(
      new NextRequest(
        `http://localhost/api/workspace/documents/${DOC_ID}/permanent?confirm=true&tenantId=${TENANT_B}`,
      ),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A }),
    );
    expect(mocks.deleteWorkspaceDocumentPermanently).toHaveBeenCalledWith(TENANT_A, DOC_ID);
  });

  // ── impact preview 404 when service returns null ──────────────────────────
  it("404 from preview when impact service returns null (document disappeared between lookup and impact)", async () => {
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.getWorkspaceDocumentDeletionImpact.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(makeUrl(false)), makeContext());

    expect(response.status).toBe(404);
    expect(mocks.deleteWorkspaceDocumentPermanently).not.toHaveBeenCalled();
  });
});
