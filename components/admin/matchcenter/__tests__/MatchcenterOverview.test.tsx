/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MatchcenterOverview, {
  getOperationalWarnings,
} from "@/components/admin/matchcenter/MatchcenterOverview";
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

describe("TEAM-SFV-MAPPING-05: team-assignment warning semantics", () => {
  // Reproduces live STAGE provider match 4344423 (Junioren B 1. Stärkeklasse):
  // Home: FC Allschwil B2 (canonically mapped) — Away: VfR Kleinhüningen a
  // (external opponent, intentionally not mapped to a canonical tenant Team).
  const unmappedExternalOpponent = {
    providerTeamId: 5544,
    providerTeamName: "VfR Kleinhüningen a",
    canonicalTeamId: null,
    canonicalTeamName: null,
    displayName: "VfR Kleinhüningen a",
    resolution: "UNRESOLVED" as const,
    isOwnTeam: false,
  };

  const resolvedFca = {
    providerTeamId: 3311,
    providerTeamName: "FC Allschwil B2",
    canonicalTeamId: "team-fca-b2",
    canonicalTeamName: "FC Allschwil B2",
    displayName: "FC Allschwil B2",
    resolution: "RESOLVED" as const,
    isOwnTeam: true,
  };

  const unresolvedFca = {
    providerTeamId: 3311,
    providerTeamName: "FC Allschwil B2",
    canonicalTeamId: null,
    canonicalTeamName: null,
    displayName: "FC Allschwil B2",
    resolution: "UNRESOLVED" as const,
    isOwnTeam: false,
  };

  const resolvedOpponent = {
    providerTeamId: 5544,
    providerTeamName: "VfR Kleinhüningen a",
    canonicalTeamId: "team-opponent",
    canonicalTeamName: "VfR Kleinhüningen a",
    displayName: "VfR Kleinhüningen a",
    resolution: "RESOLVED" as const,
    isOwnTeam: false,
  };

  it("case 1 / match 4344423: FCA home resolved + external opponent unmapped -> no warning", () => {
    render(
      <MatchcenterOverview
        matches={[
          createMatch({
            id: "match-4344423",
            title: "FC Allschwil B2 – VfR Kleinhüningen a",
            competitionLabel: "Junioren B 1. Stärkeklasse",
            homeAway: "HOME",
            home: resolvedFca,
            away: unmappedExternalOpponent,
          }),
        ]}
      />,
    );

    expect(screen.queryByText("Team nicht zugeordnet")).toBeNull();
    // The opponent's provider name remains visible without being canonicalized.
    expect(screen.getByText("VfR Kleinhüningen a")).toBeTruthy();
  });

  it("case 2: FCA away side resolved + external opponent unmapped -> no warning", () => {
    // Away matches render an informational "Auswärtsspiel" readiness badge
    // instead of the warning list, so the underlying decision (used by any
    // consumer of the warnings, e.g. detail-page parity) is asserted
    // directly here rather than through the away-match UI branch.
    const match = createMatch({
      homeAway: "AWAY",
      home: unmappedExternalOpponent,
      away: resolvedFca,
    });

    expect(getOperationalWarnings(match)).not.toContain(
      "Team nicht zugeordnet",
    );
  });

  it("case 3: FCA home side unresolved -> warning shown even if opponent is mapped", () => {
    render(
      <MatchcenterOverview
        matches={[
          createMatch({
            homeAway: "HOME",
            home: unresolvedFca,
            away: resolvedOpponent,
          }),
        ]}
      />,
    );

    expect(screen.getByText("Team nicht zugeordnet")).toBeTruthy();
  });

  it("case 4: FCA away side unresolved -> warning shown", () => {
    const match = createMatch({
      homeAway: "AWAY",
      home: resolvedOpponent,
      away: unresolvedFca,
    });

    expect(getOperationalWarnings(match)).toContain(
      "Team nicht zugeordnet",
    );
  });

  it("case 5: both canonical sides resolved -> no team-assignment warning", () => {
    render(
      <MatchcenterOverview
        matches={[
          createMatch({
            homeAway: "HOME",
            home: resolvedFca,
            away: resolvedOpponent,
          }),
        ]}
      />,
    );

    expect(screen.queryByText("Team nicht zugeordnet")).toBeNull();
  });

  it("case 7: pitch/dressing-room warnings remain unaffected by an unmapped opponent", () => {
    render(
      <MatchcenterOverview
        matches={[
          createMatch({
            homeAway: "HOME",
            home: resolvedFca,
            away: unmappedExternalOpponent,
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

    expect(screen.queryByText("Team nicht zugeordnet")).toBeNull();
    expect(screen.getByText("Spielfeld fehlt")).toBeTruthy();
    expect(screen.getByText("Garderobe Heimteam fehlt")).toBeTruthy();
    expect(screen.getByText("Garderobe Gastteam fehlt")).toBeTruthy();
  });

  it("readiness is 'ready' for a fully set-up home match even with an unmapped opponent", () => {
    render(
      <MatchcenterOverview
        matches={[
          createMatch({
            id: "match-4344423",
            homeAway: "HOME",
            home: resolvedFca,
            away: unmappedExternalOpponent,
          }),
        ]}
      />,
    );

    expect(
      screen.getByTestId("matchcenter-readiness-match-4344423"),
    ).toHaveTextContent("Bereit für Infoboard");
  });

  it("does not rely on team display names to decide the warning (identity-based only)", () => {
    // Same shape as the unresolved-FCA case, but with unrelated/foreign
    // display names — the outcome must be identical, proving the decision
    // is based on isOwnTeam/homeAway/resolution, not on name matching.
    render(
      <MatchcenterOverview
        matches={[
          createMatch({
            homeAway: "HOME",
            home: {
              ...unresolvedFca,
              providerTeamName: "Zzz Unrelated Name FC",
              displayName: "Zzz Unrelated Name FC",
            },
            away: {
              ...resolvedOpponent,
              providerTeamName: "FC Allschwil Lookalike",
              canonicalTeamName: "FC Allschwil Lookalike",
              displayName: "FC Allschwil Lookalike",
            },
          }),
        ]}
      />,
    );

    // Warning still fires because the home side (FCA, per homeAway) is
    // unresolved — regardless of what either side is named.
    expect(screen.getByText("Team nicht zugeordnet")).toBeTruthy();
  });
});