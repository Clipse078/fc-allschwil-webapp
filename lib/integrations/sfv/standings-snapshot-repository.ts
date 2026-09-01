/**
 * lib/integrations/sfv/standings-snapshot-repository.ts
 *
 * Durable last-known-good standings snapshot persistence.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  SportingStandingsCompetition,
  SportingStandingRow,
  SportingStandingsTable,
} from "@/lib/sporting-data/standings-types";

export type StandingsSnapshotIdentity = {
  tenantId: string;
  externalSeasonId: number;
  externalTeamId: number;
  providerLeagueId: number;
};

export type StandingsSnapshotTableIdentity = {
  sfvLeagueId: number;
  sfvDivisionId: number;
  sfvGroupId: number;
};

export type PersistStandingsSnapshotInput = StandingsSnapshotIdentity &
  StandingsSnapshotTableIdentity & {
    standingsTable: SportingStandingsTable;
    fetchedAt: Date;
  };

export type LoadedStandingsSnapshot = {
  standingsTable: SportingStandingsTable;
  fetchedAt: Date;
  sfvLeagueId: number;
  sfvDivisionId: number;
  sfvGroupId: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCompetition(value: unknown): SportingStandingsCompetition | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = value.name;
  if (typeof name !== "string" || name.trim().length === 0) {
    return null;
  }

  return {
    name,
    divisionName:
      typeof value.divisionName === "string" ? value.divisionName : null,
    groupName: typeof value.groupName === "string" ? value.groupName : null,
  };
}

function parseRow(value: unknown): SportingStandingRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const externalTeamId = value.externalTeamId;
  const position = value.position;
  const teamName = value.teamName;

  if (
    !Number.isInteger(externalTeamId) ||
    !Number.isInteger(position) ||
    typeof teamName !== "string" ||
    teamName.trim().length === 0
  ) {
    return null;
  }

  const numericFields = [
    "played",
    "won",
    "drawn",
    "lost",
    "goalsFor",
    "goalsAgainst",
    "points",
  ] as const;

  for (const field of numericFields) {
    if (!Number.isInteger(value[field])) {
      return null;
    }
  }

  const penaltyPoints = value.penaltyPoints;
  if (
    penaltyPoints !== null &&
    penaltyPoints !== undefined &&
    !Number.isInteger(penaltyPoints)
  ) {
    return null;
  }

  return {
    position: position as number,
    externalTeamId: externalTeamId as number,
    teamName,
    shortName:
      typeof value.shortName === "string" ? value.shortName : null,
    played: value.played as number,
    won: value.won as number,
    drawn: value.drawn as number,
    lost: value.lost as number,
    goalsFor: value.goalsFor as number,
    goalsAgainst: value.goalsAgainst as number,
    points: value.points as number,
    penaltyPoints:
      penaltyPoints === null || penaltyPoints === undefined
        ? null
        : (penaltyPoints as number),
  };
}

export function parseStoredStandingsTable(value: unknown): SportingStandingsTable | null {
  if (!isRecord(value)) {
    return null;
  }

  const competition = parseCompetition(value.competition);
  if (!competition) {
    return null;
  }

  if (!Array.isArray(value.rows)) {
    return null;
  }

  const rows: SportingStandingRow[] = [];
  for (const row of value.rows) {
    const parsed = parseRow(row);
    if (!parsed) {
      return null;
    }
    rows.push(parsed);
  }

  return {
    competition,
    rows,
  };
}

export function isUsableStandingsTable(
  standings: SportingStandingsTable | null | undefined,
): boolean {
  return standings != null && standings.rows.length > 0;
}

export async function loadStandingsSnapshot(
  identity: StandingsSnapshotIdentity,
): Promise<LoadedStandingsSnapshot | null> {
  const row = await prisma.sfvStandingsSnapshot.findUnique({
    where: {
      tenantId_externalSeasonId_externalTeamId_providerLeagueId: {
        tenantId: identity.tenantId,
        externalSeasonId: identity.externalSeasonId,
        externalTeamId: identity.externalTeamId,
        providerLeagueId: identity.providerLeagueId,
      },
    },
    select: {
      standingsTable: true,
      fetchedAt: true,
      sfvLeagueId: true,
      sfvDivisionId: true,
      sfvGroupId: true,
    },
  });

  if (!row) {
    return null;
  }

  const standingsTable = parseStoredStandingsTable(row.standingsTable);
  if (!isUsableStandingsTable(standingsTable)) {
    return null;
  }

  return {
    standingsTable: standingsTable!,
    fetchedAt: row.fetchedAt,
    sfvLeagueId: row.sfvLeagueId,
    sfvDivisionId: row.sfvDivisionId,
    sfvGroupId: row.sfvGroupId,
  };
}

export async function persistStandingsSnapshot(
  input: PersistStandingsSnapshotInput,
): Promise<void> {
  if (!isUsableStandingsTable(input.standingsTable)) {
    return;
  }

  await prisma.sfvStandingsSnapshot.upsert({
    where: {
      tenantId_externalSeasonId_externalTeamId_providerLeagueId: {
        tenantId: input.tenantId,
        externalSeasonId: input.externalSeasonId,
        externalTeamId: input.externalTeamId,
        providerLeagueId: input.providerLeagueId,
      },
    },
    create: {
      tenantId: input.tenantId,
      externalSeasonId: input.externalSeasonId,
      externalTeamId: input.externalTeamId,
      providerLeagueId: input.providerLeagueId,
      standingsTable: input.standingsTable,
      sfvLeagueId: input.sfvLeagueId,
      sfvDivisionId: input.sfvDivisionId,
      sfvGroupId: input.sfvGroupId,
      fetchedAt: input.fetchedAt,
    },
    update: {
      standingsTable: input.standingsTable,
      sfvLeagueId: input.sfvLeagueId,
      sfvDivisionId: input.sfvDivisionId,
      sfvGroupId: input.sfvGroupId,
      fetchedAt: input.fetchedAt,
    },
  });
}
