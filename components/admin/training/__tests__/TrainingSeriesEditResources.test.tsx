/**
 * @vitest-environment jsdom
 *
 * TRAININGCENTER-EDIT-01F — series edit page resource editing via TrainingAllocationEditor.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrainingAllocationEditor } from "@/components/admin/training/TrainingAllocationEditor";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import type { TrainingAllocationDto } from "@/lib/training/types";

function makeAllocation(overrides: Partial<TrainingAllocationDto> = {}): TrainingAllocationDto {
  return {
    id: "alloc-pitch",
    tenantId: "tenant-1",
    trainingSeriesId: "series-123",
    facilityResourceId: "res-pitch-a",
    facilityResourceName: "Kunstrasen 3 A",
    facilityResourceCode: "KR3A",
    facilityResourceType: "HALF_PITCH",
    facilityId: "facility-1",
    facilityName: "Sportanlage",
    notes: null,
    displayOrder: 0,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

const FACILITY_GROUPS: FacilityGroup[] = [
  {
    facilityId: "facility-1",
    facilityName: "Sportanlage",
    resources: [
      {
        id: "res-pitch-a",
        name: "Kunstrasen 3 A",
        code: "KR3A",
        type: "HALF_PITCH",
        facilityId: "facility-1",
        facilityName: "Sportanlage",
      },
      {
        id: "res-pitch-b",
        name: "Kunstrasen 3 B",
        code: "KR3B",
        type: "HALF_PITCH",
        facilityId: "facility-1",
        facilityName: "Sportanlage",
      },
      {
        id: "res-dressing-e3",
        name: "E3",
        code: "E3",
        type: "DRESSING_ROOM",
        facilityId: "facility-1",
        facilityName: "Sportanlage",
      },
      {
        id: "res-dressing-o4",
        name: "O4",
        code: "O4",
        type: "DRESSING_ROOM",
        facilityId: "facility-1",
        facilityName: "Sportanlage",
      },
    ],
  },
];

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

function renderSeriesEditResources(initialAllocations: TrainingAllocationDto[]) {
  return render(
    <div data-testid="training-series-edit-resources-section">
      <TrainingAllocationEditor
        trainingSeriesId="series-123"
        trainingSeriesTitle="Junioren D-9 D1 Training"
        initialAllocations={initialAllocations}
        facilityGroups={FACILITY_GROUPS}
        canManage
        embedded
      />
    </div>,
  );
}

describe("TRAININGCENTER-EDIT-01F — series edit resources", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("receives and displays the existing series pitch allocation", () => {
    renderSeriesEditResources([
      makeAllocation(),
      makeAllocation({
        id: "alloc-dressing",
        facilityResourceId: "res-dressing-e3",
        facilityResourceName: "E3",
        facilityResourceCode: "E3",
        facilityResourceType: "DRESSING_ROOM",
      }),
    ]);

    const pitchGroup = screen.getByTestId("training-allocations-pitch-hall");
    expect(within(pitchGroup).getByText("Kunstrasen 3 A")).toBeInTheDocument();
  });

  it("receives and displays the existing series dressing-room allocation", () => {
    renderSeriesEditResources([
      makeAllocation(),
      makeAllocation({
        id: "alloc-dressing",
        facilityResourceId: "res-dressing-e3",
        facilityResourceName: "E3",
        facilityResourceCode: "E3",
        facilityResourceType: "DRESSING_ROOM",
      }),
    ]);

    const dressingGroup = screen.getByTestId("training-allocations-dressing-room");
    expect(within(dressingGroup).getByRole("listitem")).toHaveTextContent("E3");
  });

  it("changing pitch calls only the series allocation API for pitch resources", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 200))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            allocation: makeAllocation({
              id: "alloc-pitch-new",
              facilityResourceId: "res-pitch-b",
              facilityResourceName: "Kunstrasen 3 B",
              facilityResourceCode: "KR3B",
            }),
          },
          201,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderSeriesEditResources([
      makeAllocation(),
      makeAllocation({
        id: "alloc-dressing",
        facilityResourceId: "res-dressing-e3",
        facilityResourceName: "E3",
        facilityResourceCode: "E3",
        facilityResourceType: "DRESSING_ROOM",
      }),
    ]);

    const pitchGroup = screen.getByTestId("training-allocations-pitch-hall");
    fireEvent.click(within(pitchGroup).getByRole("button", { name: /Zuweisung von Kunstrasen 3 A entfernen/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/training-series/series-123/allocations/alloc-pitch",
      expect.objectContaining({ method: "DELETE" }),
    );

    const pitchSelect = screen.getByTestId("training-allocation-add-pitch-hall-select");
    fireEvent.change(pitchSelect, { target: { value: "res-pitch-b" } });
    fireEvent.click(screen.getByTestId("training-allocation-add-pitch-hall-add-button"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/training-series/series-123/allocations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ facilityResourceId: "res-pitch-b" }),
      }),
    );

    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("/training-sessions/"))).toBe(true);
    expect(within(screen.getByTestId("training-allocations-dressing-room")).getByRole("listitem")).toHaveTextContent("E3");
  });

  it("changing dressing room calls only the series allocation API for dressing-room resources", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 200))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            allocation: makeAllocation({
              id: "alloc-dressing-new",
              facilityResourceId: "res-dressing-o4",
              facilityResourceName: "O4",
              facilityResourceCode: "O4",
              facilityResourceType: "DRESSING_ROOM",
            }),
          },
          201,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderSeriesEditResources([
      makeAllocation(),
      makeAllocation({
        id: "alloc-dressing",
        facilityResourceId: "res-dressing-e3",
        facilityResourceName: "E3",
        facilityResourceCode: "E3",
        facilityResourceType: "DRESSING_ROOM",
      }),
    ]);

    const dressingGroup = screen.getByTestId("training-allocations-dressing-room");
    fireEvent.click(within(dressingGroup).getByRole("button", { name: /Zuweisung von E3 entfernen/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/training-series/series-123/allocations/alloc-dressing",
      expect.objectContaining({ method: "DELETE" }),
    );

    const dressingSelect = screen.getByTestId("training-allocation-add-dressing-room-select");
    fireEvent.change(dressingSelect, { target: { value: "res-dressing-o4" } });
    fireEvent.click(screen.getByTestId("training-allocation-add-dressing-room-add-button"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/training-series/series-123/allocations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ facilityResourceId: "res-dressing-o4" }),
      }),
    );

    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("/training-sessions/"))).toBe(true);
    expect(within(screen.getByTestId("training-allocations-pitch-hall")).getByText("Kunstrasen 3 A")).toBeInTheDocument();
  });

  it("series allocation edits never call occurrence session allocation endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 200));
    vi.stubGlobal("fetch", fetchMock);

    renderSeriesEditResources([
      makeAllocation(),
      makeAllocation({
        id: "alloc-dressing",
        facilityResourceId: "res-dressing-e3",
        facilityResourceName: "E3",
        facilityResourceCode: "E3",
        facilityResourceType: "DRESSING_ROOM",
      }),
    ]);

    fireEvent.click(
      within(screen.getByTestId("training-allocations-pitch-hall")).getByRole("button", {
        name: /Zuweisung von Kunstrasen 3 A entfernen/i,
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes("/training-series/series-123/allocations"))).toBe(
      true,
    );
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("/training-sessions/"))).toBe(true);
  });
});
