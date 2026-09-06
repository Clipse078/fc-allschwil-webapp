import { describe, expect, it } from "vitest";
import { ACCEPTANCE_SECURITY_SMOKE_SCENARIOS } from "@/lib/acceptance/security-smoke/scenarios";

describe("ACCEPTANCE_SECURITY_SMOKE_SCENARIOS", () => {
  it("covers tenant, role, session, and super-admin categories", () => {
    const categories = new Set(
      ACCEPTANCE_SECURITY_SMOKE_SCENARIOS.map((scenario) => scenario.category),
    );
    expect(categories).toEqual(
      new Set([
        "session-auth",
        "tenant-isolation",
        "role-isolation",
        "super-admin",
      ]),
    );
  });

  it("uses unique scenario ids", () => {
    const ids = ACCEPTANCE_SECURITY_SMOKE_SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the required tenant isolation scenarios", () => {
    const ids = new Set(
      ACCEPTANCE_SECURITY_SMOKE_SCENARIOS.map((scenario) => scenario.id),
    );
    expect(ids).toContain("alpha-admin-accesses-alpha-org-units");
    expect(ids).toContain("alpha-admin-cannot-access-beta-slug-registrations");
    expect(ids).toContain("alpha-member-cannot-access-beta-slug-registrations");
    expect(ids).toContain("beta-admin-accesses-beta-org-units");
    expect(ids).toContain("beta-admin-cannot-access-alpha-slug-registrations");
    expect(ids).toContain("beta-member-cannot-access-alpha-slug-registrations");
    expect(ids).toContain("alpha-admin-cross-tenant-person-id-denied");
    expect(ids).toContain("beta-admin-cross-tenant-person-id-denied");
  });
});
