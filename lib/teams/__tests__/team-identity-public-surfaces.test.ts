/**
 * TEAM-DATA-INTEGRITY-01 — public surface team identity regression tests.
 *
 * Ensures stale TeamSeason.displayName cannot override canonical Team.name on
 * website / Wochenplan surfaces.
 */

import { describe, expect, it } from "vitest";
import { resolveTeamDisplayName } from "@/lib/publishing/presentation/display-name-resolver";
import { resolveLongTeamName } from "@/lib/teams/team-naming";
import {
  mapTrainingToPublicEvent,
  resolveTrainingTeamContext,
} from "@/lib/wochenplan/public-feed-mapper";
import type { WeekplannerTrainingItem } from "@/lib/weekplanner/types";

const STALE_SEASON_NAME = "FC Allschwil Junioren E4";
const CANONICAL_TEAM_NAME = "FC Allschwil Junioren E2";

const TEAM_ROW = {
  id: "team-e2",
  slug: "junioren-e2",
  name: CANONICAL_TEAM_NAME,
  shortName: "E2",
  alternativeName: "Junioren E2",
  infoboardDisplayName: null,
  infoboardTrainingDisplayName: null,
  infoboardMatchDisplayName: null,
  infoboardTournamentDisplayName: null,
} as const;

describe("canonical team identity — stale TeamSeason.displayName", () => {
  it("resolveLongTeamName prefers Team.name over stale TeamSeason.displayName", () => {
    expect(
      resolveLongTeamName({
        teamName: CANONICAL_TEAM_NAME,
        teamSeasonDisplayName: STALE_SEASON_NAME,
      }),
    ).toBe(CANONICAL_TEAM_NAME);
  });

  it("WEBSITE resolver prefers Team.name over stale TeamSeason.displayName", () => {
    expect(
      resolveTeamDisplayName(
        {
          name: CANONICAL_TEAM_NAME,
          displayName: STALE_SEASON_NAME,
          shortName: "E4",
        },
        "WEBSITE",
      ),
    ).toBe(CANONICAL_TEAM_NAME);
  });

  it("Wochenplan training team context uses canonical Team.name", () => {
    const context = resolveTrainingTeamContext({
      id: "session-1",
      status: "SCHEDULED",
      teamSeason: {
        displayName: STALE_SEASON_NAME,
        season: { key: "2026-27" },
        team: TEAM_ROW,
      },
    });

    expect(context.primaryTeam?.teamName).toBe(CANONICAL_TEAM_NAME);
    expect(context.primaryTeam?.teamName).not.toBe(STALE_SEASON_NAME);
  });

  it("public Wochenplan training event.team.name uses canonical Team.name", () => {
    const policy = {
      id: "session-1",
      status: "SCHEDULED",
      teamSeason: {
        displayName: STALE_SEASON_NAME,
        season: { key: "2026-27" },
        team: TEAM_ROW,
      },
    };

    const item: WeekplannerTrainingItem = {
      kind: "TRAINING",
      trainingSessionId: "session-1",
      title: "Junioren E2 Training",
      startAt: new Date("2026-08-27T16:00:00.000Z"),
      endAt: new Date("2026-08-27T17:30:00.000Z"),
      teamNames: [STALE_SEASON_NAME],
      pitchAllocations: [],
      dressingRoomAllocations: [],
    };

    const event = mapTrainingToPublicEvent(
      item,
      policy,
      resolveTrainingTeamContext(policy),
    );

    expect(event.team?.name).toBe(CANONICAL_TEAM_NAME);
    expect(event.title).toBe("Junioren E2 Training");
  });
});
