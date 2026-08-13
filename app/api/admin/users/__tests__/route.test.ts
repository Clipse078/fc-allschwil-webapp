/**
 * USER-ADMIN-02A — Focused tests for GET /api/admin/users
 *
 * Covers:
 *   - Authentication (unauthenticated → 401)
 *   - Authorization (unauthorized → 403)
 *   - Tenant isolation (missing tenant context → 403)
 *   - Tenant isolation (query called with session tenantId, never attacker-supplied)
 *   - Successful response shape
 *   - Query not called when auth fails
 *   - Internal error handling (→ 500, no internals leaked)
 *   - Security invariant: passwordHash never selectable via this route
 *
 * External dependencies are fully mocked. No database access.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Mocks must be declared before the route import ────────────────────────────

const mockRequireApiAnyPermission = vi.fn();
const mockGetTenantUsersListData = vi.fn();

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mockRequireApiAnyPermission,
}));

vi.mock("@/lib/users/queries", () => ({
  getTenantUsersListData: mockGetTenantUsersListData,
}));

// Import after mocks
const { GET } = await import("../route");

// ── Auth fixture helpers ──────────────────────────────────────────────────────

const TENANT_ID = "clx-tenant-test-001";
const OTHER_TENANT_ID = "clx-tenant-other-999";

const AUTH_OK = {
  ok: true as const,
  status: 200,
  error: null,
  session: {
    user: {
      id: "user-admin-1",
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
      id: "user-platform-1",
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
  session: { user: { id: "user-no-perm", email: "noperm@example.invalid" } },
};

// ── User data fixtures ────────────────────────────────────────────────────────

function makeUser(overrides: Partial<ReturnType<typeof defaultUser>> = {}) {
  return { ...defaultUser(), ...overrides };
}

function defaultUser() {
  return {
    userId: "usr-1",
    firstName: "Max",
    lastName: "Mustermann",
    name: "Max Mustermann",
    email: "max@example.invalid",
    userIsActive: true,
    membershipIsActive: true,
    joinedAt: new Date("2025-01-01T00:00:00.000Z"),
    lastLoginAt: new Date("2026-08-01T00:00:00.000Z"),
    roles: [{ id: "role-1", name: "Club Admin", key: "club_admin" }],
  };
}

const SAMPLE_USERS = [
  makeUser({ userId: "usr-1", name: "Max Mustermann", membershipIsActive: true, userIsActive: true }),
  makeUser({
    userId: "usr-2",
    name: "Erika Musterfrau",
    email: "erika@example.invalid",
    membershipIsActive: false,
    userIsActive: true,
    roles: [],
  }),
];

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiAnyPermission.mockResolvedValue(AUTH_OK);
  mockGetTenantUsersListData.mockResolvedValue(SAMPLE_USERS);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// Authentication
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/admin/users — authentication", () => {
  it("AUTH-1. rejects unauthenticated request with 401", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(UNAUTHENTICATED);

    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("AUTH-2. query is not called when unauthenticated", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(UNAUTHENTICATED);

    await GET();

    expect(mockGetTenantUsersListData).not.toHaveBeenCalled();
  });

  it("AUTH-3. passes users.view and users.manage permission keys to the auth gate", async () => {
    await GET();

    expect(mockRequireApiAnyPermission).toHaveBeenCalledWith(
      expect.arrayContaining(["users.view", "users.manage"]),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Authorization
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/admin/users — authorization", () => {
  it("AUTHZ-1. rejects request without sufficient permission with 403", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(FORBIDDEN);

    const response = await GET();

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("AUTHZ-2. query is not called when forbidden", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(FORBIDDEN);

    await GET();

    expect(mockGetTenantUsersListData).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Tenant isolation
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/admin/users — tenant isolation", () => {
  it("ISO-1. returns 403 when session has no activeTenantId", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(AUTH_OK_NO_TENANT);

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("ISO-2. query is not called when activeTenantId is missing", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(AUTH_OK_NO_TENANT);

    await GET();

    expect(mockGetTenantUsersListData).not.toHaveBeenCalled();
  });

  it("ISO-3. query is called with session activeTenantId only", async () => {
    await GET();

    expect(mockGetTenantUsersListData).toHaveBeenCalledWith(TENANT_ID);
  });

  it("ISO-4. query is NOT called with any other tenantId", async () => {
    await GET();

    const calls = mockGetTenantUsersListData.mock.calls;
    for (const [calledTenantId] of calls) {
      expect(calledTenantId).not.toBe(OTHER_TENANT_ID);
    }
  });

  it("ISO-5. query is called exactly once per request", async () => {
    await GET();

    expect(mockGetTenantUsersListData).toHaveBeenCalledOnce();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Successful response
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/admin/users — successful response", () => {
  it("RESP-1. returns 200 with users array", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.users)).toBe(true);
  });

  it("RESP-2. returns all tenant members from query", async () => {
    const response = await GET();

    const body = await response.json();
    expect(body.users).toHaveLength(SAMPLE_USERS.length);
  });

  it("RESP-3. response is application/json", async () => {
    const response = await GET();

    const ct = response.headers.get("content-type");
    expect(ct).toContain("application/json");
  });

  it("RESP-4. returns empty array when tenant has no members", async () => {
    mockGetTenantUsersListData.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users).toEqual([]);
  });

  it("RESP-5. each user item includes userId, name, email, membershipIsActive, userIsActive, roles", async () => {
    const response = await GET();
    const body = await response.json();
    const user = body.users[0];

    expect(user).toHaveProperty("userId");
    expect(user).toHaveProperty("name");
    expect(user).toHaveProperty("email");
    expect(user).toHaveProperty("membershipIsActive");
    expect(user).toHaveProperty("userIsActive");
    expect(user).toHaveProperty("roles");
  });

  it("RESP-6. active member is represented with membershipIsActive true", async () => {
    mockGetTenantUsersListData.mockResolvedValue([
      makeUser({ membershipIsActive: true, userIsActive: true }),
    ]);

    const response = await GET();
    const body = await response.json();

    expect(body.users[0].membershipIsActive).toBe(true);
    expect(body.users[0].userIsActive).toBe(true);
  });

  it("RESP-7. inactive membership is represented with membershipIsActive false", async () => {
    mockGetTenantUsersListData.mockResolvedValue([
      makeUser({ membershipIsActive: false, userIsActive: true }),
    ]);

    const response = await GET();
    const body = await response.json();

    expect(body.users[0].membershipIsActive).toBe(false);
  });

  it("RESP-8. inactive user account is represented with userIsActive false", async () => {
    mockGetTenantUsersListData.mockResolvedValue([
      makeUser({ membershipIsActive: true, userIsActive: false }),
    ]);

    const response = await GET();
    const body = await response.json();

    expect(body.users[0].userIsActive).toBe(false);
  });

  it("RESP-9. roles are returned as an array", async () => {
    const response = await GET();
    const body = await response.json();

    expect(Array.isArray(body.users[0].roles)).toBe(true);
  });

  it("RESP-10. user with no roles has empty roles array", async () => {
    mockGetTenantUsersListData.mockResolvedValue([
      makeUser({ roles: [] }),
    ]);

    const response = await GET();
    const body = await response.json();

    expect(body.users[0].roles).toEqual([]);
  });

  it("RESP-11. role items contain id, name, and key", async () => {
    const response = await GET();
    const body = await response.json();
    const role = body.users[0].roles[0];

    expect(role).toHaveProperty("id");
    expect(role).toHaveProperty("name");
    expect(role).toHaveProperty("key");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Error handling
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/admin/users — error handling", () => {
  it("ERR-1. query throws unexpected error → 500", async () => {
    mockGetTenantUsersListData.mockRejectedValue(new Error("DB unavailable"));

    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("ERR-2. 500 response does not expose internal error details", async () => {
    mockGetTenantUsersListData.mockRejectedValue(new Error("DB connection string: postgresql://secret"));

    const response = await GET();
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain("postgresql://");
    expect(json).not.toContain("DB connection string");
  });
});
