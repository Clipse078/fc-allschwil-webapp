/**
 * lib/training/series-cockpit-exception-data.ts
 *
 * Server-side loader for occurrence allocation exceptions shown in the
 * Training Series Cockpit.
 */

import { prisma } from "@/lib/db/prisma";
import { resolveTrainingDayWindow } from "@/lib/training/date-range";
import {
  buildOccurrenceExceptionIndex,
  countSeriesOccurrenceExceptions,
  type SeriesCockpitOccurrenceException,
} from "@/lib/training/series-cockpit-exceptions";

/**
 * Loads active/future SCHEDULED occurrences that have at least one
 * occurrence-level allocation override, indexed by cockpit row key.
 */
export async function listOccurrenceAllocationExceptionsByCockpitRow(
  tenantId: string,
  timezone: string,
): Promise<Map<string, SeriesCockpitOccurrenceException[]>> {
  const todayKey = resolveTrainingDayWindow({ timeZone: timezone }).date;
  const todayStart = new Date(`${todayKey}T00:00:00.000Z`);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      tenantId,
      status: "SCHEDULED",
      sessionAllocations: { some: {} },
      OR: [
        { overrideDate: { not: null, gte: todayStart } },
        { overrideDate: null, date: { gte: todayStart } },
      ],
    },
    select: {
      id: true,
      trainingSeriesId: true,
      weekday: true,
      date: true,
      overrideDate: true,
      overrideStartAt: true,
      overrideEndAt: true,
      startAt: true,
      endAt: true,
      timezone: true,
      sessionAllocations: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: {
          facilityResourceId: true,
          facilityResource: {
            select: {
              name: true,
              type: true,
            },
          },
        },
      },
      trainingSeries: {
        select: {
          allocations: {
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
            select: {
              facilityResourceId: true,
              facilityResource: {
                select: {
                  name: true,
                  type: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ date: "asc" }, { startAt: "asc" }],
  });

  return buildOccurrenceExceptionIndex(sessions, timezone);
}

export async function countSeriesOccurrenceAllocationExceptions(
  tenantId: string,
  seriesId: string,
  timezone: string,
): Promise<number> {
  const index = await listOccurrenceAllocationExceptionsByCockpitRow(tenantId, timezone);
  return countSeriesOccurrenceExceptions(index, seriesId);
}
