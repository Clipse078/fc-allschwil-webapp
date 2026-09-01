/**
 * lib/training/planning-grid/__tests__/premium-02-integration.test.ts
 *
 * TRAINING-CENTER-PREMIUM-03A — compile-time and architectural integration
 * checks against the accepted PREMIUM-02 TrainingCenter foundation.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPlanningGridViewModel } from "../projection";
import { derivePlanningCategoryOptions } from "../resource-categories";
import { makeSeriesAllocation, makeSession, multiFacilityFixtures } from "./fixtures";

const ROOT = resolve(__dirname, "../../../..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("PREMIUM-03 × PREMIUM-02 integration", () => {
  it("planning grid client does not duplicate VisualResourceAvailabilityPicker", () => {
    const source = readSource("components/admin/training/planning-grid/ResourcePlanningGridClient.tsx");
    expect(source).not.toContain("VisualResourceAvailabilityPicker");
    expect(source).not.toContain("VisualDressingRoomPicker");
    expect(source).toContain("resource-change-search");
  });

  it("reassignment service delegates availability to canonical availability-service", () => {
    const source = readSource("lib/training/planning-grid/reassignment-service.ts");
    expect(source).toContain("getResourceAvailability");
    expect(source).toContain("createTrainingSessionAllocation");
    expect(source).toContain("createTrainingAllocation");
  });

  it("training page keeps PREMIUM-02 Serien list and single CTA per tab", () => {
    const source = readSource("app/(admin)/dashboard/training/page.tsx");
    expect(source).toContain("TrainingSeriesListView");
    expect(source).toContain("Neue Trainingsserie");
    expect(source.match(/Neue Trainingsserie/g)?.length).toBe(3);
    expect(source).toContain('tab === "planungsraster"');
  });

  it("create page still wires TrainingSeriesCreateForm", () => {
    const source = readSource("app/(admin)/dashboard/training/new/page.tsx");
    expect(source).toContain("TrainingSeriesCreateForm");
  });

  it("create form still uses TeamSeasonSearchablePicker and visual pickers", () => {
    const source = readSource("components/admin/training/TrainingSeriesCreateForm.tsx");
    expect(source).toContain("TeamSeasonSearchablePicker");
    expect(source).toContain("VisualResourceAvailabilityPicker");
    expect(source).toContain("VisualDressingRoomPicker");
  });

  it("planning grid projection compiles against PREMIUM-02 allocation groups", () => {
    const model = buildPlanningGridViewModel({
      date: "2026-09-02",
      period: "DAY",
      category: "PITCH_HALL",
      facilities: multiFacilityFixtures,
      sessions: [makeSession()],
      allocations: {
        seriesAllocationsBySeries: new Map([
          ["series-1", [makeSeriesAllocation()]],
        ]),
        sessionOverridesBySession: new Map(),
      },
      filters: {
        facilityId: null,
        teamSeasonId: null,
        conflictsOnly: false,
        unallocatedOnly: false,
      },
      categories: derivePlanningCategoryOptions(multiFacilityFixtures),
      teams: [{ id: "team-a", name: "Team Alpha" }],
    });

    expect(model.lanes.length).toBeGreaterThan(0);
    expect(model.blocks[0].resourceId).toBe("resource-a");
  });
});
