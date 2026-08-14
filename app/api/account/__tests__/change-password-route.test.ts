/**
 * ACCOUNT-01-C2 — /api/account/change-password route tests
 *
 * Covers:
 * - Returns 401 when unauthenticated
 * - Returns 400 for missing currentPassword
 * - Returns 400 for new password shorter than 12 characters
 * - Returns 400 when newPassword !== confirmPassword
 * - Returns 400 when currentPassword is wrong
 * - Returns 400 when new password is the same as the current password
 * - Returns 404 when user is inactive
 * - Successfully updates passwordHash and passwordChangedAt
 * - Only touches User.passwordHash and User.passwordChangedAt (tenant isolation)
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
};

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import { POST } from "@/app/api/account/change-password/route";
import { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/account/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const DB_USER = {
  id: "user-001",
  passwordHash: "$2b$12$hashedcurrentpassword",
  isActive: true,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/account/change-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logAction.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await POST(makeRequest({ currentPassword: "old", newPassword: "newpassword123", confirmPassword: "newpassword123" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/authentifiziert/i);
  });

  it("returns 400 when currentPassword is missing", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    const res = await POST(makeRequest({ currentPassword: "", newPassword: "newpassword123", confirmPassword: "newpassword123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/aktuelles passwort/i);
  });

  it("returns 400 when newPassword is too short", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    const res = await POST(makeRequest({ currentPassword: "correctcurrentpw", newPassword: "short", confirmPassword: "short" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/12 zeichen/i);
  });

  it("returns 400 when passwords do not match", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    const res = await POST(makeRequest({
      currentPassword: "correctcurrentpw",
      newPassword: "newpassword123",
      confirmPassword: "newpassword456",
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/stimmen nicht überein/i);
  });

  it("returns 400 when current password is wrong", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.userFindUnique.mockResolvedValue(DB_USER);
    mocks.verifyPassword.mockResolvedValueOnce(false); // current password check fails
    const res = await POST(makeRequest({
      currentPassword: "wrongpassword",
      newPassword: "newpassword123",
      confirmPassword: "newpassword123",
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/aktuelle.? passwort ist falsch/i);
  });

  it("returns 400 when new password equals current password", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.userFindUnique.mockResolvedValue(DB_USER);
    mocks.verifyPassword
      .mockResolvedValueOnce(true)  // current password matches
      .mockResolvedValueOnce(true); // new password also matches current → reject
    const res = await POST(makeRequest({
      currentPassword: "correctcurrentpw",
      newPassword: "correctcurrentpw",
      confirmPassword: "correctcurrentpw",
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/identisch/i);
  });

  it("returns 404 when user is inactive", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.userFindUnique.mockResolvedValue({ ...DB_USER, isActive: false });
    const res = await POST(makeRequest({
      currentPassword: "correctcurrentpw",
      newPassword: "newpassword123",
      confirmPassword: "newpassword123",
    }));
    expect(res.status).toBe(404);
  });

  it("updates passwordHash and passwordChangedAt on success", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.userFindUnique.mockResolvedValue(DB_USER);
    mocks.verifyPassword
      .mockResolvedValueOnce(true)   // current password correct
      .mockResolvedValueOnce(false); // new password differs
    mocks.hashPassword.mockResolvedValue("$2b$12$newhash");
    mocks.userUpdate.mockResolvedValue({ id: "user-001" });

    const res = await POST(makeRequest({
      currentPassword: "correctcurrentpw",
      newPassword: "newpassword123",
      confirmPassword: "newpassword123",
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-001" },
        data: expect.objectContaining({
          passwordHash: "$2b$12$newhash",
          passwordChangedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("does not touch Person, TenantMembership, or other users", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.userFindUnique.mockResolvedValue(DB_USER);
    mocks.verifyPassword
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    mocks.hashPassword.mockResolvedValue("$2b$12$newhash");
    mocks.userUpdate.mockResolvedValue({ id: "user-001" });

    await POST(makeRequest({
      currentPassword: "correctcurrentpw",
      newPassword: "newpassword123",
      confirmPassword: "newpassword123",
    }));

    // Only one DB write — to User
    expect(mocks.userUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.userUpdate.mock.calls[0][0].where).toEqual({ id: "user-001" });
  });

  it("logs the password change action", async () => {
    mocks.auth.mockResolvedValue({ user: SESSION_USER });
    mocks.userFindUnique.mockResolvedValue(DB_USER);
    mocks.verifyPassword
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    mocks.hashPassword.mockResolvedValue("$2b$12$newhash");
    mocks.userUpdate.mockResolvedValue({ id: "user-001" });

    await POST(makeRequest({
      currentPassword: "correctcurrentpw",
      newPassword: "newpassword123",
      confirmPassword: "newpassword123",
    }));

    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "account.password_changed",
        entityType: "User",
        entityId: "user-001",
        actorUserId: "user-001",
      }),
    );
  });
});

// ── Avatar fallback tests (unit) ──────────────────────────────────────────────

describe("Avatar initials fallback (resolveAccountIdentityName)", () => {
  it("uses Person name when Person is linked and not matching tenant name", async () => {
    const { resolveAccountIdentityName } = await import("@/lib/people/identity");
    const result = resolveAccountIdentityName({
      linkedPerson: { firstName: "Michael", lastName: "Duijster" },
      sessionFirstName: "FC Allschwil",
      sessionLastName: "Club Admin",
      tenantName: "FC Allschwil",
    });
    expect(result.firstName).toBe("Michael");
    expect(result.lastName).toBe("Duijster");
  });

  it("falls back to session user name when no Person is linked", async () => {
    const { resolveAccountIdentityName } = await import("@/lib/people/identity");
    const result = resolveAccountIdentityName({
      linkedPerson: null,
      sessionFirstName: "John",
      sessionLastName: "Doe",
      tenantName: "My Club",
    });
    expect(result.firstName).toBe("John");
    expect(result.lastName).toBe("Doe");
  });

  it("falls back to safe label when session name equals tenant name", async () => {
    const { resolveAccountIdentityName } = await import("@/lib/people/identity");
    const result = resolveAccountIdentityName({
      linkedPerson: null,
      sessionFirstName: "FC Allschwil",
      sessionLastName: "Club Admin",
      tenantName: "FC Allschwil",
    });
    expect(result.firstName).toBe("Mein Konto");
    expect(result.lastName).toBe("");
  });
});
