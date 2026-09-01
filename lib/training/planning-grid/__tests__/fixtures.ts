import type { TrainingAllocationDto, TrainingSessionAllocationDto, TrainingSessionDto } from "@/lib/training/types";
import type { FacilityLike } from "@/lib/training/planning-grid/resource-categories";

export function makeSession(overrides: Partial<TrainingSessionDto> = {}): TrainingSessionDto {
  return {
    id: "session-1",
    tenantId: "tenant-1",
    trainingSeriesId: "series-1",
    trainingSeriesTitle: "Training Alpha",
    teamSeasonId: "team-a",
    teamName: "Team Alpha",
    date: "2026-09-02",
    weekday: "WEDNESDAY",
    startAt: "2026-09-02T15:15:00.000Z",
    endAt: "2026-09-02T16:45:00.000Z",
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    originalDate: "2026-09-02",
    originalStartAt: "2026-09-02T15:15:00.000Z",
    originalEndAt: "2026-09-02T16:45:00.000Z",
    isRescheduled: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeSeriesAllocation(overrides: Partial<TrainingAllocationDto> = {}): TrainingAllocationDto {
  return {
    id: "alloc-series-1",
    tenantId: "tenant-1",
    trainingSeriesId: "series-1",
    facilityResourceId: "resource-a",
    facilityResourceName: "Court 1 A",
    facilityResourceCode: "C1A",
    facilityResourceType: "FULL_PITCH",
    facilityId: "facility-north",
    facilityName: "Facility North",
    notes: null,
    displayOrder: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeSessionOverride(overrides: Partial<TrainingSessionAllocationDto> = {}): TrainingSessionAllocationDto {
  return {
    id: "alloc-session-1",
    tenantId: "tenant-1",
    trainingSessionId: "session-1",
    facilityResourceId: "resource-b",
    facilityResourceName: "Court 1 B",
    facilityResourceCode: "C1B",
    facilityResourceType: "HALF_PITCH",
    facilityId: "facility-north",
    facilityName: "Facility North",
    notes: null,
    displayOrder: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

export const multiFacilityFixtures: FacilityLike[] = [
  {
    id: "facility-north",
    name: "Facility North",
    resources: [
      { id: "resource-a", name: "Court 1 A", code: "C1A", type: "FULL_PITCH", sortOrder: 0 },
      { id: "resource-b", name: "Court 1 B", code: "C1B", type: "HALF_PITCH", sortOrder: 1 },
    ],
  },
  {
    id: "facility-south",
    name: "Facility South",
    resources: [{ id: "resource-c", name: "Hall A", code: "HA", type: "FULL_PITCH", sortOrder: 0 }],
  },
];

export const singleResourceFacility: FacilityLike[] = [
  {
    id: "facility-single",
    name: "Single Facility",
    resources: [{ id: "resource-only", name: "Room 1", code: "R1", type: "OTHER", sortOrder: 0 }],
  },
];

export function manyResourceFacility(count: number): FacilityLike[] {
  return [
    {
      id: "facility-large",
      name: "Large Facility",
      resources: Array.from({ length: count }, (_, index) => ({
        id: `resource-${index}`,
        name: `Resource ${index + 1}`,
        code: `R${index + 1}`,
        type: "FULL_PITCH" as const,
        sortOrder: index,
      })),
    },
  ];
}
