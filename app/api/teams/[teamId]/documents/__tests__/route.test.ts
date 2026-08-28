/**
 * @vitest-environment node
 *
 * TEAM-COCKPIT-PREMIUM-01J-C — Team Document API route authorization.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiTeamDocumentAccess: vi.fn(),
  listTeamDocuments: vi.fn(),
  createTeamDocument: vi.fn(),
  getTeamDocument: vi.fn(),
  renameTeamDocument: vi.fn(),
  deleteTeamDocument: vi.fn(),
  downloadTeamDocument: vi.fn(),
  getTenantFromSession: vi.fn(),
  validateTeamDocumentUpload: vi.fn(),
}));

vi.mock("@/lib/teams/team-document-auth", () => ({
  requireApiTeamDocumentAccess: mocks.requireApiTeamDocumentAccess,
}));

vi.mock("@/lib/teams/team-document-service", () => ({
  listTeamDocuments: mocks.listTeamDocuments,
  createTeamDocument: mocks.createTeamDocument,
  getTeamDocument: mocks.getTeamDocument,
  renameTeamDocument: mocks.renameTeamDocument,
  deleteTeamDocument: mocks.deleteTeamDocument,
  downloadTeamDocument: mocks.downloadTeamDocument,
  TeamDocumentServiceError: class TeamDocumentServiceError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/tenants/queries", () => ({
  getTenantFromSession: mocks.getTenantFromSession,
}));

vi.mock("@/lib/teams/team-document-validation", () => ({
  validateTeamDocumentUpload: mocks.validateTeamDocumentUpload,
}));

import { DELETE, GET as GET_DOCUMENT, PATCH } from "@/app/api/teams/[teamId]/documents/[documentId]/route";
import { GET as GET_DOWNLOAD } from "@/app/api/teams/[teamId]/documents/[documentId]/download/route";
import { GET, POST } from "@/app/api/teams/[teamId]/documents/route";

const TEAM_A = "team-a";
const TEAM_B = "team-b";
const DOC_ID = "doc-1";
const TENANT_A = "tenant-a";

const allowedViewAccess = {
  ok: true as const,
  session: { user: { id: "user-1" } },
  access: {
    userId: "user-1",
    tenantId: TENANT_A,
    tenantKey: "fca",
    teamId: TEAM_A,
    canViewDocuments: true,
    canManageDocuments: false,
  },
};

const allowedManageAccess = {
  ...allowedViewAccess,
  access: {
    ...allowedViewAccess.access,
    canManageDocuments: true,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiTeamDocumentAccess.mockResolvedValue(allowedViewAccess);
  mocks.listTeamDocuments.mockResolvedValue([
    {
      id: DOC_ID,
      tenantId: TENANT_A,
      teamId: TEAM_A,
      title: "Plan",
      originalFilename: "plan.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      uploadedByUserId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      _storageKey: "secret",
    },
  ]);
  mocks.getTeamDocument.mockResolvedValue({
    id: DOC_ID,
    tenantId: TENANT_A,
    teamId: TEAM_A,
    title: "Plan",
    originalFilename: "plan.pdf",
    mimeType: "application/pdf",
    sizeBytes: 100,
    uploadedByUserId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    _storageKey: "secret",
  });
  mocks.downloadTeamDocument.mockResolvedValue({
    stream: new ReadableStream(),
    filename: "plan.pdf",
    contentType: "application/pdf",
    sizeBytes: 100,
  });
  mocks.getTenantFromSession.mockResolvedValue({ id: TENANT_A, key: "fca" });
  mocks.validateTeamDocumentUpload.mockResolvedValue({
    sanitizedFilename: "plan.pdf",
    contentType: "application/pdf",
  });
  mocks.createTeamDocument.mockResolvedValue({
    id: DOC_ID,
    tenantId: TENANT_A,
    teamId: TEAM_A,
    title: "Plan",
    originalFilename: "plan.pdf",
    mimeType: "application/pdf",
    sizeBytes: 100,
    uploadedByUserId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    _storageKey: "secret",
  });
  mocks.renameTeamDocument.mockResolvedValue({
    id: DOC_ID,
    tenantId: TENANT_A,
    teamId: TEAM_A,
    title: "New title",
    originalFilename: "plan.pdf",
    mimeType: "application/pdf",
    sizeBytes: 100,
    uploadedByUserId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    _storageKey: "secret",
  });
});

describe("TEAM-COCKPIT-PREMIUM-01J-C — documents list route", () => {
  it("list protected: checks team document access before listing", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ teamId: TEAM_A }),
    });

    expect(mocks.requireApiTeamDocumentAccess).toHaveBeenCalledWith(TEAM_A);
    expect(response.status).toBe(200);
  });

  it("list protected: denied access returns non-enumerable 404", async () => {
    mocks.requireApiTeamDocumentAccess.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Team nicht gefunden.",
      session: null,
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ teamId: TEAM_B }),
    });

    expect(response.status).toBe(404);
    expect(mocks.listTeamDocuments).not.toHaveBeenCalled();
  });
});

describe("TEAM-COCKPIT-PREMIUM-01J-C — upload route", () => {
  it("upload protected: requires manage access", async () => {
    const form = new FormData();
    form.set("file", new File(["%PDF"], "plan.pdf", { type: "application/pdf" }));
    form.set("title", "Plan");

    await POST(new Request("http://localhost", { method: "POST", body: form }), {
      params: Promise.resolve({ teamId: TEAM_A }),
    });

    expect(mocks.requireApiTeamDocumentAccess).toHaveBeenCalledWith(TEAM_A, {
      requireManage: true,
    });
  });
});

describe("TEAM-COCKPIT-PREMIUM-01J-C — rename/delete routes", () => {
  it("rename protected: requires manage access", async () => {
    mocks.requireApiTeamDocumentAccess.mockResolvedValue(allowedManageAccess);

    await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ title: "New title" }),
      }),
      { params: Promise.resolve({ teamId: TEAM_A, documentId: DOC_ID }) },
    );

    expect(mocks.requireApiTeamDocumentAccess).toHaveBeenCalledWith(TEAM_A, {
      requireManage: true,
    });
  });

  it("delete protected: requires manage access", async () => {
    mocks.requireApiTeamDocumentAccess.mockResolvedValue(allowedManageAccess);

    await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ teamId: TEAM_A, documentId: DOC_ID }),
    });

    expect(mocks.requireApiTeamDocumentAccess).toHaveBeenCalledWith(TEAM_A, {
      requireManage: true,
    });
  });

  it("11. cross-team documentId guessing => 404 from service scoping", async () => {
    mocks.getTeamDocument.mockResolvedValue(null);

    const response = await GET_DOCUMENT(new Request("http://localhost"), {
      params: Promise.resolve({ teamId: TEAM_B, documentId: DOC_ID }),
    });

    expect(response.status).toBe(404);
  });
});

describe("TEAM-COCKPIT-PREMIUM-01J-C — download route", () => {
  it("13. direct download URL requires team document access", async () => {
    const response = await GET_DOWNLOAD(new Request("http://localhost"), {
      params: Promise.resolve({ teamId: TEAM_A, documentId: DOC_ID }),
    });

    expect(mocks.requireApiTeamDocumentAccess).toHaveBeenCalledWith(TEAM_A);
    expect(response.status).toBe(200);
  });

  it("13b. direct download denied without team access", async () => {
    mocks.requireApiTeamDocumentAccess.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Team nicht gefunden.",
      session: null,
    });

    const response = await GET_DOWNLOAD(new Request("http://localhost"), {
      params: Promise.resolve({ teamId: TEAM_A, documentId: DOC_ID }),
    });

    expect(response.status).toBe(404);
    expect(mocks.downloadTeamDocument).not.toHaveBeenCalled();
  });

  it("12. cross-tenant document guessing => 404", async () => {
    mocks.downloadTeamDocument.mockRejectedValue(
      Object.assign(new Error("Dokument nicht gefunden."), {
        name: "TeamDocumentServiceError",
        code: "DOCUMENT_NOT_FOUND",
      }),
    );

    const { TeamDocumentServiceError } = await import("@/lib/teams/team-document-service");
    mocks.downloadTeamDocument.mockRejectedValue(
      new TeamDocumentServiceError("DOCUMENT_NOT_FOUND", "Dokument nicht gefunden."),
    );

    const response = await GET_DOWNLOAD(new Request("http://localhost"), {
      params: Promise.resolve({ teamId: TEAM_A, documentId: "foreign-doc" }),
    });

    expect(response.status).toBe(404);
  });
});
