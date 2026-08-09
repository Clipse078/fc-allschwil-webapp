/**
 * lib/facilities/__tests__/availability-service.test.ts
 *
 * PLANNING-CREATION-UX-01A — focused tests for the provider-neutral live
 * resource availability aggregator. Covers:
 *   - free resource
 *   - occupied by training (incl. occurrence override)
 *   - occupied by match
 *   - occupied by tournament (Spielfeld/Halle)
 *   - tournament participant dressing-room occupancy
 *   - tenant isolation
 *   - archived resource excluded
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  facilityResourceFindMany: vi.fn(),
  trainingSessionFindMany: vi.fn(),
  eventFindMany: vi.fn(),
  tournamentResourceAllocationFindMany: vi.fn(),
  tournamentParticipantAllocationFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    facilityResource: { findMany: mocks.facilityResourceFindMany },
    trainingSession: { findMany: mocks.trainingSessionFindMany },
    event: { findMany: mocks.eventFindMany },
    tournamentResourceAllocation: { findMany: mocks.tournamentResourceAllocationFindMany },
    tournamentParticipantAllocation: { findMany: mocks.tournamentParticipantAllocationFindMany },
  },
}));

import { getResourceAvailability } from "../availability-service";

const TENANT_A = "tenant-a";

const PITCH_1 = { id: "res-1", name: "Kunstrasen 2", code: "KUNSTRASEN_2", facilityId: "fac-1", facility: { name: "Sportanlage" } };
const PITCH_2 = { id: "res-2", name: "Kunstrasen 3 A", code: "KUNSTRASEN_3_A", facilityId: "fac-1", facility: { name: "Sportanlage" } };
const PITCH_3 = { id: "res-3", name: "Hauptplatz", code: "STADION", facilityId: "fac-1", facility: { name: "Sportanlage" } };
const ROOM_1 = { id: "room-1", name: "Garderobe E1", code: "E1", facilityId: "fac-2", facility: { name: "Garderobentrakt" } };

const START = "2026-08-10T16:00:00.000Z";
const END = "2026-08-10T18:00:00.000Z";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.trainingSessionFindMany.mockResolvedValue([]);
  mocks.eventFindMany.mockResolvedValue([]);
  mocks.tournamentResourceAllocationFindMany.mockResolvedValue([]);
  mocks.tournamentParticipantAllocationFindMany.mockResolvedValue([]);
});

describe("getResourceAvailability — free resource", () => {
  it("marks a resource with no bookings as FREE", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([PITCH_1]);

    const result = await getResourceAvailability({
      tenantId: TENANT_A,
      startAt: START,
      endAt: END,
      group: "PITCH_HALL",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ resourceId: "res-1", status: "FREE", conflictLabel: null });
  });
});

describe("getResourceAvailability — occupied by training", () => {
  it("marks a resource OCCUPIED via the series-level default allocation", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([PITCH_1, PITCH_2]);
    mocks.trainingSessionFindMany.mockResolvedValue([
      {
        id: "session-1",
        startAt: new Date("2026-08-10T17:00:00.000Z"),
        endAt: new Date("2026-08-10T18:00:00.000Z"),
        overrideStartAt: null,
        overrideEndAt: null,
        trainingSeries: {
          title: "E2",
          allocations: [{ facilityResourceId: "res-2", facilityResource: { type: "HALF_PITCH" } }],
        },
        sessionAllocations: [],
      },
    ]);

    const result = await getResourceAvailability({
      tenantId: TENANT_A,
      startAt: START,
      endAt: END,
      group: "PITCH_HALL",
    });

    const free = result.find((r) => r.resourceId === "res-1");
    const occupied = result.find((r) => r.resourceId === "res-2");
    expect(free?.status).toBe("FREE");
    expect(occupied?.status).toBe("OCCUPIED");
    expect(occupied?.conflictSourceType).toBe("TRAINING");
    expect(occupied?.conflictLabel).toContain("E2");
  });

  it("honors an occurrence-level override, ignoring the series default for that occurrence", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([PITCH_1, PITCH_2]);
    mocks.trainingSessionFindMany.mockResolvedValue([
      {
        id: "session-1",
        startAt: new Date("2026-08-10T17:00:00.000Z"),
        endAt: new Date("2026-08-10T18:00:00.000Z"),
        overrideStartAt: null,
        overrideEndAt: null,
        trainingSeries: {
          title: "E2",
          // Series default points at res-2, but this occurrence overrides to res-1.
          allocations: [{ facilityResourceId: "res-2", facilityResource: { type: "HALF_PITCH" } }],
        },
        sessionAllocations: [{ facilityResourceId: "res-1", facilityResource: { type: "FULL_PITCH" } }],
      },
    ]);

    const result = await getResourceAvailability({
      tenantId: TENANT_A,
      startAt: START,
      endAt: END,
      group: "PITCH_HALL",
    });

    expect(result.find((r) => r.resourceId === "res-1")?.status).toBe("OCCUPIED");
    expect(result.find((r) => r.resourceId === "res-2")?.status).toBe("FREE");
  });
});

describe("getResourceAvailability — occupied by match", () => {
  it("marks a resource OCCUPIED via the legacy Match pitchCode field", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([PITCH_3]);
    mocks.eventFindMany.mockResolvedValue([
      {
        id: "event-1",
        title: "1. Mannschaft",
        opponentName: "FC Muttenz",
        startAt: new Date("2026-08-10T17:00:00.000Z"),
        endAt: new Date("2026-08-10T18:00:00.000Z"),
        pitchCode: "STADION",
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
      },
    ]);

    const result = await getResourceAvailability({
      tenantId: TENANT_A,
      startAt: START,
      endAt: END,
      group: "PITCH_HALL",
    });

    expect(result[0]).toMatchObject({ status: "OCCUPIED", conflictSourceType: "MATCH" });
    expect(result[0].conflictLabel).toContain("FC Muttenz");
  });

  it("does not flag a match that does not overlap the requested interval", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([PITCH_3]);
    mocks.eventFindMany.mockResolvedValue([
      {
        id: "event-1",
        title: "1. Mannschaft",
        opponentName: null,
        startAt: new Date("2026-08-11T17:00:00.000Z"),
        endAt: new Date("2026-08-11T18:00:00.000Z"),
        pitchCode: "STADION",
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
      },
    ]);

    const result = await getResourceAvailability({
      tenantId: TENANT_A,
      startAt: START,
      endAt: END,
      group: "PITCH_HALL",
    });

    expect(result[0].status).toBe("FREE");
  });
});

describe("getResourceAvailability — occupied by tournament", () => {
  it("marks a resource OCCUPIED via TournamentResourceAllocation", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([PITCH_1]);
    mocks.tournamentResourceAllocationFindMany.mockResolvedValue([
      {
        facilityResourceId: "res-1",
        event: {
          id: "tournament-1",
          title: "Hallenturnier",
          startAt: new Date("2026-08-10T17:00:00.000Z"),
          endAt: new Date("2026-08-10T18:00:00.000Z"),
        },
      },
    ]);

    const result = await getResourceAvailability({
      tenantId: TENANT_A,
      startAt: START,
      endAt: END,
      group: "PITCH_HALL",
    });

    expect(result[0]).toMatchObject({ status: "OCCUPIED", conflictSourceType: "TOURNAMENT" });
    expect(result[0].conflictLabel).toContain("Hallenturnier");
  });

  it("marks a Garderobe OCCUPIED via a participant's TournamentParticipantAllocation", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([ROOM_1]);
    mocks.tournamentParticipantAllocationFindMany.mockResolvedValue([
      {
        facilityResourceId: "room-1",
        tournamentParticipant: {
          team: { name: "FC Basel E1" },
          externalTeam: null,
          manualLabel: null,
          event: {
            id: "tournament-1",
            title: "Hallenturnier",
            startAt: new Date("2026-08-10T17:00:00.000Z"),
            endAt: new Date("2026-08-10T18:00:00.000Z"),
          },
        },
      },
    ]);

    const result = await getResourceAvailability({
      tenantId: TENANT_A,
      startAt: START,
      endAt: END,
      group: "DRESSING_ROOM",
    });

    expect(result[0]).toMatchObject({ status: "OCCUPIED", conflictSourceType: "TOURNAMENT" });
    expect(result[0].conflictLabel).toContain("FC Basel E1");
  });
});

describe("getResourceAvailability — tenant isolation", () => {
  it("scopes the FacilityResource query by tenantId", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([]);

    await getResourceAvailability({ tenantId: TENANT_A, startAt: START, endAt: END, group: "PITCH_HALL" });

    expect(mocks.facilityResourceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }),
    );
  });

  it("scopes training, match, and tournament conflict lookups by tenantId", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([PITCH_1]);

    await getResourceAvailability({ tenantId: TENANT_A, startAt: START, endAt: END, group: "PITCH_HALL" });

    expect(mocks.trainingSessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }),
    );
    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }),
    );
    expect(mocks.tournamentResourceAllocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }),
    );
  });

  it("returns nothing when the tenant has zero facility resources of the group", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([]);

    const result = await getResourceAvailability({ tenantId: "tenant-b", startAt: START, endAt: END, group: "PITCH_HALL" });

    expect(result).toEqual([]);
    expect(mocks.trainingSessionFindMany).not.toHaveBeenCalled();
  });
});

describe("getResourceAvailability — archived resource excluded", () => {
  it("filters archived resources and archived-facility resources at the query level", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([PITCH_1]);

    await getResourceAvailability({ tenantId: TENANT_A, startAt: START, endAt: END, group: "PITCH_HALL" });

    expect(mocks.facilityResourceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: "ARCHIVED" },
          facility: { status: { not: "ARCHIVED" } },
        }),
      }),
    );
  });
});
