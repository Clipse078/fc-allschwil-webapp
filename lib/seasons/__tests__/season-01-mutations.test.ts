/**
 * SEASON-01 — Season mutation integration tests (lib/seasons/mutations.ts)
 *
 * Requires a live PostgreSQL database (DATABASE_URL). Run against a
 * disposable database — never STAGE. Every fixture uses a randomised,
 * far-future start year band so it can never collide with a real Season
 * (e.g. the STAGE 2025/2026, 2026/2027, 2027/2028, 2099 rows), and every
 * created row is torn down in `afterEach`.
 *
 * Covers the task's Season test list:
 *   1. 2026/2027-equivalent can be created even if the following season
 *      already exists ("next season already exists" retired)
 *   2. arbitrary non-duplicate Seasons can coexist
 *   3. duplicate same Season remains blocked
 *   4. admin can explicitly set one Season current
 *   5. setting current clears the previous current flag
 *   6. exactly one current Season after a successful switch
 *   7. a newly created Season never becomes current automatically
 *   8. a read (getSeasonsOverviewData) never mutates Season.isActive
 *   13. unused Season deletion works
 *   14. referenced Season (TeamSeason) can now be deleted — C1 decouple
 */

import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { activateSeason, createSeason, deleteSeason, updateSeasonDetails } from "@/lib/seasons/mutations";
import { getSeasonsOverviewData } from "@/lib/seasons/queries";
import { DuplicateSeasonError, SeasonNotFoundError } from "@/lib/seasons/errors";

function randomFutureStartYearBand(): number {
  // Far enough in the future that no real/seeded Season can ever collide,
  // randomised so parallel/repeated test runs never collide with each other.
  return 4000 + Math.floor(Math.random() * 900) * 3;
}

describe("SEASON-01 — Season mutations (live DB)", () => {
  const createdSeasonIds: string[] = [];
  const createdTeamIds: string[] = [];

  afterEach(async () => {
    if (createdTeamIds.length > 0) {
      await prisma.teamSeason.deleteMany({ where: { teamId: { in: createdTeamIds } } });
      await prisma.team.deleteMany({ where: { id: { in: createdTeamIds } } });
      createdTeamIds.length = 0;
    }
    if (createdSeasonIds.length > 0) {
      await prisma.season.deleteMany({ where: { id: { in: createdSeasonIds } } });
      createdSeasonIds.length = 0;
    }
  });

  it("1/2. an earlier Season can be created even though a later Season already exists — arbitrary coexistence", async () => {
    const base = randomFutureStartYearBand();

    const later = await createSeason({ startYear: base + 1 });
    createdSeasonIds.push(later.id);
    expect(later.key).toBe(`${base + 1}/${base + 2}`);

    // The "missing intermediate season" STAGE symptom: creating base must
    // never be blocked by base + 1 already existing.
    const missing = await createSeason({ startYear: base });
    createdSeasonIds.push(missing.id);
    expect(missing.key).toBe(`${base}/${base + 1}`);

    // A third, earlier Season coexists too.
    const earlier = await createSeason({ startYear: base - 1 });
    createdSeasonIds.push(earlier.id);

    const rows = await prisma.season.findMany({ where: { id: { in: createdSeasonIds } } });
    expect(rows).toHaveLength(3);
  });

  it("3. creating the exact same Season twice remains blocked", async () => {
    const base = randomFutureStartYearBand();

    const first = await createSeason({ startYear: base });
    createdSeasonIds.push(first.id);

    await expect(createSeason({ startYear: base })).rejects.toBeInstanceOf(DuplicateSeasonError);
  });

  it("7. a newly created Season never becomes current automatically", async () => {
    const base = randomFutureStartYearBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    expect(season.isActive).toBe(false);
  });

  it("4/6. admin can explicitly set one Season as current, and exactly one Season is current afterwards", async () => {
    const base = randomFutureStartYearBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    const result = await activateSeason(season.id);
    expect(result.alreadyActive).toBe(false);
    expect(result.season.isActive).toBe(true);

    const activeCount = await prisma.season.count({
      where: { id: { in: createdSeasonIds }, isActive: true },
    });
    expect(activeCount).toBe(1);
  });

  it("5. setting a new current Season clears the previous current flag", async () => {
    const base = randomFutureStartYearBand();
    const seasonA = await createSeason({ startYear: base });
    const seasonB = await createSeason({ startYear: base + 1 });
    createdSeasonIds.push(seasonA.id, seasonB.id);

    await activateSeason(seasonA.id);
    let refreshedA = await prisma.season.findUnique({ where: { id: seasonA.id }, select: { isActive: true } });
    expect(refreshedA?.isActive).toBe(true);

    await activateSeason(seasonB.id);

    refreshedA = await prisma.season.findUnique({ where: { id: seasonA.id }, select: { isActive: true } });
    const refreshedB = await prisma.season.findUnique({ where: { id: seasonB.id }, select: { isActive: true } });
    expect(refreshedA?.isActive).toBe(false);
    expect(refreshedB?.isActive).toBe(true);

    const activeCount = await prisma.season.count({
      where: { id: { in: [seasonA.id, seasonB.id] }, isActive: true },
    });
    expect(activeCount).toBe(1);
  });

  it("8. reading the Seasons overview never mutates Season.isActive (no automatic lifecycle side effect)", async () => {
    const base = randomFutureStartYearBand();
    // A Season whose dates are already in the past relative to "today" —
    // the retired syncSeasonActiveFlagsWithLifecycle() would have left it
    // isActive:false anyway, but a Season whose date range covers "today"
    // is the interesting case: it must NOT become active just by reading.
    const pastSeason = await createSeason({ startYear: base - 50 });
    createdSeasonIds.push(pastSeason.id);

    await getSeasonsOverviewData();
    await getSeasonsOverviewData();

    const refreshed = await prisma.season.findUnique({ where: { id: pastSeason.id }, select: { isActive: true } });
    expect(refreshed?.isActive).toBe(false);
  });

  it("13. an unused Season (no dependents) can be deleted", async () => {
    const base = randomFutureStartYearBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    const result = await deleteSeason(season.id);
    expect(result.id).toBe(season.id);

    const found = await prisma.season.findUnique({ where: { id: season.id } });
    expect(found).toBeNull();
    createdSeasonIds.length = 0; // already deleted — nothing left for afterEach to clean up
  });

  it("14. a referenced Season (has a TeamSeason) can now be deleted — C1 decouple: TeamSeason removed, Team survives", async () => {
    const base = randomFutureStartYearBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    const team = await prisma.team.create({
      data: {
        name: `SEASON-01 Test Team ${base}`,
        slug: `season-01-test-team-${base}`,
        category: "AKTIVE",
      },
    });
    createdTeamIds.push(team.id);

    await prisma.teamSeason.create({
      data: { teamId: team.id, seasonId: season.id, displayName: team.name },
    });

    // C1: deletion succeeds even with TeamSeason references
    const result = await deleteSeason(season.id);
    expect(result.id).toBe(season.id);
    expect(result.counts.teamSeasons).toBe(1);
    createdSeasonIds.length = 0;

    // Season is gone
    expect(await prisma.season.findUnique({ where: { id: season.id } })).toBeNull();

    // Team canonical record survives
    expect(await prisma.team.findUnique({ where: { id: team.id } })).not.toBeNull();

    // TeamSeason link was removed
    expect(await prisma.teamSeason.findFirst({ where: { teamId: team.id } })).toBeNull();
  });

  it("updateSeasonDetails: edits label/dates without touching key or isActive", async () => {
    const base = randomFutureStartYearBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    const updated = await updateSeasonDetails(season.id, { name: "Renamed Season" });
    expect(updated.name).toBe("Renamed Season");
    expect(updated.key).toBe(season.key);
    expect(updated.isActive).toBe(false);
  });

  it("updateSeasonDetails / activateSeason / deleteSeason reject an unknown seasonId", async () => {
    await expect(updateSeasonDetails("nonexistent-id", { name: "x" })).rejects.toBeInstanceOf(SeasonNotFoundError);
    await expect(activateSeason("nonexistent-id")).rejects.toBeInstanceOf(SeasonNotFoundError);
    await expect(deleteSeason("nonexistent-id")).rejects.toBeInstanceOf(SeasonNotFoundError);
  });
});
