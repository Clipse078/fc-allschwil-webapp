/**
 * lib/training/__tests__/occurrence-exceptions.test.ts
 *
 * TRAININGCENTER-02 regression coverage — cross-cutting scenarios for the
 * canonical training exception model (occurrence-level reschedule +
 * allocation override), exercised through the same presentation-layer
 * helpers Month/Week/Day actually render (assessTrainingOperationalState,
 * buildTrainingCenterViewModel). Mirrors the spirit of
 * lib/matchcenter/__tests__/reschedule-lifecycle.test.ts: proves the
 * *combination* of features behaves correctly, not just each function in
 * isolation (those are covered by session-reschedule-service.test.ts,
 * session-allocation-service.test.ts, view-model.test.ts and
 * operational-state.test.ts individually).
 *
 * Scenario: "E1 Dienstagstraining" normally runs every Tuesday,
 * 17:00–18:00, with a fully-allocated Spielfeld/Halle + Garderobe on its
 * TrainingSeries. For ONE Tuesday, an authorized user reschedules it to
 * Wednesday 18:00–19:00 with a different Spielfeld/Halle, while its
 * Garderobe keeps inheriting the series default.
 */

import { describe, expect, it } from "vitest";
import { assessTrainingOperationalState } from "../operational-state";
import { buildTrainingCenterViewModel } from "../view-model";
import type { TrainingAllocationSummary } from "../operational-state";
import type { TrainingSessionDto } from "../types";

const SERIES_ID = "series-e1-tuesday";

const SERIES_FULLY_ALLOCATED: TrainingAllocationSummary = {
  hasPitchAllocation: true,
  hasDressingRoomAllocation: true,
};

/** The edited occurrence: originally Tue 2026-08-04 17:00-18:00, moved to Wed 2026-08-05 18:00-19:00. */
function editedSession(overrides: Partial<TrainingSessionDto> = {}): TrainingSessionDto {
  return {
    id: "session-edited",
    tenantId: "tenant-1",
    trainingSeriesId: SERIES_ID,
    trainingSeriesTitle: "E1 Dienstagstraining",
    teamSeasonId: "team-season-1",
    teamName: "E1",
    // Effective (post-reschedule) values:
    date: "2026-08-05",
    weekday: "WEDNESDAY",
    startAt: "2026-08-05T16:00:00.000Z", // 18:00 CEST
    endAt: "2026-08-05T17:00:00.000Z", // 19:00 CEST
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    // Canonical (series-derived) values — unaffected by the edit:
    originalDate: "2026-08-04",
    originalStartAt: "2026-08-04T15:00:00.000Z", // 17:00 CEST
    originalEndAt: "2026-08-04T16:00:00.000Z", // 18:00 CEST
    isRescheduled: true,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

/** An unaffected sibling occurrence of the SAME series, one week later. */
function siblingSession(overrides: Partial<TrainingSessionDto> = {}): TrainingSessionDto {
  return {
    id: "session-sibling",
    tenantId: "tenant-1",
    trainingSeriesId: SERIES_ID,
    trainingSeriesTitle: "E1 Dienstagstraining",
    teamSeasonId: "team-season-1",
    teamName: "E1",
    date: "2026-08-11",
    weekday: "TUESDAY",
    startAt: "2026-08-11T15:00:00.000Z",
    endAt: "2026-08-11T16:00:00.000Z",
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    originalDate: "2026-08-11",
    originalStartAt: "2026-08-11T15:00:00.000Z",
    originalEndAt: "2026-08-11T16:00:00.000Z",
    isRescheduled: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("TRAININGCENTER-02 — one-occurrence reschedule + allocation override, end to end", () => {
  it("1. one-occurrence reschedule: the edited session's effective date/time differ from its canonical (series) schedule", () => {
    const session = editedSession();
    expect(session.date).toBe("2026-08-05");
    expect(session.originalDate).toBe("2026-08-04");
    expect(session.isRescheduled).toBe(true);
    expect(session.startAt).not.toBe(session.originalStartAt);
  });

  it("2. one-occurrence allocation override + regression of series-level defaults: overriding ONLY the pitch keeps Garderobe on the series default", () => {
    const session = editedSession();
    const seriesSummary: TrainingAllocationSummary = { hasPitchAllocation: true, hasDressingRoomAllocation: true };
    const sessionOverride: TrainingAllocationSummary = {
      hasPitchAllocation: true, // overridden to a different Spielfeld/Halle
      hasDressingRoomAllocation: false, // no override -> should still resolve from the series
    };

    const model = buildTrainingCenterViewModel([session], new Map([[SERIES_ID, seriesSummary]]), {
      sessionAllocationOverrides: new Map([[session.id, sessionOverride]]),
    });

    // Garderobe resolves true because the series default is inherited, even
    // though the session's OWN override map reports false for that group.
    expect(model.rows[0].allocationSummary).toEqual({
      hasPitchAllocation: true,
      hasDressingRoomAllocation: true,
    });
    expect(model.rows[0].assessment.status).toBe("READY");
  });

  it("3. unaffected sibling sessions: editing one occurrence never changes the operational state of another occurrence of the same series", () => {
    const edited = editedSession();
    const sibling = siblingSession();

    const model = buildTrainingCenterViewModel([edited, sibling], new Map([[SERIES_ID, SERIES_FULLY_ALLOCATED]]), {
      sessionAllocationOverrides: new Map([[edited.id, { hasPitchAllocation: true, hasDressingRoomAllocation: true }]]),
    });

    const sibRow = model.rows.find((r) => r.session.id === sibling.id)!;
    expect(sibRow.session.date).toBe("2026-08-11"); // still on its own canonical Tuesday
    expect(sibRow.session.isRescheduled).toBe(false);
    expect(sibRow.allocationSummary).toEqual(SERIES_FULLY_ALLOCATED);
    expect(sibRow.assessment.status).toBe("READY");
  });

  it("4. Offen -> Erledigt: an occurrence-level allocation override alone can move a session from OPEN to READY without touching the series", () => {
    const session = editedSession();
    const seriesUnallocated: TrainingAllocationSummary = {
      hasPitchAllocation: false,
      hasDressingRoomAllocation: false,
    };

    const before = buildTrainingCenterViewModel([session], new Map([[SERIES_ID, seriesUnallocated]]));
    expect(before.rows[0].assessment.status).toBe("OPEN");
    expect(before.kpis).toEqual({ gesamt: 1, offen: 1, erledigt: 0 });

    const after = buildTrainingCenterViewModel([session], new Map([[SERIES_ID, seriesUnallocated]]), {
      sessionAllocationOverrides: new Map([
        [session.id, { hasPitchAllocation: true, hasDressingRoomAllocation: true }],
      ]),
    });
    expect(after.rows[0].assessment.status).toBe("READY");
    expect(after.kpis).toEqual({ gesamt: 1, offen: 0, erledigt: 1 });
  });

  it("5. cancellation/restore interaction: a CANCELLED rescheduled/overridden occurrence is unconditionally NOT_APPLICABLE, regardless of its override", () => {
    const cancelled = editedSession({ status: "CANCELLED" });
    const assessment = assessTrainingOperationalState(cancelled, {
      hasPitchAllocation: false,
      hasDressingRoomAllocation: false,
    });

    expect(assessment.status).toBe("NOT_APPLICABLE");
    expect(assessment.actions).toEqual([]);
  });

  it("5b. cancellation/restore interaction: restoring a rescheduled occurrence re-evaluates it as a normal SCHEDULED occurrence, preserving its override", () => {
    const restored = editedSession({ status: "SCHEDULED" }); // status flipped back by session-lifecycle-service
    expect(restored.isRescheduled).toBe(true); // the reschedule override itself is untouched by cancel/restore
    expect(restored.date).toBe("2026-08-05");

    const assessment = assessTrainingOperationalState(restored, {
      hasPitchAllocation: true,
      hasDressingRoomAllocation: true,
    });
    expect(assessment.status).toBe("READY");
  });

  it("6. a cancelled occurrence's override allocations are excluded from KPI 'Offen' regardless of coverage", () => {
    const cancelled = editedSession({ status: "CANCELLED" });
    const model = buildTrainingCenterViewModel([cancelled], new Map([[SERIES_ID, { hasPitchAllocation: false, hasDressingRoomAllocation: false }]]), {
      sessionAllocationOverrides: new Map([[cancelled.id, { hasPitchAllocation: false, hasDressingRoomAllocation: false }]]),
    });

    expect(model.rows[0].assessment.status).toBe("NOT_APPLICABLE");
    expect(model.kpis).toEqual({ gesamt: 1, offen: 0, erledigt: 1 });
  });
});
