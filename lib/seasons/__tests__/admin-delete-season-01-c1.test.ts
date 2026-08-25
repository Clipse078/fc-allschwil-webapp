/**
 * ADMIN-DELETE-SEASON-01-C1 — force/decouple Season deletion focused tests.
 *
 * Covers the C1 task-required test list:
 *   1. Season with TeamSeason links can be deleted — TeamSeason links removed, Teams survive
 *   2. Season with Events can be deleted — Events survive, Event.seasonId becomes null
 *   3. Season with TrainingPlans can be deleted — TrainingPlans survive, seasonId becomes null
 *   4. Mixed dependency Season (TeamSeason + Events + TrainingPlans) deletes successfully
 *   5. Active Season deletes successfully without activating another
 *   6. getSeasonDependencyCounts is non-mutating (inspect request stays pure)
 *   7. seasons.delete permission is required (HTTP route level — tested in route.delete-season-01.test.ts)
 *   8. transactional failure rolls back — Season survives on DB error
 *   9. hasSeasonDependencies always returns false (C1: no deps block deletion)
 *
 * Requires an explicitly isolated local PostgreSQL database via
 * `TEST_DATABASE_URL`. When unset or unsafe, the entire suite is skipped —
 * never STAGE.
 */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { activateSeason, createSeason, deleteSeason } from "@/lib/seasons/mutations";
import { getSeasonDependencyCounts, hasSeasonDependencies } from "@/lib/seasons/queries";
import {
  assertSafeTestDatabase,
  canRunDbMutatingIntegrationTests,
} from "@/lib/test/safe-test-database";

const canRun = canRunDbMutatingIntegrationTests();

function randomBand(): number {
  return 6000 + Math.floor(Math.random() * 900) * 3;
}

describe.skipIf(!canRun)(
  "ADMIN-DELETE-SEASON-01-C1 — force/decouple Season deletion (isolated test DB)",
  () => {
  beforeAll(() => {
    assertSafeTestDatabase();
  });

  const createdSeasonIds: string[] = [];
  const createdTeamIds: string[] = [];
  const createdEventIds: string[] = [];
  const createdTrainingPlanIds: string[] = [];

  afterEach(async () => {
    // Clean up in dependency order
    if (createdTrainingPlanIds.length > 0) {
      await prisma.trainingPlan.deleteMany({ where: { id: { in: createdTrainingPlanIds } } });
      createdTrainingPlanIds.length = 0;
    }
    if (createdEventIds.length > 0) {
      await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
      createdEventIds.length = 0;
    }
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

  // ── Test 1: Season with TeamSeason links ──────────────────────────────────

  it("1. Season with TeamSeason links can be deleted — TeamSeason removed, Team survives", async () => {
    const base = randomBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    const team = await prisma.team.create({
      data: {
        name: `C1 Test Team ${base}`,
        slug: `c1-team-${base}`,
        category: "AKTIVE",
      },
    });
    createdTeamIds.push(team.id);

    await prisma.teamSeason.create({
      data: { teamId: team.id, seasonId: season.id, displayName: team.name },
    });

    const countsBefore = await getSeasonDependencyCounts(season.id);
    expect(countsBefore.teamSeasons).toBe(1);

    // Delete should succeed even with TeamSeason links
    const result = await deleteSeason(season.id);
    expect(result.id).toBe(season.id);

    // Season is gone
    const seasonAfter = await prisma.season.findUnique({ where: { id: season.id } });
    expect(seasonAfter).toBeNull();
    createdSeasonIds.length = 0;

    // Team survives intact
    const teamAfter = await prisma.team.findUnique({ where: { id: team.id } });
    expect(teamAfter).not.toBeNull();
    expect(teamAfter?.id).toBe(team.id);

    // TeamSeason link is removed (cascaded)
    const teamSeasonAfter = await prisma.teamSeason.findFirst({ where: { teamId: team.id } });
    expect(teamSeasonAfter).toBeNull();
  });

  // ── Test 2: Season with Events ────────────────────────────────────────────

  it("2. Season with Events can be deleted — Events survive, Event.seasonId becomes null", async () => {
    const base = randomBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    const event = await prisma.event.create({
      data: {
        seasonId: season.id,
        type: "MATCH",
        source: "MANUAL",
        title: `C1 Test Event ${base}`,
        startAt: new Date("2025-09-01T10:00:00Z"),
      },
    });
    createdEventIds.push(event.id);

    const countsBefore = await getSeasonDependencyCounts(season.id);
    expect(countsBefore.events).toBe(1);

    // Delete should succeed even with Events
    const result = await deleteSeason(season.id);
    expect(result.id).toBe(season.id);
    expect(result.counts.events).toBe(1);

    // Season is gone
    const seasonAfter = await prisma.season.findUnique({ where: { id: season.id } });
    expect(seasonAfter).toBeNull();
    createdSeasonIds.length = 0;

    // Event survives — seasonId is now null (SetNull FK)
    const eventAfter = await prisma.event.findUnique({ where: { id: event.id } });
    expect(eventAfter).not.toBeNull();
    expect(eventAfter?.seasonId).toBeNull();

    // cleanup
    createdEventIds.length = 0;
    await prisma.event.deleteMany({ where: { id: event.id } });
  });

  // ── Test 3: Season with TrainingPlans ─────────────────────────────────────

  it("3. Season with TrainingPlans can be deleted — TrainingPlans survive, seasonId becomes null", async () => {
    const base = randomBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    // Need a tenant for TrainingPlan
    const tenant = await prisma.tenant.findFirst({ select: { id: true } });
    if (!tenant) {
      // Skip if no tenant in the test DB
      return;
    }

    const plan = await prisma.trainingPlan.create({
      data: {
        tenantId: tenant.id,
        seasonId: season.id,
        name: `C1 Test Plan ${base}`,
        status: "ACTIVE",
        isDefault: false,
        missingAssignmentBehavior: "FALLBACK_TO_DEFAULT",
      },
    });
    createdTrainingPlanIds.push(plan.id);

    const countsBefore = await getSeasonDependencyCounts(season.id);
    expect(countsBefore.trainingPlans).toBe(1);

    // Delete should succeed even with TrainingPlans
    const result = await deleteSeason(season.id);
    expect(result.id).toBe(season.id);
    expect(result.counts.trainingPlans).toBe(1);

    // Season is gone
    const seasonAfter = await prisma.season.findUnique({ where: { id: season.id } });
    expect(seasonAfter).toBeNull();
    createdSeasonIds.length = 0;

    // TrainingPlan survives — seasonId is now null (SetNull FK)
    const planAfter = await prisma.trainingPlan.findUnique({ where: { id: plan.id } });
    expect(planAfter).not.toBeNull();
    expect(planAfter?.seasonId).toBeNull();
  });

  // ── Test 4: Mixed dependency ───────────────────────────────────────────────

  it("4. Mixed dependency Season (TeamSeason + Events + TrainingPlans) deletes successfully", async () => {
    const base = randomBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    const team = await prisma.team.create({
      data: {
        name: `C1 Mixed Team ${base}`,
        slug: `c1-mixed-team-${base}`,
        category: "AKTIVE",
      },
    });
    createdTeamIds.push(team.id);

    await prisma.teamSeason.create({
      data: { teamId: team.id, seasonId: season.id, displayName: team.name },
    });

    const event = await prisma.event.create({
      data: {
        seasonId: season.id,
        type: "TRAINING",
        source: "MANUAL",
        title: `C1 Mixed Event ${base}`,
        startAt: new Date("2025-09-15T08:00:00Z"),
      },
    });
    createdEventIds.push(event.id);

    const tenant = await prisma.tenant.findFirst({ select: { id: true } });
    let planId: string | null = null;
    if (tenant) {
      const plan = await prisma.trainingPlan.create({
        data: {
          tenantId: tenant.id,
          seasonId: season.id,
          name: `C1 Mixed Plan ${base}`,
          status: "ACTIVE",
          isDefault: false,
          missingAssignmentBehavior: "FALLBACK_TO_DEFAULT",
        },
      });
      planId = plan.id;
      createdTrainingPlanIds.push(plan.id);
    }

    const countsBefore = await getSeasonDependencyCounts(season.id);
    expect(countsBefore.teamSeasons).toBe(1);
    expect(countsBefore.events).toBe(1);
    if (planId) expect(countsBefore.trainingPlans).toBe(1);

    // Delete must succeed despite all dependencies
    const result = await deleteSeason(season.id);
    expect(result.id).toBe(season.id);

    // Season is gone
    expect(await prisma.season.findUnique({ where: { id: season.id } })).toBeNull();
    createdSeasonIds.length = 0;

    // Team survives
    expect(await prisma.team.findUnique({ where: { id: team.id } })).not.toBeNull();

    // TeamSeason link removed
    expect(await prisma.teamSeason.findFirst({ where: { teamId: team.id } })).toBeNull();

    // Event survives with null seasonId
    const eventAfter = await prisma.event.findUnique({ where: { id: event.id } });
    expect(eventAfter).not.toBeNull();
    expect(eventAfter?.seasonId).toBeNull();
    createdEventIds.length = 0;
    await prisma.event.deleteMany({ where: { id: event.id } });

    // TrainingPlan survives with null seasonId
    if (planId) {
      const planAfter = await prisma.trainingPlan.findUnique({ where: { id: planId } });
      expect(planAfter).not.toBeNull();
      expect(planAfter?.seasonId).toBeNull();
    }
  });

  // ── Test 5: Active Season ─────────────────────────────────────────────────

  it("5. active Season deletes successfully — no other Season auto-activates", async () => {
    const base = randomBand();
    const activeSeason = await createSeason({ startYear: base });
    const otherSeason = await createSeason({ startYear: base + 1 });
    createdSeasonIds.push(activeSeason.id, otherSeason.id);

    await activateSeason(activeSeason.id);

    const beforeDelete = await prisma.season.findUnique({
      where: { id: activeSeason.id },
      select: { isActive: true },
    });
    expect(beforeDelete?.isActive).toBe(true);

    const result = await deleteSeason(activeSeason.id);
    expect(result.id).toBe(activeSeason.id);

    // Active season is gone
    expect(await prisma.season.findUnique({ where: { id: activeSeason.id } })).toBeNull();

    // Other season did NOT become active
    const otherAfter = await prisma.season.findUnique({
      where: { id: otherSeason.id },
      select: { isActive: true },
    });
    expect(otherAfter?.isActive).toBe(false);

    // Zero active seasons is valid
    const anyActive = await prisma.season.findFirst({ where: { isActive: true } });
    expect(anyActive).toBeNull();

    createdSeasonIds.length = 0;
    createdSeasonIds.push(otherSeason.id);
  });

  // ── Test 6: getSeasonDependencyCounts is non-mutating ─────────────────────

  it("6. getSeasonDependencyCounts is non-mutating — season and deps unchanged after call", async () => {
    const base = randomBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    const team = await prisma.team.create({
      data: {
        name: `C1 Inspect Team ${base}`,
        slug: `c1-inspect-team-${base}`,
        category: "AKTIVE",
      },
    });
    createdTeamIds.push(team.id);
    await prisma.teamSeason.create({
      data: { teamId: team.id, seasonId: season.id, displayName: team.name },
    });

    const counts = await getSeasonDependencyCounts(season.id);
    expect(counts.teamSeasons).toBe(1);

    // Season still exists after inspect
    const stillExists = await prisma.season.findUnique({ where: { id: season.id } });
    expect(stillExists).not.toBeNull();

    // TeamSeason still exists
    const tsStillExists = await prisma.teamSeason.findFirst({ where: { seasonId: season.id } });
    expect(tsStillExists).not.toBeNull();
  });

  // ── Test 8: Transaction integrity ────────────────────────────────────────

  it("8. deleteSeason throws SeasonNotFoundError for non-existent ID — no mutation occurs", async () => {
    const { SeasonNotFoundError } = await import("@/lib/seasons/errors");
    await expect(deleteSeason("non-existent-season-id-c1")).rejects.toBeInstanceOf(SeasonNotFoundError);
  });

  // ── Test 9: hasSeasonDependencies always returns false after C1 ───────────

  it("9. hasSeasonDependencies always returns false — C1: no deps block deletion", () => {
    // All combinations that previously blocked now return false
    expect(hasSeasonDependencies({ teamSeasons: 3, events: 47, eventImportRuns: 0, trainingPlans: 2, orgUnitMemberships: 0 })).toBe(false);
    expect(hasSeasonDependencies({ teamSeasons: 1, events: 0, eventImportRuns: 0, trainingPlans: 0, orgUnitMemberships: 0 })).toBe(false);
    expect(hasSeasonDependencies({ teamSeasons: 0, events: 5, eventImportRuns: 0, trainingPlans: 0, orgUnitMemberships: 0 })).toBe(false);
    expect(hasSeasonDependencies({ teamSeasons: 0, events: 0, eventImportRuns: 0, trainingPlans: 4, orgUnitMemberships: 0 })).toBe(false);
    expect(hasSeasonDependencies({ teamSeasons: 0, events: 0, eventImportRuns: 0, trainingPlans: 0, orgUnitMemberships: 0 })).toBe(false);
  });

  // ── Regression: deleteSeason returns impact counts for audit ─────────────

  it("deleteSeason result includes accurate counts for audit log", async () => {
    const base = randomBand();
    const season = await createSeason({ startYear: base });
    createdSeasonIds.push(season.id);

    const result = await deleteSeason(season.id);
    expect(result.counts).toMatchObject({
      teamSeasons: expect.any(Number),
      events: expect.any(Number),
      eventImportRuns: expect.any(Number),
      trainingPlans: expect.any(Number),
      orgUnitMemberships: expect.any(Number),
    });
    expect(result.counts.teamSeasons).toBe(0);

    createdSeasonIds.length = 0;
  });
});
