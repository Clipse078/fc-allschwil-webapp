/**
 * TEAM-COCKPIT-02B — German attendance label tests
 */

import { describe, it, expect } from "vitest";
import {
  ATTENDANCE_EVENT_KIND_LABELS,
  ATTENDANCE_STATUS_LABELS,
  getAttendanceEventKindLabel,
  getAttendanceStatusLabel,
} from "../labels";

describe("TEAM-COCKPIT-02B — attendance labels", () => {
  it("maps all statuses to German labels", () => {
    expect(ATTENDANCE_STATUS_LABELS.OPEN).toBe("Offen");
    expect(ATTENDANCE_STATUS_LABELS.PRESENT).toBe("Anwesend");
    expect(ATTENDANCE_STATUS_LABELS.ABSENT).toBe("Abwesend");
    expect(ATTENDANCE_STATUS_LABELS.EXCUSED).toBe("Entschuldigt");
    expect(ATTENDANCE_STATUS_LABELS.INJURED).toBe("Verletzt");
    expect(getAttendanceStatusLabel("PRESENT")).toBe("Anwesend");
  });

  it("maps event kinds to German labels", () => {
    expect(ATTENDANCE_EVENT_KIND_LABELS.TRAINING).toBe("Training");
    expect(ATTENDANCE_EVENT_KIND_LABELS.MATCH).toBe("Spiel");
    expect(ATTENDANCE_EVENT_KIND_LABELS.TOURNAMENT).toBe("Turnier");
    expect(getAttendanceEventKindLabel("MATCH")).toBe("Spiel");
  });
});
