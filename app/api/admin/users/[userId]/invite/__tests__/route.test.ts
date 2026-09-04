/**
 * USER-ADMIN-02 — Focused tests for /api/admin/users/[userId]/invite
 *
 * Covers:
 *   - POST (resend): authentication, authorization, tenant isolation, success, not-found
 *   - DELETE (revoke): authentication, authorization, tenant isolation, success, not-found, no-invitation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRequireApiPermission = vi.fn();
const mockResendTenantInvitation = vi.fn();
const mockRevokeTenantInvitation = vi.fn();
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
    resendTenantInvitation: mockResendTenantInvitation,
    revokeTenantInvitation: mockRevokeTenantInvitation,
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

const { POST, DELETE } = await import("../route");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-001";
const USER_ID = "user-001";
const ACTOR_ID = "actor-001";

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

function makeRequest() {
  return new Request("http://localhost/api/admin/users/" + USER_ID + "/invite", {
    method: "POST",
  });
}

function makeParams(userId = USER_ID) {
  return { params: Promise.resolve({ userId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiPermission.mockResolvedValue(AUTH_OK);
  mockResendTenantInvitation.mockResolvedValue("raw-token-abc");
  mockRevokeTenantInvitation.mockResolvedValue(undefined);
  mockPrismaUserFindUnique.mockResolvedValue({
    email: "user@example.invalid",
    firstName: "Anna",
  });
  mockPrismaTenantFindUnique.mockResolvedValue({ name: "Test Club" });
  mockSendMail.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/users/[userId]/invite — resend
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /invite — authentication", () => {
  it("AUTH-1. rejects unauthenticated with 401", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(401);
  });

  it("AUTH-2. rejects forbidden with 403", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(403);
  });

  it("AUTH-3. returns 403 when no activeTenantId", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTH_NO_TENANT);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(403);
  });
});

describe("POST /invite — success", () => {
  it("RESEND-1. returns 200 on success", async () => {
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("RESEND-2. calls resendTenantInvitation with session tenantId", async () => {
    await POST(makeRequest() as never, makeParams());
    expect(mockResendTenantInvitation).toHaveBeenCalledWith(
      TENANT_ID,
      USER_ID,
      ACTOR_ID,
    );
  });

  it("RESEND-3. returns 429 when resend cooldown is active", async () => {
    const { InvitationDomainError } = await import("@/lib/users/mutations");
    mockResendTenantInvitation.mockRejectedValue(
      new InvitationDomainError("INVITATION_RESEND_COOLDOWN"),
    );
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("POST /invite — not found", () => {
  it("NOTFOUND-1. returns 404 when user is not a member", async () => {
    const { InvitationDomainError } = await import("@/lib/users/mutations");
    mockResendTenantInvitation.mockRejectedValue(
      new InvitationDomainError("USER_NOT_FOUND"),
    );
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/users/[userId]/invite — revoke
// ═════════════════════════════════════════════════════════════════════════════

describe("DELETE /invite — authentication", () => {
  it("AUTH-1. rejects unauthenticated with 401", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);
    const res = await DELETE(makeRequest() as never, makeParams());
    expect(res.status).toBe(401);
  });
});

describe("DELETE /invite — success", () => {
  it("REVOKE-1. returns 200 on success", async () => {
    const res = await DELETE(makeRequest() as never, makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("REVOKE-2. calls revokeTenantInvitation with session tenantId", async () => {
    await DELETE(makeRequest() as never, makeParams());
    expect(mockRevokeTenantInvitation).toHaveBeenCalledWith(TENANT_ID, USER_ID, ACTOR_ID);
  });
});

describe("DELETE /invite — error cases", () => {
  it("REVOKE-3. returns 404 when user not a member", async () => {
    const { InvitationDomainError } = await import("@/lib/users/mutations");
    mockRevokeTenantInvitation.mockRejectedValue(
      new InvitationDomainError("USER_NOT_FOUND"),
    );
    const res = await DELETE(makeRequest() as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("REVOKE-4. returns 400 when no active invitation", async () => {
    const { InvitationDomainError } = await import("@/lib/users/mutations");
    mockRevokeTenantInvitation.mockRejectedValue(
      new InvitationDomainError("NO_ACTIVE_INVITATION"),
    );
    const res = await DELETE(makeRequest() as never, makeParams());
    expect(res.status).toBe(400);
  });
});
