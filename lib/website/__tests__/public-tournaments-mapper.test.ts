/**
 * lib/website/__tests__/public-tournaments-mapper.test.ts
 *
 * TOURNAMENT-LOGOS-01A — public website tournament logo contract.
 */

import { describe, expect, it } from "vitest";
import { toPublicWebsiteTournament } from "../public-tournaments-mapper";
import type { TournamentDto } from "@/lib/tournaments/types";
import type { PublicEventItem } from "@/lib/events/public-event-feed";

function makePublicEvent(overrides: Partial<PublicEventItem> = {}): PublicEventItem {
  return {
    id: "evt-1",
    title: "Turnier",
    description: null,
    location: "Sportanlage",
    type: "TOURNAMENT",
    source: "MANUAL",
    status: "SCHEDULED",
    startAt: new Date("2026-09-20T08:00:00.000Z"),
    endAt: null,
    opponentName: null,
    organizerName: "FC Diegten-Eptingen",
    competitionLabel: null,
    homeAway: "AWAY",
    resultLabel: null,
    meetingTime: null,
    visibility: {
      website: true,
      infoboard: false,
      homepage: false,
      wochenplan: false,
      trainingsplan: false,
      teamPage: false,
    },
    remarks: null,
    pitchCode: null,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    season: null,
    team: {
      id: "team-f2",
      name: "FC Allschwil Junioren F2",
      slug: "f2",
      category: "JUNIOR",
      genderGroup: null,
      ageGroup: "F",
    },
    ...overrides,
  };
}

function makeTournamentDto(overrides: Partial<TournamentDto> = {}): TournamentDto {
  return {
    id: "evt-1",
    tenantId: "tenant-1",
    title: "Turnier",
    description: null,
    status: "SCHEDULED",
    source: "MANUAL",
    startAt: "2026-09-20T08:00:00.000Z",
    endAt: null,
    meetingTime: null,
    location: "Sportanlage",
    organizerName: "FC Diegten-Eptingen",
    organizerLogoUrl: "https://cdn.example.com/diegten.png",
    organizerExternalClubId: "club-diegten",
    competitionLabel: null,
    resultLabel: null,
    remarks: null,
    season: null,
    team: {
      id: "team-f2",
      name: "FC Allschwil Junioren F2",
      slug: "f2",
      category: "JUNIOR",
      genderGroup: null,
      ageGroup: "F",
    },
    teamLogoUrl: "https://cdn.example.com/fca.png",
    homeAway: "AWAY",
    participants: [
      {
        id: "participant-1",
        tournamentId: "evt-1",
        kind: "TEAM",
        displayName: "FC Allschwil Junioren F2",
        logoUrl: "https://cdn.example.com/fca.png",
        team: {
          id: "team-f2",
          name: "FC Allschwil Junioren F2",
          slug: "f2",
          category: "JUNIOR",
          genderGroup: null,
          ageGroup: "F",
        },
        externalTeam: null,
        externalClub: null,
        manualLabel: null,
        displayOrder: 0,
        dressingRoomAllocations: [],
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
    resourceAllocations: [],
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

describe("toPublicWebsiteTournament", () => {
  it("exposes canonical organizer and participant logos additively", () => {
    const result = toPublicWebsiteTournament(makePublicEvent(), makeTournamentDto());

    expect(result.organizerName).toBe("FC Diegten-Eptingen");
    expect(result.organizer).toEqual({
      displayName: "FC Diegten-Eptingen",
      logoUrl: "https://cdn.example.com/diegten.png",
      externalClubId: "club-diegten",
    });
    expect(result.participants).toEqual([
      {
        id: "participant-1",
        displayName: "FC Allschwil Junioren F2",
        logoUrl: "https://cdn.example.com/fca.png",
        kind: "TEAM",
        teamId: "team-f2",
        externalClubId: null,
      },
    ]);
    expect(result.team?.slug).toBe("f2");
  });

  it("keeps legacy fields when organizer is absent", () => {
    const result = toPublicWebsiteTournament(
      makePublicEvent({ organizerName: null }),
      makeTournamentDto({ organizerName: null, organizerLogoUrl: null, organizerExternalClubId: null }),
    );

    expect(result.organizerName).toBeNull();
    expect(result.organizer).toBeNull();
  });
});
