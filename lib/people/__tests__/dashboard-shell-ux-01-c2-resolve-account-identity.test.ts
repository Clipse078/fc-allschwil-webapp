/**
 * DASHBOARD-SHELL-UX-01-C2 — resolveAccountIdentityName()
 *
 * Root cause: the sidebar footer (directly above "Abmelden") rendered
 * `session.user.firstName` / `session.user.lastName` directly. The FC
 * Allschwil tenant club-admin bootstrap account
 * (scripts/rperm-03b-bootstrap-admin-separation.ts) was created with
 * `User.firstName = "FC Allschwil"` and `User.lastName = "Club Admin"` (the
 * club name and role label, not a person's name), so the footer rendered
 * "FC Allschwil Club Admin" instead of the authenticated person's real name
 * ("Michael Duijster"), which lives on the canonically linked Person record
 * (Person.userId, ADMIN-MASTERDATA-UX-01).
 *
 * These tests cover `resolveAccountIdentityName()`, the resolution rule now
 * wired into app/(admin)/layout.tsx before the identity is passed to
 * AdminSidebar.
 */

import { describe, it, expect } from "vitest";
import { resolveAccountIdentityName } from "@/lib/people/identity";

describe("DASHBOARD-SHELL-UX-01-C2 — resolveAccountIdentityName", () => {
  it("prefers the linked Person's full name (Michael Duijster) over the tenant/role-derived User columns", () => {
    const identity = resolveAccountIdentityName({
      linkedPerson: { firstName: "Michael", lastName: "Duijster" },
      sessionFirstName: "FC Allschwil",
      sessionLastName: "Club Admin",
      tenantName: "FC Allschwil",
    });

    expect(identity).toEqual({ firstName: "Michael", lastName: "Duijster" });
    // Never the role/club label.
    expect(`${identity.firstName} ${identity.lastName}`).not.toContain("Club Admin");
    expect(`${identity.firstName} ${identity.lastName}`).not.toContain("FC Allschwil");
  });

  it("trims whitespace from the linked Person's name", () => {
    const identity = resolveAccountIdentityName({
      linkedPerson: { firstName: "  Michael  ", lastName: "  Duijster  " },
      sessionFirstName: "FC Allschwil",
      sessionLastName: "Club Admin",
      tenantName: "FC Allschwil",
    });

    expect(identity).toEqual({ firstName: "Michael", lastName: "Duijster" });
  });

  it("falls back to session.user.firstName/lastName when no Person is linked and they are not tenant-derived", () => {
    const identity = resolveAccountIdentityName({
      linkedPerson: null,
      sessionFirstName: "Peter",
      sessionLastName: "Muster",
      tenantName: "FC Allschwil",
    });

    expect(identity).toEqual({ firstName: "Peter", lastName: "Muster" });
  });

  it('falls back to a generic account label — never "FC Allschwil" — when no Person is linked and the User first name matches the tenant name', () => {
    const identity = resolveAccountIdentityName({
      linkedPerson: null,
      sessionFirstName: "FC Allschwil",
      sessionLastName: "Club Admin",
      tenantName: "FC Allschwil",
    });

    expect(identity.firstName).not.toBe("FC Allschwil");
    expect(`${identity.firstName} ${identity.lastName}`).not.toContain("FC Allschwil");
  });

  it("matches the tenant name case-insensitively when filtering out the tenant name", () => {
    const identity = resolveAccountIdentityName({
      linkedPerson: null,
      sessionFirstName: "fc allschwil",
      sessionLastName: "Club Admin",
      tenantName: "FC Allschwil",
    });

    expect(identity.firstName.toLowerCase()).not.toBe("fc allschwil");
  });

  it("also rejects a linked Person whose first name happens to match the tenant name, falling through to session/generic candidates", () => {
    const identity = resolveAccountIdentityName({
      linkedPerson: { firstName: "FC Allschwil", lastName: "Club Admin" },
      sessionFirstName: "Peter",
      sessionLastName: "Muster",
      tenantName: "FC Allschwil",
    });

    expect(identity).toEqual({ firstName: "Peter", lastName: "Muster" });
  });

  it("falls back to a generic label when there is no linked Person and no usable session name at all", () => {
    const identity = resolveAccountIdentityName({
      linkedPerson: null,
      sessionFirstName: "",
      sessionLastName: "",
      tenantName: "FC Allschwil",
    });

    expect(identity.firstName.length).toBeGreaterThan(0);
    expect(identity.firstName).not.toBe("FC Allschwil");
  });
});
