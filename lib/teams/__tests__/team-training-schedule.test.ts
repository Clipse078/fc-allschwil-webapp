import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTeamTrainingSchedule } from "../team-training-schedule";

vi.mock("@/lib/training/training-service", () => ({
  listTrainingSeries: vi.fn(),
}));

vi.mock("@/lib/training/training-allocation-service", () => ({
  listAllocationsByTrainingSeries: vi.fn(),
}));

const { listTrainingSeries } = await import("@/lib/training/training-service");
const { listAllocationsByTrainingSeries } = await import(
  "@/lib/training/training-allocation-service"
);

describe("TEAM-COCKPIT-01D — getTeamTrainingSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns weekday schedules with pitch allocation labels for active series", async () => {
    vi.mocked(listTrainingSeries).mockResolvedValue([
      {
        id: "series-1",
        tenantId: "tenant-a",
        teamSeasonId: "ts-1",
        title: "E1 Training",
        description: null,
        status: "ACTIVE",
        startsAt: "17:00",
        endsAt: "18:30",
        timezone: "Europe/Zurich",
        weekdays: ["MONDAY", "WEDNESDAY"],
        weekdaySchedules: [
          { weekday: "MONDAY", startsAt: "17:00", endsAt: "18:30" },
          { weekday: "WEDNESDAY", startsAt: "15:45", endsAt: "17:15" },
        ],
        validFrom: null,
        validUntil: null,
        archivedAt: null,
        sessionCount: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        planningStage: "APPROVED",
        planningSubmittedAt: null,
        planningSubmittedById: null,
        planningValidatedAt: null,
        planningValidatedById: null,
        createdByUserId: null,
      },
    ]);

    vi.mocked(listAllocationsByTrainingSeries).mockResolvedValue([
      {
        id: "alloc-1",
        tenantId: "tenant-a",
        trainingSeriesId: "series-1",
        facilityResourceId: "res-1",
        facilityResourceName: "Kunstrasen 2",
        facilityResourceCode: "KR2",
        facilityResourceType: "FULL_PITCH",
        facilityId: "fac-1",
        facilityName: "Sportanlage",
        notes: null,
        displayOrder: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const schedule = await getTeamTrainingSchedule("tenant-a", "ts-1");

    expect(schedule).toHaveLength(2);
    expect(schedule[0]).toMatchObject({
      weekdayLabel: "Montag",
      startsAt: "17:00",
      endsAt: "18:30",
      locationLabel: "Kunstrasen 2",
    });
    expect(schedule[1]).toMatchObject({
      weekdayLabel: "Mittwoch",
      startsAt: "15:45",
      endsAt: "17:15",
      locationLabel: "Kunstrasen 2",
    });
    expect(schedule.every((entry) => entry.locationLabel !== "KR2")).toBe(true);
  });

  it("keeps a missing resource allocation gracefully nullable", async () => {
    vi.mocked(listTrainingSeries).mockResolvedValue([
      {
        id: "series-1",
        tenantId: "tenant-a",
        teamSeasonId: "ts-1",
        title: "E1 Training",
        description: null,
        status: "ACTIVE",
        startsAt: "17:00",
        endsAt: "18:30",
        timezone: "Europe/Zurich",
        weekdays: ["MONDAY"],
        weekdaySchedules: [{ weekday: "MONDAY", startsAt: "17:00", endsAt: "18:30" }],
        validFrom: null,
        validUntil: null,
        archivedAt: null,
        sessionCount: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        planningStage: "APPROVED",
        planningSubmittedAt: null,
        planningSubmittedById: null,
        planningValidatedAt: null,
        planningValidatedById: null,
        createdByUserId: null,
      },
    ]);
    vi.mocked(listAllocationsByTrainingSeries).mockResolvedValue([]);

    const schedule = await getTeamTrainingSchedule("tenant-a", "ts-1");

    expect(schedule[0]?.locationLabel).toBeNull();
  });

  it("returns an empty list when no active training series exist", async () => {
    vi.mocked(listTrainingSeries).mockResolvedValue([
      {
        id: "series-archived",
        tenantId: "tenant-a",
        teamSeasonId: "ts-1",
        title: "Old Training",
        description: null,
        status: "ARCHIVED",
        startsAt: "17:00",
        endsAt: "18:30",
        timezone: "Europe/Zurich",
        weekdays: ["MONDAY"],
        weekdaySchedules: [{ weekday: "MONDAY", startsAt: "17:00", endsAt: "18:30" }],
        validFrom: null,
        validUntil: null,
        archivedAt: "2026-01-02T00:00:00.000Z",
        sessionCount: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        planningStage: "APPROVED",
        planningSubmittedAt: null,
        planningSubmittedById: null,
        planningValidatedAt: null,
        planningValidatedById: null,
        createdByUserId: null,
      },
    ]);

    const schedule = await getTeamTrainingSchedule("tenant-a", "ts-1");
    expect(schedule).toEqual([]);
  });
});
