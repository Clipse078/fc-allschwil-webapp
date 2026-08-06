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
  getCurrentTenantContext: vi.fn(),
  tenantMembershipFindFirst: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/tenants/context", () => ({
  getCurrentTenantContextById: mocks.getCurrentTenantContextById,
  getCurrentTenantContext: mocks.getCurrentTenantContext,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenantMembership: {
      findFirst: mocks.tenantMembershipFindFirst,
    },
  },
}));

import {
  getActiveTenantId,
  requireActiveTenantId,
  getActiveTenant,
  requireTenantContext,
  requireApiActiveTenantId,
  getTenantContextForSlug,
  requireTenantContextForSlug,
  requireApiTenantContextForSlug,
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

// ── RPERM-04-C1: Route Tenant-Slug Resolution ───────────────────────────────
//
// getTenantContextForSlug()/requireTenantContextForSlug()/
// requireApiTenantContextForSlug() resolve the tenant named by a URL
// tenantSlug param — NEVER session.user.activeTenantId. This is the fix for
// "registration route authorizes against wrong tenant" (Finding 2): a user
// authorized in Tenant A must not be able to reach Tenant B's data merely by
// changing the URL slug, even though their session's activeTenantId is
// Tenant A the whole time.

const TENANT_B_CONTEXT = {
  ...TENANT_CONTEXT,
  id: "tenant-2",
  key: "tenant-b",
  name: "Tenant B",
};

describe("getTenantContextForSlug", () => {
  it("resolves the tenant named by the slug — independent of session.activeTenantId", async () => {
    // Session's OWN active tenant is Tenant A, but the route names Tenant B.
    mocks.auth.mockResolvedValue({ user: { id: "user-1", activeTenantId: "tenant-1" } });
    mocks.getCurrentTenantContext.mockResolvedValue(TENANT_B_CONTEXT);
    mocks.tenantMembershipFindFirst.mockResolvedValue({ id: "membership-b" });

    const result = await getTenantContextForSlug("tenant-b");

    expect(result).toEqual({ ...TENANT_B_CONTEXT, membershipId: "membership-b" });
    // The tenant is looked up BY THE SLUG, not by session.activeTenantId.
    expect(mocks.getCurrentTenantContext).toHaveBeenCalledWith("tenant-b");
  });

  it("returns null when there is no session", async () => {
    mocks.auth.mockResolvedValue(null);

    const result = await getTenantContextForSlug("tenant-b");

    expect(result).toBeNull();
    expect(mocks.getCurrentTenantContext).not.toHaveBeenCalled();
  });

  it("returns null when the slug does not resolve to any tenant", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getCurrentTenantContext.mockResolvedValue(null);

    const result = await getTenantContextForSlug("unknown-slug");

    expect(result).toBeNull();
    // Membership must never be queried once the tenant itself is not found.
    expect(mocks.tenantMembershipFindFirst).not.toHaveBeenCalled();
  });

  it("returns null when the tenant is ARCHIVED (getCurrentTenantContext already filters status ACTIVE)", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    // getCurrentTenantContext() filters status: "ACTIVE" at the DB level —
    // an archived tenant simply never resolves.
    mocks.getCurrentTenantContext.mockResolvedValue(null);

    const result = await getTenantContextForSlug("archived-club");

    expect(result).toBeNull();
  });

  it("returns null when the tenant exists but the user has no active membership in it — the cross-tenant-access denial", async () => {
    // Regression case for Finding 2: user has a valid session (active in
    // Tenant A) but zero membership in Tenant B. Must be denied even though
    // Tenant B itself exists and is ACTIVE.
    mocks.auth.mockResolvedValue({ user: { id: "user-1", activeTenantId: "tenant-1" } });
    mocks.getCurrentTenantContext.mockResolvedValue(TENANT_B_CONTEXT);
    mocks.tenantMembershipFindFirst.mockResolvedValue(null);

    const result = await getTenantContextForSlug("tenant-b");

    expect(result).toBeNull();
    expect(mocks.tenantMembershipFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-2", userId: "user-1", isActive: true },
      }),
    );
  });

  it("returns null for an empty tenantSlug without querying", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });

    const result = await getTenantContextForSlug("");

    expect(result).toBeNull();
    expect(mocks.getCurrentTenantContext).not.toHaveBeenCalled();
  });
});

describe("requireTenantContextForSlug", () => {
  it("returns the tenant context when the tenant is ACTIVE and membership is active", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getCurrentTenantContext.mockResolvedValue(TENANT_CONTEXT);
    mocks.tenantMembershipFindFirst.mockResolvedValue({ id: "membership-1" });

    const result = await requireTenantContextForSlug("fc-allschwil");

    expect(result).toEqual({ ...TENANT_CONTEXT, membershipId: "membership-1" });
  });

  it("redirects to /dashboard when the user has no membership in the slug-resolved tenant", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getCurrentTenantContext.mockResolvedValue(TENANT_B_CONTEXT);
    mocks.tenantMembershipFindFirst.mockResolvedValue(null);

    await expect(requireTenantContextForSlug("tenant-b")).rejects.toThrow(
      "REDIRECT:/dashboard",
    );
  });

  it("redirects to /dashboard when the slug does not resolve to any (active) tenant", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getCurrentTenantContext.mockResolvedValue(null);

    await expect(requireTenantContextForSlug("archived-club")).rejects.toThrow(
      "REDIRECT:/dashboard",
    );
  });
});

describe("requireApiTenantContextForSlug", () => {
  it("returns ok:true with the resolved tenantId when membership is valid", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getCurrentTenantContext.mockResolvedValue(TENANT_CONTEXT);
    mocks.tenantMembershipFindFirst.mockResolvedValue({ id: "membership-1" });

    const result = await requireApiTenantContextForSlug("fc-allschwil");

    expect(result).toEqual({
      ok: true,
      tenantId: "tenant-1",
      tenant: { ...TENANT_CONTEXT, membershipId: "membership-1" },
    });
  });

  it("returns ok:false 401 when there is no session (never redirects)", async () => {
    mocks.auth.mockResolvedValue(null);

    const result = await requireApiTenantContextForSlug("tenant-b");

    expect(result).toEqual({ ok: false, status: 401, error: "Unauthorized" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns ok:false 404 when the caller has no membership in the slug-resolved tenant — the cross-tenant denial", async () => {
    // Session's own tenant is Tenant A; the API route is called for Tenant
    // B's slug. Must be rejected before any registration data is fetched.
    mocks.auth.mockResolvedValue({ user: { id: "user-1", activeTenantId: "tenant-1" } });
    mocks.getCurrentTenantContext.mockResolvedValue(TENANT_B_CONTEXT);
    mocks.tenantMembershipFindFirst.mockResolvedValue(null);

    const result = await requireApiTenantContextForSlug("tenant-b");

    expect(result).toEqual({ ok: false, status: 404, error: "Tenant nicht gefunden." });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns ok:false 404 when the tenant is archived/unknown", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getCurrentTenantContext.mockResolvedValue(null);

    const result = await requireApiTenantContextForSlug("archived-club");

    expect(result).toEqual({ ok: false, status: 404, error: "Tenant nicht gefunden." });
  });
});
