/**
 * MEIN-KONTO-02 — /api/account/profile-image route tests
 *
 * Covers:
 * - POST returns 503 when BLOB_READ_WRITE_TOKEN is missing
 * - POST returns 401 when unauthenticated
 * - POST returns 403 when no active tenant
 * - POST returns 403 when no linked Person in active tenant
 * - DELETE returns 401 when unauthenticated
 * - DELETE returns 403 when no linked Person
 * - DELETE clears imageUrl and returns success when Person has an image
 * - DELETE returns success (no-op) when Person has no image
 * - Tenant isolation: person lookup uses both userId AND tenantId
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const SESSION_USER = {
  id: "user-001",
  email: "alice@example.com",
  firstName: "Alice",
  lastName: "Test",
  activeTenantId: "tenant-001",
  permissionKeys: [],
  roleKeys: [],
  isImpersonating: false,
  activeMembershipId: "mem-001",
  availableTenants: [],
};

const DB_PERSON = {
  id: "person-001",
  imageUrl: "https://example.public.blob.vercel-storage.com/old.jpg",
  tenantId: "tenant-001",
};

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  personFindFirst: vi.fn(),
  personUpdate: vi.fn(),
  tenantFindUnique: vi.fn(),
  blobPut: vi.fn(),
  blobDel: vi.fn(),
  fileTypeFromBuffer: vi.fn(),
  isVercelBlobUrl: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    person: {
      findFirst: mocks.personFindFirst,
      update: mocks.personUpdate,
    },
    tenant: { findUnique: mocks.tenantFindUnique },
  },
}));

vi.mock("@vercel/blob", () => ({
  put: mocks.blobPut,
  del: mocks.blobDel,
}));

vi.mock("file-type", () => ({
  fileTypeFromBuffer: mocks.fileTypeFromBuffer,
}));

vi.mock("@/lib/media/upload", () => ({
  isVercelBlobUrl: mocks.isVercelBlobUrl,
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import { POST, DELETE } from "@/app/api/account/profile-image/route";
import { NextRequest } from "next/server";

// ── DELETE tests ──────────────────────────────────────────────────────────────

describe("DELETE /api/account/profile-image", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.logAction.mockResolvedValue(undefined);
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("returns 403 when no active tenant", async () => {
    mocks.auth.mockResolvedValue({ user: { ...SESSION_USER, activeTenantId: null } });
    const res = await DELETE();
    expect(res.status).toBe(403);
  });

  it("returns 403 when no linked Person in active tenant", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.personFindFirst.mockResolvedValue(null);
    mocks.tenantFindUnique.mockResolvedValue({ key: "fc-allschwil" });
    const res = await DELETE();
    expect(res.status).toBe(403);
  });

  it("clears imageUrl and returns success when Person has an image", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.personFindFirst.mockResolvedValue(DB_PERSON);
    mocks.tenantFindUnique.mockResolvedValue({ key: "fc-allschwil" });
    mocks.isVercelBlobUrl.mockReturnValue(true);
    mocks.blobDel.mockResolvedValue(undefined);
    mocks.personUpdate.mockResolvedValue({});

    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/entfernt/i);

    expect(mocks.personUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "person-001" },
        data: { imageUrl: null },
      }),
    );
  });

  it("returns success (no-op) when Person has no image", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.personFindFirst.mockResolvedValue({ ...DB_PERSON, imageUrl: null });
    mocks.tenantFindUnique.mockResolvedValue({ key: "fc-allschwil" });

    const res = await DELETE();
    expect(res.status).toBe(200);
    // No update should happen when there is no image
    expect(mocks.personUpdate).not.toHaveBeenCalled();
  });

  it("scopes person lookup to both userId AND tenantId", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.personFindFirst.mockResolvedValue({ ...DB_PERSON, imageUrl: null });
    mocks.tenantFindUnique.mockResolvedValue({ key: "fc-allschwil" });

    await DELETE();

    expect(mocks.personFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-001",
          tenantId: "tenant-001",
        }),
      }),
    );
  });
});

// ── POST tests (auth / guard checks only; actual upload requires real blob) ───

describe("POST /api/account/profile-image", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.logAction.mockResolvedValue(undefined);
  });

  it("returns 503 when BLOB_READ_WRITE_TOKEN is missing", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    mocks.auth.mockResolvedValue({ user: SESSION_USER });

    const fd = new FormData();
    fd.append("file", new Blob(["fake"], { type: "image/jpeg" }), "test.jpg");
    const req = new NextRequest("http://localhost/api/account/profile-image", {
      method: "POST",
      body: fd,
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  });

  it("returns 401 when unauthenticated", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    mocks.auth.mockResolvedValue(null);

    const fd = new FormData();
    fd.append("file", new Blob(["fake"], { type: "image/jpeg" }), "test.jpg");
    const req = new NextRequest("http://localhost/api/account/profile-image", {
      method: "POST",
      body: fd,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when no active tenant", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    mocks.auth.mockResolvedValue({ user: { ...SESSION_USER, activeTenantId: null } });

    const fd = new FormData();
    fd.append("file", new Blob(["fake"], { type: "image/jpeg" }), "test.jpg");
    const req = new NextRequest("http://localhost/api/account/profile-image", {
      method: "POST",
      body: fd,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when no linked Person in active tenant", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.personFindFirst.mockResolvedValue(null);
    mocks.tenantFindUnique.mockResolvedValue({ key: "fc-allschwil" });

    const fd = new FormData();
    fd.append("file", new Blob(["fake"], { type: "image/jpeg" }), "test.jpg");
    const req = new NextRequest("http://localhost/api/account/profile-image", {
      method: "POST",
      body: fd,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
