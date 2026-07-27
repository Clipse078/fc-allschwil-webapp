/**
 * lib/standings/queries.ts
 *
 * Database query layer for the canonical standings engine.
 *
 * STANDINGS-01: This module bridges the canonical database schema to the
 * CanonicalMatchResult type consumed by the engine. It is the ONLY place
 * where the standings system touches the database.
 *
 * Architecture invariants:
 *   - All queries are tenant-scoped. tenantId must come from a trusted session
 *     context — never from caller-supplied user input.
 *   - Results are plain serializable objects (CanonicalMatchResult, TeamDescriptor).
 *   - No provider-specific logic. Scores and team IDs come from the canonical
 *     Event and MatchExternalMapping tables — never from raw provider payloads.
 *   - Avoids N+1: competition teams and match results are fetched in batch.
 *   - Only FINISHED matches are surfaced (EventStatus.COMPLETED maps to FINISHED).
 *
 * Match resolution strategy:
 *   The canonical match result is derived from:
 *     Event (status = COMPLETED, type = MATCH) + MatchExternalMapping (scores)
 *
 *   A match is included only when:
 *     1. Event.status is COMPLETED (mapped to CanonicalMatchStatus.FINISHED).
 *     2. MatchExternalMapping.scoreHome and scoreAway are both non-null integers.
 *     3. Both homeTeamId and awayTeamId on the mapping resolve to canonical teams.
 *     4. Both teams resolve to a TeamSeason for the relevant competition.
 *
 *   Competition membership is determined via:
 *     Event.team (own team) → TeamSeason → TeamSeasonCompetition → Competition
 *
 * Event.status mapping to CanonicalMatchStatus:
 *   COMPLETED → FINISHED   (the only status that contributes to standings)
 *   LIVE      → LIVE
 *   SCHEDULED → SCHEDULED
 *   POSTPONED → POSTPONED
 *   CANCELLED → CANCELLED
 *   DRAFT     → SCHEDULED  (conservative fallback)
 *   ARCHIVED  → CANCELLED  (conservative fallback)
 *
 * NOTE: ABANDONED and FORFEITED are not yet in the EventStatus enum. When
 * MATCH-RESULTS-01 introduces them, add the mapping here without touching
 * the engine or service layer.
 */

import type { CanonicalMatchResult, CanonicalMatchStatus } from "./types";
import type { TeamDescriptor } from "./engine";

// ── Database interface ──────────────────────────────────────────────────────
//
// The query layer depends on these minimal Prisma-delegate shapes, not on the
// concrete PrismaClient. This keeps the module testable with mock databases.

interface TeamSeasonCompetitionRecord {
  teamSeasonId: string;
  competitionId: string;
  teamSeason: {
    id: string;
    teamId: string;
    displayName: string;
    team: {
      id: string;
    };
  };
}

interface MatchResultRecord {
  id: string;
  tenantId: string | null;
  status: string;
  startAt: Date;
  matchExternalMapping: {
    homeTeamId: string | null;
    awayTeamId: string | null;
    scoreHome: number | null;
    scoreAway: number | null;
  } | null;
}

interface CompetitionRecord {
  id: string;
  tenantId: string;
  officialName: string;
  isArchived: boolean;
}

interface TeamSeasonRecord {
  id: string;
  teamId: string;
  displayName: string;
  competitions: Array<{
    competitionId: string;
  }>;
}

interface TeamSeasonDelegate {
  findMany(args: object): Promise<TeamSeasonRecord[]>;
}

interface TeamSeasonCompetitionDelegate {
  findMany(args: object): Promise<TeamSeasonCompetitionRecord[]>;
}

interface CompetitionDelegate {
  findFirst(args: object): Promise<CompetitionRecord | null>;
  findMany(args: object): Promise<CompetitionRecord[]>;
}

interface EventDelegate {
  findMany(args: object): Promise<MatchResultRecord[]>;
}

export interface StandingsDatabase {
  competition: CompetitionDelegate;
  teamSeasonCompetition: TeamSeasonCompetitionDelegate;
  teamSeason: TeamSeasonDelegate;
  event: EventDelegate;
}

// ── EventStatus → CanonicalMatchStatus mapping ──────────────────────────────

/**
 * Maps an EventStatus string (from DB) to CanonicalMatchStatus.
 *
 * This is the canonical bridge. The engine never sees EventStatus strings.
 * Add new mappings here as the EventStatus enum evolves.
 */
export function mapEventStatusToCanonical(
  eventStatus: string,
): CanonicalMatchStatus {
  switch (eventStatus) {
    case "COMPLETED":
      return "FINISHED";
    case "LIVE":
      return "LIVE";
    case "SCHEDULED":
      return "SCHEDULED";
    case "POSTPONED":
      return "POSTPONED";
    case "CANCELLED":
      return "CANCELLED";
    case "ABANDONED":
      return "ABANDONED";
    case "FORFEITED":
      return "FORFEITED";
    case "DRAFT":
    case "ARCHIVED":
    default:
      return "SCHEDULED";
  }
}

// ── Competition queries ─────────────────────────────────────────────────────

/**
 * Fetches a single competition scoped to a tenant.
 * Returns null when not found or archived.
 */
export async function fetchCompetitionById(
  db: StandingsDatabase,
  tenantId: string,
  competitionId: string,
): Promise<CompetitionRecord | null> {
  return db.competition.findFirst({
    where: {
      id: competitionId,
      tenantId,
      isArchived: false,
    },
  });
}

/**
 * Fetches all active competitions for a tenant.
 */
export async function fetchAllCompetitionsForTenant(
  db: StandingsDatabase,
  tenantId: string,
): Promise<CompetitionRecord[]> {
  return db.competition.findMany({
    where: {
      tenantId,
      isArchived: false,
    },
  });
}

// ── Team registry queries ───────────────────────────────────────────────────

/**
 * Builds a TeamDescriptor registry for all teams enrolled in a competition.
 *
 * Fetches all TeamSeasonCompetition rows for the given competition, then
 * resolves each TeamSeason to a TeamDescriptor.
 *
 * Returns a Map<teamSeasonId, TeamDescriptor>.
 */
export async function buildTeamRegistry(
  db: StandingsDatabase,
  tenantId: string,
  competitionId: string,
): Promise<Map<string, TeamDescriptor>> {
  const enrollments = await db.teamSeasonCompetition.findMany({
    where: {
      competitionId,
      teamSeason: {
        team: {
          tenantId,
        },
      },
    },
    include: {
      teamSeason: {
        include: {
          team: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  const registry = new Map<string, TeamDescriptor>();

  for (const enrollment of enrollments) {
    const { teamSeason } = enrollment;
    registry.set(teamSeason.id, {
      teamSeasonId: teamSeason.id,
      teamName: teamSeason.displayName,
      competitionId,
    });
  }

  return registry;
}

/**
 * Builds team registries for ALL competitions of a tenant in one pass.
 *
 * Returns a Map<competitionId, Map<teamSeasonId, TeamDescriptor>>.
 * Avoids N+1 by fetching all enrollments in a single query.
 */
export async function buildAllTeamRegistries(
  db: StandingsDatabase,
  tenantId: string,
): Promise<Map<string, Map<string, TeamDescriptor>>> {
  // Fetch all active competitions first
  const competitions = await fetchAllCompetitionsForTenant(db, tenantId);
  const competitionIds = competitions.map((c) => c.id);

  if (competitionIds.length === 0) {
    return new Map();
  }

  const enrollments = await db.teamSeasonCompetition.findMany({
    where: {
      competitionId: { in: competitionIds },
      teamSeason: {
        team: {
          tenantId,
        },
      },
    },
    include: {
      teamSeason: {
        include: {
          team: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  const registries = new Map<string, Map<string, TeamDescriptor>>();

  for (const enrollment of enrollments) {
    const { competitionId, teamSeason } = enrollment;

    if (!registries.has(competitionId)) {
      registries.set(competitionId, new Map());
    }

    registries.get(competitionId)!.set(teamSeason.id, {
      teamSeasonId: teamSeason.id,
      teamName: teamSeason.displayName,
      competitionId,
    });
  }

  return registries;
}

// ── Match result queries ────────────────────────────────────────────────────

/**
 * Fetches canonical match results for a specific competition.
 *
 * Strategy:
 *   1. Resolve all teamSeasonIds enrolled in the competition.
 *   2. Resolve their canonical team IDs (via TeamSeason.teamId).
 *   3. Fetch all COMPLETED MATCH Events where homeTeamId or awayTeamId is
 *      one of the canonical team IDs, scoped to tenant.
 *   4. Map to CanonicalMatchResult.
 *
 * Only matches where BOTH homeTeamId and awayTeamId are non-null are returned.
 * This ensures the engine only sees fully-resolved matches.
 *
 * @param teamRegistry - Pre-built registry from buildTeamRegistry().
 */
export async function fetchMatchResultsForCompetition(
  db: StandingsDatabase,
  tenantId: string,
  competitionId: string,
  teamRegistry: Map<string, TeamDescriptor>,
): Promise<CanonicalMatchResult[]> {
  if (teamRegistry.size === 0) {
    return [];
  }

  // Reverse-map: teamSeasonId → TeamDescriptor is already in registry.
  // We need teamId → teamSeasonId, fetched via TeamSeason.
  const teamSeasonIds = Array.from(teamRegistry.keys());

  const teamSeasons = await db.teamSeason.findMany({
    where: {
      id: { in: teamSeasonIds },
    },
    select: {
      id: true,
      teamId: true,
      displayName: true,
      competitions: {
        where: { competitionId },
        select: { competitionId: true },
      },
    },
  });

  // Build teamId → teamSeasonId map (only teams in this competition)
  const teamIdToSeasonId = new Map<string, string>();
  for (const ts of teamSeasons) {
    if (ts.competitions.length > 0) {
      teamIdToSeasonId.set(ts.teamId, ts.id);
    }
  }

  if (teamIdToSeasonId.size === 0) {
    return [];
  }

  const canonicalTeamIds = Array.from(teamIdToSeasonId.keys());

  // Fetch COMPLETED MATCH events where either side is one of our teams
  const events = await db.event.findMany({
    where: {
      tenantId,
      type: "MATCH",
      status: "COMPLETED",
      matchExternalMapping: {
        AND: [
          {
            OR: [
              { homeTeamId: { in: canonicalTeamIds } },
              { awayTeamId: { in: canonicalTeamIds } },
            ],
          },
          { scoreHome: { not: null } },
          { scoreAway: { not: null } },
        ],
      },
    },
    select: {
      id: true,
      tenantId: true,
      status: true,
      startAt: true,
      matchExternalMapping: {
        select: {
          homeTeamId: true,
          awayTeamId: true,
          scoreHome: true,
          scoreAway: true,
        },
      },
    },
    orderBy: { startAt: "asc" },
  });

  const results: CanonicalMatchResult[] = [];

  for (const event of events) {
    const mapping = event.matchExternalMapping;
    if (!mapping) continue;

    const { homeTeamId, awayTeamId, scoreHome, scoreAway } = mapping;

    // Both sides must be resolved
    if (
      homeTeamId === null ||
      awayTeamId === null ||
      scoreHome === null ||
      scoreAway === null
    ) {
      continue;
    }

    const homeTeamSeasonId = teamIdToSeasonId.get(homeTeamId);
    const awayTeamSeasonId = teamIdToSeasonId.get(awayTeamId);

    // Both teams must be in the competition's team registry
    if (!homeTeamSeasonId || !awayTeamSeasonId) {
      continue;
    }

    results.push({
      matchId: event.id,
      tenantId: event.tenantId ?? tenantId,
      competitionId,
      homeTeamSeasonId,
      awayTeamSeasonId,
      scoreHome,
      scoreAway,
      status: mapEventStatusToCanonical(event.status),
      playedAt: event.startAt,
    });
  }

  return results;
}

/**
 * Fetches all match results for a tenant across all competitions.
 *
 * Groups results by competitionId.
 * Returns Map<competitionId, CanonicalMatchResult[]>.
 *
 * Avoids N+1: one query per competition (bounded by competition count).
 */
export async function fetchAllMatchResultsForTenant(
  db: StandingsDatabase,
  tenantId: string,
  registries: Map<string, Map<string, TeamDescriptor>>,
): Promise<Map<string, CanonicalMatchResult[]>> {
  const resultsByCompetition = new Map<string, CanonicalMatchResult[]>();

  for (const [competitionId, registry] of registries) {
    const results = await fetchMatchResultsForCompetition(
      db,
      tenantId,
      competitionId,
      registry,
    );
    resultsByCompetition.set(competitionId, results);
  }

  return resultsByCompetition;
}
