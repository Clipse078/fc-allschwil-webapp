import { describe, expect, it } from "vitest";
import {
  buildTournamentCenterViewModel,
  normalizeTournamentActionFilter,
  normalizeTournamentTab,
} from "../view-model";
import type { TournamentDto } from "../types";

function createTournament(overrides: Partial<TournamentDto> = {}): TournamentDto {
  return {
    id: "tournament-1",
    tenantId: "tenant-1",
    title: "E1 Hallenturnier",
    description: null,
    status: "SCHEDULED",
    source: "MANUAL",
    startAt: "2026-09-05T16:00:00.000Z",
    endAt: null,
    meetingTime: null,
    location: "Turnhalle Binningen",
    organizerName: "FC Aesch",
    competitionLabel: null,
    resultLabel: null,
    remarks: null,
    season: { id: "season-1", key: "2026-27", name: "2026/27" },
    team: {
      id: "team-1",
      name: "FC Allschwil E1",
      slug: "e1",
      category: "JUNIOR",
      genderGroup: null,
      ageGroup: "E",
    },
    // Fully READY by default (matches lib/tournaments/__tests__/operational-state.test.ts):
    // one participant with a dressing room, one Spielfeld/Halle allocation.
    homeAway: "HOME",
    participants: [
      {
        id: "participant-1",
        tournamentId: "tournament-1",
        kind: "TEAM",
        displayName: "FC Allschwil E1",
        team: {
          id: "team-1",
          name: "FC Allschwil E1",
          slug: "e1",
          category: "JUNIOR",
          genderGroup: null,
          ageGroup: "E",
        },
        externalTeam: null,
        manualLabel: null,
        displayOrder: 0,
        dressingRoomAllocations: [
          {
            id: "dressing-room-alloc-1",
            facilityResourceId: "fr-e1",
            facilityResourceCode: "E1",
            facilityResourceName: "E1",
            facilityResourceType: "DRESSING_ROOM",
            facilityId: "facility-1",
            facilityName: "Garderoben",
            notes: null,
            displayOrder: 0,
          },
        ],
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
    resourceAllocations: [
      {
        id: "resource-alloc-1",
        facilityResourceId: "fr-kr2",
        facilityResourceCode: "KUNSTRASEN_2",
        facilityResourceName: "Kunstrasen 2",
        facilityResourceType: "FULL_PITCH",
        facilityId: "facility-2",
        facilityName: "Sportanlage",
        notes: null,
        displayOrder: 0,
      },
    ],
    visibility: {
      websiteVisible: true,
      infoboardVisible: false,
      homepageVisible: false,
      wochenplanVisible: false,
      teamPageVisible: false,
    },
    reviewStage: "APPROVED",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeTournamentActionFilter", () => {
  it("defaults to ALLE for invalid/missing values", () => {
    expect(normalizeTournamentActionFilter(undefined)).toBe("ALLE");
    expect(normalizeTournamentActionFilter(null)).toBe("ALLE");
    expect(normalizeTournamentActionFilter("bogus")).toBe("ALLE");
  });

  it("accepts case-insensitive valid values", () => {
    expect(normalizeTournamentActionFilter("offen")).toBe("OFFEN");
    expect(normalizeTournamentActionFilter("ERLEDIGT")).toBe("ERLEDIGT");
  });
});

describe("normalizeTournamentTab", () => {
  it("defaults to ANSTEHEND", () => {
    expect(normalizeTournamentTab(undefined)).toBe("ANSTEHEND");
    expect(normalizeTournamentTab("bogus")).toBe("ANSTEHEND");
  });

  it("accepts ARCHIV case-insensitively", () => {
    expect(normalizeTournamentTab("archiv")).toBe("ARCHIV");
  });
});

describe("buildTournamentCenterViewModel", () => {
  it("partitions upcoming vs archived (COMPLETED/CANCELLED/ARCHIVED)", () => {
    const tournaments = [
      createTournament({ id: "t1", status: "SCHEDULED" }),
      createTournament({ id: "t2", status: "COMPLETED" }),
      createTournament({ id: "t3", status: "CANCELLED" }),
      createTournament({ id: "t4", status: "ARCHIVED" }),
    ];

    const vm = buildTournamentCenterViewModel(tournaments);

    expect(vm.anstehend.map((r) => r.tournament.id)).toEqual(["t1"]);
    expect(vm.archiv.map((t) => t.id).sort()).toEqual(["t2", "t3", "t4"]);
  });

  it("KPIs always reflect the full population regardless of actionFilter", () => {
    const tournaments = [
      createTournament({ id: "t1", status: "SCHEDULED", organizerName: null }),
      createTournament({ id: "t2", status: "SCHEDULED" }),
      createTournament({ id: "t3", status: "COMPLETED" }),
    ];

    const vmAlle = buildTournamentCenterViewModel(tournaments, { actionFilter: "ALLE" });
    const vmOffen = buildTournamentCenterViewModel(tournaments, { actionFilter: "OFFEN" });

    expect(vmAlle.kpis).toEqual({ anstehend: 2, offen: 1, bereit: 1, archiv: 1 });
    expect(vmOffen.kpis).toEqual(vmAlle.kpis);
  });

  it("applies the OFFEN action filter", () => {
    const tournaments = [
      createTournament({ id: "t1", status: "SCHEDULED", organizerName: null }),
      createTournament({ id: "t2", status: "SCHEDULED" }),
    ];

    const vm = buildTournamentCenterViewModel(tournaments, { actionFilter: "OFFEN" });
    expect(vm.anstehend.map((r) => r.tournament.id)).toEqual(["t1"]);
  });

  it("applies the ERLEDIGT action filter", () => {
    const tournaments = [
      createTournament({ id: "t1", status: "SCHEDULED", organizerName: null }),
      createTournament({ id: "t2", status: "SCHEDULED" }),
    ];

    const vm = buildTournamentCenterViewModel(tournaments, { actionFilter: "ERLEDIGT" });
    expect(vm.anstehend.map((r) => r.tournament.id)).toEqual(["t2"]);
  });

  it("sorts anstehend ascending by startAt", () => {
    const tournaments = [
      createTournament({ id: "later", startAt: "2026-10-01T10:00:00.000Z" }),
      createTournament({ id: "earlier", startAt: "2026-09-01T10:00:00.000Z" }),
    ];

    const vm = buildTournamentCenterViewModel(tournaments);
    expect(vm.anstehend.map((r) => r.tournament.id)).toEqual(["earlier", "later"]);
  });

  it("sorts archiv descending by startAt (most recent first)", () => {
    const tournaments = [
      createTournament({ id: "older", status: "COMPLETED", startAt: "2026-01-01T10:00:00.000Z" }),
      createTournament({ id: "newer", status: "COMPLETED", startAt: "2026-06-01T10:00:00.000Z" }),
    ];

    const vm = buildTournamentCenterViewModel(tournaments);
    expect(vm.archiv.map((t) => t.id)).toEqual(["newer", "older"]);
  });
});
