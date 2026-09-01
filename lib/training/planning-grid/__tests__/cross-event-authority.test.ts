/**
 * lib/training/planning-grid/__tests__/cross-event-authority.test.ts
 *
 * Documents which canonical conflict sources the planning-grid reassignment
 * path respects via lib/facilities/availability-service.ts.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const reassignmentSource = readFileSync(
  resolve(__dirname, "../reassignment-service.ts"),
  "utf8",
);

const availabilitySource = readFileSync(
  resolve(__dirname, "../../../facilities/availability-service.ts"),
  "utf8",
);

describe("cross-event conflict authority", () => {
  it("reassignment uses getResourceAvailability for pitch/hall and dressing room", () => {
    expect(reassignmentSource).toContain("getResourceAvailability");
    expect(reassignmentSource).toContain('category === "PITCH_HALL"');
    expect(reassignmentSource).toContain('category === "DRESSING_ROOM"');
  });

  it("canonical availability-service covers training, match and tournament bookings", () => {
    expect(availabilitySource).toContain("findTrainingConflicts");
    expect(availabilitySource).toContain("findMatchConflicts");
    expect(availabilitySource).toContain("findTournamentConflicts");
    expect(availabilitySource).toContain('"TRAINING"');
    expect(availabilitySource).toContain('"MATCH"');
    expect(availabilitySource).toContain('"TOURNAMENT"');
  });

  it("documents OTHER-category limitation: training-only overlap, no match/tournament guard", () => {
    expect(reassignmentSource).toContain("training-only overlap guard");
    expect(reassignmentSource).not.toContain("findMatchConflicts");
  });
});
