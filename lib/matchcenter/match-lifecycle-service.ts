/**
 * lib/matchcenter/match-lifecycle-service.ts
 *
 * ADMIN-DELETE-02A / ADMIN-DELETE-02A-C1 — MatchCenter permanent-deletion.
 *
 * A "Match" is not a dedicated model — it is the canonical `Event` row with
 * `type: "MATCH"` (see prisma/schema.prisma).
 *
 * CORE PRODUCT RULE (ADMIN-DELETE-02A-C1): for a caller holding
 * matches.delete, permanent deletion is NEVER blocked merely because an
 * SFV/provider mapping, a live/completed sporting state, or Weekplanner
 * references exist. Those are reported as IMPACT (a warning shown before
 * the user's explicit confirmation), never as a hard blocker. Cancel/
 * postpone (the existing Event status lifecycle) remains a completely
 * separate, unaffected action for a match a caller wants to retire without
 * a permanent, irreversible delete.
 *
 * SFV re-creation safety (product requirement): SFV sync upserts by
 * (tenantId, provider, externalMatchId) and never deletes provider-absent
 * fixtures (see lib/integrations/sfv/sync/) — so permanently deleting an
 * SFV-imported match would, on its own, simply reappear on the next sync.
 * This is solved with a durable suppression record rather than by blocking
 * deletion: deleting a match that carries a MatchExternalMapping writes an
 * SfvMatchDeletionTombstone row (same tenantId/provider/externalMatchId
 * identity) in the SAME transaction as the delete, and
 * lib/integrations/sfv/sync/schedule-persistence.ts's create path checks
 * that table first and skips (never recreates) a tombstoned fixture. SFV
 * sync itself is otherwise completely unmodified by this file.
 *
 * MatchExternalMapping cascades automatically on Event delete (schema
 * `onDelete: Cascade`) — no explicit cleanup needed for it. The one
 * dependency that does NOT cascade is Weekplanner:
 * WeekplannerPlanAllocation / WeekplannerPlanActivityOverride reference a
 * MATCH activity by `activityId` = Event.id, a deliberately-not-a-DB-relation
 * string field — those rows are explicitly deleted in the same transaction.
 *
 * Canonical master data (Team, ExternalTeam/ExternalClub, FacilityResource,
 * Season) is never touched here — Team/ExternalTeam references on the
 * mapping are already `onDelete: SetNull`, never cascade-deleted.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export class MatchNotFoundError extends Error {
  constructor(matchId: string) {
    super(`Match not found: ${matchId}`);
    this.name = "MatchNotFoundError";
  }
}

export type MatchDeletionImpact = {
  key: string;
  label: string;
  count: number;
};

/** Sporting states that represent history/operational-in-progress — reported as impact, never blocked. */
const HISTORY_STATUSES = new Set(["LIVE", "COMPLETED"]);

/**
 * Computes the deletion IMPACT for a Match (Event, type=MATCH), strictly
 * scoped to `tenantId` — informational counts to show the caller before
 * they confirm permanent deletion, never a reason to refuse it. Returns
 * null when the match does not exist, belongs to another tenant, or is not
 * a MATCH-type Event.
 */
export async function getMatchDeletionImpact(
  tenantId: string,
  matchId: string,
): Promise<MatchDeletionImpact[] | null> {
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

  const impact: MatchDeletionImpact[] = [];

  const push = (key: string, label: string, count: number) => {
    if (count > 0) impact.push({ key, label, count });
  };

  push("providerMapping", "Anbieter-/SFV-Zuordnung", match.matchExternalMapping ? 1 : 0);
  push(
    "sportingHistory",
    "Spiel ist live oder abgeschlossen",
    HISTORY_STATUSES.has(match.status) ? 1 : 0,
  );
  push("weekplannerAllocations", "Wochenplan-Ressourcen-Zuordnungen", weekplannerAllocations);
  push("weekplannerOverrides", "Wochenplan-Zeit-Überschreibungen", weekplannerOverrides);

  return impact;
}

/**
 * Permanently deletes a Match (Event, type=MATCH), atomically cleaning up
 * its owned/reference data first. Throws MatchNotFoundError when the match
 * does not exist (or belongs to another tenant, or is not type=MATCH) —
 * never a "blocked" error, since dependencies never block a
 * matches.delete-authorized caller.
 *
 * Steps (single Prisma transaction — all-or-nothing):
 *   1. Re-resolve the match (tenant-scoped, type=MATCH) together with its
 *      MatchExternalMapping (if any), and compute the final impact snapshot
 *      for the audit log / response.
 *   2. If a provider mapping exists, write an SfvMatchDeletionTombstone row
 *      for the exact same (tenantId, provider, externalMatchId) identity —
 *      the durable suppression record that stops the next SFV sync from
 *      recreating this match.
 *   3. Delete every WeekplannerPlanAllocation / WeekplannerPlanActivity
 *      Override row referencing this match's activityId.
 *   4. Delete the Event itself. The schema's FK cascade removes the
 *      MatchExternalMapping; Team/ExternalTeam references on it are
 *      `onDelete: SetNull` and are therefore never touched.
 *
 * If any step fails, the whole transaction rolls back — no tombstone
 * without a delete, no orphaned Weekplanner references, and the match is
 * not deleted.
 */
export async function deleteMatchPermanently(
  tenantId: string,
  matchId: string,
  deletedByUserId?: string | null,
): Promise<{ deleted: { id: string }; impact: MatchDeletionImpact[] }> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const match = await tx.event.findFirst({
      where: { id: matchId, tenantId, type: "MATCH" },
      select: {
        id: true,
        status: true,
        matchExternalMapping: {
          select: { provider: true, externalMatchId: true, externalSeasonId: true },
        },
      },
    });

    if (!match) {
      throw new MatchNotFoundError(matchId);
    }

    const [weekplannerAllocations, weekplannerOverrides] = await Promise.all([
      tx.weekplannerPlanAllocation.count({
        where: { tenantId, activityType: "MATCH", activityId: matchId },
      }),
      tx.weekplannerPlanActivityOverride.count({
        where: { tenantId, activityType: "MATCH", activityId: matchId },
      }),
    ]);

    const impact: MatchDeletionImpact[] = [];
    const push = (key: string, label: string, count: number) => {
      if (count > 0) impact.push({ key, label, count });
    };
    push("providerMapping", "Anbieter-/SFV-Zuordnung", match.matchExternalMapping ? 1 : 0);
    push(
      "sportingHistory",
      "Spiel ist live oder abgeschlossen",
      HISTORY_STATUSES.has(match.status) ? 1 : 0,
    );
    push("weekplannerAllocations", "Wochenplan-Ressourcen-Zuordnungen", weekplannerAllocations);
    push("weekplannerOverrides", "Wochenplan-Zeit-Überschreibungen", weekplannerOverrides);

    if (match.matchExternalMapping) {
      const { provider, externalMatchId, externalSeasonId } = match.matchExternalMapping;
      await tx.sfvMatchDeletionTombstone.upsert({
        where: { tenantId_provider_externalMatchId: { tenantId, provider, externalMatchId } },
        create: {
          tenantId,
          provider,
          externalMatchId,
          externalSeasonId,
          deletedByUserId: deletedByUserId ?? null,
        },
        update: {
          externalSeasonId,
          deletedAt: new Date(),
          deletedByUserId: deletedByUserId ?? null,
        },
      });
    }

    await tx.weekplannerPlanAllocation.deleteMany({
      where: { tenantId, activityType: "MATCH", activityId: matchId },
    });
    await tx.weekplannerPlanActivityOverride.deleteMany({
      where: { tenantId, activityType: "MATCH", activityId: matchId },
    });

    const deleted = await tx.event.delete({ where: { id: matchId } });

    return { deleted, impact };
  });
}
