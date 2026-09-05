import { describe, expect, it, vi } from "vitest";
import {
  deriveTenantAttention,
  isOnboardingTenant,
  tenantNeedsAttention,
} from "@/lib/tenants/platform-ops/attention";
import { mapStatusToOperationalPhase } from "@/lib/tenants/platform-ops/labels";
import {
  applyTenantLifecycleTransition,
  TenantLifecycleError,
} from "@/lib/tenants/platform-ops/lifecycle";

describe("platform-ops attention", () => {
  it("marks active tenants without admins as onboarding", () => {
    expect(
      isOnboardingTenant({
        status: "ACTIVE",
        activeClubAdminCount: 0,
        activeMemberCount: 0,
        countryCode: "CH",
        locale: "de-CH",
        timezone: "Europe/Zurich",
      }),
    ).toBe(true);
    expect(
      mapStatusToOperationalPhase("ACTIVE", true),
    ).toBe("ONBOARDING");
  });

  it("derives suspended and no-admin attention items", () => {
    const items = deriveTenantAttention({
      status: "INACTIVE",
      activeClubAdminCount: 0,
      activeMemberCount: 1,
      countryCode: null,
      locale: null,
      timezone: null,
    });
    expect(items.map((item) => item.code)).toEqual([
      "SUSPENDED",
      "NO_ACTIVE_ADMIN",
      "INCOMPLETE_CONFIG",
    ]);
    expect(tenantNeedsAttention({
      status: "ACTIVE",
      activeClubAdminCount: 1,
      activeMemberCount: 2,
      countryCode: "CH",
      locale: "de-CH",
      timezone: "Europe/Zurich",
    })).toBe(false);
  });
});

describe("tenant lifecycle transitions", () => {
  const tenant = {
    id: "tenant-1",
    key: "fc-test",
    name: "FC Test",
    status: "ACTIVE" as const,
  };

  it("rejects suspend without reason", async () => {
    const tx = {
      tenant: {
        count: vi.fn().mockResolvedValue(2),
        update: vi.fn(),
      },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn(async (cb: (client: unknown) => Promise<unknown>) =>
        cb({
          tenant: { count: vi.fn().mockResolvedValue(2), update: vi.fn() },
          auditLog: { create: vi.fn() },
        }),
      ),
    };

    await expect(
      applyTenantLifecycleTransition(tx as never, tenant, "suspend", {
        actorUserId: "actor-1",
      }),
    ).rejects.toBeInstanceOf(TenantLifecycleError);
  });

  it("records suspend with reason and previous status", async () => {
    const update = vi.fn().mockResolvedValue({
      ...tenant,
      status: "INACTIVE",
    });
    const auditCreate = vi.fn().mockResolvedValue(undefined);
    const client = {
      tenant: {
        count: vi.fn().mockResolvedValue(2),
        update,
        findUnique: vi.fn(),
      },
      auditLog: { create: auditCreate },
      $transaction: vi.fn(async (cb: (inner: unknown) => Promise<unknown>) =>
        cb({
          tenant: {
            count: vi.fn().mockResolvedValue(2),
            update,
          },
          auditLog: { create: auditCreate },
        }),
      ),
    };

    const result = await applyTenantLifecycleTransition(
      client as never,
      tenant,
      "suspend",
      {
        actorUserId: "actor-1",
        reason: "Contract review",
      },
    );

    expect(result.previousStatus).toBe("ACTIVE");
    expect(result.newStatus).toBe("INACTIVE");
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "tenant_suspended",
          actorUserId: "actor-1",
          tenantId: "tenant-1",
          beforeJson: { status: "ACTIVE" },
          afterJson: { status: "INACTIVE" },
        }),
      }),
    );
  });

  it("rejects invalid archive transition from archived tenant", async () => {
    await expect(
      applyTenantLifecycleTransition(
        {
          tenant: { count: vi.fn(), update: vi.fn() },
          auditLog: { create: vi.fn() },
          $transaction: vi.fn(),
        } as never,
        { ...tenant, status: "ARCHIVED" },
        "archive",
        { actorUserId: "actor-1", reason: "done" },
      ),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});
