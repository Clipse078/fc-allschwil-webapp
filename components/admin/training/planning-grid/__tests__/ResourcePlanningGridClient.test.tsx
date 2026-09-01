/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/ToastProvider";
import ResourcePlanningGridClient from "@/components/admin/training/planning-grid/ResourcePlanningGridClient";
import { buildPlanningGridViewModel } from "@/lib/training/planning-grid/projection";
import { derivePlanningCategoryOptions } from "@/lib/training/planning-grid/resource-categories";
import {
  makeSeriesAllocation,
  makeSession,
  multiFacilityFixtures,
} from "@/lib/training/planning-grid/__tests__/fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("ResourcePlanningGridClient", () => {
  const viewModel = buildPlanningGridViewModel({
    date: "2026-09-02",
    period: "DAY",
    category: "PITCH_HALL",
    facilities: multiFacilityFixtures,
    sessions: [makeSession()],
    allocations: {
      seriesAllocationsBySeries: new Map([
        ["series-1", [makeSeriesAllocation()]],
      ]),
      sessionOverridesBySession: new Map(),
    },
    filters: {
      facilityId: null,
      teamSeasonId: null,
      conflictsOnly: false,
      unallocatedOnly: false,
    },
    categories: derivePlanningCategoryOptions(multiFacilityFixtures),
    teams: [{ id: "team-a", name: "Team Alpha" }],
  });

  it("requires ToastProvider — missing provider crashes at render (regression)", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <ResourcePlanningGridClient
          viewModel={viewModel}
          dayLabel="Mittwoch, 2. September 2026"
          dayParam="2026-09-02"
          previousDayParam="2026-09-01"
          nextDayParam="2026-09-03"
          canManage
        />,
      ),
    ).toThrow(/useToast must be used inside <ToastProvider>/);
    consoleError.mockRestore();
  });

  it("renders toolbar and resource lanes", () => {
    render(
      <ToastProvider>
        <ResourcePlanningGridClient
          viewModel={viewModel}
          dayLabel="Mittwoch, 2. September 2026"
          dayParam="2026-09-02"
          previousDayParam="2026-09-01"
          nextDayParam="2026-09-03"
          canManage
        />
      </ToastProvider>,
    );

    expect(screen.getByTestId("planning-grid-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("resource-lane-resource-a")).toBeInTheDocument();
    expect(screen.getByTestId("activity-block-session-1")).toBeInTheDocument();
  });

  it("supports keyboard-accessible resource change without dragging", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ResourcePlanningGridClient
          viewModel={viewModel}
          dayLabel="Mittwoch, 2. September 2026"
          dayParam="2026-09-02"
          previousDayParam="2026-09-01"
          nextDayParam="2026-09-03"
          canManage
        />
      </ToastProvider>,
    );

    await user.click(screen.getAllByText("Ressource ändern")[0]);
    expect(screen.getByTestId("resource-change-search")).toBeInTheDocument();
    expect(screen.getByText("Nur diesen Termin")).toBeInTheDocument();
  });
});
