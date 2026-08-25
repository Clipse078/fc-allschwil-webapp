/**
 * TEAM-COCKPIT-03A — participation handoff tests
 */

import { describe, it, expect } from "vitest";
import {
  canPrefillAttendanceFromParticipation,
  suggestAttendanceStatusFromParticipation,
} from "../handoff";

describe("TEAM-COCKPIT-03A — participation → attendance handoff", () => {
  it("suggests PRESENT from YES but does not auto-write", () => {
    expect(suggestAttendanceStatusFromParticipation("YES")).toBe("PRESENT");
    expect(suggestAttendanceStatusFromParticipation("NO")).toBe("ABSENT");
    expect(suggestAttendanceStatusFromParticipation("MAYBE")).toBeNull();
    expect(suggestAttendanceStatusFromParticipation("OPEN")).toBeNull();
  });

  it("only allows prefill for definitive responses", () => {
    expect(canPrefillAttendanceFromParticipation("YES")).toBe(true);
    expect(canPrefillAttendanceFromParticipation("NO")).toBe(true);
    expect(canPrefillAttendanceFromParticipation("MAYBE")).toBe(false);
    expect(canPrefillAttendanceFromParticipation("OPEN")).toBe(false);
  });
});
