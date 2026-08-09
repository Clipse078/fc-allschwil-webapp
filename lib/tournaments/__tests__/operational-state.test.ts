import { describe, expect, it } from "vitest";
import {
  assessTournamentOperationalState,
  isTournamentCompletedOrInactive,
  isTournamentOperationallyOpen,
} from "../operational-state";
import type { TournamentDto, TournamentParticipantDto } from "../types";

function createParticipant(overrides: Partial<TournamentParticipantDto> = {}): TournamentParticipantDto {
  return {
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
    ...overrides,
  };
}

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
    homeAway: "HOME",
    participants: [createParticipant()],
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

describe("isTournamentCompletedOrInactive", () => {
  it("is true for COMPLETED, CANCELLED and ARCHIVED", () => {
    expect(isTournamentCompletedOrInactive(createTournament({ status: "COMPLETED" }))).toBe(true);
    expect(isTournamentCompletedOrInactive(createTournament({ status: "CANCELLED" }))).toBe(true);
    expect(isTournamentCompletedOrInactive(createTournament({ status: "ARCHIVED" }))).toBe(true);
  });

  it("is false for SCHEDULED, LIVE, POSTPONED, DRAFT", () => {
    expect(isTournamentCompletedOrInactive(createTournament({ status: "SCHEDULED" }))).toBe(false);
    expect(isTournamentCompletedOrInactive(createTournament({ status: "LIVE" }))).toBe(false);
    expect(isTournamentCompletedOrInactive(createTournament({ status: "POSTPONED" }))).toBe(false);
    expect(isTournamentCompletedOrInactive(createTournament({ status: "DRAFT" }))).toBe(false);
  });
});

describe("assessTournamentOperationalState", () => {
  it("is NOT_APPLICABLE once COMPLETED, even with missing fields", () => {
    const tournament = createTournament({
      status: "COMPLETED",
      organizerName: null,
      location: null,
      participants: [],
      resourceAllocations: [],
    });

    expect(assessTournamentOperationalState(tournament).status).toBe("NOT_APPLICABLE");
  });

  it("is NOT_APPLICABLE once CANCELLED", () => {
    const tournament = createTournament({ status: "CANCELLED" });
    expect(assessTournamentOperationalState(tournament).status).toBe("NOT_APPLICABLE");
  });

  it("is READY when organizer, location, participants and HOME allocations are all present", () => {
    const tournament = createTournament();
    const result = assessTournamentOperationalState(tournament);
    expect(result.status).toBe("READY");
    expect(result.actions).toEqual([]);
  });

  it("is OPEN when organizer is missing", () => {
    const tournament = createTournament({ organizerName: null });
    const result = assessTournamentOperationalState(tournament);
    expect(result.status).toBe("OPEN");
    expect(result.actions.map((a) => a.key)).toContain("organizer");
  });

  it("is OPEN when location is missing", () => {
    const tournament = createTournament({ location: null });
    const result = assessTournamentOperationalState(tournament);
    expect(result.status).toBe("OPEN");
    expect(result.actions.map((a) => a.key)).toContain("location");
  });

  it("is OPEN when there are no participants (multi-team requirement)", () => {
    const tournament = createTournament({ participants: [] });
    const result = assessTournamentOperationalState(tournament);
    expect(result.status).toBe("OPEN");
    expect(result.actions.map((a) => a.key)).toContain("participants");
  });

  // ── TOURNAMENTCENTER-01B — HOME/AWAY facility allocation gating ───────────

  it("is OPEN for a HOME tournament with no pitch/hall allocation", () => {
    const tournament = createTournament({ resourceAllocations: [] });
    const result = assessTournamentOperationalState(tournament);
    expect(result.status).toBe("OPEN");
    expect(result.actions.map((a) => a.key)).toContain("pitch-hall");
  });

  it("is OPEN for a HOME tournament when a participant is missing a dressing room", () => {
    const tournament = createTournament({
      participants: [createParticipant({ dressingRoomAllocations: [] })],
    });
    const result = assessTournamentOperationalState(tournament);
    expect(result.status).toBe("OPEN");
    expect(result.actions.map((a) => a.key)).toContain("dressing-room");
  });

  it("is READY for a HOME tournament when every participant has at least one dressing room, even if they differ", () => {
    const tournament = createTournament({
      participants: [
        createParticipant({
          id: "participant-1",
          dressingRoomAllocations: [
            {
              id: "alloc-1",
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
        }),
        createParticipant({
          id: "participant-2",
          displayName: "BSC Old Boys E1",
          team: null,
          externalTeam: {
            id: "external-team-1",
            name: "BSC Old Boys E1",
            shortName: null,
            categoryLabel: "E1",
            club: { id: "club-1", name: "BSC Old Boys", shortName: null },
          },
          kind: "EXTERNAL_TEAM",
          dressingRoomAllocations: [
            {
              id: "alloc-2",
              facilityResourceId: "fr-e2",
              facilityResourceCode: "E2",
              facilityResourceName: "E2",
              facilityResourceType: "DRESSING_ROOM",
              facilityId: "facility-1",
              facilityName: "Garderoben",
              notes: null,
              displayOrder: 0,
            },
          ],
        }),
      ],
    });

    const result = assessTournamentOperationalState(tournament);
    expect(result.status).toBe("READY");
  });

  it("is READY for a HOME tournament when two participants share the same dressing room", () => {
    const sharedRoom = {
      id: "alloc-shared",
      facilityResourceId: "fr-e1",
      facilityResourceCode: "E1",
      facilityResourceName: "E1",
      facilityResourceType: "DRESSING_ROOM",
      facilityId: "facility-1",
      facilityName: "Garderoben",
      notes: null,
      displayOrder: 0,
    };
    const tournament = createTournament({
      participants: [
        createParticipant({ id: "participant-1", dressingRoomAllocations: [sharedRoom] }),
        createParticipant({ id: "participant-2", dressingRoomAllocations: [{ ...sharedRoom, id: "alloc-shared-2" }] }),
      ],
    });

    const result = assessTournamentOperationalState(tournament);
    expect(result.status).toBe("READY");
  });

  it("is NOT_APPLICABLE for facility allocation on an AWAY tournament (no pitch/hall, no dressing room)", () => {
    const tournament = createTournament({
      homeAway: "AWAY",
      resourceAllocations: [],
      participants: [createParticipant({ dressingRoomAllocations: [] })],
    });

    const result = assessTournamentOperationalState(tournament);
    expect(result.status).toBe("READY");
    expect(result.actions.map((a) => a.key)).not.toContain("pitch-hall");
    expect(result.actions.map((a) => a.key)).not.toContain("dressing-room");
  });

  it("treats homeAway as HOME by default (unset behaves like MatchCenter)", () => {
    // TournamentDto.homeAway is always normalized to "HOME"|"AWAY" by the
    // service layer (see tournament-service.ts::normalizeHomeAway), so this
    // asserts the same default the normalizer applies.
    const tournament = createTournament({ resourceAllocations: [] });
    expect(assessTournamentOperationalState(tournament).actions.map((a) => a.key)).toContain("pitch-hall");
  });

  it("accumulates multiple missing actions", () => {
    const tournament = createTournament({
      organizerName: null,
      location: null,
      participants: [],
      resourceAllocations: [],
    });
    const result = assessTournamentOperationalState(tournament);
    // organizer, location, participants, pitch-hall — dressing-room is
    // suppressed because there are zero participants to be missing one.
    expect(result.actionCount).toBe(4);
  });
});

describe("isTournamentOperationallyOpen", () => {
  it("mirrors assessTournamentOperationalState().status === 'OPEN'", () => {
    expect(isTournamentOperationallyOpen(createTournament({ organizerName: null }))).toBe(true);
    expect(isTournamentOperationallyOpen(createTournament())).toBe(false);
  });
});
