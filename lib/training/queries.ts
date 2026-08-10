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
import { currentTeamSeasonWhere } from "@/lib/teams/current-season";
import type { TrainingSeriesStatus, TrainingSessionStatus, Weekday } from "./types";

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
  /// TRAININGCENTER-03A: startsAt/endsAt are nullable per-weekday overrides —
  /// null means "fall back to the parent TrainingSeries.startsAt/endsAt".
  recurrenceDays: { weekday: string; startsAt: string | null; endsAt: string | null }[];
  /// TRAININGCENTER-03A: count of canonical TrainingSession rows generated for this series.
  _count?: { sessions: number };
};

export const trainingSeriesInclude = {
  recurrenceDays: {
    select: { weekday: true, startsAt: true, endsAt: true },
    orderBy: { weekday: "asc" as const },
  },
  _count: {
    select: { sessions: true },
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
    include: trainingSeriesInclude,
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
    include: trainingSeriesInclude,
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

/**
 * TRAININGCENTER-03A: Row shape for the "Team / TeamSeason" picker used by
 * the TrainingSeries create/edit form.
 *
 * Only active TeamSeasons belonging to active teams are eligible — creating
 * a TrainingSeries for an inactive team is rejected at the service layer
 * (see TrainingSeriesArchivedTeamError), so the picker only ever offers
 * choices that will actually succeed.
 *
 * trainers is the "Trainers where supported" display: the ACTIVE
 * TrainerTeamMember roster already assigned to this TeamSeason. There is no
 * per-TrainingSeries trainer assignment model yet — trainers are shown
 * read-only, sourced from the canonical team-level roster.
 */
export type TeamSeasonPickerRow = {
  id: string;
  teamId: string;
  teamName: string;
  seasonName: string;
  trainers: { id: string; name: string; roleLabel: string | null }[];
};

/**
 * Returns every eligible TeamSeason (of an active Team) for a tenant, for
 * use in the "Neue Trainingsserie" / TrainingSeries create picker.
 *
 * TEAMCENTER-UX-01C root-cause fix: this previously filtered ONLY by
 * `TeamSeason.status === "ACTIVE"`, with no season-currency constraint at
 * all. Nothing ever flips a TeamSeason's status during a season rollover,
 * so every historical season's TeamSeason for a Team accumulated in this
 * picker forever — a fundamentally different (and staler) selection
 * surface than what the Teams UI treats as canonical/current for that same
 * Team (see lib/teams/current-season.ts). The picker now additionally
 * requires the TeamSeason to belong to the canonical current season, so
 * "Neue Trainingsserie" can never offer a choice that contradicts what
 * Teams/TeamCenter shows as the Team's current season.
 *
 * MASTERDATA-SELECTOR-CONSISTENCY-03 / SEASON-01 root-cause fix: this query
 * is the ONLY canonical current-season consumer that both (a) starts from
 * TeamSeason (not Team) and (b) has zero fallback when nothing matches
 * `Season.isActive` (by design — see lib/teams/current-season.ts, and this
 * must stay that way to preserve PR #342's "never substitute a stale
 * season" protection). Teams/TeamCenter and the TournamentCenter Team
 * dropdown never go empty from a missing current Season because they are
 * Team-centric (a Team still renders even when its `teamSeasons` relation
 * filter matches nothing) and/or fall back to an explicit season key. This
 * picker has neither safety net, so an absent current Season alone makes
 * it render completely empty.
 *
 * SEASON-01: `Season.isActive` used to be silently resynced from calendar
 * dates on every call here (`syncSeasonActiveFlagsWithLifecycle()`) — that
 * was the actual root cause of the STAGE symptom ("no season is currently
 * shown as LÄUFT", empty TrainingCenter selector): the sync could clear
 * every Season's flag (when no Season's dates cover "today") or flip it
 * away from an admin's explicit choice on an unrelated page load. This
 * query now simply reads the persisted, explicitly-set current Season —
 * see lib/seasons/mutations.ts#activateSeason(), the only remaining writer
 * of `Season.isActive`. Once the admin explicitly activates a Season and
 * eligible Teams have a TeamSeason row for it, this picker returns them
 * immediately, with no dependency on visiting the Seasons admin page.
 */
export async function findTeamSeasonsForTenant(
  tenantId: string,
): Promise<TeamSeasonPickerRow[]> {
  const rows = await prisma.teamSeason.findMany({
    where: {
      status: "ACTIVE",
      team: { tenantId, isActive: true },
      ...currentTeamSeasonWhere(),
    },
    select: {
      id: true,
      teamId: true,
      team: { select: { name: true } },
      season: { select: { name: true } },
      trainerTeamMembers: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          roleLabel: true,
          person: { select: { firstName: true, lastName: true, displayName: true } },
        },
      },
    },
    orderBy: [{ team: { name: "asc" } }, { season: { startDate: "desc" } }],
  });

  return rows.map((row) => ({
    id: row.id,
    teamId: row.teamId,
    teamName: row.team.name,
    seasonName: row.season.name,
    trainers: row.trainerTeamMembers.map((t) => ({
      id: t.id,
      name: t.person.displayName || `${t.person.firstName} ${t.person.lastName}`,
      roleLabel: t.roleLabel,
    })),
  }));
}

/**
 * Returns a single TeamSeasonPickerRow by id, regardless of season currency
 * or TeamSeason.status — for display on the TrainingSeries EDIT form, where
 * the team/season assignment is immutable and must always be shown even if
 * the series was created in a season that is no longer canonical/current
 * (see findTeamSeasonsForTenant, which intentionally scopes to the current
 * season only and is therefore not safe to reuse for this lookup).
 *
 * Returns null when the TeamSeason does not exist or belongs to another
 * tenant.
 */
export async function findTeamSeasonPickerRow(
  tenantId: string,
  teamSeasonId: string,
): Promise<TeamSeasonPickerRow | null> {
  const row = await prisma.teamSeason.findFirst({
    where: {
      id: teamSeasonId,
      team: { tenantId },
    },
    select: {
      id: true,
      teamId: true,
      team: { select: { name: true } },
      season: { select: { name: true } },
      trainerTeamMembers: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          roleLabel: true,
          person: { select: { firstName: true, lastName: true, displayName: true } },
        },
      },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    teamId: row.teamId,
    teamName: row.team.name,
    seasonName: row.season.name,
    trainers: row.trainerTeamMembers.map((t) => ({
      id: t.id,
      name: t.person.displayName || `${t.person.firstName} ${t.person.lastName}`,
      roleLabel: t.roleLabel,
    })),
  };
}

// =============================================================================
// TRAININGCENTER-02: TrainingSession queries
// =============================================================================

/** Minimal row shape used internally by the generation service to diff against generated occurrences. */
export type TrainingSessionScheduleRow = {
  id: string;
  date: Date;
  weekday: Weekday;
  startAt: Date;
  endAt: Date;
  timezone: string;
  status: TrainingSessionStatus;
};

/** Row shape returned by the public read queries (includes the denormalised series title). */
export type TrainingSessionRow = TrainingSessionScheduleRow & {
  tenantId: string;
  trainingSeriesId: string;
  teamSeasonId: string;
  createdAt: Date;
  updatedAt: Date;
  /** TRAININGCENTER-02: occurrence-level schedule override fields — see TrainingSession doc comment in schema.prisma. */
  overrideDate: Date | null;
  overrideStartAt: Date | null;
  overrideEndAt: Date | null;
  trainingSeries: {
    title: string;
    teamSeason: {
      displayName: string;
      team: { name: string; shortName: string | null; alternativeName: string | null };
    };
  };
};

const sessionScheduleSelect = {
  id: true,
  date: true,
  weekday: true,
  startAt: true,
  endAt: true,
  timezone: true,
  status: true,
} as const;

const sessionFullSelect = {
  ...sessionScheduleSelect,
  tenantId: true,
  trainingSeriesId: true,
  teamSeasonId: true,
  createdAt: true,
  updatedAt: true,
  overrideDate: true,
  overrideStartAt: true,
  overrideEndAt: true,
  trainingSeries: {
    select: {
      title: true,
      teamSeason: {
        select: {
          displayName: true,
          team: { select: { name: true, shortName: true, alternativeName: true } },
        },
      },
    },
  },
} as const;

/**
 * Returns every TrainingSession row ever generated for `trainingSeriesId`,
 * regardless of date or the caller's current generation window.
 *
 * TRAININGCENTER-03A-FIX: reconciliation must be able to detect and
 * deactivate stale rows that fall outside the currently requested
 * generation window (e.g. sessions after a shortened validUntil, or before
 * a validFrom moved forward) — diffing only within the window would miss
 * exactly the rows the fix needs to catch. Scoped by tenantId defensively
 * even though trainingSeriesId is already tenant-validated by the caller.
 */
export async function findAllTrainingSessionsForSeries(
  tenantId: string,
  trainingSeriesId: string,
): Promise<TrainingSessionScheduleRow[]> {
  return prisma.trainingSession.findMany({
    where: { tenantId, trainingSeriesId },
    select: sessionScheduleSelect,
  }) as Promise<TrainingSessionScheduleRow[]>;
}

/** Row shape accepted by createManyTrainingSessions(). */
export type CreateTrainingSessionRow = {
  tenantId: string;
  trainingSeriesId: string;
  teamSeasonId: string;
  date: Date;
  weekday: Weekday;
  startAt: Date;
  endAt: Date;
  timezone: string;
};

/**
 * Bulk-inserts newly generated TrainingSession rows.
 *
 * Relies on @@unique([trainingSeriesId, date]) as a defence-in-depth guard:
 * callers are expected to only pass rows that don't already exist (per the
 * diff performed in the generation service), but a concurrent generation
 * run for the same series/window would fail the unique constraint rather
 * than silently duplicate a session.
 */
export async function createManyTrainingSessions(
  rows: CreateTrainingSessionRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await prisma.trainingSession.createMany({
    data: rows.map((row) => ({ ...row, status: "SCHEDULED" })),
  });
  return result.count;
}

/** Fields that may be re-synced on an existing TrainingSession when its series' recurrence changes. */
export type TrainingSessionScheduleUpdate = {
  weekday: Weekday;
  startAt: Date;
  endAt: Date;
  timezone: string;
};

/**
 * Updates only the derived schedule fields of an existing TrainingSession.
 *
 * Deliberately never touches `status` — exception/override handling
 * (CANCELLED, POSTPONED, MOVED) must survive regeneration runs.
 */
export async function updateTrainingSessionSchedule(
  sessionId: string,
  data: TrainingSessionScheduleUpdate,
): Promise<void> {
  await prisma.trainingSession.update({
    where: { id: sessionId },
    data,
  });
}

/**
 * TRAININGCENTER-03A-FIX: marks a previously-SCHEDULED TrainingSession as
 * RECURRENCE_REMOVED because its date no longer matches its series'
 * recurrence rule.
 *
 * Callers must only invoke this for rows currently in status SCHEDULED —
 * CANCELLED/POSTPONED/MOVED rows are genuine operational history and must
 * never be overwritten by reconciliation.
 */
export async function deactivateTrainingSession(sessionId: string): Promise<void> {
  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: { status: "RECURRENCE_REMOVED" },
  });
}

/**
 * TRAININGCENTER-03A-FIX: reactivates a RECURRENCE_REMOVED TrainingSession
 * back to SCHEDULED and re-syncs its derived schedule, because its date
 * matches the series' recurrence rule again (e.g. a removed weekday was
 * re-added). Reuses the existing row — the caller must resolve it via the
 * (trainingSeriesId, date) unique row rather than creating a new one, so no
 * duplicate is ever produced for the same occurrence.
 */
export async function reactivateTrainingSessionSchedule(
  sessionId: string,
  data: TrainingSessionScheduleUpdate,
): Promise<void> {
  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: { ...data, status: "SCHEDULED" },
  });
}

/**
 * TRAININGCENTER-01: transitions a TrainingSession's manually-set
 * operational status (SCHEDULED <-> CANCELLED today; POSTPONED/MOVED are
 * reserved for future exception handling per the schema doc comment).
 *
 * Deliberately separate from updateTrainingSessionSchedule() /
 * deactivateTrainingSession() / reactivateTrainingSessionSchedule(), which
 * are owned exclusively by the regeneration/reconciliation path — this
 * helper is the only writer of a genuine, manually-triggered status change
 * (see session-lifecycle-service.ts for the guarded transitions).
 */
export async function updateTrainingSessionStatus(
  sessionId: string,
  status: TrainingSessionStatus,
): Promise<void> {
  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: { status },
  });
}

/**
 * TRAININGCENTER-02: sets (or clears, when passed null) this single
 * TrainingSession's occurrence-level schedule override — see the
 * `overrideDate`/`overrideStartAt`/`overrideEndAt` doc comments on the
 * TrainingSession Prisma model. Never touches `status`, `date`, `startAt`,
 * `endAt`, or `weekday` — those remain exclusively owned by
 * session-generation-service.ts regeneration/reconciliation.
 *
 * Only ever called by session-reschedule-service.ts (see there for the
 * guarded transition and validation rules).
 */
export async function updateTrainingSessionOverride(
  sessionId: string,
  override: { overrideDate: Date | null; overrideStartAt: Date | null; overrideEndAt: Date | null },
): Promise<void> {
  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: override,
  });
}

/** Returns a single TrainingSession by id, scoped to the tenant. */
export async function findTrainingSessionById(
  tenantId: string,
  sessionId: string,
): Promise<TrainingSessionRow | null> {
  return prisma.trainingSession.findFirst({
    where: { id: sessionId, tenantId },
    select: sessionFullSelect,
  }) as Promise<TrainingSessionRow | null>;
}

/**
 * Returns TrainingSession rows for a tenant, with optional filters. Ordered
 * by date, then startAt.
 *
 * TRAININGCENTER-03A-FIX: canonical reads exclude RECURRENCE_REMOVED rows
 * by default (they are no longer part of the series' recurrence definition
 * and must not leak into Weekplanner/Dayplanner/Website/Infoboard
 * consumers). Pass `includeInactive: true` for historical/admin access.
 * An explicit `status` filter is itself an opt-in and is never combined
 * with the default exclusion.
 *
 * TRAININGCENTER-02: `dateFrom`/`dateTo` filter by each row's EFFECTIVE
 * date — `overrideDate` when a reschedule override is set, else the
 * canonical `date` — so a rescheduled occurrence is correctly included in
 * (or excluded from) the Month/Week/Day window it actually falls in, even
 * when that differs from its original recurrence slot.
 */
export async function findAllTrainingSessions(
  tenantId: string,
  opts: {
    trainingSeriesId?: string;
    teamSeasonId?: string;
    status?: TrainingSessionStatus;
    dateFrom?: Date;
    dateTo?: Date;
    includeInactive?: boolean;
  } = {},
): Promise<TrainingSessionRow[]> {
  const { trainingSeriesId, teamSeasonId, status, dateFrom, dateTo, includeInactive = false } =
    opts;

  const dateRange = {
    ...(dateFrom ? { gte: dateFrom } : {}),
    ...(dateTo ? { lte: dateTo } : {}),
  };

  return prisma.trainingSession.findMany({
    where: {
      tenantId,
      ...(trainingSeriesId ? { trainingSeriesId } : {}),
      ...(teamSeasonId ? { teamSeasonId } : {}),
      ...(status
        ? { status }
        : !includeInactive
          ? { NOT: { status: "RECURRENCE_REMOVED" } }
          : {}),
      ...(dateFrom || dateTo
        ? {
            OR: [
              { overrideDate: { not: null, ...dateRange } },
              { overrideDate: null, date: dateRange },
            ],
          }
        : {}),
    },
    select: sessionFullSelect,
    orderBy: [{ date: "asc" }, { startAt: "asc" }],
  }) as Promise<TrainingSessionRow[]>;
}
