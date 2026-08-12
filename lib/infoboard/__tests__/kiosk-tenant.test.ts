/**
 * lib/infoboard/__tests__/kiosk-tenant.test.ts
 *
 * Focused tests for kiosk tenant resolution.
 *
 * Covers:
 *   - extractSubdomainTenantKey (pure hostname → key logic)
 *   - resolveKioskTenantForHostname (DB resolution + fallback chain)
 *   - Same slug safely resolves to different tenants (cross-tenant isolation)
 *   - ACTIVE-only enforcement (resolver never returns INACTIVE/DRAFT)
 *   - localhost/dev fallback
 *   - env var override
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { extractSubdomainTenantKey, resolveKioskTenantForHostname } from "../kiosk-tenant";

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: { findFirst: mocks.findFirst },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}));

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.KIOSK_DEFAULT_TENANT_KEY;
});

// ── extractSubdomainTenantKey — pure hostname parsing ─────────────────────────

describe("extractSubdomainTenantKey", () => {
  it("extracts subdomain from a standard multi-part hostname", () => {
    expect(extractSubdomainTenantKey("fc-allschwil.sportclubevo.com")).toBe("fc-allschwil");
  });

  it("extracts subdomain with port stripped", () => {
    expect(extractSubdomainTenantKey("fc-allschwil.sportclubevo.com:3000")).toBe("fc-allschwil");
  });

  it("returns null for localhost", () => {
    expect(extractSubdomainTenantKey("localhost")).toBeNull();
  });

  it("returns null for localhost:port", () => {
    expect(extractSubdomainTenantKey("localhost:3000")).toBeNull();
  });

  it("returns null for bare IPv4", () => {
    expect(extractSubdomainTenantKey("192.168.1.1")).toBeNull();
    expect(extractSubdomainTenantKey("127.0.0.1")).toBeNull();
  });

  it("returns null for bare IPv4 with port", () => {
    expect(extractSubdomainTenantKey("192.168.1.1:3000")).toBeNull();
  });

  it("returns null for a single-segment hostname (no dot)", () => {
    expect(extractSubdomainTenantKey("sportclubevo")).toBeNull();
  });

  it("returns null for a two-segment hostname (domain.tld — no subdomain)", () => {
    expect(extractSubdomainTenantKey("sportclubevo.com")).toBeNull();
  });

  it("returns null for www subdomain", () => {
    expect(extractSubdomainTenantKey("www.sportclubevo.com")).toBeNull();
  });

  it("returns null for empty hostname", () => {
    expect(extractSubdomainTenantKey("")).toBeNull();
  });

  it("returns the first segment for a four-part hostname", () => {
    expect(extractSubdomainTenantKey("other.fc-allschwil.example.com")).toBe("other");
  });

  it("lowercases the extracted key", () => {
    expect(extractSubdomainTenantKey("FC-Allschwil.sportclubevo.com")).toBe("fc-allschwil");
  });

  it("two different subdomains produce two different tenant keys", () => {
    const key1 = extractSubdomainTenantKey("club-a.sportclubevo.com");
    const key2 = extractSubdomainTenantKey("club-b.sportclubevo.com");
    expect(key1).toBe("club-a");
    expect(key2).toBe("club-b");
    expect(key1).not.toBe(key2);
  });
});

// ── resolveKioskTenantForHostname — DB resolution ─────────────────────────────

const TENANT_A = {
  id: "tenant-a",
  key: "club-a",
  name: "Club A",
  timezone: "Europe/Zurich",
  logoUrl: null,
  infoboardDisplayTheme: null,
};

const TENANT_B = {
  id: "tenant-b",
  key: "club-b",
  name: "Club B",
  timezone: "Europe/Zurich",
  logoUrl: null,
  infoboardDisplayTheme: null,
};

describe("resolveKioskTenantForHostname — subdomain resolution", () => {
  it("resolves to the tenant matching the hostname subdomain", async () => {
    mocks.findFirst.mockResolvedValueOnce(TENANT_A);
    const tenant = await resolveKioskTenantForHostname("club-a.sportclubevo.com");
    expect(tenant?.id).toBe("tenant-a");
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ key: "club-a", status: "ACTIVE" }) }),
    );
  });

  it("same slug path resolves differently for different tenants (cross-tenant isolation)", async () => {
    // Two calls with different hostnames
    mocks.findFirst.mockResolvedValueOnce(TENANT_A);
    const tenantForA = await resolveKioskTenantForHostname("club-a.sportclubevo.com");

    mocks.findFirst.mockResolvedValueOnce(TENANT_B);
    const tenantForB = await resolveKioskTenantForHostname("club-b.sportclubevo.com");

    expect(tenantForA?.id).toBe("tenant-a");
    expect(tenantForB?.id).toBe("tenant-b");
    expect(tenantForA?.id).not.toBe(tenantForB?.id);
  });

  it("never returns an INACTIVE tenant — ACTIVE filter is always applied", async () => {
    mocks.findFirst.mockResolvedValueOnce(null); // DB returns null (ACTIVE filter excluded it)
    mocks.findFirst.mockResolvedValueOnce(TENANT_A); // fallback finds it
    const tenant = await resolveKioskTenantForHostname("inactive-club.sportclubevo.com");

    // First call had ACTIVE in where clause
    expect(mocks.findFirst.mock.calls[0][0].where.status).toBe("ACTIVE");
  });
});

describe("resolveKioskTenantForHostname — fallback chain", () => {
  it("falls back to KIOSK_DEFAULT_TENANT_KEY when subdomain not found", async () => {
    process.env.KIOSK_DEFAULT_TENANT_KEY = "club-b";
    mocks.findFirst
      .mockResolvedValueOnce(null) // subdomain lookup returns nothing
      .mockResolvedValueOnce(TENANT_B); // fallback key lookup succeeds

    const tenant = await resolveKioskTenantForHostname("unknown-subdomain.sportclubevo.com");
    expect(tenant?.id).toBe("tenant-b");

    // Second DB call used the env var key
    expect(mocks.findFirst.mock.calls[1][0].where.key).toBe("club-b");
  });

  it("falls back to DEFAULT_TENANT_KEY for localhost (no subdomain)", async () => {
    mocks.findFirst.mockResolvedValueOnce(TENANT_A);
    const tenant = await resolveKioskTenantForHostname("localhost:3000");

    // Only one DB call (no subdomain attempt), using DEFAULT_TENANT_KEY
    expect(mocks.findFirst).toHaveBeenCalledOnce();
    expect(mocks.findFirst.mock.calls[0][0].where.key).toBe("fc-allschwil");
  });

  it("uses KIOSK_DEFAULT_TENANT_KEY env var when set (localhost path)", async () => {
    process.env.KIOSK_DEFAULT_TENANT_KEY = "custom-club";
    mocks.findFirst.mockResolvedValueOnce(TENANT_B);

    await resolveKioskTenantForHostname("localhost");
    expect(mocks.findFirst.mock.calls[0][0].where.key).toBe("custom-club");
  });

  it("returns null when no active tenant found at any step", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(null) // subdomain lookup
      .mockResolvedValueOnce(null); // fallback lookup

    const tenant = await resolveKioskTenantForHostname("unknown.sportclubevo.com");
    expect(tenant).toBeNull();
  });

  it("returns null when even localhost fallback finds nothing", async () => {
    mocks.findFirst.mockResolvedValueOnce(null);
    const tenant = await resolveKioskTenantForHostname("localhost");
    expect(tenant).toBeNull();
  });

  it("KIOSK_DEFAULT_TENANT_KEY empty string falls back to DEFAULT_TENANT_KEY", async () => {
    process.env.KIOSK_DEFAULT_TENANT_KEY = "  "; // whitespace only
    mocks.findFirst.mockResolvedValueOnce(TENANT_A);

    await resolveKioskTenantForHostname("localhost");
    expect(mocks.findFirst.mock.calls[0][0].where.key).toBe("fc-allschwil");
  });
});

describe("resolveKioskTenantForHostname — no cross-tenant leakage", () => {
  it("DB query always includes tenantId-equivalent key scoping (never unscoped)", async () => {
    mocks.findFirst.mockResolvedValueOnce(TENANT_A);
    await resolveKioskTenantForHostname("club-a.sportclubevo.com");

    const call = mocks.findFirst.mock.calls[0][0];
    // The where clause must include both key and status — never fetches all tenants
    expect(call.where).toHaveProperty("key");
    expect(call.where).toHaveProperty("status", "ACTIVE");
  });

  it("a subdomain that does not match any tenant falls to the default, not a cross-tenant guess", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(null) // subdomain "bad-actor" not found
      .mockResolvedValueOnce(TENANT_A); // falls to DEFAULT_TENANT_KEY

    const tenant = await resolveKioskTenantForHostname("bad-actor.sportclubevo.com");

    // Fallback resolves DEFAULT_TENANT_KEY, not "bad-actor"
    const fallbackCall = mocks.findFirst.mock.calls[1][0];
    expect(fallbackCall.where.key).toBe("fc-allschwil");
    expect(fallbackCall.where.key).not.toBe("bad-actor");
  });
});
