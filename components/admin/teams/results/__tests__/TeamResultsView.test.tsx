/**
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TeamResultsView from "../TeamResultsView";
import TeamLatestResultSummary from "@/components/admin/teams/overview/TeamLatestResultSummary";
import type { TeamCockpitResult } from "@/lib/teams/team-cockpit-sporting-data";
import { TEAM_COCKPIT_RESULTS_DETAIL_LIMIT } from "@/lib/teams/team-cockpit-sporting-data";
import {
  formatResultScore,
  resolveResultPerspectiveLabel,
} from "../team-results-formatters";

const TEAM_ID = "team-1";
const FORMAT_CONFIG = { locale: "de-CH", timezone: "Europe/Zurich" };

function createSide(displayName: string, isOwnTeam: boolean) {
  return {
    displayName,
    isOwnTeam,
    clubName: isOwnTeam ? "FC Allschwil" : displayName,
    logoUrl: isOwnTeam ? "/tenant-crest.svg" : "/opponent-crest.svg",
  };
}

function createResult(overrides: Partial<TeamCockpitResult> = {}): TeamCockpitResult {
  return {
    eventId: "event-1",
    startAt: new Date("2026-08-20T16:00:00.000Z"),
    side: "HOME",
    status: "COMPLETED",
    lifecycle: "COMPLETED",
    opponentName: "FC Example",
    home: createSide("1. Mannschaft", true),
    away: createSide("FC Example", false),
    venueName: "Im Brüel",
    location: "Im Brüel",
    competitionName: "Junioren A Promotion",
    scoreHome: 2,
    scoreAway: 1,
    teamScore: 2,
    opponentScore: 1,
    resultPerspective: "WON",
    ...overrides,
  };
}

describe("TEAM-COCKPIT-PREMIUM-01G — TeamResultsView", () => {
  it("A. renders multiple results in latest-first order", () => {
    const results = [
      createResult({
        eventId: "event-newer",
        startAt: new Date("2026-08-20T16:00:00.000Z"),
      }),
      createResult({
        eventId: "event-older",
        startAt: new Date("2026-07-10T16:00:00.000Z"),
        opponentName: "FC Older",
        away: createSide("FC Older", false),
        scoreHome: 0,
        scoreAway: 3,
        teamScore: 0,
        opponentScore: 3,
        resultPerspective: "LOST",
      }),
    ];

    render(
      <TeamResultsView
        results={results}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    const rows = screen.getAllByTestId(/^team-result-event-/);
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
      "team-result-event-newer",
      "team-result-event-older",
    ]);
  });

  it("B. renders home fixture orientation with Heim label", () => {
    render(
      <TeamResultsView
        results={[createResult({ side: "HOME" })]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    const row = screen.getByTestId("team-result-event-1");
    expect(within(row).getByTestId("team-result-home")).toHaveTextContent("1. Mannschaft");
    expect(within(row).getByTestId("team-result-away")).toHaveTextContent("FC Example");
    expect(within(row).getByTestId("team-result-homeaway-event-1")).toHaveTextContent("Heim");
  });

  it("C. renders away fixture orientation with Auswärts label", () => {
    const awayResult = createResult({
      eventId: "event-away",
      side: "AWAY",
      home: createSide("FC Example", false),
      away: createSide("1. Mannschaft", true),
    });

    render(
      <TeamResultsView
        results={[awayResult]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    const row = screen.getByTestId("team-result-event-away");
    expect(within(row).getByTestId("team-result-home")).toHaveTextContent("FC Example");
    expect(within(row).getByTestId("team-result-away")).toHaveTextContent("1. Mannschaft");
    expect(within(row).getByTestId("team-result-homeaway-event-away")).toHaveTextContent(
      "Auswärts",
    );
  });

  it("D. keeps canonical homeScore : awayScore orientation", () => {
    const homeWin = createResult({
      eventId: "home-win",
      scoreHome: 3,
      scoreAway: 1,
      teamScore: 3,
      opponentScore: 1,
      resultPerspective: "WON",
    });

    render(
      <TeamResultsView
        results={[homeWin]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-result-score-home-win")).toHaveTextContent("3 : 1");
  });

  it("E. away-team win shows Sieg without reversing score", () => {
    const awayWin = createResult({
      eventId: "away-win",
      side: "AWAY",
      home: createSide("FC Example", false),
      away: createSide("1. Mannschaft", true),
      scoreHome: 1,
      scoreAway: 3,
      teamScore: 3,
      opponentScore: 1,
      resultPerspective: "WON",
    });

    render(
      <TeamResultsView
        results={[awayWin]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-result-score-away-win")).toHaveTextContent("1 : 3");
    expect(screen.getByTestId("team-result-perspective-away-win")).toHaveTextContent("Sieg");
  });

  it("renders both crests in home/away order without changing away perspective", () => {
    const awayWin = createResult({
      eventId: "crest-order",
      side: "AWAY",
      home: {
        ...createSide("Zürich City SC 1", false),
        logoUrl: "/zurich-crest.svg",
      },
      away: createSide("1. Mannschaft", true),
      scoreHome: 4,
      scoreAway: 1,
      teamScore: 1,
      opponentScore: 4,
      resultPerspective: "LOST",
    });

    render(
      <TeamResultsView
        results={[awayWin]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    const row = screen.getByTestId("team-result-crest-order");
    expect(
      Array.from(row.querySelectorAll("img"), (logo) => logo.getAttribute("src")),
    ).toEqual(["/zurich-crest.svg", "/tenant-crest.svg"]);
    expect(within(row).getByTestId("team-result-score-crest-order")).toHaveTextContent(
      "4 : 1",
    );
    expect(within(row).getByTestId("team-result-perspective-crest-order")).toHaveTextContent(
      "Niederlage",
    );
  });

  it("uses a fallback without changing result semantics when a crest is missing", () => {
    render(
      <TeamResultsView
        results={[
          createResult({
            away: { ...createSide("No Crest FC", false), logoUrl: null },
          }),
        ]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    const row = screen.getByTestId("team-result-event-1");
    expect(row.querySelector("svg")).toBeInTheDocument();
    expect(within(row).getByTestId("team-result-score-event-1")).toHaveTextContent(
      "2 : 1",
    );
    expect(row).toHaveAttribute("data-perspective", "WON");
  });

  it("F. maps WON to Sieg", () => {
    render(
      <TeamResultsView
        results={[createResult({ resultPerspective: "WON" })]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-result-perspective-event-1")).toHaveTextContent("Sieg");
  });

  it("G. maps DRAW to Unentschieden", () => {
    render(
      <TeamResultsView
        results={[
          createResult({
            eventId: "draw",
            scoreHome: 1,
            scoreAway: 1,
            teamScore: 1,
            opponentScore: 1,
            resultPerspective: "DRAW",
          }),
        ]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-result-perspective-draw")).toHaveTextContent("Unentschieden");
  });

  it("H. maps LOST to Niederlage", () => {
    render(
      <TeamResultsView
        results={[
          createResult({
            eventId: "lost",
            scoreHome: 0,
            scoreAway: 2,
            teamScore: 0,
            opponentScore: 2,
            resultPerspective: "LOST",
          }),
        ]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-result-perspective-lost")).toHaveTextContent("Niederlage");
  });

  it("I. handles UNKNOWN without fabricated outcome label", () => {
    render(
      <TeamResultsView
        results={[
          createResult({
            eventId: "unknown",
            scoreHome: null,
            scoreAway: null,
            teamScore: null,
            opponentScore: null,
            resultPerspective: "UNKNOWN",
          }),
        ]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.queryByTestId("team-result-perspective-unknown")).not.toBeInTheDocument();
    expect(resolveResultPerspectiveLabel("UNKNOWN")).toBe("");
  });

  it("J. renders date and time in locale format", () => {
    render(
      <TeamResultsView
        results={[createResult()]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    const dateBlock = screen.getByTestId("team-result-date-event-1");
    expect(dateBlock.textContent).toMatch(/2026|20\.|August/i);
    expect(dateBlock.textContent).toMatch(/18:00|16:00/);
  });

  it("K. renders venue when present", () => {
    render(
      <TeamResultsView
        results={[createResult()]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-result-venue-event-1")).toHaveTextContent("Im Brüel");
  });

  it("L. renders competition when present", () => {
    render(
      <TeamResultsView
        results={[createResult()]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-result-competition-event-1")).toHaveTextContent(
      "Junioren A Promotion",
    );
  });

  it("O. renders empty state when no completed results", () => {
    render(
      <TeamResultsView
        results={[]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-results-empty")).toHaveTextContent(
      "Keine Resultate vorhanden.",
    );
    expect(screen.getByTestId("team-results-empty")).toHaveTextContent("2026/2027");
  });

  it("P. renders safe score fallback for missing scores", () => {
    render(
      <TeamResultsView
        results={[
          createResult({
            eventId: "missing-score",
            scoreHome: null,
            scoreAway: null,
            teamScore: null,
            opponentScore: null,
            resultPerspective: "UNKNOWN",
          }),
        ]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-result-score-missing-score")).toHaveTextContent("–");
    expect(screen.getByTestId("team-result-score-missing-score")).not.toHaveTextContent("null");
    expect(screen.getByTestId("team-result-score-missing-score")).not.toHaveTextContent("NaN");
    expect(screen.getByTestId("team-result-score-missing-score")).not.toHaveTextContent("0 : 0");
  });

  it("Q. first detailed result matches overview latest-result semantics", () => {
    const latestResult = createResult({
      eventId: "latest",
      side: "AWAY",
      home: createSide("FC Example", false),
      away: createSide("1. Mannschaft", true),
      scoreHome: 1,
      scoreAway: 2,
      teamScore: 2,
      opponentScore: 1,
      resultPerspective: "WON",
      startAt: new Date("2026-08-20T16:00:00.000Z"),
    });

    const { unmount: unmountOverview } = render(
      <TeamLatestResultSummary
        teamId={TEAM_ID}
        result={latestResult}
        formatConfig={FORMAT_CONFIG}
      />,
    );

    const overviewScore = screen.getByTestId("team-latest-result-score").textContent;
    const overviewPerspective = screen.getByTestId("team-latest-result-perspective").textContent;
    unmountOverview();

    render(
      <TeamResultsView
        results={[latestResult, createResult({ eventId: "older" })]}
        seasonName="2026/2027"
        formatConfig={FORMAT_CONFIG}
      />,
    );

    const detailRow = screen.getByTestId("team-result-latest");
    expect(within(detailRow).getByTestId("team-result-score-latest")).toHaveTextContent(
      overviewScore ?? "",
    );
    expect(within(detailRow).getByTestId("team-result-perspective-latest")).toHaveTextContent(
      overviewPerspective ?? "",
    );
    expect(within(detailRow).getByTestId("team-result-homeaway-latest")).toHaveTextContent(
      "Auswärts",
    );
    expect(formatResultScore(latestResult)).toBe(overviewScore);
  });
});

describe("TEAM-COCKPIT-PREMIUM-01G — formatters", () => {
  it("P. formatResultScore returns en-dash for missing scores", () => {
    expect(
      formatResultScore(
        createResult({
          scoreHome: null,
          scoreAway: 1,
        }),
      ),
    ).toBe("–");

    expect(
      formatResultScore(
        createResult({
          scoreHome: 0,
          scoreAway: 0,
        }),
      ),
    ).toBe("0 : 0");
  });
});

describe("TEAM-COCKPIT-PREMIUM-01G — detail limit constant", () => {
  it("uses a bounded detail limit of 10 results", () => {
    expect(TEAM_COCKPIT_RESULTS_DETAIL_LIMIT).toBe(10);
  });
});
