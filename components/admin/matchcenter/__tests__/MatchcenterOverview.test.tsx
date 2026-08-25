/**
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MatchcenterOverview from "@/components/admin/matchcenter/MatchcenterOverview";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";

// MatchcenterWochenplanBulkPanel (rendered inside MatchcenterOverview when
// there are Spielplanung rows) uses useRouter and useToast. Mock them so the
// tests can render without a live App Router or toast provider.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: { success: vi.fn(), danger: vi.fn() },
  }),
}));

const DEFAULT_MONTH_WINDOW = {
  param: "2026-08",
  label: "August 2026",
  previousParam: "2026-07",
  nextParam: "2026-09",
};

function createMatch(
  overrides: Partial<MatchcenterMatchSummary> = {},
): MatchcenterMatchSummary {
  return {
    id: "match-1",
    tenantId: "tenant-1",
    teamId: "team-1",
    seasonId: "season-2026-2027",
    type: "MATCH",
    title: "FC Allschwil – Gegner",
    description: null,
    status: "SCHEDULED",
    startAt: new Date("2026-09-05T16:00:00.000Z"),
    endAt: null,
    location: "Im Brüel",
    competitionLabel: "Meisterschaft",
    homeAway: "HOME",
    resultLabel: null,
    intermediateResultLabel: null,
    scoreHome: null,
    scoreAway: null,
    home: {
      providerTeamId: 100,
      providerTeamName: "FC Allschwil E1",
      canonicalTeamId: "team-home",
      canonicalTeamName: "FC Allschwil E1",
      displayName: "FC Allschwil E1",
      resolution: "RESOLVED",
      isOwnTeam: true,
    },
    away: {
      providerTeamId: 200,
      providerTeamName: "FC Basel E1",
      canonicalTeamId: "team-away",
      canonicalTeamName: "FC Basel E1",
      displayName: "FC Basel E1",
      resolution: "RESOLVED",
      isOwnTeam: false,
    },
    source: {
      eventSource: "SFV",
      externalSource: "SFV",
      externalSourceId: "10001",
      provider: "SFV",
      externalMatchId: 10001,
      externalSeasonId: 2027,
      matchNumber: 12,
    },
    synchronization: {
      eventLastSyncedAt: new Date("2026-08-20T10:00:00.000Z"),
      mappingLastSyncedAt: new Date("2026-08-20T10:00:00.000Z"),
      detailSyncedAt: null,
      providerMatchState: 1,
      providerMatchStateName: "Geplant",
    },
    operational: {
      pitchCode: "KR2",
      homeDressingRoomCode: "G1",
      awayDressingRoomCode: "G2",
      meetingTime: new Date("2026-09-05T15:00:00.000Z"),
      remarks: null,
    },
    visibility: {
      websiteVisible: true,
      infoboardVisible: true,
      homepageVisible: false,
      wochenplanVisible: true,
      trainingsplanVisible: false,
      teamPageVisible: true,
    },
    reviewStage: "APPROVED",
    publishedAt: new Date("2026-08-20T10:00:00.000Z"),
    ...overrides,
  };
}

const DEFAULT_TEAM_OPTIONS = [
  { id: "team-1", label: "Junioren C1" },
  { id: "team-2", label: "Frauen 1" },
];

function renderOverview(
  matches: MatchcenterMatchSummary[],
  props: Partial<{
    tab: "SPIELPLANUNG" | "RESULTATE";
    actionFilter: "ALLE" | "OFFEN" | "ERLEDIGT";
    wochenplanFilter: "ALLE" | "IM_WOCHENPLAN" | "NICHT_IM_WOCHENPLAN";
    teamFilter: string | null;
    teamOptions: { id: string; label: string }[];
  }> = {},
) {
  return render(
    <MatchcenterOverview
      matches={matches}
      tab={props.tab ?? "SPIELPLANUNG"}
      actionFilter={props.actionFilter ?? "ALLE"}
      wochenplanFilter={props.wochenplanFilter ?? "ALLE"}
      teamFilter={props.teamFilter ?? null}
      teamOptions={props.teamOptions ?? DEFAULT_TEAM_OPTIONS}
      monthWindow={DEFAULT_MONTH_WINDOW}
    />,
  );
}

describe("MatchcenterOverview — tabs, month nav, KPIs", () => {
  it("renders the Spielplanung/Resultate tabs and the selected month label", () => {
    renderOverview([createMatch()]);

    expect(screen.getByTestId("matchcenter-tab-spielplanung")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("matchcenter-tab-resultate")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByTestId("matchcenter-month-label")).toHaveTextContent(
      "August 2026",
    );
  });

  it("month navigation links preserve the active tab and filter", () => {
    renderOverview([createMatch()], { actionFilter: "OFFEN" });

    expect(screen.getByTestId("matchcenter-month-previous")).toHaveAttribute(
      "href",
      "/dashboard/matchcenter?tab=spielplanung&month=2026-07&filter=offen",
    );
    expect(screen.getByTestId("matchcenter-month-next")).toHaveAttribute(
      "href",
      "/dashboard/matchcenter?tab=spielplanung&month=2026-09&filter=offen",
    );
  });

  it("computes KPI cards from the full month population regardless of the active filter", () => {
    const openMatch = createMatch({
      id: "match-open",
      operational: {
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
        meetingTime: null,
        remarks: null,
      },
    });
    const readyMatch = createMatch({ id: "match-ready" });
    const completedMatch = createMatch({
      id: "match-completed",
      status: "COMPLETED",
      scoreHome: 2,
      scoreAway: 1,
    });

    renderOverview([openMatch, readyMatch, completedMatch], {
      actionFilter: "OFFEN",
    });

    expect(screen.getByTestId("matchcenter-kpi-anstehend")).toHaveTextContent(
      "2",
    );
    expect(screen.getByTestId("matchcenter-kpi-offen")).toHaveTextContent("1");
    expect(screen.getByTestId("matchcenter-kpi-bereit")).toHaveTextContent(
      "1",
    );
    expect(screen.getByTestId("matchcenter-kpi-resultate")).toHaveTextContent(
      "1",
    );
  });
});

describe("MatchcenterOverview — Spielplanung", () => {
  it("renders the empty state and create link when nothing matches", () => {
    renderOverview([]);

    expect(screen.getByText("Keine Matches gefunden")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Match erstellen/i }),
    ).toHaveAttribute("href", "/dashboard/events/matches/new");
  });

  it("renders home and away team names", () => {
    renderOverview([createMatch()]);

    expect(screen.getByText("FC Allschwil E1")).toBeTruthy();
    expect(screen.getByText("FC Basel E1")).toBeTruthy();
  });

  it("renders the Spielplanung row with the correct match testid", () => {
    renderOverview([createMatch()]);

    // MATCHCENTER-UX-03: card click opens the inspector (not direct link navigation).
    // The inspector provides "Match bearbeiten" navigation; the card itself is a
    // clickable region that opens the inspector panel.
    expect(screen.getByTestId("matchcenter-spielplanung-row-match-1")).toBeTruthy();
  });

  it("A. an upcoming SCHEDULED match never renders a score", () => {
    renderOverview([
      createMatch({ status: "SCHEDULED", scoreHome: 0, scoreAway: 0 }),
    ]);

    expect(screen.queryByText("0:0")).toBeNull();
    expect(screen.queryByTestId("matchcenter-live-score-match-1")).toBeNull();
  });

  it("F. shows Bereit for a fully set-up future HOME match", () => {
    renderOverview([createMatch()]);

    expect(
      within(screen.getByTestId("matchcenter-action-match-1")).getByText(
        "Bereit",
      ),
    ).toBeTruthy();
  });

  it("E. shows the open action count and missing-item labels for a HOME match with missing setup", () => {
    renderOverview([
      createMatch({
        operational: {
          pitchCode: null,
          homeDressingRoomCode: null,
          awayDressingRoomCode: "G2",
          meetingTime: null,
          remarks: null,
        },
      }),
    ]);

    expect(screen.getByText("2 Aufgaben offen")).toBeTruthy();
    // Missing items are shown as labels
    expect(screen.getByText("Spielfeld")).toBeTruthy();
    expect(screen.getByText("Heimkabine")).toBeTruthy();
    // MATCHCENTER-UX-03: ready items (Gastkabine=G2) are NOT shown for OPEN matches
    // (only the missing items are surfaced as actionable labels)
    expect(screen.queryByText("Gastkabine")).toBeNull();
  });

  it("G. shows a calm Auswärtsspiel state instead of manufactured facility warnings", () => {
    renderOverview([
      createMatch({
        homeAway: "AWAY",
        home: {
          providerTeamId: 200,
          providerTeamName: "FC Reinach E1",
          canonicalTeamId: "team-home",
          canonicalTeamName: "FC Reinach E1",
          displayName: "FC Reinach E1",
          resolution: "RESOLVED",
          isOwnTeam: false,
        },
        away: {
          providerTeamId: 100,
          providerTeamName: "FC Allschwil E1",
          canonicalTeamId: "team-away",
          canonicalTeamName: "FC Allschwil E1",
          displayName: "FC Allschwil E1",
          resolution: "RESOLVED",
          isOwnTeam: true,
        },
        operational: {
          pitchCode: null,
          homeDressingRoomCode: null,
          awayDressingRoomCode: null,
          meetingTime: null,
          remarks: null,
        },
      }),
    ]);

    expect(screen.getAllByText("Auswärtsspiel").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.queryByText("Spielfeld")).toBeNull();
    expect(screen.queryByText("Heimkabine")).toBeNull();
    expect(screen.queryByText("Gastkabine")).toBeNull();
  });

  it("shows the team-assignment warning when the FCA side is genuinely unresolved", () => {
    renderOverview([
      createMatch({
        home: {
          providerTeamId: 100,
          providerTeamName: "FC Allschwil E1",
          canonicalTeamId: null,
          canonicalTeamName: null,
          displayName: "FC Allschwil E1",
          resolution: "UNRESOLVED",
          isOwnTeam: false,
        },
      }),
    ]);

    expect(screen.getByText("Team nicht zugeordnet")).toBeTruthy();
  });

  it("H. an unmapped external opponent never produces a team-assignment warning", () => {
    renderOverview([
      createMatch({
        home: {
          providerTeamId: 3311,
          providerTeamName: "FC Allschwil B2",
          canonicalTeamId: "team-fca-b2",
          canonicalTeamName: "FC Allschwil B2",
          displayName: "FC Allschwil B2",
          resolution: "RESOLVED",
          isOwnTeam: true,
        },
        away: {
          providerTeamId: 5544,
          providerTeamName: "VfR Kleinhüningen a",
          canonicalTeamId: null,
          canonicalTeamName: null,
          displayName: "VfR Kleinhüningen a",
          resolution: "UNRESOLVED",
          isOwnTeam: false,
        },
      }),
    ]);

    expect(screen.queryByText("Team nicht zugeordnet")).toBeNull();
    expect(
      within(screen.getByTestId("matchcenter-action-match-1")).getByText(
        "Bereit",
      ),
    ).toBeTruthy();
  });

  it("renders live status with an inline live score", () => {
    renderOverview([
      createMatch({
        status: "LIVE",
        scoreHome: 1,
        scoreAway: 0,
      }),
    ]);

    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByTestId("matchcenter-live-score-match-1")).toHaveTextContent(
      "1:0",
    );
  });

  it("K. Offen filter link is active and shows only open matches", () => {
    renderOverview(
      [
        createMatch({
          id: "match-open",
          operational: {
            pitchCode: null,
            homeDressingRoomCode: null,
            awayDressingRoomCode: null,
            meetingTime: null,
            remarks: null,
          },
        }),
        createMatch({ id: "match-ready" }),
      ],
      { actionFilter: "OFFEN" },
    );

    // MATCHCENTER-UX-03: active filter is indicated by aria-current (not CSS class).
    expect(screen.getByTestId("matchcenter-filter-offen")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      screen.getByTestId("matchcenter-spielplanung-row-match-open"),
    ).toBeTruthy();
    expect(
      screen.queryByTestId("matchcenter-spielplanung-row-match-ready"),
    ).toBeNull();
  });

  it("a COMPLETED match never appears in Spielplanung, even with Alle selected", () => {
    renderOverview(
      [createMatch({ id: "match-completed", status: "COMPLETED" })],
      { actionFilter: "ALLE" },
    );

    expect(screen.getByText("Keine Matches gefunden")).toBeTruthy();
  });
});

describe("MatchcenterOverview — Resultate", () => {
  it("B/C. renders the actual completed result, including a legitimate 0:0", () => {
    renderOverview(
      [
        createMatch({
          id: "match-draw",
          status: "COMPLETED",
          scoreHome: 0,
          scoreAway: 0,
        }),
      ],
      { tab: "RESULTATE" },
    );

    expect(screen.getByTestId("matchcenter-result-match-draw")).toHaveTextContent(
      "0:0",
    );
  });

  it("renders the mapped score when available", () => {
    renderOverview(
      [
        createMatch({
          id: "match-1",
          status: "COMPLETED",
          scoreHome: 3,
          scoreAway: 1,
        }),
      ],
      { tab: "RESULTATE" },
    );

    expect(screen.getByTestId("matchcenter-result-match-1")).toHaveTextContent(
      "3:1",
    );
  });

  it("falls back to resultLabel when mapped scores are absent", () => {
    renderOverview(
      [
        createMatch({
          id: "match-1",
          status: "COMPLETED",
          resultLabel: "2:2",
        }),
      ],
      { tab: "RESULTATE" },
    );

    expect(screen.getByTestId("matchcenter-result-match-1")).toHaveTextContent(
      "2:2",
    );
  });

  it("does not show operational warnings in Resultate", () => {
    renderOverview(
      [
        createMatch({
          id: "match-1",
          status: "COMPLETED",
          scoreHome: 2,
          scoreAway: 0,
          operational: {
            pitchCode: null,
            homeDressingRoomCode: null,
            awayDressingRoomCode: null,
            meetingTime: null,
            remarks: null,
          },
        }),
      ],
      { tab: "RESULTATE" },
    );

    expect(screen.queryByText("Spielfeld")).toBeNull();
    expect(screen.queryByText("Aufgaben offen")).toBeNull();
  });

  it("renders an empty state when no matches were completed this month", () => {
    renderOverview([createMatch({ status: "SCHEDULED" })], {
      tab: "RESULTATE",
    });

    expect(screen.getByText("Keine Resultate vorhanden")).toBeTruthy();
  });

  it("links each Resultate row to its detail page", () => {
    renderOverview(
      [createMatch({ id: "match-1", status: "COMPLETED" })],
      { tab: "RESULTATE" },
    );

    const link = screen.getByRole("link", {
      name: "Details zu FC Allschwil – Gegner anzeigen",
    });
    expect(link).toHaveAttribute("href", "/dashboard/matchcenter/match-1");
  });
});

describe("MatchcenterOverview — reconciliation admin surface", () => {
  it("shows a restrained Datenprüfung banner for NEEDS_RECONCILIATION fixtures", () => {
    renderOverview([
      createMatch({
        id: "match-reconcile",
        status: "SCHEDULED",
        startAt: new Date("2026-08-02T16:00:00.000Z"),
        synchronization: {
          eventLastSyncedAt: null,
          mappingLastSyncedAt: null,
          detailSyncedAt: null,
          providerMatchState: null,
          providerMatchStateName: "noch nicht ausgetragen",
        },
      }),
    ]);

    expect(
      screen.getByTestId("matchcenter-reconciliation-panel"),
    ).toHaveTextContent("Datenprüfung erforderlich · 1");
    expect(
      screen.getByTestId("matchcenter-reconciliation-row-match-reconcile"),
    ).toBeTruthy();
    expect(screen.getByText("Keine Matches gefunden")).toBeTruthy();
  });

  it("does not show the reconciliation banner when no fixtures need review", () => {
    renderOverview([createMatch()]);

    expect(
      screen.queryByTestId("matchcenter-reconciliation-panel"),
    ).toBeNull();
  });
});

describe("MatchcenterOverview — team filter", () => {
  it("renders Alle Teams by default and lists canonical tenant teams", () => {
    renderOverview([createMatch()]);

    expect(screen.getByTestId("matchcenter-team-filter-trigger")).toHaveTextContent(
      "Alle Teams",
    );
  });

  it("filters Spielplanung rows by selected internal team", () => {
    const teamOne = createMatch({ id: "match-team-1", teamId: "team-1" });
    const teamTwo = createMatch({ id: "match-team-2", teamId: "team-2" });

    renderOverview([teamOne, teamTwo], { teamFilter: "team-1" });

    expect(screen.getByTestId("matchcenter-team-filter-trigger")).toHaveTextContent(
      "Junioren C1",
    );
    expect(
      screen.getByTestId("matchcenter-spielplanung-row-match-team-1"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("matchcenter-spielplanung-row-match-team-2"),
    ).toBeNull();
  });

  it("filters Resultate by the same team selection", () => {
    const completedOne = createMatch({
      id: "res-team-1",
      teamId: "team-1",
      status: "COMPLETED",
      scoreHome: 2,
      scoreAway: 1,
    });
    const completedTwo = createMatch({
      id: "res-team-2",
      teamId: "team-2",
      status: "COMPLETED",
      scoreHome: 1,
      scoreAway: 0,
    });

    renderOverview([completedOne, completedTwo], {
      tab: "RESULTATE",
      teamFilter: "team-2",
    });

    expect(screen.getByTestId("matchcenter-team-filter-trigger")).toHaveTextContent(
      "Frauen 1",
    );
    expect(screen.getByTestId("matchcenter-resultate-list")).toBeInTheDocument();
    expect(
      screen.getByTestId("matchcenter-result-row-res-team-2"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("matchcenter-result-row-res-team-1"),
    ).toBeNull();
  });

  it("preserves team selection when switching tabs", () => {
    renderOverview([createMatch()], { teamFilter: "team-1" });

    expect(screen.getByTestId("matchcenter-tab-resultate")).toHaveAttribute(
      "href",
      "/dashboard/matchcenter?tab=resultate&month=2026-08&team=team-1",
    );
  });

  it("preserves team and month query state together", () => {
    renderOverview([createMatch()], { teamFilter: "team-2", actionFilter: "OFFEN" });

    expect(screen.getByTestId("matchcenter-month-next")).toHaveAttribute(
      "href",
      "/dashboard/matchcenter?tab=spielplanung&month=2026-09&filter=offen&team=team-2",
    );
  });
});
