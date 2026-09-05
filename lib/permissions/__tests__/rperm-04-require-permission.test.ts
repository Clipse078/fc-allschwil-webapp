/**
 * RPERM-04 — Authoritative Permission Gate Tests
 *
 * Covers requirePermission / requireAnyPermission / requireApiPermission /
 * requireApiAnyPermission: the actual authorization boundary, now evaluated
 * live via the RPERM-03 EffectivePermissionResolver against
 * `(permission, tenant)` instead of the cached session `permissionKeys`
 * array.
 *
 * Test groups:
 *   G-01  requirePermission grants when the resolver returns the permission
 *         in the platform bucket (no tenant context needed)
 *   G-02  requirePermission grants when the resolver returns the permission
 *         in the tenant bucket for session.activeTenantId
 *   D-01  requirePermission redirects to /dashboard when neither bucket
 *         contains the permission — even if the user holds a PLATFORM role
 *         whose rolePermissions include it (the accidental-inheritance bug
 *         this slice fixes: a platform role does not grant a TENANT
 *         permission merely because the flattened role list contains it)
 *   D-02  requirePermission redirects to /login when there is no session
 *   T-01  An explicit tenantId argument overrides session.activeTenantId
 *   A-01  requireAnyPermission grants on any match across both buckets
 *   API-01 requireApiPermission returns 401 when unauthenticated
 *   API-02 requireApiPermission returns 403 when the resolver denies
 *   API-03 requireApiPermission returns 200 when the resolver grants
 *   API-04 requireApiAnyPermission returns 403 when none match
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getEffectivePermissions: vi.fn(),
  userFindUnique: vi.fn(),
  membershipFindFirst: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    tenantMembership: { findFirst: mocks.membershipFindFirst },
  },
}));
vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    getEffectivePermissions: mocks.getEffectivePermissions,
  }),
}));

import { requirePermission } from "../require-permission";
import { requireAnyPermission } from "../require-any-permission";
import { requireApiPermission } from "../require-api-permission";
import { requireApiAnyPermission } from "../require-api-any-permission";

function sessionWithTenant(userId: string, activeTenantId: string | null) {
  return { user: { id: userId, activeTenantId } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindUnique.mockResolvedValue({ isActive: true });
  mocks.membershipFindFirst.mockResolvedValue({ id: "membership-1" });
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
});

describe("requirePermission", () => {
  it("G-01: grants when the permission is in the platform bucket", async () => {
    mocks.auth.mockResolvedValue(sessionWithTenant("user-1", null));
    mocks.getEffectivePermissions.mockResolvedValue({
      platform: ["users.manage"],
      tenant: [],
    });

    const session = await requirePermission("users.manage" as never);

    expect(session.user.id).toBe("user-1");
    expect(mocks.getEffectivePermissions).toHaveBeenCalledWith({
      userId: "user-1",
      tenantId: undefined,
    });
  });

  it("G-02: grants when the permission is in the tenant bucket for session.activeTenantId", async () => {
    mocks.auth.mockResolvedValue(sessionWithTenant("user-1", "tenant-1"));
    mocks.getEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: ["teams.manage"],
    });

    const session = await requirePermission("teams.manage" as never);

    expect(session.user.activeTenantId).toBe("tenant-1");
    expect(mocks.getEffectivePermissions).toHaveBeenCalledWith({
      userId: "user-1",
      tenantId: "tenant-1",
    });
  });

  it("D-01: redirects to /dashboard when the resolver denies — platform role does not leak tenant permissions", async () => {
    // Regression case: a user with only a PLATFORM role (e.g. super_admin)
    // and NO active tenant membership/role must NOT be granted a
    // TENANT-scoped permission just because their role's flattened
    // permission list happens to contain the key.
    mocks.auth.mockResolvedValue(sessionWithTenant("user-1", "tenant-1"));
    mocks.getEffectivePermissions.mockResolvedValue({
      platform: ["users.manage"],
      tenant: [], // no tenant-scoped grant for "teams.manage"
    });

    await expect(requirePermission("teams.manage" as never)).rejects.toThrow(
      "REDIRECT:/dashboard",
    );
  });

  it("D-02: redirects to /login when there is no session", async () => {
    mocks.auth.mockResolvedValue(null);

    await expect(requirePermission("users.manage" as never)).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(mocks.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it("T-01: an explicit tenantId argument overrides session.activeTenantId", async () => {
    mocks.auth.mockResolvedValue(sessionWithTenant("user-1", "tenant-active"));
    mocks.getEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: ["teams.manage"],
    });

    await requirePermission("teams.manage" as never, "tenant-other");

    expect(mocks.getEffectivePermissions).toHaveBeenCalledWith({
      userId: "user-1",
      tenantId: "tenant-other",
    });
  });
});

describe("requireAnyPermission", () => {
  it("A-01: grants when at least one requested permission matches either bucket", async () => {
    mocks.auth.mockResolvedValue(sessionWithTenant("user-1", "tenant-1"));
    mocks.getEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: ["news.manage"],
    });

    const session = await requireAnyPermission([
      "website.manage" as never,
      "news.manage" as never,
    ]);

    expect(session.user.id).toBe("user-1");
  });

  it("denies when none of the requested permissions match", async () => {
    mocks.auth.mockResolvedValue(sessionWithTenant("user-1", "tenant-1"));
    mocks.getEffectivePermissions.mockResolvedValue({ platform: [], tenant: [] });

    await expect(
      requireAnyPermission(["website.manage" as never, "news.manage" as never]),
    ).rejects.toThrow("REDIRECT:/dashboard");
  });
});

describe("requireApiPermission", () => {
  it("API-01: returns 401 when there is no session", async () => {
    mocks.auth.mockResolvedValue(null);

    const result = await requireApiPermission("users.manage" as never);

    expect(result).toEqual({ ok: false, status: 401, error: "Unauthorized", session: null });
    expect(mocks.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it("API-01I: cannot authorize a password-revoked session", async () => {
    // Auth.js represents a rejected JWT (including password revocation) as no
    // session, after clearing the invalid session cookie.
    mocks.auth.mockResolvedValue(null);

    const result = await requireApiPermission("users.manage" as never);

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });
    expect(mocks.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it("API-02: returns 403 when the resolver denies", async () => {
    mocks.auth.mockResolvedValue(sessionWithTenant("user-1", "tenant-1"));
    mocks.getEffectivePermissions.mockResolvedValue({ platform: [], tenant: [] });

    const result = await requireApiPermission("teams.manage" as never);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe("Forbidden");
    }
  });

  it("API-02M: rejects a revoked tenant membership before permission resolution", async () => {
    mocks.auth.mockResolvedValue(sessionWithTenant("user-1", "tenant-1"));
    mocks.membershipFindFirst.mockResolvedValueOnce(null);

    const result = await requireApiPermission("teams.manage" as never);

    expect(result).toMatchObject({ ok: false, status: 403, error: "Forbidden" });
    expect(mocks.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it("API-02U: rejects an inactive effective user before permission resolution", async () => {
    mocks.auth.mockResolvedValue(sessionWithTenant("user-1", "tenant-1"));
    mocks.userFindUnique.mockResolvedValueOnce({ isActive: false });

    const result = await requireApiPermission("teams.manage" as never);

    expect(result).toMatchObject({ ok: false, status: 403, error: "Forbidden" });
    expect(mocks.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it("API-03: returns 200 with the session when the resolver grants", async () => {
    mocks.auth.mockResolvedValue(sessionWithTenant("user-1", "tenant-1"));
    mocks.getEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: ["teams.manage"],
    });

    const result = await requireApiPermission("teams.manage" as never);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.session.user.id).toBe("user-1");
    }
  });

  it("API-05: authorizes the effective user during trusted impersonation", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "effective-user",
        effectiveUserId: "effective-user",
        actorUserId: "canonical-actor",
        activeTenantId: "tenant-1",
        isImpersonating: true,
      },
    });
    mocks.getEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: ["teams.manage"],
    });

    const result = await requireApiPermission("teams.manage" as never);

    expect(result.ok).toBe(true);
    expect(mocks.getEffectivePermissions).toHaveBeenCalledWith({
      userId: "effective-user",
      tenantId: "tenant-1",
    });
  });
});

describe("requireApiAnyPermission", () => {
  it("API-04: returns 403 when none of the requested permissions match", async () => {
    mocks.auth.mockResolvedValue(sessionWithTenant("user-1", "tenant-1"));
    mocks.getEffectivePermissions.mockResolvedValue({ platform: [], tenant: [] });

    const result = await requireApiAnyPermission([
      "teams.manage" as never,
      "events.manage" as never,
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it("API-04M: rejects a revoked tenant membership", async () => {
    mocks.auth.mockResolvedValue(sessionWithTenant("user-1", "tenant-1"));
    mocks.membershipFindFirst.mockResolvedValueOnce(null);

    const result = await requireApiAnyPermission([
      "teams.manage" as never,
      "events.manage" as never,
    ]);

    expect(result).toMatchObject({ ok: false, status: 403, error: "Forbidden" });
    expect(mocks.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it("grants when any requested permission is present", async () => {
    mocks.auth.mockResolvedValue(sessionWithTenant("user-1", "tenant-1"));
    mocks.getEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: ["events.manage"],
    });

    const result = await requireApiAnyPermission([
      "teams.manage" as never,
      "events.manage" as never,
    ]);

    expect(result.ok).toBe(true);
  });
});
