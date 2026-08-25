/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MatchcenterDetail from "@/components/admin/matchcenter/MatchcenterDetail";
import type { MatchcenterMatchDetail } from "@/lib/matchcenter/types";

// ADMIN-DELETE-02A: MatchcenterDetail now always renders MatchLifecycleCard
// (hidden internally when canDelete is false), which calls useRouter() —
// required so this suite doesn't need a mounted Next.js app router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

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

vi.mock(
  "@/components/admin/matchcenter/MatchcenterDetailOperational",
  () => ({
    default: ({
      matchId,
      homeAway,
      isOperationallyActionable,
    }: {
      matchId: string;
      homeAway: string | null;
      isOperationallyActionable?: boolean;
    }) => (
      <div
        data-testid="matchcenter-detail-operational"
        data-match-id={matchId}
        data-homeaway={homeAway ?? ""}
        data-operationally-actionable={
          isOperationallyActionable === false ? "false" : "true"
        }
      >
        MatchcenterDetailOperational
      </div>
    ),
  }),
);

function createMatch(
  overrides: Partial<MatchcenterMatchDetail> = {},
): MatchcenterMatchDetail {
  return {
    id: "match-1",
    tenantId: "tenant-1",
    teamId: "team-1",
    seasonId: "season-2026-2027",
    type: "MATCH",
    title: "FC Allschwil E1 – FC Basel E1",
    description: "Meisterschaftsspiel",
    status: "SCHEDULED",
    startAt: new Date("2026-09-22T16:00:00.000Z"),
    endAt: new Date("2026-09-22T18:00:00.000Z"),
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

  it("uses canonical lifecycle for provider-completed fixtures still marked SCHEDULED", () => {
    render(
      <MatchcenterDetail
        match={createMatch({
          status: "SCHEDULED",
          startAt: new Date("2026-08-02T16:00:00.000Z"),
          scoreHome: 2,
          scoreAway: 1,
          synchronization: {
            eventLastSyncedAt: null,
            mappingLastSyncedAt: null,
            detailSyncedAt: null,
            providerMatchState: null,
            providerMatchStateName: "ausgetragen",
          },
        })}
      />,
    );

    expect(
      screen.getByTestId("matchcenter-detail-status"),
    ).toHaveTextContent("Abgeschlossen");
    expect(
      screen.getByTestId("matchcenter-detail-result"),
    ).toHaveTextContent("2:1");
  });

  it("does not show a fake score for future SCHEDULED fixtures with 0:0 placeholders", () => {
    render(
      <MatchcenterDetail
        match={createMatch({
          status: "SCHEDULED",
          scoreHome: 0,
          scoreAway: 0,
        })}
      />,
    );

    expect(screen.queryByTestId("matchcenter-detail-result")).toBeNull();
  });

  it("renders operational remarks inside technical details", () => {
    render(<MatchcenterDetail match={createMatch()} />);

    expect(
      screen.getByTestId("matchcenter-technical-details"),
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("matchcenter-detail-meeting-time"),
    ).not.toHaveTextContent("Nicht hinterlegt");

    expect(
      screen.getByTestId("matchcenter-detail-remarks"),
    ).toHaveTextContent("Matchbälle mitnehmen");
  });

  it("renders visibility destinations", () => {
    render(<MatchcenterDetail match={createMatch()} />);

    expect(screen.getByText("Website (inkl. Homepage)")).toBeTruthy();
    expect(screen.getByText("Infoboard")).toBeTruthy();
    // Homepage badge removed — website visibility controls both (PUB-02).
    expect(screen.queryByText("Homepage")).toBeNull();
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

  it("renders provider and synchronization metadata inside technical details", () => {
    render(<MatchcenterDetail match={createMatch()} />);

    expect(screen.getByTestId("matchcenter-technical-details")).toBeInTheDocument();
    expect(screen.getAllByText("SFV").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("10001").length).toBeGreaterThanOrEqual(1);
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
  it("shows synchronization guidance for an unresolved provider mapping", () => {
    const match = createMatch();

    match.away = {
      ...match.away,
      canonicalTeamId: null,
      canonicalTeamName: null,
      resolution: "UNRESOLVED",
    };

    render(
      <MatchcenterDetail
        match={match}
        canManageMappings
      />,
    );

    expect(
      screen.getByTestId(
        "matchcenter-mapping-status-unresolved",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Eine Team-Zuordnung ist offen"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Zur Spielplansynchronisation",
      }),
    ).toHaveAttribute(
      "href",
      "/dashboard/admin/integrations/sfv",
    );
  });

  it("shows resolved mapping without a dedicated status card", () => {
    render(
      <MatchcenterDetail
        match={createMatch()}
      />,
    );

    expect(
      screen.queryByTestId(
        "matchcenter-mapping-status-unresolved",
      ),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("link", {
        name: "Zur Spielplansynchronisation",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows Heimspiel badge for a HOME match", () => {
    render(
      <MatchcenterDetail
        match={createMatch({ homeAway: "HOME" })}
      />,
    );

    expect(
      screen.getByTestId("matchcenter-detail-homeaway"),
    ).toHaveTextContent("Heimspiel");
  });

  it("shows Auswärtsspiel badge for an AWAY match", () => {
    render(
      <MatchcenterDetail
        match={createMatch({ homeAway: "AWAY" })}
      />,
    );

    expect(
      screen.getByTestId("matchcenter-detail-homeaway"),
    ).toHaveTextContent("Auswärtsspiel");
  });

  it("does not show homeAway badge when homeAway is null", () => {
    render(
      <MatchcenterDetail
        match={createMatch({ homeAway: null })}
      />,
    );

    expect(
      screen.queryByTestId("matchcenter-detail-homeaway"),
    ).not.toBeInTheDocument();
  });

  it("renders the operational workspace section", () => {
    render(
      <MatchcenterDetail
        match={createMatch()}
      />,
    );

    expect(
      screen.getByTestId("matchcenter-detail-operational"),
    ).toBeInTheDocument();
  });

  it("passes operational cutoff to the operational workspace for past matches", () => {
    render(
      <MatchcenterDetail
        match={createMatch({
          status: "COMPLETED",
          startAt: new Date("2026-08-24T16:00:00.000Z"),
          scoreHome: 2,
          scoreAway: 1,
        })}
      />,
    );

    expect(
      screen.getByTestId("matchcenter-detail-operational"),
    ).toHaveAttribute("data-operationally-actionable", "false");
  });

  it("renders match hero with club logos when tenant logo is provided", () => {
    render(
      <MatchcenterDetail
        match={createMatch()}
        tenantLogoUrl="https://example.com/club.png"
      />,
    );

    expect(screen.getByTestId("matchcenter-detail-hero")).toBeInTheDocument();
    expect(screen.getByAltText("Logo FC Allschwil E1")).toBeInTheDocument();
  });

  it("does not crash with all optional fields null", () => {
    expect(() =>
      render(
        <MatchcenterDetail
          match={createMatch({
            homeAway: null,
            teamId: null,
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
          })}
        />,
      ),
    ).not.toThrow();
  });
});