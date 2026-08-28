/**
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TeamStandingsView from "../TeamStandingsView";
import TeamStandingsSummary from "@/components/admin/teams/overview/TeamStandingsSummary";
import type { TeamCockpitStandings } from "@/lib/teams/team-cockpit-sporting-data";

const TEAM_ID = "team-1";

function createStandings(overrides: Partial<TeamCockpitStandings> = {}): TeamCockpitStandings {
  return {
    competition: {
      name: "Junioren A Promotion",
      divisionName: "Gruppe 1",
      groupName: null,
      source: "STANDINGS",
    },
    rows: [
      {
        position: 1,
        teamName: "FC Leader",
        shortName: null,
        isCurrentTeam: false,
        played: 10,
        won: 8,
        drawn: 1,
        lost: 1,
        goalsFor: 24,
        goalsAgainst: 8,
        goalDifference: 16,
        points: 25,
        penaltyPoints: null,
      },
      {
        position: 2,
        teamName: "FC Allschwil Junioren A",
        shortName: "Junioren A",
        isCurrentTeam: true,
        played: 10,
        won: 6,
        drawn: 2,
        lost: 2,
        goalsFor: 18,
        goalsAgainst: 12,
        goalDifference: 6,
        points: 20,
        penaltyPoints: 1,
      },
      {
        position: 3,
        teamName: "FC Third",
        shortName: null,
        isCurrentTeam: false,
        played: 10,
        won: 4,
        drawn: 3,
        lost: 3,
        goalsFor: 12,
        goalsAgainst: 12,
        goalDifference: 0,
        points: 15,
        penaltyPoints: 0,
      },
      {
        position: 4,
        teamName: "FC Bottom",
        shortName: null,
        isCurrentTeam: false,
        played: 10,
        won: 1,
        drawn: 1,
        lost: 8,
        goalsFor: 6,
        goalsAgainst: 20,
        goalDifference: -14,
        points: 4,
        penaltyPoints: null,
      },
    ],
    ...overrides,
  };
}

describe("TEAM-COCKPIT-PREMIUM-01H — TeamStandingsView", () => {
  it("A. renders full standings table in provider order", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);

    const rows = screen.getAllByTestId(/^team-standings-row-/);
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
      "team-standings-row-1",
      "team-standings-row-2",
      "team-standings-row-3",
      "team-standings-row-4",
    ]);
  });

  it("B. renders position", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-row-2")).toHaveTextContent("2");
  });

  it("C. renders played", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-row-2")).toHaveTextContent("10");
  });

  it("D. renders won", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-row-2")).toHaveTextContent("6");
  });

  it("E. renders drawn", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-row-2")).toHaveTextContent("2");
  });

  it("F. renders lost", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-row-2")).toHaveTextContent("2");
  });

  it("G. renders goalsFor/goalsAgainst", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-row-2")).toHaveTextContent("18:12");
  });

  it("H. renders positive goal difference", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-row-2")).toHaveTextContent("+6");
  });

  it("I. renders zero goal difference", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-row-3")).toHaveTextContent("0");
  });

  it("J. renders negative goal difference", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-row-4")).toHaveTextContent("-14");
  });

  it("K. renders points", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-points-2")).toHaveTextContent("20");
  });

  it("L. highlights current team via isCurrentTeam", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-row-2")).toHaveAttribute("data-current-team", "true");
    expect(screen.getByTestId("team-standings-current-label-2")).toHaveTextContent("Unser Team");
  });

  it("M. keeps current team in provider order", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    const rows = screen.getAllByTestId(/^team-standings-row-/);
    expect(rows[1]).toHaveAttribute("data-current-team", "true");
  });

  it("N. renders competition header", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-competition-context")).toHaveTextContent(
      "Junioren A Promotion · Gruppe 1",
    );
  });

  it("O. renders division/group when available", () => {
    render(
      <TeamStandingsView
        standings={createStandings({
          competition: {
            name: "2. Liga interregional",
            divisionName: "Gruppe 3",
            groupName: null,
            source: "STANDINGS",
          },
        })}
        hasProviderMapping
      />,
    );

    expect(screen.getByTestId("team-standings-competition-context")).toHaveTextContent(
      "2. Liga interregional · Gruppe 3",
    );
  });

  it("P. avoids duplicate competition context", () => {
    render(
      <TeamStandingsView
        standings={createStandings({
          competition: {
            name: "Junioren A Promotion",
            divisionName: "Junioren A Promotion",
            groupName: "Gruppe 1",
            source: "STANDINGS",
          },
        })}
        hasProviderMapping
      />,
    );

    expect(screen.getByTestId("team-standings-competition-context")).toHaveTextContent(
      "Junioren A Promotion · Gruppe 1",
    );
    expect(screen.getByTestId("team-standings-competition-context").textContent).not.toContain(
      "Junioren A Promotion · Junioren A Promotion",
    );
  });

  it("Q. renders non-zero penalty points restrainedly", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-penalty-2")).toHaveTextContent("−1 Strafpkt.");
  });

  it("R. does not render penalty clutter for zero/null", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    expect(screen.queryByTestId("team-standings-penalty-1")).toBeNull();
    expect(screen.queryByTestId("team-standings-penalty-3")).toBeNull();
  });

  it("S. shows unavailable state when provider mapped but standings missing", () => {
    render(<TeamStandingsView standings={null} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-unavailable")).toHaveTextContent(
      "Rangliste derzeit nicht verfügbar.",
    );
  });

  it("T. shows no-standings state for unmapped team", () => {
    render(<TeamStandingsView standings={null} hasProviderMapping={false} />);
    expect(screen.getByTestId("team-standings-no-mapping")).toHaveTextContent(
      "Für dieses Team ist keine Rangliste verfügbar.",
    );
  });

  it("U. matches overview position/points from same standings source", () => {
    const standings = createStandings();

    render(
      <>
        <TeamStandingsSummary teamId={TEAM_ID} standings={standings} />
        <TeamStandingsView standings={standings} hasProviderMapping />
      </>,
    );

    const summary = screen.getByTestId("team-standings-summary");
    expect(summary).toHaveTextContent("2.");
    expect(summary).toHaveTextContent("20 Punkte");
    expect(screen.getByTestId("team-standings-points-2")).toHaveTextContent("20");
  });

  it("V. tenant isolation is enforced at data layer (view renders supplied tenant data only)", () => {
    const standings = createStandings({
      rows: [
        {
          position: 1,
          teamName: "Tenant A Team",
          shortName: null,
          isCurrentTeam: true,
          played: 1,
          won: 1,
          drawn: 0,
          lost: 0,
          goalsFor: 2,
          goalsAgainst: 0,
          goalDifference: 2,
          points: 3,
          penaltyPoints: null,
        },
      ],
    });

    render(<TeamStandingsView standings={standings} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-team-1")).toHaveTextContent("Tenant A Team");
  });

  it("W. season isolation is enforced at data layer (view renders supplied season standings only)", () => {
    const standings = createStandings({
      competition: {
        name: "2026/2027 Liga",
        source: "STANDINGS",
      },
      rows: [
        {
          position: 5,
          teamName: "Season Scoped Team",
          shortName: null,
          isCurrentTeam: true,
          played: 8,
          won: 3,
          drawn: 2,
          lost: 3,
          goalsFor: 10,
          goalsAgainst: 10,
          goalDifference: 0,
          points: 11,
          penaltyPoints: null,
        },
      ],
    });

    render(<TeamStandingsView standings={standings} hasProviderMapping />);
    expect(screen.getByTestId("team-standings-competition-context")).toHaveTextContent(
      "2026/2027 Liga",
    );
    expect(screen.getByTestId("team-standings-points-5")).toHaveTextContent("11");
  });

  it("responsive: table wrapper has no forced wide min-width", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    const table = screen.getByTestId("team-standings-table");
    expect(table.className).not.toContain("min-w-[");
    expect(table.className).toContain("min-w-full");
  });

  it("responsive: mobile meta preserves position/team/points context", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    const mobileMeta = screen.getByTestId("team-standings-mobile-meta-2");
    expect(mobileMeta).toHaveTextContent("6-2-2");
    expect(mobileMeta).toHaveTextContent("18:12");
    expect(mobileMeta).toHaveTextContent("+6");
    expect(screen.getByTestId("team-standings-points-2")).toHaveTextContent("20");
  });

  it("accessibility: current team is not color-only", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    const currentRow = screen.getByTestId("team-standings-row-2");
    expect(currentRow).toHaveAttribute("aria-current", "true");
    expect(within(currentRow).getByText("Unser Team")).toBeTruthy();
  });

  it("accessibility: column headers expose abbreviations via title", () => {
    render(<TeamStandingsView standings={createStandings()} hasProviderMapping />);
    const table = screen.getByTestId("team-standings-table");
    expect(within(table).getByTitle("Position")).toBeTruthy();
    expect(within(table).getByTitle("Spiele")).toBeTruthy();
    expect(within(table).getByTitle("Punkte")).toBeTruthy();
  });
});
