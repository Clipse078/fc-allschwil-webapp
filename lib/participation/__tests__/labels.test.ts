/**
 * TEAM-COCKPIT-03A — participation label tests
 */

import { describe, it, expect } from "vitest";
import {
  PARTICIPATION_STATUS_LABELS,
  PARTICIPATION_RESPONSE_SOURCE_LABELS,
  formatParticipationSummaryLine,
  getParticipationStatusLabel,
} from "../labels";

describe("TEAM-COCKPIT-03A — participation labels", () => {
  it("maps participation statuses to German labels", () => {
    expect(PARTICIPATION_STATUS_LABELS.OPEN).toBe("Offen");
    expect(PARTICIPATION_STATUS_LABELS.YES).toBe("Dabei");
    expect(PARTICIPATION_STATUS_LABELS.NO).toBe("Abwesend");
    expect(PARTICIPATION_STATUS_LABELS.MAYBE).toBe("Unsicher");
    expect(getParticipationStatusLabel("YES")).toBe("Dabei");
  });

  it("maps response sources to German labels", () => {
    expect(PARTICIPATION_RESPONSE_SOURCE_LABELS.PLAYER).toBe("Spieler");
    expect(PARTICIPATION_RESPONSE_SOURCE_LABELS.PARENT).toBe("Eltern");
    expect(PARTICIPATION_RESPONSE_SOURCE_LABELS.TRAINER).toBe("Trainer");
  });

  it("formats participation summary line", () => {
    expect(
      formatParticipationSummaryLine({
        totalPlayers: 14,
        counts: { yes: 10, no: 2, maybe: 1, open: 1 },
      }),
    ).toBe("14 Spieler · 10 dabei · 2 abwesend · 1 unsicher · 1 offen");
  });
});
