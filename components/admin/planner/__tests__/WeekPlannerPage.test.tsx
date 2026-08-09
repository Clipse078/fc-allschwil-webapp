/**
 * @vitest-environment jsdom
 *
 * components/admin/planner/__tests__/WeekPlannerPage.test.tsx
 *
 * WEEKPLANNER-01C — focused tests for operational UX completion:
 *   - Standardplan is read-only: no override editor renders, canonical
 *     module safety note is shown (only for managers)
 *   - selecting an alternative plan renders Training/Match/Tournament
 *     override editors
 *   - Doppelbelegung (conflict) badges render from the already-resolved
 *     per-plan effective allocations passed in (isolation is enforced
 *     upstream by lib/weekplanner/queries.ts — see plan-overrides.test.ts)
 */

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WeekPlannerPage from "@/components/admin/planner/WeekPlannerPage";
import type { WeekplannerDay, WeekplannerWeek } from "@/lib/weekplanner/types";
import type { WeekplannerPlanDto } from "@/lib/weekplanner/plan-types";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function emptyDay(dayKey: string): WeekplannerDay {
  return { dayKey, items: [] };
}

function makeWeek(days: WeekplannerDay[]): WeekplannerWeek {
  const byKey = new Map(days.map((d) => [d.dayKey, d]));
  const allDayKeys = [
    "2026-08-10",
    "2026-08-11",
    "2026-08-12",
    "2026-08-13",
    "2026-08-14",
    "2026-08-15",
    "2026-08-16",
  ];
  return {
    days: allDayKeys.map((k) => byKey.get(k) ?? emptyDay(k)),
    weekNumberLabel: "KW 33",
    rangeLabel: "10.–16. Aug 2026",
    param: "2026-08-10",
    previousParam: "2026-08-03",
    nextParam: "2026-08-17",
  };
}

const PLAN: WeekplannerPlanDto = {
  id: "plan-schlechtwetter",
  tenantId: "tenant-1",
  weekId: "2026-08-10",
  name: "Schlechtwetterplan",
  createdByUserId: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  archivedAt: null,
};

const FACILITY_GROUPS_BY_GROUP = {
  PITCH_HALL: [
    {
      facilityId: "facility-1",
      facilityName: "Sportanlage Bruel",
      resources: [{ id: "res-halle", name: "Halle Gartenhof", code: "HALLE", type: "FULL_PITCH" as const, facilityId: "facility-1", facilityName: "Sportanlage Bruel" }],
    },
  ] as FacilityGroup[],
  DRESSING_ROOM: [
    {
      facilityId: "facility-2",
      facilityName: "Garderobentrakt",
      resources: [{ id: "res-g3", name: "Garderobe 3", code: "G3", type: "DRESSING_ROOM" as const, facilityId: "facility-2", facilityName: "Garderobentrakt" }],
    },
  ] as FacilityGroup[],
};

const TRAINING_ITEM = {
  id: "training:session-1",
  tenantId: "tenant-1",
  type: "TRAINING" as const,
  startAt: new Date("2026-08-10T16:00:00.000Z"),
  endAt: new Date("2026-08-10T17:30:00.000Z"),
  title: "E2 Training",
  teamNames: ["FC Allschwil E2"],
  pitchAllocations: [{ facilityResourceId: "res-kr2", code: "KR2", name: "Kunstrasen 2", facilityName: "Sportanlage Bruel" }],
  dressingRoomAllocations: [],
  pitchOverridden: false,
  dressingRoomOverridden: false,
  conflicts: [{ facilityResourceId: "res-kr2", facilityResourceName: "Kunstrasen 2" }],
  trainingSeriesId: "series-1",
  trainingSessionId: "session-1",
};

const MATCH_ITEM = {
  id: "match:event-match-1",
  tenantId: "tenant-1",
  type: "MATCH" as const,
  startAt: new Date("2026-08-15T13:00:00.000Z"),
  endAt: new Date("2026-08-15T14:30:00.000Z"),
  title: "FC Allschwil 1 - Gegner FC",
  teamNames: ["FC Allschwil 1"],
  opponentName: "Gegner FC",
  homeAway: "HOME" as const,
  eventId: "event-match-1",
  pitchAllocations: [{ facilityResourceId: "res-pitch-standard", code: "KR2", name: "Kunstrasen 2", facilityName: "Sportanlage Bruel" }],
  dressingRoomAllocations: [{ facilityResourceId: "res-room-standard", code: "G1", name: "Garderobe 1", facilityName: "Garderobentrakt" }],
  pitchOverridden: false,
  dressingRoomOverridden: false,
  awayDressingRoomAllocations: [],
  conflicts: [],
};

const TOURNAMENT_ITEM = {
  id: "tournament:event-tournament-1",
  tenantId: "tenant-1",
  type: "TOURNAMENT" as const,
  startAt: new Date("2026-08-15T08:00:00.000Z"),
  endAt: new Date("2026-08-15T16:00:00.000Z"),
  title: "FCA Sommerturnier",
  teamNames: ["FC Allschwil E1"],
  homeAway: "HOME" as const,
  eventId: "event-tournament-1",
  pitchAllocations: [{ facilityResourceId: "res-pitch-standard", code: "KR2", name: "Kunstrasen 2", facilityName: "Sportanlage Bruel" }],
  dressingRoomAllocations: [],
  pitchOverridden: false,
  dressingRoomOverridden: false,
  participantAllocations: [
    {
      participantId: "participant-1",
      participantLabel: "FC Allschwil E1",
      dressingRoomAllocations: [{ facilityResourceId: "res-room-standard", code: "G1", name: "Garderobe 1", facilityName: "Garderobentrakt" }],
      dressingRoomOverridden: false,
    },
  ],
  conflicts: [],
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ availability: [] }) }),
  );
});

describe("WeekPlannerPage — Standardplan safety", () => {
  it("renders no override editor and shows the canonical-module safety note for managers on the Standardplan", () => {
    const week = makeWeek([{ dayKey: "2026-08-10", items: [TRAINING_ITEM] }]);
    render(<WeekPlannerPage week={week} todayParam="2026-08-10" plans={[PLAN]} activePlanId={null} canManagePlans />);

    expect(screen.queryByText("Spielfeld/Halle anpassen")).not.toBeInTheDocument();
    const note = screen.getByTestId("weekplanner-standardplan-safety-note");
    expect(note).toHaveTextContent("Standardplan aktiv");
    expect(note).toHaveTextContent("TrainingCenter");
    expect(note).toHaveTextContent("Matchcenter");
    expect(note).toHaveTextContent("TournamentCenter");
  });

  it("hides the safety note for read-only viewers (no manage permission)", () => {
    const week = makeWeek([{ dayKey: "2026-08-10", items: [TRAINING_ITEM] }]);
    render(<WeekPlannerPage week={week} todayParam="2026-08-10" plans={[PLAN]} activePlanId={null} canManagePlans={false} />);

    expect(screen.queryByTestId("weekplanner-standardplan-safety-note")).not.toBeInTheDocument();
  });

  it("hides the safety note once an alternative plan is active", async () => {
    const week = makeWeek([{ dayKey: "2026-08-10", items: [TRAINING_ITEM] }]);
    render(
      <WeekPlannerPage
        week={week}
        todayParam="2026-08-10"
        plans={[PLAN]}
        activePlanId={PLAN.id}
        canManagePlans
        overrideEditing={{
          planId: PLAN.id,
          planName: PLAN.name,
          overridesByKey: {},
          facilityGroupsByAllocationGroup: FACILITY_GROUPS_BY_GROUP,
        }}
      />,
    );

    await screen.findAllByTestId("weekplanner-override-badge-standard");
    expect(screen.queryByTestId("weekplanner-standardplan-safety-note")).not.toBeInTheDocument();
  });
});

describe("WeekPlannerPage — override editing per activity type", () => {
  it("renders the override editor for TRAINING, HOME MATCH, and HOME TOURNAMENT when an alternative plan is active", async () => {
    const week = makeWeek([
      { dayKey: "2026-08-10", items: [TRAINING_ITEM] },
      { dayKey: "2026-08-15", items: [MATCH_ITEM, TOURNAMENT_ITEM] },
    ]);

    render(
      <WeekPlannerPage
        week={week}
        todayParam="2026-08-10"
        plans={[PLAN]}
        activePlanId={PLAN.id}
        canManagePlans
        overrideEditing={{
          planId: PLAN.id,
          planName: PLAN.name,
          overridesByKey: {},
          facilityGroupsByAllocationGroup: FACILITY_GROUPS_BY_GROUP,
        }}
      />,
    );

    const trainingCard = screen.getByTestId("weekplanner-item-training");
    expect(within(trainingCard).getAllByText("Spielfeld/Halle anpassen").length).toBeGreaterThan(0);
    const trainingBadges = await within(trainingCard).findAllByTestId("weekplanner-override-badge-standard");
    expect(trainingBadges.some((badge) => badge.textContent === "Standardplan: Kunstrasen 2")).toBe(true);

    const matchCard = screen.getByTestId("weekplanner-item-match");
    expect(within(matchCard).getAllByText(/anpassen/).length).toBeGreaterThan(0);
    await within(matchCard).findAllByTestId("weekplanner-override-badge-standard");

    const tournamentCard = screen.getByTestId("weekplanner-item-tournament");
    expect(within(tournamentCard).getAllByText(/anpassen/).length).toBeGreaterThan(0);
    await within(tournamentCard).findAllByTestId("weekplanner-override-badge-standard");
  });
});

describe("WeekPlannerPage — Doppelbelegung visibility", () => {
  it("renders a conflict badge on the affected item and a week-level summary count", () => {
    const week = makeWeek([{ dayKey: "2026-08-10", items: [TRAINING_ITEM] }]);
    render(<WeekPlannerPage week={week} todayParam="2026-08-10" plans={[]} activePlanId={null} canManagePlans={false} />);

    expect(screen.getByTestId("weekplanner-conflict-badge")).toHaveTextContent("Doppelbelegung");
    expect(screen.getByTestId("weekplanner-conflict-summary")).toHaveTextContent("1 Eintrag mit Doppelbelegung");
  });

  it("shows no conflict summary when the week has zero conflicts", () => {
    const week = makeWeek([{ dayKey: "2026-08-15", items: [MATCH_ITEM] }]);
    render(<WeekPlannerPage week={week} todayParam="2026-08-10" plans={[]} activePlanId={null} canManagePlans={false} />);

    expect(screen.queryByTestId("weekplanner-conflict-summary")).not.toBeInTheDocument();
  });
});
