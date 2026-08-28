/**
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TeamUpcomingMatchesView from "../TeamUpcomingMatchesView";
import type { TeamCockpitMatch } from "@/lib/teams/team-cockpit-sporting-data";
import { TEAM_COCKPIT_NEXT_MATCHES_DETAIL_LIMIT } from "@/lib/teams/team-cockpit-sporting-data";

const FORMAT_CONFIG = { locale: "de-CH", timezone: "Europe/Zurich" };

function createMatch(overrides: Partial<TeamCockpitMatch> = {}): TeamCockpitMatch {
  return {
    eventId: "event-1",
    startAt: new Date("2026-09-01T16:00:00.000Z"),
    side: "HOME",
    status: "SCHEDULED",
    lifecycle: "UPCOMING",
    opponentName: "FC Example",
    home: { displayName: "FC Allschwil", isOwnTeam: true },
    away: { displayName: "FC Example", isOwnTeam: false },
    venueName: "Im Brüel",
    location: "Im Brüel",
    competitionName: "Junioren A Promotion",
    ...overrides,
  };
}

describe("TEAM-COCKPIT-PREMIUM-01F — TeamUpcomingMatchesView", () => {
  it("A. renders multiple upcoming fixtures in ascending order", () => {
    const matches = [
      createMatch({
        eventId: "event-earlier",
        startAt: new Date("2026-09-01T16:00:00.000Z"),
      }),
      createMatch({
        eventId: "event-later",
        startAt: new Date("2026-09-10T16:00:00.000Z"),
        opponentName: "FC Later",
        away: { displayName: "FC Later", isOwnTeam: false },
      }),
    ];

    render(
      <TeamUpcomingMatchesView
        matches={matches}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    const rows = screen.getAllByTestId(/^team-upcoming-match-event-/);
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
      "team-upcoming-match-event-earlier",
      "team-upcoming-match-event-later",
    ]);
  });

  it("B. renders home fixture orientation with Heimspiel label", () => {
    render(
      <TeamUpcomingMatchesView
        matches={[createMatch({ side: "HOME" })]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    const row = screen.getByTestId("team-upcoming-match-event-1");
    expect(within(row).getByTestId("team-upcoming-home")).toHaveTextContent("FC Allschwil");
    expect(within(row).getByTestId("team-upcoming-away")).toHaveTextContent("FC Example");
    expect(within(row).getByTestId("team-upcoming-homeaway-event-1")).toHaveTextContent(
      "Heimspiel",
    );
  });

  it("C. renders away fixture orientation with Auswärtsspiel label", () => {
    const awayMatch = createMatch({
      eventId: "event-away",
      side: "AWAY",
      home: { displayName: "FC Example", isOwnTeam: false },
      away: { displayName: "FC Allschwil", isOwnTeam: true },
    });

    render(
      <TeamUpcomingMatchesView
        matches={[awayMatch]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    const row = screen.getByTestId("team-upcoming-match-event-away");
    expect(within(row).getByTestId("team-upcoming-home")).toHaveTextContent("FC Example");
    expect(within(row).getByTestId("team-upcoming-away")).toHaveTextContent("FC Allschwil");
    expect(within(row).getByTestId("team-upcoming-homeaway-event-away")).toHaveTextContent(
      "Auswärtsspiel",
    );
  });

  it("D. renders date and time in locale format", () => {
    render(
      <TeamUpcomingMatchesView
        matches={[createMatch()]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    const dateBlock = screen.getByTestId("team-upcoming-match-date-event-1");
    expect(dateBlock.textContent).toMatch(/2026|1\.|September/i);
    expect(dateBlock.textContent).toMatch(/18:00|16:00/);
  });

  it("E. renders venue when present", () => {
    render(
      <TeamUpcomingMatchesView
        matches={[createMatch()]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-upcoming-venue-event-1")).toHaveTextContent("Im Brüel");
  });

  it("F. renders competition when present", () => {
    render(
      <TeamUpcomingMatchesView
        matches={[createMatch()]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-upcoming-competition-event-1")).toHaveTextContent(
      "Junioren A Promotion",
    );
  });

  it("H. renders empty state when no upcoming fixtures", () => {
    render(
      <TeamUpcomingMatchesView
        matches={[]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-upcoming-matches-empty")).toHaveTextContent(
      "Keine nächsten Spiele geplant.",
    );
  });

  it("K. renders postponed status label distinctly", () => {
    render(
      <TeamUpcomingMatchesView
        matches={[
          createMatch({
            eventId: "event-postponed",
            status: "POSTPONED",
            lifecycle: "POSTPONED",
          }),
        ]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-upcoming-status-event-postponed")).toHaveTextContent(
      "Verschoben",
    );
  });
});

describe("TEAM-COCKPIT-PREMIUM-01F — detail limit constant", () => {
  it("uses a bounded detail limit of 10 fixtures", () => {
    expect(TEAM_COCKPIT_NEXT_MATCHES_DETAIL_LIMIT).toBe(10);
  });
});
