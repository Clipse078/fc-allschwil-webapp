/**
 * lib/training/queries.ts
 *
 * Low-level Prisma queries for the Training module.
 *
 * All queries are scoped by tenantId via the TeamSeason → Team relation.
 * No business logic here — that lives in training-service.ts.
 *
 * Security invariants:
 *   - Tenant A cannot read Tenant B's training series.
 *   - tenantId is always validated through the TeamSeason → Team join.
 */

import { prisma } from "@/lib/db/prisma";
import type { TrainingSeriesStatus } from "./types";

// ── Row shape returned by the DB ──────────────────────────────────────────────

export type TrainingSeriesRow = {
  id: string;
  tenantId: string;
  teamSeasonId: string;
  title: string;
  description: string | null;
  status: TrainingSeriesStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  validFrom: Date | null;
  validUntil: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  recurrenceDays: { weekday: string }[];
};

const include = {
  recurrenceDays: {
    select: { weekday: true },
    orderBy: { weekday: "asc" as const },
  },
} as const;

// ── Queries ───────────────────────────────────────────────────────────────────

/** Returns a TrainingSeries by id, scoped to the tenant. */
export async function findTrainingSeriesById(
  tenantId: string,
  seriesId: string,
): Promise<TrainingSeriesRow | null> {
  return prisma.trainingSeries.findFirst({
    where: { id: seriesId, tenantId },
    include,
  }) as Promise<TrainingSeriesRow | null>;
}

/** Returns all TrainingSeries for a tenant, with optional filters. */
export async function findAllTrainingSeries(
  tenantId: string,
  opts: {
    teamSeasonId?: string;
    status?: TrainingSeriesStatus;
    includeArchived?: boolean;
  } = {},
): Promise<TrainingSeriesRow[]> {
  const { teamSeasonId, status, includeArchived = false } = opts;

  return prisma.trainingSeries.findMany({
    where: {
      tenantId,
      ...(teamSeasonId ? { teamSeasonId } : {}),
      ...(status ? { status } : !includeArchived ? { NOT: { status: "ARCHIVED" } } : {}),
    },
    include,
    orderBy: [{ teamSeasonId: "asc" }, { title: "asc" }],
  }) as Promise<TrainingSeriesRow[]>;
}

/**
 * Checks tenant ownership of a TeamSeason.
 *
 * Returns the TeamSeason row (with team) when it belongs to the tenant,
 * or null when it does not exist or belongs to a different tenant.
 */
export async function findTeamSeasonForTenant(
  tenantId: string,
  teamSeasonId: string,
): Promise<{ id: string; team: { id: string; isActive: boolean; tenantId: string | null } } | null> {
  return prisma.teamSeason.findFirst({
    where: {
      id: teamSeasonId,
      team: { tenantId },
    },
    select: {
      id: true,
      team: {
        select: { id: true, isActive: true, tenantId: true },
      },
    },
  });
}
