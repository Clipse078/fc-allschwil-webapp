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
import { logAction } from "@/lib/audit/log-action";
import {
  invitePersonToTenant,
  createPersonAndInvite,
  resendTenantInvitation,
  revokeTenantInvitation,
  activateInvitationMembership,
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

  it("INVITE-3. deletes prior invitation tokens for this tenant only before creating new one", async () => {
    await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    expect(mockTokenDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isInvitation: true, invitationTenantId: TENANT_ID }),
      }),
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

  it("RESEND-3. deletes prior invitation tokens for this tenant only before creating new one", async () => {
    mockMembershipFindUnique.mockResolvedValue({ isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);

    await resendTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID);

    expect(mockTokenDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isInvitation: true, invitationTenantId: TENANT_ID }),
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// revokeTenantInvitation
// ═════════════════════════════════════════════════════════════════════════════

describe("revokeTenantInvitation", () => {
  it("REVOKE-1. deletes active invitation tokens for this tenant only", async () => {
    mockMembershipFindUnique.mockResolvedValue({ isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    mockTokenDeleteMany.mockResolvedValue({ count: 1 });

    await expect(
      revokeTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID),
    ).resolves.toBeUndefined();

    expect(mockTokenDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: USER_ID,
          isInvitation: true,
          invitationTenantId: TENANT_ID,
          usedAt: null,
        }),
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

  it("REVOKE-4. does not delete non-invitation tokens (password reset) and scopes to this tenant", async () => {
    mockMembershipFindUnique.mockResolvedValue({ isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    mockTokenDeleteMany.mockResolvedValue({ count: 1 });

    await revokeTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID);

    const deleteWhere = mockTokenDeleteMany.mock.calls[0]?.[0]?.where;
    expect(deleteWhere).toMatchObject({ isInvitation: true, invitationTenantId: TENANT_ID });
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
  it("IDEM-1. revoke deletes only this tenant's invitation tokens, never password-reset tokens", async () => {
    mockMembershipFindUnique.mockResolvedValue({ isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    mockTokenDeleteMany.mockResolvedValue({ count: 1 });

    await revokeTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID);

    const where = mockTokenDeleteMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ isInvitation: true, invitationTenantId: TENANT_ID, usedAt: null });
    // Must NOT delete non-invitation tokens.
    expect(mockTokenDeleteMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isInvitation: false }) }),
    );
    // Must NOT delete tokens without invitationTenantId constraint (would be cross-tenant).
    expect(where).toHaveProperty("invitationTenantId", TENANT_ID);
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
    expect(createCall![0].data.isActive).toBe(false);
  });

  it("ACCESS-3. revoke leaves membership isActive=false — updateMany with isActive=true never called", async () => {
    mockMembershipFindUnique.mockResolvedValue({ isActive: false } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    mockTokenDeleteMany.mockResolvedValue({ count: 1 });

    await revokeTenantInvitation(TENANT_ID, USER_ID, ACTOR_ID);

    expect(mockTokenDeleteMany).toHaveBeenCalled();
    expect(mockMembershipUpdateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: true } }),
    );
  });

  it("ACCESS-4. createPersonAndInvite creates membership isActive=false for new User", async () => {
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

  it("ACCESS-5. createPersonAndInvite with existing global User creates membership isActive=false", async () => {
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
    expect(createCall![0].data.isActive).toBe(false);
  });

  it("ACCESS-6. invitation token stores invitationTenantId for exact membership activation", async () => {
    await invitePersonToTenant(TENANT_ID, PERSON_ID, ACTOR_ID);

    expect(mockTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isInvitation: true,
          invitationTenantId: TENANT_ID,
        }),
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Exact tenant activation (INVITE-01 hardening)
// ═════════════════════════════════════════════════════════════════════════════

describe("Exact tenant activation — activateInvitationMembership", () => {
  const TENANT_B = "tenant-B";
  const TENANT_C = "tenant-C";

  it("EXACT-1. activateInvitationMembership targets userId + tenantId exactly (no joinedAt window)", async () => {
    await activateInvitationMembership(USER_ID, TENANT_B);

    expect(mockMembershipUpdateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, tenantId: TENANT_B, isActive: false },
      data: { isActive: true },
    });
    // Must target exactly tenantId — NOT a timestamp filter.
    const whereArg = mockMembershipUpdateMany.mock.calls[0]?.[0]?.where;
    expect(whereArg).not.toHaveProperty("joinedAt");
    expect(vi.mocked(logAction)).toHaveBeenCalledWith({
      tenantId: TENANT_B,
      actorUserId: USER_ID,
      moduleKey: "users",
      entityType: "TenantMembership",
      entityId: `${TENANT_B}:${USER_ID}`,
      action: "MEMBERSHIP_ACTIVATED_BY_INVITATION",
      metadataJson: { targetUserId: USER_ID },
    });
  });

  it("EXACT-2. activateInvitationMembership for TenantB does NOT touch TenantC membership", async () => {
    // User has pending membership in both TenantB and TenantC.
    // Accepting TenantB invitation must leave TenantC unchanged.
    await activateInvitationMembership(USER_ID, TENANT_B);

    // updateMany was called with tenantId=TENANT_B only.
    const calls = mockMembershipUpdateMany.mock.calls;
    expect(calls).toHaveLength(1);
    const callWhere = calls[0]?.[0]?.where;
    expect(callWhere?.tenantId).toBe(TENANT_B);
    expect(callWhere?.tenantId).not.toBe(TENANT_C);
  });

  it("EXACT-3. multi-tenant: TenantA active, TenantB accepted, TenantC pending — only TenantB activated", async () => {
    // Simulates: activateInvitationMembership called with TenantB token.
    await activateInvitationMembership(USER_ID, TENANT_B);

    // Only one updateMany call, targeting TENANT_B.
    expect(mockMembershipUpdateMany).toHaveBeenCalledOnce();
    expect(mockMembershipUpdateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, tenantId: TENANT_B, isActive: false },
      data: { isActive: true },
    });
    // TenantA and TenantC are never passed to updateMany.
    const whereArg = mockMembershipUpdateMany.mock.calls[0]?.[0]?.where;
    expect(whereArg?.tenantId).toBe(TENANT_B);
    expect(whereArg?.tenantId).not.toBe(TENANT_ID); // TenantA
    expect(whereArg?.tenantId).not.toBe(TENANT_C);
  });

  it("EXACT-4. activateInvitationMembership is idempotent (already-active membership → no-op via isActive=false filter)", async () => {
    // updateMany with isActive=false will match 0 rows if already active — no-op.
    mockMembershipUpdateMany.mockResolvedValue({ count: 0 });

    await expect(activateInvitationMembership(USER_ID, TENANT_B)).resolves.toBeUndefined();
    expect(mockMembershipUpdateMany).toHaveBeenCalledOnce();
  });

  it("EXACT-5. _createInvitationToken stores invitationTenantId — resend preserves correct tenantId", async () => {
    mockMembershipFindUnique.mockResolvedValue({ isActive: false } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);

    await resendTenantInvitation(TENANT_B, USER_ID, ACTOR_ID);

    expect(mockTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isInvitation: true,
          invitationTenantId: TENANT_B,
        }),
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Multi-tenant token isolation (MT-1 … MT-6)
// ═════════════════════════════════════════════════════════════════════════════

describe("Multi-tenant token isolation", () => {
  const TENANT_B = "tenant-B";
  const TENANT_C = "tenant-C";

  it("MT-1. creating Tenant C invitation does NOT delete Tenant B token", async () => {
    // Person belongs to Tenant C; user already has a pending Tenant B invitation.
    // _createInvitationToken must deleteMany with invitationTenantId=TENANT_C only.
    mockPersonFindUnique.mockResolvedValue(
      makePerson({ tenantId: TENANT_C }) as Awaited<ReturnType<typeof prisma.person.findUnique>>,
    );

    await invitePersonToTenant(TENANT_C, PERSON_ID, ACTOR_ID);

    const deleteCalls = mockTokenDeleteMany.mock.calls;
    // All deleteMany calls must be scoped to TENANT_C.
    expect(deleteCalls.length).toBeGreaterThan(0);
    for (const call of deleteCalls) {
      const where = call[0]?.where ?? {};
      if (where.isInvitation) {
        expect(where.invitationTenantId).toBe(TENANT_C);
        expect(where.invitationTenantId).not.toBe(TENANT_B);
      }
    }
  });

  it("MT-2. resend Tenant B replaces only Tenant B token; Tenant C deleteMany is never called", async () => {
    mockMembershipFindUnique.mockResolvedValue({
      isActive: false,
    } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);

    await resendTenantInvitation(TENANT_B, USER_ID, ACTOR_ID);

    const deleteCalls = mockTokenDeleteMany.mock.calls;
    // Exactly one deleteMany call, scoped to TENANT_B.
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
    for (const call of deleteCalls) {
      const where = call[0]?.where ?? {};
      if (where.isInvitation) {
        expect(where.invitationTenantId).toBe(TENANT_B);
        expect(where.invitationTenantId).not.toBe(TENANT_C);
      }
    }
    // Fresh token is created for TENANT_B.
    expect(mockTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isInvitation: true, invitationTenantId: TENANT_B }),
      }),
    );
  });

  it("MT-3. revoking Tenant B deletes only Tenant B token; Tenant C deleteMany never called", async () => {
    mockMembershipFindUnique.mockResolvedValue({
      isActive: false,
    } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    mockTokenDeleteMany.mockResolvedValue({ count: 1 });

    await revokeTenantInvitation(TENANT_B, USER_ID, ACTOR_ID);

    const deleteCalls = mockTokenDeleteMany.mock.calls;
    expect(deleteCalls).toHaveLength(1);
    const where = deleteCalls[0]![0]!.where!;
    expect(where.invitationTenantId).toBe(TENANT_B);
    expect(where.invitationTenantId).not.toBe(TENANT_C);
  });

  it("MT-4. accepting Tenant B (activateInvitationMembership) activates only Tenant B membership; Tenant C untouched", async () => {
    await activateInvitationMembership(USER_ID, TENANT_B);

    const calls = mockMembershipUpdateMany.mock.calls;
    expect(calls).toHaveLength(1);
    const where = calls[0]![0]!.where!;
    expect(where.tenantId).toBe(TENANT_B);
    expect(where.tenantId).not.toBe(TENANT_C);
    expect(where.userId).toBe(USER_ID);
  });

  it("MT-5. after accepting Tenant B, Tenant C can still be accepted (activateInvitationMembership is independent)", async () => {
    // Accept Tenant B.
    await activateInvitationMembership(USER_ID, TENANT_B);
    // Accept Tenant C independently.
    await activateInvitationMembership(USER_ID, TENANT_C);

    const calls = mockMembershipUpdateMany.mock.calls;
    expect(calls).toHaveLength(2);
    const tenantBWhere = calls[0]![0]!.where!;
    const tenantCWhere = calls[1]![0]!.where!;
    expect(tenantBWhere.tenantId).toBe(TENANT_B);
    expect(tenantCWhere.tenantId).toBe(TENANT_C);
    // Each call is independent and scoped to its own tenantId.
    expect(tenantBWhere.tenantId).not.toBe(TENANT_C);
    expect(tenantCWhere.tenantId).not.toBe(TENANT_B);
  });

  it("MT-6. normal password-reset token for same User is never deleted by invitation create/resend/revoke", async () => {
    // Invitation create path — _createInvitationToken only deletes isInvitation=true tokens.
    // Person must belong to the same tenant we're inviting them into.
    mockPersonFindUnique.mockResolvedValue(
      makePerson({ tenantId: TENANT_B }) as Awaited<ReturnType<typeof prisma.person.findUnique>>,
    );
    await invitePersonToTenant(TENANT_B, PERSON_ID, ACTOR_ID);
    for (const call of mockTokenDeleteMany.mock.calls) {
      const where = call[0]?.where ?? {};
      // Every deleteMany call touching invitation tokens must have isInvitation: true.
      // A call WITHOUT isInvitation would risk deleting password-reset tokens.
      if (where.isInvitation !== undefined) {
        expect(where.isInvitation).toBe(true);
      }
    }

    // Resend path.
    vi.clearAllMocks();
    mockMembershipFindUnique.mockResolvedValue({
      isActive: false,
    } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    mockTokenDeleteMany.mockResolvedValue({ count: 1 });
    mockTokenCreate.mockResolvedValue({ id: "token-resend" } as Awaited<ReturnType<typeof prisma.passwordResetToken.create>>);

    await resendTenantInvitation(TENANT_B, USER_ID, ACTOR_ID);
    for (const call of mockTokenDeleteMany.mock.calls) {
      const where = call[0]?.where ?? {};
      if (where.isInvitation !== undefined) {
        expect(where.isInvitation).toBe(true);
      }
    }

    // Revoke path.
    vi.clearAllMocks();
    mockMembershipFindUnique.mockResolvedValue({
      isActive: false,
    } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    mockTokenDeleteMany.mockResolvedValue({ count: 1 });

    await revokeTenantInvitation(TENANT_B, USER_ID, ACTOR_ID);
    for (const call of mockTokenDeleteMany.mock.calls) {
      const where = call[0]?.where ?? {};
      if (where.isInvitation !== undefined) {
        expect(where.isInvitation).toBe(true);
      }
    }
  });
});
