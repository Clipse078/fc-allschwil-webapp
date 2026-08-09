/**
 * lib/matchcenter/__tests__/create-match-orchestration.test.ts
 *
 * PLANNING-CREATION-UX-01C — focused unit tests for the guided Match
 * creation sequencing (Event → operational fields), independent of
 * fetch/DB, mirroring the Tournament/Training orchestration test style.
 */

import { describe, expect, it, vi } from "vitest";
import {
  orchestrateMatchCreation,
  type MatchCreationDeps,
} from "@/lib/matchcenter/create-match-orchestration";

function makeDeps(overrides: Partial<MatchCreationDeps> = {}): MatchCreationDeps {
  return {
    createEvent: vi.fn(async () => ({
      eventId: "event-1",
      reviewStage: "APPROVED",
      allowsDirectExecution: true,
    })),
    updateOperationalFields: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("orchestrateMatchCreation", () => {
  it("creates the Event and skips the operational-fields PATCH for AWAY matches", async () => {
    const deps = makeDeps();

    const result = await orchestrateMatchCreation(
      { homeAway: "AWAY", pitchCode: null, homeDressingRoomCode: null, awayDressingRoomCode: null },
      deps,
    );

    expect(deps.createEvent).toHaveBeenCalledTimes(1);
    expect(deps.updateOperationalFields).not.toHaveBeenCalled();
    expect(result).toMatchObject({ eventId: "event-1", ok: true, operationalFieldsError: null });
  });

  it("creates the Event and skips the PATCH for HOME matches with no facility selections", async () => {
    const deps = makeDeps();

    const result = await orchestrateMatchCreation(
      { homeAway: "HOME", pitchCode: null, homeDressingRoomCode: null, awayDressingRoomCode: null },
      deps,
    );

    expect(deps.updateOperationalFields).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("creates the Event then PATCHes pitch/dressing-room codes for HOME matches", async () => {
    const deps = makeDeps();

    const result = await orchestrateMatchCreation(
      {
        homeAway: "HOME",
        pitchCode: "KUNSTRASEN_2",
        homeDressingRoomCode: "DR_1",
        awayDressingRoomCode: "DR_2",
      },
      deps,
    );

    expect(deps.updateOperationalFields).toHaveBeenCalledWith("event-1", {
      pitchCode: "KUNSTRASEN_2",
      homeDressingRoomCode: "DR_1",
      awayDressingRoomCode: "DR_2",
    });
    expect(result.ok).toBe(true);
    expect(result.operationalFieldsError).toBeNull();
  });

  it("keeps the created Event and reports a partial failure when the PATCH fails", async () => {
    const deps = makeDeps({
      updateOperationalFields: vi.fn(async () => {
        throw new Error("Ressource konnte nicht zugewiesen werden.");
      }),
    });

    const result = await orchestrateMatchCreation(
      { homeAway: "HOME", pitchCode: "KUNSTRASEN_2", homeDressingRoomCode: null, awayDressingRoomCode: null },
      deps,
    );

    expect(result.eventId).toBe("event-1");
    expect(result.ok).toBe(false);
    expect(result.operationalFieldsError).toBe("Ressource konnte nicht zugewiesen werden.");
  });

  it("propagates createEvent failures without attempting the PATCH", async () => {
    const deps = makeDeps({
      createEvent: vi.fn(async () => {
        throw new Error("Match konnte nicht erstellt werden.");
      }),
    });

    await expect(
      orchestrateMatchCreation(
        { homeAway: "HOME", pitchCode: "KUNSTRASEN_2", homeDressingRoomCode: null, awayDressingRoomCode: null },
        deps,
      ),
    ).rejects.toThrow("Match konnte nicht erstellt werden.");

    expect(deps.updateOperationalFields).not.toHaveBeenCalled();
  });
});
