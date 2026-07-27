/**
 * lib/teams/team-registration-service.ts
 *
 * Canonical orchestration service for the Team registration workflow.
 *
 * TEAM-CREATE-01: Implements the full seasonal Team registration:
 *   1. Permission context is validated by the caller (API route).
 *   2. Season validity is validated.
 *   3. OrgUnit eligibility is validated (≥1 required, active, tenant-scoped).
 *   4. Team identity is either created fresh or an explicit existing Team is reused.
 *   5. TeamSeason + TeamSeasonOrgUnit are written via writeTeamSeasonInTx().
 *   6. Optional TeamExternalMapping is created/claimed (guarded against races).
 *   7. All mandatory writes are atomic within a single Prisma transaction.
 *
 * TEAM-CREATE-02: Extends registration with:
 *   - participationType (required) — how the TeamSeason participates this season.
 *   - competitionId (optional) — required when participationType = COMPETITION.
 *   - TeamSeasonCompetition is created atomically when competitionId is provided.
 *
 * Canonical TeamSeason write:
 *   This service uses writeTeamSeasonInTx() from team-season-service.ts as the
 *   single canonical implementation of the TeamSeason + TeamSeasonOrgUnit write.
 *   No TeamSeason write logic is duplicated here.
 *
 * Transaction safety:
 *   All mandatory writes (Team optional, TeamSeason, TeamSeasonOrgUnit) are
 *   wrapped in a single Prisma $transaction. The optional TeamExternalMapping
 *   and TeamSeasonCompetition are included in the same transaction to ensure
 *   atomicity. The pre-transaction validation checks are fail-fast gates;
 *   authoritative checks run inside the transaction to guard against TOCTOU
 *   race conditions.
 *
 * Tenant isolation:
 *   tenantId always originates from the session (never from the request body).
 *   All entity validations are scoped to tenantId.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma, OrgUnitStatus } from "@prisma/client";
import { TeamSeasonStatus, ParticipationType } from "@prisma/client";
import {
  normalizeTeamName,
  normalizeTeamSlug,
  buildTeamSeasonDisplayName,
  buildTeamSeasonShortName,
} from "./team-season-rules";
import { writeTeamSeasonInTx } from "./team-season-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegisterTeamInput = {
  /** Tenant context. Originates from the authenticated session. */
  tenantId: string;
  /** Season to register the team for. */
  seasonId: string;
  /**
   * Ordered list of OrgUnit IDs. At least one is required.
   * First ID becomes the primary OrgUnit.
   */
  orgUnitIds: string[];
  /**
   * When provided, reuse this existing Team identity instead of creating one.
   * The Team must belong to tenantId.
   */
  existingTeamId?: string | null;
  team: {
    /** Team name. Required. */
    name: string;
    /** Optional slug. Auto-generated from name when absent. */
    slug?: string | null;
    /** Optional short name. Defaults to name when absent. */
    shortName?: string | null;
    /** Optional gender group (free text). */
    genderGroup?: string | null;
    /** Optional age group / level (free text). */
    ageGroup?: string | null;
    /** Display sort order. Defaults to 0. */
    sortOrder?: number | null;
  };
  /**
   * How the TeamSeason participates in this season (TEAM-CREATE-02).
   * Required. Defaults to TRAINING when not explicitly set by the caller.
   */
  participationType: ParticipationType;
  /**
   * Competition to assign to this TeamSeason (TEAM-CREATE-02).
   * Required when participationType = COMPETITION and competitions exist.
   * Must belong to tenantId.
   * When provided, a TeamSeasonCompetition row is created (isPrimary=true).
   */
  competitionId?: string | null;
  /**
   * Optional federation mapping for the newly created TeamSeason.
   * When provided, a TeamExternalMapping row is claimed/created.
   */
  federationMapping?: {
    provider: string;
    externalTeamId: number;
    externalSeasonId: number;
    providerTeamName?: string | null;
    providerLeagueName?: string | null;
  } | null;
  /** Seasonal website visibility. Defaults to true. */
  websiteVisible: boolean;
  /** Seasonal infoboard visibility. Defaults to true. */
  infoboardVisible: boolean;
};

export type RegisterTeamResult =
  | {
      ok: true;
      teamId: string;
      teamSeasonId: string;
      slug: string;
      createdTeamIdentity: boolean;
    }
  | { ok: false; code: RegisterTeamErrorCode; message: string };

export type RegisterTeamErrorCode =
  | "TEAM_NAME_REQUIRED"
  | "SEASON_NOT_FOUND"
  | "ORG_UNIT_REQUIRED"
  | "ORG_UNIT_NOT_FOUND"
  | "ORG_UNIT_TENANT_MISMATCH"
  | "ORG_UNIT_NOT_ACTIVE"
  | "TEAM_NOT_FOUND"
  | "TEAM_TENANT_MISMATCH"
  | "TEAM_SEASON_ALREADY_EXISTS"
  | "SLUG_CONFLICT"
  | "FEDERATION_MAPPING_CONFLICT"
  | "INVALID_PARTICIPATION_TYPE"
  | "COMPETITION_REQUIRED"
  | "COMPETITION_NOT_FOUND"
  | "COMPETITION_TENANT_MISMATCH"
  | "UNKNOWN_ERROR";

const ACTIVE_ORG_UNIT_STATUSES: OrgUnitStatus[] = ["ACTIVE"];

// Default legacy TeamCategory for new teams.
// TeamCategory is a required DB field retained for backward compatibility.
// It is NOT used for new business logic; removal is planned for TEAM-CORE-03+.
// Callers MUST NOT derive grouping, filtering, or display from this value.
const DEFAULT_LEGACY_CATEGORY = "AKTIVE" as const;

// ---------------------------------------------------------------------------
// Public service
// ---------------------------------------------------------------------------

/**
 * Registers a Team for a Season with mandatory OrgUnit assignments.
 *
 * This is the canonical full-registration path for the TEAM-CREATE-01 wizard.
 * All writes are atomic; no partial records are left on failure.
 *
 * TeamSeason + TeamSeasonOrgUnit are written via the shared writeTeamSeasonInTx()
 * primitive from team-season-service.ts. No TeamSeason write logic is duplicated.
 *
 * Idempotency: the caller is responsible for preventing duplicate submissions.
 * The service returns TEAM_SEASON_ALREADY_EXISTS on duplicate attempts.
 */
export async function registerTeamSeason(
  input: RegisterTeamInput,
): Promise<RegisterTeamResult> {
  // 1. Normalise input values
  const teamName = normalizeTeamName(input.team.name);
  const teamSlug = normalizeTeamSlug(
    input.team.slug?.trim() || teamName,
  );

  if (!teamName) {
    return {
      ok: false,
      code: "TEAM_NAME_REQUIRED",
      message: "Teamname ist erforderlich.",
    };
  }

  // 1a. Validate participation type
  const validParticipationTypes = Object.values(ParticipationType) as string[];
  if (!validParticipationTypes.includes(input.participationType)) {
    return {
      ok: false,
      code: "INVALID_PARTICIPATION_TYPE",
      message: "Ungültiger Teilnahmetyp.",
    };
  }

  const uniqueOrgUnitIds = [...new Set(input.orgUnitIds.filter(Boolean))];
  if (uniqueOrgUnitIds.length === 0) {
    return {
      ok: false,
      code: "ORG_UNIT_REQUIRED",
      message: "Mindestens eine Organisationseinheit ist erforderlich.",
    };
  }

  // 2. Pre-validate Season (outside transaction — fail fast)
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

  // 3. Pre-validate OrgUnits (outside transaction — fail fast)
  const orgUnits = await prisma.orgUnit.findMany({
    where: { id: { in: uniqueOrgUnitIds } },
    select: { id: true, tenantId: true, status: true, name: true },
  });

  const foundOrgUnitIds = new Set(orgUnits.map((ou) => ou.id));
  for (const requestedId of uniqueOrgUnitIds) {
    if (!foundOrgUnitIds.has(requestedId)) {
      return {
        ok: false,
        code: "ORG_UNIT_NOT_FOUND",
        message: `Organisationseinheit '${requestedId}' nicht gefunden.`,
      };
    }
  }

  for (const orgUnit of orgUnits) {
    if (orgUnit.tenantId && orgUnit.tenantId !== input.tenantId) {
      return {
        ok: false,
        code: "ORG_UNIT_TENANT_MISMATCH",
        message: `Organisationseinheit gehört nicht zum Mandanten.`,
      };
    }
    if (!ACTIVE_ORG_UNIT_STATUSES.includes(orgUnit.status as OrgUnitStatus)) {
      return {
        ok: false,
        code: "ORG_UNIT_NOT_ACTIVE",
        message: `Organisationseinheit '${orgUnit.name}' ist nicht aktiv. Archivierte Einheiten können nicht zugewiesen werden.`,
      };
    }
  }

  // 3b. Pre-validate Competition (if provided or required)
  const competitionId = input.competitionId?.trim() || null;

  if (competitionId) {
    // Competition provided — verify it exists and belongs to this tenant
    const competition = await prisma.competition.findFirst({
      where: { id: competitionId, tenantId: input.tenantId },
      select: { id: true, tenantId: true },
    });

    if (!competition) {
      // Try to find it without tenant scope to distinguish not-found from mismatch
      const anyCompetition = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { id: true, tenantId: true },
      });

      if (!anyCompetition) {
        return {
          ok: false,
          code: "COMPETITION_NOT_FOUND",
          message: "Wettkampf nicht gefunden.",
        };
      }

      return {
        ok: false,
        code: "COMPETITION_TENANT_MISMATCH",
        message: "Der Wettkampf gehört nicht zum aktiven Mandanten.",
      };
    }
  } else if (input.participationType === ParticipationType.COMPETITION) {
    // COMPETITION type without a competition: check if competitions exist for
    // this tenant. If none exist, registration is not blocked (empty state).
    // If competitions exist, the caller must provide one.
    const competitionCount = await prisma.competition.count({
      where: { tenantId: input.tenantId, isArchived: false },
    });

    if (competitionCount > 0) {
      return {
        ok: false,
        code: "COMPETITION_REQUIRED",
        message:
          "Wettkampfteams müssen einem Wettkampf zugeordnet werden. Bitte wähle einen Wettkampf aus.",
      };
    }
    // competitionCount === 0: allow registration without competition
  }

  // 4. Pre-validate existing Team (if reuse requested)
  if (input.existingTeamId) {
    const existingTeam = await prisma.team.findUnique({
      where: { id: input.existingTeamId },
      select: { id: true, tenantId: true },
    });
    if (!existingTeam) {
      return {
        ok: false,
        code: "TEAM_NOT_FOUND",
        message: "Bestehendes Team nicht gefunden.",
      };
    }
    if (existingTeam.tenantId && existingTeam.tenantId !== input.tenantId) {
      return {
        ok: false,
        code: "TEAM_TENANT_MISMATCH",
        message: "Das bestehende Team gehört nicht zum aktiven Mandanten.",
      };
    }
  }

  // 5. Run everything in a single transaction.
  //    Authoritative conflict checks happen inside the transaction to guard
  //    against TOCTOU races (pre-validation above is fail-fast only).
  try {
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 5a. Find or create Team identity
        let teamId: string;
        let createdTeamIdentity = false;

        if (input.existingTeamId) {
          // Authoritative duplicate TeamSeason check inside transaction
          const existingSeason = await tx.teamSeason.findUnique({
            where: {
              teamId_seasonId: {
                teamId: input.existingTeamId,
                seasonId: input.seasonId,
              },
            },
            select: { id: true },
          });

          if (existingSeason) {
            throw new RegistrationError(
              "TEAM_SEASON_ALREADY_EXISTS",
              "Dieses Team ist für die ausgewählte Saison bereits registriert.",
            );
          }

          teamId = input.existingTeamId;
        } else {
          // Authoritative slug uniqueness check inside transaction
          const slugConflict = await tx.team.findUnique({
            where: {
              tenantId_slug: {
                tenantId: input.tenantId,
                slug: teamSlug,
              },
            },
            select: { id: true },
          });

          if (slugConflict) {
            throw new RegistrationError(
              "SLUG_CONFLICT",
              "Diese URL wird innerhalb deiner Organisation bereits verwendet.",
            );
          }

          // Create new Team identity (legacy category as neutral compatibility default)
          const newTeam = await tx.team.create({
            data: {
              name: teamName,
              slug: teamSlug,
              tenantId: input.tenantId,
              category: DEFAULT_LEGACY_CATEGORY,
              genderGroup: input.team.genderGroup?.trim() || null,
              ageGroup: input.team.ageGroup?.trim() || null,
              sortOrder: input.team.sortOrder ?? 0,
              isActive: true,
              websiteVisible: true,
              infoboardVisible: true,
            },
            select: { id: true },
          });

          teamId = newTeam.id;
          createdTeamIdentity = true;
        }

        // 5b. Write TeamSeason + TeamSeasonOrgUnit via canonical shared primitive
        const displayName = buildTeamSeasonDisplayName(teamName);
        const shortName =
          input.team.shortName?.trim() ||
          buildTeamSeasonShortName(teamName);

        const teamSeasonId = await writeTeamSeasonInTx(tx, {
          teamId,
          seasonId: input.seasonId,
          tenantId: input.tenantId,
          uniqueOrgUnitIds,
          displayName,
          shortName,
          status: TeamSeasonStatus.ACTIVE,
          participationType: input.participationType,
          websiteVisible: input.websiteVisible,
          infoboardVisible: input.infoboardVisible,
        });

        // 5c. Create TeamSeasonCompetition if a competition was provided
        if (competitionId) {
          await tx.teamSeasonCompetition.create({
            data: {
              teamSeasonId,
              competitionId,
              isPrimary: true,
              displayOrder: 1,
            },
          });
        }

        // 5d. Claim optional federation mapping inside transaction
        //     Authoritative conflict check happens here (not only pre-tx) to
        //     guard against TOCTOU: another request may claim the mapping between
        //     our pre-validation and this transaction.
        if (input.federationMapping) {
          const {
            provider,
            externalTeamId,
            externalSeasonId,
            providerTeamName,
            providerLeagueName,
          } = input.federationMapping;

          const existingMapping = await tx.teamExternalMapping.findUnique({
            where: {
              tenantId_provider_externalTeamId_externalSeasonId: {
                tenantId: input.tenantId,
                provider,
                externalTeamId,
                externalSeasonId,
              },
            },
            select: { id: true, teamSeasonId: true },
          });

          if (existingMapping?.teamSeasonId != null) {
            // Another registration has already claimed this mapping
            throw new RegistrationError(
              "FEDERATION_MAPPING_CONFLICT",
              "Dieses Verbandsteam ist für die ausgewählte Saison bereits einem Team zugeordnet.",
            );
          }

          if (existingMapping) {
            // Row exists but is unclaimed — update it
            await tx.teamExternalMapping.update({
              where: { id: existingMapping.id },
              data: {
                teamId,
                teamSeasonId,
                providerTeamName: providerTeamName ?? null,
                providerLeagueName: providerLeagueName ?? null,
                lastSyncedAt: new Date(),
              },
            });
          } else {
            // No row — create it
            await tx.teamExternalMapping.create({
              data: {
                tenantId: input.tenantId,
                teamId,
                provider,
                externalTeamId,
                externalSeasonId,
                teamSeasonId,
                providerTeamName: providerTeamName ?? null,
                providerLeagueName: providerLeagueName ?? null,
                providerIsActive: true,
                lastSyncedAt: new Date(),
              },
            });
          }
        }

        return {
          teamId,
          teamSeasonId,
          slug: teamSlug,
          createdTeamIdentity,
        };
      },
    );

    return { ok: true, ...result };
  } catch (err) {
    if (err instanceof RegistrationError) {
      return { ok: false, code: err.code, message: err.message };
    }

    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return {
        ok: false,
        code: "TEAM_SEASON_ALREADY_EXISTS",
        message: "Dieses Team ist für die ausgewählte Saison bereits registriert.",
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
// Internal error helper
// ---------------------------------------------------------------------------

class RegistrationError extends Error {
  constructor(
    public readonly code: RegisterTeamErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RegistrationError";
  }
}

// ---------------------------------------------------------------------------
// Eligible data queries — used by the registration wizard
// ---------------------------------------------------------------------------

/**
 * Returns seasons available for Team registration.
 * All seasons are returned with lifecycle status, ordered most-recent first.
 */
export async function getRegistrationEligibleSeasons() {
  const { getSeasonLifecycleStatus } = await import("@/lib/seasons/season-logic");
  const { getSeasonLifecycleStatusLabel } = await import("@/lib/seasons/status");

  const seasons = await prisma.season.findMany({
    orderBy: [{ startDate: "desc" }],
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      startDate: true,
      endDate: true,
    },
  });

  return seasons.map((season) => {
    const lifecycleStatus =
      getSeasonLifecycleStatus({
        startDate: season.startDate,
        endDate: season.endDate,
      }) ?? "PLANNING";

    return {
      ...season,
      lifecycleStatus,
      lifecycleStatusLabel: getSeasonLifecycleStatusLabel(lifecycleStatus),
    };
  });
}

/**
 * Returns existing active Teams for a tenant.
 * Used for the "reuse existing Team identity" feature in the wizard.
 */
export async function getExistingTeamsForTenant(
  tenantId: string,
): Promise<Array<{ id: string; name: string; slug: string }>> {
  return prisma.team.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}

/**
 * Returns unmapped federation teams available for the Verband step.
 * Only returns TeamExternalMapping rows where teamSeasonId IS NULL (unclaimed).
 */
export async function getUnmappedFederationTeams(tenantId: string): Promise<
  Array<{
    id: string;
    provider: string;
    externalTeamId: number;
    externalSeasonId: number;
    providerTeamName: string | null;
    providerLeagueName: string | null;
    providerIsActive: boolean;
  }>
> {
  return prisma.teamExternalMapping.findMany({
    where: {
      tenantId,
      teamSeasonId: null,
    },
    orderBy: [{ providerTeamName: "asc" }],
    select: {
      id: true,
      provider: true,
      externalTeamId: true,
      externalSeasonId: true,
      providerTeamName: true,
      providerLeagueName: true,
      providerIsActive: true,
    },
  });
}
