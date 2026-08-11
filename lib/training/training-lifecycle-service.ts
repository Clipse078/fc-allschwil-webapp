/**
 * lib/training/training-lifecycle-service.ts
 *
 * ADMIN-DELETE-02A — TrainingCenter permanent-deletion safety.
 *
 * Mirrors lib/teams/team-lifecycle-service.ts's getTeamDeletionBlockers() /
 * deleteTeamSafely() pattern (ADMIN-DELETE-01A/01B) for the canonical
 * TrainingSeries entity — the object already exposed to admins for
 * TrainingCenter lifecycle (see app/api/training-series/[seriesId]/route.ts,
 * whose existing DELETE handler soft-archives a series and is left
 * UNCHANGED by this file).
 *
 * Every FK child of TrainingSeries cascades in the schema (recurrenceDays,
 * planAssignments, allocations, sessions — see prisma/schema.prisma), so
 * `prisma.trainingSeries.delete()` would otherwise silently wipe generated
 * training history. Permanent deletion is therefore blocked at the
 * application layer whenever any generated/operational history exists;
 * soft-archive (the existing DELETE .../[seriesId] endpoint) remains the
 * safe default action for a series with history.
 */
import { prisma } from "@/lib/db/prisma";
import { TrainingSeriesNotFoundError } from "./errors";

export type TrainingSeriesDeletionBlocker = {
  key: string;
  label: string;
  count: number;
};

export class TrainingSeriesDeletionBlockedError extends Error {
  blockers: TrainingSeriesDeletionBlocker[];

  constructor(blockers: TrainingSeriesDeletionBlocker[]) {
    super(
      "Trainingsserie kann nicht gelöscht werden, da bestehende Daten/Historie vorhanden sind. Bitte stattdessen archivieren.",
    );
    this.name = "TrainingSeriesDeletionBlockedError";
    this.blockers = blockers;
  }
}

/**
 * Computes the deletion blockers for a TrainingSeries, strictly scoped to
 * `tenantId`. Returns null when the series does not exist (or belongs to
 * another tenant).
 *
 * "Meaningful dependency" definition (deliberately conservative — a freshly
 * created, never-generated TrainingSeries must remain deletable):
 *   - any generated TrainingSession (recurring occurrence history)
 *   - any TrainingAllocation (facility/pitch/dressing-room resource link)
 *   - any TrainingPlanAssignment (link into a tenant TrainingPlan)
 *
 * recurrenceDays are deliberately NOT a blocker — every series has at least
 * one recurrence-day row from creation onward, so treating it as "history"
 * would make permanent deletion permanently unreachable.
 *
 * Weekplanner overrides (WeekplannerPlanAllocation / WeekplannerPlanActivity
 * Override) reference generated TrainingSession ids, never the series id
 * directly (see prisma/schema.prisma) — a series with zero sessions can
 * therefore never have orphaned Weekplanner references, so the `sessions`
 * blocker above already covers that risk without a second query.
 */
export async function getTrainingSeriesDeletionBlockers(
  tenantId: string,
  seriesId: string,
): Promise<TrainingSeriesDeletionBlocker[] | null> {
  const series = await prisma.trainingSeries.findFirst({
    where: { id: seriesId, tenantId },
    select: {
      _count: {
        select: {
          sessions: true,
          allocations: true,
          planAssignments: true,
        },
      },
    },
  });

  if (!series) {
    return null;
  }

  const blockers: TrainingSeriesDeletionBlocker[] = [];

  const push = (key: string, label: string, count: number) => {
    if (count > 0) blockers.push({ key, label, count });
  };

  push("sessions", "Generierte Trainingseinheiten", series._count.sessions);
  push("allocations", "Anlagen-/Garderoben-Zuordnungen", series._count.allocations);
  push("planAssignments", "Trainingsplan-Zuweisungen", series._count.planAssignments);

  return blockers;
}

/**
 * Hard-deletes a TrainingSeries only when no meaningful dependency/history
 * exists. Throws TrainingSeriesNotFoundError or
 * TrainingSeriesDeletionBlockedError otherwise. Strictly tenant-scoped.
 */
export async function deleteTrainingSeriesSafely(tenantId: string, seriesId: string) {
  const blockers = await getTrainingSeriesDeletionBlockers(tenantId, seriesId);
  if (blockers === null) throw new TrainingSeriesNotFoundError(seriesId);
  if (blockers.length > 0) throw new TrainingSeriesDeletionBlockedError(blockers);

  // No generated sessions/allocations/plan assignments beyond the always-
  // present recurrence-day config rows — safe to cascade-delete (every
  // historical relation was already confirmed empty above).
  return prisma.trainingSeries.delete({ where: { id: seriesId } });
}
