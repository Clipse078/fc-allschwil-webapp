/**
 * lib/matchcenter/match-lifecycle-service.ts
 *
 * ADMIN-DELETE-02A — MatchCenter permanent-deletion safety.
 *
 * A "Match" is not a dedicated model — it is the canonical `Event` row with
 * `type: "MATCH"` (see prisma/schema.prisma). This mirrors
 * lib/teams/team-lifecycle-service.ts's getTeamDeletionBlockers() /
 * deleteTeamSafely() pattern (ADMIN-DELETE-01A/01B) for that entity.
 *
 * Import/provider safety (product requirement): a match carrying a
 * `MatchExternalMapping` (SFV-imported) is NEVER permanently deletable here —
 * SFV sync upserts by (tenantId, provider, externalMatchId) and never
 * deletes provider-absent fixtures (see lib/integrations/sfv/sync/), so a
 * hard-deleted imported match would simply reappear (and lose its local
 * operational history — pitch/dressing-room codes, visibility) on the next
 * sync. Deletion is blocked whenever the provider mapping exists, or the
 * match has reached a completed/live sporting state, or any operational
 * reference (Weekplanner override) still points at it. A newly-created,
 * unused MANUAL match with none of these remains permanently deletable.
 *
 * SFV sync itself is completely unmodified by this file.
 */
import { prisma } from "@/lib/db/prisma";

export class MatchNotFoundError extends Error {
  constructor(matchId: string) {
    super(`Match not found: ${matchId}`);
    this.name = "MatchNotFoundError";
  }
}

export type MatchDeletionBlocker = {
  key: string;
  label: string;
  count: number;
};

export class MatchDeletionBlockedError extends Error {
  blockers: MatchDeletionBlocker[];

  constructor(blockers: MatchDeletionBlocker[]) {
    super(
      "Match kann nicht gelöscht werden, da Anbieter-Zuordnungen, Spielstand oder Betriebsdaten bestehen. Bitte stattdessen absagen/verschieben.",
    );
    this.name = "MatchDeletionBlockedError";
    this.blockers = blockers;
  }
}

/** Sporting states that represent history/operational-in-progress and must never be silently deleted. */
const NON_DELETABLE_STATUSES = new Set(["LIVE", "COMPLETED"]);

/**
 * Computes the deletion blockers for a Match (Event, type=MATCH), strictly
 * scoped to `tenantId`. Returns null when the match does not exist, belongs
 * to another tenant, or is not a MATCH-type Event.
 */
export async function getMatchDeletionBlockers(
  tenantId: string,
  matchId: string,
): Promise<MatchDeletionBlocker[] | null> {
  const match = await prisma.event.findFirst({
    where: { id: matchId, tenantId, type: "MATCH" },
    select: {
      status: true,
      matchExternalMapping: { select: { id: true } },
    },
  });

  if (!match) {
    return null;
  }

  const [weekplannerAllocations, weekplannerOverrides] = await Promise.all([
    prisma.weekplannerPlanAllocation.count({
      where: { tenantId, activityType: "MATCH", activityId: matchId },
    }),
    prisma.weekplannerPlanActivityOverride.count({
      where: { tenantId, activityType: "MATCH", activityId: matchId },
    }),
  ]);

  const blockers: MatchDeletionBlocker[] = [];

  const push = (key: string, label: string, count: number) => {
    if (count > 0) blockers.push({ key, label, count });
  };

  push("providerMapping", "Anbieter-/SFV-Zuordnung", match.matchExternalMapping ? 1 : 0);
  push(
    "sportingHistory",
    "Spiel ist live oder abgeschlossen",
    NON_DELETABLE_STATUSES.has(match.status) ? 1 : 0,
  );
  push("weekplannerAllocations", "Wochenplan-Ressourcen-Zuordnungen", weekplannerAllocations);
  push("weekplannerOverrides", "Wochenplan-Zeit-Überschreibungen", weekplannerOverrides);

  return blockers;
}

/**
 * Hard-deletes a Match (Event, type=MATCH) only when no meaningful
 * dependency/history exists. Throws MatchNotFoundError or
 * MatchDeletionBlockedError otherwise. Strictly tenant-scoped.
 */
export async function deleteMatchSafely(tenantId: string, matchId: string) {
  const blockers = await getMatchDeletionBlockers(tenantId, matchId);
  if (blockers === null) throw new MatchNotFoundError(matchId);
  if (blockers.length > 0) throw new MatchDeletionBlockedError(blockers);

  // No provider mapping, no live/completed sporting state, no Weekplanner
  // references — safe to delete. MatchExternalMapping cascades automatically
  // (schema onDelete: Cascade) but is already confirmed absent above.
  return prisma.event.delete({ where: { id: matchId } });
}
