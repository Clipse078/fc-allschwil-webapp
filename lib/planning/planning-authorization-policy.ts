/**
 * ORG-ACCESS-03 — Planning Family Scoped Write Access
 *
 * Shared authorization policy for TrainingCenter, MatchCenter, and
 * TournamentCenter. Enforces:
 *
 *   READ BROADLY → WRITE NARROWLY → VALIDATE CENTRALLY
 *
 * ── Canonical Principle ────────────────────────────────────────────────────────
 * OrgUnit scope controls WRITE capability only. It does NOT filter normal
 * Center visibility. A user with the appropriate VIEW permission continues
 * to see tenant-wide Center data.
 *
 * ── Authorization Logic ────────────────────────────────────────────────────────
 * Write capability is determined by:
 *   1. Tenant-wide permission (coordinator / Club Admin) → always allowed,
 *      records are coordinator-authoritative (APPROVED).
 *   2. OrgUnit-scoped permission for the team's canonical OrgUnit →
 *      allowed with DRAFT initial stage; scoped to writable teams only.
 *   3. No matching permission or scope → denied.
 *
 * ── Team → OrgUnit Resolution ─────────────────────────────────────────────────
 * Uses the canonical ORG-ACCESS-02 chain:
 *   Team → TeamSeason (current) → primary TeamSeasonOrgUnit → OrgUnit
 * with legacy fallback: Team.orgUnitId where the TeamSeasonOrgUnit chain
 * yields no result.
 *
 * ── SFV / Provider Protection ─────────────────────────────────────────────────
 * Scoped users can only create/edit MANUAL source records. SFV, CLUBCORNER_FVNWS,
 * and CSV_EXCEL_IMPORT records are never editable by scoped users regardless
 * of team scope or planning stage.
 *
 * ── Domains ───────────────────────────────────────────────────────────────────
 * "training"   → TRAININGS_MANAGE
 * "match"      → EVENTS_MANAGE
 * "tournament" → EVENTS_MANAGE
 *
 * ── No Second Authorization System ───────────────────────────────────────────
 * Reuses OrgUnitPermissionResolver (ORG-ACCESS-01) and EffectivePermissionResolver
 * (RPERM-03/04). Does NOT check literal role names.
 */

import type { PrismaClient } from "@prisma/client";
import { createOrgUnitPermissionResolver } from "@/lib/permissions/services/org-unit-permission-resolver";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { PERMISSIONS } from "@/lib/permissions/permissions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanningDomain = "training" | "match" | "tournament";

/** Protected source values that scoped users may never mutate. */
const PROTECTED_SOURCES = new Set(["SFV", "CLUBCORNER_FVNWS", "CSV_EXCEL_IMPORT"]);

export interface PlanningRecord {
  /** Team the record belongs to. Null means no team assignment. */
  teamId: string | null;
  /** Planning/review workflow stage of the record. */
  planningStage: string;
  /** Source that produced the record. Required for Match (SFV protection). */
  source?: string | null;
}

export interface CanCreateResult {
  /** Whether the user may create this record. */
  allowed: boolean;
  /** True if the user holds tenant-wide permission (coordinator path). */
  isCoordinator: boolean;
  /** True if access was granted via OrgUnit scope (scoped path). */
  isScoped: boolean;
  /** Human-readable reason when denied. */
  reason?: string;
}

interface PlanningContext {
  userId: string;
  tenantId: string;
}

// ---------------------------------------------------------------------------
// Domain → permission key mapping
// ---------------------------------------------------------------------------

function permissionForDomain(domain: PlanningDomain): string {
  if (domain === "training") return PERMISSIONS.TRAININGS_MANAGE;
  return PERMISSIONS.EVENTS_MANAGE;
}

// ---------------------------------------------------------------------------
// PlanningAuthorizationPolicy
// ---------------------------------------------------------------------------

export class PlanningAuthorizationPolicy {
  private readonly orgUnitResolver;
  private readonly effectiveResolver;

  constructor(private readonly prisma: PrismaClient) {
    this.orgUnitResolver = createOrgUnitPermissionResolver(prisma);
    this.effectiveResolver = createEffectivePermissionResolver(prisma);
  }

  // ── Team → OrgUnit resolution ──────────────────────────────────────────────

  /**
   * Resolves the canonical OrgUnit for the given team in the given tenant.
   *
   * Chain: current-season primary TeamSeasonOrgUnit → legacy Team.orgUnitId.
   * Returns null when the team has no OrgUnit assignment or belongs to a
   * different tenant.
   */
  async resolveTeamOrgUnit(teamId: string, tenantId: string): Promise<string | null> {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tenantId },
      select: {
        orgUnitId: true,
        teamSeasons: {
          where: { season: { isActive: true } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            orgUnits: {
              where: { isPrimary: true },
              take: 1,
              select: { orgUnitId: true },
            },
          },
        },
      },
    });

    if (!team) return null;

    // Canonical: current-season primary TeamSeasonOrgUnit
    const currentSeasonOrgUnitId = team.teamSeasons[0]?.orgUnits[0]?.orgUnitId ?? null;
    if (currentSeasonOrgUnitId) return currentSeasonOrgUnitId;

    // Legacy fallback: Team.orgUnitId
    return team.orgUnitId ?? null;
  }

  /**
   * Resolves the canonical OrgUnit for a TeamSeason.
   * Used in training creation where teamSeasonId is the input (not teamId).
   */
  async resolveTeamSeasonOrgUnit(teamSeasonId: string, tenantId: string): Promise<{ teamId: string; orgUnitId: string | null } | null> {
    const teamSeason = await this.prisma.teamSeason.findFirst({
      where: { id: teamSeasonId },
      select: {
        teamId: true,
        orgUnits: {
          where: { isPrimary: true },
          take: 1,
          select: { orgUnitId: true },
        },
        team: {
          select: { orgUnitId: true, tenantId: true },
        },
      },
    });

    // Cross-tenant safety: verify the teamSeason's team belongs to the tenant.
    if (!teamSeason || teamSeason.team?.tenantId !== tenantId) return null;

    const orgUnitId =
      teamSeason.orgUnits[0]?.orgUnitId ??
      teamSeason.team?.orgUnitId ??
      null;

    return { teamId: teamSeason.teamId, orgUnitId };
  }

  // ── Tenant-wide coordinator check ─────────────────────────────────────────

  private async isTenantWideCoordinator(
    ctx: PlanningContext,
    domain: PlanningDomain,
  ): Promise<boolean> {
    const permission = permissionForDomain(domain);
    const { platform, tenant } = await this.effectiveResolver.getEffectivePermissions({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    });
    return platform.includes(permission) || tenant.includes(permission);
  }

  // ── canCreateForTeam ──────────────────────────────────────────────────────

  /**
   * Returns whether the user may create a planning record for the given team.
   *
   * Coordinator (tenant-wide permission): always allowed → APPROVED stage.
   * Scoped user (OrgUnit-scoped permission for team's OrgUnit): allowed → DRAFT.
   * No matching permission/scope: denied.
   *
   * @param teamId  Direct team ID (for match/tournament creation).
   *                Pass null to check coordinators-only (no team scope needed).
   */
  async canCreateForTeam(
    ctx: PlanningContext,
    domain: PlanningDomain,
    teamId: string | null,
  ): Promise<CanCreateResult> {
    // 1. Coordinator (tenant-wide) always wins
    if (await this.isTenantWideCoordinator(ctx, domain)) {
      return { allowed: true, isCoordinator: true, isScoped: false };
    }

    // 2. Scoped check requires a team
    if (!teamId) {
      return {
        allowed: false,
        isCoordinator: false,
        isScoped: false,
        reason: "No team provided and no tenant-wide permission.",
      };
    }

    const orgUnitId = await this.resolveTeamOrgUnit(teamId, ctx.tenantId);
    if (!orgUnitId) {
      return {
        allowed: false,
        isCoordinator: false,
        isScoped: false,
        reason: "Team has no canonical OrgUnit — cannot determine write scope.",
      };
    }

    const hasScope = await this.orgUnitResolver.hasPermissionInOrgUnit({
      userId: ctx.userId,
      permission: permissionForDomain(domain),
      tenantId: ctx.tenantId,
      orgUnitId,
    });

    if (!hasScope) {
      return {
        allowed: false,
        isCoordinator: false,
        isScoped: false,
        reason: "No OrgUnit-scoped write permission for this team.",
      };
    }

    return { allowed: true, isCoordinator: false, isScoped: true };
  }

  /**
   * Variant for training creation where the input is a teamSeasonId.
   */
  async canCreateForTeamSeason(
    ctx: PlanningContext,
    teamSeasonId: string,
  ): Promise<CanCreateResult & { teamId: string | null }> {
    if (await this.isTenantWideCoordinator(ctx, "training")) {
      return { allowed: true, isCoordinator: true, isScoped: false, teamId: null };
    }

    const resolved = await this.resolveTeamSeasonOrgUnit(teamSeasonId, ctx.tenantId);
    if (!resolved) {
      return {
        allowed: false,
        isCoordinator: false,
        isScoped: false,
        teamId: null,
        reason: "TeamSeason not found or no OrgUnit.",
      };
    }

    if (!resolved.orgUnitId) {
      return {
        allowed: false,
        isCoordinator: false,
        isScoped: false,
        teamId: resolved.teamId,
        reason: "TeamSeason has no canonical OrgUnit — cannot determine write scope.",
      };
    }

    const hasScope = await this.orgUnitResolver.hasPermissionInOrgUnit({
      userId: ctx.userId,
      permission: PERMISSIONS.TRAININGS_MANAGE,
      tenantId: ctx.tenantId,
      orgUnitId: resolved.orgUnitId,
    });

    if (!hasScope) {
      return {
        allowed: false,
        isCoordinator: false,
        isScoped: false,
        teamId: resolved.teamId,
        reason: "No OrgUnit-scoped write permission for this team.",
      };
    }

    return { allowed: true, isCoordinator: false, isScoped: true, teamId: resolved.teamId };
  }

  // ── canEditPlanningRecord ─────────────────────────────────────────────────

  /**
   * Returns whether the user may edit (field update) the given record.
   *
   * Coordinator: can always edit unless the record is externally protected
   * (SFV/provider source — those fields are managed by the provider sync).
   *
   * Scoped user: can edit ONLY when:
   *   - planningStage is DRAFT (SUBMITTED/APPROVED are locked)
   *   - source is MANUAL or null (provider records are protected)
   *   - user has OrgUnit scope for the record's team
   */
  async canEditPlanningRecord(
    ctx: PlanningContext,
    domain: PlanningDomain,
    record: PlanningRecord,
  ): Promise<boolean> {
    // Source protection: scoped users may never mutate provider records
    if (record.source && PROTECTED_SOURCES.has(record.source)) {
      // Only coordinators can manage provider-originated records
      return this.isTenantWideCoordinator(ctx, domain);
    }

    // Coordinator: can edit any MANUAL record regardless of stage
    if (await this.isTenantWideCoordinator(ctx, domain)) {
      return true;
    }

    // Scoped: only DRAFT stage
    if (record.planningStage !== "DRAFT") {
      return false;
    }

    // Scoped: must have team
    if (!record.teamId) {
      return false;
    }

    const orgUnitId = await this.resolveTeamOrgUnit(record.teamId, ctx.tenantId);
    if (!orgUnitId) return false;

    return this.orgUnitResolver.hasPermissionInOrgUnit({
      userId: ctx.userId,
      permission: permissionForDomain(domain),
      tenantId: ctx.tenantId,
      orgUnitId,
    });
  }

  // ── canSubmitPlanningRecord ───────────────────────────────────────────────

  /**
   * Returns whether the user may submit (DRAFT → SUBMITTED) the given record.
   *
   * Coordinators bypass the submit step (their records are already APPROVED).
   * Scoped users can submit their own DRAFT records.
   */
  async canSubmitPlanningRecord(
    ctx: PlanningContext,
    domain: PlanningDomain,
    record: PlanningRecord,
  ): Promise<boolean> {
    if (record.planningStage !== "DRAFT") {
      return false;
    }

    if (record.source && PROTECTED_SOURCES.has(record.source)) {
      return false;
    }

    // Coordinator can submit too (though they typically skip to APPROVED)
    if (await this.isTenantWideCoordinator(ctx, domain)) {
      return true;
    }

    if (!record.teamId) return false;

    const orgUnitId = await this.resolveTeamOrgUnit(record.teamId, ctx.tenantId);
    if (!orgUnitId) return false;

    return this.orgUnitResolver.hasPermissionInOrgUnit({
      userId: ctx.userId,
      permission: permissionForDomain(domain),
      tenantId: ctx.tenantId,
      orgUnitId,
    });
  }

  // ── canValidatePlanningRecord ─────────────────────────────────────────────

  /**
   * Returns whether the user may validate (SUBMITTED → APPROVED) the given record.
   *
   * Only tenant-wide coordinators/Club Admins may validate.
   * Scoped users — even those with OrgUnit scope for the record's team — cannot
   * validate their own or others' submissions.
   */
  async canValidatePlanningRecord(
    ctx: PlanningContext,
    domain: PlanningDomain,
    record: PlanningRecord,
  ): Promise<boolean> {
    if (record.planningStage !== "SUBMITTED") {
      return false;
    }

    return this.isTenantWideCoordinator(ctx, domain);
  }

  // ── getWritableTeamIds ────────────────────────────────────────────────────

  /**
   * Returns the IDs of all teams for which the user has write authorization
   * in the given domain. Used to populate the team picker in create forms.
   *
   * Coordinator (tenant-wide): all teams in the tenant.
   * Scoped user: only teams whose canonical OrgUnit is covered by their scoped assignment.
   *
   * This is the server-side source for create form team pickers. The result
   * is NOT a read filter — Center overview queries are unaffected.
   */
  async getWritableTeamIds(
    ctx: PlanningContext,
    domain: PlanningDomain,
  ): Promise<string[]> {
    const isCoordinator = await this.isTenantWideCoordinator(ctx, domain);

    if (isCoordinator) {
      // Coordinator sees all active teams in tenant
      const teams = await this.prisma.team.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true },
        orderBy: { sortOrder: "asc" },
      });
      return teams.map((t) => t.id);
    }

    // Load the user's OrgUnit-scoped assignments for this domain
    const permission = permissionForDomain(domain);

    const scopedAssignments = await this.prisma.userRole.findMany({
      where: {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        orgUnitId: { not: null },
        scopeMode: { not: null },
        role: {
          scope: "TENANT",
          tenantId: ctx.tenantId,
          isArchived: false,
          rolePermissions: {
            some: {
              permission: { key: permission, scope: "TENANT" },
            },
          },
        },
      },
      select: {
        orgUnitId: true,
        scopeMode: true,
      },
    });

    if (scopedAssignments.length === 0) return [];

    // Load ALL teams with their canonical OrgUnit chain
    const teams = await this.prisma.team.findMany({
      where: { tenantId: ctx.tenantId },
      select: {
        id: true,
        orgUnitId: true,
        teamSeasons: {
          where: { season: { isActive: true } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            orgUnits: {
              where: { isPrimary: true },
              take: 1,
              select: {
                orgUnitId: true,
                orgUnit: {
                  select: {
                    id: true,
                    parentId: true,
                    parent: {
                      select: {
                        id: true,
                        parentId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    const writableTeamIds: string[] = [];

    for (const team of teams) {
      const primaryLink = team.teamSeasons[0]?.orgUnits[0];
      const teamOrgUnitId = primaryLink?.orgUnitId ?? team.orgUnitId ?? null;
      if (!teamOrgUnitId) continue;

      // Build ancestor chain for THIS_ORG_UNIT_AND_DESCENDANTS check
      const orgUnit = primaryLink?.orgUnit;
      const ancestorIds = new Set<string>();
      ancestorIds.add(teamOrgUnitId);
      if (orgUnit) {
        if (orgUnit.parentId) ancestorIds.add(orgUnit.parentId);
        if (orgUnit.parent?.parentId) ancestorIds.add(orgUnit.parent.parentId);
      }

      for (const assignment of scopedAssignments) {
        if (!assignment.orgUnitId) continue;

        if (assignment.scopeMode === "THIS_ORG_UNIT") {
          if (assignment.orgUnitId === teamOrgUnitId) {
            writableTeamIds.push(team.id);
            break;
          }
        } else if (assignment.scopeMode === "THIS_ORG_UNIT_AND_DESCENDANTS") {
          // Assignment on ancestor X covers this team's OrgUnit iff X is
          // in the ancestor chain of this team's OrgUnit.
          if (ancestorIds.has(assignment.orgUnitId)) {
            writableTeamIds.push(team.id);
            break;
          }
        }
      }
    }

    return writableTeamIds;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPlanningAuthorizationPolicy(
  prisma: PrismaClient,
): PlanningAuthorizationPolicy {
  return new PlanningAuthorizationPolicy(prisma);
}
