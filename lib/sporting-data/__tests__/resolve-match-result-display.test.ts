/**
 * lib/sporting-data/__tests__/resolve-match-result-display.test.ts
 */

import { describe, expect, it } from "vitest";
import { resolveMatchResultDisplay } from "../resolve-match-result-display";

describe("resolveMatchResultDisplay", () => {
  it("returns null for scheduled matches even with 0:0 scores", () => {
    expect(
      resolveMatchResultDisplay({
        status: "SCHEDULED",
        scoreHome: 0,
        scoreAway: 0,
        resultLabel: null,
      }),
    ).toBeNull();
  });

  it("prefers explicit resultLabel over numeric scores", () => {
    expect(
      resolveMatchResultDisplay({
        status: "COMPLETED",
        resultLabel: "2:2",
        scoreHome: 3,
        scoreAway: 1,
      }),
    ).toBe("2:2");
  });

  it("falls back to numeric mapping scores when resultLabel is absent", () => {
    expect(
      resolveMatchResultDisplay({
        status: "COMPLETED",
        resultLabel: null,
        scoreHome: 3,
        scoreAway: 1,
      }),
    ).toBe("3:1");
  });

  it("returns null for unfinished scores on completed matches", () => {
    expect(
      resolveMatchResultDisplay({
        status: "COMPLETED",
        resultLabel: null,
        scoreHome: null,
        scoreAway: null,
      }),
    ).toBeNull();
  });

  it("allows live scores when provider supplies them", () => {
    expect(
      resolveMatchResultDisplay({
        status: "LIVE",
        scoreHome: 1,
        scoreAway: 0,
        resultLabel: null,
      }),
    ).toBe("1:0");
  });
});
