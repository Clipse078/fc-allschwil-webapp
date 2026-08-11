/**
 * @vitest-environment jsdom
 *
 * DASHBOARD-SHELL-UX-01-C2 — sidebar footer identity.
 *
 * The sidebar footer (directly above "Abmelden") must render the
 * authenticated PERSON's full name (resolved via resolveAccountIdentityName
 * + the canonical Person.userId link), never the role name or tenant name.
 * Email remains the secondary line. Permission-driven navigation visibility
 * must be unaffected by this identity resolution.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import { resolveAccountIdentityName } from "@/lib/people/identity";
import { PERMISSIONS } from "@/lib/permissions/permissions";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/actions/auth-actions", () => ({
  signOutAction: vi.fn(),
}));

const CLUB_ADMIN_PERMISSIONS = Object.values(PERMISSIONS);

describe("DASHBOARD-SHELL-UX-01-C2 — sidebar footer identity", () => {
  it('renders "Michael Duijster" in the footer when the authenticated User is linked to that Person', () => {
    const identity = resolveAccountIdentityName({
      linkedPerson: { firstName: "Michael", lastName: "Duijster" },
      sessionFirstName: "FC Allschwil",
      sessionLastName: "Club Admin",
      tenantName: "FC Allschwil",
    });

    render(
      <AdminSidebar
        firstName={identity.firstName}
        lastName={identity.lastName}
        email="it@fcallschwil.ch"
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    expect(screen.getByText("Michael Duijster")).toBeInTheDocument();
  });

  it("keeps the email as the secondary line beneath the person's name", () => {
    const identity = resolveAccountIdentityName({
      linkedPerson: { firstName: "Michael", lastName: "Duijster" },
      sessionFirstName: "FC Allschwil",
      sessionLastName: "Club Admin",
      tenantName: "FC Allschwil",
    });

    render(
      <AdminSidebar
        firstName={identity.firstName}
        lastName={identity.lastName}
        email="it@fcallschwil.ch"
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    expect(screen.getByText("it@fcallschwil.ch")).toBeInTheDocument();
  });

  it('never renders the role/tenant label "FC Allschwil Club Admin" as the primary identity once resolved', () => {
    const identity = resolveAccountIdentityName({
      linkedPerson: { firstName: "Michael", lastName: "Duijster" },
      sessionFirstName: "FC Allschwil",
      sessionLastName: "Club Admin",
      tenantName: "FC Allschwil",
    });

    render(
      <AdminSidebar
        firstName={identity.firstName}
        lastName={identity.lastName}
        email="it@fcallschwil.ch"
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    expect(screen.queryByText("FC Allschwil Club Admin")).not.toBeInTheDocument();
    // The tenant brand header still legitimately shows "FC Allschwil" — but
    // never combined with the role label as a personal identity string.
    expect(screen.queryByText("Club Admin")).not.toBeInTheDocument();
  });

  it("uses a safe generic fallback label (never the tenant name) when the User has no linked Person", () => {
    const identity = resolveAccountIdentityName({
      linkedPerson: null,
      sessionFirstName: "FC Allschwil",
      sessionLastName: "Club Admin",
      tenantName: "FC Allschwil",
    });

    render(
      <AdminSidebar
        firstName={identity.firstName}
        lastName={identity.lastName}
        email="it@fcallschwil.ch"
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    expect(screen.queryByText("FC Allschwil Club Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Club Admin")).not.toBeInTheDocument();
  });

  it("does not use the tenant name as the personal identity even though the tenant brand header renders it elsewhere", () => {
    const identity = resolveAccountIdentityName({
      linkedPerson: { firstName: "Michael", lastName: "Duijster" },
      sessionFirstName: "FC Allschwil",
      sessionLastName: "Club Admin",
      tenantName: "FC Allschwil",
    });

    render(
      <AdminSidebar
        firstName={identity.firstName}
        lastName={identity.lastName}
        email="it@fcallschwil.ch"
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    // The footer identity block itself must be the person's name, not the club name.
    expect(screen.getByText("Michael Duijster")).toBeInTheDocument();
  });

  it("permission-gated navigation visibility is unaffected by the resolved footer identity", () => {
    const identity = resolveAccountIdentityName({
      linkedPerson: { firstName: "Michael", lastName: "Duijster" },
      sessionFirstName: "FC Allschwil",
      sessionLastName: "Club Admin",
      tenantName: "FC Allschwil",
    });

    render(
      <AdminSidebar
        firstName={identity.firstName}
        lastName={identity.lastName}
        email="it@fcallschwil.ch"
        permissionKeys={[PERMISSIONS.ROLES_VIEW, PERMISSIONS.SEASONS_VIEW]}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    expect(screen.getByRole("link", { name: "Administration" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "MatchCenter" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Organisation" })).not.toBeInTheDocument();
  });
});
