/**
 * @vitest-environment jsdom
 *
 * components/admin/training/__tests__/TrainingSeriesCockpitRow.test.tsx
 *
 * TRAININGCENTER-EDIT-01E — direct Link navigation for series edit + single exception.
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
    rowKey: "series-123:WEDNESDAY",
    seriesId: "series-123",
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

describe("TrainingSeriesCockpitRow — series edit link", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it("renders a direct link to the series edit route on the row", () => {
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

    const editLink = screen.getByTestId("training-series-cockpit-edit-series-123:WEDNESDAY");
    expect(editLink.tagName).toBe("A");
    expect(editLink.getAttribute("href")).toBe("/dashboard/training/series/series-123/edit");
    const href = editLink.getAttribute("href") ?? "";
    expect(href).not.toContain("{seriesId}");
    expect(href).not.toContain("%7BseriesId%7D");
  });

  it("does not render series edit in the overflow menu", () => {
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

    fireEvent.click(screen.getByTestId("training-series-cockpit-menu-series-123:WEDNESDAY"));
    expect(screen.queryByText("Serie bearbeiten")).toBeNull();
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

    expect(screen.queryByTestId("training-series-cockpit-exceptions-series-123:WEDNESDAY")).toBeNull();
  });

  it("links directly to the session edit page when there is exactly one exception", () => {
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

    const exceptionLink = screen.getByTestId("training-series-cockpit-exceptions-series-123:WEDNESDAY");
    expect(exceptionLink).toHaveTextContent("1 Ausnahme");
    expect(exceptionLink.tagName).toBe("A");
    expect(exceptionLink.getAttribute("href")).toBe("/dashboard/training/sessions/session-1/edit");
    const href = exceptionLink.getAttribute("href") ?? "";
    expect(href).not.toContain("{sessionId}");
    expect(href).not.toContain("%7BsessionId%7D");
  });

  it("shows a popover list with link items when there are multiple exceptions", () => {
    render(
      <TrainingSeriesCockpitRow
        row={makeRow({
          occurrenceExceptions: {
            occurrenceExceptionCount: 2,
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
              {
                sessionId: "session-2",
                date: "2026-09-09",
                startsAt: "18:45",
                endsAt: "20:15",
                overrides: [
                  {
                    group: "PITCH_HALL",
                    groupLabel: "Spielfeld",
                    effectiveResourceName: "Kunstrasen 2 B",
                    seriesDefaultResourceName: "Kunstrasen 3 A",
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

    const exceptionButton = screen.getByTestId("training-series-cockpit-exceptions-series-123:WEDNESDAY");
    expect(exceptionButton).toHaveTextContent("2 Ausnahmen");
    expect(exceptionButton.tagName).toBe("BUTTON");

    fireEvent.click(exceptionButton);
    expect(screen.getByText(/Serien-Standard: E3/)).toBeTruthy();
    expect(screen.getByText(/Garderobe: O4/)).toBeTruthy();

    const sessionLink = screen.getByTestId("training-series-cockpit-exception-item-session-1");
    expect(sessionLink.tagName).toBe("A");
    expect(sessionLink.getAttribute("href")).toBe("/dashboard/training/sessions/session-1/edit");
  });
});
