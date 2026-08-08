import { describe, expect, it } from "vitest";
import {
  assessTrainingOperationalState,
  isTrainingSessionOperationallyOpen,
  type TrainingAllocationSummary,
} from "../operational-state";
import type { TrainingSessionDto, TrainingSessionStatus } from "../types";

function session(overrides: Partial<TrainingSessionDto> = {}): TrainingSessionDto {
  return {
    id: "session-1",
    tenantId: "tenant-1",
    trainingSeriesId: "series-1",
    trainingSeriesTitle: "E1 Dienstagstraining",
    teamSeasonId: "team-season-1",
    teamName: "E1",
    date: "2026-08-11",
    weekday: "TUESDAY",
    startAt: "2026-08-11T16:00:00.000Z",
    endAt: "2026-08-11T17:30:00.000Z",
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    originalDate: "2026-08-11",
    originalStartAt: "2026-08-11T16:00:00.000Z",
    originalEndAt: "2026-08-11T17:30:00.000Z",
    isRescheduled: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const FULLY_ALLOCATED: TrainingAllocationSummary = {
  hasPitchAllocation: true,
  hasDressingRoomAllocation: true,
};

describe("assessTrainingOperationalState", () => {
  it("is READY when a SCHEDULED session's series has both pitch and dressing room allocated", () => {
    const assessment = assessTrainingOperationalState(session(), FULLY_ALLOCATED);
    expect(assessment.status).toBe("READY");
    expect(assessment.actions).toEqual([]);
    expect(assessment.actionCount).toBe(0);
  });

  it("is OPEN with a pitch action when the pitch/resource allocation is missing", () => {
    const assessment = assessTrainingOperationalState(session(), {
      hasPitchAllocation: false,
      hasDressingRoomAllocation: true,
    });
    expect(assessment.status).toBe("OPEN");
    expect(assessment.actions).toEqual([{ key: "pitch", label: "Spielfeld/Halle" }]);
    expect(assessment.actionCount).toBe(1);
  });

  it("is OPEN with a dressing-room action when the dressing-room allocation is missing", () => {
    const assessment = assessTrainingOperationalState(session(), {
      hasPitchAllocation: true,
      hasDressingRoomAllocation: false,
    });
    expect(assessment.status).toBe("OPEN");
    expect(assessment.actions).toEqual([{ key: "dressing-room", label: "Garderobe" }]);
  });

  it("is OPEN with both actions when neither allocation exists", () => {
    const assessment = assessTrainingOperationalState(session(), {
      hasPitchAllocation: false,
      hasDressingRoomAllocation: false,
    });
    expect(assessment.status).toBe("OPEN");
    expect(assessment.actionCount).toBe(2);
    expect(assessment.actions.map((a) => a.key)).toEqual(["pitch", "dressing-room"]);
  });

  it("treats a missing allocation summary (no series match) as fully unallocated", () => {
    const assessment = assessTrainingOperationalState(session(), undefined);
    expect(assessment.status).toBe("OPEN");
    expect(assessment.actionCount).toBe(2);
  });

  it.each<TrainingSessionStatus>(["CANCELLED", "POSTPONED", "MOVED", "RECURRENCE_REMOVED"])(
    "is unconditionally NOT_APPLICABLE for a %s session, even with zero allocations",
    (status) => {
      const assessment = assessTrainingOperationalState(session({ status }), {
        hasPitchAllocation: false,
        hasDressingRoomAllocation: false,
      });
      expect(assessment.status).toBe("NOT_APPLICABLE");
      expect(assessment.actions).toEqual([]);
      expect(assessment.actionCount).toBe(0);
    },
  );

  it("there is no away-training exception: a HOME-only domain still requires both allocations", () => {
    // Trainings have no homeAway concept at all (unlike Matchcenter) —
    // this test documents that assessTrainingOperationalState() never
    // special-cases anything resembling an "away" state.
    const assessment = assessTrainingOperationalState(session(), {
      hasPitchAllocation: false,
      hasDressingRoomAllocation: false,
    });
    expect(assessment.status).not.toBe("NOT_APPLICABLE");
  });
});

describe("isTrainingSessionOperationallyOpen", () => {
  it("returns true only for OPEN assessments", () => {
    expect(isTrainingSessionOperationallyOpen(session(), FULLY_ALLOCATED)).toBe(false);
    expect(
      isTrainingSessionOperationallyOpen(session(), {
        hasPitchAllocation: false,
        hasDressingRoomAllocation: true,
      }),
    ).toBe(true);
    expect(
      isTrainingSessionOperationallyOpen(session({ status: "CANCELLED" }), undefined),
    ).toBe(false);
  });
});
