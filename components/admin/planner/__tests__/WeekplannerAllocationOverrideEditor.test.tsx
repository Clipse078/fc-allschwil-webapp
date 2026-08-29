/**
 * @vitest-environment jsdom
 *
 * components/admin/planner/__tests__/WeekplannerAllocationOverrideEditor.test.tsx
 *
 * WEEKPLANNER-01C — focused tests for the allocation-override editor:
 *   - fallback badge names the Standardplan value ("Standardplan: Kunstrasen 2")
 *   - override badge names the active plan + its resource ("Schlechtwetterplan: Halle Gartenhof")
 *   - live Frei/Belegt availability is fetched and surfaced in the picker
 *   - adding an override replaces the Standardplan default for this group
 *   - "Standardplan verwenden" removes every override row and reverts to fallback
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  WeekplannerAllocationOverrideEditor,
  type WeekplannerOverrideRow,
} from "@/components/admin/planner/WeekplannerAllocationOverrideEditor";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const FACILITY_GROUPS: FacilityGroup[] = [
  {
    facilityId: "facility-1",
    facilityName: "Sportanlage Bruel",
    resources: [
      { id: "res-kr2", name: "Kunstrasen 2", code: "KR2", type: "FULL_PITCH", facilityId: "facility-1", facilityName: "Sportanlage Bruel" },
      { id: "res-halle", name: "Halle Gartenhof", code: "HALLE", type: "FULL_PITCH", facilityId: "facility-1", facilityName: "Sportanlage Bruel" },
    ],
  },
];

const STANDARDPLAN_ALLOCATIONS = [{ facilityResourceId: "res-kr2", facilityResourceName: "Kunstrasen 2", facilityResourceCode: "KR2" }];

function overrideRow(overrides: Partial<WeekplannerOverrideRow> = {}): WeekplannerOverrideRow {
  return {
    id: "alloc-1",
    facilityResourceId: "res-halle",
    facilityResourceName: "Halle Gartenhof",
    facilityResourceCode: "HALLE",
    occupancyBeforeMinutes: 0,
    occupancyAfterMinutes: 0,
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

function installFetchMock(handlers: { onAvailability?: () => unknown } = {}) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(url);
    if (url.startsWith("/api/facilities/availability")) {
      return jsonResponse(
        handlers.onAvailability
          ? handlers.onAvailability()
          : {
              availability: [
                { resourceId: "res-kr2", status: "FREE", conflictLabel: null, conflictStartAt: null, conflictEndAt: null },
                {
                  resourceId: "res-halle",
                  status: "OCCUPIED",
                  conflictLabel: "Training E3",
                  conflictStartAt: "2026-08-10T16:00:00.000Z",
                  conflictEndAt: "2026-08-10T17:00:00.000Z",
                },
              ],
            },
      );
    }
    if (url.includes("/allocations/") && init?.method === "DELETE") {
      return jsonResponse({});
    }
    if (url.endsWith("/allocations") && init?.method === "POST") {
      return jsonResponse({
        allocation: { id: "alloc-new", facilityResourceId: "res-halle", facilityResourceName: "Halle Gartenhof", facilityResourceCode: "HALLE" },
      });
    }
    throw new Error(`Unexpected fetch call: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("WeekplannerAllocationOverrideEditor — Standardplan fallback", () => {
  it("names the Standardplan's actual resource in the fallback badge when no override exists", async () => {
    installFetchMock();
    render(
      <WeekplannerAllocationOverrideEditor
        planId="plan-1"
        planName="Schlechtwetterplan"
        activityType="TRAINING"
        activityId="session-1"
        allocationGroup="PITCH_HALL"
        label="Spielfeld/Halle"
        standardplanAllocations={STANDARDPLAN_ALLOCATIONS}
        initialOverrideAllocations={[]}
        facilityGroups={FACILITY_GROUPS}
        startAt="2026-08-10T16:00:00.000Z"
        endAt="2026-08-10T17:30:00.000Z"
      />,
    );

    const badge = await screen.findByTestId("weekplanner-override-badge-standard");
    expect(badge).toHaveTextContent("Standardplan: Kunstrasen 2");
  });
});

describe("WeekplannerAllocationOverrideEditor — active override", () => {
  it("names the active plan + its resource in the override badge", async () => {
    installFetchMock();
    render(
      <WeekplannerAllocationOverrideEditor
        planId="plan-1"
        planName="Schlechtwetterplan"
        activityType="TRAINING"
        activityId="session-1"
        allocationGroup="PITCH_HALL"
        label="Spielfeld/Halle"
        standardplanAllocations={STANDARDPLAN_ALLOCATIONS}
        initialOverrideAllocations={[overrideRow()]}
        facilityGroups={FACILITY_GROUPS}
        startAt="2026-08-10T16:00:00.000Z"
        endAt="2026-08-10T17:30:00.000Z"
      />,
    );

    const badge = await screen.findByTestId("weekplanner-override-badge-active");
    expect(badge).toHaveTextContent("Schlechtwetterplan: Halle Gartenhof");
  });

  it("provides an obvious 'Standardplan verwenden' action that removes every override row", async () => {
    const { fetchMock } = installFetchMock();
    render(
      <WeekplannerAllocationOverrideEditor
        planId="plan-1"
        planName="Schlechtwetterplan"
        activityType="TRAINING"
        activityId="session-1"
        allocationGroup="PITCH_HALL"
        label="Spielfeld/Halle"
        standardplanAllocations={STANDARDPLAN_ALLOCATIONS}
        initialOverrideAllocations={[overrideRow()]}
        facilityGroups={FACILITY_GROUPS}
        startAt="2026-08-10T16:00:00.000Z"
        endAt="2026-08-10T17:30:00.000Z"
      />,
    );

    await screen.findByTestId("weekplanner-override-badge-active");
    fireEvent.click(screen.getByRole("button", { name: /Standardplan verwenden/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/weekplanner/plans/plan-1/allocations/alloc-1", expect.objectContaining({ method: "DELETE" })),
    );

    const badge = await screen.findByTestId("weekplanner-override-badge-standard");
    expect(badge).toHaveTextContent("Standardplan: Kunstrasen 2");
  });
});

describe("WeekplannerAllocationOverrideEditor — live resource availability", () => {
  it("fetches and surfaces Frei/Belegt + conflict details for the activity's own time window", async () => {
    installFetchMock();
    render(
      <WeekplannerAllocationOverrideEditor
        planId="plan-1"
        planName="Schlechtwetterplan"
        activityType="TRAINING"
        activityId="session-1"
        allocationGroup="PITCH_HALL"
        label="Spielfeld/Halle"
        standardplanAllocations={STANDARDPLAN_ALLOCATIONS}
        initialOverrideAllocations={[]}
        facilityGroups={FACILITY_GROUPS}
        startAt="2026-08-10T16:00:00.000Z"
        endAt="2026-08-10T17:30:00.000Z"
      />,
    );

    const select = await screen.findByTestId("weekplanner-override-session-1-pitch_hall-select");
    await waitFor(() => expect(select.innerHTML).toContain("Belegt"));
    expect(select.innerHTML).toContain("Training E3");
  });

  it("excludes the activity's own booking for MATCH/TOURNAMENT via excludeEventId", async () => {
    const { fetchMock } = installFetchMock();
    render(
      <WeekplannerAllocationOverrideEditor
        planId="plan-1"
        planName="Schlechtwetterplan"
        activityType="MATCH"
        activityId="event-match-1"
        allocationGroup="PITCH_HALL"
        label="Spielfeld/Halle"
        standardplanAllocations={STANDARDPLAN_ALLOCATIONS}
        initialOverrideAllocations={[]}
        facilityGroups={FACILITY_GROUPS}
        startAt="2026-08-15T13:00:00.000Z"
        endAt="2026-08-15T14:30:00.000Z"
      />,
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("excludeEventId=event-match-1"),
        expect.objectContaining({ cache: "no-store" }),
      ),
    );
  });

  it("adds an override via the annotated selector, replacing the Standardplan default for this group", async () => {
    installFetchMock();
    render(
      <WeekplannerAllocationOverrideEditor
        planId="plan-1"
        planName="Schlechtwetterplan"
        activityType="TRAINING"
        activityId="session-1"
        allocationGroup="PITCH_HALL"
        label="Spielfeld/Halle"
        standardplanAllocations={STANDARDPLAN_ALLOCATIONS}
        initialOverrideAllocations={[]}
        facilityGroups={FACILITY_GROUPS}
        startAt="2026-08-10T16:00:00.000Z"
        endAt="2026-08-10T17:30:00.000Z"
      />,
    );

    const select = await screen.findByTestId("weekplanner-override-session-1-pitch_hall-select");
    fireEvent.change(select, { target: { value: "res-halle" } });
    fireEvent.click(screen.getByTestId("weekplanner-override-session-1-pitch_hall-add-button"));

    const badge = await screen.findByTestId("weekplanner-override-badge-active");
    expect(badge).toHaveTextContent("Schlechtwetterplan: Halle Gartenhof");
    expect(screen.queryByText("Kunstrasen 2")).not.toBeInTheDocument();
  });
});
