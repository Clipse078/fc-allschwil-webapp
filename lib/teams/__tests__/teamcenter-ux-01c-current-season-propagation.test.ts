/**
 * lib/teams/__tests__/teamcenter-ux-01c-current-season-propagation.test.ts
 *
 * TEAMCENTER-UX-01C — Canonical Master Data Propagation.
 *
 * Root cause: "the Team's current TeamSeason" was independently
 * re-implemented in getTeamsListData, getTeamDetailData, GET /api/teams,
 * and findTeamSeasonsForTenant (TrainingCenter's "Neue Trainingsserie"
 * picker) — each with different precedence/fallback rules. In particular,
 * getTeamDetailData fell back to `teamSeasons[0]` (the most recently
 * *started* season, active or not) whenever no TeamSeason matched
 * Season.isActive, silently substituting a stale season. That is exactly
 * why the Teams UI could show one canonical/current team-season while
 * TrainingCenter exposed a stale/different one for the very same Team.
 *
 * These tests reproduce the STAGE symptom directly against getTeamDetailData
 * and prove the fix: a Team whose only TeamSeason rows do not include the
 * canonical current season must resolve to "no current season" everywhere,
 * never a stale substitute.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTeamDetailData } from "../queries";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  team: { findFirst: ReturnType<typeof vi.fn> };
};

const TENANT_A = "tenant-a";
const TEAM_ID = "team-01";

function makeSeason(overrides: Partial<{
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
}> = {}) {
  return {
    id: overrides.id ?? "season-current",
    key: overrides.key ?? "2026/2027",
    name: overrides.name ?? "Saison 2026/2027",
    startDate: overrides.startDate ?? new Date("2026-07-01"),
    endDate: overrides.endDate ?? new Date("2027-06-30"),
    isActive: overrides.isActive ?? true,
  };
}

function makeTeamSeasonRow(overrides: {
  id: string;
  season: ReturnType<typeof makeSeason>;
  competitionCount?: number;
}) {
  const competitions = Array.from({ length: overrides.competitionCount ?? 0 }, (_, i) => ({
    isPrimary: i === 0,
    competition: {
      id: `comp-0${i + 1}`,
      officialName: `Liga ${i + 1}`,
      shortName: `L${i + 1}`,
      provider: "SFV",
      competitionType: "LEAGUE",
      isArchived: false,
    },
  }));

  return {
    id: overrides.id,
    displayName: `Team ${overrides.season.name}`,
    shortName: null,
    status: "ACTIVE",
    participationType: "COMPETITION",
    websiteVisible: true,
    infoboardVisible: true,
    season: overrides.season,
    competitions,
  };
}

function makeTeamRow(teamSeasons: ReturnType<typeof makeTeamSeasonRow>[]) {
  return {
    id: TEAM_ID,
    name: "FC Test",
    shortName: null,
    alternativeName: null,
    slug: "fc-test",
    category: "AKTIVE",
    genderGroup: null,
    ageGroup: null,
    sortOrder: 0,
    isActive: true,
    websiteVisible: true,
    infoboardVisible: true,
    orgUnitId: null,
    orgUnit: null,
    tenantId: TENANT_A,
    externalMappings: [],
    teamSeasons,
  };
}

describe("TEAMCENTER-UX-01C — getTeamDetailData current-season resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the Season.isActive-flagged TeamSeason as current when present", async () => {
    const current = makeTeamSeasonRow({ id: "ts-current", season: makeSeason({ isActive: true }) });
    const stale = makeTeamSeasonRow({
      id: "ts-stale",
      season: makeSeason({ id: "season-old", key: "2025/2026", name: "Saison 2025/2026", isActive: false }),
    });
    mockPrisma.team.findFirst.mockResolvedValue(makeTeamRow([stale, current]));

    const result = await getTeamDetailData(TENANT_A, TEAM_ID);

    expect(result?.currentTeamSeasonId).toBe("ts-current");
  });

  it("root-cause regression: a Team whose ONLY TeamSeason is a prior (non-active) season resolves to NO current season — it must NOT fall back to that stale entry", async () => {
    const staleOnly = makeTeamSeasonRow({
      id: "ts-stale",
      season: makeSeason({ id: "season-old", key: "2025/2026", name: "Saison 2025/2026", isActive: false }),
      competitionCount: 1,
    });
    mockPrisma.team.findFirst.mockResolvedValue(makeTeamRow([staleOnly]));

    const result = await getTeamDetailData(TENANT_A, TEAM_ID);

    // Before the fix, this silently resolved to `teamSeasons[0]` (the stale
    // entry) and surfaced its competition as if it were current — exactly
    // the cross-surface inconsistency this slice fixes.
    expect(result?.currentTeamSeasonId).toBeNull();
    expect(result?.competition).toBeNull();
  });

  it("a Team with no TeamSeason rows at all resolves to no current season (unchanged baseline)", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(makeTeamRow([]));

    const result = await getTeamDetailData(TENANT_A, TEAM_ID);

    expect(result?.currentTeamSeasonId).toBeNull();
    expect(result?.teamSeasons).toEqual([]);
  });

  it("picks the active-flagged season even when a newer (not-yet-active) season row also exists", async () => {
    // e.g. a Team already registered for next season ahead of the rollover,
    // while the current season is still the canonical one.
    const current = makeTeamSeasonRow({ id: "ts-current", season: makeSeason({ isActive: true }) });
    const future = makeTeamSeasonRow({
      id: "ts-future",
      season: makeSeason({
        id: "season-future",
        key: "2027/2028",
        name: "Saison 2027/2028",
        isActive: false,
        startDate: new Date("2027-07-01"),
        endDate: new Date("2028-06-30"),
      }),
    });
    mockPrisma.team.findFirst.mockResolvedValue(makeTeamRow([future, current]));

    const result = await getTeamDetailData(TENANT_A, TEAM_ID);

    expect(result?.currentTeamSeasonId).toBe("ts-current");
  });
});
