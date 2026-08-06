/**
 * lib/roles/__tests__/tenant-role-keys.test.ts
 *
 * RPERM-05-C1 — Canonical role-key generation.
 */

import { describe, expect, it } from "vitest";
import { CLUB_ADMIN_TEMPLATE_KEY, getTenantClubAdminRoleKey } from "../tenant-role-keys";

describe("getTenantClubAdminRoleKey", () => {
  it("derives the canonical FC Allschwil key", () => {
    expect(getTenantClubAdminRoleKey("fc-allschwil")).toBe("club_admin__fc-allschwil");
  });

  it("is deterministic for the same tenant key", () => {
    expect(getTenantClubAdminRoleKey("fc-allschwil")).toBe(getTenantClubAdminRoleKey("fc-allschwil"));
  });

  it("produces different keys for different tenants (tenant-safe)", () => {
    expect(getTenantClubAdminRoleKey("fc-allschwil")).not.toBe(getTenantClubAdminRoleKey("tenant-b"));
  });

  it("uses the CLUB_ADMIN_TEMPLATE_KEY prefix", () => {
    expect(getTenantClubAdminRoleKey("tenant-b")).toBe(`${CLUB_ADMIN_TEMPLATE_KEY}__tenant-b`);
  });

  it("trims surrounding whitespace in the tenant key", () => {
    expect(getTenantClubAdminRoleKey("  fc-allschwil  ")).toBe("club_admin__fc-allschwil");
  });

  it("throws on an empty tenant key", () => {
    expect(() => getTenantClubAdminRoleKey("")).toThrow();
    expect(() => getTenantClubAdminRoleKey("   ")).toThrow();
  });

  it("does not collide with the legacy divergent key format", () => {
    // Regression guard for the RPERM-05-C1 finding: the legacy bootstrap
    // script generated `club_admin_fc_allschwil` (single underscore,
    // dashes replaced with underscores) — the canonical helper must never
    // produce that string.
    expect(getTenantClubAdminRoleKey("fc-allschwil")).not.toBe("club_admin_fc_allschwil");
  });
});
