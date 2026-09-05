/**
 * lib/provider-mapping/provider-mapping-service.ts
 *
 * Canonical provider-neutral mapping service.
 *
 * Implements the administrator-facing operations:
 *   - listMappedTeams         — all team seasons with their current mappings
 *   - listUnmappedProviderTeams — provider teams with no canonical mapping
 *   - suggestProviderMappings  — ranked mapping candidates with confidence
 *   - createProviderMapping    — create a manual provider mapping
 *   - replaceProviderMapping   — replace an existing mapping (atomic)
 *   - removeProviderMapping    — remove a mapping
 *   - validateProviderMapping  — validate inputs before write
 *
 * Architecture invariants:
 *   - No provider-specific logic here — delegates to provider adapters via registry.
 *   - tenantId always comes from the session — never from input.
 *   - All DB access is through the query layer (this file: mutations only via Prisma).
 *   - Competition is context only — does not own provider mappings.
 *   - No auto-mapping — suggestions are always awaited human confirmation.
 *   - Archived TeamSeason and archived Competition are rejected for new mappings.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { getProviderAdapter } from "./provider-registry";
import {
  listProviderMappings,
  getMappedExternalTeamIds,
  externalTeamIsMapped,
  teamSeasonHasMappingForProvider,
} from "./provider-mapping-queries";
import { suggestMappings, type SuggestionContext } from "./suggestion-engine";
import type {
  ProviderMappingDto,
  ProviderTeam,
  MappingSuggestion,
  CreateProviderMappingInput,
  CreateProviderMappingResult,
  CreateProviderMappingErrorCode,
  RemoveProviderMappingResult,
  ValidateProviderMappingResult,
  MappingSource,
  ConfidenceLevel,
} from "./types";
import { MappingFilterParams } from "./provider-mapping-queries";

// ── Re-exports ────────────────────────────────────────────────────────────────

export { listProviderMappings, getMappingsForTeamSeason } from "./provider-mapping-queries";

// ── Mapped teams ──────────────────────────────────────────────────────────────

/**
 * Returns all TeamSeasons that have at least one provider mapping for this tenant.
 *
 * Used for the admin overview table.
 */
export async function listMappedTeams(
  tenantId: string,
  filters: MappingFilterParams = {},
): Promise<ProviderMappingDto[]> {
  return listProviderMappings(tenantId, {
    ...filters,
    unmappedOnly: false,
  });
}

// ── Unmapped provider teams ───────────────────────────────────────────────────

/**
 * Returns provider teams that have no canonical mapping (teamSeasonId = null)
 * for the given provider within a season.
 *
 * Uses the provider adapter to fetch the full team list, then filters out
 * those that are already mapped.
 *
 * @throws when no adapter is registered for the given provider.
 */
export async function listUnmappedProviderTeams(
  tenantId: string,
  provider: string,
  competitionId?: string,
): Promise<ProviderTeam[]> {
  const adapter = getProviderAdapter(provider);
  if (!adapter) {
    throw new Error(`No adapter registered for provider "${provider}".`);
  }

  const [allTeams, seasonId] = await Promise.all([
    adapter.fetchProviderTeams({ tenantId, competitionId }),
    adapter.getProviderSeasonId(tenantId),
  ]);

  const mappedIds = await getMappedExternalTeamIds(tenantId, provider, seasonId);

  return allTeams.filter((t) => !mappedIds.has(t.externalTeamId));
}

// ── Suggestions ───────────────────────────────────────────────────────────────

/**
 * Produces ranked mapping suggestions for a TeamSeason.
 *
 * Fetches all provider teams via the adapter, resolves competition context,
 * and delegates to the pure suggestion engine.
 *
 * Never auto-maps. Returns suggestions for human review only.
 *
 * @throws when no adapter is registered for the given provider.
 */
export async function suggestProviderMappings(
  tenantId: string,
  teamSeasonId: string,
  provider: string,
  competitionId?: string,
): Promise<MappingSuggestion[]> {
  const adapter = getProviderAdapter(provider);
  if (!adapter) {
    throw new Error(`No adapter registered for provider "${provider}".`);
  }

  // Fetch TeamSeason with all context needed for scoring
  const teamSeason = await prisma.teamSeason.findFirst({
    where: { id: teamSeasonId, team: { tenantId } },
    select: {
      id: true,
      displayName: true,
      team: {
        select: {
          id: true,
          name: true,
          ageGroup: true,
          genderGroup: true,
        },
      },
      season: { select: { id: true } },
      competitions: {
        where: competitionId ? { competitionId } : {},
        select: {
          competition: {
            select: {
              id: true,
              officialName: true,
              gender: true,
              ageCategory: true,
              externalCompetitionId: true,
            },
          },
          isPrimary: true,
        },
        orderBy: { isPrimary: "desc" },
        take: 1,
      },
    },
  });

  if (!teamSeason) return [];

  // Resolve competition context
  const competition = teamSeason.competitions[0]?.competition ?? null;
  let competitionLeagueId: number | null = null;
  let competitionLeagueName: string | null = null;

  if (competition) {
    competitionLeagueId = competition.externalCompetitionId ?? null;
    competitionLeagueName = competition.officialName;
  }

  // Resolve historical mappings (other seasons) for this team
  const historicalMappings = await prisma.teamExternalMapping.findMany({
    where: {
      tenantId,
      provider,
      teamId: teamSeason.team.id,
      teamSeasonId: { not: teamSeasonId },
    },
    select: { externalTeamId: true },
  });

  const historicalIds = new Set(historicalMappings.map((m) => m.externalTeamId));

  // Fetch all available provider teams (filtered by competition when provided)
  const providerTeams = await adapter.fetchProviderTeams({
    tenantId,
    competitionId: competition?.id,
  });

  const context: SuggestionContext = {
    teamSeasonDisplayName: teamSeason.displayName,
    teamName: teamSeason.team.name,
    competitionLeagueId,
    competitionLeagueName,
    ageCategory: competition?.ageCategory ?? teamSeason.team.ageGroup ?? null,
    gender: competition?.gender ?? teamSeason.team.genderGroup ?? null,
    historicalExternalTeamIds: historicalIds,
  };

  return suggestMappings(providerTeams, context);
}

// ── Create mapping ─────────────────────────────────────────────────────────────

/**
 * Creates a manual provider mapping for a TeamSeason.
 *
 * Validates:
 *   - TeamSeason exists and belongs to the tenant
 *   - TeamSeason is not archived
 *   - Competition (if provided) belongs to tenant and is not archived
 *   - Provider adapter is registered
 *   - External team is not already mapped to another TeamSeason
 *   - TeamSeason does not already have a mapping for this provider
 *
 * Competition is used as informational context only — it does not own the mapping.
 */
export async function createProviderMapping(
  input: CreateProviderMappingInput,
): Promise<CreateProviderMappingResult> {
  const { tenantId, teamSeasonId, provider } = input;

  // 1. Validate TeamSeason
  const teamSeason = await prisma.teamSeason.findFirst({
    where: { id: teamSeasonId, team: { tenantId } },
    select: {
      id: true,
      status: true,
      teamId: true,
      team: { select: { name: true, tenantId: true } },
    },
  });

  if (!teamSeason) {
    return {
      ok: false,
      code: "TEAM_SEASON_NOT_FOUND",
      message: "TeamSeason nicht gefunden.",
    };
  }

  if (teamSeason.status === "ARCHIVED") {
    return {
      ok: false,
      code: "TEAM_SEASON_ARCHIVED",
      message: "Archivierte TeamSeason-Einträge können nicht verknüpft werden.",
    };
  }

  // 2. Validate Competition (when provided)
  if (input.competitionId) {
    const competition = await prisma.competition.findFirst({
      where: { id: input.competitionId, tenantId },
      select: { id: true, tenantId: true, isArchived: true },
    });

    if (!competition) {
      return {
        ok: false,
        code: "COMPETITION_NOT_FOUND",
        message: "Wettbewerb nicht gefunden.",
      };
    }

    if (competition.isArchived) {
      return {
        ok: false,
        code: "COMPETITION_ARCHIVED",
        message: "Archivierte Wettbewerbe können nicht als Kontext verwendet werden.",
      };
    }
  }

  // 3. Validate provider adapter
  const adapter = getProviderAdapter(provider);
  if (!adapter) {
    return {
      ok: false,
      code: "PROVIDER_NOT_FOUND",
      message: `Kein Adapter für Anbieter "${provider}" registriert.`,
    };
  }

  // 4. Check duplicate: TeamSeason already mapped for this provider
  const alreadyMapped = await teamSeasonHasMappingForProvider(
    tenantId,
    teamSeasonId,
    provider,
  );
  if (alreadyMapped) {
    return {
      ok: false,
      code: "ALREADY_MAPPED",
      message: `Die TeamSeason ist bereits für den Anbieter "${provider}" verknüpft. Ersetzen Sie die bestehende Zuordnung stattdessen.`,
    };
  }

  // 5. Check duplicate: external team already mapped to another TeamSeason
  const externalAlreadyMapped = await externalTeamIsMapped(
    tenantId,
    provider,
    input.externalTeamId,
    input.externalSeasonId,
  );
  if (externalAlreadyMapped) {
    return {
      ok: false,
      code: "EXTERNAL_TEAM_ALREADY_MAPPED",
      message: "Dieses externe Team ist bereits einer anderen TeamSeason zugeordnet.",
    };
  }

  // 6. Write mapping (upsert on unique key — handles SYNC-created rows)
  try {
    const row = await prisma.teamExternalMapping.upsert({
      where: {
        tenantId_provider_externalTeamId_externalSeasonId: {
          tenantId,
          provider,
          externalTeamId: input.externalTeamId,
          externalSeasonId: input.externalSeasonId,
        },
      },
      create: {
        tenantId,
        teamId: teamSeason.teamId,
        provider,
        externalTeamId: input.externalTeamId,
        externalSeasonId: input.externalSeasonId,
        teamSeasonId,
        mappingSource: "MANUAL" satisfies MappingSource,
        confidenceLevel: (input.confidenceLevel ?? null) as string | null,
        mappingCompetitionId: input.competitionId ?? null,
        lastSyncedAt: new Date(),
      },
      update: {
        teamId: teamSeason.teamId,
        teamSeasonId,
        mappingSource: "MANUAL" satisfies MappingSource,
        confidenceLevel: (input.confidenceLevel ?? null) as string | null,
        mappingCompetitionId: input.competitionId ?? null,
        lastSyncedAt: new Date(),
      },
      select: {
        id: true,
        tenantId: true,
        teamId: true,
        team: { select: { name: true } },
        teamSeasonId: true,
        teamSeason: { select: { displayName: true } },
        provider: true,
        externalTeamId: true,
        externalSeasonId: true,
        providerTeamName: true,
        providerLeagueId: true,
        providerLeagueName: true,
        providerOrganisationId: true,
        providerIsActive: true,
        mappingSource: true,
        confidenceLevel: true,
        mappingCompetitionId: true,
        mappingCompetition: { select: { officialName: true } },
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const dto: ProviderMappingDto = {
      id: row.id,
      tenantId: row.tenantId,
      teamId: row.teamId,
      teamName: row.team.name,
      teamSeasonId: row.teamSeasonId,
      teamSeasonDisplayName: row.teamSeason?.displayName ?? null,
      provider: row.provider,
      externalTeamId: row.externalTeamId,
      externalSeasonId: row.externalSeasonId,
      providerTeamName: row.providerTeamName,
      providerLeagueId: row.providerLeagueId,
      providerLeagueName: row.providerLeagueName,
      providerOrganisationId: row.providerOrganisationId,
      providerIsActive: row.providerIsActive,
      mappingSource: row.mappingSource as MappingSource,
      confidenceLevel: (row.confidenceLevel ?? null) as ConfidenceLevel | null,
      mappingCompetitionId: row.mappingCompetitionId,
      mappingCompetitionName: row.mappingCompetition?.officialName ?? null,
      lastSyncedAt: row.lastSyncedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };

    return { ok: true, mapping: dto };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return {
        ok: false,
        code: "EXTERNAL_TEAM_ALREADY_MAPPED",
        message: "Dieses externe Team ist bereits einer anderen TeamSeason zugeordnet.",
      };
    }
    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: err instanceof Error ? err.message : "Unbekannter Fehler.",
    };
  }
}

// ── Replace mapping ────────────────────────────────────────────────────────────

/**
 * Replaces an existing mapping for a TeamSeason with a new provider team.
 *
 * Atomic: unlinking the old mapping and creating the new one are executed
 * inside a single Prisma interactive transaction. If the new mapping fails
 * validation the transaction rolls back and the old mapping is preserved.
 *
 * Used when an administrator wants to correct a wrong mapping.
 */
export async function replaceProviderMapping(
  tenantId: string,
  existingMappingId: string,
  input: CreateProviderMappingInput,
): Promise<CreateProviderMappingResult> {
  // 1. Verify existing mapping belongs to tenant (before entering transaction)
  const existing = await prisma.teamExternalMapping.findFirst({
    where: { id: existingMappingId, tenantId },
    select: { id: true, provider: true, teamSeasonId: true },
  });

  if (!existing) {
    return {
      ok: false,
      code: "TEAM_SEASON_NOT_FOUND",
      message: "Die bestehende Zuordnung wurde nicht gefunden.",
    };
  }

  // 2. Run all service-layer validation before opening the DB transaction.
  //    Validation calls are read-only and cheap; performing them outside the
  //    transaction avoids holding a lock during external adapter calls
  //    (e.g. getProviderSeasonId hits the DB or cache).
  const validation = await validateProviderMapping(input);
  if (!validation.valid) {
    // Map known validation error messages to typed codes for callers
    const firstErr = validation.errors[0] ?? "";
    const code: CreateProviderMappingErrorCode =
      firstErr.includes("bereits einer anderen") ? "EXTERNAL_TEAM_ALREADY_MAPPED"
      : firstErr.includes("TeamSeason nicht gefunden") ? "TEAM_SEASON_NOT_FOUND"
      : firstErr.includes("archiv") || firstErr.includes("Archiv") ? "TEAM_SEASON_ARCHIVED"
      : firstErr.includes("Mandant") ? "TEAM_SEASON_TENANT_MISMATCH"
      : firstErr.includes("Adapter") || firstErr.includes("Anbieter") ? "PROVIDER_NOT_FOUND"
      : "UNKNOWN_ERROR";
    return { ok: false, code, message: validation.errors.join("; ") };
  }

  // Additional duplicate checks (adapter already validated above)
  const adapter = getProviderAdapter(input.provider);
  if (!adapter) {
    return { ok: false, code: "PROVIDER_NOT_FOUND", message: `Kein Adapter für Anbieter "${input.provider}" registriert.` };
  }

  // Check external team not mapped elsewhere (excluding the mapping being replaced)
  const externalAlreadyMapped = await prisma.teamExternalMapping.findFirst({
    where: {
      tenantId,
      provider: input.provider,
      externalTeamId: input.externalTeamId,
      externalSeasonId: input.externalSeasonId,
      teamSeasonId: { not: null },
      id: { not: existingMappingId },
    },
    select: { id: true },
  });
  if (externalAlreadyMapped) {
    return {
      ok: false,
      code: "EXTERNAL_TEAM_ALREADY_MAPPED",
      message: "Dieses externe Team ist bereits einer anderen TeamSeason zugeordnet.",
    };
  }

  // 3. Perform atomic replace in a transaction
  try {
    const row = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Unlink old mapping (preserve row for audit)
      await tx.teamExternalMapping.update({
        where: { id: existingMappingId },
        data: { teamSeasonId: null },
      });

      // Upsert new mapping
      return tx.teamExternalMapping.upsert({
        where: {
          tenantId_provider_externalTeamId_externalSeasonId: {
            tenantId,
            provider: input.provider,
            externalTeamId: input.externalTeamId,
            externalSeasonId: input.externalSeasonId,
          },
        },
        create: {
          tenantId,
          teamId: (
            await tx.teamSeason.findFirstOrThrow({
              where: {
                id: input.teamSeasonId,
                team: { tenantId },
              },
              select: { teamId: true },
            })
          ).teamId,
          provider: input.provider,
          externalTeamId: input.externalTeamId,
          externalSeasonId: input.externalSeasonId,
          teamSeasonId: input.teamSeasonId,
          mappingSource: "MANUAL" satisfies MappingSource,
          confidenceLevel: (input.confidenceLevel ?? null) as string | null,
          mappingCompetitionId: input.competitionId ?? null,
          lastSyncedAt: new Date(),
        },
        update: {
          teamSeasonId: input.teamSeasonId,
          mappingSource: "MANUAL" satisfies MappingSource,
          confidenceLevel: (input.confidenceLevel ?? null) as string | null,
          mappingCompetitionId: input.competitionId ?? null,
          lastSyncedAt: new Date(),
        },
        select: {
          id: true,
          tenantId: true,
          teamId: true,
          team: { select: { name: true } },
          teamSeasonId: true,
          teamSeason: { select: { displayName: true } },
          provider: true,
          externalTeamId: true,
          externalSeasonId: true,
          providerTeamName: true,
          providerLeagueId: true,
          providerLeagueName: true,
          providerOrganisationId: true,
          providerIsActive: true,
          mappingSource: true,
          confidenceLevel: true,
          mappingCompetitionId: true,
          mappingCompetition: { select: { officialName: true } },
          lastSyncedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    const dto: ProviderMappingDto = {
      id: row.id,
      tenantId: row.tenantId,
      teamId: row.teamId,
      teamName: row.team.name,
      teamSeasonId: row.teamSeasonId,
      teamSeasonDisplayName: row.teamSeason?.displayName ?? null,
      provider: row.provider,
      externalTeamId: row.externalTeamId,
      externalSeasonId: row.externalSeasonId,
      providerTeamName: row.providerTeamName,
      providerLeagueId: row.providerLeagueId,
      providerLeagueName: row.providerLeagueName,
      providerOrganisationId: row.providerOrganisationId,
      providerIsActive: row.providerIsActive,
      mappingSource: row.mappingSource as MappingSource,
      confidenceLevel: (row.confidenceLevel ?? null) as ConfidenceLevel | null,
      mappingCompetitionId: row.mappingCompetitionId,
      mappingCompetitionName: row.mappingCompetition?.officialName ?? null,
      lastSyncedAt: row.lastSyncedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };

    return { ok: true, mapping: dto };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return {
        ok: false,
        code: "EXTERNAL_TEAM_ALREADY_MAPPED",
        message: "Dieses externe Team ist bereits einer anderen TeamSeason zugeordnet.",
      };
    }
    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: err instanceof Error ? err.message : "Unbekannter Fehler.",
    };
  }
}

// ── Remove mapping ─────────────────────────────────────────────────────────────

/**
 * Removes a provider mapping for a TeamSeason.
 *
 * Does NOT delete the TeamExternalMapping row — it sets teamSeasonId to null
 * to preserve the provider record for historical and audit purposes.
 * SYNC-created rows are preserved; MANUAL-created rows are also preserved.
 */
export async function removeProviderMapping(
  tenantId: string,
  mappingId: string,
): Promise<RemoveProviderMappingResult> {
  const existing = await prisma.teamExternalMapping.findFirst({
    where: { id: mappingId, tenantId },
    select: { id: true },
  });

  if (!existing) {
    return {
      ok: false,
      code: "MAPPING_NOT_FOUND",
      message: "Zuordnung nicht gefunden.",
    };
  }

  try {
    await prisma.teamExternalMapping.update({
      where: { id: mappingId },
      data: { teamSeasonId: null },
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: err instanceof Error ? err.message : "Unbekannter Fehler.",
    };
  }
}

// ── Validate mapping ───────────────────────────────────────────────────────────

/**
 * Validates all inputs for creating a provider mapping without writing to the DB.
 *
 * Useful for client-side pre-validation before submitting the mapping workflow.
 */
export async function validateProviderMapping(
  input: CreateProviderMappingInput,
): Promise<ValidateProviderMappingResult> {
  const errors: string[] = [];

  // 1. Provider adapter check
  if (!getProviderAdapter(input.provider)) {
    errors.push(`Kein Adapter für Anbieter "${input.provider}" registriert.`);
  }

  // 2. TeamSeason
  const teamSeason = await prisma.teamSeason.findFirst({
    where: { id: input.teamSeasonId, team: { tenantId: input.tenantId } },
    select: { status: true, team: { select: { tenantId: true } } },
  });

  if (!teamSeason) {
    errors.push("TeamSeason nicht gefunden.");
  } else {
    if (teamSeason.status === "ARCHIVED") {
      errors.push("Archivierte TeamSeason-Einträge können nicht verknüpft werden.");
    }
  }

  // 3. Competition (optional)
  if (input.competitionId) {
    const competition = await prisma.competition.findFirst({
      where: { id: input.competitionId, tenantId: input.tenantId },
      select: { tenantId: true, isArchived: true },
    });

    if (!competition) {
      errors.push("Wettbewerb nicht gefunden.");
    } else {
      if (competition.isArchived) {
        errors.push("Archivierter Wettbewerb kann nicht als Kontext verwendet werden.");
      }
    }
  }

  // 4. Duplicate check
  const alreadyMapped = await externalTeamIsMapped(
    input.tenantId,
    input.provider,
    input.externalTeamId,
    input.externalSeasonId,
  );
  if (alreadyMapped) {
    errors.push("Dieses externe Team ist bereits einer anderen TeamSeason zugeordnet.");
  }

  return { valid: errors.length === 0, errors };
}
