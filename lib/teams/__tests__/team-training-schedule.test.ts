import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTeamTrainingSchedule } from "../team-training-schedule";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/training/training-service", () => ({
  listTrainingSeries: vi.fn(),
}));

vi.mock("@/lib/training/training-allocation-service", () => ({
  listAllocationsByTrainingSeries: vi.fn(),
}));

const { prisma } = await import("@/lib/db/prisma");
const { listTrainingSeries } = await import("@/lib/training/training-service");
const { listAllocationsByTrainingSeries } = await import(
  "@/lib/training/training-allocation-service"
);

describe("TEAM-COCKPIT-01D — getTeamTrainingSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue({
      displayName: "E1",
      team: { name: "FC Allschwil E1", shortName: null, alternativeName: null },
      externalMappings: [],
    } as never);
  });

  it("returns weekday schedules with canonical pitch and dressing room resources", async () => {
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
        facilityResourceId: "res-pitch",
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
      {
        id: "alloc-2",
        tenantId: "tenant-a",
        trainingSeriesId: "series-1",
        facilityResourceId: "res-room",
        facilityResourceName: "O4",
        facilityResourceCode: "O4",
        facilityResourceType: "DRESSING_ROOM",
        facilityId: "fac-1",
        facilityName: "Sportanlage",
        notes: null,
        displayOrder: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const schedule = await getTeamTrainingSchedule("tenant-a", "ts-1", {
      clubName: "FC Allschwil",
      teamDisplayName: "FC Allschwil E1",
    });

    expect(schedule).toHaveLength(2);
    expect(schedule[0]).toMatchObject({
      weekdayLabel: "Montag",
      startsAt: "17:00",
      endsAt: "18:30",
      clubName: "FC Allschwil",
      teamDisplayName: "FC Allschwil E1",
      seriesDisplayName: "E1 Training",
      locationLabel: "Kunstrasen 2",
      pitch: { id: "res-pitch", name: "Kunstrasen 2", displayName: "Kunstrasen 2" },
      dressingRoom: { id: "res-room", name: "O4", displayName: "O4" },
    });
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
    expect(schedule[0]?.pitch).toBeNull();
    expect(schedule[0]?.dressingRoom).toBeNull();
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
