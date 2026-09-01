import { describe, expect, it } from "vitest";
import { derivePlanningCategoryOptions } from "../resource-categories";
import {
  buildPlanningGridViewModel,
  buildResourceLanes,
  deriveAdaptiveDensity,
} from "../projection";
import {
  makeSeriesAllocation,
  makeSession,
  makeSessionOverride,
  manyResourceFacility,
  multiFacilityFixtures,
  singleResourceFacility,
} from "./fixtures";

describe("buildResourceLanes", () => {
  it("groups resources by facility for multi-facility tenants", () => {
    const { resourceGroups, lanes } = buildResourceLanes(multiFacilityFixtures, "PITCH_HALL", {
      facilityId: null,
      teamSeasonId: null,
      conflictsOnly: false,
      unallocatedOnly: false,
    });
    expect(resourceGroups).toHaveLength(2);
    expect(lanes).toHaveLength(3);
  });

  it("filters by facility when requested", () => {
    const { lanes } = buildResourceLanes(multiFacilityFixtures, "PITCH_HALL", {
      facilityId: "facility-south",
      teamSeasonId: null,
      conflictsOnly: false,
      unallocatedOnly: false,
    });
    expect(lanes).toHaveLength(1);
    expect(lanes[0].resourceName).toBe("Hall A");
  });

  it("supports non-football resource names in OTHER category", () => {
    const { lanes } = buildResourceLanes(singleResourceFacility, "OTHER", {
      facilityId: null,
      teamSeasonId: null,
      conflictsOnly: false,
      unallocatedOnly: false,
    });
    expect(lanes).toHaveLength(1);
    expect(lanes[0].resourceName).toBe("Room 1");
  });
});

describe("deriveAdaptiveDensity", () => {
  it("scales density with resource count", () => {
    expect(deriveAdaptiveDensity(3)).toBe("comfortable");
    expect(deriveAdaptiveDensity(10)).toBe("normal");
    expect(deriveAdaptiveDensity(35)).toBe("compact");
  });
});

describe("buildPlanningGridViewModel", () => {
  it("maps activities to correct resource lanes", () => {
    const session = makeSession();
    const model = buildPlanningGridViewModel({
      date: "2026-09-02",
      period: "DAY",
      category: "PITCH_HALL",
      facilities: multiFacilityFixtures,
      sessions: [session],
      allocations: {
        seriesAllocationsBySeries: new Map([
          ["series-1", [makeSeriesAllocation({ facilityResourceId: "resource-a" })]],
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

    expect(model.blocks).toHaveLength(1);
    expect(model.blocks[0].resourceId).toBe("resource-a");
  });

  it("uses occurrence override instead of series default", () => {
    const session = makeSession();
    const model = buildPlanningGridViewModel({
      date: "2026-09-02",
      period: "DAY",
      category: "PITCH_HALL",
      facilities: multiFacilityFixtures,
      sessions: [session],
      allocations: {
        seriesAllocationsBySeries: new Map([
          ["series-1", [makeSeriesAllocation({ facilityResourceId: "resource-a" })]],
        ]),
        sessionOverridesBySession: new Map([
          ["session-1", [makeSessionOverride({ facilityResourceId: "resource-b" })]],
        ]),
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

    expect(model.blocks[0].resourceId).toBe("resource-b");
  });

  it("classifies missing pitch allocation as unplanned", () => {
    const model = buildPlanningGridViewModel({
      date: "2026-09-02",
      period: "DAY",
      category: "PITCH_HALL",
      facilities: multiFacilityFixtures,
      sessions: [makeSession()],
      allocations: {
        seriesAllocationsBySeries: new Map(),
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

    expect(model.unplannedBlocks).toHaveLength(1);
    expect(model.blocks).toHaveLength(0);
  });

  it("detects conflicts and supports conflict filtering", () => {
    const sessions = [
      makeSession({ id: "s1", teamName: "Team A" }),
      makeSession({
        id: "s2",
        teamName: "Team B",
        trainingSeriesId: "series-2",
        startAt: "2026-09-02T15:30:00.000Z",
        endAt: "2026-09-02T16:30:00.000Z",
      }),
    ];

    const baseInput = {
      date: "2026-09-02",
      period: "DAY" as const,
      category: "PITCH_HALL" as const,
      facilities: multiFacilityFixtures,
      sessions,
      allocations: {
        seriesAllocationsBySeries: new Map([
          ["series-1", [makeSeriesAllocation({ facilityResourceId: "resource-a" })]],
          [
            "series-2",
            [makeSeriesAllocation({ trainingSeriesId: "series-2", facilityResourceId: "resource-a" })],
          ],
        ]),
        sessionOverridesBySession: new Map(),
      },
      categories: derivePlanningCategoryOptions(multiFacilityFixtures),
      teams: [
        { id: "team-a", name: "Team A" },
        { id: "team-b", name: "Team B" },
      ],
    };

    const full = buildPlanningGridViewModel({
      ...baseInput,
      filters: {
        facilityId: null,
        teamSeasonId: null,
        conflictsOnly: false,
        unallocatedOnly: false,
      },
    });
    expect(full.conflictCount).toBe(1);

    const filtered = buildPlanningGridViewModel({
      ...baseInput,
      filters: {
        facilityId: null,
        teamSeasonId: null,
        conflictsOnly: true,
        unallocatedOnly: false,
      },
    });
    expect(filtered.blocks.every((block) => block.hasConflict)).toBe(true);
  });

  it("handles single-resource tenant without unnecessary facility filter", () => {
    const model = buildPlanningGridViewModel({
      date: "2026-09-02",
      period: "DAY",
      category: "OTHER",
      facilities: singleResourceFacility,
      sessions: [makeSession()],
      allocations: {
        seriesAllocationsBySeries: new Map([
          [
            "series-1",
            [
              makeSeriesAllocation({
                facilityResourceId: "resource-only",
                facilityResourceType: "OTHER",
                facilityResourceName: "Room 1",
              }),
            ],
          ],
        ]),
        sessionOverridesBySession: new Map(),
      },
      filters: {
        facilityId: null,
        teamSeasonId: null,
        conflictsOnly: false,
        unallocatedOnly: false,
      },
      categories: derivePlanningCategoryOptions(singleResourceFacility),
      teams: [{ id: "team-a", name: "Team Alpha" }],
    });

    expect(model.showFacilityFilter).toBe(false);
    expect(model.lanes).toHaveLength(1);
    expect(model.density).toBe("comfortable");
  });

  it("supports 30+ resource tenants with compact density", () => {
    const facilities = manyResourceFacility(32);
    const model = buildPlanningGridViewModel({
      date: "2026-09-02",
      period: "DAY",
      category: "PITCH_HALL",
      facilities,
      sessions: [],
      allocations: {
        seriesAllocationsBySeries: new Map(),
        sessionOverridesBySession: new Map(),
      },
      filters: {
        facilityId: null,
        teamSeasonId: null,
        conflictsOnly: false,
        unallocatedOnly: false,
      },
      categories: derivePlanningCategoryOptions(facilities),
      teams: [],
    });

    expect(model.lanes).toHaveLength(32);
    expect(model.density).toBe("compact");
  });
});
