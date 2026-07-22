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

  it("shows operational completeness for a complete match", () => {
    render(
      <MatchcenterOverview
        matches={[createMatch()]}
      />,
    );

    expect(
      screen.getByText("Operativ vollständig"),
    ).toBeTruthy();
  });

  it("shows missing operational data as warnings", () => {
    render(
      <MatchcenterOverview
        matches={[
          createMatch({
            location: null,
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

    expect(screen.getByText("Spielort fehlt")).toBeTruthy();
    expect(screen.getByText("Feld fehlt")).toBeTruthy();
    expect(screen.getByText("Garderobe fehlt")).toBeTruthy();
  });

  it("shows unresolved team warnings", () => {
    const base = createMatch();

    render(
      <MatchcenterOverview
        matches={[
          createMatch({
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
      screen.getByText("Auswärtsteam nicht zugeordnet"),
    ).toBeTruthy();
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