/**
 * ADMIN-MASTERDATA-UX-01-C2 — Bulk Season Team rollover ("Teams übernehmen")
 * integration tests (live DB, disposable — never STAGE).
 *
 * Confirms the bulk action reuses the exact canonical registerTeamSeason()
 * primitive (lib/teams/team-registration-service.ts) once per selected
 * Team — never a parallel TeamSeason write path — and that:
 *
 *   1. multiple active Teams can be added to one Season in one operation
 *   2. existing Team records are reused (no new Team identity created)
 *   3. zero duplicate Team records are created
 *   4. a Team already registered is skipped/idempotent (ALREADY_PRESENT)
 *   5. repeated bulk action creates no duplicate TeamSeason
 *   6. historical TeamSeason rows are preserved untouched
 *   7. inactive/archived Teams are excluded from default candidates
 *   8. a cross-tenant Team is rejected, never written
 *   9. an arbitrary target Season works regardless of Season.isActive
 *  10. once the target Season becomes current, TrainingCenter immediately
 *      resolves the resulting TeamSeasons
 *
 * Single-Team registration (registerTeamSeason() called directly) is
 * covered separately by season-01-c1-team-rollover.test.ts and
 * team-registration-service.test.ts — not duplicated here.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { activateSeason, createSeason } from "@/lib/seasons/mutations";
import {
  bulkRegisterExistingTeamsForSeason,
  getBulkRolloverCandidateTeams,
  registerTeamSeason,
} from "@/lib/teams/team-registration-service";
import { findTeamSeasonsForTenant } from "@/lib/training/queries";
import { ParticipationType } from "@prisma/client";
import {
  assertSafeTestDatabase,
  canRunDbMutatingIntegrationTests,
} from "@/lib/test/safe-test-database";

const canRun = canRunDbMutatingIntegrationTests();

function randomFutureStartYearBand(): number {
  return 5500 + Math.floor(Math.random() * 900) * 3;
}

describe.skipIf(!canRun)(
  "ADMIN-MASTERDATA-UX-01-C2 — bulk Season Team rollover (isolated test DB)",
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

  it("1/2/3/4/5/6/7/8/9: bulk-registers several existing Teams for an arbitrary (non-current) Season, idempotently, tenant-isolated", async () => {
    const base = randomFutureStartYearBand();
    const suffix = `${base}`;

    const tenant = await prisma.tenant.create({
      data: { key: `c2-bulk-${suffix}`, name: `C2 Bulk Tenant ${suffix}` },
    });
    tenantIds.push(tenant.id);

    const otherTenant = await prisma.tenant.create({
      data: { key: `c2-other-${suffix}`, name: `C2 Other Tenant ${suffix}` },
    });
    tenantIds.push(otherTenant.id);

    const orgUnit = await prisma.orgUnit.create({
      data: { tenantId: tenant.id, key: `c2-org-${suffix}`, name: `C2 OrgUnit ${suffix}`, status: "ACTIVE" },
    });

    // Historical Season carrying each Team's OrgUnit assignment, which the
    // bulk action must carry over automatically (never re-asking for OrgUnits).
    const historicalSeason = await createSeason({ startYear: base - 1 });
    seasonIds.push(historicalSeason.id);

    const teamA = await prisma.team.create({
      data: { name: `C2 Team A ${suffix}`, slug: `c2-team-a-${suffix}`, category: "AKTIVE", tenantId: tenant.id, isActive: true },
    });
    teamIds.push(teamA.id);
    const teamB = await prisma.team.create({
      data: { name: `C2 Team B ${suffix}`, slug: `c2-team-b-${suffix}`, category: "AKTIVE", tenantId: tenant.id, isActive: true },
    });
    teamIds.push(teamB.id);

    // 7. Inactive/archived Team — must be excluded from default candidates.
    const archivedTeam = await prisma.team.create({
      data: { name: `C2 Archived Team ${suffix}`, slug: `c2-archived-${suffix}`, category: "AKTIVE", tenantId: tenant.id, isActive: false },
    });
    teamIds.push(archivedTeam.id);

    // 8. Cross-tenant Team — must be rejected, never written into this tenant's Season.
    const otherTenantTeam = await prisma.team.create({
      data: { name: `C2 Cross Tenant Team ${suffix}`, slug: `c2-cross-${suffix}`, category: "AKTIVE", tenantId: otherTenant.id, isActive: true },
    });
    teamIds.push(otherTenantTeam.id);

    const historicalTeamSeasonA = await prisma.teamSeason.create({
      data: { teamId: teamA.id, seasonId: historicalSeason.id, displayName: teamA.name, status: "ACTIVE" },
    });
    await prisma.teamSeasonOrgUnit.create({
      data: { tenantId: tenant.id, teamSeasonId: historicalTeamSeasonA.id, orgUnitId: orgUnit.id, isPrimary: true },
    });

    const historicalTeamSeasonB = await prisma.teamSeason.create({
      data: { teamId: teamB.id, seasonId: historicalSeason.id, displayName: teamB.name, status: "ACTIVE" },
    });
    await prisma.teamSeasonOrgUnit.create({
      data: { tenantId: tenant.id, teamSeasonId: historicalTeamSeasonB.id, orgUnitId: orgUnit.id, isPrimary: true },
    });

    // 9. Target Season is created but deliberately NOT activated yet — the
    //    bulk action must work regardless of Season.isActive.
    const targetSeason = await createSeason({ startYear: base });
    seasonIds.push(targetSeason.id);
    expect(targetSeason.isActive).toBe(false);

    // Candidate list: active, tenant-scoped, not yet registered for the target Season.
    const candidates = await getBulkRolloverCandidateTeams(tenant.id, targetSeason.id);
    const candidateIds = candidates.map((c) => c.id);
    expect(candidateIds).toContain(teamA.id);
    expect(candidateIds).toContain(teamB.id);
    expect(candidateIds).not.toContain(archivedTeam.id); // 7
    expect(candidateIds).not.toContain(otherTenantTeam.id); // tenant-scoped
    expect(candidates.find((c) => c.id === teamA.id)?.hasOrgUnitHistory).toBe(true);

    // 1/2/3/8: bulk-register teamA + teamB (existing Teams), reject archivedTeam
    // (inactive) and otherTenantTeam (cross-tenant) if explicitly requested.
    const bulkResult = await bulkRegisterExistingTeamsForSeason({
      tenantId: tenant.id,
      seasonId: targetSeason.id,
      teamIds: [teamA.id, teamB.id, archivedTeam.id, otherTenantTeam.id],
    });

    expect(bulkResult.createdCount).toBe(2);
    expect(bulkResult.rejectedCount).toBe(2);

    const outcomeByTeam = new Map(bulkResult.outcomes.map((o) => [o.teamId, o]));
    expect(outcomeByTeam.get(teamA.id)?.status).toBe("CREATED");
    expect(outcomeByTeam.get(teamB.id)?.status).toBe("CREATED");
    expect(outcomeByTeam.get(archivedTeam.id)?.status).toBe("REJECTED_INACTIVE");
    expect(outcomeByTeam.get(otherTenantTeam.id)?.status).toBe("REJECTED_TENANT_MISMATCH"); // 8

    // 2/3: no duplicate Team identity created — canonical Team IDs preserved.
    expect(await prisma.team.count({ where: { id: teamA.id } })).toBe(1);
    expect(await prisma.team.count({ where: { id: teamB.id } })).toBe(1);
    expect(await prisma.team.count({ where: { tenantId: tenant.id } })).toBe(3); // A, B, archived — no new rows

    const newTeamSeasonA = await prisma.teamSeason.findUnique({
      where: { teamId_seasonId: { teamId: teamA.id, seasonId: targetSeason.id } },
    });
    const newTeamSeasonB = await prisma.teamSeason.findUnique({
      where: { teamId_seasonId: { teamId: teamB.id, seasonId: targetSeason.id } },
    });
    expect(newTeamSeasonA).not.toBeNull();
    expect(newTeamSeasonB).not.toBeNull();
    expect(outcomeByTeam.get(teamA.id)?.teamSeasonId).toBe(newTeamSeasonA?.id);

    // 6. Historical TeamSeason rows are untouched.
    const historicalStillThereA = await prisma.teamSeason.findUnique({ where: { id: historicalTeamSeasonA.id } });
    expect(historicalStillThereA).not.toBeNull();
    expect(historicalStillThereA?.seasonId).toBe(historicalSeason.id);
    const historicalStillThereB = await prisma.teamSeason.findUnique({ where: { id: historicalTeamSeasonB.id } });
    expect(historicalStillThereB).not.toBeNull();
    expect(historicalStillThereB?.seasonId).toBe(historicalSeason.id);

    // 4/5: repeating the bulk action for the same Teams is idempotent — no
    //      duplicate TeamSeason rows, reported as ALREADY_PRESENT.
    const repeatResult = await bulkRegisterExistingTeamsForSeason({
      tenantId: tenant.id,
      seasonId: targetSeason.id,
      teamIds: [teamA.id, teamB.id],
    });
    expect(repeatResult.createdCount).toBe(0);
    expect(repeatResult.alreadyPresentCount).toBe(2);
    const repeatOutcomeByTeam = new Map(repeatResult.outcomes.map((o) => [o.teamId, o]));
    expect(repeatOutcomeByTeam.get(teamA.id)?.status).toBe("ALREADY_PRESENT");
    expect(repeatOutcomeByTeam.get(teamB.id)?.status).toBe("ALREADY_PRESENT");

    expect(
      await prisma.teamSeason.count({ where: { teamId: teamA.id, seasonId: targetSeason.id } }),
    ).toBe(1);
    expect(
      await prisma.teamSeason.count({ where: { teamId: teamB.id, seasonId: targetSeason.id } }),
    ).toBe(1);

    // Now the previously-registered Teams must no longer appear as candidates.
    const candidatesAfter = await getBulkRolloverCandidateTeams(tenant.id, targetSeason.id);
    expect(candidatesAfter.map((c) => c.id)).not.toContain(teamA.id);
    expect(candidatesAfter.map((c) => c.id)).not.toContain(teamB.id);

    // 10. Once the target Season becomes current, TrainingCenter immediately
    //     resolves the resulting TeamSeasons — no extra step needed.
    await activateSeason(targetSeason.id);
    const picker = await findTeamSeasonsForTenant(tenant.id);
    const pickerTeamIds = picker.map((p) => p.teamId);
    expect(pickerTeamIds).toContain(teamA.id);
    expect(pickerTeamIds).toContain(teamB.id);
    expect(picker.find((p) => p.teamId === teamA.id)?.id).toBe(newTeamSeasonA?.id);
    expect(picker.find((p) => p.teamId === teamB.id)?.id).toBe(newTeamSeasonB?.id);
  }, 30000);

  it("OrgUnit carry-over: only ACTIVE OrgUnits from the Team's own latest historical TeamSeason are copied — archived ones are excluded, multiple legitimate OrgUnits are preserved", async () => {
    const base = randomFutureStartYearBand();
    const suffix = `${base}-orgunit`;

    const tenant = await prisma.tenant.create({
      data: { key: `c2-orgunit-${suffix}`, name: `C2 OrgUnit Tenant ${suffix}` },
    });
    tenantIds.push(tenant.id);

    const activeOrgUnitOne = await prisma.orgUnit.create({
      data: { tenantId: tenant.id, key: `c2-ou-active-1-${suffix}`, name: `Active OrgUnit 1 ${suffix}`, status: "ACTIVE" },
    });
    const activeOrgUnitTwo = await prisma.orgUnit.create({
      data: { tenantId: tenant.id, key: `c2-ou-active-2-${suffix}`, name: `Active OrgUnit 2 ${suffix}`, status: "ACTIVE" },
    });
    const archivedOrgUnit = await prisma.orgUnit.create({
      data: { tenantId: tenant.id, key: `c2-ou-archived-${suffix}`, name: `Archived OrgUnit ${suffix}`, status: "ARCHIVED" },
    });

    const historicalSeason = await createSeason({ startYear: base - 1 });
    seasonIds.push(historicalSeason.id);

    const team = await prisma.team.create({
      data: { name: `C2 OrgUnit Team ${suffix}`, slug: `c2-ou-team-${suffix}`, category: "AKTIVE", tenantId: tenant.id, isActive: true },
    });
    teamIds.push(team.id);

    const historicalTeamSeason = await prisma.teamSeason.create({
      data: { teamId: team.id, seasonId: historicalSeason.id, displayName: team.name, status: "ACTIVE" },
    });
    // Two legitimate active OrgUnits + one archived one on the SAME historical TeamSeason.
    await prisma.teamSeasonOrgUnit.createMany({
      data: [
        { tenantId: tenant.id, teamSeasonId: historicalTeamSeason.id, orgUnitId: activeOrgUnitOne.id, isPrimary: true, displayOrder: 0 },
        { tenantId: tenant.id, teamSeasonId: historicalTeamSeason.id, orgUnitId: activeOrgUnitTwo.id, isPrimary: false, displayOrder: 1 },
        { tenantId: tenant.id, teamSeasonId: historicalTeamSeason.id, orgUnitId: archivedOrgUnit.id, isPrimary: false, displayOrder: 2 },
      ],
    });

    const targetSeason = await createSeason({ startYear: base });
    seasonIds.push(targetSeason.id);

    const bulkResult = await bulkRegisterExistingTeamsForSeason({
      tenantId: tenant.id,
      seasonId: targetSeason.id,
      teamIds: [team.id],
    });

    expect(bulkResult.outcomes[0].status).toBe("CREATED");
    const newTeamSeasonId = bulkResult.outcomes[0].teamSeasonId!;

    const carriedOrgUnits = await prisma.teamSeasonOrgUnit.findMany({
      where: { teamSeasonId: newTeamSeasonId },
      select: { orgUnitId: true },
    });
    const carriedOrgUnitIds = carriedOrgUnits.map((o) => o.orgUnitId);

    // Both active OrgUnits carried — multi-OrgUnit assignment preserved.
    expect(carriedOrgUnitIds).toContain(activeOrgUnitOne.id);
    expect(carriedOrgUnitIds).toContain(activeOrgUnitTwo.id);
    // Archived OrgUnit never copied.
    expect(carriedOrgUnitIds).not.toContain(archivedOrgUnit.id);
    expect(carriedOrgUnitIds).toHaveLength(2);
  });

  it("OrgUnit carry-over: a cross-tenant OrgUnit reachable only via drifted historical data is never copied, but the Team is still registered (SEASON-01-C3 best-effort carry-over)", async () => {
    const base = randomFutureStartYearBand();
    const suffix = `${base}-crossou`;

    const tenant = await prisma.tenant.create({
      data: { key: `c2-crossou-${suffix}`, name: `C2 CrossOU Tenant ${suffix}` },
    });
    tenantIds.push(tenant.id);

    const otherTenant = await prisma.tenant.create({
      data: { key: `c2-crossou-other-${suffix}`, name: `C2 CrossOU Other Tenant ${suffix}` },
    });
    tenantIds.push(otherTenant.id);

    // An OrgUnit that belongs to a DIFFERENT tenant than the Team below —
    // only reachable here by directly inserting a TeamSeasonOrgUnit row,
    // simulating drifted/legacy data. The canonical write path
    // (registerTeamSeason/writeTeamSeasonInTx) can never create this by
    // itself, since it always validates orgUnit.tenantId === tenantId first.
    const crossTenantOrgUnit = await prisma.orgUnit.create({
      data: { tenantId: otherTenant.id, key: `c2-crossou-ou-${suffix}`, name: `Cross Tenant OrgUnit ${suffix}`, status: "ACTIVE" },
    });

    const historicalSeason = await createSeason({ startYear: base - 1 });
    seasonIds.push(historicalSeason.id);

    const team = await prisma.team.create({
      data: { name: `C2 CrossOU Team ${suffix}`, slug: `c2-crossou-team-${suffix}`, category: "AKTIVE", tenantId: tenant.id, isActive: true },
    });
    teamIds.push(team.id);

    const historicalTeamSeason = await prisma.teamSeason.create({
      data: { teamId: team.id, seasonId: historicalSeason.id, displayName: team.name, status: "ACTIVE" },
    });
    await prisma.teamSeasonOrgUnit.create({
      data: { tenantId: tenant.id, teamSeasonId: historicalTeamSeason.id, orgUnitId: crossTenantOrgUnit.id, isPrimary: true },
    });

    const targetSeason = await createSeason({ startYear: base });
    seasonIds.push(targetSeason.id);

    const bulkResult = await bulkRegisterExistingTeamsForSeason({
      tenantId: tenant.id,
      seasonId: targetSeason.id,
      teamIds: [team.id],
    });

    // SEASON-01-C3: resolveCarryOverOrgUnitIds() is tenant-scoped, so the
    // drifted cross-tenant OrgUnit is never even offered to
    // registerTeamSeason() — it is simply excluded from carry-over, never
    // copied. The Team itself is still registered (best-effort OrgUnit
    // carry-over must never block a valid Team from joining the Season).
    expect(bulkResult.outcomes[0].status).toBe("CREATED");
    expect(bulkResult.outcomes[0].hasOrgUnit).toBe(false);
    const newTeamSeason = await prisma.teamSeason.findUnique({
      where: { teamId_seasonId: { teamId: team.id, seasonId: targetSeason.id } },
    });
    expect(newTeamSeason).not.toBeNull();

    // The cross-tenant OrgUnit is never persisted onto the new TeamSeason.
    const carriedOrgUnits = await prisma.teamSeasonOrgUnit.findMany({
      where: { teamSeasonId: newTeamSeason!.id },
    });
    expect(carriedOrgUnits).toHaveLength(0);
  });

  it("SEASON-01-C3: an active same-tenant Team with NO OrgUnit history at all is still registered (CREATED) with zero TeamSeasonOrgUnit rows, and is idempotent + visible in TrainingCenter once the Season is current", async () => {
    const base = randomFutureStartYearBand();
    const suffix = `${base}-noou`;

    const tenant = await prisma.tenant.create({
      data: { key: `c3-noou-${suffix}`, name: `C3 NoOrgUnit Tenant ${suffix}` },
    });
    tenantIds.push(tenant.id);

    // Never registered for any Season before — genuinely no OrgUnit history,
    // reproducing the exact STAGE defect (FCA Teams with
    // "keine Organisationseinheit übernehmbar").
    const team = await prisma.team.create({
      data: {
        name: `C3 No OrgUnit Team ${suffix}`,
        slug: `c3-no-ou-team-${suffix}`,
        category: "AKTIVE",
        tenantId: tenant.id,
        isActive: true,
      },
    });
    teamIds.push(team.id);

    const targetSeason = await createSeason({ startYear: base });
    seasonIds.push(targetSeason.id);

    // Candidate list still offers the Team (OrgUnit history is informational
    // only, never an eligibility gate — SEASON-01-C3).
    const candidates = await getBulkRolloverCandidateTeams(tenant.id, targetSeason.id);
    const candidate = candidates.find((c) => c.id === team.id);
    expect(candidate).toBeDefined();
    expect(candidate?.hasOrgUnitHistory).toBe(false);

    const bulkResult = await bulkRegisterExistingTeamsForSeason({
      tenantId: tenant.id,
      seasonId: targetSeason.id,
      teamIds: [team.id],
    });

    // 1. The Team is CREATED, never skipped, despite zero OrgUnit history.
    expect(bulkResult.createdCount).toBe(1);
    expect(bulkResult.outcomes[0].status).toBe("CREATED");
    expect(bulkResult.outcomes[0].hasOrgUnit).toBe(false);
    const teamSeasonId = bulkResult.outcomes[0].teamSeasonId!;
    expect(teamSeasonId).toBeTruthy();

    const teamSeason = await prisma.teamSeason.findUnique({ where: { id: teamSeasonId } });
    expect(teamSeason).not.toBeNull();
    expect(teamSeason?.teamId).toBe(team.id);
    expect(teamSeason?.seasonId).toBe(targetSeason.id);

    // 2. Zero TeamSeasonOrgUnit rows are created for this TeamSeason.
    const orgUnitRows = await prisma.teamSeasonOrgUnit.findMany({ where: { teamSeasonId } });
    expect(orgUnitRows).toHaveLength(0);

    // 10. Existing Team identity unchanged — no new Team created.
    expect(await prisma.team.count({ where: { id: team.id } })).toBe(1);

    // 9. Repeated bulk run creates no duplicate TeamSeason — idempotent.
    const repeatResult = await bulkRegisterExistingTeamsForSeason({
      tenantId: tenant.id,
      seasonId: targetSeason.id,
      teamIds: [team.id],
    });
    expect(repeatResult.outcomes[0].status).toBe("ALREADY_PRESENT");
    expect(
      await prisma.teamSeason.count({ where: { teamId: team.id, seasonId: targetSeason.id } }),
    ).toBe(1);

    // 12. TrainingCenter picker includes the no-OrgUnit Team once the target
    //     Season becomes current — no logout/login, no fallback, no fake
    //     OrgUnit assignment.
    await activateSeason(targetSeason.id);
    const picker = await findTeamSeasonsForTenant(tenant.id);
    expect(picker.map((p) => p.teamId)).toContain(team.id);
    expect(picker.find((p) => p.teamId === team.id)?.id).toBe(teamSeasonId);
  }, 20000);

  it("11. existing single-Team registration (registerTeamSeason) remains fully functional after the bulk addition", async () => {
    const base = randomFutureStartYearBand();
    const suffix = `${base}-single`;

    const tenant = await prisma.tenant.create({
      data: { key: `c2-single-${suffix}`, name: `C2 Single Tenant ${suffix}` },
    });
    tenantIds.push(tenant.id);

    const orgUnit = await prisma.orgUnit.create({
      data: { tenantId: tenant.id, key: `c2-single-org-${suffix}`, name: `C2 Single OrgUnit ${suffix}`, status: "ACTIVE" },
    });

    const season = await createSeason({ startYear: base });
    seasonIds.push(season.id);

    const result = await registerTeamSeason({
      tenantId: tenant.id,
      seasonId: season.id,
      orgUnitIds: [orgUnit.id],
      team: { name: `C2 Fresh Team ${suffix}` },
      participationType: ParticipationType.TRAINING,
      websiteVisible: true,
      infoboardVisible: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    teamIds.push(result.teamId);
    expect(result.createdTeamIdentity).toBe(true);
  });
});
