/**
 * lib/training/__tests__/training-series-allocation-propagation.test.ts
 *
 * RESOURCE-AVAILABILITY-UX-01-C1 — regression tests proving that a
 * TrainingSeries' default resource allocations (TrainingAllocation) are the
 * DEFAULT allocation for every one of its generated TrainingSessions, and
 * that an occurrence-level override (TrainingSessionAllocation) remains
 * strictly occurrence-only.
 *
 * Unlike the fully-mocked per-module unit tests elsewhere in lib/training,
 * this file exercises the REAL service functions across the full lifecycle
 * (create series -> generate recurring sessions -> persist default
 * allocations -> resolve the EFFECTIVE per-session allocation the way every
 * real consumer does) against a lightweight in-memory fake of the Prisma
 * client (no network, no real database — consistent with every other test
 * in this repo), so a regression in the propagation path across module
 * boundaries would actually be caught.
 *
 * Coverage (see RESOURCE-AVAILABILITY-UX-01-C1 task spec):
 *   A. recurring series + pitch + dressing room -> multiple generated
 *      sessions -> resources correctly apply to EVERY occurrence.
 *   B. single/non-recurring series -> its one generated session gets the
 *      series' resources.
 *   C. individual session override -> only that occurrence changes; the
 *      series default and sibling occurrences remain unchanged.
 *   D. no duplicate allocations from a retried/duplicate allocation attempt.
 *   E. tenant isolation — a series' allocations and effective summaries
 *      never leak to another tenant.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Lightweight in-memory fake of the Prisma surface these services use ─────
// Table-specific (not a generic query engine) — deliberately narrow, mirroring
// exactly the where/select/include shapes the real service modules issue
// (see lib/training/queries.ts, training-service.ts,
// session-generation-service.ts, training-allocation-service.ts,
// session-allocation-service.ts).

type AnyRow = Record<string, unknown>;

function nextId(counter: { n: number }, prefix: string): string {
  counter.n += 1;
  return `${prefix}-${counter.n}`;
}

function makeFakeDb() {
  const idCounter = { n: 0 };

  const teams: AnyRow[] = [];
  const teamSeasons: AnyRow[] = [];
  const facilities: AnyRow[] = [];
  const facilityResources: AnyRow[] = [];
  const trainingSeriesRows: AnyRow[] = [];
  const recurrenceDays: AnyRow[] = [];
  const trainingSessions: AnyRow[] = [];
  const trainingAllocations: AnyRow[] = [];
  const trainingSessionAllocations: AnyRow[] = [];

  // ── Fixture helpers (used by the tests to seed data) ────────────────────
  function addTeam(overrides: Partial<AnyRow> = {}) {
    const team = {
      id: nextId(idCounter, "team"),
      tenantId: "tenant-a",
      name: "F1",
      shortName: null,
      alternativeName: null,
      isActive: true,
      ...overrides,
    };
    teams.push(team);
    return team;
  }

  function addTeamSeason(teamId: string, overrides: Partial<AnyRow> = {}) {
    const teamSeason = {
      id: nextId(idCounter, "teamseason"),
      teamId,
      displayName: "F1",
      ...overrides,
    };
    teamSeasons.push(teamSeason);
    return teamSeason;
  }

  function addFacility(overrides: Partial<AnyRow> = {}) {
    const facility = { id: nextId(idCounter, "facility"), name: "Sportanlage", status: "ACTIVE", ...overrides };
    facilities.push(facility);
    return facility;
  }

  function addFacilityResource(facilityId: string, overrides: Partial<AnyRow> = {}) {
    const resource = {
      id: nextId(idCounter, "resource"),
      tenantId: "tenant-a",
      facilityId,
      name: "Kunstrasen 1",
      code: "KR1",
      type: "FULL_PITCH",
      status: "ACTIVE",
      ...overrides,
    };
    facilityResources.push(resource);
    return resource;
  }

  function findTeam(id: string) {
    return teams.find((t) => t.id === id);
  }
  function findTeamSeason(id: string) {
    return teamSeasons.find((t) => t.id === id);
  }
  function findFacilityResource(id: string) {
    return facilityResources.find((r) => r.id === id);
  }
  function findFacility(id: string) {
    return facilities.find((f) => f.id === id);
  }

  function facilityResourceWithFacility(resource: AnyRow) {
    const facility = findFacility(resource.facilityId as string);
    return {
      name: resource.name,
      code: resource.code,
      type: resource.type,
      facilityId: resource.facilityId,
      facility: { name: facility?.name },
    };
  }

  function seriesInclude(series: AnyRow) {
    const ownSessions = trainingSessions.filter((s) => s.trainingSeriesId === series.id);
    return {
      ...series,
      recurrenceDays: recurrenceDays
        .filter((d) => d.trainingSeriesId === series.id)
        .sort((a, b) => String(a.weekday).localeCompare(String(b.weekday)))
        .map((d) => ({ weekday: d.weekday, startsAt: d.startsAt, endsAt: d.endsAt })),
      // Present so deleteTrainingSeriesPermanently()'s select shape resolves too
      // (it selects `sessions: { select: { id: true } }` inside its transaction).
      sessions: ownSessions.map((s) => ({ id: s.id })),
      _count: {
        sessions: ownSessions.length,
        allocations: trainingAllocations.filter((a) => a.trainingSeriesId === series.id).length,
        planAssignments: 0,
      },
    };
  }

  function sessionFullSelectShape(session: AnyRow) {
    const series = trainingSeriesRows.find((s) => s.id === session.trainingSeriesId);
    const teamSeason = teamSeasons.find((ts) => ts.id === series?.teamSeasonId);
    const team = teams.find((t) => t.id === teamSeason?.teamId);
    return {
      id: session.id,
      tenantId: session.tenantId,
      trainingSeriesId: session.trainingSeriesId,
      teamSeasonId: session.teamSeasonId,
      date: session.date,
      weekday: session.weekday,
      startAt: session.startAt,
      endAt: session.endAt,
      timezone: session.timezone,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      overrideDate: session.overrideDate ?? null,
      overrideStartAt: session.overrideStartAt ?? null,
      overrideEndAt: session.overrideEndAt ?? null,
      trainingSeries: {
        title: series?.title,
        teamSeason: {
          displayName: teamSeason?.displayName,
          team: { name: team?.name, shortName: team?.shortName, alternativeName: team?.alternativeName },
        },
      },
    };
  }

  const prisma = {
    teamSeason: {
      findFirst: vi.fn(async ({ where }: { where: AnyRow }) => {
        const teamSeason = findTeamSeason(where.id as string);
        if (!teamSeason) return null;
        const team = findTeam(teamSeason.teamId as string);
        const teamWhere = (where.team as AnyRow) ?? {};
        if (!team || (teamWhere.tenantId && team.tenantId !== teamWhere.tenantId)) return null;
        return { id: teamSeason.id, team: { id: team.id, isActive: team.isActive, tenantId: team.tenantId } };
      }),
    },
    trainingSeries: {
      create: vi.fn(async ({ data }: { data: AnyRow }) => {
        const id = nextId(idCounter, "series");
        const now = new Date();
        const series = {
          id,
          tenantId: data.tenantId,
          teamSeasonId: data.teamSeasonId,
          title: data.title,
          description: data.description ?? null,
          status: data.status,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          timezone: data.timezone,
          validFrom: data.validFrom ?? null,
          validUntil: data.validUntil ?? null,
          archivedAt: data.archivedAt ?? null,
          createdAt: now,
          updatedAt: now,
        };
        trainingSeriesRows.push(series);
        const nested = data.recurrenceDays?.create ?? [];
        for (const day of nested) {
          recurrenceDays.push({
            id: nextId(idCounter, "recurday"),
            trainingSeriesId: id,
            weekday: day.weekday,
            startsAt: day.startsAt ?? null,
            endsAt: day.endsAt ?? null,
            createdAt: now,
          });
        }
        return seriesInclude(series);
      }),
      findFirst: vi.fn(async ({ where }: { where: AnyRow }) => {
        const series = trainingSeriesRows.find(
          (s) => s.id === where.id && s.tenantId === where.tenantId,
        );
        if (!series) return null;
        return seriesInclude(series);
      }),
      findMany: vi.fn(async ({ where }: { where: AnyRow }) => {
        return trainingSeriesRows
          .filter((s) => s.tenantId === where.tenantId && (!where.status || s.status === where.status))
          .map((s) => ({ id: s.id }));
      }),
      update: vi.fn(async ({ where, data }: { where: AnyRow; data: AnyRow }) => {
        const series = trainingSeriesRows.find((s) => s.id === where.id);
        if (!series) throw new Error("series not found");
        if (data.recurrenceDays?.deleteMany) {
          for (let i = recurrenceDays.length - 1; i >= 0; i -= 1) {
            if (recurrenceDays[i].trainingSeriesId === series.id) recurrenceDays.splice(i, 1);
          }
        }
        const { recurrenceDays: recurrenceDaysData, ...plainData } = data;
        Object.assign(series, plainData, { updatedAt: new Date() });
        for (const day of recurrenceDaysData?.create ?? []) {
          recurrenceDays.push({
            id: nextId(idCounter, "recurday"),
            trainingSeriesId: series.id,
            weekday: day.weekday,
            startsAt: day.startsAt ?? null,
            endsAt: day.endsAt ?? null,
            createdAt: new Date(),
          });
        }
        return seriesInclude(series);
      }),
      /**
       * Mirrors deleteTrainingSeriesPermanently()'s `tx.trainingSeries.delete()`
       * — schema FK cascades remove recurrenceDays, sessions, that series'
       * TrainingAllocation rows, and each session's own
       * TrainingSessionAllocation rows. Used by the RESOURCE-AVAILABILITY-
       * UX-01-C1-V rollback-on-allocation-failure regression test below.
       */
      delete: vi.fn(async ({ where }: { where: AnyRow }) => {
        const idx = trainingSeriesRows.findIndex((s) => s.id === where.id);
        if (idx < 0) throw new Error("series not found");
        const [deleted] = trainingSeriesRows.splice(idx, 1);
        for (let i = recurrenceDays.length - 1; i >= 0; i -= 1) {
          if (recurrenceDays[i].trainingSeriesId === deleted.id) recurrenceDays.splice(i, 1);
        }
        for (let i = trainingAllocations.length - 1; i >= 0; i -= 1) {
          if (trainingAllocations[i].trainingSeriesId === deleted.id) trainingAllocations.splice(i, 1);
        }
        const sessionIdsToRemove = trainingSessions
          .filter((s) => s.trainingSeriesId === deleted.id)
          .map((s) => s.id as string);
        for (let i = trainingSessions.length - 1; i >= 0; i -= 1) {
          if (trainingSessions[i].trainingSeriesId === deleted.id) trainingSessions.splice(i, 1);
        }
        for (let i = trainingSessionAllocations.length - 1; i >= 0; i -= 1) {
          if (sessionIdsToRemove.includes(trainingSessionAllocations[i].trainingSessionId as string)) {
            trainingSessionAllocations.splice(i, 1);
          }
        }
        return { id: deleted.id };
      }),
    },
    weekplannerPlanAllocation: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    weekplannerPlanActivityOverride: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      // In-memory fake — no real isolation needed; the transaction callback
      // just runs against the SAME tables the rest of this fake operates on.
      return callback(prisma);
    }),
    trainingSession: {
      createMany: vi.fn(async ({ data }: { data: AnyRow[] }) => {
        const now = new Date();
        for (const row of data) {
          trainingSessions.push({
            id: nextId(idCounter, "session"),
            createdAt: now,
            updatedAt: now,
            overrideDate: null,
            overrideStartAt: null,
            overrideEndAt: null,
            ...row,
          });
        }
        return { count: data.length };
      }),
      findMany: vi.fn(async ({ where, select }: { where: AnyRow; select?: AnyRow }) => {
        const matched = trainingSessions.filter(
          (s) =>
            s.tenantId === where.tenantId &&
            (!where.trainingSeriesId || s.trainingSeriesId === where.trainingSeriesId) &&
            (!where.status ||
              (typeof where.status === "object" && where.status !== null
                ? s.status !== (where.status as { not?: string }).not
                : s.status === where.status)) &&
            (where.NOT?.status ? s.status !== where.NOT.status : true),
        );
        // findAllTrainingSessions() (canonical read) selects the FULL shape
        // including the `trainingSeries` relation; findAllTrainingSessionsForSeries()
        // (generation-service diffing) selects only the bare schedule fields.
        matched.sort(
          (a, b) => (a.date as Date).getTime() - (b.date as Date).getTime() ||
            (a.startAt as Date).getTime() - (b.startAt as Date).getTime(),
        );
        if (select?.trainingSeries) {
          return matched.map((s) => sessionFullSelectShape(s));
        }
        return matched.map((s) => ({
          id: s.id,
          date: s.date,
          weekday: s.weekday,
          startAt: s.startAt,
          endAt: s.endAt,
          timezone: s.timezone,
          status: s.status,
        }));
      }),
      findFirst: vi.fn(async ({ where }: { where: AnyRow }) => {
        const session = trainingSessions.find((s) => s.id === where.id && s.tenantId === where.tenantId);
        if (!session) return null;
        return sessionFullSelectShape(session);
      }),
      update: vi.fn(async ({ where, data }: { where: AnyRow; data: AnyRow }) => {
        const session = trainingSessions.find((s) => s.id === where.id);
        if (session) Object.assign(session, data);
        return session;
      }),
    },
    facilityResource: {
      findFirst: vi.fn(async ({ where }: { where: AnyRow }) => {
        const resource = findFacilityResource(where.id as string);
        if (!resource || resource.tenantId !== where.tenantId) return null;
        const facility = findFacility(resource.facilityId as string);
        return {
          id: resource.id,
          tenantId: resource.tenantId,
          status: resource.status,
          facility: { id: facility?.id, status: facility?.status },
        };
      }),
    },
    trainingAllocation: {
      create: vi.fn(async ({ data }: { data: AnyRow }) => {
        const existingDuplicate = trainingAllocations.find(
          (a) => a.trainingSeriesId === data.trainingSeriesId && a.facilityResourceId === data.facilityResourceId,
        );
        if (existingDuplicate) {
          throw new Error("Unique constraint failed on TrainingAllocation");
        }
        const now = new Date();
        const row = {
          id: nextId(idCounter, "alloc"),
          tenantId: data.tenantId,
          trainingSeriesId: data.trainingSeriesId,
          facilityResourceId: data.facilityResourceId,
          notes: data.notes ?? null,
          displayOrder: data.displayOrder,
          createdAt: now,
          updatedAt: now,
        };
        trainingAllocations.push(row);
        const resource = findFacilityResource(row.facilityResourceId as string)!;
        return { ...row, facilityResource: facilityResourceWithFacility(resource) };
      }),
      findFirst: vi.fn(async ({ where }: { where: AnyRow }) => {
        const row = trainingAllocations.find((a) => a.id === where.id && a.tenantId === where.tenantId);
        if (!row) return null;
        const resource = findFacilityResource(row.facilityResourceId as string)!;
        return { ...row, facilityResource: facilityResourceWithFacility(resource) };
      }),
      findMany: vi.fn(async ({ where }: { where: AnyRow }) => {
        return trainingAllocations
          .filter(
            (a) =>
              a.tenantId === where.tenantId &&
              (!where.trainingSeriesId || a.trainingSeriesId === where.trainingSeriesId) &&
              (!where.facilityResourceId || a.facilityResourceId === where.facilityResourceId),
          )
          .sort((a, b) => (a.displayOrder as number) - (b.displayOrder as number))
          .map((row) => {
            const resource = findFacilityResource(row.facilityResourceId as string)!;
            return { ...row, facilityResource: facilityResourceWithFacility(resource) };
          });
      }),
      aggregate: vi.fn(async ({ where }: { where: AnyRow }) => {
        const rows = trainingAllocations.filter((a) => a.trainingSeriesId === where.trainingSeriesId);
        const max = rows.length ? Math.max(...rows.map((r) => r.displayOrder as number)) : null;
        return { _max: { displayOrder: max } };
      }),
      delete: vi.fn(async ({ where }: { where: AnyRow }) => {
        const idx = trainingAllocations.findIndex((a) => a.id === where.id);
        if (idx >= 0) trainingAllocations.splice(idx, 1);
      }),
    },
    trainingSessionAllocation: {
      create: vi.fn(async ({ data }: { data: AnyRow }) => {
        const existingDuplicate = trainingSessionAllocations.find(
          (a) => a.trainingSessionId === data.trainingSessionId && a.facilityResourceId === data.facilityResourceId,
        );
        if (existingDuplicate) {
          throw new Error("Unique constraint failed on TrainingSessionAllocation");
        }
        const now = new Date();
        const row = {
          id: nextId(idCounter, "sessionalloc"),
          tenantId: data.tenantId,
          trainingSessionId: data.trainingSessionId,
          facilityResourceId: data.facilityResourceId,
          notes: data.notes ?? null,
          displayOrder: data.displayOrder,
          createdAt: now,
          updatedAt: now,
        };
        trainingSessionAllocations.push(row);
        const resource = findFacilityResource(row.facilityResourceId as string)!;
        return { ...row, facilityResource: facilityResourceWithFacility(resource) };
      }),
      findFirst: vi.fn(async ({ where }: { where: AnyRow }) => {
        const row = trainingSessionAllocations.find((a) => a.id === where.id && a.tenantId === where.tenantId);
        if (!row) return null;
        const resource = findFacilityResource(row.facilityResourceId as string)!;
        return { ...row, facilityResource: facilityResourceWithFacility(resource) };
      }),
      findMany: vi.fn(async ({ where }: { where: AnyRow }) => {
        return trainingSessionAllocations
          .filter(
            (a) =>
              a.tenantId === where.tenantId &&
              (!where.trainingSessionId || a.trainingSessionId === where.trainingSessionId) &&
              (!where.trainingSessionId_in || true),
          )
          .filter((a) =>
            where.trainingSessionId && typeof where.trainingSessionId === "object" && "in" in (where.trainingSessionId as AnyRow)
              ? (where.trainingSessionId as { in: string[] }).in.includes(a.trainingSessionId as string)
              : true,
          )
          .sort((a, b) => (a.displayOrder as number) - (b.displayOrder as number))
          .map((row) => {
            const resource = findFacilityResource(row.facilityResourceId as string)!;
            return { ...row, facilityResource: facilityResourceWithFacility(resource) };
          });
      }),
      aggregate: vi.fn(async ({ where }: { where: AnyRow }) => {
        const rows = trainingSessionAllocations.filter((a) => a.trainingSessionId === where.trainingSessionId);
        const max = rows.length ? Math.max(...rows.map((r) => r.displayOrder as number)) : null;
        return { _max: { displayOrder: max } };
      }),
      delete: vi.fn(async ({ where }: { where: AnyRow }) => {
        const idx = trainingSessionAllocations.findIndex((a) => a.id === where.id);
        if (idx >= 0) trainingSessionAllocations.splice(idx, 1);
      }),
    },
  };

  return {
    prisma,
    fixtures: { addTeam, addTeamSeason, addFacility, addFacilityResource },
    tables: { trainingSessions, trainingAllocations, trainingSessionAllocations, trainingSeriesRows },
  };
}

// ── Wire the fake into every module under test ───────────────────────────────

const fakeDb = makeFakeDb();

vi.mock("@/lib/db/prisma", () => ({
  get prisma() {
    return fakeDb.prisma;
  },
}));

// team-naming resolution is pure and unrelated to this propagation test —
// avoid pulling in unrelated modules by keeping it simple: real module is
// fine to use as-is (it's pure), so no mock needed here.

const { createTrainingSeries, updateTrainingSeries } = await import("../training-service");
const { generateTrainingSessions, getTrainingSession, listTrainingSessions } = await import(
  "../session-generation-service"
);
const {
  createTrainingAllocation,
  listAllocationsByTrainingSeries,
  listAllocationSummaryByTenant,
} = await import("../training-allocation-service");
const {
  createTrainingSessionAllocation,
  listAllocationsByTrainingSession,
  listSessionAllocationSummaryByTenant,
} = await import("../session-allocation-service");
const { assessTrainingOperationalState } = await import("../operational-state");
const { deleteTrainingSeriesPermanently } = await import("../training-lifecycle-service");

// ── Test setup ────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

async function seedTeamSeason(tenantId = TENANT_A) {
  const team = fakeDb.fixtures.addTeam({ tenantId });
  const teamSeason = fakeDb.fixtures.addTeamSeason(team.id as string);
  return teamSeason.id as string;
}

async function seedResource(
  type: "FULL_PITCH" | "DRESSING_ROOM",
  tenantId = TENANT_A,
  overrides: Partial<{ status: string }> = {},
) {
  const facility = fakeDb.fixtures.addFacility();
  return fakeDb.fixtures.addFacilityResource(facility.id as string, { tenantId, type, ...overrides }).id as string;
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeDb.tables.trainingSessions.length = 0;
  fakeDb.tables.trainingAllocations.length = 0;
  fakeDb.tables.trainingSessionAllocations.length = 0;
  fakeDb.tables.trainingSeriesRows.length = 0;
});

/** Resolves the SAME effective allocation summary every real TrainingCenter consumer resolves. */
async function effectiveSummaryFor(tenantId: string, session: { id: string; trainingSeriesId: string }) {
  const seriesSummaries = await listAllocationSummaryByTenant(tenantId);
  const sessionOverrides = await listSessionAllocationSummaryByTenant(tenantId);
  const seriesSummary = seriesSummaries.get(session.trainingSeriesId) ?? {
    hasPitchAllocation: false,
    hasDressingRoomAllocation: false,
  };
  const override = sessionOverrides.get(session.id);
  return {
    hasPitchAllocation: Boolean(override?.hasPitchAllocation || seriesSummary.hasPitchAllocation),
    hasDressingRoomAllocation: Boolean(override?.hasDressingRoomAllocation || seriesSummary.hasDressingRoomAllocation),
  };
}

// ── A. Recurring series + pitch + dressing room -> every occurrence ─────────

describe("A. recurring TrainingSeries: pitch + dressing room propagate to EVERY generated occurrence", () => {
  it("A1. every one of many weekly-generated sessions resolves the series' pitch + dressing room as its effective allocation", async () => {
    const teamSeasonId = await seedTeamSeason();
    const pitchResourceId = await seedResource("FULL_PITCH");
    const dressingResourceId = await seedResource("DRESSING_ROOM");

    const series = await createTrainingSeries(TENANT_A, {
      teamSeasonId,
      title: "F1 Montagstraining",
      startsAt: "17:15",
      endsAt: "18:45",
      timezone: "Europe/Zurich",
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-10"),
      validUntil: new Date("2026-09-28"), // 8 weeks -> 8 Monday occurrences
    });

    const generation = await generateTrainingSessions(TENANT_A, series.id, {
      from: new Date("2026-08-10"),
      to: new Date("2026-09-28"),
    });
    expect(generation.created).toBeGreaterThanOrEqual(7);

    // Resources are attached AFTER generation — proving the read-time
    // resolution does not depend on allocation-before-generation ordering.
    await createTrainingAllocation(TENANT_A, { trainingSeriesId: series.id, facilityResourceId: pitchResourceId });
    await createTrainingAllocation(TENANT_A, {
      trainingSeriesId: series.id,
      facilityResourceId: dressingResourceId,
    });

    const sessions = await listTrainingSessions(TENANT_A, { trainingSeriesId: series.id });
    expect(sessions.length).toBe(generation.created);
    expect(sessions.length).toBeGreaterThanOrEqual(7);

    for (const session of sessions) {
      const summary = await effectiveSummaryFor(TENANT_A, session);
      expect(summary).toEqual({ hasPitchAllocation: true, hasDressingRoomAllocation: true });

      const assessment = assessTrainingOperationalState(session, summary);
      expect(assessment.status).toBe("READY");

      // Every occurrence's edit page reads the SAME series-level defaults —
      // proving the allocations page consumer resolves them too, not just
      // the aggregate summary map.
      const seriesAllocations = await listAllocationsByTrainingSeries(TENANT_A, series.id);
      expect(seriesAllocations.map((a) => a.facilityResourceId).sort()).toEqual(
        [pitchResourceId, dressingResourceId].sort(),
      );
    }
  });

  it("A2. future occurrences generated by a LATER generateTrainingSessions() call also receive the series' current defaults", async () => {
    const teamSeasonId = await seedTeamSeason();
    const pitchResourceId = await seedResource("FULL_PITCH");

    const series = await createTrainingSeries(TENANT_A, {
      teamSeasonId,
      title: "F1 Montagstraining",
      startsAt: "17:15",
      endsAt: "18:45",
      timezone: "Europe/Zurich",
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-10"),
      validUntil: new Date("2026-08-24"), // short window initially
    });
    await generateTrainingSessions(TENANT_A, series.id, {
      from: new Date("2026-08-10"),
      to: new Date("2026-08-24"),
    });
    await createTrainingAllocation(TENANT_A, { trainingSeriesId: series.id, facilityResourceId: pitchResourceId });

    // Extend the recurrence window later (e.g. an admin rolling validUntil
    // forward via PUT /api/training-series/:id, which updates the series
    // and re-runs generation over the new window) — new occurrences did not
    // exist yet when the allocation was made.
    await updateTrainingSeries(TENANT_A, series.id, { validUntil: new Date("2026-10-05") });
    const laterGeneration = await generateTrainingSessions(TENANT_A, series.id, {
      from: new Date("2026-08-10"),
      to: new Date("2026-10-05"),
    });
    expect(laterGeneration.created).toBeGreaterThan(0);

    const sessions = await listTrainingSessions(TENANT_A, { trainingSeriesId: series.id });
    expect(sessions.length).toBeGreaterThanOrEqual(8);

    for (const session of sessions) {
      const summary = await effectiveSummaryFor(TENANT_A, session);
      expect(summary.hasPitchAllocation).toBe(true);
    }
  });
});

// ── B. Single/non-recurring series ───────────────────────────────────────────

describe("B. non-recurring (single-occurrence) TrainingSeries", () => {
  it("B1. its one generated session receives the series' pitch + dressing room allocation", async () => {
    const teamSeasonId = await seedTeamSeason();
    const pitchResourceId = await seedResource("FULL_PITCH");
    const dressingResourceId = await seedResource("DRESSING_ROOM");

    const series = await createTrainingSeries(TENANT_A, {
      teamSeasonId,
      title: "F1 Einmaltraining",
      startsAt: "17:15",
      endsAt: "18:45",
      timezone: "Europe/Zurich",
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-10"),
      validUntil: new Date("2026-08-11"), // single-occurrence window
    });

    const generation = await generateTrainingSessions(TENANT_A, series.id, {
      from: new Date("2026-08-10"),
      to: new Date("2026-08-11"),
    });
    expect(generation.created).toBe(1);

    await createTrainingAllocation(TENANT_A, { trainingSeriesId: series.id, facilityResourceId: pitchResourceId });
    await createTrainingAllocation(TENANT_A, {
      trainingSeriesId: series.id,
      facilityResourceId: dressingResourceId,
    });

    const [session] = await listTrainingSessions(TENANT_A, { trainingSeriesId: series.id });
    const summary = await effectiveSummaryFor(TENANT_A, session);
    expect(summary).toEqual({ hasPitchAllocation: true, hasDressingRoomAllocation: true });

    const dto = await getTrainingSession(TENANT_A, session.id);
    expect(assessTrainingOperationalState(dto, summary).status).toBe("READY");
  });
});

// ── C. Individual session override remains occurrence-only ──────────────────

describe("C. individual TrainingSession allocation override is strictly occurrence-only", () => {
  it("C1. overriding one occurrence's pitch does not change the series default or its sibling occurrences", async () => {
    const teamSeasonId = await seedTeamSeason();
    const seriesPitchId = await seedResource("FULL_PITCH", TENANT_A);
    const overridePitchId = await seedResource("FULL_PITCH", TENANT_A);
    const dressingResourceId = await seedResource("DRESSING_ROOM");

    const series = await createTrainingSeries(TENANT_A, {
      teamSeasonId,
      title: "F1 Montagstraining",
      startsAt: "17:15",
      endsAt: "18:45",
      timezone: "Europe/Zurich",
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-10"),
      validUntil: new Date("2026-09-07"), // 4 Monday occurrences
    });
    await generateTrainingSessions(TENANT_A, series.id, {
      from: new Date("2026-08-10"),
      to: new Date("2026-09-07"),
    });
    await createTrainingAllocation(TENANT_A, { trainingSeriesId: series.id, facilityResourceId: seriesPitchId });
    await createTrainingAllocation(TENANT_A, {
      trainingSeriesId: series.id,
      facilityResourceId: dressingResourceId,
    });

    const sessions = await listTrainingSessions(TENANT_A, { trainingSeriesId: series.id });
    expect(sessions.length).toBeGreaterThanOrEqual(4);
    const [firstSession, secondSession, ...restSessions] = sessions;

    // Override ONLY the first occurrence's pitch.
    await createTrainingSessionAllocation(TENANT_A, {
      trainingSessionId: firstSession.id,
      facilityResourceId: overridePitchId,
    });

    // The overridden occurrence now reflects the OVERRIDE resource, not the series default.
    const firstOverrides = await listAllocationsByTrainingSession(TENANT_A, firstSession.id);
    expect(firstOverrides.map((a) => a.facilityResourceId)).toEqual([overridePitchId]);

    // Every sibling occurrence — and the series itself — is completely unaffected.
    for (const sibling of [secondSession, ...restSessions]) {
      const siblingOverrides = await listAllocationsByTrainingSession(TENANT_A, sibling.id);
      expect(siblingOverrides).toEqual([]);
      const summary = await effectiveSummaryFor(TENANT_A, sibling);
      expect(summary.hasPitchAllocation).toBe(true); // still resolves via the (unchanged) series default
    }

    const seriesAllocations = await listAllocationsByTrainingSeries(TENANT_A, series.id);
    expect(seriesAllocations.map((a) => a.facilityResourceId).sort()).toEqual(
      [seriesPitchId, dressingResourceId].sort(),
    );

    // The overridden occurrence's EFFECTIVE summary now differs from its siblings for pitch.
    const overriddenSummary = await effectiveSummaryFor(TENANT_A, firstSession);
    expect(overriddenSummary.hasPitchAllocation).toBe(true); // still true, just via a different resource
    const overrideMap = await listSessionAllocationSummaryByTenant(TENANT_A);
    expect(overrideMap.get(firstSession.id)?.hasPitchAllocation).toBe(true);
    expect(overrideMap.has(secondSession.id)).toBe(false);
  });

  it("C2. removing the override reverts the occurrence back to the series default — no separate reset needed", async () => {
    const teamSeasonId = await seedTeamSeason();
    const seriesPitchId = await seedResource("FULL_PITCH");
    const overridePitchId = await seedResource("FULL_PITCH");

    const series = await createTrainingSeries(TENANT_A, {
      teamSeasonId,
      title: "F1 Training",
      startsAt: "17:15",
      endsAt: "18:45",
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-10"),
      validUntil: new Date("2026-08-11"),
    });
    await generateTrainingSessions(TENANT_A, series.id, { from: new Date("2026-08-10"), to: new Date("2026-08-11") });
    await createTrainingAllocation(TENANT_A, { trainingSeriesId: series.id, facilityResourceId: seriesPitchId });

    const [session] = await listTrainingSessions(TENANT_A, { trainingSeriesId: series.id });
    const override = await createTrainingSessionAllocation(TENANT_A, {
      trainingSessionId: session.id,
      facilityResourceId: overridePitchId,
    });

    let overrides = await listAllocationsByTrainingSession(TENANT_A, session.id);
    expect(overrides).toHaveLength(1);

    const { deleteTrainingSessionAllocation } = await import("../session-allocation-service");
    await deleteTrainingSessionAllocation(TENANT_A, override.id);

    overrides = await listAllocationsByTrainingSession(TENANT_A, session.id);
    expect(overrides).toEqual([]);
    const summary = await effectiveSummaryFor(TENANT_A, session);
    expect(summary.hasPitchAllocation).toBe(true); // falls back to the series default again
  });
});

// ── D. No duplicate allocations on retry ─────────────────────────────────────

describe("D. no duplicate allocations from a retried allocation attempt", () => {
  it("D1. retrying createTrainingAllocation for the same (series, resource) pair is rejected, not duplicated", async () => {
    const teamSeasonId = await seedTeamSeason();
    const pitchResourceId = await seedResource("FULL_PITCH");

    const series = await createTrainingSeries(TENANT_A, {
      teamSeasonId,
      title: "F1 Training",
      startsAt: "17:15",
      endsAt: "18:45",
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-10"),
      validUntil: new Date("2026-08-11"),
    });

    await createTrainingAllocation(TENANT_A, { trainingSeriesId: series.id, facilityResourceId: pitchResourceId });

    const { TrainingAllocationDuplicateError } = await import("../errors");
    await expect(
      createTrainingAllocation(TENANT_A, { trainingSeriesId: series.id, facilityResourceId: pitchResourceId }),
    ).rejects.toThrow(TrainingAllocationDuplicateError);

    const allocations = await listAllocationsByTrainingSeries(TENANT_A, series.id);
    expect(allocations).toHaveLength(1);
  });

  it("D2. re-running generateTrainingSessions() for the same series/window never duplicates sessions or touches allocations", async () => {
    const teamSeasonId = await seedTeamSeason();
    const pitchResourceId = await seedResource("FULL_PITCH");

    const series = await createTrainingSeries(TENANT_A, {
      teamSeasonId,
      title: "F1 Training",
      startsAt: "17:15",
      endsAt: "18:45",
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-10"),
      validUntil: new Date("2026-09-07"),
    });
    await createTrainingAllocation(TENANT_A, { trainingSeriesId: series.id, facilityResourceId: pitchResourceId });

    const window = { from: new Date("2026-08-10"), to: new Date("2026-09-07") };
    const first = await generateTrainingSessions(TENANT_A, series.id, window);
    const second = await generateTrainingSessions(TENANT_A, series.id, window);

    expect(second.created).toBe(0);
    expect(second.unchanged).toBe(first.created);

    const sessions = await listTrainingSessions(TENANT_A, { trainingSeriesId: series.id });
    expect(sessions).toHaveLength(first.created);

    const allocations = await listAllocationsByTrainingSeries(TENANT_A, series.id);
    expect(allocations).toHaveLength(1); // regeneration never touches TrainingAllocation
  });
});

// ── E. Tenant isolation ───────────────────────────────────────────────────────

describe("E. tenant isolation", () => {
  it("E1. tenant B's allocation summary map never includes tenant A's series", async () => {
    const teamSeasonIdA = await seedTeamSeason(TENANT_A);
    const pitchResourceIdA = await seedResource("FULL_PITCH", TENANT_A);

    const seriesA = await createTrainingSeries(TENANT_A, {
      teamSeasonId: teamSeasonIdA,
      title: "F1 Training",
      startsAt: "17:15",
      endsAt: "18:45",
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-10"),
      validUntil: new Date("2026-08-11"),
    });
    await createTrainingAllocation(TENANT_A, { trainingSeriesId: seriesA.id, facilityResourceId: pitchResourceIdA });

    const tenantBSummaries = await listAllocationSummaryByTenant(TENANT_B);
    expect(tenantBSummaries.has(seriesA.id)).toBe(false);

    const tenantASummaries = await listAllocationSummaryByTenant(TENANT_A);
    expect(tenantASummaries.get(seriesA.id)).toEqual({ hasPitchAllocation: true, hasDressingRoomAllocation: false });
  });

  it("E2. a cross-tenant facilityResourceId is rejected when attempting to allocate it to another tenant's series", async () => {
    const teamSeasonIdA = await seedTeamSeason(TENANT_A);
    const pitchResourceIdB = await seedResource("FULL_PITCH", TENANT_B);

    const seriesA = await createTrainingSeries(TENANT_A, {
      teamSeasonId: teamSeasonIdA,
      title: "F1 Training",
      startsAt: "17:15",
      endsAt: "18:45",
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-10"),
      validUntil: new Date("2026-08-11"),
    });

    const { TrainingAllocationResourceNotFoundError } = await import("../errors");
    await expect(
      createTrainingAllocation(TENANT_A, { trainingSeriesId: seriesA.id, facilityResourceId: pitchResourceIdB }),
    ).rejects.toThrow(TrainingAllocationResourceNotFoundError);
  });
});

// ── F. RESOURCE-AVAILABILITY-UX-01-C1-V — atomic creation, real rollback ────

describe("F. atomic creation: a failed default allocation leaves NO trace of the series/sessions", () => {
  it("F1. simulating the POST /api/training-series rollback sequence (create -> generate -> allocation fails -> deleteTrainingSeriesPermanently) leaves zero series, sessions, or allocations behind", async () => {
    const teamSeasonId = await seedTeamSeason();
    const validPitchId = await seedResource("FULL_PITCH");
    const archivedDressingRoomId = await seedResource("DRESSING_ROOM", TENANT_A, { status: "ARCHIVED" });

    const series = await createTrainingSeries(TENANT_A, {
      teamSeasonId,
      title: "F1 Montagstraining",
      startsAt: "17:15",
      endsAt: "18:45",
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-10"),
      validUntil: new Date("2026-09-07"), // 4 occurrences
    });
    const generation = await generateTrainingSessions(TENANT_A, series.id, {
      from: new Date("2026-08-10"),
      to: new Date("2026-09-07"),
    });
    expect(generation.created).toBeGreaterThan(0);

    // First resource succeeds, second (archived) fails — exactly the
    // sequence app/api/training-series/route.ts runs.
    await createTrainingAllocation(TENANT_A, { trainingSeriesId: series.id, facilityResourceId: validPitchId });

    const { TrainingAllocationArchivedResourceError } = await import("../errors");
    await expect(
      createTrainingAllocation(TENANT_A, {
        trainingSeriesId: series.id,
        facilityResourceId: archivedDressingRoomId,
      }),
    ).rejects.toThrow(TrainingAllocationArchivedResourceError);

    // Pre-rollback sanity check: the series, its sessions, and the ONE
    // successful allocation all genuinely exist before rollback runs.
    expect(fakeDb.tables.trainingSeriesRows.some((s) => s.id === series.id)).toBe(true);
    expect(fakeDb.tables.trainingSessions.some((s) => s.trainingSeriesId === series.id)).toBe(true);
    expect(fakeDb.tables.trainingAllocations.some((a) => a.trainingSeriesId === series.id)).toBe(true);

    // The route rolls back via the EXISTING deleteTrainingSeriesPermanently()
    // service on any allocation failure — reuse the REAL service here too.
    await deleteTrainingSeriesPermanently(TENANT_A, series.id);

    expect(fakeDb.tables.trainingSeriesRows.some((s) => s.id === series.id)).toBe(false);
    expect(fakeDb.tables.trainingSessions.some((s) => s.trainingSeriesId === series.id)).toBe(false);
    expect(fakeDb.tables.trainingAllocations.some((a) => a.trainingSeriesId === series.id)).toBe(false);

    // The series is genuinely gone, not just archived/hidden — a fresh
    // create attempt reusing the exact same title succeeds. Note: no
    // duplicate-title conflict remains, proving zero orphaned trace.
    const recreated = await createTrainingSeries(TENANT_A, {
      teamSeasonId,
      title: "F1 Montagstraining",
      startsAt: "17:15",
      endsAt: "18:45",
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-10"),
      validUntil: new Date("2026-08-11"),
    });
    expect(recreated.id).not.toBe(series.id);
  });
});
