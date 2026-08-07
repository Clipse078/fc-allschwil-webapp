import { describe, expect, it } from "vitest";
import {
  getMatchcenterLifecycleStage,
  getMatchcenterResultLabel,
  isMatchCancelledOrPostponed,
  isMatchCompleted,
  isMatchLive,
} from "../match-lifecycle";

describe("isMatchCompleted", () => {
  it("is true only for COMPLETED", () => {
    expect(isMatchCompleted({ status: "COMPLETED" })).toBe(true);
    expect(isMatchCompleted({ status: "SCHEDULED" })).toBe(false);
    expect(isMatchCompleted({ status: "LIVE" })).toBe(false);
    expect(isMatchCompleted({ status: "POSTPONED" })).toBe(false);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(isMatchCompleted({ status: " completed " })).toBe(true);
  });
});

describe("isMatchCancelledOrPostponed", () => {
  it("recognises both CANCELED and CANCELLED spellings", () => {
    expect(isMatchCancelledOrPostponed({ status: "CANCELED" })).toBe(true);
    expect(isMatchCancelledOrPostponed({ status: "CANCELLED" })).toBe(true);
  });

  it("recognises POSTPONED", () => {
    expect(isMatchCancelledOrPostponed({ status: "POSTPONED" })).toBe(true);
  });

  it("is false for SCHEDULED/LIVE/COMPLETED", () => {
    expect(isMatchCancelledOrPostponed({ status: "SCHEDULED" })).toBe(false);
    expect(isMatchCancelledOrPostponed({ status: "LIVE" })).toBe(false);
    expect(isMatchCancelledOrPostponed({ status: "COMPLETED" })).toBe(false);
  });
});

describe("isMatchLive", () => {
  it("is true only for LIVE", () => {
    expect(isMatchLive({ status: "LIVE" })).toBe(true);
    expect(isMatchLive({ status: "SCHEDULED" })).toBe(false);
  });
});

describe("getMatchcenterLifecycleStage", () => {
  it("classifies COMPLETED as COMPLETED", () => {
    expect(getMatchcenterLifecycleStage({ status: "COMPLETED" })).toBe(
      "COMPLETED",
    );
  });

  it("classifies everything else as UPCOMING", () => {
    for (const status of ["SCHEDULED", "LIVE", "POSTPONED", "CANCELED", "DRAFT", "ARCHIVED"]) {
      expect(getMatchcenterLifecycleStage({ status })).toBe("UPCOMING");
    }
  });
});

describe("getMatchcenterResultLabel — MATCHCENTER-UX-01 §12 hard rules", () => {
  it("A. SCHEDULED / future match never renders a score, even when raw scores are 0/0 (SFV default)", () => {
    expect(
      getMatchcenterResultLabel({
        status: "SCHEDULED",
        scoreHome: 0,
        scoreAway: 0,
        resultLabel: null,
      }),
    ).toBeNull();
  });

  it("B. COMPLETED match renders the actual result", () => {
    expect(
      getMatchcenterResultLabel({
        status: "COMPLETED",
        scoreHome: 3,
        scoreAway: 1,
        resultLabel: null,
      }),
    ).toBe("3:1");
  });

  it("C. legitimate completed 0:0 remains visible and distinguishable from 'not played'", () => {
    expect(
      getMatchcenterResultLabel({
        status: "COMPLETED",
        scoreHome: 0,
        scoreAway: 0,
        resultLabel: null,
      }),
    ).toBe("0:0");
  });

  it("falls back to resultLabel when mapped scores are absent for a COMPLETED match", () => {
    expect(
      getMatchcenterResultLabel({
        status: "COMPLETED",
        scoreHome: null,
        scoreAway: null,
        resultLabel: "2:2",
      }),
    ).toBe("2:2");
  });

  it("POSTPONED never renders 0:0 even if raw scores are 0/0", () => {
    expect(
      getMatchcenterResultLabel({
        status: "POSTPONED",
        scoreHome: 0,
        scoreAway: 0,
        resultLabel: null,
      }),
    ).toBeNull();
  });

  it("CANCELED never renders 0:0 even if raw scores are 0/0", () => {
    expect(
      getMatchcenterResultLabel({
        status: "CANCELED",
        scoreHome: 0,
        scoreAway: 0,
        resultLabel: null,
      }),
    ).toBeNull();
  });

  it("LIVE renders the current score when the provider supplies one", () => {
    expect(
      getMatchcenterResultLabel({
        status: "LIVE",
        scoreHome: 1,
        scoreAway: 0,
        resultLabel: null,
      }),
    ).toBe("1:0");
  });
});
