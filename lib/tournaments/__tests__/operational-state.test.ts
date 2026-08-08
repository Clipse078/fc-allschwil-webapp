import { describe, expect, it } from "vitest";
import {
  assessTournamentOperationalState,
  isTournamentCompletedOrInactive,
  isTournamentOperationallyOpen,
} from "../operational-state";
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
    visibility: {
      websiteVisible: true,
      infoboardVisible: false,
      homepageVisible: false,
      wochenplanVisible: false,
      teamPageVisible: false,
    },
    allocation: {
      pitchCode: null,
      homeDressingRoomCode: null,
      awayDressingRoomCode: null,
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
      team: null,
    });

    expect(assessTournamentOperationalState(tournament).status).toBe("NOT_APPLICABLE");
  });

  it("is NOT_APPLICABLE once CANCELLED", () => {
    const tournament = createTournament({ status: "CANCELLED" });
    expect(assessTournamentOperationalState(tournament).status).toBe("NOT_APPLICABLE");
  });

  it("is READY when organizer, location and team are all present", () => {
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

  it("is OPEN when team is missing", () => {
    const tournament = createTournament({ team: null });
    const result = assessTournamentOperationalState(tournament);
    expect(result.status).toBe("OPEN");
    expect(result.actions.map((a) => a.key)).toContain("team");
  });

  it("accumulates multiple missing actions", () => {
    const tournament = createTournament({ organizerName: null, location: null, team: null });
    const result = assessTournamentOperationalState(tournament);
    expect(result.actionCount).toBe(3);
  });
});

describe("isTournamentOperationallyOpen", () => {
  it("mirrors assessTournamentOperationalState().status === 'OPEN'", () => {
    expect(isTournamentOperationallyOpen(createTournament({ organizerName: null }))).toBe(true);
    expect(isTournamentOperationallyOpen(createTournament())).toBe(false);
  });
});
