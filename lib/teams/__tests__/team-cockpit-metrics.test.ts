import { describe, it, expect } from "vitest";
import { buildTeamCockpitMetrics } from "../team-cockpit-metrics";
import type { TeamDetailData } from "../queries";

const CATEGORY_LABELS = {
  AKTIVE: "Aktive",
};

const PARTICIPATION_LABELS = {
  COMPETITION: "Wettkampfteam",
};

function makeTeamDetail(overrides: Partial<TeamDetailData> = {}): TeamDetailData {
  return {
    id: "team-1",
    name: "FC Test",
    shortName: "Test",
    alternativeName: null,
    infoboardDisplayName: null,
    infoboardTrainingDisplayName: null,
    infoboardMatchDisplayName: null,
    infoboardTournamentDisplayName: null,
    slug: "fc-test",
    category: "AKTIVE",
    genderGroup: null,
    ageGroup: null,
    sortOrder: 0,
    isActive: true,
    websiteVisible: true,
    infoboardVisible: false,
    orgUnitId: null,
    orgUnit: null,
    displayName: "FC Test",
    compactName: "Test",
    currentTeamSeasonId: "ts-current",
    currentParticipationType: "COMPETITION",
    currentSeasonPublication: {
      seasonName: "Saison 2025/26",
      showNextMatch: true,
      showNextTournament: false,
    },
    currentSeasonOrgUnit: { id: "ou-1", name: "Junioren", key: "junioren", type: "DIVISION" },
    competition: { id: "comp-1", name: "2. Liga", shortName: "2L" },
    providerMapping: null,
    teamSeasons: [
      {
        id: "ts-current",
        displayName: "FC Test 2025/26",
        shortName: null,
        status: "ACTIVE",
        participationType: "COMPETITION",
        websiteVisible: true,
        infoboardVisible: true,
        squadWebsiteVisible: true,
        trainerTeamWebsiteVisible: true,
        showNextMatch: true,
        showNextTournament: false,
        season: {
          id: "season-1",
          key: "2025-2026",
          name: "Saison 2025/26",
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2026-06-30T00:00:00.000Z",
          isActive: true,
        },
        playerSquadMembers: [
          {
            id: "psm-1",
            status: "ACTIVE",
            shirtNumber: 10,
            positionLabel: "Stürmer",
            isCaptain: false,
            isViceCaptain: false,
            isWebsiteVisible: true,
            sortOrder: 0,
            remarks: null,
            person: {
              id: "person-1",
              firstName: "Max",
              lastName: "Muster",
              displayName: null,
              email: null,
              phone: null,
              dateOfBirth: "2010-01-01T00:00:00.000Z",
            },
          },
          {
            id: "psm-2",
            status: "ACTIVE",
            shirtNumber: 7,
            positionLabel: null,
            isCaptain: true,
            isViceCaptain: false,
            isWebsiteVisible: true,
            sortOrder: 1,
            remarks: null,
            person: {
              id: "person-2",
              firstName: "Anna",
              lastName: "Beispiel",
              displayName: null,
              email: null,
              phone: null,
              dateOfBirth: null,
            },
          },
        ],
        trainerTeamMembers: [
          {
            id: "ttm-1",
            status: "ACTIVE",
            roleLabel: "Cheftrainer",
            isWebsiteVisible: true,
            sortOrder: 0,
            remarks: null,
            person: {
              id: "person-3",
              firstName: "Tom",
              lastName: "Trainer",
              displayName: null,
              email: null,
              phone: null,
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("TEAM-COCKPIT-01 — buildTeamCockpitMetrics", () => {
  it("derives player and trainer counts from the current season roster", () => {
    const metrics = buildTeamCockpitMetrics({
      team: makeTeamDetail(),
      categoryLabels: CATEGORY_LABELS,
      participationTypeLabels: PARTICIPATION_LABELS,
    });

    expect(metrics.playerCount).toBe(2);
    expect(metrics.trainerCount).toBe(1);
    expect(metrics.seasonName).toBe("Saison 2025/26");
    expect(metrics.seasonLabel).toBe("Saison 2025/26");
    expect(metrics.competitionLabel).toBe("2L");
    expect(metrics.orgUnitName).toBe("Junioren");
    expect(metrics.healthState).toBe("neutral");
  });

  it("returns zero roster counts when no current season is resolved", () => {
    const metrics = buildTeamCockpitMetrics({
      team: makeTeamDetail({ currentTeamSeasonId: null, teamSeasons: [] }),
      categoryLabels: CATEGORY_LABELS,
      participationTypeLabels: PARTICIPATION_LABELS,
    });

    expect(metrics.playerCount).toBe(0);
    expect(metrics.trainerCount).toBe(0);
    expect(metrics.seasonName).toBeNull();
    expect(metrics.seasonLabel).toBe("Keine Saison");
  });

  it("distinguishes historical seasons from missing current-season assignment", () => {
    const metrics = buildTeamCockpitMetrics({
      team: makeTeamDetail({
        currentTeamSeasonId: null,
        teamSeasons: makeTeamDetail().teamSeasons,
      }),
      categoryLabels: CATEGORY_LABELS,
      participationTypeLabels: PARTICIPATION_LABELS,
    });

    expect(metrics.seasonLabel).toBe("Keine Saison im aktuellen Geschäftsjahr");
    expect(metrics.hasHistoricalSeasons).toBe(true);
    expect(metrics.playerCount).toBe(0);
  });
});
