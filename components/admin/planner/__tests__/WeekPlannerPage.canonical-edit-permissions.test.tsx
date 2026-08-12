/**
 * @vitest-environment jsdom
 *
 * PLANNING-RESOURCE-UX-01-V — focused permission verification for the
 * Wochenplaner "Planung bearbeiten" button entity-specific gating.
 *
 * VERIFY 8: confirms that "Planung bearbeiten" is only offered for entities
 * the caller actually has permission to mutate:
 *   - TRAININGS_MANAGE only → Training button visible, Match/Tournament hidden
 *   - EVENTS_MANAGE only   → Match/Tournament buttons visible, Training hidden
 *   - both                 → all buttons visible
 *   - neither              → no buttons (canonicalEditing undefined)
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WeekPlannerPage from "@/components/admin/planner/WeekPlannerPage";
import type { WeekplannerWeek } from "@/lib/weekplanner/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Minimal facility groups (empty — just enough for props)
const FACILITY_GROUPS = { PITCH_HALL: [], DRESSING_ROOM: [] };

const NOW = new Date("2026-09-22T14:00:00.000Z");

function makeWeek(items: WeekplannerWeek["days"][0]["items"]): WeekplannerWeek {
  return {
    param: "2026-38",
    previousParam: "2026-37",
    nextParam: "2026-39",
    weekNumberLabel: "KW 38",
    rangeLabel: "Montag 21. Sep – Sonntag 27. Sep 2026",
    days: [
      {
        dayKey: "2026-09-22",
        items,
      },
      ...["2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-21"].map(
        (dayKey) => ({ dayKey, items: [] }),
      ),
    ],
  };
}

const TRAINING_ITEM = {
  id: "train-1",
  tenantId: "tenant-1",
  type: "TRAINING" as const,
  startAt: new Date("2026-09-22T16:00:00.000Z"),
  endAt: new Date("2026-09-22T17:30:00.000Z"),
  canonicalStartAt: new Date("2026-09-22T16:00:00.000Z"),
  canonicalEndAt: new Date("2026-09-22T17:30:00.000Z"),
  title: "E3 Training",
  teamNames: ["E3"],
  pitchAllocations: [],
  dressingRoomAllocations: [],
  canonicalPitchAllocations: [],
  canonicalDressingRoomAllocations: [],
  pitchOverridden: false,
  dressingRoomOverridden: false,
  timeOverridden: false,
  conflicts: [],
  trainingSeriesId: "series-1",
  trainingSessionId: "session-1",
};

const MATCH_ITEM = {
  id: "match-1",
  tenantId: "tenant-1",
  type: "MATCH" as const,
  startAt: new Date("2026-09-22T14:00:00.000Z"),
  endAt: new Date("2026-09-22T16:00:00.000Z"),
  canonicalStartAt: new Date("2026-09-22T14:00:00.000Z"),
  canonicalEndAt: new Date("2026-09-22T16:00:00.000Z"),
  title: "Heimspiel vs. FC Test",
  teamNames: ["E3"],
  pitchAllocations: [],
  dressingRoomAllocations: [],
  awayDressingRoomAllocations: [],
  canonicalPitchAllocations: [],
  canonicalDressingRoomAllocations: [],
  pitchOverridden: false,
  dressingRoomOverridden: false,
  timeOverridden: false,
  conflicts: [],
  eventId: "event-1",
  opponentName: "FC Test",
  homeAway: "HOME" as const,
};

const TOURNAMENT_ITEM = {
  id: "tourn-1",
  tenantId: "tenant-1",
  type: "TOURNAMENT" as const,
  startAt: new Date("2026-09-22T09:00:00.000Z"),
  endAt: new Date("2026-09-22T17:00:00.000Z"),
  canonicalStartAt: new Date("2026-09-22T09:00:00.000Z"),
  canonicalEndAt: new Date("2026-09-22T17:00:00.000Z"),
  title: "Juniorenturnier",
  teamNames: ["E3"],
  pitchAllocations: [],
  dressingRoomAllocations: [],
  canonicalPitchAllocations: [],
  canonicalDressingRoomAllocations: [],
  pitchOverridden: false,
  dressingRoomOverridden: false,
  timeOverridden: false,
  conflicts: [],
  eventId: "event-2",
  homeAway: "HOME" as const,
  participantAllocations: [],
};

const ALL_ITEMS = [TRAINING_ITEM, MATCH_ITEM, TOURNAMENT_ITEM];

describe("WeekPlannerPage — Planung bearbeiten permission gating", () => {
  it("TRAININGS_MANAGE only: Training button shown, Match/Tournament buttons hidden", () => {
    render(
      <WeekPlannerPage
        week={makeWeek(ALL_ITEMS)}
        todayParam="2026-38"
        activePlanId={null}
        canManagePlans
        canonicalEditing={{
          canManageTrainings: true,
          canManageEvents: false,
          facilityGroupsByAllocationGroup: FACILITY_GROUPS,
        }}
      />,
    );

    expect(
      screen.getAllByTestId("weekplanner-canonical-edit-training").length,
    ).toBe(1);
    expect(screen.queryByTestId("weekplanner-canonical-edit-match")).toBeNull();
    expect(screen.queryByTestId("weekplanner-canonical-edit-tournament")).toBeNull();
  });

  it("EVENTS_MANAGE only: Match/Tournament buttons shown, Training button hidden", () => {
    render(
      <WeekPlannerPage
        week={makeWeek(ALL_ITEMS)}
        todayParam="2026-38"
        activePlanId={null}
        canManagePlans
        canonicalEditing={{
          canManageTrainings: false,
          canManageEvents: true,
          facilityGroupsByAllocationGroup: FACILITY_GROUPS,
        }}
      />,
    );

    expect(screen.queryByTestId("weekplanner-canonical-edit-training")).toBeNull();
    expect(
      screen.getAllByTestId("weekplanner-canonical-edit-match").length,
    ).toBe(1);
    expect(
      screen.getAllByTestId("weekplanner-canonical-edit-tournament").length,
    ).toBe(1);
  });

  it("both TRAININGS_MANAGE + EVENTS_MANAGE: all three buttons shown", () => {
    render(
      <WeekPlannerPage
        week={makeWeek(ALL_ITEMS)}
        todayParam="2026-38"
        activePlanId={null}
        canManagePlans
        canonicalEditing={{
          canManageTrainings: true,
          canManageEvents: true,
          facilityGroupsByAllocationGroup: FACILITY_GROUPS,
        }}
      />,
    );

    expect(screen.getAllByTestId("weekplanner-canonical-edit-training").length).toBe(1);
    expect(screen.getAllByTestId("weekplanner-canonical-edit-match").length).toBe(1);
    expect(screen.getAllByTestId("weekplanner-canonical-edit-tournament").length).toBe(1);
  });

  it("no canonicalEditing: no 'Planung bearbeiten' buttons at all", () => {
    render(
      <WeekPlannerPage
        week={makeWeek(ALL_ITEMS)}
        todayParam="2026-38"
        activePlanId={null}
        canManagePlans={false}
      />,
    );

    expect(screen.queryByTestId("weekplanner-canonical-edit-training")).toBeNull();
    expect(screen.queryByTestId("weekplanner-canonical-edit-match")).toBeNull();
    expect(screen.queryByTestId("weekplanner-canonical-edit-tournament")).toBeNull();
  });

  it("alternative plan active: Planung bearbeiten never shown (overrides only)", () => {
    render(
      <WeekPlannerPage
        week={makeWeek(ALL_ITEMS)}
        todayParam="2026-38"
        activePlanId="some-plan-id"
        canManagePlans
        canonicalEditing={{
          canManageTrainings: true,
          canManageEvents: true,
          facilityGroupsByAllocationGroup: FACILITY_GROUPS,
        }}
      />,
    );

    // DayColumn passes canonicalEditing only when activePlanId === null
    expect(screen.queryByTestId("weekplanner-canonical-edit-training")).toBeNull();
    expect(screen.queryByTestId("weekplanner-canonical-edit-match")).toBeNull();
    expect(screen.queryByTestId("weekplanner-canonical-edit-tournament")).toBeNull();
  });
});
