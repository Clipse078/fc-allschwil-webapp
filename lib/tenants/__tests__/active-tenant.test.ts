/**
 * RPERM-04 — Single Tenant-Resolution Helper Tests
 *
 * Covers lib/tenants/active-tenant.ts, the only sanctioned way for
 * server-side code (dashboard pages, API routes) to obtain the current
 * tenant context — always sourced from session.user.activeTenantId
 * (TenantMembership-derived), never the legacy session.user.tenantId /
 * User.tenantId.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getCurrentTenantContextById: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/tenants/context", () => ({
  getCurrentTenantContextById: mocks.getCurrentTenantContextById,
}));

import {
  getActiveTenantId,
  requireActiveTenantId,
  getActiveTenant,
  requireTenantContext,
  requireApiActiveTenantId,
} from "../active-tenant";

const TENANT_CONTEXT = {
  id: "tenant-1",
  key: "fc-allschwil",
  name: "FC Allschwil",
  status: "ACTIVE",
  countryCode: "CH",
  sportCategory: "FOOTBALL",
  locale: "de-CH",
  timezone: "Europe/Zurich",
  currency: "CHF",
  seasonStartMonth: 8,
  seasonTransitionDay: 1,
  seasonTransitionMonth: 8,
  logoUrl: null,
  primaryColor: null,
  secondaryColor: null,
  approvedDataOnly: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
});

describe("getActiveTenantId", () => {
  it("returns session.user.activeTenantId when present", async () => {
    mocks.auth.mockResolvedValue({ user: { activeTenantId: "tenant-1" } });
    await expect(getActiveTenantId()).resolves.toBe("tenant-1");
  });

  it("returns null when there is no session", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(getActiveTenantId()).resolves.toBeNull();
  });

  it("returns null when activeTenantId is null (platform-only admin)", async () => {
    mocks.auth.mockResolvedValue({ user: { activeTenantId: null } });
    await expect(getActiveTenantId()).resolves.toBeNull();
  });
});

describe("requireActiveTenantId", () => {
  it("returns the id when present", async () => {
    mocks.auth.mockResolvedValue({ user: { activeTenantId: "tenant-1" } });
    await expect(requireActiveTenantId()).resolves.toBe("tenant-1");
  });

  it("redirects to /dashboard when absent", async () => {
    mocks.auth.mockResolvedValue({ user: { activeTenantId: null } });
    await expect(requireActiveTenantId()).rejects.toThrow("REDIRECT:/dashboard");
  });
});

describe("getActiveTenant", () => {
  it("resolves the full TenantContext by id when activeTenantId is present", async () => {
    mocks.auth.mockResolvedValue({ user: { activeTenantId: "tenant-1" } });
    mocks.getCurrentTenantContextById.mockResolvedValue(TENANT_CONTEXT);

    const result = await getActiveTenant();

    expect(result).toEqual(TENANT_CONTEXT);
    expect(mocks.getCurrentTenantContextById).toHaveBeenCalledWith("tenant-1");
  });

  it("returns null without querying when there is no active tenant", async () => {
    mocks.auth.mockResolvedValue({ user: { activeTenantId: null } });

    const result = await getActiveTenant();

    expect(result).toBeNull();
    expect(mocks.getCurrentTenantContextById).not.toHaveBeenCalled();
  });
});

describe("requireTenantContext", () => {
  it("returns the full TenantContext when present", async () => {
    mocks.auth.mockResolvedValue({ user: { activeTenantId: "tenant-1" } });
    mocks.getCurrentTenantContextById.mockResolvedValue(TENANT_CONTEXT);

    await expect(requireTenantContext()).resolves.toEqual(TENANT_CONTEXT);
  });

  it("redirects to /dashboard when there is no active tenant", async () => {
    mocks.auth.mockResolvedValue({ user: { activeTenantId: null } });

    await expect(requireTenantContext()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("redirects to /dashboard when the tenant record cannot be resolved", async () => {
    mocks.auth.mockResolvedValue({ user: { activeTenantId: "tenant-1" } });
    mocks.getCurrentTenantContextById.mockResolvedValue(null);

    await expect(requireTenantContext()).rejects.toThrow("REDIRECT:/dashboard");
  });
});

describe("requireApiActiveTenantId", () => {
  it("returns ok:true with the tenantId when present", async () => {
    mocks.auth.mockResolvedValue({ user: { activeTenantId: "tenant-1" } });

    const result = await requireApiActiveTenantId();

    expect(result).toEqual({ ok: true, tenantId: "tenant-1" });
  });

  it("returns ok:false 403 when there is no active tenant (never redirects)", async () => {
    mocks.auth.mockResolvedValue({ user: { activeTenantId: null } });

    const result = await requireApiActiveTenantId();

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "Kein Mandanten-Kontext.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
