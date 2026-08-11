/**
 * ADMIN-DELETE-SEASON-01 — focused Season delete tests.
 *
 * Updated for C1 (force/decouple): deletion is no longer blocked by deps.
 *
 * Covers the task-required test list items that need live DB validation:
 *   1. authorized user can permanently delete an unreferenced Season
 *   4. active Season can be deleted safely when otherwise deletable
 *   5. deleting active Season does not implicitly activate another
 *   hasSeasonDependencies: always returns false after C1
 *
 * See lib/seasons/__tests__/admin-delete-season-01-c1.test.ts for the full
 * C1 test suite (TeamSeason survival, Event/TrainingPlan SetNull, mixed deps).
 *
 * Requires a live PostgreSQL database (DATABASE_URL). Run against a
 * disposable database — never STAGE.
 */

import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { activateSeason, createSeason, deleteSeason } from "@/lib/seasons/mutations";
import { getSeasonDependencyCounts, hasSeasonDependencies } from "@/lib/seasons/queries";

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

  // Test 3 (C1 updated): TeamSeason references no longer block deletion
  it("3. Season with TeamSeason links can now be deleted — TeamSeason removed, Team survives (C1)", async () => {
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

    // C1: deletion succeeds even with TeamSeason links
    const result = await deleteSeason(season.id);
    expect(result.id).toBe(season.id);
    createdSeasonIds.length = 0;

    // Season is gone
    expect(await prisma.season.findUnique({ where: { id: season.id } })).toBeNull();

    // Team survives — canonical data preserved
    const teamAfter = await prisma.team.findUnique({ where: { id: team.id } });
    expect(teamAfter).not.toBeNull();

    // TeamSeason link was removed
    const tsAfter = await prisma.teamSeason.findFirst({ where: { teamId: team.id } });
    expect(tsAfter).toBeNull();
  });

  // hasSeasonDependencies: C1 — always returns false (no deps block deletion)
  it("hasSeasonDependencies: returns false for any counts (C1: all deps are safe-decouple)", () => {
    expect(hasSeasonDependencies({ teamSeasons: 3, events: 47, eventImportRuns: 5, trainingPlans: 2, orgUnitMemberships: 3 })).toBe(false);
    expect(hasSeasonDependencies({ teamSeasons: 1, events: 0, eventImportRuns: 0, trainingPlans: 0, orgUnitMemberships: 0 })).toBe(false);
    expect(hasSeasonDependencies({ teamSeasons: 0, events: 2, eventImportRuns: 0, trainingPlans: 0, orgUnitMemberships: 0 })).toBe(false);
    expect(hasSeasonDependencies({ teamSeasons: 0, events: 0, eventImportRuns: 0, trainingPlans: 1, orgUnitMemberships: 0 })).toBe(false);
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
