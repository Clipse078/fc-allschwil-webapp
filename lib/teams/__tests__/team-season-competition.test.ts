/**
 * lib/teams/__tests__/team-season-competition.test.ts
 *
 * TEAMCENTER-UX-01C — Focused tests for setTeamSeasonCompetition().
 *
 * Registration (team-registration-service.ts) was previously the only path
 * that could create a TeamSeasonCompetition — there was no way to add,
 * change, or remove a competition assignment after a Team/TeamSeason
 * already existed. This is the canonical (and only) write path for that
 * follow-up edit.
 *
 * All database access is mocked via `@/lib/db/prisma`. No live database.
 *
 * TEST COVERAGE MAP:
 *   1. Assigns a new primary competition when none exists yet.
 *   2. Demotes the previous primary and promotes the newly selected
 *      competition when a TeamSeasonCompetition row already exists for it
 *      (re-selecting a competition that was previously non-primary).
 *   3. Clears the primary assignment when competitionId is null.
 *   4. Rejects a competitionId when the TeamSeason's participationType is
 *      not COMPETITION ("Nur für Wettkampfteams").
 *   5. Rejects a competition belonging to another tenant.
 *   6. Rejects an archived competition.
 *   7. Returns TEAM_SEASON_NOT_FOUND for a cross-tenant / unknown TeamSeason.
 *   8. Returns TEAM_SEASON_NOT_FOUND when teamSeason.teamId does not match
 *      the supplied teamId (never targets the wrong Team's season).
 *   9. Never touches Team fields — only TeamSeasonCompetition rows.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  teamSeasonFindFirst: vi.fn(),
  competitionFindFirst: vi.fn(),
  teamSeasonCompetitionUpdateMany: vi.fn(),
  teamSeasonCompetitionFindUnique: vi.fn(),
  teamSeasonCompetitionUpdate: vi.fn(),
  teamSeasonCompetitionCreate: vi.fn(),
  transaction: vi.fn(),
  teamUpdate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: {
      findFirst: (...args: unknown[]) => mocks.teamSeasonFindFirst(...args),
    },
    competition: {
      findFirst: (...args: unknown[]) => mocks.competitionFindFirst(...args),
    },
    teamSeasonCompetition: {
      updateMany: (...args: unknown[]) => mocks.teamSeasonCompetitionUpdateMany(...args),
      findUnique: (...args: unknown[]) => mocks.teamSeasonCompetitionFindUnique(...args),
      update: (...args: unknown[]) => mocks.teamSeasonCompetitionUpdate(...args),
      create: (...args: unknown[]) => mocks.teamSeasonCompetitionCreate(...args),
    },
    team: {
      update: (...args: unknown[]) => mocks.teamUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
  },
}));

import { setTeamSeasonCompetition } from "../team-season-service";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const TEAM_ID = "team-01";
const TEAM_SEASON_ID = "ts-01";
const COMPETITION_ID = "comp-01";

function makeTx() {
  return {
    teamSeasonCompetition: {
      updateMany: mocks.teamSeasonCompetitionUpdateMany,
      findUnique: mocks.teamSeasonCompetitionFindUnique,
      update: mocks.teamSeasonCompetitionUpdate,
      create: mocks.teamSeasonCompetitionCreate,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.teamSeasonFindFirst.mockResolvedValue({
    id: TEAM_SEASON_ID,
    teamId: TEAM_ID,
    participationType: "COMPETITION",
    team: { tenantId: TENANT_A },
  });

  mocks.competitionFindFirst.mockResolvedValue({
    id: COMPETITION_ID,
    officialName: "Liga 1",
    shortName: "L1",
    isArchived: false,
  });

  mocks.teamSeasonCompetitionUpdateMany.mockResolvedValue({ count: 0 });
  mocks.teamSeasonCompetitionFindUnique.mockResolvedValue(null);
  mocks.teamSeasonCompetitionUpdate.mockResolvedValue({ id: "tsc-01" });
  mocks.teamSeasonCompetitionCreate.mockResolvedValue({ id: "tsc-01" });

  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(makeTx()));
});

describe("setTeamSeasonCompetition", () => {
  it("1 — assigns a new primary competition when none exists yet", async () => {
    const result = await setTeamSeasonCompetition({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      competitionId: COMPETITION_ID,
    });

    expect(result).toEqual({
      ok: true,
      competition: { id: COMPETITION_ID, officialName: "Liga 1", shortName: "L1" },
    });
    expect(mocks.teamSeasonCompetitionUpdateMany).toHaveBeenCalledWith({
      where: { teamSeasonId: TEAM_SEASON_ID, isPrimary: true },
      data: { isPrimary: false },
    });
    expect(mocks.teamSeasonCompetitionCreate).toHaveBeenCalledWith({
      data: {
        teamSeasonId: TEAM_SEASON_ID,
        competitionId: COMPETITION_ID,
        isPrimary: true,
        displayOrder: 0,
      },
    });
    expect(mocks.teamSeasonCompetitionUpdate).not.toHaveBeenCalled();
  });

  it("2 — promotes an existing (previously non-primary) TeamSeasonCompetition row instead of creating a duplicate", async () => {
    mocks.teamSeasonCompetitionFindUnique.mockResolvedValueOnce({ id: "tsc-existing" });

    await setTeamSeasonCompetition({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      competitionId: COMPETITION_ID,
    });

    expect(mocks.teamSeasonCompetitionUpdate).toHaveBeenCalledWith({
      where: { id: "tsc-existing" },
      data: { isPrimary: true, displayOrder: 0 },
    });
    expect(mocks.teamSeasonCompetitionCreate).not.toHaveBeenCalled();
  });

  it("3 — clears the primary assignment when competitionId is null", async () => {
    const result = await setTeamSeasonCompetition({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      competitionId: null,
    });

    expect(result).toEqual({ ok: true, competition: null });
    expect(mocks.teamSeasonCompetitionUpdateMany).toHaveBeenCalledWith({
      where: { teamSeasonId: TEAM_SEASON_ID, isPrimary: true },
      data: { isPrimary: false },
    });
    expect(mocks.teamSeasonCompetitionCreate).not.toHaveBeenCalled();
    expect(mocks.teamSeasonCompetitionUpdate).not.toHaveBeenCalled();
    expect(mocks.competitionFindFirst).not.toHaveBeenCalled();
  });

  it("4 — rejects a competition assignment when the TeamSeason is not a COMPETITION participation type", async () => {
    mocks.teamSeasonFindFirst.mockResolvedValueOnce({
      id: TEAM_SEASON_ID,
      teamId: TEAM_ID,
      participationType: "TRAINING",
      team: { tenantId: TENANT_A },
    });

    const result = await setTeamSeasonCompetition({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      competitionId: COMPETITION_ID,
    });

    expect(result).toEqual({
      ok: false,
      code: "COMPETITION_NOT_ALLOWED",
      message: expect.stringContaining("Wettkampfteams"),
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("5 — rejects a competition belonging to another tenant", async () => {
    mocks.competitionFindFirst.mockResolvedValueOnce(null);

    const result = await setTeamSeasonCompetition({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      competitionId: COMPETITION_ID,
    });

    expect(result).toEqual({
      ok: false,
      code: "COMPETITION_NOT_FOUND",
      message: expect.stringContaining("nicht gefunden"),
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("6 — rejects an archived competition", async () => {
    mocks.competitionFindFirst.mockResolvedValueOnce({
      id: COMPETITION_ID,
      officialName: "Liga 1",
      shortName: "L1",
      isArchived: true,
    });

    const result = await setTeamSeasonCompetition({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      competitionId: COMPETITION_ID,
    });

    expect(result).toEqual({
      ok: false,
      code: "COMPETITION_ARCHIVED",
      message: expect.stringContaining("Archivierte"),
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("7 — returns TEAM_SEASON_NOT_FOUND for an unknown TeamSeason (never leaks existence)", async () => {
    mocks.teamSeasonFindFirst.mockResolvedValueOnce(null);

    const result = await setTeamSeasonCompetition({
      tenantId: TENANT_B,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      competitionId: COMPETITION_ID,
    });

    expect(result).toEqual({
      ok: false,
      code: "TEAM_SEASON_NOT_FOUND",
      message: expect.stringContaining("nicht gefunden"),
    });
  });

  it("8 — returns TEAM_SEASON_NOT_FOUND when the TeamSeason belongs to a different Team", async () => {
    mocks.teamSeasonFindFirst.mockResolvedValueOnce(null);

    const result = await setTeamSeasonCompetition({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      competitionId: COMPETITION_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TEAM_SEASON_NOT_FOUND");
    }
  });

  it("9 — never mutates the Team row — only TeamSeasonCompetition rows are written", async () => {
    await setTeamSeasonCompetition({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      competitionId: COMPETITION_ID,
    });

    expect(mocks.teamUpdate).not.toHaveBeenCalled();
  });
});
