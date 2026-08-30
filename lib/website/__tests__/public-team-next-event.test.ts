import { describe, expect, it } from "vitest";
import { resolvePublicTeamNextEvent } from "../public-team-next-event";
import type {
  PublicTeamMatch,
  PublicWebsiteTournamentItem,
} from "../types";

const match = {
  id: "match-1",
  startAt: new Date("2026-09-05T12:00:00.000Z"),
} as PublicTeamMatch;

const tournament = {
  id: "tournament-1",
  startAt: new Date("2026-09-01T12:00:00.000Z"),
} as PublicWebsiteTournamentItem;

function resolve(
  showNextMatch: boolean,
  showNextTournament: boolean,
  nextMatch: PublicTeamMatch | null,
  nextTournament: PublicWebsiteTournamentItem | null,
) {
  return resolvePublicTeamNextEvent({
    publication: { showNextMatch, showNextTournament },
    nextMatch,
    nextTournament,
  });
}

describe("resolvePublicTeamNextEvent", () => {
  it("OFF/OFF + match+tournament => NOTHING", () => {
    expect(resolve(false, false, match, tournament)).toBeNull();
  });

  it("ON/OFF + match => MATCH", () => {
    expect(resolve(true, false, match, tournament)).toEqual({
      type: "MATCH",
      match,
    });
  });

  it("ON/OFF + no match => NOTHING", () => {
    expect(resolve(true, false, null, tournament)).toBeNull();
  });

  it("OFF/ON + tournament => TOURNAMENT", () => {
    expect(resolve(false, true, match, tournament)).toEqual({
      type: "TOURNAMENT",
      tournament,
    });
  });

  it("OFF/ON + no tournament => NOTHING", () => {
    expect(resolve(false, true, match, null)).toBeNull();
  });

  it("ON/ON + match+tournament => MATCH", () => {
    expect(resolve(true, true, match, tournament)).toEqual({
      type: "MATCH",
      match,
    });
  });

  it("ON/ON + match only => MATCH", () => {
    expect(resolve(true, true, match, null)).toEqual({
      type: "MATCH",
      match,
    });
  });

  it("ON/ON + no match+tournament => TOURNAMENT", () => {
    expect(resolve(true, true, null, tournament)).toEqual({
      type: "TOURNAMENT",
      tournament,
    });
  });

  it("ON/ON + neither => NOTHING", () => {
    expect(resolve(true, true, null, null)).toBeNull();
  });

  it("keeps match priority when the tournament occurs earlier", () => {
    const result = resolve(true, true, match, tournament);

    expect(tournament.startAt.getTime()).toBeLessThan(match.startAt.getTime());
    expect(result?.type).toBe("MATCH");
  });
});
