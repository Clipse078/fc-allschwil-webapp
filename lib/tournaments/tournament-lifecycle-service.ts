/**
 * lib/tournaments/tournament-lifecycle-service.ts
 *
 * ADMIN-DELETE-02A / ADMIN-DELETE-02A-C1 — TournamentCenter permanent-deletion.
 *
 * A "Tournament" is not a dedicated model — it is the canonical `Event` row
 * with `type: "TOURNAMENT"` (see prisma/schema.prisma and
 * lib/tournaments/tournament-service.ts's own architecture doc comment).
 *
 * CORE PRODUCT RULE (ADMIN-DELETE-02A-C1): for a caller holding
 * tournaments.delete, permanent deletion is NEVER blocked merely because
 * participants, resource allocations, Weekplanner references, or
 * completed/archived history exist. Those are reported as IMPACT (a warning
 * shown before the user's explicit confirmation), never as a hard blocker.
 * Cancel/restore (the existing Event status lifecycle) remains a
 * completely separate, unaffected action for a tournament a caller wants to
 * retire without a permanent, irreversible delete.
 *
 * TournamentParticipant / TournamentResourceAllocation (and nested
 * TournamentParticipantAllocation dressing-room rows) all cascade on Event
 * delete in the schema — no explicit cleanup needed for them. Team/
 * ExternalTeam/ExternalClub participant references are `onDelete: SetNull`
 * and FacilityResource references cascade only the join row, never the
 * resource itself — so canonical master data is never touched. The one
 * dependency that does NOT cascade is Weekplanner:
 * WeekplannerPlanAllocation / WeekplannerPlanActivityOverride reference a
 * TOURNAMENT activity by `activityId` = Event.id, a deliberately-not-a-DB-
 * relation string field — those rows are explicitly deleted in the same
 * transaction.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { TournamentNotFoundError } from "./errors";

export type TournamentDeletionImpact = {
  key: string;
  label: string;
  count: number;
};

/** Sporting states that represent history — reported as impact, never blocked. */
const HISTORY_STATUSES = new Set(["LIVE", "COMPLETED", "ARCHIVED"]);

/**
 * Computes the deletion IMPACT for a Tournament (Event, type=TOURNAMENT),
 * strictly scoped to `tenantId` — informational counts to show the caller
 * before they confirm permanent deletion, never a reason to refuse it.
 * Returns null when the tournament does not exist, belongs to another
 * tenant, or is not a TOURNAMENT-type Event.
 */
export async function getTournamentDeletionImpact(
  tenantId: string,
  tournamentId: string,
): Promise<TournamentDeletionImpact[] | null> {
  const tournament = await prisma.event.findFirst({
    where: { id: tournamentId, tenantId, type: "TOURNAMENT" },
    select: {
      status: true,
      _count: {
        select: {
          tournamentParticipants: true,
          tournamentResourceAllocations: true,
        },
      },
    },
  });

  if (!tournament) {
    return null;
  }

  const [weekplannerAllocations, weekplannerOverrides] = await Promise.all([
    prisma.weekplannerPlanAllocation.count({
      where: { tenantId, activityType: "TOURNAMENT", activityId: tournamentId },
    }),
    prisma.weekplannerPlanActivityOverride.count({
      where: { tenantId, activityType: "TOURNAMENT", activityId: tournamentId },
    }),
  ]);

  const impact: TournamentDeletionImpact[] = [];

  const push = (key: string, label: string, count: number) => {
    if (count > 0) impact.push({ key, label, count });
  };

  push("participants", "Teilnehmende Teams/Vereine", tournament._count.tournamentParticipants);
  push(
    "resourceAllocations",
    "Ressourcen-Zuordnungen (Spielfeld/Halle)",
    tournament._count.tournamentResourceAllocations,
  );
  push(
    "sportingHistory",
    "Turnier ist live, abgeschlossen oder archiviert",
    HISTORY_STATUSES.has(tournament.status) ? 1 : 0,
  );
  push("weekplannerAllocations", "Wochenplan-Ressourcen-Zuordnungen", weekplannerAllocations);
  push("weekplannerOverrides", "Wochenplan-Zeit-Überschreibungen", weekplannerOverrides);

  return impact;
}

/**
 * Permanently deletes a Tournament (Event, type=TOURNAMENT), atomically
 * cleaning up its owned/reference data first. Throws
 * TournamentNotFoundError when the tournament does not exist (or belongs to
 * another tenant, or is not type=TOURNAMENT) — never a "blocked" error,
 * since dependencies never block a tournaments.delete-authorized caller.
 *
 * Steps (single Prisma transaction — all-or-nothing):
 *   1. Re-resolve the tournament (tenant-scoped, type=TOURNAMENT) and
 *      compute the final impact snapshot for the audit log / response.
 *   2. Delete every WeekplannerPlanAllocation / WeekplannerPlanActivity
 *      Override row referencing this tournament's activityId.
 *   3. Delete the Event itself. The schema's FK cascades remove
 *      TournamentParticipant, TournamentResourceAllocation, and each
 *      participant's own TournamentParticipantAllocation rows. Referenced
 *      Team/ExternalTeam/ExternalClub/FacilityResource rows are never
 *      cascade-deleted (SetNull or join-row-only cascade).
 *
 * If any step fails, the whole transaction rolls back — no orphaned
 * Weekplanner references, and the tournament is not deleted.
 */
export async function deleteTournamentPermanently(
  tenantId: string,
  tournamentId: string,
): Promise<{ deleted: { id: string }; impact: TournamentDeletionImpact[] }> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const tournament = await tx.event.findFirst({
      where: { id: tournamentId, tenantId, type: "TOURNAMENT" },
      select: {
        id: true,
        status: true,
        _count: {
          select: {
            tournamentParticipants: true,
            tournamentResourceAllocations: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new TournamentNotFoundError(tournamentId);
    }

    const [weekplannerAllocations, weekplannerOverrides] = await Promise.all([
      tx.weekplannerPlanAllocation.count({
        where: { tenantId, activityType: "TOURNAMENT", activityId: tournamentId },
      }),
      tx.weekplannerPlanActivityOverride.count({
        where: { tenantId, activityType: "TOURNAMENT", activityId: tournamentId },
      }),
    ]);

    const impact: TournamentDeletionImpact[] = [];
    const push = (key: string, label: string, count: number) => {
      if (count > 0) impact.push({ key, label, count });
    };
    push("participants", "Teilnehmende Teams/Vereine", tournament._count.tournamentParticipants);
    push(
      "resourceAllocations",
      "Ressourcen-Zuordnungen (Spielfeld/Halle)",
      tournament._count.tournamentResourceAllocations,
    );
    push(
      "sportingHistory",
      "Turnier ist live, abgeschlossen oder archiviert",
      HISTORY_STATUSES.has(tournament.status) ? 1 : 0,
    );
    push("weekplannerAllocations", "Wochenplan-Ressourcen-Zuordnungen", weekplannerAllocations);
    push("weekplannerOverrides", "Wochenplan-Zeit-Überschreibungen", weekplannerOverrides);

    await tx.weekplannerPlanAllocation.deleteMany({
      where: { tenantId, activityType: "TOURNAMENT", activityId: tournamentId },
    });
    await tx.weekplannerPlanActivityOverride.deleteMany({
      where: { tenantId, activityType: "TOURNAMENT", activityId: tournamentId },
    });

    const deleted = await tx.event.delete({ where: { id: tournamentId } });

    return { deleted, impact };
  });
}
