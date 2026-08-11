/**
 * lib/training/training-lifecycle-service.ts
 *
 * ADMIN-DELETE-02A / ADMIN-DELETE-02A-C1 — TrainingCenter permanent-deletion.
 *
 * CORE PRODUCT RULE (ADMIN-DELETE-02A-C1): for a caller holding
 * trainings.delete, permanent deletion of a TrainingSeries is NEVER blocked
 * merely because generated sessions, facility allocations, or plan
 * assignments exist. Those are reported as IMPACT (a warning shown before
 * the user's explicit confirmation), never as a hard blocker. Once
 * confirmed, deletion atomically cleans up every dependent
 * operational/reference row and then removes the series itself — it never
 * silently blocks or leaves orphaned data behind.
 *
 * Every FK child of TrainingSeries cascades in the schema (recurrenceDays,
 * planAssignments, allocations, sessions, and TrainingSession's own
 * TrainingSessionAllocation children — see prisma/schema.prisma), so
 * `prisma.trainingSeries.delete()` already removes all of those atomically.
 * The one thing that does NOT cascade is Weekplanner: WeekplannerPlanAllocation
 * / WeekplannerPlanActivityOverride reference a TRAINING activity by
 * `activityId` = TrainingSession.id, a deliberately-not-a-DB-relation string
 * field (see prisma/schema.prisma doc comments) — so those rows must be
 * explicitly deleted in the same transaction or they would become dangling
 * references pointing at a TrainingSession that no longer exists.
 *
 * Canonical master data (Team, Facility, FacilityResource, Season, OrgUnit,
 * Person) is never touched here — only the TrainingSeries itself and its
 * owned/reference planning data.
 *
 * Archive (the existing DELETE .../[seriesId] endpoint) remains a completely
 * separate, unaffected lifecycle action for series a caller wants to retire
 * without a permanent, irreversible delete.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { TrainingSeriesNotFoundError } from "./errors";

export type TrainingSeriesDeletionImpact = {
  key: string;
  label: string;
  count: number;
};

/**
 * Computes the deletion IMPACT for a TrainingSeries, strictly scoped to
 * `tenantId` — informational counts to show the caller before they confirm
 * permanent deletion, never a reason to refuse it. Returns null when the
 * series does not exist (or belongs to another tenant).
 *
 * recurrenceDays are deliberately NOT reported — every series has at least
 * one recurrence-day row from creation onward, so surfacing it as "impact"
 * on every single series would be meaningless noise.
 *
 * Weekplanner overrides (WeekplannerPlanAllocation / WeekplannerPlanActivity
 * Override) reference generated TrainingSession ids, never the series id
 * directly (see prisma/schema.prisma) — a series with zero sessions
 * therefore never has Weekplanner impact, so the `sessions` count above
 * already covers that risk without a second query for the impact preview.
 */
export async function getTrainingSeriesDeletionImpact(
  tenantId: string,
  seriesId: string,
): Promise<TrainingSeriesDeletionImpact[] | null> {
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

  const impact: TrainingSeriesDeletionImpact[] = [];

  const push = (key: string, label: string, count: number) => {
    if (count > 0) impact.push({ key, label, count });
  };

  push("sessions", "Generierte Trainingseinheiten", series._count.sessions);
  push("allocations", "Anlagen-/Garderoben-Zuordnungen", series._count.allocations);
  push("planAssignments", "Trainingsplan-Zuweisungen", series._count.planAssignments);

  return impact;
}

/**
 * Permanently deletes a TrainingSeries, atomically cleaning up its owned
 * planning data first. Throws TrainingSeriesNotFoundError when the series
 * does not exist (or belongs to another tenant) — never a "blocked" error,
 * since dependencies never block a trainings.delete-authorized caller.
 *
 * Steps (single Prisma transaction — all-or-nothing):
 *   1. Re-resolve the series (tenant-scoped) together with the ids of every
 *      generated TrainingSession, and compute the final impact snapshot for
 *      the audit log / response.
 *   2. Delete every WeekplannerPlanAllocation / WeekplannerPlanActivity
 *      Override row referencing one of those session ids — the one
 *      dependency that does NOT cascade automatically.
 *   3. Delete the TrainingSeries itself. The schema's FK cascades remove
 *      recurrenceDays, planAssignments, allocations, sessions, and each
 *      session's own TrainingSessionAllocation rows.
 *
 * If any step fails, the whole transaction rolls back — no partial cleanup,
 * no orphaned Weekplanner references, and the series is not deleted.
 */
export async function deleteTrainingSeriesPermanently(
  tenantId: string,
  seriesId: string,
): Promise<{ deleted: { id: string }; impact: TrainingSeriesDeletionImpact[] }> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const series = await tx.trainingSeries.findFirst({
      where: { id: seriesId, tenantId },
      select: {
        id: true,
        sessions: { select: { id: true } },
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
      throw new TrainingSeriesNotFoundError(seriesId);
    }

    const impact: TrainingSeriesDeletionImpact[] = [];
    const push = (key: string, label: string, count: number) => {
      if (count > 0) impact.push({ key, label, count });
    };
    push("sessions", "Generierte Trainingseinheiten", series._count.sessions);
    push("allocations", "Anlagen-/Garderoben-Zuordnungen", series._count.allocations);
    push("planAssignments", "Trainingsplan-Zuweisungen", series._count.planAssignments);

    const sessionIds = series.sessions.map((s) => s.id);
    if (sessionIds.length > 0) {
      await tx.weekplannerPlanAllocation.deleteMany({
        where: { tenantId, activityType: "TRAINING", activityId: { in: sessionIds } },
      });
      await tx.weekplannerPlanActivityOverride.deleteMany({
        where: { tenantId, activityType: "TRAINING", activityId: { in: sessionIds } },
      });
    }

    const deleted = await tx.trainingSeries.delete({ where: { id: seriesId } });

    return { deleted, impact };
  });
}
