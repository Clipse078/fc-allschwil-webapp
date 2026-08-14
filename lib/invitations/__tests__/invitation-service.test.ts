/**
 * INVITE-01 — Invitation Service Unit Tests
 *
 * Focused unit tests for:
 *   1. Identity invariant: Person↔User per-tenant uniqueness
 *   2. Invitation lifecycle: create, resend, revoke, accept
 *   3. Authorization separation: PersonAssignment never touched
 *
 * All Prisma calls are mocked — no live DB required.
 * sendMail is mocked to prevent actual email delivery.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  invitationCreate: vi.fn(),
  invitationFindUnique: vi.fn(),
  invitationFindFirst: vi.fn(),
  invitationFindMany: vi.fn(),
  invitationUpdate: vi.fn(),
  invitationUpdateMany: vi.fn(),
  personFindFirst: vi.fn(),
  personFindUnique: vi.fn(),
  personCreate: vi.fn(),
  personUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  tenantMembershipUpsert: vi.fn(),
  tenantFindUnique: vi.fn(),
  logAction: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    invitation: {
      create: mocks.invitationCreate,
      findUnique: mocks.invitationFindUnique,
      findFirst: mocks.invitationFindFirst,
      findMany: mocks.invitationFindMany,
      update: mocks.invitationUpdate,
      updateMany: mocks.invitationUpdateMany,
    },
    person: {
      findFirst: mocks.personFindFirst,
      findUnique: mocks.personFindUnique,
      create: mocks.personCreate,
      update: mocks.personUpdate,
    },
    user: {
      findUnique: mocks.userFindUnique,
      create: mocks.userCreate,
    },
    tenantMembership: {
      upsert: mocks.tenantMembershipUpsert,
    },
    tenant: {
      findUnique: mocks.tenantFindUnique,
    },
  },
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

vi.mock("@/lib/email/mailer", () => ({
  sendMail: mocks.sendMail,
}));

import {
  createInvitation,
  resendInvitation,
  revokeInvitation,
  acceptInvitation,
  getInvitationsForTenant,
  InvitationNotFoundError,
  InvitationAlreadyAcceptedError,
  InvitationAlreadyRevokedError,
  InvitationExpiredError,
  PersonAlreadyHasUserError,
  InvitationPersonNotFoundError,
} from "@/lib/invitations/service";

const TENANT_ID = "tenant-001";
const PERSON_ID = "person-001";
const USER_ID = "user-001";
const ACTOR_ID = "actor-001";
const INV_ID = "inv-001";
const EMAIL = "invited@example.test";

function makePendingInvitation(overrides?: Partial<{
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}>) {
  return {
    id: INV_ID,
    tenantId: TENANT_ID,
    personId: PERSON_ID,
    email: EMAIL,
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    acceptedAt: null,
    revokedAt: null,
    person: { id: PERSON_ID, firstName: "Anna", lastName: "Müller", userId: null, tenantId: TENANT_ID },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.logAction.mockResolvedValue(undefined);
  mocks.sendMail.mockResolvedValue(undefined);
  mocks.tenantFindUnique.mockResolvedValue({ name: "FC Test" });
  mocks.invitationUpdateMany.mockResolvedValue({ count: 0 });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Identity invariant: Person↔User per-tenant uniqueness
// ═══════════════════════════════════════════════════════════════════════════════

describe("INVITE-01 — identity invariants", () => {
  it("I-1: createInvitation fails when Person already has a linked User", async () => {
    mocks.personFindFirst.mockResolvedValueOnce({
      id: PERSON_ID,
      firstName: "Anna",
      lastName: "Müller",
      userId: USER_ID, // already linked
    });

    await expect(
      createInvitation({
        tenantId: TENANT_ID,
        actorUserId: ACTOR_ID,
        email: EMAIL,
        existingPersonId: PERSON_ID,
      }),
    ).rejects.toBeInstanceOf(PersonAlreadyHasUserError);

    expect(mocks.invitationCreate).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("I-2: createInvitation fails when Person not found in tenant", async () => {
    mocks.personFindFirst.mockResolvedValueOnce(null);

    await expect(
      createInvitation({
        tenantId: TENANT_ID,
        actorUserId: ACTOR_ID,
        email: EMAIL,
        existingPersonId: "nonexistent",
      }),
    ).rejects.toBeInstanceOf(InvitationPersonNotFoundError);
  });

  it("I-3: acceptInvitation reuses existing User — never creates duplicate", async () => {
    const inv = makePendingInvitation();
    mocks.invitationFindUnique.mockResolvedValueOnce(inv);

    // Existing global User with this email
    mocks.userFindUnique.mockResolvedValueOnce({ id: USER_ID, isActive: true });
    mocks.tenantMembershipUpsert.mockResolvedValueOnce({});
    mocks.personUpdate.mockResolvedValueOnce({ id: PERSON_ID });
    mocks.invitationUpdate.mockResolvedValueOnce({});

    const result = await acceptInvitation({ rawToken: "a".repeat(64) });

    expect(mocks.userCreate).not.toHaveBeenCalled(); // NOT created
    expect(result.userId).toBe(USER_ID);
    expect(result.personId).toBe(PERSON_ID);
  });

  it("I-4: acceptInvitation creates new User only when none exists", async () => {
    const inv = makePendingInvitation();
    mocks.invitationFindUnique.mockResolvedValueOnce(inv);

    mocks.userFindUnique.mockResolvedValueOnce(null); // No existing User
    mocks.userCreate.mockResolvedValueOnce({ id: "new-user-id", isActive: true });
    mocks.tenantMembershipUpsert.mockResolvedValueOnce({});
    mocks.personUpdate.mockResolvedValueOnce({ id: PERSON_ID });
    mocks.invitationUpdate.mockResolvedValueOnce({});

    const result = await acceptInvitation({
      rawToken: "b".repeat(64),
      firstName: "Anna",
      lastName: "Müller",
      password: "securepassword123",
    });

    expect(mocks.userCreate).toHaveBeenCalledOnce();
    expect(result.userId).toBe("new-user-id");
  });

  it("I-5: acceptInvitation NEVER creates a second Person", async () => {
    const inv = makePendingInvitation();
    mocks.invitationFindUnique.mockResolvedValueOnce(inv);
    mocks.userFindUnique.mockResolvedValueOnce({ id: USER_ID, isActive: true });
    mocks.tenantMembershipUpsert.mockResolvedValueOnce({});
    mocks.personUpdate.mockResolvedValueOnce({});
    mocks.invitationUpdate.mockResolvedValueOnce({});

    await acceptInvitation({ rawToken: "c".repeat(64) });

    // Person.create must NOT be called during acceptance
    expect(mocks.personCreate).not.toHaveBeenCalled();
  });

  it("I-6: acceptInvitation links Person.userId (per-tenant) — TenantMembership created", async () => {
    const inv = makePendingInvitation();
    mocks.invitationFindUnique.mockResolvedValueOnce(inv);
    mocks.userFindUnique.mockResolvedValueOnce({ id: USER_ID, isActive: true });
    mocks.tenantMembershipUpsert.mockResolvedValueOnce({});
    mocks.personUpdate.mockResolvedValueOnce({});
    mocks.invitationUpdate.mockResolvedValueOnce({});

    await acceptInvitation({ rawToken: "d".repeat(64) });

    expect(mocks.tenantMembershipUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_userId: { tenantId: TENANT_ID, userId: USER_ID } },
      }),
    );
    expect(mocks.personUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PERSON_ID },
        data: { userId: USER_ID },
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Invitation lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

describe("INVITE-01 — invitation lifecycle", () => {
  it("L-1: createInvitation (existing person) sends email and creates invitation", async () => {
    mocks.personFindFirst.mockResolvedValueOnce({
      id: PERSON_ID,
      firstName: "Anna",
      lastName: "Müller",
      userId: null,
    });
    mocks.invitationCreate.mockResolvedValueOnce({ id: INV_ID });

    const result = await createInvitation({
      tenantId: TENANT_ID,
      actorUserId: ACTOR_ID,
      email: EMAIL,
      existingPersonId: PERSON_ID,
    });

    expect(result.invitationId).toBe(INV_ID);
    expect(result.personId).toBe(PERSON_ID);
    expect(mocks.sendMail).toHaveBeenCalledOnce();
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE" }),
    );
  });

  it("L-2: createInvitation (new person) creates Person then sends email", async () => {
    mocks.personCreate.mockResolvedValueOnce({ id: PERSON_ID });
    mocks.invitationCreate.mockResolvedValueOnce({ id: INV_ID });

    const result = await createInvitation({
      tenantId: TENANT_ID,
      actorUserId: ACTOR_ID,
      email: EMAIL,
      newPerson: { firstName: "Bernd", lastName: "Koch" },
    });

    expect(mocks.personCreate).toHaveBeenCalledOnce();
    expect(result.invitationId).toBe(INV_ID);
    expect(mocks.sendMail).toHaveBeenCalledOnce();
  });

  it("L-3: createInvitation revokes prior PENDING invitation for the same person", async () => {
    mocks.personFindFirst.mockResolvedValueOnce({
      id: PERSON_ID,
      firstName: "Anna",
      lastName: "Müller",
      userId: null,
    });
    mocks.invitationUpdateMany.mockResolvedValueOnce({ count: 1 });
    mocks.invitationCreate.mockResolvedValueOnce({ id: INV_ID });

    await createInvitation({
      tenantId: TENANT_ID,
      actorUserId: ACTOR_ID,
      email: EMAIL,
      existingPersonId: PERSON_ID,
    });

    expect(mocks.invitationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, personId: PERSON_ID, acceptedAt: null, revokedAt: null },
      }),
    );
  });

  it("L-4: resendInvitation refreshes token and sends email", async () => {
    mocks.invitationFindFirst.mockResolvedValueOnce(makePendingInvitation());
    mocks.invitationUpdate.mockResolvedValueOnce({});

    await resendInvitation({ invitationId: INV_ID, tenantId: TENANT_ID, actorUserId: ACTOR_ID });

    expect(mocks.invitationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INV_ID },
        data: expect.objectContaining({ tokenHash: expect.any(String) }),
      }),
    );
    expect(mocks.sendMail).toHaveBeenCalledOnce();
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RESEND" }),
    );
  });

  it("L-5: resendInvitation fails for already-accepted invitation", async () => {
    mocks.invitationFindFirst.mockResolvedValueOnce(
      makePendingInvitation({ acceptedAt: new Date() }),
    );

    await expect(
      resendInvitation({ invitationId: INV_ID, tenantId: TENANT_ID, actorUserId: ACTOR_ID }),
    ).rejects.toBeInstanceOf(InvitationAlreadyAcceptedError);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("L-6: resendInvitation fails for revoked invitation", async () => {
    mocks.invitationFindFirst.mockResolvedValueOnce(
      makePendingInvitation({ revokedAt: new Date() }),
    );

    await expect(
      resendInvitation({ invitationId: INV_ID, tenantId: TENANT_ID, actorUserId: ACTOR_ID }),
    ).rejects.toBeInstanceOf(InvitationAlreadyRevokedError);
  });

  it("L-7: revokeInvitation marks as revoked — does NOT delete Person", async () => {
    mocks.invitationFindFirst.mockResolvedValueOnce(makePendingInvitation());
    mocks.invitationUpdate.mockResolvedValueOnce({});

    await revokeInvitation({ invitationId: INV_ID, tenantId: TENANT_ID, actorUserId: ACTOR_ID });

    expect(mocks.invitationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
    // Critically: Person is never deleted
    expect(mocks.personUpdate).not.toHaveBeenCalled();
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "REVOKE" }),
    );
  });

  it("L-8: revokeInvitation fails for already-accepted invitation", async () => {
    mocks.invitationFindFirst.mockResolvedValueOnce(
      makePendingInvitation({ acceptedAt: new Date() }),
    );

    await expect(
      revokeInvitation({ invitationId: INV_ID, tenantId: TENANT_ID, actorUserId: ACTOR_ID }),
    ).rejects.toBeInstanceOf(InvitationAlreadyAcceptedError);
    expect(mocks.invitationUpdate).not.toHaveBeenCalled();
  });

  it("L-9: acceptInvitation fails for expired token", async () => {
    mocks.invitationFindUnique.mockResolvedValueOnce(
      makePendingInvitation({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(
      acceptInvitation({ rawToken: "e".repeat(64) }),
    ).rejects.toBeInstanceOf(InvitationExpiredError);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("L-10: acceptInvitation fails for revoked invitation", async () => {
    mocks.invitationFindUnique.mockResolvedValueOnce(
      makePendingInvitation({ revokedAt: new Date() }),
    );

    await expect(
      acceptInvitation({ rawToken: "f".repeat(64) }),
    ).rejects.toBeInstanceOf(InvitationAlreadyRevokedError);
  });

  it("L-11: acceptInvitation is idempotent for already-accepted invitations", async () => {
    mocks.invitationFindUnique.mockResolvedValueOnce(
      makePendingInvitation({ acceptedAt: new Date() }),
    );
    mocks.personFindUnique.mockResolvedValueOnce({ userId: USER_ID });

    const result = await acceptInvitation({ rawToken: "g".repeat(64) });

    expect(result.alreadyAccepted).toBe(true);
    // No side effects on already-accepted
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.tenantMembershipUpsert).not.toHaveBeenCalled();
  });

  it("L-12: acceptInvitation fails for unknown token", async () => {
    mocks.invitationFindUnique.mockResolvedValueOnce(null);

    await expect(
      acceptInvitation({ rawToken: "h".repeat(64) }),
    ).rejects.toBeInstanceOf(InvitationNotFoundError);
  });

  it("L-13: getInvitationsForTenant returns list with computed status", async () => {
    const now = new Date();
    mocks.invitationFindMany.mockResolvedValueOnce([
      {
        id: "inv-1",
        email: EMAIL,
        expiresAt: new Date(now.getTime() + 60000),
        acceptedAt: null,
        revokedAt: null,
        createdAt: now,
        person: { id: PERSON_ID, firstName: "Anna", lastName: "Müller" },
      },
      {
        id: "inv-2",
        email: EMAIL,
        expiresAt: new Date(now.getTime() + 60000),
        acceptedAt: now,
        revokedAt: null,
        createdAt: now,
        person: { id: PERSON_ID, firstName: "Anna", lastName: "Müller" },
      },
    ]);

    const result = await getInvitationsForTenant(TENANT_ID);

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("PENDING");
    expect(result[1].status).toBe("ACCEPTED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Authorization separation
// ═══════════════════════════════════════════════════════════════════════════════

describe("INVITE-01 — authorization separation", () => {
  it("A-1: createInvitation never creates/modifies UserRole", async () => {
    mocks.personFindFirst.mockResolvedValueOnce({
      id: PERSON_ID, firstName: "Anna", lastName: "Müller", userId: null,
    });
    mocks.invitationCreate.mockResolvedValueOnce({ id: INV_ID });

    await createInvitation({
      tenantId: TENANT_ID, actorUserId: ACTOR_ID, email: EMAIL, existingPersonId: PERSON_ID,
    });

    // UserRole table is never touched during invitation creation
    // (Prisma mock doesn't expose userRole — this confirms no call was made)
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entityType: "Invitation" }),
    );
  });

  it("A-2: revokeInvitation only sets revokedAt — no cascade to User/roles/membership", async () => {
    mocks.invitationFindFirst.mockResolvedValueOnce(makePendingInvitation());
    mocks.invitationUpdate.mockResolvedValueOnce({});

    await revokeInvitation({ invitationId: INV_ID, tenantId: TENANT_ID, actorUserId: ACTOR_ID });

    // Only invitation.update was called, not person, user, or membership operations
    expect(mocks.personUpdate).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.tenantMembershipUpsert).not.toHaveBeenCalled();
  });

  it("A-3: acceptInvitation does NOT modify existing passwordHash (userCreate only for new users)", async () => {
    const inv = makePendingInvitation();
    mocks.invitationFindUnique.mockResolvedValueOnce(inv);
    // Existing user
    mocks.userFindUnique.mockResolvedValueOnce({ id: USER_ID, isActive: true });
    mocks.tenantMembershipUpsert.mockResolvedValueOnce({});
    mocks.personUpdate.mockResolvedValueOnce({});
    mocks.invitationUpdate.mockResolvedValueOnce({});

    await acceptInvitation({ rawToken: "i".repeat(64) });

    // For existing user: userCreate NOT called (no password change)
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });
});
