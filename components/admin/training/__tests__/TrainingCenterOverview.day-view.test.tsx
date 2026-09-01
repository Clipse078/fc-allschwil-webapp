/**
 * @vitest-environment jsdom
 *
 * TRAINING-URGENT-01H — TrainingCenterOverview day-view defense in depth.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TrainingCenterOverview from "@/components/admin/training/TrainingCenterOverview";
import { buildTrainingCenterViewModel } from "@/lib/training/view-model";
import type { TrainingSessionDto } from "@/lib/training/types";

function session(overrides: Partial<TrainingSessionDto> = {}): TrainingSessionDto {
  return {
    id: overrides.id ?? "session-default",
    tenantId: "tenant-a",
    trainingSeriesId: "series-default",
    trainingSeriesTitle: "Training",
    teamSeasonId: "team-season-default",
    teamName: overrides.teamName ?? "Team",
    date: "2026-08-28",
    weekday: "FRIDAY",
    startAt: "2026-08-28T16:00:00.000Z",
    endAt: "2026-08-28T17:30:00.000Z",
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    originalDate: overrides.date ?? "2026-08-28",
    originalStartAt: overrides.startAt ?? "2026-08-28T16:00:00.000Z",
    originalEndAt: overrides.endAt ?? "2026-08-28T17:30:00.000Z",
    isRescheduled: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const baseWindows = {
  monthWindow: {
    param: "2026-08",
    label: "August 2026",
    previousParam: "2026-07",
    nextParam: "2026-09",
    weeks: [],
  },
  weekWindow: {
    param: "2026-08-25",
    label: "24.–30. Aug. 2026",
    previousParam: "2026-08-18",
    nextParam: "2026-08-31",
    days: ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30"],
  },
  dayWindow: {
    param: "2026-08-28",
    label: "Freitag, 28. August 2026",
    previousParam: "2026-08-27",
    nextParam: "2026-08-29",
    date: "2026-08-28",
  },
};

describe("TrainingCenterOverview day view — TRAINING-URGENT-01H", () => {
  it("E: day KPI total equals rendered day rows when upstream query leaked Aug 27", () => {
    const leakedSessions = [
      session({
        id: "aug27-b1",
        teamName: "Junioren B1",
        date: "2026-08-27",
        originalDate: "2026-08-27",
        weekday: "THURSDAY",
        startAt: "2026-08-27T16:00:00.000Z",
        endAt: "2026-08-27T17:30:00.000Z",
        originalStartAt: "2026-08-27T16:00:00.000Z",
        originalEndAt: "2026-08-27T17:30:00.000Z",
      }),
      session({ id: "aug28-b1", teamName: "Junioren B1", trainingSeriesId: "series-b1" }),
      session({ id: "aug28-c1", teamName: "Junioren C1", trainingSeriesId: "series-c1" }),
      session({ id: "aug28-second", teamName: "2. Mannschaft", trainingSeriesId: "series-second" }),
    ];
    const viewModel = buildTrainingCenterViewModel(leakedSessions, new Map());

    render(
      <TrainingCenterOverview
        view="DAY"
        actionFilter="ALLE"
        viewModel={viewModel}
        canManage={false}
        {...baseWindows}
      />,
    );

    const dayRows = screen.getAllByTestId("training-session-row");
    expect(dayRows).toHaveLength(3);
    expect(screen.getByTestId("trainingcenter-summary-strip")).toHaveTextContent("3");
    expect(screen.getByTestId("trainingcenter-summary-strip")).toHaveTextContent("Trainings");
    expect(screen.queryByText("Junioren B1")).toBeTruthy();
    expect(dayRows.length).toBe(3);
  });

  it("A/D: Aug 27 rows are not rendered on Aug 28 day view", () => {
    const leakedSessions = [
      session({
        id: "aug27-only",
        teamName: "Junioren B1",
        date: "2026-08-27",
        originalDate: "2026-08-27",
        weekday: "THURSDAY",
        startAt: "2026-08-27T16:00:00.000Z",
        endAt: "2026-08-27T17:30:00.000Z",
        originalStartAt: "2026-08-27T16:00:00.000Z",
        originalEndAt: "2026-08-27T17:30:00.000Z",
      }),
      session({ id: "aug28-only", teamName: "Junioren C1", trainingSeriesId: "series-c1" }),
    ];
    const viewModel = buildTrainingCenterViewModel(leakedSessions, new Map());

    render(
      <TrainingCenterOverview
        view="DAY"
        actionFilter="ALLE"
        viewModel={viewModel}
        canManage={false}
        {...baseWindows}
      />,
    );

    expect(screen.getAllByTestId("training-session-row")).toHaveLength(1);
    expect(screen.getByText("Junioren C1")).toBeTruthy();
    expect(screen.queryByText("Junioren B1")).toBeNull();
  });
});
