/**
 * ADMIN-DELETE-SEASON-01 — focused Season delete tests.
 *
 * Covers the task-required test list items that need live DB validation:
 *   1. authorized user can permanently delete an unreferenced Season
 *   4. active Season can be deleted safely when otherwise deletable
 *   5. deleting active Season does not implicitly activate another
 *   3. dependency/integrity protection: cascade blockers prevent deletion
 *   8. SetNull relations (EventImportRun, OrgUnitMembership) do NOT block deletion
 *   hasSeasonDependencies: only blocks on cascade-delete relations
 *
 * Requires a live PostgreSQL database (DATABASE_URL). Run against a
 * disposable database — never STAGE.
 */

import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { activateSeason, createSeason, deleteSeason } from "@/lib/seasons/mutations";
import { getSeasonDependencyCounts, hasSeasonDependencies } from "@/lib/seasons/queries";
import { SeasonHasDependenciesError } from "@/lib/seasons/errors";

function randomBand(): number {
  return 5000 + Math.floor(Math.random() * 900) * 3;
}

describe("ADMIN-DELETE-SEASON-01 — Season delete (live DB)", () => {
  const createdSeasonIds: string[] = [];
  const createdTeamIds: string[] = [];

  afterEach(async () => {
    if (createdTeamIds.length > 0) {
      await prisma.teamSeason.deleteMany({ where: { teamId: { in: createdTeamIds } } });
      await prisma.team.deleteMany({ where: { id: { in: createdTeamIds } } });
      createdTeamIds.length = 0;
    }
    if (createdSeasonIds.length > 0) {
      // Force-delete any remaining seasons (bypassing business logic for cleanup)
      await prisma.season.deleteMany({ where: { id: { in: createdSeasonIds } } });
      createdSeasonIds.length = 0;
    }
  });

  // Test 1: authorized user can permanently delete an unreferenced Season
  it("1. permanently deletes an unreferenced Season", async () => {
    const base = randomBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    const result = await deleteSeason(season.id);
    expect(result.id).toBe(season.id);

    const found = await prisma.season.findUnique({ where: { id: season.id } });
    expect(found).toBeNull();
    // Already deleted — remove from cleanup array
    createdSeasonIds.length = 0;
  });

  // Test 4 + 5: active Season can be deleted; no other Season becomes active
  it("4/5. active Season can be deleted when no blocking deps; no other Season auto-activates", async () => {
    const base = randomBand();
    const activeSeason = await createSeason({ startYear: base });
    const otherSeason = await createSeason({ startYear: base + 1 });
    createdSeasonIds.push(activeSeason.id, otherSeason.id);

    // Explicitly activate the first season
    await activateSeason(activeSeason.id);

    const beforeDelete = await prisma.season.findUnique({
      where: { id: activeSeason.id },
      select: { isActive: true },
    });
    expect(beforeDelete?.isActive).toBe(true);

    // Delete the active season
    const result = await deleteSeason(activeSeason.id);
    expect(result.id).toBe(activeSeason.id);

    // Deleted season is gone
    const deletedFound = await prisma.season.findUnique({ where: { id: activeSeason.id } });
    expect(deletedFound).toBeNull();

    // Other season did NOT become active — zero active seasons is acceptable
    const otherAfter = await prisma.season.findUnique({
      where: { id: otherSeason.id },
      select: { isActive: true },
    });
    expect(otherAfter?.isActive).toBe(false);

    // Cleanup: remove only the surviving season
    createdSeasonIds.length = 0;
    createdSeasonIds.push(otherSeason.id);
  });

  // Test 3: cascade-delete blockers prevent deletion
  it("3. deletion blocked when TeamSeason references exist (cascade-delete blocker)", async () => {
    const base = randomBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    const team = await prisma.team.create({
      data: {
        name: `ADMIN-DELETE-SEASON-01 Test Team ${base}`,
        slug: `admin-delete-season-01-team-${base}`,
        category: "AKTIVE",
      },
    });
    createdTeamIds.push(team.id);

    await prisma.teamSeason.create({
      data: { teamId: team.id, seasonId: season.id, displayName: team.name },
    });

    await expect(deleteSeason(season.id)).rejects.toBeInstanceOf(SeasonHasDependenciesError);

    // Season still exists — not silently destroyed
    const stillExists = await prisma.season.findUnique({ where: { id: season.id } });
    expect(stillExists).not.toBeNull();

    // TeamSeason/Team still exist — canonical data preserved
    const teamStillExists = await prisma.team.findUnique({ where: { id: team.id } });
    expect(teamStillExists).not.toBeNull();
  });

  // hasSeasonDependencies: SetNull relations do NOT block
  it("hasSeasonDependencies: returns false when only SetNull relations (EventImportRun, OrgUnitMembership) are present", () => {
    // Direct unit test — no DB needed for this assertion
    const countsWithOnlySetNullDeps = {
      teamSeasons: 0,
      events: 0,
      eventImportRuns: 5,
      trainingPlans: 0,
      orgUnitMemberships: 3,
    };
    expect(hasSeasonDependencies(countsWithOnlySetNullDeps)).toBe(false);
  });

  it("hasSeasonDependencies: returns true when cascade-delete relations are non-zero (teamSeasons)", () => {
    expect(hasSeasonDependencies({ teamSeasons: 1, events: 0, eventImportRuns: 0, trainingPlans: 0, orgUnitMemberships: 0 })).toBe(true);
  });

  it("hasSeasonDependencies: returns true when cascade-delete relations are non-zero (events)", () => {
    expect(hasSeasonDependencies({ teamSeasons: 0, events: 2, eventImportRuns: 0, trainingPlans: 0, orgUnitMemberships: 0 })).toBe(true);
  });

  it("hasSeasonDependencies: returns true when cascade-delete relations are non-zero (trainingPlans)", () => {
    expect(hasSeasonDependencies({ teamSeasons: 0, events: 0, eventImportRuns: 0, trainingPlans: 1, orgUnitMemberships: 0 })).toBe(true);
  });

  it("hasSeasonDependencies: returns false when all counts are zero", () => {
    expect(hasSeasonDependencies({ teamSeasons: 0, events: 0, eventImportRuns: 0, trainingPlans: 0, orgUnitMemberships: 0 })).toBe(false);
  });

  // getSeasonDependencyCounts: returns all five counts
  it("getSeasonDependencyCounts returns all five dependency categories", async () => {
    const base = randomBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    const counts = await getSeasonDependencyCounts(season.id);
    expect(counts).toMatchObject({
      teamSeasons: expect.any(Number),
      events: expect.any(Number),
      eventImportRuns: expect.any(Number),
      trainingPlans: expect.any(Number),
      orgUnitMemberships: expect.any(Number),
    });
    // Freshly created season has zero references
    expect(counts.teamSeasons).toBe(0);
    expect(counts.events).toBe(0);
    expect(counts.trainingPlans).toBe(0);
  });
});
