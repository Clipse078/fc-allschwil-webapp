/**
 * @vitest-environment jsdom
 *
 * components/admin/planner/__tests__/DayPlannerPage.test.tsx
 *
 * DAYPLANNER-01A — focused component tests:
 *   - chronological timeline rendering (Training/Match/Turnier)
 *   - Standardplan is read-only: no override editor renders, canonical
 *     module safety note only for managers (VIEW vs. MANAGE)
 *   - selecting an alternative plan renders the reused Weekplanner override
 *     editors (no second override editor)
 *   - Doppelbelegung (conflict) badge rendering
 *   - day navigation links (previous/Heute/next)
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DayPlannerPage from "@/components/admin/planner/DayPlannerPage";
import type { WeekplannerDay } from "@/lib/weekplanner/types";
import type { WeekplannerPlanDto } from "@/lib/weekplanner/plan-types";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const PLAN: WeekplannerPlanDto = {
  id: "plan-schlechtwetter",
  tenantId: "tenant-1",
  weekId: "2026-08-10",
  name: "Schlechtwetterplan",
  createdByUserId: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  archivedAt: null,
  isActive: false,
};

const FACILITY_GROUPS_BY_GROUP = {
  PITCH_HALL: [
    {
      facilityId: "facility-1",
      facilityName: "Sportanlage Bruel",
      resources: [{ id: "res-halle", name: "Halle Gartenhof", code: "HALLE", type: "FULL_PITCH" as const, facilityId: "facility-1", facilityName: "Sportanlage Bruel" }],
    },
  ] as FacilityGroup[],
  DRESSING_ROOM: [] as FacilityGroup[],
};

const TRAINING_ITEM = {
  id: "training:session-1",
  tenantId: "tenant-1",
  type: "TRAINING" as const,
  startAt: new Date("2026-08-10T16:00:00.000Z"),
  endAt: new Date("2026-08-10T17:30:00.000Z"),
  canonicalStartAt: new Date("2026-08-10T16:00:00.000Z"),
  canonicalEndAt: new Date("2026-08-10T17:30:00.000Z"),
  timeOverridden: false,
  title: "E2 Training",
  teamNames: ["FC Allschwil E2"],
  pitchAllocations: [{ facilityResourceId: "res-kr2", code: "KR2", name: "Kunstrasen 2", facilityName: "Sportanlage Bruel" }],
  dressingRoomAllocations: [],
  canonicalPitchAllocations: [{ facilityResourceId: "res-kr2", code: "KR2", name: "Kunstrasen 2", facilityName: "Sportanlage Bruel" }],
  canonicalDressingRoomAllocations: [],
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
  startAt: new Date("2026-08-10T18:00:00.000Z"),
  endAt: new Date("2026-08-10T19:30:00.000Z"),
  canonicalStartAt: new Date("2026-08-10T18:00:00.000Z"),
  canonicalEndAt: new Date("2026-08-10T19:30:00.000Z"),
  timeOverridden: false,
  title: "FC Allschwil 1 - Gegner FC",
  teamNames: ["FC Allschwil 1"],
  opponentName: "Gegner FC",
  homeAway: "HOME" as const,
  eventId: "event-match-1",
  pitchAllocations: [{ facilityResourceId: "res-pitch-standard", code: "KR2", name: "Kunstrasen 2", facilityName: "Sportanlage Bruel" }],
  dressingRoomAllocations: [{ facilityResourceId: "res-room-standard", code: "G1", name: "Garderobe 1", facilityName: "Garderobentrakt" }],
  canonicalPitchAllocations: [{ facilityResourceId: "res-pitch-standard", code: "KR2", name: "Kunstrasen 2", facilityName: "Sportanlage Bruel" }],
  canonicalDressingRoomAllocations: [{ facilityResourceId: "res-room-standard", code: "G1", name: "Garderobe 1", facilityName: "Garderobentrakt" }],
  pitchOverridden: false,
  dressingRoomOverridden: false,
  awayDressingRoomAllocations: [],
  conflicts: [],
};

function makeDay(items: typeof TRAINING_ITEM[] | (typeof TRAINING_ITEM | typeof MATCH_ITEM)[]): WeekplannerDay {
  return { dayKey: "2026-08-10", items: items as WeekplannerDay["items"] };
}

const BASE_PROPS = {
  dayParam: "2026-08-10",
  previousParam: "2026-08-09",
  nextParam: "2026-08-11",
  todayParam: "2026-08-10",
  weekParam: "2026-08-10",
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ availability: [] }) }));
});

describe("DayPlannerPage — chronological timeline rendering", () => {
  it("renders TRAINING and MATCH items in chronological order with time labels", () => {
    const day = makeDay([TRAINING_ITEM, MATCH_ITEM]);
    render(<DayPlannerPage day={day} {...BASE_PROPS} plans={[]} activePlanId={null} canManagePlans={false} />);

    const timeline = screen.getByTestId("dayplanner-timeline");
    const rows = within(timeline).getAllByTestId(/^dayplanner-item-/);
    expect(rows.map((row) => row.dataset.testid)).toEqual(["dayplanner-item-training", "dayplanner-item-match"]);
    // Europe/Zurich is UTC+2 in August (CEST) — startAt above is UTC.
    expect(within(screen.getByTestId("dayplanner-item-training")).getByText("18:00")).toBeInTheDocument();
    expect(within(screen.getByTestId("dayplanner-item-match")).getByText("20:00")).toBeInTheDocument();
  });

  it("shows an empty state when there are no items for the day", () => {
    render(<DayPlannerPage day={makeDay([])} {...BASE_PROPS} plans={[]} activePlanId={null} canManagePlans={false} />);
    expect(screen.getByText("Keine Einträge")).toBeInTheDocument();
  });
});

describe("DayPlannerPage — VIEW vs MANAGE (Standardplan safety)", () => {
  it("renders no override editor for a read-only VIEW-only user, even with an alternative plan selected", () => {
    render(
      <DayPlannerPage
        day={makeDay([TRAINING_ITEM])}
        {...BASE_PROPS}
        plans={[PLAN]}
        activePlanId={PLAN.id}
        canManagePlans={false}
      />,
    );

    expect(screen.queryByTestId(`weekplanner-anpassen-toggle-TRAINING:session-1`)).not.toBeInTheDocument();
  });

  it("shows the canonical-module safety note for MANAGE users on the Standardplan, and no override editor", () => {
    render(<DayPlannerPage day={makeDay([TRAINING_ITEM])} {...BASE_PROPS} plans={[PLAN]} activePlanId={null} canManagePlans />);

    expect(screen.getByTestId("dayplanner-standardplan-safety-note")).toHaveTextContent("Standardplan aktiv");
    expect(screen.queryByTestId(`weekplanner-anpassen-toggle-TRAINING:session-1`)).not.toBeInTheDocument();
  });

  it("hides the safety note for read-only viewers", () => {
    render(<DayPlannerPage day={makeDay([TRAINING_ITEM])} {...BASE_PROPS} plans={[PLAN]} activePlanId={null} canManagePlans={false} />);
    expect(screen.queryByTestId("dayplanner-standardplan-safety-note")).not.toBeInTheDocument();
  });

  it("renders the reused Weekplanner override editor for a MANAGE user once an alternative plan is active", async () => {
    const user = userEvent.setup();
    render(
      <DayPlannerPage
        day={makeDay([TRAINING_ITEM])}
        {...BASE_PROPS}
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

    const toggle = screen.getByTestId("weekplanner-anpassen-toggle-TRAINING:session-1");
    await user.click(toggle);
    expect(screen.getByText("Zeit anpassen")).toBeInTheDocument();
    expect(screen.getAllByText("Spielfeld/Halle anpassen").length).toBeGreaterThan(0);
  });
});

describe("DayPlannerPage — shared occupancy visibility", () => {
  it("renders a shared-occupancy badge and a day-level summary count", () => {
    render(<DayPlannerPage day={makeDay([TRAINING_ITEM])} {...BASE_PROPS} plans={[]} activePlanId={null} canManagePlans={false} />);
    expect(screen.getByTestId("dayplanner-conflict-badge")).toHaveTextContent("Geteilte Belegung");
    expect(screen.getByTestId("dayplanner-conflict-summary")).toHaveTextContent("1 Eintrag mit geteilter Ressourcenbelegung");
  });

  it("shows no conflict summary when the day has zero conflicts", () => {
    render(<DayPlannerPage day={makeDay([MATCH_ITEM])} {...BASE_PROPS} plans={[]} activePlanId={null} canManagePlans={false} />);
    expect(screen.queryByTestId("dayplanner-conflict-summary")).not.toBeInTheDocument();
  });
});

describe("DayPlannerPage — day navigation", () => {
  it("links previous/Heute/next day and shows the weekday + date heading", () => {
    render(<DayPlannerPage day={makeDay([])} {...BASE_PROPS} plans={[]} activePlanId={null} canManagePlans={false} />);

    expect(screen.getByTestId("dayplanner-previous-day")).toHaveAttribute("href", "/dashboard/planner/day?day=2026-08-09");
    expect(screen.getByTestId("dayplanner-today")).toHaveAttribute("href", "/dashboard/planner/day?day=2026-08-10");
    expect(screen.getByTestId("dayplanner-next-day")).toHaveAttribute("href", "/dashboard/planner/day?day=2026-08-11");
    expect(screen.getByTestId("dayplanner-day-heading")).toHaveTextContent("Montag");
    expect(screen.getByTestId("dayplanner-day-heading")).toHaveTextContent("10. August 2026");
  });
});
