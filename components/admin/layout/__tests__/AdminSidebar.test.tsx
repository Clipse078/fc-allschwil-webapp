/**
 * @vitest-environment jsdom
 *
 * DASHBOARD-SHELL-UX-01 — tenant-first sidebar shell:
 *   - tenant identity (name) is rendered prominently in the header
 *   - SportClubEvo platform branding is present only as a subtle footer badge
 *   - MatchCenter renders nested under Planung (not as a standalone item)
 *   - permission-driven visibility is preserved
 */

import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import { PERMISSIONS } from "@/lib/permissions/permissions";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

// SignOutButton transitively imports "@/auth" (next-auth) — irrelevant to
// this shell/nav-focused suite and incompatible with the vitest/jsdom
// module resolver, so it is mocked out at the server-action boundary.
vi.mock("@/app/actions/auth-actions", () => ({
  signOutAction: vi.fn(),
}));

const CLUB_ADMIN_PERMISSIONS = Object.values(PERMISSIONS);

describe("AdminSidebar", () => {
  it("renders the tenant name prominently in the brand header", () => {
    render(
      <AdminSidebar
        firstName="Michael"
        lastName="Duft"
        email="michael@fc-allschwil.ch"
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );
    expect(screen.getByText("FC Allschwil")).toBeInTheDocument();
  });

  it("shows SportClubEvo only as a subtle 'Powered by' footer attribution, not as the primary brand", () => {
    render(
      <AdminSidebar
        firstName="Michael"
        lastName="Duft"
        email="michael@fc-allschwil.ch"
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );
    // Exactly one subtle platform attribution, not a competing header brand.
    expect(screen.getByTitle("Powered by SportClubEvo")).toBeInTheDocument();
    expect(screen.getByText("Powered by")).toBeInTheDocument();
  });

  it("renders MatchCenter nested under Planung, not as a standalone top-level item", () => {
    render(
      <AdminSidebar
        firstName="Michael"
        lastName="Duft"
        email="michael@fc-allschwil.ch"
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    const matchCenterLink = screen.getByRole("link", { name: /MatchCenter/i });
    expect(matchCenterLink).toHaveAttribute("href", "/dashboard/matchcenter");

    // It must render as an indented child (sce-nav-child), not a top-level item.
    expect(matchCenterLink.className).toContain("sce-nav-child");

    // Planung's operational trio appears together, in the canonical order.
    const labels = screen
      .getAllByRole("link")
      .map((el) => el.textContent?.trim())
      .filter((t): t is string => !!t);
    const trainingIdx = labels.indexOf("TrainingCenter");
    const matchIdx = labels.indexOf("MatchCenter");
    const tournamentIdx = labels.indexOf("TournamentCenter");
    expect(trainingIdx).toBeGreaterThan(-1);
    expect(trainingIdx).toBeLessThan(matchIdx);
    expect(matchIdx).toBeLessThan(tournamentIdx);
  });

  it("renders Kommunikation and Sponsoring once in the Club Admin runtime sidebar groups", () => {
    render(
      <AdminSidebar
        firstName="Michael"
        lastName="Duft"
        email="michael@fc-allschwil.ch"
        permissionKeys={[
          PERMISSIONS.USERS_MANAGE_MEMBERSHIPS,
          PERMISSIONS.ROLES_VIEW,
        ]}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    const betrieb = screen.getByText("Betrieb").parentElement;
    const fuehrung = screen.getByText("Führung").parentElement;
    expect(betrieb).not.toBeNull();
    expect(fuehrung).not.toBeNull();

    const communication = within(betrieb!).getByRole("link", {
      name: "Kommunikation",
    });
    expect(communication).toHaveAttribute("href", "/dashboard/communication");

    const sponsoring = within(fuehrung!).getByRole("link", {
      name: "Sponsoring",
    });
    expect(sponsoring).toHaveAttribute("href", "/dashboard/sponsoring");

    expect(screen.getAllByRole("link", { name: "Kommunikation" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Sponsoring" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Meetings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Club Entwicklung" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Material & Inventar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Finanzen" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Administration" })).toBeInTheDocument();
  });

  it("hides permission-gated sections the user lacks access to (Club Admin still sees Administration)", () => {
    render(
      <AdminSidebar
        firstName="Michael"
        lastName="Duft"
        email="michael@fc-allschwil.ch"
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
