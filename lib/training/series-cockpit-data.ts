/**
 * lib/training/series-cockpit-data.ts
 *
 * Server-side loader for the weekday Training Series Cockpit.
 */

import { prisma } from "@/lib/db/prisma";
import { resolveLongTeamName } from "@/lib/teams/team-naming";
import { listAllocationsGroupedBySeries } from "@/lib/training/training-allocation-service";
import { buildTrainingSeriesCockpitRows } from "@/lib/training/series-cockpit";
import { listOccurrenceAllocationExceptionsByCockpitRow } from "@/lib/training/series-cockpit-exception-data";
import type { TrainingSeriesDto } from "@/lib/training/types";

export async function buildTrainingSeriesCockpitViewModel(
  tenantId: string,
  series: TrainingSeriesDto[],
  timezone = "Europe/Zurich",
) {
  const teamSeasonIds = [...new Set(series.map((item) => item.teamSeasonId))];
  const [teamSeasonRows, allocationsBySeriesId, occurrenceExceptionsByRowKey] = await Promise.all([
    prisma.teamSeason.findMany({
      where: { id: { in: teamSeasonIds }, team: { tenantId } },
      select: {
        id: true,
        displayName: true,
        team: {
          select: {
            name: true,
            shortName: true,
            alternativeName: true,
          },
        },
        externalMappings: {
          orderBy: { lastSyncedAt: "desc" },
          take: 1,
          select: { providerTeamName: true },
        },
      },
    }),
    listAllocationsGroupedBySeries(tenantId),
    listOccurrenceAllocationExceptionsByCockpitRow(tenantId, timezone),
  ]);

  const teamDisplayNameByTeamSeasonId = new Map(
    teamSeasonRows.map((row) => [
      row.id,
      resolveLongTeamName({
        teamName: row.team.name,
        teamShortName: row.team.shortName,
        teamAlternativeName: row.team.alternativeName,
        teamSeasonDisplayName: row.displayName,
        providerTeamName: row.externalMappings[0]?.providerTeamName ?? null,
      }) ?? row.team.name,
    ]),
  );

  return buildTrainingSeriesCockpitRows({
    series,
    teamDisplayNameByTeamSeasonId,
    allocationsBySeriesId,
    occurrenceExceptionsByRowKey,
  });
}
