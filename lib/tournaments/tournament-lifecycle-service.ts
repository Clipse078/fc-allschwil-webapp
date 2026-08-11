/**
 * lib/tournaments/tournament-lifecycle-service.ts
 *
 * ADMIN-DELETE-02A — TournamentCenter permanent-deletion safety.
 *
 * A "Tournament" is not a dedicated model — it is the canonical `Event` row
 * with `type: "TOURNAMENT"` (see prisma/schema.prisma and
 * lib/tournaments/tournament-service.ts's own architecture doc comment).
 * This mirrors lib/teams/team-lifecycle-service.ts's
 * getTeamDeletionBlockers() / deleteTeamSafely() pattern (ADMIN-DELETE-01A/
 * 01B) for that entity.
 *
 * TournamentParticipant / TournamentResourceAllocation (and nested
 * TournamentParticipantAllocation dressing-room rows) all cascade on Event
 * delete in the schema, so `prisma.event.delete()` would otherwise silently
 * wipe participant/result history — including historical externalTeam/
 * externalClub participant links. Permanent deletion is blocked at the
 * application layer whenever any such history exists, or the tournament has
 * reached a completed/archived state. A newly-created, unused tournament
 * (no participants, no resource allocations, still SCHEDULED/CANCELLED)
 * remains permanently deletable.
 */
import { prisma } from "@/lib/db/prisma";
import { TournamentNotFoundError } from "./errors";

export type TournamentDeletionBlocker = {
  key: string;
  label: string;
  count: number;
};

export class TournamentDeletionBlockedError extends Error {
  blockers: TournamentDeletionBlocker[];

  constructor(blockers: TournamentDeletionBlocker[]) {
    super(
      "Turnier kann nicht gelöscht werden, da Teilnehmer, Ressourcen-Zuordnungen oder Ergebnis-Historie bestehen. Bitte stattdessen absagen.",
    );
    this.name = "TournamentDeletionBlockedError";
    this.blockers = blockers;
  }
}

/** Sporting states that represent history and must never be silently deleted. */
const NON_DELETABLE_STATUSES = new Set(["LIVE", "COMPLETED", "ARCHIVED"]);

/**
 * Computes the deletion blockers for a Tournament (Event, type=TOURNAMENT),
 * strictly scoped to `tenantId`. Returns null when the tournament does not
 * exist, belongs to another tenant, or is not a TOURNAMENT-type Event.
 */
export async function getTournamentDeletionBlockers(
  tenantId: string,
  tournamentId: string,
): Promise<TournamentDeletionBlocker[] | null> {
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

  const blockers: TournamentDeletionBlocker[] = [];

  const push = (key: string, label: string, count: number) => {
    if (count > 0) blockers.push({ key, label, count });
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
    NON_DELETABLE_STATUSES.has(tournament.status) ? 1 : 0,
  );
  push("weekplannerAllocations", "Wochenplan-Ressourcen-Zuordnungen", weekplannerAllocations);
  push("weekplannerOverrides", "Wochenplan-Zeit-Überschreibungen", weekplannerOverrides);

  return blockers;
}

/**
 * Hard-deletes a Tournament (Event, type=TOURNAMENT) only when no
 * meaningful dependency/history exists. Throws TournamentNotFoundError or
 * TournamentDeletionBlockedError otherwise. Strictly tenant-scoped.
 */
export async function deleteTournamentSafely(tenantId: string, tournamentId: string) {
  const blockers = await getTournamentDeletionBlockers(tenantId, tournamentId);
  if (blockers === null) throw new TournamentNotFoundError(tournamentId);
  if (blockers.length > 0) throw new TournamentDeletionBlockedError(blockers);

  // No participants, no resource allocations, no live/completed/archived
  // state, no Weekplanner references — safe to delete.
  return prisma.event.delete({ where: { id: tournamentId } });
}
