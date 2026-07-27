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
 *   5. TeamSeason is created with mandatory OrgUnit assignments.
 *   6. TeamSeasonOrgUnit rows are created (first = primary).
 *   7. Optional TeamExternalMapping is created/updated.
 *   8. All mandatory writes are atomic within a single Prisma transaction.
 *
 * Relationship to createCanonicalTeamSeason():
 *   This service handles the FULL registration orchestration including Team
 *   identity creation and optional federation mapping. It inlines the core
 *   TeamSeason+OrgUnit logic (reusing pure helpers from team-season-rules.ts)
 *   rather than calling createCanonicalTeamSeason() because a nested transaction
 *   would be required. createCanonicalTeamSeason() remains the canonical path
 *   for creating a TeamSeason for an ALREADY-EXISTING Team when no outer
 *   transaction is needed.
 *
 * Transaction safety:
 *   All mandatory writes (Team optional, TeamSeason, TeamSeasonOrgUnit) are
 *   wrapped in a single Prisma $transaction. The optional TeamExternalMapping
 *   is included in the same transaction to ensure atomicity.
 *
 * Tenant isolation:
 *   tenantId always originates from the session (never from the request body).
 *   All entity validations are scoped to tenantId.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma, OrgUnitStatus } from "@prisma/client";
import {
  normalizeTeamName,
  normalizeTeamSlug,
  buildTeamSeasonDisplayName,
  buildTeamSeasonShortName,
} from "./team-season-rules";

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
   * Optional federation mapping for the newly created TeamSeason.
   * When provided, a TeamExternalMapping row is created/updated.
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
  | "FEDERATION_MAPPING_MISMATCH"
  | "UNKNOWN_ERROR";

const ACTIVE_ORG_UNIT_STATUSES: OrgUnitStatus[] = ["ACTIVE"];

// Default legacy TeamCategory for new teams (not used for business logic).
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
      code: "ORG_UNIT_REQUIRED",
      message: "Teamname ist erforderlich.",
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
    select: { id: true, name: true, key: true, startDate: true, endDate: true, isActive: true },
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

  // 5. Pre-validate federation mapping conflict (outside transaction)
  if (input.federationMapping) {
    const { provider, externalTeamId, externalSeasonId } = input.federationMapping;
    const conflictingMapping = await prisma.teamExternalMapping.findUnique({
      where: {
        tenantId_provider_externalTeamId_externalSeasonId: {
          tenantId: input.tenantId,
          provider,
          externalTeamId,
          externalSeasonId,
        },
      },
      select: { id: true, teamSeasonId: true, teamId: true },
    });

    if (conflictingMapping && conflictingMapping.teamSeasonId !== null) {
      return {
        ok: false,
        code: "FEDERATION_MAPPING_CONFLICT",
        message:
          "Dieses Verbandsteam ist für die ausgewählte Saison bereits einem Team zugeordnet.",
      };
    }
  }

  // 6. Run everything in a single transaction
  try {
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 6a. Find or create the Team identity
        let teamId: string;
        let createdTeamIdentity = false;

        if (input.existingTeamId) {
          // Reuse existing Team — verify TeamSeason doesn't already exist
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
          // Check slug uniqueness within tenant
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

          // Create new Team identity
          const newTeam = await tx.team.create({
            data: {
              name: teamName,
              slug: teamSlug,
              tenantId: input.tenantId,
              // Legacy compatibility field — not used for new business logic
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

        // 6b. Build display name
        const displayName =
          buildTeamSeasonDisplayName(teamName);

        const shortName =
          input.team.shortName?.trim() ||
          buildTeamSeasonShortName(teamName);

        // 6c. Create TeamSeason
        const teamSeason = await tx.teamSeason.create({
          data: {
            teamId,
            seasonId: input.seasonId,
            displayName,
            shortName,
            status: "ACTIVE",
            websiteVisible: input.websiteVisible,
            infoboardVisible: input.infoboardVisible,
          },
          select: { id: true },
        });

        // 6d. Create TeamSeasonOrgUnit rows — first OrgUnit is primary
        const orgUnitData = uniqueOrgUnitIds.map((orgUnitId, index) => ({
          tenantId: input.tenantId,
          teamSeasonId: teamSeason.id,
          orgUnitId,
          isPrimary: index === 0,
          displayOrder: index,
        }));

        await tx.teamSeasonOrgUnit.createMany({ data: orgUnitData });

        // 6e. Create/update optional federation mapping
        if (input.federationMapping) {
          const {
            provider,
            externalTeamId,
            externalSeasonId,
            providerTeamName,
            providerLeagueName,
          } = input.federationMapping;

          await tx.teamExternalMapping.upsert({
            where: {
              tenantId_provider_externalTeamId_externalSeasonId: {
                tenantId: input.tenantId,
                provider,
                externalTeamId,
                externalSeasonId,
              },
            },
            update: {
              teamId,
              teamSeasonId: teamSeason.id,
              providerTeamName: providerTeamName ?? null,
              providerLeagueName: providerLeagueName ?? null,
              lastSyncedAt: new Date(),
            },
            create: {
              tenantId: input.tenantId,
              teamId,
              provider,
              externalTeamId,
              externalSeasonId,
              teamSeasonId: teamSeason.id,
              providerTeamName: providerTeamName ?? null,
              providerLeagueName: providerLeagueName ?? null,
              providerIsActive: true,
              lastSyncedAt: new Date(),
            },
          });
        }

        return {
          teamId,
          teamSeasonId: teamSeason.id,
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
 *
 * All seasons are returned with lifecycle status.
 * Ordering: most recent first.
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
 * Returns existing Teams for a tenant — used for the "reuse existing Team" feature.
 *
 * Returns name, slug, and ID so the wizard can offer matching teams.
 * Results are filtered to the given tenant.
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
 *
 * Returns TeamExternalMapping rows where teamSeasonId IS NULL — these are
 * provider-known teams that have not yet been linked to a seasonal team.
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
