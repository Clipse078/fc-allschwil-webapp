/**
 * lib/standings/standings-service.ts
 *
 * Public API for the canonical standings engine.
 *
 * STANDINGS-01: This is the single entry point for all standings calculations.
 * Consumers (website APIs, matchcenter, future mobile app) call this service
 * and receive canonical StandingRow / StandingTable DTOs.
 *
 * Architecture invariants:
 *   - No provider logic. No SFV imports.
 *   - All calculation is delegated to engine.ts (pure functions).
 *   - All data access is delegated to queries.ts.
 *   - Errors are reported as StandingsError with canonical error codes.
 *   - All operations are tenant-scoped.
 *
 * Future extensibility:
 *   - publishStandings() is a hook point for pushing results to a cache,
 *     CDN, or external aggregator. Currently returns the table in-memory.
 *   - Point model overrides: pass a custom IPointModel to any method.
 *   - Deductions / bonus points: post-process rows before returning.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  StandingTable,
  StandingRow,
  CalculateCompetitionStandingsInput,
  CalculateTeamStandingInput,
  CalculateTenantStandingsInput,
  TenantStandingsResult,
  IPointModel,
} from "./types";
import { StandingsError } from "./errors";
import { buildStandingTable, extractTeamRow } from "./engine";
import { defaultPointModel } from "./point-model";
import {
  fetchCompetitionById,
  buildTeamRegistry,
  fetchMatchResultsForCompetition,
  fetchAllCompetitionsForTenant,
  buildAllTeamRegistries,
  fetchAllMatchResultsForTenant,
  type StandingsDatabase,
} from "./queries";

// ── Database singleton ──────────────────────────────────────────────────────

/**
 * Resolves the database client.
 * Accepts an optional override for testing — callers using the production
 * path do not need to pass this.
 */
function resolveDb(db?: StandingsDatabase): StandingsDatabase {
  return db ?? (prisma as unknown as StandingsDatabase);
}

// ── calculateCompetitionStandings ───────────────────────────────────────────

/**
 * Calculates the complete standings table for a single competition.
 *
 * Steps:
 *   1. Resolve the competition (must exist and be non-archived).
 *   2. Build a TeamDescriptor registry from all enrolled TeamSeasons.
 *   3. Fetch all FINISHED canonical match results for the competition.
 *   4. Run the engine to produce a sorted StandingTable.
 *
 * @throws StandingsError with code COMPETITION_NOT_FOUND when not resolvable.
 */
export async function calculateCompetitionStandings(
  input: CalculateCompetitionStandingsInput,
  db?: StandingsDatabase,
): Promise<StandingTable> {
  const database = resolveDb(db);
  const pointModel: IPointModel = input.pointModel ?? defaultPointModel;

  const competition = await fetchCompetitionById(
    database,
    input.tenantId,
    input.competitionId,
  );

  if (!competition) {
    throw new StandingsError(
      "COMPETITION_NOT_FOUND",
      `Competition ${input.competitionId} not found for tenant ${input.tenantId}`,
    );
  }

  const teamRegistry = await buildTeamRegistry(
    database,
    input.tenantId,
    input.competitionId,
  );

  const results = await fetchMatchResultsForCompetition(
    database,
    input.tenantId,
    input.competitionId,
    teamRegistry,
  );

  return buildStandingTable(
    input.competitionId,
    input.tenantId,
    results,
    teamRegistry,
    pointModel,
  );
}

// ── calculateTeamStanding ───────────────────────────────────────────────────

/**
 * Calculates a single team's standing row within a competition.
 *
 * Builds the full table internally then extracts the team's row.
 * Returns null when the team has no record in the competition.
 *
 * @throws StandingsError with code COMPETITION_NOT_FOUND when not resolvable.
 */
export async function calculateTeamStanding(
  input: CalculateTeamStandingInput,
  db?: StandingsDatabase,
): Promise<StandingRow | null> {
  const table = await calculateCompetitionStandings(
    {
      tenantId: input.tenantId,
      competitionId: input.competitionId,
      pointModel: input.pointModel,
    },
    db,
  );

  return extractTeamRow(table, input.teamSeasonId);
}

// ── calculateTenantStandings ────────────────────────────────────────────────

/**
 * Calculates standings for ALL active competitions belonging to a tenant.
 *
 * Returns one StandingTable per competition. Competitions with no enrolled
 * teams or no FINISHED matches return an empty table (not an error).
 *
 * @throws StandingsError with code TENANT_NOT_FOUND when tenantId is empty.
 */
export async function calculateTenantStandings(
  input: CalculateTenantStandingsInput,
  db?: StandingsDatabase,
): Promise<TenantStandingsResult> {
  if (!input.tenantId.trim()) {
    throw new StandingsError(
      "TENANT_NOT_FOUND",
      "tenantId is required for tenant standings calculation",
    );
  }

  const database = resolveDb(db);
  const pointModel: IPointModel = input.pointModel ?? defaultPointModel;

  const competitions = await fetchAllCompetitionsForTenant(
    database,
    input.tenantId,
  );

  const registries = await buildAllTeamRegistries(database, input.tenantId);

  const resultsByCompetition = await fetchAllMatchResultsForTenant(
    database,
    input.tenantId,
    registries,
  );

  const tables: StandingTable[] = [];

  for (const competition of competitions) {
    const registry = registries.get(competition.id) ?? new Map();
    const results = resultsByCompetition.get(competition.id) ?? [];

    const table = buildStandingTable(
      competition.id,
      input.tenantId,
      results,
      registry,
      pointModel,
    );

    tables.push(table);
  }

  return {
    tenantId: input.tenantId,
    tables,
  };
}

// ── buildStandingTable (re-exported) ────────────────────────────────────────

/**
 * Re-exports the pure buildStandingTable engine function for callers that
 * already have CanonicalMatchResult data (e.g. in tests or migration scripts).
 */
export { buildStandingTable } from "./engine";

// ── publishStandings ────────────────────────────────────────────────────────

/**
 * Calculates and "publishes" the standings for a competition.
 *
 * STANDINGS-01: In this slice, publishing simply returns the calculated table.
 * This function is the designated hook point for future integrations:
 *   - Writing to a Redis / edge cache.
 *   - Pushing to a CDN.
 *   - Emitting a webhook.
 *   - Writing to a persisted standings snapshot table.
 *
 * Callers should prefer publishStandings() over calculateCompetitionStandings()
 * when they intend the result to be made available for public consumption.
 */
export async function publishStandings(
  input: CalculateCompetitionStandingsInput,
  db?: StandingsDatabase,
): Promise<StandingTable> {
  return calculateCompetitionStandings(input, db);
}
