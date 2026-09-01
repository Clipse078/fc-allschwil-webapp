/**
 * @vitest-environment jsdom
 *
 * components/admin/training/__tests__/TrainingSeriesCockpitRow.test.tsx
 *
 * TRAININGCENTER-EDIT-01C — Serie bearbeiten navigation + exception indicator.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrainingSeriesCockpitRow from "@/components/admin/training/TrainingSeriesCockpitRow";
import type { TrainingSeriesCockpitRow as CockpitRow } from "@/lib/training/series-cockpit";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

function makeRow(overrides: Partial<CockpitRow> = {}): CockpitRow {
  return {
    rowKey: "series-1:WEDNESDAY",
    seriesId: "series-1",
    teamSeasonId: "team-season-1",
    teamDisplayName: "Junioren D-9 D1",
    weekday: "WEDNESDAY",
    startsAt: "18:45",
    endsAt: "20:15",
    title: "Junioren D-9 D1 Training",
    status: "ACTIVE",
    planningStage: "APPROVED",
    validFrom: null,
    validUntil: null,
    timezone: "Europe/Zurich",
    seriesWeekdaySchedules: [{ weekday: "WEDNESDAY", startsAt: "18:45", endsAt: "20:15" }],
    sessionCount: 8,
    pitchName: "Kunstrasen 3 A",
    dressingRoomName: "E3",
    pitchAllocationId: "alloc-pitch",
    dressingRoomAllocationId: "alloc-room",
    pitchResourceId: "res-pitch",
    dressingRoomResourceId: "res-room",
    occurrenceExceptions: { occurrenceExceptionCount: 0, exceptions: [] },
    ...overrides,
  };
}

const facilityGroups = [
  {
    facilityId: "facility-1",
    facilityName: "Sportanlage",
    facilityType: "SPORTANLAGE",
    resources: [
      {
        id: "res-pitch",
        name: "Kunstrasen 3 A",
        code: "KR3A",
        type: "HALF_PITCH",
        facilityId: "facility-1",
        facilityName: "Sportanlage",
        facilityType: "SPORTANLAGE",
      },
    ],
  },
];

describe("TrainingSeriesCockpitRow — Serie bearbeiten", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it("navigates to the existing series edit route from the overflow menu on pointer activation", () => {
    render(
      <TrainingSeriesCockpitRow
        row={makeRow()}
        canManage={true}
        canDelete={false}
        isCoordinator={true}
        pitchFacilityGroups={facilityGroups}
        dressingRoomFacilityGroups={facilityGroups}
      />,
    );

    fireEvent.click(screen.getByTestId("training-series-cockpit-menu-series-1:WEDNESDAY"));
    fireEvent.mouseDown(screen.getByTestId("training-series-cockpit-edit-series-1:WEDNESDAY"));

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/dashboard/training/series/series-1/edit");
  });

  it("navigates to the existing series edit route from the overflow menu on keyboard activation", () => {
    render(
      <TrainingSeriesCockpitRow
        row={makeRow()}
        canManage={true}
        canDelete={false}
        isCoordinator={true}
        pitchFacilityGroups={facilityGroups}
        dressingRoomFacilityGroups={facilityGroups}
      />,
    );

    fireEvent.click(screen.getByTestId("training-series-cockpit-menu-series-1:WEDNESDAY"));
    fireEvent.keyDown(screen.getByTestId("training-series-cockpit-edit-series-1:WEDNESDAY"), {
      key: "Enter",
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/dashboard/training/series/series-1/edit");
  });
});

describe("TrainingSeriesCockpitRow — occurrence exceptions", () => {
  it("does not render an exception indicator when count is zero", () => {
    render(
      <TrainingSeriesCockpitRow
        row={makeRow()}
        canManage={true}
        canDelete={false}
        isCoordinator={true}
        pitchFacilityGroups={facilityGroups}
        dressingRoomFacilityGroups={facilityGroups}
      />,
    );

    expect(screen.queryByTestId("training-series-cockpit-exceptions-series-1:WEDNESDAY")).toBeNull();
  });

  it("shows an occurrence-based exception badge and detail list", () => {
    render(
      <TrainingSeriesCockpitRow
        row={makeRow({
          occurrenceExceptions: {
            occurrenceExceptionCount: 1,
            exceptions: [
              {
                sessionId: "session-1",
                date: "2026-09-02",
                startsAt: "18:45",
                endsAt: "20:15",
                overrides: [
                  {
                    group: "DRESSING_ROOM",
                    groupLabel: "Garderobe",
                    effectiveResourceName: "O4",
                    seriesDefaultResourceName: "E3",
                  },
                ],
              },
            ],
          },
        })}
        canManage={true}
        canDelete={false}
        isCoordinator={true}
        pitchFacilityGroups={facilityGroups}
        dressingRoomFacilityGroups={facilityGroups}
      />,
    );

    expect(screen.getByTestId("training-series-cockpit-exceptions-series-1:WEDNESDAY")).toHaveTextContent("1 Ausnahme");
    fireEvent.click(screen.getByTestId("training-series-cockpit-exceptions-series-1:WEDNESDAY"));
    expect(screen.getByText(/Serien-Standard: E3/)).toBeTruthy();
    expect(screen.getByText(/Garderobe: O4/)).toBeTruthy();
  });

  it("opens the existing session edit page from an exception item", () => {
    render(
      <TrainingSeriesCockpitRow
        row={makeRow({
          occurrenceExceptions: {
            occurrenceExceptionCount: 1,
            exceptions: [
              {
                sessionId: "session-1",
                date: "2026-09-02",
                startsAt: "18:45",
                endsAt: "20:15",
                overrides: [
                  {
                    group: "DRESSING_ROOM",
                    groupLabel: "Garderobe",
                    effectiveResourceName: "O4",
                    seriesDefaultResourceName: "E3",
                  },
                ],
              },
            ],
          },
        })}
        canManage={true}
        canDelete={false}
        isCoordinator={true}
        pitchFacilityGroups={facilityGroups}
        dressingRoomFacilityGroups={facilityGroups}
      />,
    );

    fireEvent.click(screen.getByTestId("training-series-cockpit-exceptions-series-1:WEDNESDAY"));
    fireEvent.click(screen.getByTestId("training-series-cockpit-exception-item-session-1"));

    expect(pushMock).toHaveBeenCalledWith("/dashboard/training/sessions/session-1/edit");
  });
});
