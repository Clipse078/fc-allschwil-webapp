/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MatchcenterOverview from "@/components/admin/matchcenter/MatchcenterOverview";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";

function createMatch(
  overrides: Partial<MatchcenterMatchSummary> = {},
): MatchcenterMatchSummary {
  return {
    id: "match-1",
    tenantId: "tenant-1",
    type: "MATCH",
    title: "FC Allschwil – Gegner",
    description: null,
    status: "SCHEDULED",
    startAt: new Date("2026-08-22T16:00:00.000Z"),
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
      meetingTime: new Date("2026-08-22T15:00:00.000Z"),
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

describe("MatchcenterOverview", () => {
  it("renders the empty state and create link", () => {
    render(<MatchcenterOverview matches={[]} />);

    expect(
      screen.getByText("Keine Matches vorhanden"),
    ).toBeTruthy();

    const link = screen.getByRole("link", {
      name: /Match erstellen/i,
    });

    expect(link).toHaveAttribute(
      "href",
      "/dashboard/events/matches/new",
    );
  });

  it("renders home and away teams", () => {
    render(
      <MatchcenterOverview
        matches={[createMatch()]}
      />,
    );

    expect(
      screen.getByText("FC Allschwil E1"),
    ).toBeTruthy();

    expect(
      screen.getByText("FC Basel E1"),
    ).toBeTruthy();
  });

  it("links each match to its detail page", () => {
    render(
      <MatchcenterOverview
        matches={[createMatch()]}
      />,
    );

    const link = screen.getByRole("link", {
      name: "Details zu FC Allschwil – Gegner anzeigen",
    });

    expect(link).toHaveAttribute(
      "href",
      "/dashboard/matchcenter/match-1",
    );
  });
  it("renders mapped score when available", () => {
    render(
      <MatchcenterOverview
        matches={[
          createMatch({
            status: "COMPLETED",
            scoreHome: 3,
            scoreAway: 1,
          }),
        ]}
      />,
    );

    expect(
      screen.getByTestId("matchcenter-result-match-1"),
    ).toHaveTextContent("3:1");
  });

  it("falls back to resultLabel when mapped score is absent", () => {
    render(
      <MatchcenterOverview
        matches={[
          createMatch({
            status: "COMPLETED",
            resultLabel: "2:2",
          }),
        ]}
      />,
    );

    expect(
      screen.getByTestId("matchcenter-result-match-1"),
    ).toHaveTextContent("2:2");
  });

  it("shows Bereit für Infoboard for a fully set-up home match", () => {
    render(
      <MatchcenterOverview
        matches={[createMatch()]}
      />,
    );

    expect(
      screen.getByText("Bereit für Infoboard"),
    ).toBeTruthy();
  });

  it("shows Auswärtsspiel readiness for an away match", () => {
    render(
      <MatchcenterOverview
        matches={[
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
          }),
        ]}
      />,
    );

    // Both the homeaway badge and the readiness badge show "Auswärtsspiel"
    expect(screen.getAllByText("Auswärtsspiel").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Infoboard nicht freigegeben")).toBeNull();
  });

  it("shows missing operational data as warnings", () => {
    render(
      <MatchcenterOverview
        matches={[
          createMatch({
            visibility: {
              websiteVisible: true,
              infoboardVisible: false,
              homepageVisible: false,
              wochenplanVisible: true,
              trainingsplanVisible: false,
              teamPageVisible: true,
            },
            operational: {
              pitchCode: null,
              homeDressingRoomCode: null,
              awayDressingRoomCode: null,
              meetingTime: null,
              remarks: null,
            },
          }),
        ]}
      />,
    );

    expect(screen.getByText("Spielfeld fehlt")).toBeTruthy();
    expect(screen.getByText("Garderobe Heimteam fehlt")).toBeTruthy();
    expect(screen.getByText("Garderobe Gastteam fehlt")).toBeTruthy();
    expect(screen.getByText("Infoboard nicht freigegeben")).toBeTruthy();
  });

  it("shows unresolved team warnings", () => {
    const base = createMatch();

    render(
      <MatchcenterOverview
        matches={[
          createMatch({
            // Both sides unresolved so readiness is "setup-required" and warnings show
            home: {
              ...base.home,
              canonicalTeamId: null,
              canonicalTeamName: null,
              resolution: "UNRESOLVED",
            },
            away: {
              ...base.away,
              canonicalTeamId: null,
              canonicalTeamName: null,
              resolution: "UNRESOLVED",
            },
          }),
        ]}
      />,
    );

    expect(
      screen.getByText("Team nicht zugeordnet"),
    ).toBeTruthy();
  });

  it("does not show Infoboard warning for away matches", () => {
    render(
      <MatchcenterOverview
        matches={[
          createMatch({
            homeAway: "AWAY",
            visibility: {
              websiteVisible: true,
              infoboardVisible: false,
              homepageVisible: false,
              wochenplanVisible: false,
              trainingsplanVisible: false,
              teamPageVisible: false,
            },
          }),
        ]}
      />,
    );

    expect(screen.queryByText("Infoboard nicht freigegeben")).toBeNull();
  });

  it("renders live status in German", () => {
    render(
      <MatchcenterOverview
        matches={[
          createMatch({
            status: "LIVE",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Live")).toBeTruthy();
  });
});