/**
 * @vitest-environment node
 *
 * TEAM-COCKPIT-PREMIUM-01K — Team photo API route tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiTeamDocumentAccess: vi.fn(),
  teamFindFirst: vi.fn(),
  validateTeamPhotoFile: vi.fn(),
  uploadTeamPhoto: vi.fn(),
  removeTeamPhoto: vi.fn(),
}));

vi.mock("@/lib/teams/team-document-auth", () => ({
  requireApiTeamDocumentAccess: mocks.requireApiTeamDocumentAccess,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: { findFirst: mocks.teamFindFirst },
  },
}));

vi.mock("@/lib/teams/team-photo-shared", () => ({
  validateTeamPhotoFile: mocks.validateTeamPhotoFile,
  uploadTeamPhoto: mocks.uploadTeamPhoto,
  removeTeamPhoto: mocks.removeTeamPhoto,
}));

import { POST, DELETE } from "@/app/api/teams/[teamId]/photo/route";
import { NextRequest } from "next/server";

const TEAM_A = "team-a";
const TENANT_A = "tenant-a";

const manageAccess = {
  ok: true as const,
  session: { user: { id: "user-trainer", effectiveUserId: null } },
  access: {
    userId: "user-trainer",
    tenantId: TENANT_A,
    tenantKey: "fca",
    teamId: TEAM_A,
    canViewDocuments: true,
    canManageDocuments: true,
  },
};

const viewOnlyAccess = {
  ...manageAccess,
  access: {
    ...manageAccess.access,
    canManageDocuments: false,
  },
};

const TEAM = { id: TEAM_A, photoUrl: null, tenantId: TENANT_A };

function makeContext(teamId: string) {
  return { params: Promise.resolve({ teamId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  mocks.requireApiTeamDocumentAccess.mockResolvedValue(manageAccess);
  mocks.teamFindFirst.mockResolvedValue(TEAM);
});

describe("POST /api/teams/[teamId]/photo — authorization", () => {
  it("A. assigned trainer can upload", async () => {
    mocks.validateTeamPhotoFile.mockResolvedValueOnce({
      ok: true,
      buffer: Buffer.from("img"),
      mime: "image/jpeg",
      ext: "jpg",
    });
    mocks.uploadTeamPhoto.mockResolvedValueOnce({
      ok: true,
      photoUrl: "https://blob.example.com/team-photos/fca/team-a.jpg",
    });

    const fd = new FormData();
    fd.append("file", new Blob(["data"], { type: "image/jpeg" }), "photo.jpg");
    const res = await POST(
      new NextRequest("http://localhost/api/teams/team-a/photo", { method: "POST", body: fd }),
      makeContext(TEAM_A),
    );

    expect(res.status).toBe(200);
    expect(mocks.uploadTeamPhoto).toHaveBeenCalled();
  });

  it("D. assigned player cannot mutate", async () => {
    mocks.requireApiTeamDocumentAccess.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: viewOnlyAccess.session,
    });

    const fd = new FormData();
    fd.append("file", new Blob(["data"], { type: "image/jpeg" }), "photo.jpg");
    const res = await POST(
      new NextRequest("http://localhost/api/teams/team-a/photo", { method: "POST", body: fd }),
      makeContext(TEAM_A),
    );

    expect(res.status).toBe(403);
  });

  it("H. unallocated teams.manage user denied", async () => {
    mocks.requireApiTeamDocumentAccess.mockResolvedValueOnce({
      ok: false,
      status: 404,
      error: "Team nicht gefunden.",
      session: { user: { id: "user-manage" } },
    });

    const fd = new FormData();
    fd.append("file", new Blob(["data"], { type: "image/jpeg" }), "photo.jpg");
    const res = await POST(
      new NextRequest("http://localhost/api/teams/team-a/photo", { method: "POST", body: fd }),
      makeContext(TEAM_A),
    );

    expect(res.status).toBe(404);
  });

  it("I. cross-team trainer denied", async () => {
    mocks.requireApiTeamDocumentAccess.mockResolvedValueOnce({
      ok: false,
      status: 404,
      error: "Team nicht gefunden.",
      session: manageAccess.session,
    });

    const fd = new FormData();
    fd.append("file", new Blob(["data"], { type: "image/jpeg" }), "photo.jpg");
    const res = await POST(
      new NextRequest("http://localhost/api/teams/team-b/photo", { method: "POST", body: fd }),
      makeContext("team-b"),
    );

    expect(res.status).toBe(404);
  });

  it("returns 503 without BLOB_READ_WRITE_TOKEN", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const fd = new FormData();
    fd.append("file", new Blob(["data"], { type: "image/jpeg" }), "photo.jpg");
    const res = await POST(
      new NextRequest("http://localhost/api/teams/team-a/photo", { method: "POST", body: fd }),
      makeContext(TEAM_A),
    );

    expect(res.status).toBe(503);
  });
});

describe("POST /api/teams/[teamId]/photo — validation", () => {
  it("returns validation error from validateTeamPhotoFile", async () => {
    mocks.validateTeamPhotoFile.mockResolvedValueOnce({
      ok: false,
      status: 400,
      error: "Nicht erlaubter Dateityp.",
    });

    const fd = new FormData();
    fd.append("file", new Blob(["data"], { type: "image/gif" }), "photo.gif");
    const res = await POST(
      new NextRequest("http://localhost/api/teams/team-a/photo", { method: "POST", body: fd }),
      makeContext(TEAM_A),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Dateityp");
  });

  it("X. failed new upload leaves old image intact (no DB update on upload failure)", async () => {
    mocks.validateTeamPhotoFile.mockResolvedValueOnce({
      ok: true,
      buffer: Buffer.from("img"),
      mime: "image/jpeg",
      ext: "jpg",
    });
    mocks.uploadTeamPhoto.mockResolvedValueOnce({
      ok: false,
      status: 500,
      error: "Teamfoto konnte nicht hochgeladen werden.",
    });

    const fd = new FormData();
    fd.append("file", new Blob(["data"], { type: "image/jpeg" }), "photo.jpg");
    const res = await POST(
      new NextRequest("http://localhost/api/teams/team-a/photo", { method: "POST", body: fd }),
      makeContext(TEAM_A),
    );

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/teams/[teamId]/photo", () => {
  it("C. assigned trainer can remove", async () => {
    mocks.teamFindFirst.mockResolvedValueOnce({
      ...TEAM,
      photoUrl: "https://blob.example.com/photo.jpg",
    });
    mocks.removeTeamPhoto.mockResolvedValueOnce({ ok: true, message: "Teamfoto entfernt." });

    const res = await DELETE(
      new NextRequest("http://localhost/api/teams/team-a/photo", { method: "DELETE" }),
      makeContext(TEAM_A),
    );

    expect(res.status).toBe(200);
    expect(mocks.removeTeamPhoto).toHaveBeenCalled();
  });

  it("B. assigned trainer can replace via POST", async () => {
    mocks.teamFindFirst.mockResolvedValueOnce({
      ...TEAM,
      photoUrl: "https://blob.example.com/old.jpg",
    });
    mocks.validateTeamPhotoFile.mockResolvedValueOnce({
      ok: true,
      buffer: Buffer.from("img"),
      mime: "image/jpeg",
      ext: "jpg",
    });
    mocks.uploadTeamPhoto.mockResolvedValueOnce({
      ok: true,
      photoUrl: "https://blob.example.com/new.jpg",
    });

    const fd = new FormData();
    fd.append("file", new Blob(["data"], { type: "image/jpeg" }), "photo.jpg");
    const res = await POST(
      new NextRequest("http://localhost/api/teams/team-a/photo", { method: "POST", body: fd }),
      makeContext(TEAM_A),
    );

    expect(res.status).toBe(200);
    expect(mocks.uploadTeamPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPhotoUrl: "https://blob.example.com/old.jpg",
      }),
    );
  });

  it("player cannot remove", async () => {
    mocks.requireApiTeamDocumentAccess.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: viewOnlyAccess.session,
    });

    const res = await DELETE(
      new NextRequest("http://localhost/api/teams/team-a/photo", { method: "DELETE" }),
      makeContext(TEAM_A),
    );

    expect(res.status).toBe(403);
  });
});
