/**
 * Tests for lib/training/create-training-series-orchestration.ts
 * (PLANNING-CREATION-UX-01B)
 *
 * Proves the guided TrainingCenter creation-workflow orchestration:
 *   1. Creates the series, then allocates Spielfeld/Halle + Garderobe in order.
 *   2. A failed allocation is collected as a per-step error without aborting
 *      the remaining allocations, and the series is still created (no rollback).
 *   3. Series creation failure aborts the whole orchestration — no allocation
 *      calls are attempted.
 *   4. `ok` reflects whether every requested allocation succeeded.
 *
 * No network, no database — `deps` are plain mocked functions.
 */

import { describe, it, expect, vi } from "vitest";
import {
  orchestrateTrainingSeriesCreation,
  type TrainingSeriesAllocationDraft,
  type TrainingSeriesCreationDeps,
  type TrainingSeriesCreationPlan,
} from "../create-training-series-orchestration";

const SERIES_ID = "series-1";
const GENERATION = { occurrencesInWindow: 1, created: 1, updated: 0, unchanged: 0 };

function resource(facilityResourceId: string, facilityResourceName = facilityResourceId): TrainingSeriesAllocationDraft {
  return { facilityResourceId, facilityResourceName };
}

function basePlan(overrides: Partial<TrainingSeriesCreationPlan> = {}): TrainingSeriesCreationPlan {
  return { pitchHallAllocations: [], dressingRoomAllocations: [], ...overrides };
}

function baseDeps(
  overrides: Partial<TrainingSeriesCreationDeps<typeof GENERATION>> = {},
): TrainingSeriesCreationDeps<typeof GENERATION> {
  return {
    createSeries: vi.fn().mockResolvedValue({ seriesId: SERIES_ID, generation: GENERATION }),
    addAllocation: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("orchestrateTrainingSeriesCreation — happy path", () => {
  it("creates the series and allocates Spielfeld/Halle + Garderobe in order", async () => {
    const plan = basePlan({
      pitchHallAllocations: [resource("res-kr2", "Kunstrasen 2")],
      dressingRoomAllocations: [resource("res-e1", "Garderobe E1")],
    });
    const deps = baseDeps();

    const result = await orchestrateTrainingSeriesCreation(plan, deps);

    expect(result.seriesId).toBe(SERIES_ID);
    expect(result.generation).toEqual(GENERATION);
    expect(deps.addAllocation).toHaveBeenCalledTimes(2);
    expect(deps.addAllocation).toHaveBeenNthCalledWith(1, SERIES_ID, plan.pitchHallAllocations[0]);
    expect(deps.addAllocation).toHaveBeenNthCalledWith(2, SERIES_ID, plan.dressingRoomAllocations[0]);
    expect(result.resourceAllocationErrors).toHaveLength(0);
    expect(result.dressingRoomAllocationErrors).toHaveLength(0);
    expect(result.ok).toBe(true);
  });

  it("supports multiple pitch/hall resources and multiple dressing rooms", async () => {
    const plan = basePlan({
      pitchHallAllocations: [resource("res-kr2"), resource("res-kr3a")],
      dressingRoomAllocations: [resource("res-e1"), resource("res-e2")],
    });
    const deps = baseDeps();

    const result = await orchestrateTrainingSeriesCreation(plan, deps);

    expect(deps.addAllocation).toHaveBeenCalledTimes(4);
    expect(result.ok).toBe(true);
  });

  it("creates the series with zero allocations (resources are optional at creation)", async () => {
    const deps = baseDeps();
    const result = await orchestrateTrainingSeriesCreation(basePlan(), deps);

    expect(result.seriesId).toBe(SERIES_ID);
    expect(deps.addAllocation).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });
});

describe("orchestrateTrainingSeriesCreation — partial allocation failure", () => {
  it("collects a Spielfeld/Halle allocation error without aborting Garderobe allocations", async () => {
    const plan = basePlan({
      pitchHallAllocations: [resource("res-archived", "Kunstrasen 3")],
      dressingRoomAllocations: [resource("res-e1", "Garderobe E1")],
    });
    const deps = baseDeps({
      addAllocation: vi
        .fn()
        .mockRejectedValueOnce(new Error("FacilityResource is archived and cannot receive new allocations"))
        .mockResolvedValueOnce(undefined),
    });

    const result = await orchestrateTrainingSeriesCreation(plan, deps);

    expect(deps.addAllocation).toHaveBeenCalledTimes(2);
    expect(result.resourceAllocationErrors).toHaveLength(1);
    expect(result.resourceAllocationErrors[0].error).toMatch(/archived/);
    expect(result.dressingRoomAllocationErrors).toHaveLength(0);
    expect(result.ok).toBe(false);
    // the series itself was still created — no rollback.
    expect(result.seriesId).toBe(SERIES_ID);
  });

  it("collects a Garderobe allocation error independently of Spielfeld/Halle results", async () => {
    const plan = basePlan({
      pitchHallAllocations: [resource("res-kr2")],
      dressingRoomAllocations: [resource("res-duplicate", "Garderobe E2")],
    });
    const deps = baseDeps({
      addAllocation: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("FacilityResource is already allocated to TrainingSeries")),
    });

    const result = await orchestrateTrainingSeriesCreation(plan, deps);

    expect(result.resourceAllocationErrors).toHaveLength(0);
    expect(result.dressingRoomAllocationErrors).toHaveLength(1);
    expect(result.dressingRoomAllocationErrors[0].error).toMatch(/already allocated/);
    expect(result.ok).toBe(false);
  });

  it("uses a fallback error message when the rejection has no message", async () => {
    const plan = basePlan({ pitchHallAllocations: [resource("res-kr2")] });
    const deps = baseDeps({ addAllocation: vi.fn().mockRejectedValue("boom") });

    const result = await orchestrateTrainingSeriesCreation(plan, deps);

    expect(result.resourceAllocationErrors[0].error).toBe("Ressource konnte nicht zugewiesen werden.");
  });
});

describe("orchestrateTrainingSeriesCreation — series creation failure", () => {
  it("aborts the whole creation when the series itself cannot be created", async () => {
    const plan = basePlan({ pitchHallAllocations: [resource("res-kr2")] });
    const deps = baseDeps({
      createSeries: vi.fn().mockRejectedValue(new Error("title is required and must not be empty")),
    });

    await expect(orchestrateTrainingSeriesCreation(plan, deps)).rejects.toThrow("title is required");
    expect(deps.addAllocation).not.toHaveBeenCalled();
  });
});
