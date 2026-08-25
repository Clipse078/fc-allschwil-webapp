/**
 * ADMIN-MASTERDATA-UX-01-C1 (Part B) — Season Team rollover / materialization
 * integration tests (live DB, disposable — never STAGE).
 *
 * Confirms the EXISTING canonical "Team season rollover" mechanism —
 * registerTeamSeason() with `existingTeamId` set (lib/teams/team-registration-service.ts),
 * reachable via the Team registration wizard's "reuse existing Team" flow
 * at /dashboard/teams/register — already fully supports carrying an
 * active Team into a newly-created/activated Season, with no lifecycle
 * or current-season restriction to remove. No second/parallel rollover
 * engine is introduced anywhere in this suite.
 *
 * Covers the task's C1-B test list:
 *   10. existing active Team can be rolled into the new Season using the
 *       canonical existing season-change mechanism
 *   11. no duplicate Team created
 *   12. historical TeamSeason preserved
 *   13. resulting current TeamSeason resolves through currentTeamSeasonWhere()
 *   14. TrainingCenter picker sees the rolled Team immediately
 *   15. archived/inactive Team follows existing rollover eligibility rules
 *   16. repeated rollover does not duplicate TeamSeason
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { activateSeason, createSeason } from "@/lib/seasons/mutations";
import { registerTeamSeason, getExistingTeamsForTenant } from "@/lib/teams/team-registration-service";
import { getEligibleOrgUnitsForTeamSeason } from "@/lib/teams/team-season-service";
import { findTeamSeasonsForTenant } from "@/lib/training/queries";
import { currentTeamSeasonWhere, pickCurrentTeamSeason } from "@/lib/teams/current-season";
import { ParticipationType } from "@prisma/client";
import {
  assertSafeTestDatabase,
  canRunDbMutatingIntegrationTests,
} from "@/lib/test/safe-test-database";

const canRun = canRunDbMutatingIntegrationTests();

function randomFutureStartYearBand(): number {
  return 4500 + Math.floor(Math.random() * 900) * 3;
}

describe.skipIf(!canRun)(
  "ADMIN-MASTERDATA-UX-01-C1 — Season Team rollover (isolated test DB)",
  () => {
  beforeAll(() => {
    assertSafeTestDatabase();
  });

  const tenantIds: string[] = [];
  const seasonIds: string[] = [];
  const teamIds: string[] = [];

  afterAll(async () => {
    if (teamIds.length > 0) {
      await prisma.teamSeasonOrgUnit.deleteMany({ where: { teamSeason: { teamId: { in: teamIds } } } });
      await prisma.teamSeason.deleteMany({ where: { teamId: { in: teamIds } } });
      await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    }
    if (seasonIds.length > 0) {
      await prisma.season.deleteMany({ where: { id: { in: seasonIds } } });
    }
    if (tenantIds.length > 0) {
      await prisma.orgUnit.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await prisma.$disconnect();
  });

  it("10/11/12/13/14/16: rolls an existing active Team into the new current Season via the canonical registration mechanism", async () => {
    const base = randomFutureStartYearBand();
    const suffix = `${base}`;

    const tenant = await prisma.tenant.create({
      data: { key: `c1-rollover-${suffix}`, name: `C1 Rollover Tenant ${suffix}` },
    });
    tenantIds.push(tenant.id);

    const orgUnit = await prisma.orgUnit.create({
      data: { tenantId: tenant.id, key: `c1-org-${suffix}`, name: `C1 OrgUnit ${suffix}`, status: "ACTIVE" },
    });

    // Historical Season with an existing TeamSeason for the same Team.
    const historicalSeason = await createSeason({ startYear: base - 1 });
    seasonIds.push(historicalSeason.id);

    const team = await prisma.team.create({
      data: {
        name: `C1 Active Team ${suffix}`,
        slug: `c1-active-team-${suffix}`,
        category: "AKTIVE",
        tenantId: tenant.id,
        isActive: true,
      },
    });
    teamIds.push(team.id);

    const historicalTeamSeason = await prisma.teamSeason.create({
      data: { teamId: team.id, seasonId: historicalSeason.id, displayName: team.name, status: "ACTIVE" },
    });

    // The STAGE scenario: create + activate the missing "new current" Season.
    const currentSeason = await createSeason({ startYear: base });
    seasonIds.push(currentSeason.id);
    await activateSeason(currentSeason.id);

    // Eligible existing Team offered by the wizard (never re-created).
    const existingTeams = await getExistingTeamsForTenant(tenant.id);
    expect(existingTeams.map((t) => t.id)).toContain(team.id);

    const orgUnits = await getEligibleOrgUnitsForTeamSeason(tenant.id);
    expect(orgUnits.map((o) => o.id)).toContain(orgUnit.id);

    // 10. Canonical rollover: reuse the existing Team (existingTeamId), no
    //     new Team identity created, for the new current Season.
    const result = await registerTeamSeason({
      tenantId: tenant.id,
      seasonId: currentSeason.id,
      orgUnitIds: [orgUnit.id],
      existingTeamId: team.id,
      team: { name: team.name },
      participationType: ParticipationType.TRAINING,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 11. No duplicate Team created.
    expect(result.createdTeamIdentity).toBe(false);
    expect(result.teamId).toBe(team.id);
    const teamCount = await prisma.team.count({ where: { id: team.id } });
    expect(teamCount).toBe(1);

    // 12. Historical TeamSeason preserved, untouched.
    const historicalStillThere = await prisma.teamSeason.findUnique({ where: { id: historicalTeamSeason.id } });
    expect(historicalStillThere).not.toBeNull();
    expect(historicalStillThere?.seasonId).toBe(historicalSeason.id);

    // 13. Resolves through the canonical currentTeamSeasonWhere() resolver.
    const teamWithSeasons = await prisma.team.findUnique({
      where: { id: team.id },
      select: {
        teamSeasons: {
          where: { ...currentTeamSeasonWhere() },
          select: { id: true, season: { select: { key: true, isActive: true } } },
        },
      },
    });
    expect(teamWithSeasons?.teamSeasons).toHaveLength(1);
    expect(teamWithSeasons?.teamSeasons[0].id).toBe(result.teamSeasonId);

    const allTeamSeasons = await prisma.teamSeason.findMany({
      where: { teamId: team.id },
      select: { id: true, season: { select: { key: true, isActive: true } } },
    });
    expect(pickCurrentTeamSeason(allTeamSeasons)?.id).toBe(result.teamSeasonId);
    // No historical fallback: the historical TeamSeason is present but not picked.
    expect(allTeamSeasons.map((ts) => ts.id)).toContain(historicalTeamSeason.id);

    // 14. TrainingCenter picker sees the rolled Team immediately — no
    //     dependency on visiting the Seasons admin page.
    const picker = await findTeamSeasonsForTenant(tenant.id);
    expect(picker.map((p) => p.id)).toContain(result.teamSeasonId);
    expect(picker.find((p) => p.id === result.teamSeasonId)?.teamId).toBe(team.id);

    // 16. Repeated rollover for the same Team + Season is rejected, not duplicated.
    const repeat = await registerTeamSeason({
      tenantId: tenant.id,
      seasonId: currentSeason.id,
      orgUnitIds: [orgUnit.id],
      existingTeamId: team.id,
      team: { name: team.name },
      participationType: ParticipationType.TRAINING,
    });
    expect(repeat.ok).toBe(false);
    if (!repeat.ok) expect(repeat.code).toBe("TEAM_SEASON_ALREADY_EXISTS");

    const teamSeasonRowsForCurrentSeason = await prisma.teamSeason.count({
      where: { teamId: team.id, seasonId: currentSeason.id },
    });
    expect(teamSeasonRowsForCurrentSeason).toBe(1);
  }, 20000);

  it("15. an archived/inactive Team is excluded from the existing-team rollover list and from the TrainingCenter picker", async () => {
    const base = randomFutureStartYearBand();
    const suffix = `${base}-archived`;

    const tenant = await prisma.tenant.create({
      data: { key: `c1-archived-${suffix}`, name: `C1 Archived Tenant ${suffix}` },
    });
    tenantIds.push(tenant.id);

    const currentSeason = await createSeason({ startYear: base });
    seasonIds.push(currentSeason.id);
    await activateSeason(currentSeason.id);

    const archivedTeam = await prisma.team.create({
      data: {
        name: `C1 Archived Team ${suffix}`,
        slug: `c1-archived-team-${suffix}`,
        category: "AKTIVE",
        tenantId: tenant.id,
        isActive: false,
      },
    });
    teamIds.push(archivedTeam.id);

    // Existing eligibility rule (unchanged): archived Teams are simply
    // never offered by the "reuse existing Team" list.
    const existingTeams = await getExistingTeamsForTenant(tenant.id);
    expect(existingTeams.map((t) => t.id)).not.toContain(archivedTeam.id);

    // Even if a TeamSeason existed for it (e.g. created before archival),
    // the TrainingCenter picker still excludes it via team.isActive.
    await prisma.teamSeason.create({
      data: { teamId: archivedTeam.id, seasonId: currentSeason.id, displayName: archivedTeam.name, status: "ACTIVE" },
    });

    const picker = await findTeamSeasonsForTenant(tenant.id);
    expect(picker.find((p) => p.teamId === archivedTeam.id)).toBeUndefined();
  });
});
