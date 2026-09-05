import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  userRoleFindFirst: vi.fn(),
  membershipUpdate: vi.fn(),
  passwordResetDeleteMany: vi.fn(),
  passwordResetCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenantMembership: {
      findUnique: mocks.membershipFindUnique,
      update: mocks.membershipUpdate,
    },
    userRole: {
      findFirst: mocks.userRoleFindFirst,
    },
    passwordResetToken: {
      deleteMany: mocks.passwordResetDeleteMany,
      create: mocks.passwordResetCreate,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/audit/log-action", () => ({ logAction: vi.fn() }));

import {
  InvitationDomainError,
  MembershipDomainError,
  RemoveMembershipDomainError,
  removeTenantMembership,
  resendTenantInvitation,
  setTenantMembershipActive,
} from "@/lib/users/mutations";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.membershipFindUnique.mockResolvedValue({
    id: "membership-1",
    isActive: true,
  });
  mocks.userRoleFindFirst.mockResolvedValue({ id: "platform-assignment" });
});

describe("tenant account management cannot mutate platform accounts", () => {
  it("blocks tenant deactivation of a platform Superadmin", async () => {
    await expect(
      setTenantMembershipActive("tenant-a", "platform-admin", false, "tenant-admin"),
    ).rejects.toMatchObject<Partial<MembershipDomainError>>({
      code: "PLATFORM_ACCOUNT_PROTECTED",
    });
    expect(mocks.membershipUpdate).not.toHaveBeenCalled();
  });

  it("blocks tenant removal of a platform Superadmin", async () => {
    await expect(
      removeTenantMembership("tenant-a", "platform-admin", "tenant-admin"),
    ).rejects.toMatchObject<Partial<RemoveMembershipDomainError>>({
      code: "PLATFORM_ACCOUNT_PROTECTED",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("blocks tenant invitation/reset issuance for a platform Superadmin", async () => {
    await expect(
      resendTenantInvitation("tenant-a", "platform-admin", "tenant-admin"),
    ).rejects.toMatchObject<Partial<InvitationDomainError>>({
      code: "PLATFORM_ACCOUNT_PROTECTED",
    });
    expect(mocks.passwordResetDeleteMany).not.toHaveBeenCalled();
    expect(mocks.passwordResetCreate).not.toHaveBeenCalled();
  });

  it("fails a cross-tenant account id as not found before privilege inspection", async () => {
    mocks.membershipFindUnique.mockResolvedValue(null);

    await expect(
      setTenantMembershipActive("tenant-a", "tenant-b-user", false, "tenant-admin"),
    ).rejects.toMatchObject<Partial<MembershipDomainError>>({
      code: "MEMBERSHIP_NOT_FOUND",
    });
    expect(mocks.userRoleFindFirst).not.toHaveBeenCalled();
    expect(mocks.membershipUpdate).not.toHaveBeenCalled();
  });
});
