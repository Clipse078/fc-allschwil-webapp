/**
 * lib/teams/team-season-service.ts
 *
 * Canonical TeamSeason creation and OrgUnit assignment service.
 *
 * TEAM-CORE-02: Implements the mandatory creation rules:
 *   - A TeamSeason MUST have a valid seasonId.
 *   - A TeamSeason MUST have at least one OrgUnit.
 *   - Every OrgUnit must belong to the same tenant as the Team.
 *   - Every OrgUnit must be active (not ARCHIVED or INACTIVE).
 *   - Duplicate OrgUnit IDs are normalised (deduplicated silently).
 *   - Cross-tenant OrgUnit assignments are rejected.
 *
 * Season tenant-scoping limitation:
 *   Season model does not yet carry a tenantId (deferred to SEASON-01).
 *   Tenant enforcement for Season is achieved through Team.tenantId,
 *   TeamSeason.teamId, and the existing authorization context.
 *   Any remaining Season cross-tenant risk is noted in the TEAM-CORE-02 report.
 *
 * OrgUnit eligibility:
 *   - Must exist in the DB.
 *   - Must belong to the same tenant (tenantId match).
 *   - Must have status = ACTIVE (not INACTIVE or ARCHIVED).
 *   - These rules apply only to NEW assignments; historical archived assignments
 *     remain valid (backfill from Team.orgUnitId may include archived OrgUnits).
 *
 * Backward compatibility:
 *   - Existing low-level routes (POST /api/teams/[teamId]/team-seasons) remain
 *     available for migration, seed, and internal tooling.
 *   - This service is the canonical path for new creation flows.
 *   - SFV sync uses a separate path and is not affected by mandatory OrgUnit rules.
 */

import { prisma } from "@/lib/db/prisma";
import { TeamSeasonStatus, ParticipationType } from "@prisma/client";
import type { Prisma, OrgUnitStatus } from "@prisma/client";
import {
  buildTeamSeasonDisplayName,
  buildTeamSeasonShortName,
} from "./team-season-rules";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateTeamSeasonInput = {
  /** The permanent Team identity. Must belong to tenantId. */
  teamId: string;
  /** The Season to create the TeamSeason for. */
  seasonId: string;
  /** Tenant context. All OrgUnits and the Team must belong to this tenant. */
  tenantId: string;
  /**
   * At least one OrgUnit ID is required for canonical creation.
   * Duplicates are deduplicated automatically.
   */
  orgUnitIds: string[];
  /** Optional explicit display name. Defaults to team name (tenant-neutral). */
  displayName?: string | null;
  /** Optional short name. Defaults to team name. */
  shortName?: string | null;
  /** Initial status. Defaults to ACTIVE. */
  status?: TeamSeasonStatus;
  /** Seasonal website visibility. Defaults to true. */
  websiteVisible?: boolean;
  /** Seasonal infoboard visibility. Defaults to true. */
  infoboardVisible?: boolean;
};

export type CreateTeamSeasonResult =
  | { ok: true; teamSeasonId: string; orgUnitCount: number }
  | { ok: false; code: CreateTeamSeasonErrorCode; message: string };

export type CreateTeamSeasonErrorCode =
  | "TEAM_NOT_FOUND"
  | "TEAM_TENANT_MISMATCH"
  | "SEASON_NOT_FOUND"
  | "ORG_UNIT_REQUIRED"
  | "ORG_UNIT_NOT_FOUND"
  | "ORG_UNIT_TENANT_MISMATCH"
  | "ORG_UNIT_NOT_ACTIVE"
  | "TEAM_SEASON_ALREADY_EXISTS"
  | "UNKNOWN_ERROR";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTIVE_ORG_UNIT_STATUSES: OrgUnitStatus[] = ["ACTIVE"];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Creates a TeamSeason with mandatory OrgUnit assignment.
 *
 * This is the canonical creation path enforcing all product rules from TEAM-CORE-02.
 * Use the low-level route (POST /api/teams/[teamId]/team-seasons) only for
 * migration, seed, or internal compatibility paths.
 *
 * Performs all validation before writing to the DB.
 * Uses a transaction to ensure atomicity of TeamSeason + TeamSeasonOrgUnit creation.
 *
 * Security: all inputs are validated against tenantId. No cross-tenant
 * assignment is possible through this function.
 */
export async function createCanonicalTeamSeason(
  input: CreateTeamSeasonInput,
): Promise<CreateTeamSeasonResult> {
  // 1. Validate OrgUnit IDs are provided
  const uniqueOrgUnitIds = [...new Set(input.orgUnitIds.filter(Boolean))];
  if (uniqueOrgUnitIds.length === 0) {
    return {
      ok: false,
      code: "ORG_UNIT_REQUIRED",
      message: "Mindestens eine Organisationseinheit ist erforderlich.",
    };
  }

  // 2. Validate Team exists and belongs to the correct tenant
  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    select: { id: true, name: true, tenantId: true },
  });

  if (!team) {
    return {
      ok: false,
      code: "TEAM_NOT_FOUND",
      message: "Team nicht gefunden.",
    };
  }

  if (team.tenantId && team.tenantId !== input.tenantId) {
    return {
      ok: false,
      code: "TEAM_TENANT_MISMATCH",
      message: "Das Team gehört nicht zum angegebenen Mandanten.",
    };
  }

  // 3. Validate Season exists
  const season = await prisma.season.findUnique({
    where: { id: input.seasonId },
    select: { id: true, name: true },
  });

  if (!season) {
    return {
      ok: false,
      code: "SEASON_NOT_FOUND",
      message: "Saison nicht gefunden.",
    };
  }

  // 4. Validate all OrgUnits: exist, belong to tenant, are active
  const orgUnits = await prisma.orgUnit.findMany({
    where: { id: { in: uniqueOrgUnitIds } },
    select: { id: true, tenantId: true, status: true, name: true },
  });

  const foundIds = new Set(orgUnits.map((ou) => ou.id));
  for (const requestedId of uniqueOrgUnitIds) {
    if (!foundIds.has(requestedId)) {
      return {
        ok: false,
        code: "ORG_UNIT_NOT_FOUND",
        message: `Organisationseinheit '${requestedId}' nicht gefunden.`,
      };
    }
  }

  for (const orgUnit of orgUnits) {
    // Tenant isolation: OrgUnit must belong to the same tenant
    if (orgUnit.tenantId && orgUnit.tenantId !== input.tenantId) {
      return {
        ok: false,
        code: "ORG_UNIT_TENANT_MISMATCH",
        message: `Organisationseinheit '${orgUnit.id}' gehört nicht zum Mandanten.`,
      };
    }

    // Eligibility: OrgUnit must be active for new assignments
    if (!ACTIVE_ORG_UNIT_STATUSES.includes(orgUnit.status as OrgUnitStatus)) {
      return {
        ok: false,
        code: "ORG_UNIT_NOT_ACTIVE",
        message: `Organisationseinheit '${orgUnit.name}' ist nicht aktiv (Status: ${orgUnit.status}). Archivierte Organisationseinheiten können nicht neu zugewiesen werden.`,
      };
    }
  }

  // 5. Check for existing TeamSeason
  const existing = await prisma.teamSeason.findUnique({
    where: { teamId_seasonId: { teamId: input.teamId, seasonId: input.seasonId } },
    select: { id: true },
  });

  if (existing) {
    return {
      ok: false,
      code: "TEAM_SEASON_ALREADY_EXISTS",
      message: "Für dieses Team existiert bereits ein Eintrag für diese Saison.",
    };
  }

  // 6. Resolve display name
  const displayName =
    input.displayName && input.displayName.trim().length > 0
      ? input.displayName.trim()
      : buildTeamSeasonDisplayName(team.name);

  const shortName =
    input.shortName !== undefined
      ? input.shortName
      : buildTeamSeasonShortName(team.name);

  // 7. Create TeamSeason + TeamSeasonOrgUnit atomically
  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return writeTeamSeasonInTx(tx, {
        teamId: input.teamId,
        seasonId: input.seasonId,
        tenantId: input.tenantId,
        uniqueOrgUnitIds,
        displayName,
        shortName,
        status: input.status ?? TeamSeasonStatus.ACTIVE,
        websiteVisible: input.websiteVisible ?? true,
        infoboardVisible: input.infoboardVisible ?? true,
      });
    });

    return { ok: true, teamSeasonId: result, orgUnitCount: uniqueOrgUnitIds.length };
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return {
        ok: false,
        code: "TEAM_SEASON_ALREADY_EXISTS",
        message: "Für dieses Team existiert bereits ein Eintrag für diese Saison.",
      };
    }
    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: err instanceof Error ? err.message : "Unbekannter Fehler.",
    };
  }
}

// ---------------------------------------------------------------------------
// Shared transaction-aware write primitive
// ---------------------------------------------------------------------------

export type WriteTeamSeasonInTxInput = {
  teamId: string;
  seasonId: string;
  tenantId: string;
  /** Deduplicated, ordered list of OrgUnit IDs. First is primary. */
  uniqueOrgUnitIds: string[];
  displayName: string;
  shortName: string | null;
  status: TeamSeasonStatus;
  /** How the TeamSeason participates this season (TEAM-CREATE-02). Defaults to TRAINING. */
  participationType?: ParticipationType;
  websiteVisible: boolean;
  infoboardVisible: boolean;
};

/**
 * writeTeamSeasonInTx
 *
 * Transaction-aware primitive that creates one TeamSeason and its
 * TeamSeasonOrgUnit rows within a caller-supplied transaction client.
 *
 * This is the single canonical write implementation for TeamSeason creation.
 *
 * Rules:
 *   - IDs are omitted so Prisma uses @default(cuid()) — prevents ID collisions
 *     from synchronous Date.now() in map() when creating multiple OrgUnit rows.
 *   - First OrgUnit in uniqueOrgUnitIds is isPrimary = true.
 *   - displayOrder follows the array index.
 *
 * Callers are responsible for all validation (OrgUnit existence, tenant match,
 * status, Season existence, duplicate TeamSeason) before calling this function.
 *
 * Used by:
 *   - createCanonicalTeamSeason() — wraps in its own Prisma $transaction
 *   - registerTeamSeason() — called inside a larger outer transaction
 */
export async function writeTeamSeasonInTx(
  tx: Prisma.TransactionClient,
  input: WriteTeamSeasonInTxInput,
): Promise<string> {
  const teamSeason = await tx.teamSeason.create({
    data: {
      teamId: input.teamId,
      seasonId: input.seasonId,
      displayName: input.displayName,
      shortName: input.shortName,
      status: input.status,
      participationType: input.participationType ?? ParticipationType.TRAINING,
      websiteVisible: input.websiteVisible,
      infoboardVisible: input.infoboardVisible,
    },
    select: { id: true },
  });

  const orgUnitData = input.uniqueOrgUnitIds.map((orgUnitId, index) => ({
    tenantId: input.tenantId,
    teamSeasonId: teamSeason.id,
    orgUnitId,
    isPrimary: index === 0,
    displayOrder: index,
  }));

  await tx.teamSeasonOrgUnit.createMany({ data: orgUnitData });

  return teamSeason.id;
}

// ---------------------------------------------------------------------------
// OrgUnit eligibility query
// ---------------------------------------------------------------------------

/**
 * Returns the list of OrgUnits that are eligible for TeamSeason assignment
 * for the given tenant.
 *
 * Eligibility rules:
 *   - Belongs to the tenant (tenantId match).
 *   - Status is ACTIVE (not INACTIVE or ARCHIVED).
 *
 * No OrgUnit name or type filtering is applied. Advanced eligibility rules
 * (e.g. type-based filtering) may be added in a future slice.
 *
 * Note: If OrgUnit.tenantId is null (legacy data), the OrgUnit is excluded
 * from the results since tenant ownership cannot be verified.
 */
export async function getEligibleOrgUnitsForTeamSeason(tenantId: string): Promise<
  Array<{ id: string; name: string; key: string; type: string; status: string }>
> {
  return prisma.orgUnit.findMany({
    where: {
      tenantId,
      status: "ACTIVE",
    },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      key: true,
      type: true,
      status: true,
    },
  });
}

// ---------------------------------------------------------------------------
// TeamExternalMapping consistency helper
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TeamSeasonCompetition — post-creation competition (re-)assignment
// ---------------------------------------------------------------------------

export type SetTeamSeasonCompetitionInput = {
  /** Tenant context. Always sourced from the trusted session, never client input. */
  tenantId: string;
  /** The permanent Team identity that must own teamSeasonId. */
  teamId: string;
  /** The TeamSeason whose primary competition is being (re-)assigned. */
  teamSeasonId: string;
  /** New primary competition, or null to clear the assignment. */
  competitionId: string | null;
};

export type SetTeamSeasonCompetitionResult =
  | {
      ok: true;
      competition: { id: string; officialName: string; shortName: string | null } | null;
    }
  | { ok: false; code: SetTeamSeasonCompetitionErrorCode; message: string };

export type SetTeamSeasonCompetitionErrorCode =
  | "TEAM_SEASON_NOT_FOUND"
  | "TEAM_SEASON_TENANT_MISMATCH"
  | "COMPETITION_NOT_FOUND"
  | "COMPETITION_TENANT_MISMATCH"
  | "COMPETITION_ARCHIVED"
  | "COMPETITION_NOT_ALLOWED"
  | "UNKNOWN_ERROR";

/**
 * (Re-)assigns — or clears — the primary Competition for an existing
 * TeamSeason after Team/TeamSeason creation.
 *
 * TEAMCENTER-UX-01C: registration (team-registration-service.ts) is the only
 * place that could create a TeamSeasonCompetition — there was previously no
 * way to add, change, or remove a competition assignment afterwards. This is
 * the canonical (and only) write path for that follow-up edit, reusing the
 * exact eligibility rules already enforced at registration time (tenant
 * match, not archived, only for participationType = COMPETITION) so the two
 * paths can never diverge.
 *
 * At most one TeamSeasonCompetition row is ever `isPrimary` per TeamSeason
 * (see schema.prisma TeamSeasonCompetition). Passing `competitionId: null`
 * clears the primary assignment; passing an id promotes/creates that row as
 * primary and demotes any previous primary row. Non-primary rows (if any
 * exist from other flows) are left untouched.
 */
export async function setTeamSeasonCompetition(
  input: SetTeamSeasonCompetitionInput,
): Promise<SetTeamSeasonCompetitionResult> {
  const teamSeason = await prisma.teamSeason.findUnique({
    where: { id: input.teamSeasonId },
    select: {
      id: true,
      teamId: true,
      participationType: true,
      team: { select: { tenantId: true } },
    },
  });

  if (!teamSeason || teamSeason.teamId !== input.teamId) {
    return {
      ok: false,
      code: "TEAM_SEASON_NOT_FOUND",
      message: "Team-Saison nicht gefunden.",
    };
  }

  if (teamSeason.team.tenantId && teamSeason.team.tenantId !== input.tenantId) {
    return {
      ok: false,
      code: "TEAM_SEASON_TENANT_MISMATCH",
      message: "Die Team-Saison gehört nicht zum Mandanten.",
    };
  }

  const competitionId = input.competitionId?.trim() || null;

  if (competitionId && teamSeason.participationType !== ParticipationType.COMPETITION) {
    return {
      ok: false,
      code: "COMPETITION_NOT_ALLOWED",
      message: "Eine Wettkampfzuordnung ist nur für Wettkampfteams zulässig.",
    };
  }

  let competition: { id: string; officialName: string; shortName: string | null } | null = null;

  if (competitionId) {
    const found = await prisma.competition.findFirst({
      where: { id: competitionId, tenantId: input.tenantId },
      select: { id: true, officialName: true, shortName: true, isArchived: true },
    });

    if (!found) {
      const anyCompetition = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { id: true },
      });

      return anyCompetition
        ? {
            ok: false,
            code: "COMPETITION_TENANT_MISMATCH",
            message: "Der Wettkampf gehört nicht zum aktiven Mandanten.",
          }
        : { ok: false, code: "COMPETITION_NOT_FOUND", message: "Wettkampf nicht gefunden." };
    }

    if (found.isArchived) {
      return {
        ok: false,
        code: "COMPETITION_ARCHIVED",
        message:
          "Archivierte Wettkämpfe können nicht zugeordnet werden. Bitte einen aktiven Wettkampf wählen.",
      };
    }

    competition = { id: found.id, officialName: found.officialName, shortName: found.shortName };
  }

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.teamSeasonCompetition.updateMany({
        where: { teamSeasonId: input.teamSeasonId, isPrimary: true },
        data: { isPrimary: false },
      });

      if (competitionId) {
        const existing = await tx.teamSeasonCompetition.findUnique({
          where: {
            teamSeasonId_competitionId: {
              teamSeasonId: input.teamSeasonId,
              competitionId,
            },
          },
          select: { id: true },
        });

        if (existing) {
          await tx.teamSeasonCompetition.update({
            where: { id: existing.id },
            data: { isPrimary: true, displayOrder: 0 },
          });
        } else {
          await tx.teamSeasonCompetition.create({
            data: {
              teamSeasonId: input.teamSeasonId,
              competitionId,
              isPrimary: true,
              displayOrder: 0,
            },
          });
        }
      }
    });
  } catch (err) {
    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: err instanceof Error ? err.message : "Unbekannter Fehler.",
    };
  }

  return { ok: true, competition };
}

/**
 * Validates that a TeamExternalMapping's teamSeasonId is consistent with
 * its teamId.
 *
 * Rules:
 *   - teamSeason.teamId must equal the mapping's teamId.
 *   - teamSeason must belong to the same tenant as the mapping.
 *
 * Returns null when teamSeasonId is null (null is valid for legacy mappings).
 * Returns an error string when the consistency check fails.
 * Returns undefined when the mapping is valid.
 */
export async function validateMappingTeamSeasonConsistency(input: {
  tenantId: string;
  teamId: string;
  teamSeasonId: string | null;
}): Promise<string | null | undefined> {
  if (input.teamSeasonId === null) {
    return null; // null is valid — no consistency check needed
  }

  const teamSeason = await prisma.teamSeason.findUnique({
    where: { id: input.teamSeasonId },
    select: { teamId: true, team: { select: { tenantId: true } } },
  });

  if (!teamSeason) {
    return "TeamSeason nicht gefunden.";
  }

  if (teamSeason.teamId !== input.teamId) {
    return "Die TeamSeason gehört nicht zu diesem Team.";
  }

  if (
    teamSeason.team.tenantId &&
    teamSeason.team.tenantId !== input.tenantId
  ) {
    return "Die TeamSeason gehört nicht zum Mandanten.";
  }

  return undefined; // valid
}
