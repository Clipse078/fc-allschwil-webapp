/**
 * lib/integrations/sfv/sync/__tests__/schedule-team-sync.test.ts
 *
 * TEAM-SFV-MAPPING-02 — Focused tests for healMissingClubTeamMappings.
 *
 * Root cause under test: the automatic (cron-triggered) SFV sync only calls
 * syncSfvSchedule — it never calls syncSfvTeams. Without this healing step,
 * a season transition (or a newly added club team) leaves affected matches
 * permanently unresolved ("Team nicht zugeordnet") until an admin manually
 * re-runs "Sync Teams". This module reuses the exact tested season-carryover
 * logic from team-persistence.ts (TEAM-SFV-MAPPING-01), scoped only to teams
 * referenced by the current schedule batch.
 *
 * All database access is mocked at the team-persistence.ts boundary — no
 * live database or network access.
 *
 * TEST COVERAGE MAP:
 *   1. No candidates (nothing referenced is both club-owned and known) → no-op.
 *   2. Only club-owned + referenced + present-in-team-list teamIds are processed.
 *   3. A referenced-but-not-club-owned teamId (external opponent) is never processed.
 *   4. A club-owned teamId missing from clubTeamDetailsById is skipped (defensive).
 *   5. Counts outcomes correctly (created / relinked / updated / unchanged / failed).
 *   6. Never calls markMappingsInactive or any deactivation path (not imported/used).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TeamDetail } from "../../client";
import type { SfvTeamSyncContext } from "../types";

// ── Mock team-persistence.ts (already fully unit-tested in TEAM-SFV-MAPPING-01) ──

const mockLoadExistingMappings = vi.fn();
const mockLoadCrossSeasonTeamIds = vi.fn();
const mockProcessTeamDetail = vi.fn();

vi.mock("../team-persistence", () => ({
  loadExistingMappings: (...args: unknown[]) => mockLoadExistingMappings(...args),
  loadCrossSeasonTeamIds: (...args: unknown[]) => mockLoadCrossSeasonTeamIds(...args),
  processTeamDetail: (...args: unknown[]) => mockProcessTeamDetail(...args),
}));

const { healMissingClubTeamMappings } = await import("../schedule-team-sync");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-fca";

const CONTEXT_2027: SfvTeamSyncContext = {
  tenantId: TENANT_ID,
  clubId: 483,
  seasonId: 2027,
  organisationId: null,
  syncedAt: new Date("2027-08-01T00:00:00.000Z"),
};

function makeTeamDetail(overrides: Partial<TeamDetail> = {}): TeamDetail {
  return {
    isHomeTeam: false,
    teamId: 31927,
    teamName: "FC Allschwil 1",
    teamFullname: "FC Allschwil 1. Mannschaft",
    clubNumber: 483,
    clubName: "FC Allschwil",
    teamLeagueId: 17131,
    teamLeagueName: "4. Liga Gruppe 1",
    teamDivisionName: "Gruppe 1",
    teamOrganisationId: 8,
    isTeamActive: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadExistingMappings.mockResolvedValue(new Map());
  mockLoadCrossSeasonTeamIds.mockResolvedValue(new Map());
});

describe("healMissingClubTeamMappings", () => {
  it("1 — no candidates → no-op, never touches the database", async () => {
    const result = await healMissingClubTeamMappings(
      TENANT_ID,
      new Set([44001]), // referenced, but external opponent
      new Set([31927]), // club-owned set does not include 44001
      new Map([[31927, makeTeamDetail()]]),
      CONTEXT_2027,
    );

    expect(result).toEqual({ candidates: 0, created: 0, relinked: 0, updated: 0, unchanged: 0, failed: 0 });
    expect(mockLoadExistingMappings).not.toHaveBeenCalled();
    expect(mockLoadCrossSeasonTeamIds).not.toHaveBeenCalled();
    expect(mockProcessTeamDetail).not.toHaveBeenCalled();
  });

  it("2 — processes only teamIds that are referenced AND club-owned AND present in the team-list map", async () => {
    mockProcessTeamDetail.mockResolvedValueOnce({ status: "relinked" });

    const detail = makeTeamDetail({ teamId: 31927 });
    const result = await healMissingClubTeamMappings(
      TENANT_ID,
      new Set([31927, 44001]), // 44001 referenced but external
      new Set([31927]), // only 31927 is club-owned
      new Map([[31927, detail]]),
      CONTEXT_2027,
    );

    expect(mockProcessTeamDetail).toHaveBeenCalledOnce();
    expect(mockProcessTeamDetail).toHaveBeenCalledWith(
      detail,
      CONTEXT_2027,
      expect.any(Map),
      expect.any(Map),
    );
    expect(result.candidates).toBe(1);
    expect(result.relinked).toBe(1);
  });

  it("3 — an external opponent (not club-owned) is never processed even if referenced", async () => {
    await healMissingClubTeamMappings(
      TENANT_ID,
      new Set([44001]),
      new Set([31927]), // 44001 is not club-owned
      new Map([[44001, makeTeamDetail({ teamId: 44001 })]]),
      CONTEXT_2027,
    );

    expect(mockProcessTeamDetail).not.toHaveBeenCalled();
  });

  it("4 — a club-owned referenced teamId missing from clubTeamDetailsById is skipped defensively", async () => {
    const result = await healMissingClubTeamMappings(
      TENANT_ID,
      new Set([31927]),
      new Set([31927]),
      new Map(), // no TeamDetail available for 31927
      CONTEXT_2027,
    );

    expect(result.candidates).toBe(0);
    expect(mockProcessTeamDetail).not.toHaveBeenCalled();
  });

  it("5 — correctly tallies created/relinked/updated/unchanged/failed outcomes", async () => {
    mockProcessTeamDetail
      .mockResolvedValueOnce({ status: "created" })
      .mockResolvedValueOnce({ status: "relinked" })
      .mockResolvedValueOnce({ status: "updated" })
      .mockResolvedValueOnce({ status: "unchanged" })
      .mockResolvedValueOnce({ status: "failed", code: "TEAM_CREATE_FAILED", message: "boom" });

    const teamIds = [1, 2, 3, 4, 5];
    const clubTeamDetailsById = new Map(teamIds.map((id) => [id, makeTeamDetail({ teamId: id })]));

    const result = await healMissingClubTeamMappings(
      TENANT_ID,
      new Set(teamIds),
      new Set(teamIds),
      clubTeamDetailsById,
      CONTEXT_2027,
    );

    expect(result).toEqual({
      candidates: 5,
      created: 1,
      relinked: 1,
      updated: 1,
      unchanged: 1,
      failed: 1,
    });
  });

  it("6 — only loads existing mappings and cross-season mappings once per call (no per-team refetch)", async () => {
    mockProcessTeamDetail.mockResolvedValue({ status: "unchanged" });
    const teamIds = [1, 2, 3];
    const clubTeamDetailsById = new Map(teamIds.map((id) => [id, makeTeamDetail({ teamId: id })]));

    await healMissingClubTeamMappings(TENANT_ID, new Set(teamIds), new Set(teamIds), clubTeamDetailsById, CONTEXT_2027);

    expect(mockLoadExistingMappings).toHaveBeenCalledOnce();
    expect(mockLoadExistingMappings).toHaveBeenCalledWith(TENANT_ID, "SFV", CONTEXT_2027.seasonId);
    expect(mockLoadCrossSeasonTeamIds).toHaveBeenCalledOnce();
    expect(mockLoadCrossSeasonTeamIds).toHaveBeenCalledWith(TENANT_ID, "SFV", CONTEXT_2027.seasonId);
  });
});
