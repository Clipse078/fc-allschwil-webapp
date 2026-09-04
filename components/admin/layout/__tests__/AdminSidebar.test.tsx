/**
 * @vitest-environment jsdom
 *
 * DASHBOARD-SHELL-UX-01 — tenant-first sidebar shell:
 *   - tenant identity (name) is rendered prominently in the header
 *   - SportClubEvo platform branding at footer (not "Powered by")
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

vi.mock("@/hooks/useSidebarResize", () => ({
  useSidebarResize: () => ({
    width: 224,
    isResizing: false,
    onResizePointerDown: vi.fn(),
    onResizeKeyDown: vi.fn(),
  }),
}));

const CLUB_ADMIN_PERMISSIONS = Object.values(PERMISSIONS);

describe("AdminSidebar", () => {
  it("renders the tenant name prominently in the brand header", () => {
    render(
      <AdminSidebar
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );
    expect(screen.getByText("FC Allschwil")).toBeInTheDocument();
  });

  it("shows SportClubEvo platform brand at the footer, not a Powered by attribution", () => {
    render(
      <AdminSidebar
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    expect(screen.getByLabelText("SportClubEvo")).toBeInTheDocument();
    expect(screen.queryByText("Powered by")).not.toBeInTheDocument();
  });

  it("does not render user identity or logout in the sidebar footer", () => {
    render(
      <AdminSidebar
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    expect(screen.queryByText("Abmelden")).not.toBeInTheDocument();
    expect(screen.queryByText("it@fcallschwil.ch")).not.toBeInTheDocument();
  });

  it("renders MatchCenter nested under Planung, not as a standalone top-level item", () => {
    render(
      <AdminSidebar
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    const matchCenterLink = screen.getByRole("link", { name: /MatchCenter/i });
    expect(matchCenterLink).toHaveAttribute("href", "/dashboard/matchcenter");
    expect(matchCenterLink.className).toContain("sce-nav-child");

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
    expect(within(betrieb!).getByRole("link", { name: "E-Mail-Absender" })).toHaveAttribute(
      "href",
      "/dashboard/communication/email-sender",
    );

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
