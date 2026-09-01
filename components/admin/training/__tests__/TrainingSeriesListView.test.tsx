/**
 * @vitest-environment jsdom
 *
 * components/admin/training/__tests__/TrainingSeriesListView.test.tsx
 *
 * TRAINING-SERIES-PREMIUM-01 — weekday cockpit + ADMIN-DELETE-02A-C1 regressions.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrainingSeriesListView from "@/components/admin/training/TrainingSeriesListView";
import type { TrainingSeriesCockpitRow } from "@/lib/training/series-cockpit";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function makeRow(overrides: Partial<TrainingSeriesCockpitRow> = {}): TrainingSeriesCockpitRow {
  return {
    rowKey: "series-1:MONDAY",
    seriesId: "series-1",
    teamSeasonId: "team-season-1",
    teamDisplayName: "Junioren E1",
    weekday: "MONDAY",
    startsAt: "17:15",
    endsAt: "18:45",
    title: "Junioren E1 Training",
    status: "ACTIVE",
    planningStage: "APPROVED",
    validFrom: null,
    validUntil: null,
    timezone: "Europe/Zurich",
    seriesWeekdaySchedules: [{ weekday: "MONDAY", startsAt: "17:15", endsAt: "18:45" }],
    sessionCount: 8,
    pitchName: "Kunstrasen 2 A",
    dressingRoomName: "O4",
    pitchAllocationId: "alloc-pitch",
    dressingRoomAllocationId: "alloc-room",
    pitchResourceId: "res-pitch",
    dressingRoomResourceId: "res-room",
    ...overrides,
  };
}

const facilityGroups = [
  {
    facilityId: "facility-1",
    facilityName: "Sportanlage",
    facilityType: "SPORTANLAGE",
    resources: [{ id: "res-pitch", name: "Kunstrasen 2 A", code: "KR2A", type: "HALF_PITCH", facilityId: "facility-1", facilityName: "Sportanlage", facilityType: "SPORTANLAGE" }],
  },
];

describe("TrainingSeriesListView — weekday cockpit", () => {
  it("groups rows by weekday with time, pitch and dressing room visible", () => {
    render(
      <TrainingSeriesListView
        cockpitRows={[
          makeRow(),
          makeRow({
            rowKey: "series-2:TUESDAY",
            seriesId: "series-2",
            weekday: "TUESDAY",
            title: "Junioren D-7 D1 Training",
            pitchName: "Kunstrasen 3 B",
            dressingRoomName: "E4",
          }),
        ]}
        showArchived={false}
        archivedCount={0}
        canManage={true}
        canDelete={false}
        pitchFacilityGroups={facilityGroups}
        dressingRoomFacilityGroups={facilityGroups}
      />,
    );

    expect(screen.getByTestId("training-series-weekday-group-MONDAY")).toBeTruthy();
    expect(screen.getByTestId("training-series-weekday-group-TUESDAY")).toBeTruthy();
    expect(screen.getByTestId("training-series-cockpit-time-series-1:MONDAY")).toBeTruthy();
    expect(screen.getByTestId("training-series-cockpit-time-series-2:TUESDAY")).toBeTruthy();
    expect(screen.getByText("Kunstrasen 2 A")).toBeTruthy();
    expect(screen.getByText("O4")).toBeTruthy();
    expect(screen.getByText("Kunstrasen 3 B")).toBeTruthy();
    expect(screen.getByText("E4")).toBeTruthy();
  });

  it("does not render a duplicate Neue Trainingsserie CTA inside the cockpit content", () => {
    render(
      <TrainingSeriesListView
        cockpitRows={[makeRow()]}
        showArchived={false}
        archivedCount={0}
        canManage={true}
        canDelete={false}
        pitchFacilityGroups={facilityGroups}
        dressingRoomFacilityGroups={facilityGroups}
      />,
    );

    expect(screen.queryByText("Neue Trainingsserie")).toBeNull();
  });

  it("does not show redundant Ressourcen/Bearbeiten top-level actions", () => {
    render(
      <TrainingSeriesListView
        cockpitRows={[makeRow()]}
        showArchived={false}
        archivedCount={0}
        canManage={true}
        canDelete={false}
        pitchFacilityGroups={facilityGroups}
        dressingRoomFacilityGroups={facilityGroups}
      />,
    );

    expect(screen.queryByText("Ressourcen")).toBeNull();
    expect(screen.queryByText("Bearbeiten")).toBeNull();
  });
});

describe("TrainingSeriesListView — ADMIN-DELETE-02A-C1 root-cause fix", () => {
  it("shows the delete action for a trainings.delete-only caller via overflow menu", () => {
    render(
      <TrainingSeriesListView
        cockpitRows={[makeRow()]}
        showArchived={false}
        archivedCount={0}
        canManage={false}
        canDelete={true}
        pitchFacilityGroups={facilityGroups}
        dressingRoomFacilityGroups={facilityGroups}
      />,
    );

    fireEvent.click(screen.getByTestId("training-series-cockpit-menu-series-1:MONDAY"));
    expect(screen.getByTestId("training-series-delete-inline")).toBeTruthy();
  });

  it("ADMIN-DELETE-02A-C2: surfaces 'Archiv anzeigen' when there are zero active rows and one archived series", () => {
    render(
      <TrainingSeriesListView
        cockpitRows={[]}
        showArchived={false}
        archivedCount={1}
        canManage={false}
        canDelete={true}
        pitchFacilityGroups={facilityGroups}
        dressingRoomFacilityGroups={facilityGroups}
      />,
    );

    expect(screen.getByText("Keine aktiven Trainingsserien")).toBeTruthy();
    expect(screen.getAllByText("Archiv anzeigen").length).toBeGreaterThan(0);
    expect(screen.queryByText("Neue Trainingsserie")).toBeNull();
  });
});
