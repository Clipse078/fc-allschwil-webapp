/**
 * lib/training/__tests__/team-season-eligibility.test.ts
 *
 * TRAINING-SERIES-PREMIUM-01 — team selector eligibility regression tests.
 */

import { describe, expect, it } from "vitest";
import { trainingSeriesTeamSeasonEligibilityWhere } from "../team-season-eligibility";

describe("trainingSeriesTeamSeasonEligibilityWhere", () => {
  it("requires current season, active team, excludes archived TeamSeason — not TeamSeason.status ACTIVE", () => {
    expect(trainingSeriesTeamSeasonEligibilityWhere("tenant-a")).toEqual({
      NOT: { status: "ARCHIVED" },
      team: { tenantId: "tenant-a", isActive: true },
      season: { isActive: true },
    });
  });

  it("does not require competition participation or SFV mapping filters", () => {
    const where = trainingSeriesTeamSeasonEligibilityWhere("tenant-a");
    expect(where).not.toHaveProperty("competitions");
    expect(where).not.toHaveProperty("externalMappings");
    expect(where).not.toEqual(expect.objectContaining({ status: "ACTIVE" }));
  });
});
