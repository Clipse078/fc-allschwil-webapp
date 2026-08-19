/**
 * PERSON-UX-09 — /api/people/[id]/profile-image route tests.
 *
 * Covers:
 *  1. POST requires people.manage permission
 *  2. DELETE requires people.manage permission
 *  3. POST tenant isolation: person not in tenant → 404
 *  4. DELETE tenant isolation: person not in tenant → 404
 *  5. POST validates file presence
 *  6. POST validates MIME type via validateImageFile
 *  7. POST succeeds: calls uploadPersonProfileImage and returns imageUrl
 *  8. DELETE succeeds: calls removePersonProfileImage
 *  9. DELETE when no imageUrl returns graceful message
 * 10. POST with no BLOB_READ_WRITE_TOKEN returns 503
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requireApiActiveTenantId: vi.fn(),
  personFindFirst: vi.fn(),
  tenantFindUnique: vi.fn(),
  validateImageFile: vi.fn(),
  uploadPersonProfileImage: vi.fn(),
  removePersonProfileImage: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));
vi.mock("@/lib/tenants/active-tenant", () => ({
  requireApiActiveTenantId: mocks.requireApiActiveTenantId,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    person: { findFirst: mocks.personFindFirst },
    tenant: { findUnique: mocks.tenantFindUnique },
  },
}));
vi.mock("@/lib/people/profile-image-shared", () => ({
  validateImageFile: mocks.validateImageFile,
  uploadPersonProfileImage: mocks.uploadPersonProfileImage,
  removePersonProfileImage: mocks.removePersonProfileImage,
}));
vi.mock("@/lib/audit/log-action", () => ({ logAction: mocks.logAction }));

import { POST, DELETE } from "@/app/api/people/[id]/profile-image/route";
import { NextRequest } from "next/server";

function makeContext(personId: string) {
  return { params: Promise.resolve({ id: personId }) };
}

function makeAuthorizedAccess(userId = "user-admin") {
  return {
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: userId, effectiveUserId: null, email: "admin@test.com", activeTenantId: "tenant-1" }, expires: "2099" },
  };
}

const PERSON = { id: "person-09", imageUrl: null, tenantId: "tenant-1" };
const TENANT = { key: "test-tenant" };

beforeEach(() => {
  vi.resetAllMocks();
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
});

// ── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/people/[id]/profile-image", () => {
  it("returns 401/403 when not authorized", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce({ ok: false, status: 403, error: "Forbidden." });
    const req = new NextRequest("http://localhost/api/people/person-09/profile-image", { method: "POST" });
    const res = await POST(req, makeContext("person-09"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when person not in tenant", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "tenant-1" });
    mocks.personFindFirst.mockResolvedValueOnce(null);

    const fd = new FormData();
    fd.append("file", new Blob(["data"], { type: "image/jpeg" }), "photo.jpg");
    const req = new NextRequest("http://localhost/api/people/other-person/profile-image", {
      method: "POST",
      body: fd,
    });
    const res = await POST(req, makeContext("other-person"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when no file submitted", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "tenant-1" });
    mocks.personFindFirst.mockResolvedValueOnce(PERSON);
    mocks.tenantFindUnique.mockResolvedValueOnce(TENANT);

    const fd = new FormData();
    const req = new NextRequest("http://localhost/api/people/person-09/profile-image", {
      method: "POST",
      body: fd,
    });
    const res = await POST(req, makeContext("person-09"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/datei/i);
  });

  it("returns validation error from validateImageFile", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "tenant-1" });
    mocks.personFindFirst.mockResolvedValueOnce(PERSON);
    mocks.tenantFindUnique.mockResolvedValueOnce(TENANT);
    mocks.validateImageFile.mockResolvedValueOnce({ ok: false, status: 400, error: "Nicht erlaubter Dateityp." });

    const fd = new FormData();
    fd.append("file", new Blob(["data"], { type: "image/gif" }), "photo.gif");
    const req = new NextRequest("http://localhost/api/people/person-09/profile-image", {
      method: "POST",
      body: fd,
    });
    const res = await POST(req, makeContext("person-09"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Dateityp");
  });

  it("returns 200 with imageUrl on success", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "tenant-1" });
    mocks.personFindFirst.mockResolvedValueOnce(PERSON);
    mocks.tenantFindUnique.mockResolvedValueOnce(TENANT);
    mocks.validateImageFile.mockResolvedValueOnce({
      ok: true, buffer: Buffer.from("img"), mime: "image/jpeg", ext: "jpg",
    });
    mocks.uploadPersonProfileImage.mockResolvedValueOnce({
      ok: true, imageUrl: "https://blob.example.com/person-photos/test-tenant/person-09.jpg",
    });

    const fd = new FormData();
    fd.append("file", new Blob(["data"], { type: "image/jpeg" }), "photo.jpg");
    const req = new NextRequest("http://localhost/api/people/person-09/profile-image", {
      method: "POST",
      body: fd,
    });
    const res = await POST(req, makeContext("person-09"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imageUrl).toContain("person-09");
  });

  it("returns 503 when BLOB_READ_WRITE_TOKEN is missing", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const req = new NextRequest("http://localhost/api/people/person-09/profile-image", { method: "POST" });
    const res = await POST(req, makeContext("person-09"));
    expect(res.status).toBe(503);
  });
});

// ── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/people/[id]/profile-image", () => {
  it("returns 403 when not authorized", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce({ ok: false, status: 403, error: "Forbidden." });
    const req = new NextRequest("http://localhost/api/people/person-09/profile-image", { method: "DELETE" });
    const res = await DELETE(req, makeContext("person-09"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when person not in tenant", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "tenant-1" });
    mocks.personFindFirst.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/people/other-person/profile-image", { method: "DELETE" });
    const res = await DELETE(req, makeContext("other-person"));
    expect(res.status).toBe(404);
  });

  it("returns graceful message when no imageUrl", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "tenant-1" });
    mocks.personFindFirst.mockResolvedValueOnce({ ...PERSON, imageUrl: null });
    mocks.tenantFindUnique.mockResolvedValueOnce(TENANT);
    mocks.removePersonProfileImage.mockResolvedValueOnce({ ok: false, status: 404, error: "Kein Profilbild vorhanden." });

    const req = new NextRequest("http://localhost/api/people/person-09/profile-image", { method: "DELETE" });
    const res = await DELETE(req, makeContext("person-09"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBeTruthy();
  });

  it("returns 200 on successful removal", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "tenant-1" });
    mocks.personFindFirst.mockResolvedValueOnce({ ...PERSON, imageUrl: "https://blob.example.com/photo.jpg" });
    mocks.tenantFindUnique.mockResolvedValueOnce(TENANT);
    mocks.removePersonProfileImage.mockResolvedValueOnce({ ok: true, message: "Profilbild entfernt." });

    const req = new NextRequest("http://localhost/api/people/person-09/profile-image", { method: "DELETE" });
    const res = await DELETE(req, makeContext("person-09"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("entfernt");
  });

  it("Person.imageUrl is cleared (removePersonProfileImage called with correct personId)", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "tenant-1" });
    mocks.personFindFirst.mockResolvedValueOnce({ ...PERSON, imageUrl: "https://blob.example.com/photo.jpg" });
    mocks.tenantFindUnique.mockResolvedValueOnce(TENANT);
    mocks.removePersonProfileImage.mockResolvedValueOnce({ ok: true, message: "Profilbild entfernt." });

    const req = new NextRequest("http://localhost/api/people/person-09/profile-image", { method: "DELETE" });
    await DELETE(req, makeContext("person-09"));

    expect(mocks.removePersonProfileImage).toHaveBeenCalledWith(
      expect.objectContaining({ personId: "person-09" }),
    );
  });
});
