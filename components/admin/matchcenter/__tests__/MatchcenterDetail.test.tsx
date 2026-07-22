/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MatchcenterDetail from "@/components/admin/matchcenter/MatchcenterDetail";
import type { MatchcenterMatchDetail } from "@/lib/matchcenter/types";

vi.mock(
  "@/components/admin/matchcenter/MatchTeamMappingDialog",
  () => ({
    default: () => (
      <button type="button">
        Team zuordnen
      </button>
    ),
  }),
);

function createMatch(
  overrides: Partial<MatchcenterMatchDetail> = {},
): MatchcenterMatchDetail {
  return {
    id: "match-1",
    tenantId: "tenant-1",
    type: "MATCH",
    title: "FC Allschwil E1 – FC Basel E1",
    description: "Meisterschaftsspiel",
    status: "SCHEDULED",
    startAt: new Date("2026-08-22T16:00:00.000Z"),
    endAt: new Date("2026-08-22T18:00:00.000Z"),
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
      eventLastSyncedAt:
        new Date("2026-08-20T10:00:00.000Z"),
      mappingLastSyncedAt:
        new Date("2026-08-20T10:15:00.000Z"),
      detailSyncedAt:
        new Date("2026-08-20T10:30:00.000Z"),
      providerMatchState: 1,
      providerMatchStateName: "Geplant",
    },
    operational: {
      pitchCode: "KR2",
      homeDressingRoomCode: "G1",
      awayDressingRoomCode: "G2",
      meetingTime:
        new Date("2026-08-22T15:00:00.000Z"),
      remarks: "Matchbälle mitnehmen",
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
    publishedAt:
      new Date("2026-08-20T12:00:00.000Z"),
    organizerName: "FC Allschwil",
    reviewRequestedAt:
      new Date("2026-08-19T08:00:00.000Z"),
    reviewedAt:
      new Date("2026-08-19T09:00:00.000Z"),
    reviewNotes: "Freigegeben",
    providerLeagueId: 10,
    providerLeagueName: "Junioren E",
    providerDivisionId: 20,
    providerDivisionName: "Stärkeklasse 1",
    providerRoundNumber: 3,
    providerOrganisationId: 30,
    providerPlaygroundId: 40,
    providerVenueName: "Sportanlage Im Brüel",
    providerSeasonName: "2026/2027",
    ...overrides,
  };
}

describe("MatchcenterDetail", () => {
  it("renders the teams, status and back link", () => {
    render(<MatchcenterDetail match={createMatch()} />);

    expect(
      screen.getByTestId("matchcenter-detail-home-team"),
    ).toHaveTextContent("FC Allschwil E1");

    expect(
      screen.getByTestId("matchcenter-detail-away-team"),
    ).toHaveTextContent("FC Basel E1");

    expect(
      screen.getByTestId("matchcenter-detail-status"),
    ).toHaveTextContent("Geplant");

    expect(
      screen.getByRole("link", {
        name: "Zurück zum Matchcenter",
      }),
    ).toHaveAttribute(
      "href",
      "/dashboard/matchcenter",
    );
  });

  it("shows mapping action for an unresolved provider side when allowed", () => {
    const base = createMatch();

    render(
      <MatchcenterDetail
        match={createMatch({
          away: {
            ...base.away,
            canonicalTeamId: null,
            canonicalTeamName: null,
            resolution: "UNRESOLVED",
          },
        })}
        canManageMappings
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Team zuordnen",
      }),
    ).toBeTruthy();
  });

  it("hides mapping action without manage permission", () => {
    const base = createMatch();

    render(
      <MatchcenterDetail
        match={createMatch({
          away: {
            ...base.away,
            canonicalTeamId: null,
            canonicalTeamName: null,
            resolution: "UNRESOLVED",
          },
        })}
        canManageMappings={false}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "Team zuordnen",
      }),
    ).toBeNull();
  });

  it("renders a mapped score", () => {
    render(
      <MatchcenterDetail
        match={createMatch({
          status: "COMPLETED",
          scoreHome: 3,
          scoreAway: 1,
        })}
      />,
    );

    expect(
      screen.getByTestId("matchcenter-detail-result"),
    ).toHaveTextContent("3:1");
  });

  it("falls back to resultLabel", () => {
    render(
      <MatchcenterDetail
        match={createMatch({
          status: "COMPLETED",
          resultLabel: "2:2",
        })}
      />,
    );

    expect(
      screen.getByTestId("matchcenter-detail-result"),
    ).toHaveTextContent("2:2");
  });

  it("renders operational information", () => {
    render(<MatchcenterDetail match={createMatch()} />);

    expect(
      screen.getByTestId("matchcenter-detail-pitch"),
    ).toHaveTextContent("KR2");

    expect(
      screen.getByText("G1"),
    ).toBeTruthy();

    expect(
      screen.getByText("G2"),
    ).toBeTruthy();

    expect(
      screen.getByTestId(
        "matchcenter-detail-meeting-time",
      ),
    ).not.toHaveTextContent("Nicht hinterlegt");

    expect(
      screen.getByTestId("matchcenter-detail-remarks"),
    ).toHaveTextContent("Matchbälle mitnehmen");
  });

  it("renders visibility destinations", () => {
    render(<MatchcenterDetail match={createMatch()} />);

    expect(screen.getByText("Website")).toBeTruthy();
    expect(screen.getByText("Infoboard")).toBeTruthy();
    expect(screen.getByText("Homepage")).toBeTruthy();
    expect(screen.getByText("Wochenplan")).toBeTruthy();
    expect(screen.getByText("Trainingsplan")).toBeTruthy();
    expect(screen.getByText("Teamseite")).toBeTruthy();

    expect(
      screen.getAllByText("Sichtbar").length,
    ).toBeGreaterThan(0);

    expect(
      screen.getAllByText("Nicht sichtbar").length,
    ).toBeGreaterThan(0);
  });

  it("renders provider and synchronization metadata", () => {
    render(<MatchcenterDetail match={createMatch()} />);

    expect(
      screen.getAllByText("SFV").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("10001").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Junioren E")).toBeTruthy();
    expect(screen.getByText("Stärkeklasse 1")).toBeTruthy();
    expect(screen.getByText("2026/2027")).toBeTruthy();

    expect(
      screen.getByTestId("matchcenter-detail-synced"),
    ).not.toHaveTextContent("Nicht hinterlegt");
  });

  it("formats date and time using the supplied timezone", () => {
    render(
      <MatchcenterDetail
        match={createMatch()}
        locale="de-CH"
        timezone="Europe/Zurich"
      />,
    );

    expect(
      screen.getByTestId("matchcenter-detail-start"),
    ).not.toHaveTextContent("Nicht hinterlegt");
  });

  it("renders null-value fallbacks", () => {
    render(
      <MatchcenterDetail
        match={createMatch({
          location: null,
          competitionLabel: null,
          organizerName: null,
          providerLeagueId: null,
          providerLeagueName: null,
          providerDivisionId: null,
          providerDivisionName: null,
          providerRoundNumber: null,
          providerOrganisationId: null,
          providerPlaygroundId: null,
          providerVenueName: null,
          providerSeasonName: null,
          reviewRequestedAt: null,
          reviewedAt: null,
          reviewNotes: null,
          publishedAt: null,
          operational: {
            pitchCode: null,
            homeDressingRoomCode: null,
            awayDressingRoomCode: null,
            meetingTime: null,
            remarks: null,
          },
          synchronization: {
            eventLastSyncedAt: null,
            mappingLastSyncedAt: null,
            detailSyncedAt: null,
            providerMatchState: null,
            providerMatchStateName: null,
          },
        })}
      />,
    );

    expect(
      screen.getAllByText("Nicht hinterlegt").length,
    ).toBeGreaterThan(5);
  });
});