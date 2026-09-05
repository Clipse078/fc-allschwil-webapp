import { beforeEach, describe, expect, it, vi } from "vitest";
import { DelegationForbiddenError } from "@/lib/roles/errors";

const mocks = vi.hoisted(() => ({
  assertTenantDelegationAllowed: vi.fn(),
  personFindUnique: vi.fn(),
}));

vi.mock("@/lib/roles/delegation", () => ({
  assertTenantDelegationAllowed: mocks.assertTenantDelegationAllowed,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    person: { findUnique: mocks.personFindUnique },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/roles/mutations", () => ({ setTenantUserRoles: vi.fn() }));
vi.mock("@/lib/roles/scoped-mutations", () => ({
  assignScopedRoleToUser: vi.fn(),
}));

import { invitePersonToTenant } from "@/lib/users/mutations";

describe("SECURITY-GO-LIVE-01K-A invite delegation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects attached roles at the canonical subset boundary before onboarding writes", async () => {
    mocks.assertTenantDelegationAllowed.mockRejectedValueOnce(
      new DelegationForbiddenError(),
    );

    await expect(
      invitePersonToTenant("tenant-a", "person-a", "actor-a", {
        sendInvitation: false,
        roleIds: ["strong-role"],
        scopedRoles: [
          { roleId: "foreign-role", orgUnitId: "org-unit-a" },
        ],
      }),
    ).rejects.toBeInstanceOf(DelegationForbiddenError);

    expect(mocks.assertTenantDelegationAllowed).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      actorUserId: "actor-a",
      roleIds: ["strong-role", "foreign-role"],
    });
    expect(mocks.personFindUnique).not.toHaveBeenCalled();
  });
});
