/**
 * @vitest-environment jsdom
 *
 * components/admin/teams/__tests__/TeamsOverviewGrid.test.tsx
 *
 * TEAM-SFV-MAPPING-01 — MINIMAL TEAMS UX regression tests.
 *
 * Verifies that each team row shows enough to be visually distinguishable
 * even when several teams share a generic display name ("FC Allschwil"):
 * category, competition/league, season, and provider mapping/sync status.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TeamsOverviewGrid from "@/components/admin/teams/TeamsOverviewGrid";

type TeamItem = Parameters<typeof TeamsOverviewGrid>[0]["teams"][number];

function makeTeam(overrides: Partial<TeamItem> = {}): TeamItem {
  return {
    id: "team-1",
    name: "FC Allschwil C1",
    slug: "sfv-31927",
    category: "JUNIOREN",
    genderGroup: null,
    ageGroup: "C",
    sortOrder: 0,
    isActive: true,
    websiteVisible: true,
    infoboardVisible: true,
    activeSeason: {
      seasonKey: "2027",
      seasonName: "2027/28",
      displayName: "FC Allschwil C1",
      shortName: "C1",
      status: "ACTIVE",
    },
    competition: { name: "Junioren C Promotion", shortName: "Jun. C Promo" },
    providerMapping: {
      provider: "SFV",
      isActive: true,
      lastSyncedAt: "2027-07-01T00:00:00.000Z",
      source: "SYNC",
    },
    ...overrides,
  };
}

describe("TeamsOverviewGrid — recognition (MINIMAL TEAMS UX)", () => {
  it("shows the competition/league beneath the team name", () => {
    render(<TeamsOverviewGrid teams={[makeTeam()]} />);

    expect(screen.getByText("Junioren C Promotion")).toBeTruthy();
  });

  it("distinguishes two same-named teams via their competition line", () => {
    const teamC1 = makeTeam({
      id: "team-c1",
      name: "FC Allschwil",
      activeSeason: {
        seasonKey: "2027",
        seasonName: "2027/28",
        displayName: "FC Allschwil",
        shortName: null,
        status: "ACTIVE",
      },
      competition: { name: "Junioren C Promotion", shortName: null },
    });
    const teamB1 = makeTeam({
      id: "team-b1",
      name: "FC Allschwil",
      category: "JUNIOREN",
      activeSeason: {
        seasonKey: "2027",
        seasonName: "2027/28",
        displayName: "FC Allschwil",
        shortName: null,
        status: "ACTIVE",
      },
      competition: { name: "Junioren B Promotion B1", shortName: null },
    });

    render(<TeamsOverviewGrid teams={[teamC1, teamB1]} />);

    expect(screen.getAllByText("FC Allschwil")).toHaveLength(2);
    expect(screen.getByText("Junioren C Promotion")).toBeTruthy();
    expect(screen.getByText("Junioren B Promotion B1")).toBeTruthy();
  });

  it("shows an active provider badge for a synced SFV team", () => {
    render(<TeamsOverviewGrid teams={[makeTeam()]} />);

    expect(screen.getByText("SFV")).toBeTruthy();
  });

  it("shows a stale/inactive provider badge when providerIsActive is false", () => {
    render(
      <TeamsOverviewGrid
        teams={[
          makeTeam({
            providerMapping: {
              provider: "SFV",
              isActive: false,
              lastSyncedAt: "2026-06-01T00:00:00.000Z",
              source: "SYNC",
            },
          }),
        ]}
      />,
    );

    expect(screen.getByText("SFV inaktiv")).toBeTruthy();
  });

  it("shows a manual badge for teams with no provider mapping", () => {
    render(<TeamsOverviewGrid teams={[makeTeam({ providerMapping: null })]} />);

    expect(screen.getByText("Manuell")).toBeTruthy();
  });

  it("shows a restrained 'Kein Wettbewerb' fallback when the team has no competition (no warning styling)", () => {
    render(<TeamsOverviewGrid teams={[makeTeam({ competition: null })]} />);

    expect(screen.queryByText("Junioren C Promotion")).toBeNull();
    expect(screen.getByText("Kein Wettbewerb")).toBeTruthy();
  });
});

// ── TEAM-IDENTITY-01 — canonical naming contract ──────────────────────────────

describe("TeamsOverviewGrid — TEAM-IDENTITY-01 canonical naming", () => {
  it("uses the resolved displayName (long name) as the primary title", () => {
    render(
      <TeamsOverviewGrid
        teams={[
          makeTeam({
            name: "Junioren B2",
            displayName: "FC Allschwil Junioren B2",
            compactName: "B2",
          }),
        ]}
      />,
    );

    expect(screen.getByText("FC Allschwil Junioren B2")).toBeTruthy();
  });

  it("shows the compact/short name as a secondary badge when it differs from the long name", () => {
    render(
      <TeamsOverviewGrid
        teams={[
          makeTeam({
            name: "FC Allschwil Junioren B2",
            displayName: "FC Allschwil Junioren B2",
            compactName: "B2",
          }),
        ]}
      />,
    );

    expect(screen.getByTitle("Kurzname")).toHaveTextContent("B2");
  });

  it("does not duplicate the short name badge when it equals the long name", () => {
    render(
      <TeamsOverviewGrid
        teams={[
          makeTeam({
            name: "Aktive",
            displayName: "Aktive",
            compactName: "Aktive",
          }),
        ]}
      />,
    );

    expect(screen.queryByTitle("Kurzname")).toBeNull();
  });

  it("falls back to Team.name when no resolved displayName is supplied (back-compat)", () => {
    render(
      <TeamsOverviewGrid
        teams={[
          makeTeam({
            name: "FC Allschwil C1",
            displayName: undefined,
            compactName: undefined,
            activeSeason: null,
          }),
        ]}
      />,
    );

    expect(screen.getByText("FC Allschwil C1")).toBeTruthy();
  });

  it("does not prominently render an externalTeamId anywhere in the row", () => {
    render(<TeamsOverviewGrid teams={[makeTeam()]} />);

    expect(screen.queryByText(/externalTeamId/i)).toBeNull();
    expect(screen.queryByText(/31927/)).toBeNull();
  });
});
