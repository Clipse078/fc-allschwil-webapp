/**
 * TEAM-COCKPIT-03A — participation statistics tests
 */

import { describe, it, expect } from "vitest";
import { buildParticipationSummary, countParticipationStatuses } from "../statistics";

describe("TEAM-COCKPIT-03A — participation statistics", () => {
  it("counts participation statuses", () => {
    expect(countParticipationStatuses(["YES", "YES", "NO", "MAYBE", "OPEN"])).toEqual({
      open: 1,
      yes: 2,
      no: 1,
      maybe: 1,
    });
  });

  it("builds participation summary with roster size", () => {
    expect(
      buildParticipationSummary(5, ["YES", "NO", "OPEN", "OPEN", "MAYBE"]),
    ).toEqual({
      totalPlayers: 5,
      counts: { open: 2, yes: 1, no: 1, maybe: 1 },
    });
  });
});
