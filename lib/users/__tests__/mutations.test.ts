/**
 * USER-ADMIN-02B — Focused tests for setTenantMembershipActive()
 *
 * Covers:
 *   - Deactivate membership
 *   - Reactivate membership
 *   - User.isActive unchanged (update scoped to data: { isActive } only)
 *   - Roles unchanged (userRole.update/delete never called)
 *   - Other tenant memberships unchanged (where clause scoped)
 *   - Self-deactivation blocked
 *   - Last Club Admin protected
 *   - Cross-tenant user blocked (MEMBERSHIP_NOT_FOUND)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Prisma mock (module-level factory — avoids hoisting) ───────────────────────

vi.mock("@/lib/db/prisma", () => {
  return {
    prisma: {
      tenantMembership: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn(),
      },
      userRole: {
        count: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };
});

// Import modules after mock declarations
import { prisma } from "@/lib/db/prisma";
import { setTenantMembershipActive, MembershipDomainError } from "../mutations";

// ── Typed mock helpers ────────────────────────────────────────────────────────

const mockMembershipFindUnique = vi.mocked(prisma.tenantMembership.findUnique);
const mockMembershipUpdate = vi.mocked(prisma.tenantMembership.update);
const mockTenantFindUnique = vi.mocked(prisma.tenant.findUnique);
const mockUserRoleCount = vi.mocked(prisma.userRole.count);
const mockAuditLogCreate = vi.mocked(prisma.auditLog.create);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-001";
const USER_ID = "user-001";
const ACTOR_ID = "actor-001";
const MEMBERSHIP_ID = "mem-001";
const TENANT_KEY = "my-club";
const CLUB_ADMIN_ROLE_KEY = `club_admin__${TENANT_KEY}`;

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockMembershipFindUnique.mockResolvedValue({ id: MEMBERSHIP_ID, isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
  mockMembershipUpdate.mockResolvedValue({ id: MEMBERSHIP_ID, isActive: false } as Awaited<ReturnType<typeof prisma.tenantMembership.update>>);
  mockTenantFindUnique.mockResolvedValue({ key: TENANT_KEY } as Awaited<ReturnType<typeof prisma.tenant.findUnique>>);
  mockUserRoleCount.mockResolvedValue(0);
  mockAuditLogCreate.mockResolvedValue({} as Awaited<ReturnType<typeof prisma.auditLog.create>>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// Deactivate membership
// ═════════════════════════════════════════════════════════════════════════════

describe("setTenantMembershipActive — deactivation", () => {
  it("DEACT-1. sets isActive false on the membership", async () => {
    await setTenantMembershipActive(TENANT_ID, USER_ID, false, ACTOR_ID);

    expect(mockMembershipUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_userId: { tenantId: TENANT_ID, userId: USER_ID } },
        data: { isActive: false },
      }),
    );
  });

  it("DEACT-2. update data contains only isActive (User.isActive not touched)", async () => {
    await setTenantMembershipActive(TENANT_ID, USER_ID, false, ACTOR_ID);

    const updateData = mockMembershipUpdate.mock.calls[0][0].data;
    expect(Object.keys(updateData)).toEqual(["isActive"]);
  });

  it("DEACT-3. only updates the target tenant membership (tenantId + userId scope)", async () => {
    await setTenantMembershipActive(TENANT_ID, USER_ID, false, ACTOR_ID);

    const updateCall = mockMembershipUpdate.mock.calls[0][0];
    expect(updateCall.where).toEqual({
      tenantId_userId: { tenantId: TENANT_ID, userId: USER_ID },
    });
  });

  it("DEACT-4. writes an audit log entry with MEMBERSHIP_DEACTIVATED", async () => {
    await setTenantMembershipActive(TENANT_ID, USER_ID, false, ACTOR_ID);

    expect(mockAuditLogCreate).toHaveBeenCalledOnce();
    const logData = mockAuditLogCreate.mock.calls[0][0].data;
    expect(logData.action).toBe("MEMBERSHIP_DEACTIVATED");
    expect(logData.actorUserId).toBe(ACTOR_ID);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Reactivation
// ═════════════════════════════════════════════════════════════════════════════

describe("setTenantMembershipActive — reactivation", () => {
  beforeEach(() => {
    mockMembershipFindUnique.mockResolvedValue({ id: MEMBERSHIP_ID, isActive: false } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);
    mockMembershipUpdate.mockResolvedValue({ id: MEMBERSHIP_ID, isActive: true } as Awaited<ReturnType<typeof prisma.tenantMembership.update>>);
  });

  it("REACT-1. sets isActive true on the membership", async () => {
    await setTenantMembershipActive(TENANT_ID, USER_ID, true, ACTOR_ID);

    expect(mockMembershipUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: true } }),
    );
  });

  it("REACT-2. writes MEMBERSHIP_ACTIVATED audit entry", async () => {
    await setTenantMembershipActive(TENANT_ID, USER_ID, true, ACTOR_ID);

    const logData = mockAuditLogCreate.mock.calls[0][0].data;
    expect(logData.action).toBe("MEMBERSHIP_ACTIVATED");
  });

  it("REACT-3. does not run last-admin check on reactivation", async () => {
    await setTenantMembershipActive(TENANT_ID, USER_ID, true, ACTOR_ID);

    expect(mockUserRoleCount).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Self-deactivation blocked
// ═════════════════════════════════════════════════════════════════════════════

describe("setTenantMembershipActive — self-deactivation", () => {
  it("SELF-1. throws SELF_DEACTIVATION when actor === target and isActive=false", async () => {
    await expect(
      setTenantMembershipActive(TENANT_ID, ACTOR_ID, false, ACTOR_ID),
    ).rejects.toMatchObject({ code: "SELF_DEACTIVATION" });
  });

  it("SELF-2. does not update DB on self-deactivation attempt", async () => {
    await expect(
      setTenantMembershipActive(TENANT_ID, ACTOR_ID, false, ACTOR_ID),
    ).rejects.toThrow();

    expect(mockMembershipUpdate).not.toHaveBeenCalled();
  });

  it("SELF-3. allows self-reactivation (isActive=true)", async () => {
    mockMembershipFindUnique.mockResolvedValue({ id: MEMBERSHIP_ID, isActive: false } as Awaited<ReturnType<typeof prisma.tenantMembership.findUnique>>);

    await expect(
      setTenantMembershipActive(TENANT_ID, ACTOR_ID, true, ACTOR_ID),
    ).resolves.toBeUndefined();

    expect(mockMembershipUpdate).toHaveBeenCalledOnce();
  });

  it("SELF-4. self-check skipped when actorUserId is null", async () => {
    await expect(
      setTenantMembershipActive(TENANT_ID, USER_ID, false, null),
    ).resolves.toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Cross-tenant isolation — MEMBERSHIP_NOT_FOUND
// ═════════════════════════════════════════════════════════════════════════════

describe("setTenantMembershipActive — cross-tenant isolation", () => {
  it("ISO-1. throws MEMBERSHIP_NOT_FOUND when user is not a member of the tenant", async () => {
    mockMembershipFindUnique.mockResolvedValue(null);

    await expect(
      setTenantMembershipActive(TENANT_ID, USER_ID, false, ACTOR_ID),
    ).rejects.toMatchObject({ code: "MEMBERSHIP_NOT_FOUND" });
  });

  it("ISO-2. does not update DB when membership not found", async () => {
    mockMembershipFindUnique.mockResolvedValue(null);

    await expect(
      setTenantMembershipActive(TENANT_ID, USER_ID, false, ACTOR_ID),
    ).rejects.toThrow(MembershipDomainError);

    expect(mockMembershipUpdate).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Last Club Admin protected
// ═════════════════════════════════════════════════════════════════════════════

describe("setTenantMembershipActive — last Club Admin", () => {
  it("ADMIN-1. throws LAST_CLUB_ADMIN when deactivating the only active Club Admin", async () => {
    mockUserRoleCount
      .mockResolvedValueOnce(1) // targetIsClubAdmin
      .mockResolvedValueOnce(0); // otherActiveClubAdmins

    await expect(
      setTenantMembershipActive(TENANT_ID, USER_ID, false, ACTOR_ID),
    ).rejects.toMatchObject({ code: "LAST_CLUB_ADMIN" });
  });

  it("ADMIN-2. does not update DB when last Club Admin protection triggers", async () => {
    mockUserRoleCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    await expect(
      setTenantMembershipActive(TENANT_ID, USER_ID, false, ACTOR_ID),
    ).rejects.toThrow();

    expect(mockMembershipUpdate).not.toHaveBeenCalled();
  });

  it("ADMIN-3. allows deactivation when another active Club Admin exists", async () => {
    mockUserRoleCount
      .mockResolvedValueOnce(1) // targetIsClubAdmin
      .mockResolvedValueOnce(1); // otherActiveClubAdmins

    await expect(
      setTenantMembershipActive(TENANT_ID, USER_ID, false, ACTOR_ID),
    ).resolves.toBeUndefined();

    expect(mockMembershipUpdate).toHaveBeenCalledOnce();
  });

  it("ADMIN-4. allows deactivating a non-Club-Admin user even as the only member", async () => {
    mockUserRoleCount.mockResolvedValue(0); // not a Club Admin

    await expect(
      setTenantMembershipActive(TENANT_ID, USER_ID, false, ACTOR_ID),
    ).resolves.toBeUndefined();
  });

  it("ADMIN-5. uses canonical club_admin__<tenantKey> role key", async () => {
    mockUserRoleCount.mockResolvedValue(0);

    await setTenantMembershipActive(TENANT_ID, USER_ID, false, ACTOR_ID);

    const firstCountCall = mockUserRoleCount.mock.calls[0][0];
    expect(firstCountCall.where.role.key).toBe(CLUB_ADMIN_ROLE_KEY);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Invariants
// ═════════════════════════════════════════════════════════════════════════════

describe("setTenantMembershipActive — invariants", () => {
  it("INV-1. update data contains only isActive", async () => {
    await setTenantMembershipActive(TENANT_ID, USER_ID, false, ACTOR_ID);

    const updateData = mockMembershipUpdate.mock.calls[0][0].data;
    expect(Object.keys(updateData)).toEqual(["isActive"]);
  });

  it("INV-2. findUnique uses composite unique constraint key", async () => {
    await setTenantMembershipActive(TENANT_ID, USER_ID, false, ACTOR_ID);

    expect(mockMembershipFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_userId: { tenantId: TENANT_ID, userId: USER_ID } },
      }),
    );
  });
});
