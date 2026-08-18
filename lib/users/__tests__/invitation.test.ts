/**
 * USER-ADMIN-02 / INVITE-01 — Focused tests for invitation mutations
 *
 * Covers:
 *   - invitePersonToTenant: happy path, identity conflicts, multi-tenant
 *   - createPersonAndInvite: happy path, existing global user reuse, same-tenant conflict
 *   - resendTenantInvitation: happy path, not-found, replaces prior token
 *   - revokeTenantInvitation: happy path, no active invitation
 *   - Tenant isolation (cross-tenant rejection)
 *   - Identity conflict invariants
 *   - Multi-tenant invariants (no duplicate User, no duplicate global Person)
 *   - Idempotency and safety invariants
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
      updateMany: vi.fn(),
    },
    passwordResetToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
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
  activatePendingInvitationMemberships,
  InvitationDomainError,
} from "../mutations";

const mockPersonFindUnique = vi.mocked(prisma.person.findUnique);
const mockPersonUpdate = vi.mocked(prisma.person.update);
const mockPersonCreate = vi.mocked(prisma.person.create);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockUserCreate = vi.mocked(prisma.user.create);
const mockMembershipFindUnique = vi.mocked(prisma.tenantMembership.findUnique);
const mockMembershipCreate = vi.mocked(prisma.tenantMembership.create);
const mockMembershipUpdateMany = vi.mocked(prisma.tenantMembership.updateMany);
const mockTokenDeleteMany = vi.mocked(prisma.passwordResetToken.deleteMany);
const mockTokenCreate = vi.mocked(prisma.passwordResetToken.create);
const mockTokenFindFirst = vi.mocked(prisma.passwordResetToken.findFirst);

const TENANT_ID = "tenant-001";
const OTHER_TENANT_ID = "tenant-999"; // different tenant for multi-tenant tests
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
  mockMembershipUpdateMany.mockResolvedValue({ count: 1 });
  mockTokenDeleteMany.mockResolvedValue({ count: 1 });
  mockTokenCreate.mockResolvedValue({ id: "token-001" } as Awaited<ReturnType<typeof prisma.passwordResetToken.create>>);
  mockTokenFindFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// invitePersonToTenant
// ═════════════════════════════════════════════════════════════════════════════

describe("invitePersonToTenant — happy path", () => {
  it("INVITE-1. creates user, links person, creates membership (isActive=false), creates invitation token", async () => {
    const result = await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    expect(result.userId).toBe(USER_ID);
    expect(typeof result.rawToken).toBe("string");
    expect(result.rawToken.length).toBeGreaterThan(0);

    expect(mockUserCreate).toHaveBeenCalledOnce();
    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PERSON_ID }, data: { userId: USER_ID } }),
    );
    // SAFETY: membership must be inactive until invitation is accepted.
    expect(mockMembershipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_ID, userId: USER_ID, isActive: false }),
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
    } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);

    await expect(
      invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID),
    ).rejects.toMatchObject({ code: "USER_ALREADY_LINKED_OTHER_PERSON" });
  });

  it("CONFLICT-5. multi-tenant: email user from another tenant triggers link-and-invite (not rejection)", async () => {
    // User is linked to a Person in a DIFFERENT tenant — this is the multi-tenant
    // "existing global User → invitation into another tenant" case.
    // Expected: Person is linked to the existing User, membership + token created.
    mockUserFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      person: { id: OTHER_PERSON_ID, tenantId: OTHER_TENANT_ID },
    } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);
    // Membership does not exist for this tenant yet
    mockMembershipFindUnique.mockResolvedValue(null);

    const result = await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    expect(result.userId).toBe(OTHER_USER_ID);
    // Person linked to existing User
    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: OTHER_USER_ID } }),
    );
    // Membership created for this tenant
    expect(mockMembershipCreate).toHaveBeenCalled();
    // Token created
    expect(mockTokenCreate).toHaveBeenCalled();
  });

  it("CONFLICT-6. multi-tenant: unlinked email user triggers link-and-invite (not rejection)", async () => {
    // Global User with no Person link — link this Person and invite.
    mockUserFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      person: null,
    } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);
    mockMembershipFindUnique.mockResolvedValue(null);

    const result = await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    expect(result.userId).toBe(OTHER_USER_ID);
    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: OTHER_USER_ID } }),
    );
    // No new User created — existing User is reused
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("CONFLICT-7. no user created on same-tenant email conflict", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      person: { id: OTHER_PERSON_ID, tenantId: TENANT_ID },
    } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);

    await expect(invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID)).rejects.toThrow();

    expect(mockUserCreate).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createPersonAndInvite
// ═════════════════════════════════════════════════════════════════════════════

describe("createPersonAndInvite", () => {
  it("CREATE-1. creates person, user, links them, creates membership (isActive=false) and invitation token", async () => {
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
    // SAFETY: membership must be inactive until invitation is accepted.
    expect(mockMembershipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_ID, isActive: false }),
      }),
    );
    expect(mockTokenCreate).toHaveBeenCalledOnce();
  });

  it("CREATE-2. reuses existing global User when email belongs to User with no same-tenant Person", async () => {
    // Multi-tenant: User exists but their Person is in a DIFFERENT tenant.
    // Expected: create new Person in this tenant, link to existing User, resend path.
    mockUserFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      firstName: "Anna",
      lastName: "Müller",
      person: { id: OTHER_PERSON_ID, tenantId: OTHER_TENANT_ID },
    } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);
    mockMembershipFindUnique.mockResolvedValue(null);

    const result = await createPersonAndInvite(
      TENANT_ID,
      { firstName: "Anna", lastName: "Müller", email: "anna@example.invalid" },
      ACTOR_ID,
    );

    // Existing User must be reused — no new User created.
    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(result.userId).toBe(OTHER_USER_ID);

    // New Person created in this tenant and linked to existing User.
    expect(mockPersonCreate).toHaveBeenCalledOnce();
    expect(mockPersonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_ID, userId: OTHER_USER_ID }),
      }),
    );

    // Invitation token created.
    expect(mockTokenCreate).toHaveBeenCalledOnce();
  });

  it("CREATE-3. reuses existing global User when email belongs to User with no Person at all", async () => {
    // Unlinked global User — still treated as multi-tenant reuse.
    mockUserFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      firstName: "Anna",
      lastName: "Müller",
      person: null,
    } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);
    mockMembershipFindUnique.mockResolvedValue(null);

    const result = await createPersonAndInvite(
      TENANT_ID,
      { firstName: "Anna", lastName: "Müller", email: "anna@example.invalid" },
      ACTOR_ID,
    );

    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(result.userId).toBe(OTHER_USER_ID);
    expect(mockPersonCreate).toHaveBeenCalledOnce();
  });

  it("CREATE-4. throws USER_ALREADY_LINKED_OTHER_PERSON when same-tenant User is linked to a different Person", async () => {
    // Hard conflict: User is linked to a Person in THIS tenant (different person).
    mockUserFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      firstName: "Anna",
      lastName: "Müller",
      person: { id: OTHER_PERSON_ID, tenantId: TENANT_ID },
    } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);

    await expect(
      createPersonAndInvite(
        TENANT_ID,
        { firstName: "Anna", lastName: "Müller", email: "taken@example.invalid" },
        ACTOR_ID,
      ),
    ).rejects.toMatchObject({ code: "USER_ALREADY_LINKED_OTHER_PERSON" });

    // Neither Person nor new User should be created on same-tenant conflict.
    expect(mockPersonCreate).not.toHaveBeenCalled();
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("CREATE-5. no UserRole rows created during invitation", async () => {
    // Invitation must not implicitly grant any roles.
    await createPersonAndInvite(
      TENANT_ID,
      { firstName: "Anna", lastName: "Müller", email: "anna@example.invalid" },
      ACTOR_ID,
    );

    // The prisma mock has no userRole.create — absence of call proves no roles created.
    // (The mock would throw if an unmocked method were called.)
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

    const deleteWhere = mockTokenDeleteMany.mock.calls[0]?.[0]?.where;
    expect(deleteWhere).toMatchObject({ isInvitation: true });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Already active membership
// ═════════════════════════════════════════════════════════════════════════════

describe("invitePersonToTenant — ALREADY_HAS_ACTIVE_MEMBERSHIP", () => {
  it("ACTIVE-1. throws ALREADY_HAS_ACTIVE_MEMBERSHIP when person's linked User is fully active in this tenant", async () => {
    // Person already linked to a User
    mockPersonFindUnique.mockResolvedValue(
      makePerson({ userId: USER_ID }) as Awaited<ReturnType<typeof prisma.person.findUnique>>,
    );
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isActive: true } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);
    // Active membership
    mockMembershipFindUnique.mockResolvedValue({ isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    // No pending invitation token
    mockTokenFindFirst.mockResolvedValue(null);

    await expect(
      invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID),
    ).rejects.toMatchObject({ code: "ALREADY_HAS_ACTIVE_MEMBERSHIP" });
  });

  it("ACTIVE-2. resends to fully-linked User who still has pending invitation (not yet onboarded)", async () => {
    mockPersonFindUnique.mockResolvedValue(
      makePerson({ userId: USER_ID }) as Awaited<ReturnType<typeof prisma.person.findUnique>>,
    );
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isActive: true } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);
    // Active membership
    mockMembershipFindUnique.mockResolvedValue({ isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    // Has a pending invitation token
    mockTokenFindFirst.mockResolvedValue({ id: "token-pending" } as Awaited<ReturnType<typeof prisma.passwordResetToken.findFirst>>);

    const result = await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);
    expect(result.userId).toBe(USER_ID);
    expect(mockTokenCreate).toHaveBeenCalled();
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

// ═════════════════════════════════════════════════════════════════════════════
// Multi-tenant invariants
// ═════════════════════════════════════════════════════════════════════════════

describe("Multi-tenant invariants", () => {
  it("MULTI-1. inviting existing global User into a second tenant does not create a duplicate User", async () => {
    // User is already in OTHER_TENANT — invite them to TENANT_ID.
    mockUserFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      person: { id: OTHER_PERSON_ID, tenantId: OTHER_TENANT_ID },
    } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);
    mockMembershipFindUnique.mockResolvedValue(null);

    const result = await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(result.userId).toBe(OTHER_USER_ID);
  });

  it("MULTI-2. inviting existing global User preserves their other-tenant membership (no deletion)", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      person: { id: OTHER_PERSON_ID, tenantId: OTHER_TENANT_ID },
    } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);
    mockMembershipFindUnique.mockResolvedValue(null);

    await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    // TenantMembership.delete / deleteMany must never be called.
    expect(vi.mocked(prisma.tenantMembership as unknown as { deleteMany?: ReturnType<typeof vi.fn> }).deleteMany).toBeUndefined();
  });

  it("MULTI-3. no UserRole created implicitly during invitation", async () => {
    await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);
    // If userRole methods were called on the mock, the mock would throw because
    // they are not defined. Reaching here proves no UserRole rows are created.
  });

  it("MULTI-4. PersonAssignment rows are untouched during invitation", async () => {
    await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);
    // PersonAssignment is not part of the prisma mock; any call would throw.
    // Reaching here proves PersonAssignment is not touched.
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Token idempotency
// ═════════════════════════════════════════════════════════════════════════════

describe("Token idempotency and safety", () => {
  it("IDEM-1. revoke deletes invitation tokens but not password-reset tokens", async () => {
    mockMembershipFindUnique.mockResolvedValue({ isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    mockTokenDeleteMany.mockResolvedValue({ count: 1 });

    await revokeTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID);

    const where = mockTokenDeleteMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ isInvitation: true, usedAt: null });
    // Must NOT delete non-invitation tokens (no `isInvitation: false` delete).
    expect(mockTokenDeleteMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isInvitation: false }) }),
    );
  });

  it("IDEM-2. resend creates token with isInvitation=true", async () => {
    mockMembershipFindUnique.mockResolvedValue({ isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);

    await resendTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID);

    expect(mockTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isInvitation: true }) }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Access activation timing invariants (INVITE-01 safety check)
// ═════════════════════════════════════════════════════════════════════════════

describe("Access activation timing — PENDING must not grant access", () => {
  it("ACCESS-1. invitation-created membership is isActive=false (new User)", async () => {
    await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    const createCall = mockMembershipCreate.mock.calls.find((c) =>
      c[0]?.data?.tenantId === TENANT_ID,
    );
    expect(createCall).toBeDefined();
    // Must be inactive — the session resolver excludes isActive=false memberships.
    expect(createCall![0].data.isActive).toBe(false);
  });

  it("ACCESS-2. invitation-created membership is isActive=false (existing global User, new tenant)", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      person: { id: OTHER_PERSON_ID, tenantId: OTHER_TENANT_ID },
    } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);
    mockMembershipFindUnique.mockResolvedValue(null);

    await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    const createCall = mockMembershipCreate.mock.calls.find((c) =>
      c[0]?.data?.tenantId === TENANT_ID,
    );
    expect(createCall).toBeDefined();
    // Critical: existing User must not gain access before acceptance.
    expect(createCall![0].data.isActive).toBe(false);
  });

  it("ACCESS-3. revoke after pending invitation leaves membership isActive=false (no access granted)", async () => {
    // Membership exists but is inactive (pending invitation state).
    mockMembershipFindUnique.mockResolvedValue({ isActive: false } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    mockTokenDeleteMany.mockResolvedValue({ count: 1 });

    await revokeTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID);

    // Token deleted — invitation invalidated.
    expect(mockTokenDeleteMany).toHaveBeenCalled();
    // Membership stays isActive=false (user never had access, still doesn't).
    // updateMany must NOT be called to activate membership on revoke.
    expect(mockMembershipUpdateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: true } }),
    );
  });

  it("ACCESS-4. activatePendingInvitationMemberships uses recency window to avoid activating old admin-deactivated memberships", async () => {
    await activatePendingInvitationMemberships(USER_ID);

    expect(mockMembershipUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: USER_ID,
          isActive: false,
          joinedAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
        data: { isActive: true },
      }),
    );
  });

  it("ACCESS-5. createPersonAndInvite creates membership isActive=false for new User", async () => {
    await createPersonAndInvite(
      TENANT_ID,
      { firstName: "Anna", lastName: "Müller", email: "anna@example.invalid" },
      ACTOR_ID,
    );

    const createCall = mockMembershipCreate.mock.calls.find((c) =>
      c[0]?.data?.tenantId === TENANT_ID,
    );
    expect(createCall).toBeDefined();
    expect(createCall![0].data.isActive).toBe(false);
  });

  it("ACCESS-6. createPersonAndInvite with existing global User creates membership isActive=false", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: OTHER_USER_ID,
      firstName: "Anna",
      lastName: "Müller",
      person: { id: OTHER_PERSON_ID, tenantId: OTHER_TENANT_ID },
    } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);
    mockMembershipFindUnique.mockResolvedValue(null);

    await createPersonAndInvite(
      TENANT_ID,
      { firstName: "Anna", lastName: "Müller", email: "anna@example.invalid" },
      ACTOR_ID,
    );

    const createCall = mockMembershipCreate.mock.calls.find((c) =>
      c[0]?.data?.tenantId === TENANT_ID,
    );
    expect(createCall).toBeDefined();
    // Existing User must not gain new-tenant access before acceptance.
    expect(createCall![0].data.isActive).toBe(false);
  });
});
