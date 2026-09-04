/**
 * USER-ADMIN-02 — Focused tests for POST /api/admin/users/invite
 *
 * Covers:
 *   - Authentication, authorization, tenant isolation
 *   - Invite existing person (personId)
 *   - Create person + invite (firstName + lastName + email)
 *   - Identity conflict responses (409)
 *   - Invalid body (400)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRequireApiPermission = vi.fn();
const mockInvitePersonToTenant = vi.fn();
const mockCreatePersonAndInvite = vi.fn();
const mockPrismaUserFindUnique = vi.fn();
const mockPrismaTenantFindUnique = vi.fn();
const mockSendMail = vi.fn();

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mockRequireApiPermission,
}));

vi.mock("@/lib/users/mutations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/users/mutations")>("@/lib/users/mutations");
  return {
    ...actual,
    invitePersonToTenant: mockInvitePersonToTenant,
    createPersonAndInvite: mockCreatePersonAndInvite,
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: mockPrismaUserFindUnique },
    tenant: { findUnique: mockPrismaTenantFindUnique },
  },
}));

vi.mock("@/lib/email/mailer", () => ({
  sendMail: mockSendMail,
  MailConfigurationError: class MailConfigurationError extends Error {},
}));

vi.mock("@/lib/email/templates/invitation", () => ({
  buildInvitationEmail: vi.fn(() => ({
    subject: "Test",
    html: "<p>Test</p>",
    text: "Test",
  })),
}));

const { POST } = await import("../route");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-001";
const ACTOR_ID = "actor-001";
const USER_ID = "user-new-001";

const AUTH_OK = {
  ok: true as const,
  status: 200,
  error: null,
  session: {
    user: {
      id: ACTOR_ID,
      email: "admin@example.invalid",
      activeTenantId: TENANT_ID,
      effectiveUserId: ACTOR_ID,
    },
  },
};

const AUTH_NO_TENANT = {
  ok: true as const,
  status: 200,
  error: null,
  session: {
    user: { id: ACTOR_ID, email: "admin@example.invalid", activeTenantId: null },
  },
};

const UNAUTHENTICATED = { ok: false as const, status: 401, error: "Unauthorized", session: null };
const FORBIDDEN = { ok: false as const, status: 403, error: "Forbidden", session: null };

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/admin/users/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiPermission.mockResolvedValue(AUTH_OK);
  mockInvitePersonToTenant.mockResolvedValue({ userId: USER_ID, rawToken: "abc123def456" + "a".repeat(52) });
  mockCreatePersonAndInvite.mockResolvedValue({ userId: USER_ID, personId: "person-001", rawToken: "abc123def456" + "a".repeat(52) });
  mockPrismaUserFindUnique.mockResolvedValue({ email: "user@test.invalid", firstName: "Anna" });
  mockPrismaTenantFindUnique.mockResolvedValue({ name: "Test Club" });
  mockSendMail.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// Authentication / Authorization
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/users/invite — authentication", () => {
  it("AUTH-1. rejects unauthenticated with 401", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);
    const res = await POST(makeRequest({ personId: "p1" }) as never);
    expect(res.status).toBe(401);
  });

  it("AUTH-2. rejects forbidden with 403", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);
    const res = await POST(makeRequest({ personId: "p1" }) as never);
    expect(res.status).toBe(403);
  });

  it("AUTH-3. returns 403 when no activeTenantId", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTH_NO_TENANT);
    const res = await POST(makeRequest({ personId: "p1" }) as never);
    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Invite existing person
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/users/invite — invite existing person", () => {
  it("PERSON-1. returns 200 with userId on success", async () => {
    const res = await POST(makeRequest({ personId: "person-001" }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.userId).toBe(USER_ID);
  });

  it("PERSON-2. calls invitePersonToTenant with session tenantId", async () => {
    await POST(makeRequest({ personId: "person-001" }) as never);
    expect(mockInvitePersonToTenant).toHaveBeenCalledWith(TENANT_ID, "person-001", ACTOR_ID, {
      sendInvitation: true,
      roleIds: undefined,
      scopedRoles: undefined,
    });
  });

  it("PERSON-3. returns 404 on PERSON_NOT_FOUND", async () => {
    const { InvitationDomainError } = await import("@/lib/users/mutations");
    mockInvitePersonToTenant.mockRejectedValue(new InvitationDomainError("PERSON_NOT_FOUND"));
    const res = await POST(makeRequest({ personId: "person-001" }) as never);
    expect(res.status).toBe(404);
  });

  it("PERSON-4. returns 404 on PERSON_CROSS_TENANT", async () => {
    const { InvitationDomainError } = await import("@/lib/users/mutations");
    mockInvitePersonToTenant.mockRejectedValue(new InvitationDomainError("PERSON_CROSS_TENANT"));
    const res = await POST(makeRequest({ personId: "person-001" }) as never);
    expect(res.status).toBe(404);
  });

  it("PERSON-5. returns 409 on USER_ALREADY_LINKED_OTHER_PERSON", async () => {
    const { InvitationDomainError } = await import("@/lib/users/mutations");
    mockInvitePersonToTenant.mockRejectedValue(
      new InvitationDomainError("USER_ALREADY_LINKED_OTHER_PERSON"),
    );
    const res = await POST(makeRequest({ personId: "person-001" }) as never);
    expect(res.status).toBe(409);
  });

  it("PERSON-6. returns 409 on EMAIL_TAKEN_BY_OTHER_USER", async () => {
    const { InvitationDomainError } = await import("@/lib/users/mutations");
    mockInvitePersonToTenant.mockRejectedValue(
      new InvitationDomainError("EMAIL_TAKEN_BY_OTHER_USER"),
    );
    const res = await POST(makeRequest({ personId: "person-001" }) as never);
    expect(res.status).toBe(409);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Create person + invite
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/users/invite — create person + invite", () => {
  const newPersonBody = {
    firstName: "Anna",
    lastName: "Müller",
    email: "anna@example.invalid",
  };

  it("CREATE-1. returns 200 on success", async () => {
    const res = await POST(makeRequest(newPersonBody) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.userId).toBe(USER_ID);
  });

  it("CREATE-2. calls createPersonAndInvite with correct data", async () => {
    await POST(makeRequest(newPersonBody) as never);
    expect(mockCreatePersonAndInvite).toHaveBeenCalledWith(
      TENANT_ID,
      { firstName: "Anna", lastName: "Müller", email: "anna@example.invalid" },
      ACTOR_ID,
      {
        sendInvitation: true,
        roleIds: undefined,
        scopedRoles: undefined,
      },
    );
  });

  it("CREATE-3. returns 409 on email conflict", async () => {
    const { InvitationDomainError } = await import("@/lib/users/mutations");
    mockCreatePersonAndInvite.mockRejectedValue(
      new InvitationDomainError("EMAIL_TAKEN_BY_OTHER_USER"),
    );
    const res = await POST(makeRequest(newPersonBody) as never);
    expect(res.status).toBe(409);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Invalid body
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/users/invite — invalid body", () => {
  it("INVALID-1. returns 400 for empty body", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("INVALID-2. returns 400 for missing required fields in create path", async () => {
    const res = await POST(
      makeRequest({ firstName: "Anna" }) as never,
    );
    expect(res.status).toBe(400);
  });
});
