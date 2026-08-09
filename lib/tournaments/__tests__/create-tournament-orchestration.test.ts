/**
 * Tests for lib/tournaments/create-tournament-orchestration.ts
 *
 * Proves the TOURNAMENTCENTER-01D creation-workflow orchestration
 * requirements:
 *   1. Create tournament with multiple FCA teams.
 *   2. Create tournament with mixed FCA + ExternalTeam participants.
 *   3. Create tournament with 4+ participants.
 *   4. Duplicate participant prevention surfaces as a per-step error
 *      without aborting the rest of the creation.
 *   5. HOME tournament: multiple pitch/hall resources are all allocated.
 *   6. Garderobe can be assigned independently per participant.
 *   7. A shared dressing room across participants remains allowed.
 *   8. Partial/incomplete allocation still yields a created tournament
 *      (the "Offen" determination itself is lib/tournaments/operational-state.ts's
 *      job, already covered by its own test suite — this file only proves
 *      that orchestration does not block or roll back on incompleteness).
 *   9. AWAY tournaments never call resource/dressing-room deps.
 *  10-12. Cross-tenant rejections (Team/ExternalTeam/FacilityResource) are
 *      enforced by the underlying services (see participant-service.test.ts,
 *      resource-allocation-service.test.ts, participant-allocation-service.test.ts).
 *      This file proves the orchestration layer surfaces such rejections as
 *      step errors rather than silently swallowing or bypassing them.
 *
 * No network, no database — `deps` are plain mocked functions.
 */

import { describe, it, expect, vi } from "vitest";
import {
  orchestrateTournamentCreation,
  type TournamentCreationOrchestrationDeps,
  type TournamentCreationPlan,
  type TournamentParticipantDraft,
} from "../create-tournament-orchestration";

const TOURNAMENT_ID = "tournament-1";

function team(localId: string, teamId: string): TournamentParticipantDraft {
  return { localId, kind: "TEAM", teamId };
}

function externalTeam(localId: string, externalTeamId: string): TournamentParticipantDraft {
  return { localId, kind: "EXTERNAL_TEAM", externalTeamId };
}

function basePlan(overrides: Partial<TournamentCreationPlan> = {}): TournamentCreationPlan {
  return {
    homeAway: "HOME",
    participants: [],
    resourceAllocations: [],
    dressingRoomAllocations: [],
    ...overrides,
  };
}

function baseDeps(
  overrides: Partial<TournamentCreationOrchestrationDeps> = {},
): TournamentCreationOrchestrationDeps {
  return {
    createEvent: vi.fn().mockResolvedValue(TOURNAMENT_ID),
    addParticipant: vi.fn().mockImplementation(async (_id, draft: TournamentParticipantDraft) => `p-${draft.localId}`),
    addResourceAllocation: vi.fn().mockResolvedValue(undefined),
    addDressingRoomAllocation: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("orchestrateTournamentCreation — participants", () => {
  it("creates a tournament with multiple FCA teams (requirement 1)", async () => {
    const plan = basePlan({
      participants: [team("t1", "team-e1"), team("t2", "team-e2"), team("t3", "team-e3")],
    });
    const deps = baseDeps();

    const result = await orchestrateTournamentCreation(plan, deps);

    expect(result.tournamentId).toBe(TOURNAMENT_ID);
    expect(deps.addParticipant).toHaveBeenCalledTimes(3);
    expect(result.createdParticipantIds.size).toBe(3);
    expect(result.ok).toBe(true);
  });

  it("creates a tournament mixing FCA teams and ExternalTeam participants (requirement 2)", async () => {
    const plan = basePlan({
      participants: [team("t1", "team-e1"), externalTeam("t2", "ext-oldboys"), externalTeam("t3", "ext-basel")],
    });
    const deps = baseDeps();

    const result = await orchestrateTournamentCreation(plan, deps);

    expect(deps.addParticipant).toHaveBeenNthCalledWith(1, TOURNAMENT_ID, plan.participants[0]);
    expect(deps.addParticipant).toHaveBeenNthCalledWith(2, TOURNAMENT_ID, plan.participants[1]);
    expect(deps.addParticipant).toHaveBeenNthCalledWith(3, TOURNAMENT_ID, plan.participants[2]);
    expect(result.ok).toBe(true);
  });

  it("supports 4+ participants with no arbitrary maximum (requirement 3)", async () => {
    const participants = Array.from({ length: 6 }, (_, i) => externalTeam(`t${i}`, `ext-${i}`));
    const plan = basePlan({ participants });
    const deps = baseDeps();

    const result = await orchestrateTournamentCreation(plan, deps);

    expect(result.createdParticipantIds.size).toBe(6);
    expect(result.ok).toBe(true);
  });

  it("collects a duplicate-participant error without aborting the remaining participants (requirement 4)", async () => {
    const plan = basePlan({
      participants: [team("t1", "team-e1"), team("t2", "team-e1"), externalTeam("t3", "ext-basel")],
    });
    const deps = baseDeps({
      addParticipant: vi
        .fn()
        .mockResolvedValueOnce("p-t1")
        .mockRejectedValueOnce(new Error('Team "team-e1" already participates in this tournament.'))
        .mockResolvedValueOnce("p-t3"),
    });

    const result = await orchestrateTournamentCreation(plan, deps);

    expect(deps.addParticipant).toHaveBeenCalledTimes(3);
    expect(result.createdParticipantIds.size).toBe(2);
    expect(result.participantErrors).toHaveLength(1);
    expect(result.participantErrors[0].error).toMatch(/already participates/);
    expect(result.ok).toBe(false);
    // the tournament itself was still created — no rollback of the Event.
    expect(result.tournamentId).toBe(TOURNAMENT_ID);
  });

  it("surfaces a cross-tenant Team/ExternalTeam rejection as a step error (requirements 10-11)", async () => {
    const plan = basePlan({ participants: [team("t1", "other-tenant-team")] });
    const deps = baseDeps({
      addParticipant: vi.fn().mockRejectedValue(new Error("teamId does not belong to this tenant")),
    });

    const result = await orchestrateTournamentCreation(plan, deps);

    expect(result.participantErrors).toHaveLength(1);
    expect(result.participantErrors[0].error).toMatch(/does not belong to this tenant/);
    expect(result.ok).toBe(false);
  });
});

describe("orchestrateTournamentCreation — HOME resource allocations", () => {
  it("allocates multiple pitch/hall resources for a HOME tournament (requirement 5)", async () => {
    const plan = basePlan({
      homeAway: "HOME",
      resourceAllocations: [
        { localId: "r1", facilityResourceId: "resource-kr2" },
        { localId: "r2", facilityResourceId: "resource-kr3a" },
      ],
    });
    const deps = baseDeps();

    const result = await orchestrateTournamentCreation(plan, deps);

    expect(deps.addResourceAllocation).toHaveBeenCalledTimes(2);
    expect(deps.addResourceAllocation).toHaveBeenNthCalledWith(1, TOURNAMENT_ID, plan.resourceAllocations[0]);
    expect(deps.addResourceAllocation).toHaveBeenNthCalledWith(2, TOURNAMENT_ID, plan.resourceAllocations[1]);
    expect(result.ok).toBe(true);
  });

  it("surfaces a cross-tenant FacilityResource rejection as a step error (requirement 12)", async () => {
    const plan = basePlan({
      homeAway: "HOME",
      resourceAllocations: [{ localId: "r1", facilityResourceId: "other-tenant-resource" }],
    });
    const deps = baseDeps({
      addResourceAllocation: vi.fn().mockRejectedValue(new Error("FacilityResource not found: other-tenant-resource")),
    });

    const result = await orchestrateTournamentCreation(plan, deps);

    expect(result.resourceAllocationErrors).toHaveLength(1);
    expect(result.ok).toBe(false);
  });
});

describe("orchestrateTournamentCreation — per-participant Garderobe", () => {
  it("assigns dressing rooms independently per participant (requirement 6)", async () => {
    const plan = basePlan({
      homeAway: "HOME",
      participants: [team("t1", "team-e4"), externalTeam("t2", "ext-oldboys")],
      dressingRoomAllocations: [
        { participantLocalId: "t1", facilityResourceId: "resource-e3" },
        { participantLocalId: "t2", facilityResourceId: "resource-e4" },
      ],
    });
    const deps = baseDeps();

    const result = await orchestrateTournamentCreation(plan, deps);

    expect(deps.addDressingRoomAllocation).toHaveBeenCalledTimes(2);
    expect(deps.addDressingRoomAllocation).toHaveBeenNthCalledWith(
      1,
      TOURNAMENT_ID,
      "p-t1",
      plan.dressingRoomAllocations[0],
    );
    expect(deps.addDressingRoomAllocation).toHaveBeenNthCalledWith(
      2,
      TOURNAMENT_ID,
      "p-t2",
      plan.dressingRoomAllocations[1],
    );
    expect(result.ok).toBe(true);
  });

  it("allows a shared dressing room across multiple participants (requirement 7)", async () => {
    const plan = basePlan({
      homeAway: "HOME",
      participants: [team("t1", "team-e4"), externalTeam("t2", "ext-oldboys"), externalTeam("t3", "ext-basel")],
      dressingRoomAllocations: [
        { participantLocalId: "t1", facilityResourceId: "resource-e5" },
        { participantLocalId: "t2", facilityResourceId: "resource-e5" },
      ],
    });
    const deps = baseDeps();

    const result = await orchestrateTournamentCreation(plan, deps);

    expect(deps.addDressingRoomAllocation).toHaveBeenCalledTimes(2);
    expect(result.dressingRoomAllocationErrors).toHaveLength(0);
    expect(result.ok).toBe(true);
  });

  it("produces an incomplete-but-created result when some participants have no Garderobe yet (requirement 8)", async () => {
    const plan = basePlan({
      homeAway: "HOME",
      participants: [team("t1", "team-e4"), externalTeam("t2", "ext-oldboys")],
      resourceAllocations: [{ localId: "r1", facilityResourceId: "resource-kr2" }],
      // t2 intentionally has no dressing-room draft — mirrors an admin who
      // has not finished Garderobe assignment yet. Orchestration must not
      // block or fail because of this; lib/tournaments/operational-state.ts
      // is what later reports this tournament as "Offen".
      dressingRoomAllocations: [{ participantLocalId: "t1", facilityResourceId: "resource-e3" }],
    });
    const deps = baseDeps();

    const result = await orchestrateTournamentCreation(plan, deps);

    expect(result.ok).toBe(true);
    expect(result.createdParticipantIds.size).toBe(2);
    expect(deps.addDressingRoomAllocation).toHaveBeenCalledTimes(1);
  });

  it("skips a dressing-room draft whose participant failed to create, without throwing", async () => {
    const plan = basePlan({
      homeAway: "HOME",
      participants: [team("t1", "team-e4")],
      dressingRoomAllocations: [{ participantLocalId: "t1", facilityResourceId: "resource-e3" }],
    });
    const deps = baseDeps({
      addParticipant: vi.fn().mockRejectedValue(new Error("Duplicate participant")),
    });

    const result = await orchestrateTournamentCreation(plan, deps);

    expect(deps.addDressingRoomAllocation).not.toHaveBeenCalled();
    expect(result.dressingRoomAllocationErrors).toHaveLength(1);
    expect(result.dressingRoomAllocationErrors[0].error).toMatch(/nicht angelegt/);
    expect(result.ok).toBe(false);
  });
});

describe("orchestrateTournamentCreation — AWAY tournaments (requirement 9)", () => {
  it("never calls resource-allocation or dressing-room deps for an AWAY tournament", async () => {
    const plan = basePlan({
      homeAway: "AWAY",
      participants: [team("t1", "team-e1"), externalTeam("t2", "ext-oldboys")],
      resourceAllocations: [{ localId: "r1", facilityResourceId: "resource-kr2" }],
      dressingRoomAllocations: [{ participantLocalId: "t1", facilityResourceId: "resource-e3" }],
    });
    const deps = baseDeps();

    const result = await orchestrateTournamentCreation(plan, deps);

    expect(deps.addResourceAllocation).not.toHaveBeenCalled();
    expect(deps.addDressingRoomAllocation).not.toHaveBeenCalled();
    expect(result.resourceAllocationErrors).toHaveLength(0);
    expect(result.dressingRoomAllocationErrors).toHaveLength(0);
    expect(result.ok).toBe(true);
  });
});

describe("orchestrateTournamentCreation — Event creation failure", () => {
  it("aborts the whole creation when the Event itself cannot be created", async () => {
    const plan = basePlan({ participants: [team("t1", "team-e1")] });
    const deps = baseDeps({
      createEvent: vi.fn().mockRejectedValue(new Error("Titel ist erforderlich.")),
    });

    await expect(orchestrateTournamentCreation(plan, deps)).rejects.toThrow("Titel ist erforderlich.");
    expect(deps.addParticipant).not.toHaveBeenCalled();
  });
});
