/**
 * USER-ADMIN-02 — Focused tests for invitation mutations
 *
 * Covers:
 *   - invitePersonToTenant: happy path, identity conflicts
 *   - createPersonAndInvite: happy path, email conflict
 *   - resendTenantInvitation: happy path, not-found
 *   - revokeTenantInvitation: happy path, no active invitation
 *   - Tenant isolation (cross-tenant rejection)
 *   - Identity conflict invariants
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Prisma mock ───────────────────────────────────────────────────────────────

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    person: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    tenantMembership: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    passwordResetToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(async () => "hashed-password"),
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: vi.fn(async () => {}),
}));

// Import after mocks
import { prisma } from "@/lib/db/prisma";
import {
  invitePersonToTenant,
  createPersonAndInvite,
  resendTenantInvitation,
  revokeTenantInvitation,
  InvitationDomainError,
} from "../mutations";

const mockPersonFindUnique = vi.mocked(prisma.person.findUnique);
const mockPersonUpdate = vi.mocked(prisma.person.update);
const mockPersonCreate = vi.mocked(prisma.person.create);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockUserCreate = vi.mocked(prisma.user.create);
const mockMembershipFindUnique = vi.mocked(prisma.tenantMembership.findUnique);
const mockMembershipCreate = vi.mocked(prisma.tenantMembership.create);
const mockTokenDeleteMany = vi.mocked(prisma.passwordResetToken.deleteMany);
const mockTokenCreate = vi.mocked(prisma.passwordResetToken.create);

const TENANT_ID = "tenant-001";
const OTHER_TENANT_ID = "tenant-999";
const PERSON_ID = "person-001";
const USER_ID = "user-001";
const OTHER_USER_ID = "user-002";
const OTHER_PERSON_ID = "person-002";
const ACTOR_ID = "actor-001";

function makePerson(overrides: Record<string, unknown> = {}) {
  return {
    id: PERSON_ID,
    tenantId: TENANT_ID,
    firstName: "Anna",
    lastName: "Müller",
    email: "anna@example.invalid",
    userId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // Defaults: happy path
  mockPersonFindUnique.mockResolvedValue(makePerson() as Awaited<ReturnType<typeof prisma.person.findUnique>>);
  mockPersonUpdate.mockResolvedValue({} as Awaited<ReturnType<typeof prisma.person.update>>);
  mockPersonCreate.mockResolvedValue({ id: PERSON_ID } as Awaited<ReturnType<typeof prisma.person.create>>);
  mockUserFindUnique.mockResolvedValue(null);
  mockUserCreate.mockResolvedValue({ id: USER_ID } as Awaited<ReturnType<typeof prisma.user.create>>);
  mockMembershipFindUnique.mockResolvedValue(null);
  mockMembershipCreate.mockResolvedValue({} as Awaited<ReturnType<typeof prisma.tenantMembership.create>>);
  mockTokenDeleteMany.mockResolvedValue({ count: 1 });
  mockTokenCreate.mockResolvedValue({ id: "token-001" } as Awaited<ReturnType<typeof prisma.passwordResetToken.create>>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// invitePersonToTenant
// ═════════════════════════════════════════════════════════════════════════════

describe("invitePersonToTenant — happy path", () => {
  it("INVITE-1. creates user, links person, creates membership, creates invitation token", async () => {
    const result = await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    expect(result.userId).toBe(USER_ID);
    expect(typeof result.rawToken).toBe("string");
    expect(result.rawToken.length).toBeGreaterThan(0);

    expect(mockUserCreate).toHaveBeenCalledOnce();
    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PERSON_ID }, data: { userId: USER_ID } }),
    );
    expect(mockMembershipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_ID, userId: USER_ID }),
      }),
    );
    expect(mockTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isInvitation: true }) }),
    );
  });

  it("INVITE-2. returns rawToken (not stored — hashed only)", async () => {
    const result = await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    // rawToken should be a hex string (64 chars = 32 bytes * 2)
    expect(result.rawToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it("INVITE-3. deletes prior invitation tokens before creating new one", async () => {
    await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    expect(mockTokenDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isInvitation: true }) }),
    );
  });

  it("INVITE-4. creates token with isInvitation=true", async () => {
    await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    expect(mockTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isInvitation: true }),
      }),
    );
  });

  it("INVITE-5. creates user with isActive=true", async () => {
    await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: true }),
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// invitePersonToTenant — identity conflicts
// ═════════════════════════════════════════════════════════════════════════════

describe("invitePersonToTenant — identity conflicts", () => {
  it("CONFLICT-1. throws PERSON_NOT_FOUND when person does not exist", async () => {
    mockPersonFindUnique.mockResolvedValue(null);

    await expect(
      invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID),
    ).rejects.toMatchObject({ code: "PERSON_NOT_FOUND" });
  });

  it("CONFLICT-2. throws PERSON_CROSS_TENANT when person belongs to another tenant", async () => {
    mockPersonFindUnique.mockResolvedValue(
      makePerson({ tenantId: OTHER_TENANT_ID }) as Awaited<ReturnType<typeof prisma.person.findUnique>>,
    );

    await expect(
      invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID),
    ).rejects.toMatchObject({ code: "PERSON_CROSS_TENANT" });
  });

  it("CONFLICT-3. no user or membership created on PERSON_NOT_FOUND", async () => {
    mockPersonFindUnique.mockResolvedValue(null);

    await expect(invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID)).rejects.toThrow(
      InvitationDomainError,
    );

    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(mockMembershipCreate).not.toHaveBeenCalled();
  });

  it("CONFLICT-4. throws USER_ALREADY_LINKED_OTHER_PERSON when email user is linked to different person in same tenant", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      person: { id: OTHER_PERSON_ID, tenantId: TENANT_ID },
    } as Awaited<ReturnType<typeof prisma.user.findUnique>>);

    await expect(
      invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID),
    ).rejects.toMatchObject({ code: "USER_ALREADY_LINKED_OTHER_PERSON" });
  });

  it("CONFLICT-5. throws EMAIL_TAKEN_BY_OTHER_USER when email user exists but is unlinked", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      person: null,
    } as Awaited<ReturnType<typeof prisma.user.findUnique>>);

    await expect(
      invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN_BY_OTHER_USER" });
  });

  it("CONFLICT-6. no user created on email conflict", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      person: null,
    } as Awaited<ReturnType<typeof prisma.user.findUnique>>);

    await expect(invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID)).rejects.toThrow();

    expect(mockUserCreate).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createPersonAndInvite
// ═════════════════════════════════════════════════════════════════════════════

describe("createPersonAndInvite", () => {
  it("CREATE-1. creates person, user, links them, creates membership and invitation token", async () => {
    const result = await createPersonAndInvite(
      TENANT_ID,
      { firstName: "Anna", lastName: "Müller", email: "anna@example.invalid" },
      ACTOR_ID,
    );

    expect(result.personId).toBe(PERSON_ID);
    expect(result.userId).toBe(USER_ID);
    expect(typeof result.rawToken).toBe("string");

    expect(mockPersonCreate).toHaveBeenCalledOnce();
    expect(mockUserCreate).toHaveBeenCalledOnce();
    expect(mockMembershipCreate).toHaveBeenCalledOnce();
    expect(mockTokenCreate).toHaveBeenCalledOnce();
  });

  it("CREATE-2. throws EMAIL_TAKEN_BY_OTHER_USER when email already exists", async () => {
    mockUserFindUnique.mockResolvedValue({ id: OTHER_USER_ID } as Awaited<ReturnType<typeof prisma.user.findUnique>>);

    await expect(
      createPersonAndInvite(
        TENANT_ID,
        { firstName: "Anna", lastName: "Müller", email: "taken@example.invalid" },
        ACTOR_ID,
      ),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN_BY_OTHER_USER" });
  });

  it("CREATE-3. no user or person created on email conflict", async () => {
    mockUserFindUnique.mockResolvedValue({ id: OTHER_USER_ID } as Awaited<ReturnType<typeof prisma.user.findUnique>>);

    await expect(
      createPersonAndInvite(
        TENANT_ID,
        { firstName: "Anna", lastName: "Müller", email: "taken@example.invalid" },
        ACTOR_ID,
      ),
    ).rejects.toThrow();

    expect(mockPersonCreate).not.toHaveBeenCalled();
    expect(mockUserCreate).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// resendTenantInvitation
// ═════════════════════════════════════════════════════════════════════════════

describe("resendTenantInvitation", () => {
  it("RESEND-1. creates new invitation token for existing member", async () => {
    mockMembershipFindUnique.mockResolvedValue({ isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);

    const rawToken = await resendTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID);

    expect(typeof rawToken).toBe("string");
    expect(rawToken.length).toBeGreaterThan(0);
    expect(mockTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isInvitation: true }) }),
    );
  });

  it("RESEND-2. throws USER_NOT_FOUND when user is not a member", async () => {
    mockMembershipFindUnique.mockResolvedValue(null);

    await expect(
      resendTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("RESEND-3. deletes prior invitation tokens before creating new one", async () => {
    mockMembershipFindUnique.mockResolvedValue({ isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);

    await resendTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID);

    expect(mockTokenDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isInvitation: true }) }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// revokeTenantInvitation
// ═════════════════════════════════════════════════════════════════════════════

describe("revokeTenantInvitation", () => {
  it("REVOKE-1. deletes active invitation tokens", async () => {
    mockMembershipFindUnique.mockResolvedValue({ isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    mockTokenDeleteMany.mockResolvedValue({ count: 1 });

    await expect(
      revokeTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID),
    ).resolves.toBeUndefined();

    expect(mockTokenDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID, isInvitation: true, usedAt: null }),
      }),
    );
  });

  it("REVOKE-2. throws USER_NOT_FOUND when user is not a member", async () => {
    mockMembershipFindUnique.mockResolvedValue(null);

    await expect(
      revokeTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("REVOKE-3. throws NO_ACTIVE_INVITATION when no tokens to delete", async () => {
    mockMembershipFindUnique.mockResolvedValue({ isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    mockTokenDeleteMany.mockResolvedValue({ count: 0 });

    await expect(
      revokeTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID),
    ).rejects.toMatchObject({ code: "NO_ACTIVE_INVITATION" });
  });

  it("REVOKE-4. does not delete non-invitation tokens (password reset)", async () => {
    mockMembershipFindUnique.mockResolvedValue({ isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    mockTokenDeleteMany.mockResolvedValue({ count: 1 });

    await revokeTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID);

    const deleteWhere = mockTokenDeleteMany.mock.calls[0][0].where;
    expect(deleteWhere).toMatchObject({ isInvitation: true });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Tenant isolation invariants
// ═════════════════════════════════════════════════════════════════════════════

describe("Tenant isolation", () => {
  it("ISO-1. invitePersonToTenant rejects person from different tenant", async () => {
    mockPersonFindUnique.mockResolvedValue(
      makePerson({ tenantId: OTHER_TENANT_ID }) as Awaited<ReturnType<typeof prisma.person.findUnique>>,
    );

    await expect(
      invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID),
    ).rejects.toMatchObject({ code: "PERSON_CROSS_TENANT" });
  });

  it("ISO-2. resendTenantInvitation rejects user not in tenant", async () => {
    mockMembershipFindUnique.mockResolvedValue(null);

    await expect(
      resendTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("ISO-3. revokeTenantInvitation rejects user not in tenant", async () => {
    mockMembershipFindUnique.mockResolvedValue(null);

    await expect(
      revokeTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });
});
