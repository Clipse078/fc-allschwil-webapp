/**
 * USER-ADMIN-02B — Focused tests for PATCH /api/admin/users/[userId]/membership
 *
 * Covers:
 *   - Authentication (unauthenticated → 401)
 *   - Manage permission required (users.manage OR users.manage_memberships)
 *   - Tenant context required
 *   - Valid body required
 *   - Tenant user detail loads (200 success)
 *   - Cross-tenant user blocked (404)
 *   - Deactivate membership (200)
 *   - Reactivate membership (200)
 *   - Self-deactivation blocked (400)
 *   - Last Club Admin protected (400)
 *   - Mutation not called on auth failure
 *   - Internal error → 500
 *
 * ADMIN-HARD-DELETE: route now uses requireAnyApiPermission([users.manage, users.manage_memberships])
 * so that Club Admins (who hold users.manage_memberships) can also invoke it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/permissions/require-any-api-permission", () => ({
  requireAnyApiPermission: vi.fn(),
}));
vi.mock("@/lib/audit/log-action", () => ({ logAction: vi.fn() }));

vi.mock("@/lib/users/mutations", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/users/mutations")>();
  return {
    ...original,
    setTenantMembershipActive: vi.fn(),
  };
});

// Import modules after mock declarations
import { requireAnyApiPermission } from "@/lib/permissions/require-any-api-permission";
import { setTenantMembershipActive, MembershipDomainError } from "@/lib/users/mutations";

const mockRequireAnyApiPermission = vi.mocked(requireAnyApiPermission);
const mockSetTenantMembershipActive = vi.mocked(setTenantMembershipActive);

// Import route after mocks
const { PATCH } = await import("../route");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-001";
const USER_ID = "user-target-001";
const ACTOR_ID = "actor-001";

const AUTH_OK = {
  ok: true as const,
  status: 200,
  error: null,
  session: {
    user: {
      id: ACTOR_ID,
      effectiveUserId: null,
      email: "admin@example.invalid",
      activeTenantId: TENANT_ID,
    },
  },
};

const AUTH_OK_NO_TENANT = {
  ok: true as const,
  status: 200,
  error: null,
  session: {
    user: {
      id: ACTOR_ID,
      effectiveUserId: null,
      email: "superadmin@example.invalid",
      activeTenantId: null,
    },
  },
};

const UNAUTHENTICATED = {
  ok: false as const,
  status: 401,
  error: "Unauthorized",
  session: null,
};

const FORBIDDEN = {
  ok: false as const,
  status: 403,
  error: "Forbidden",
  session: null,
};

// ── Helper ────────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request(`https://example.invalid/api/admin/users/${USER_ID}/membership`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeContext(userId = USER_ID) {
  return { params: Promise.resolve({ userId }) };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAnyApiPermission.mockResolvedValue(AUTH_OK as Awaited<ReturnType<typeof requireAnyApiPermission>>);
  mockSetTenantMembershipActive.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// Authentication
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/admin/users/[userId]/membership — authentication", () => {
  it("AUTH-1. returns 401 when unauthenticated", async () => {
    mockRequireAnyApiPermission.mockResolvedValue(UNAUTHENTICATED as Awaited<ReturnType<typeof requireAnyApiPermission>>);

    const res = await PATCH(makeRequest({ isActive: false }), makeContext());

    expect(res.status).toBe(401);
  });

  it("AUTH-2. mutation not called when unauthenticated", async () => {
    mockRequireAnyApiPermission.mockResolvedValue(UNAUTHENTICATED as Awaited<ReturnType<typeof requireAnyApiPermission>>);

    await PATCH(makeRequest({ isActive: false }), makeContext());

    expect(mockSetTenantMembershipActive).not.toHaveBeenCalled();
  });

  it("AUTH-3. passes users.manage and users.manage_memberships to the permission gate", async () => {
    await PATCH(makeRequest({ isActive: false }), makeContext());

    expect(mockRequireAnyApiPermission).toHaveBeenCalledWith(
      expect.arrayContaining(["users.manage", "users.manage_memberships"]),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Authorization
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/admin/users/[userId]/membership — authorization", () => {
  it("AUTHZ-1. returns 403 when permission denied", async () => {
    mockRequireAnyApiPermission.mockResolvedValue(FORBIDDEN as Awaited<ReturnType<typeof requireAnyApiPermission>>);

    const res = await PATCH(makeRequest({ isActive: false }), makeContext());

    expect(res.status).toBe(403);
  });

  it("AUTHZ-2. mutation not called when forbidden", async () => {
    mockRequireAnyApiPermission.mockResolvedValue(FORBIDDEN as Awaited<ReturnType<typeof requireAnyApiPermission>>);

    await PATCH(makeRequest({ isActive: false }), makeContext());

    expect(mockSetTenantMembershipActive).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Tenant isolation
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/admin/users/[userId]/membership — tenant isolation", () => {
  it("ISO-1. returns 403 when session has no activeTenantId", async () => {
    mockRequireAnyApiPermission.mockResolvedValue(AUTH_OK_NO_TENANT as Awaited<ReturnType<typeof requireAnyApiPermission>>);

    const res = await PATCH(makeRequest({ isActive: false }), makeContext());

    expect(res.status).toBe(403);
  });

  it("ISO-2. mutation called with session tenantId only", async () => {
    await PATCH(makeRequest({ isActive: false }), makeContext());

    expect(mockSetTenantMembershipActive).toHaveBeenCalledWith(
      TENANT_ID,
      expect.any(String),
      expect.any(Boolean),
      expect.anything(),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Deactivation + reactivation
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/admin/users/[userId]/membership — deactivate/reactivate", () => {
  it("DEACT-1. deactivation returns 200 with success:true", async () => {
    const res = await PATCH(makeRequest({ isActive: false }), makeContext());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("DEACT-2. calls mutation with isActive false", async () => {
    await PATCH(makeRequest({ isActive: false }), makeContext());

    expect(mockSetTenantMembershipActive).toHaveBeenCalledWith(
      TENANT_ID,
      USER_ID,
      false,
      expect.anything(),
    );
  });

  it("REACT-1. reactivation returns 200", async () => {
    const res = await PATCH(makeRequest({ isActive: true }), makeContext());

    expect(res.status).toBe(200);
  });

  it("REACT-2. calls mutation with isActive true", async () => {
    await PATCH(makeRequest({ isActive: true }), makeContext());

    expect(mockSetTenantMembershipActive).toHaveBeenCalledWith(
      TENANT_ID,
      USER_ID,
      true,
      expect.anything(),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Cross-tenant isolation — MEMBERSHIP_NOT_FOUND
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/admin/users/[userId]/membership — cross-tenant blocked", () => {
  it("ISO-3. returns 404 when user is not a member of the active tenant", async () => {
    mockSetTenantMembershipActive.mockRejectedValue(
      new MembershipDomainError("MEMBERSHIP_NOT_FOUND"),
    );

    const res = await PATCH(makeRequest({ isActive: false }), makeContext());

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Safety — self-deactivation
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/admin/users/[userId]/membership — self-deactivation", () => {
  it("SELF-1. returns 400 on SELF_DEACTIVATION domain error", async () => {
    mockSetTenantMembershipActive.mockRejectedValue(
      new MembershipDomainError("SELF_DEACTIVATION"),
    );

    const res = await PATCH(makeRequest({ isActive: false }), makeContext());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Safety — last Club Admin
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/admin/users/[userId]/membership — last Club Admin", () => {
  it("ADMIN-1. returns 400 on LAST_CLUB_ADMIN domain error", async () => {
    mockSetTenantMembershipActive.mockRejectedValue(
      new MembershipDomainError("LAST_CLUB_ADMIN"),
    );

    const res = await PATCH(makeRequest({ isActive: false }), makeContext());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Request validation
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/admin/users/[userId]/membership — validation", () => {
  it("VAL-1. returns 400 when isActive is missing", async () => {
    const res = await PATCH(makeRequest({}), makeContext());

    expect(res.status).toBe(400);
  });

  it("VAL-2. returns 400 when isActive is a string", async () => {
    const res = await PATCH(makeRequest({ isActive: "true" }), makeContext());

    expect(res.status).toBe(400);
  });

  it("VAL-3. returns 400 on invalid JSON body", async () => {
    const req = new Request(`https://example.invalid/api/admin/users/${USER_ID}/membership`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const res = await PATCH(req, makeContext());

    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Error handling
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/admin/users/[userId]/membership — error handling", () => {
  it("ERR-1. unexpected error returns 500", async () => {
    mockSetTenantMembershipActive.mockRejectedValue(new Error("DB unavailable"));

    const res = await PATCH(makeRequest({ isActive: false }), makeContext());

    expect(res.status).toBe(500);
  });

  it("ERR-2. 500 response does not expose internal error details", async () => {
    mockSetTenantMembershipActive.mockRejectedValue(
      new Error("DB connection string: postgresql://secret"),
    );

    const res = await PATCH(makeRequest({ isActive: false }), makeContext());
    const json = JSON.stringify(await res.json());

    expect(json).not.toContain("postgresql://");
    expect(json).not.toContain("DB connection string");
  });
});
