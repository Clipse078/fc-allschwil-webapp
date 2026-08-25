import { describe, expect, it } from "vitest";
import { resolveSportingResultDisplay } from "../resolve-sporting-result-display";

describe("resolveSportingResultDisplay", () => {
  it("4. future 0:0 placeholder → no result", () => {
    expect(
      resolveSportingResultDisplay({
        lifecycle: "UPCOMING",
        scoreHome: 0,
        scoreAway: 0,
        resultLabel: null,
      }),
    ).toBeNull();
  });

  it("5. completed 0:0 → valid result", () => {
    expect(
      resolveSportingResultDisplay({
        lifecycle: "COMPLETED",
        scoreHome: 0,
        scoreAway: 0,
        resultLabel: null,
      }),
    ).toBe("0:0");
  });

  it("preserves resultLabel precedence over numeric scores", () => {
    expect(
      resolveSportingResultDisplay({
        lifecycle: "COMPLETED",
        resultLabel: "2:2",
        scoreHome: 1,
        scoreAway: 0,
      }),
    ).toBe("2:2");
  });

  it("falls back to numeric scores when resultLabel is absent", () => {
    expect(
      resolveSportingResultDisplay({
        lifecycle: "COMPLETED",
        resultLabel: null,
        scoreHome: 3,
        scoreAway: 1,
      }),
    ).toBe("3:1");
  });

  it("excludes cancelled/postponed matches from result display", () => {
    expect(
      resolveSportingResultDisplay({
        lifecycle: "CANCELLED",
        scoreHome: 1,
        scoreAway: 0,
        resultLabel: "1:0",
      }),
    ).toBeNull();

    expect(
      resolveSportingResultDisplay({
        lifecycle: "POSTPONED",
        scoreHome: 0,
        scoreAway: 0,
        resultLabel: null,
      }),
    ).toBeNull();
  });
});
