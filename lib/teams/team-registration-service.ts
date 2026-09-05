/**
 * lib/teams/team-registration-service.ts
 *
 * Canonical orchestration service for the Team registration workflow.
 *
 * TEAM-CREATE-01: Implements the full seasonal Team registration:
 *   1. Permission context is validated by the caller (API route).
 *   2. Season validity is validated.
 *   3. OrgUnit eligibility is validated (active, tenant-scoped; ≥1 required
 *      unless the caller opts in to `allowEmptyOrgUnits` — SEASON-01-C3
 *      bulk rollover use case, see RegisterTeamInput).
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
   * Ordered list of OrgUnit IDs. At least one is required, unless
   * `allowEmptyOrgUnits` is set (SEASON-01-C3).
   * First ID becomes the primary OrgUnit.
   */
  orgUnitIds: string[];
  /**
   * SEASON-01-C3: when true, permits registering the TeamSeason with zero
   * OrgUnit assignments (no TeamSeasonOrgUnit rows are created). OrgUnit
   * carry-over is best-effort only — Season membership must never be
   * blocked by missing/invalid historical OrgUnit data.
   *
   * Only the bulk rollover path (bulkRegisterExistingTeamsForSeason) sets
   * this. The single-Team registration wizard (POST /api/teams/register)
   * never sets it and keeps requiring >=1 OrgUnit, unchanged.
   *
   * Has no effect on OrgUnit validation when OrgUnit IDs ARE supplied —
   * every supplied OrgUnit must still exist, be active, and belong to the
   * same tenant, exactly as before.
   */
  allowEmptyOrgUnits?: boolean;
  /**
   * When provided, reuse this existing Team identity instead of creating one.
   * The Team must belong to tenantId.
   */
  existingTeamId?: string | null;
  team: {
    /** Team name. Required. Becomes the canonical Team.name (LONG NAME). */
    name: string;
    /** Optional slug. Auto-generated from name when absent. */
    slug?: string | null;
    /**
     * Optional short name, entered once at registration time.
     * TEAM-IDENTITY-01: this value is persisted to BOTH the canonical
     * Team.shortName (tenant-owned, set only here, never auto-derived) and —
     * unchanged from prior behavior — the seasonal TeamSeason.shortName
     * (falling back to a name-derived value when omitted). When absent,
     * Team.shortName remains NULL (no guessed data).
     */
    shortName?: string | null;
    /**
     * Optional canonical ALTERNATIVE NAME (Team.alternativeName).
     * TEAM-IDENTITY-01: tenant-owned, set only at Team creation here, never
     * auto-derived from `name` or `shortName`. Ignored when reusing an
     * existing Team identity (existingTeamId set) — edit it later via the
     * Team settings page instead.
     */
    alternativeName?: string | null;
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
  | "COMPETITION_NOT_ALLOWED"
  | "COMPETITION_REQUIRED"
  | "COMPETITION_NOT_FOUND"
  | "COMPETITION_ARCHIVED"
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
  if (uniqueOrgUnitIds.length === 0 && !input.allowEmptyOrgUnits) {
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
    if (orgUnit.tenantId !== input.tenantId) {
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
  //
  // Rules:
  //   - competitionId may only be provided when participationType = COMPETITION.
  //     Other participation types must not have a competition assignment.
  //   - When competitionId is provided: must belong to tenant, must not be archived.
  //   - When participationType = COMPETITION and no competitionId:
  //       if non-archived competitions exist → COMPETITION_REQUIRED
  //       if none exist               → allow (empty-state bypass, user returns later)
  const competitionId = input.competitionId?.trim() || null;

  if (competitionId && input.participationType !== ParticipationType.COMPETITION) {
    // Server-side guard: non-COMPETITION types must not receive a competition.
    // The wizard clears this client-side, but the API must enforce independently.
    return {
      ok: false,
      code: "COMPETITION_NOT_ALLOWED",
      message:
        "Eine Wettkampfzuordnung ist nur für Wettkampfteams zulässig.",
    };
  }

  if (competitionId) {
    // Competition provided — verify it exists, belongs to this tenant, and is not archived.
    const competition = await prisma.competition.findFirst({
      where: { id: competitionId, tenantId: input.tenantId },
      select: { id: true, tenantId: true, isArchived: true },
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

    // Archived competitions cannot be assigned to new TeamSeason registrations.
    if (competition.isArchived) {
      return {
        ok: false,
        code: "COMPETITION_ARCHIVED",
        message:
          "Archivierte Wettkämpfe können nicht zugeordnet werden. Bitte wähle einen aktiven Wettkampf.",
      };
    }
  } else if (input.participationType === ParticipationType.COMPETITION) {
    // COMPETITION type without a competition: check if competitions exist for
    // this tenant. If none exist, registration is not blocked (empty state).
    // If competitions exist, the caller must provide one.
    // NOTE: This check is server-side — the client cannot fake an empty list.
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
    if (existingTeam.tenantId !== input.tenantId) {
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
          //
          // TEAM-IDENTITY-01: Team.shortName / Team.alternativeName are set
          // only from explicit input here — never auto-derived from `name`.
          // Both remain NULL when omitted.
          const newTeam = await tx.team.create({
            data: {
              name: teamName,
              shortName: input.team.shortName?.trim() || null,
              alternativeName: input.team.alternativeName?.trim() || null,
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

// ---------------------------------------------------------------------------
// ADMIN-MASTERDATA-UX-01-C2 / SEASON-01-C3 — Bulk Season Team rollover
// ("Teams übernehmen")
// ---------------------------------------------------------------------------
//
// C1 already proved that registerTeamSeason() with `existingTeamId` set has
// zero lifecycle/current-season restriction and is the single canonical
// TeamSeason materialization path. Operationally, however, a Club Admin
// still had to repeat the full wizard ("reuse existing Team") once per Team.
//
// This slice adds a bulk entry point that reuses registerTeamSeason() —
// called once per selected Team — instead of introducing a parallel
// TeamSeason write path. No TeamSeason write logic is duplicated here.
//
// OrgUnit assignment: the bulk action never asks the admin to re-pick
// OrgUnits. Each selected Team's OrgUnit assignment is carried over from
// that Team's own most recent TeamSeason (any season, most recently started
// first), restricted to currently ACTIVE, same-tenant OrgUnits.
//
// SEASON-01-C3: Season membership and OrgUnit assignment are NOT tightly
// coupled. OrgUnit carry-over is best-effort only — a Team with no such
// history (never registered before, its OrgUnits are now archived, or only
// reachable via drifted cross-tenant historical data) is still registered
// for the target Season, simply with zero TeamSeasonOrgUnit rows. The Team
// is never skipped/omitted from the Season on account of missing or invalid
// OrgUnit history; OrgUnit assignment can be added later via the Team
// settings page.

/**
 * Resolves the OrgUnit IDs to carry over for an existing Team's bulk Season
 * rollover, sourced from that Team's own most recently started TeamSeason.
 * Only currently ACTIVE OrgUnits belonging to `tenantId` are carried
 * forward (archived OrgUnits are never (re-)assigned to a new TeamSeason —
 * same rule as the wizard — and any OrgUnit only reachable via drifted
 * cross-tenant historical data is likewise excluded, never copied).
 *
 * Returns an empty array when the Team has no prior TeamSeason, or none of
 * its OrgUnits are still active/same-tenant — callers must treat that as
 * "not carry-over eligible" and register the Team with zero OrgUnits
 * (SEASON-01-C3), never fall back to a guessed OrgUnit.
 */
async function resolveCarryOverOrgUnitIds(
  teamId: string,
  tenantId: string,
): Promise<string[]> {
  const latestTeamSeason = await prisma.teamSeason.findFirst({
    where: { teamId },
    orderBy: [{ season: { startDate: "desc" } }, { createdAt: "desc" }],
    select: {
      orgUnits: {
        where: { orgUnit: { status: "ACTIVE", tenantId } },
        orderBy: [{ displayOrder: "asc" }],
        select: { orgUnitId: true },
      },
    },
  });

  return latestTeamSeason?.orgUnits.map((o) => o.orgUnitId) ?? [];
}

export type BulkRolloverCandidateTeam = {
  id: string;
  name: string;
  slug: string;
  /**
   * Informational only (SEASON-01-C3): whether an OrgUnit assignment can be
   * carried over automatically. This never gates eligibility — a Team with
   * `hasOrgUnitHistory: false` is still a fully valid bulk-rollover
   * candidate and is registered with zero OrgUnits when selected.
   */
  hasOrgUnitHistory: boolean;
};

/**
 * Returns the default candidate Teams for the "Teams übernehmen" bulk
 * action on a given target Season.
 *
 * Eligibility (per ADMIN-MASTERDATA-UX-01-C2, unchanged by SEASON-01-C3):
 *   - Team.isActive = true (archived/inactive Teams are never offered).
 *   - Team belongs to tenantId (tenant isolation).
 *   - Team does not already have a TeamSeason for seasonId (no duplicates
 *     offered — already-registered Teams are simply absent from the list).
 *
 * OrgUnit history is NOT an eligibility criterion (SEASON-01-C3) — it is
 * surfaced only via `hasOrgUnitHistory` for informational UI purposes.
 *
 * Deliberately does NOT depend on Season.isActive — this list must work for
 * an arbitrary target Season regardless of which one is currently "AKTUELL".
 */
export async function getBulkRolloverCandidateTeams(
  tenantId: string,
  seasonId: string,
): Promise<BulkRolloverCandidateTeam[]> {
  const [teams, registeredTeamSeasons] = await Promise.all([
    prisma.team.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
    prisma.teamSeason.findMany({
      where: { seasonId, team: { tenantId } },
      select: { teamId: true },
    }),
  ]);

  const alreadyRegistered = new Set(registeredTeamSeasons.map((ts) => ts.teamId));
  const candidates = teams.filter((team) => !alreadyRegistered.has(team.id));

  return Promise.all(
    candidates.map(async (team) => ({
      ...team,
      hasOrgUnitHistory:
        (await resolveCarryOverOrgUnitIds(team.id, tenantId)).length > 0,
    })),
  );
}

export type BulkRolloverOutcomeStatus =
  | "CREATED"
  | "ALREADY_PRESENT"
  | "REJECTED_NOT_FOUND"
  | "REJECTED_TENANT_MISMATCH"
  | "REJECTED_INACTIVE"
  | "REJECTED_ERROR";

export type BulkRolloverOutcome = {
  teamId: string;
  teamName: string;
  status: BulkRolloverOutcomeStatus;
  teamSeasonId?: string;
  /** Whether the created/existing TeamSeason carried over any OrgUnit. */
  hasOrgUnit?: boolean;
  message: string;
};

export type BulkRolloverResult = {
  seasonId: string;
  outcomes: BulkRolloverOutcome[];
  createdCount: number;
  alreadyPresentCount: number;
  rejectedCount: number;
};

export type BulkRegisterExistingTeamsInput = {
  /** Tenant context. Originates from the authenticated session. */
  tenantId: string;
  /** Target Season — never required to be Season.isActive. */
  seasonId: string;
  /** Existing Team IDs selected by the Club Admin. */
  teamIds: string[];
};

/**
 * Bulk "Teams übernehmen": establishes the TeamSeason relationship between
 * `seasonId` and every selected existing Team, in one operation.
 *
 * REUSE, not reimplementation: each Team is materialized by calling the
 * exact same canonical registerTeamSeason() used by the single-Team "reuse
 * existing Team" wizard flow, with `existingTeamId` set — never a new Team
 * record. Every mandatory write for one Team (TeamSeason + TeamSeasonOrgUnit)
 * stays atomic via registerTeamSeason()'s own transaction; this loop adds no
 * second write path and no job framework — it purely orchestrates repeated,
 * independently-transactional calls to the existing single-Team primitive.
 *
 * SEASON-01-C3: Season membership and OrgUnit assignment are NOT tightly
 * coupled. A valid active same-tenant Team not yet registered for `seasonId`
 * is ALWAYS registered (CREATED), regardless of whether it has any
 * carry-over-eligible OrgUnit history — OrgUnit carry-over
 * (resolveCarryOverOrgUnitIds) is attempted best-effort and passed to
 * registerTeamSeason() with `allowEmptyOrgUnits: true`; when no valid
 * historical OrgUnit exists, the TeamSeason is still created with zero
 * TeamSeasonOrgUnit rows. The Team is never skipped for this reason.
 *
 * Idempotent: a Team already registered for seasonId is reported as
 * ALREADY_PRESENT (registerTeamSeason's own authoritative in-transaction
 * check), never duplicated — safe to re-run the whole bulk action.
 *
 * Tenant isolation: every Team is re-validated against tenantId here (not
 * just trusted from the candidate list), so a cross-tenant Team ID can never
 * be smuggled into another tenant's Season.
 */
export async function bulkRegisterExistingTeamsForSeason(
  input: BulkRegisterExistingTeamsInput,
): Promise<BulkRolloverResult> {
  const season = await prisma.season.findUnique({
    where: { id: input.seasonId },
    select: { id: true },
  });

  if (!season) {
    throw new Error("SEASON_NOT_FOUND");
  }

  const uniqueTeamIds = [...new Set(input.teamIds.filter(Boolean))];
  const outcomes: BulkRolloverOutcome[] = [];

  for (const teamId of uniqueTeamIds) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, tenantId: true, isActive: true },
    });

    if (!team) {
      outcomes.push({
        teamId,
        teamName: teamId,
        status: "REJECTED_NOT_FOUND",
        message: "Team nicht gefunden.",
      });
      continue;
    }

    if (team.tenantId !== input.tenantId) {
      outcomes.push({
        teamId,
        teamName: team.name,
        status: "REJECTED_TENANT_MISMATCH",
        message: "Team gehört nicht zum aktiven Mandanten.",
      });
      continue;
    }

    if (!team.isActive) {
      outcomes.push({
        teamId,
        teamName: team.name,
        status: "REJECTED_INACTIVE",
        message: "Team ist archiviert/inaktiv und kann nicht übernommen werden.",
      });
      continue;
    }

    // Best-effort OrgUnit carry-over — never blocks Team registration
    // (SEASON-01-C3). An empty result simply means the TeamSeason is
    // created with zero TeamSeasonOrgUnit rows.
    const orgUnitIds = await resolveCarryOverOrgUnitIds(teamId, input.tenantId);

    const result = await registerTeamSeason({
      tenantId: input.tenantId,
      seasonId: input.seasonId,
      orgUnitIds,
      allowEmptyOrgUnits: true,
      existingTeamId: teamId,
      team: { name: team.name },
      participationType: ParticipationType.TRAINING,
      websiteVisible: true,
      infoboardVisible: true,
    });

    if (result.ok) {
      outcomes.push({
        teamId,
        teamName: team.name,
        status: "CREATED",
        teamSeasonId: result.teamSeasonId,
        hasOrgUnit: orgUnitIds.length > 0,
        message:
          orgUnitIds.length > 0
            ? "Team-Saison erstellt."
            : "Team-Saison erstellt (ohne Organisationseinheit — kann später ergänzt werden).",
      });
    } else if (result.code === "TEAM_SEASON_ALREADY_EXISTS") {
      outcomes.push({
        teamId,
        teamName: team.name,
        status: "ALREADY_PRESENT",
        message: "Team ist für diese Saison bereits registriert.",
      });
    } else {
      outcomes.push({
        teamId,
        teamName: team.name,
        status: "REJECTED_ERROR",
        message: result.message,
      });
    }
  }

  return {
    seasonId: input.seasonId,
    outcomes,
    createdCount: outcomes.filter((o) => o.status === "CREATED").length,
    alreadyPresentCount: outcomes.filter((o) => o.status === "ALREADY_PRESENT").length,
    rejectedCount: outcomes.filter((o) => o.status.startsWith("REJECTED")).length,
  };
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
