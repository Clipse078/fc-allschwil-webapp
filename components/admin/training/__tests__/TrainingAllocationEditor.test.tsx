/**
 * @vitest-environment jsdom
 *
 * components/admin/training/__tests__/TrainingAllocationEditor.test.tsx
 *
 * TRAININGCENTER-01B — regression tests for the split allocation UX:
 *   - Spielfeld/Halle zuweisen
 *   - Garderobe zuweisen
 *   - optional Weitere Ressourcen
 *
 * Verifies the primary allocation flows (pitch/hall, dressing room), the
 * optional "Weitere Ressourcen" visibility rule, grouped display of
 * existing allocations, and that backend guardrail errors (duplicate /
 * archived) surface to the user without touching persistence.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrainingAllocationEditor } from "@/components/admin/training/TrainingAllocationEditor";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import type { TrainingAllocationDto } from "@/lib/training/types";

function makeAllocation(overrides: Partial<TrainingAllocationDto> = {}): TrainingAllocationDto {
  return {
    id: "alloc-1",
    tenantId: "tenant-1",
    trainingSeriesId: "series-1",
    facilityResourceId: "res-pitch-a",
    facilityResourceName: "Feld A ganz",
    facilityResourceCode: "PITCH_A_FULL",
    facilityResourceType: "FULL_PITCH",
    facilityId: "facility-1",
    facilityName: "Sportanlage Brüel",
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
    facilityName: "Sportanlage Brüel",
    resources: [
      { id: "res-pitch-a", name: "Feld A ganz", code: "PITCH_A_FULL", type: "FULL_PITCH", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
      { id: "res-pitch-b", name: "Feld B halb West", code: "PITCH_B_HW", type: "HALF_PITCH", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
      { id: "res-dressing-1", name: "Garderobe 1", code: "DR_1", type: "DRESSING_ROOM", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
    ],
  },
];

const FACILITY_GROUPS_WITH_OTHER: FacilityGroup[] = [
  {
    facilityId: "facility-1",
    facilityName: "Sportanlage Brüel",
    resources: [
      ...FACILITY_GROUPS[0].resources,
      { id: "res-other-1", name: "Materialraum", code: "MAT_1", type: "OTHER", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
    ],
  },
];

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

describe("TrainingAllocationEditor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders dedicated Spielfeld/Halle and Garderobe selectors, without a Weitere Ressourcen section when there are no OTHER resources", () => {
    render(
      <TrainingAllocationEditor
        trainingSeriesId="series-1"
        trainingSeriesTitle="U13 Training"
        initialAllocations={[]}
        facilityGroups={FACILITY_GROUPS}
        canManage
      />,
    );

    expect(screen.getByText("Spielfeld / Halle zuweisen")).toBeInTheDocument();
    expect(screen.getByText("Garderobe zuweisen")).toBeInTheDocument();
    expect(screen.queryByText("Weitere Ressourcen")).not.toBeInTheDocument();
  });

  it("shows the optional Weitere Ressourcen section only when OTHER-type resources exist", () => {
    render(
      <TrainingAllocationEditor
        trainingSeriesId="series-1"
        trainingSeriesTitle="U13 Training"
        initialAllocations={[]}
        facilityGroups={FACILITY_GROUPS_WITH_OTHER}
        canManage
      />,
    );

    expect(screen.getByText("Weitere Ressourcen")).toBeInTheDocument();
  });

  it("allocates a pitch/hall resource via the dedicated Spielfeld/Halle selector", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ allocation: makeAllocation() }, 201),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TrainingAllocationEditor
        trainingSeriesId="series-1"
        trainingSeriesTitle="U13 Training"
        initialAllocations={[]}
        facilityGroups={FACILITY_GROUPS}
        canManage
      />,
    );

    const pitchSelect = screen.getByTestId("training-allocation-add-pitch-hall-select");
    fireEvent.change(pitchSelect, { target: { value: "res-pitch-a" } });
    fireEvent.click(screen.getByTestId("training-allocation-add-pitch-hall-add-button"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/training-series/series-1/allocations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ facilityResourceId: "res-pitch-a" }),
      }),
    );

    const pitchGroup = await screen.findByTestId("training-allocations-pitch-hall");
    expect(within(pitchGroup).getByText("Feld A ganz")).toBeInTheDocument();

    // The dressing-room selector is unaffected by a pitch/hall allocation.
    expect(screen.getByTestId("training-allocation-add-dressing-room-select")).toBeInTheDocument();
  });

  it("allocates a dressing room via the dedicated Garderobe selector", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          allocation: makeAllocation({
            id: "alloc-2",
            facilityResourceId: "res-dressing-1",
            facilityResourceName: "Garderobe 1",
            facilityResourceCode: "DR_1",
            facilityResourceType: "DRESSING_ROOM",
          }),
        },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TrainingAllocationEditor
        trainingSeriesId="series-1"
        trainingSeriesTitle="U13 Training"
        initialAllocations={[]}
        facilityGroups={FACILITY_GROUPS}
        canManage
      />,
    );

    const dressingSelect = screen.getByTestId("training-allocation-add-dressing-room-select");
    fireEvent.change(dressingSelect, { target: { value: "res-dressing-1" } });
    fireEvent.click(screen.getByTestId("training-allocation-add-dressing-room-add-button"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const dressingGroup = await screen.findByTestId("training-allocations-dressing-room");
    expect(within(dressingGroup).getByText("Garderobe 1")).toBeInTheDocument();
  });

  it("allocates an OTHER resource via the optional Weitere Ressourcen selector", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          allocation: makeAllocation({
            id: "alloc-3",
            facilityResourceId: "res-other-1",
            facilityResourceName: "Materialraum",
            facilityResourceCode: "MAT_1",
            facilityResourceType: "OTHER",
          }),
        },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TrainingAllocationEditor
        trainingSeriesId="series-1"
        trainingSeriesTitle="U13 Training"
        initialAllocations={[]}
        facilityGroups={FACILITY_GROUPS_WITH_OTHER}
        canManage
      />,
    );

    const otherSelect = screen.getByTestId("training-allocation-add-other-select");
    fireEvent.change(otherSelect, { target: { value: "res-other-1" } });
    fireEvent.click(screen.getByTestId("training-allocation-add-other-add-button"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const otherGroup = await screen.findByTestId("training-allocations-other");
    expect(within(otherGroup).getByText("Materialraum")).toBeInTheDocument();
  });

  it("surfaces a duplicate-allocation guard error under the relevant selector without mutating local state", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ error: "FacilityResource already allocated" }, 409),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TrainingAllocationEditor
        trainingSeriesId="series-1"
        trainingSeriesTitle="U13 Training"
        initialAllocations={[]}
        facilityGroups={FACILITY_GROUPS}
        canManage
      />,
    );

    fireEvent.change(screen.getByTestId("training-allocation-add-pitch-hall-select"), {
      target: { value: "res-pitch-a" },
    });
    fireEvent.click(screen.getByTestId("training-allocation-add-pitch-hall-add-button"));

    expect(await screen.findByRole("alert")).toHaveTextContent("FacilityResource already allocated");
    expect(screen.queryByTestId("training-allocations-pitch-hall")).not.toBeInTheDocument();
  });

  it("surfaces an archived-resource guard error without mutating local state", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ error: "FacilityResource is archived and cannot receive new allocations" }, 422),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TrainingAllocationEditor
        trainingSeriesId="series-1"
        trainingSeriesTitle="U13 Training"
        initialAllocations={[]}
        facilityGroups={FACILITY_GROUPS}
        canManage
      />,
    );

    fireEvent.change(screen.getByTestId("training-allocation-add-dressing-room-select"), {
      target: { value: "res-dressing-1" },
    });
    fireEvent.click(screen.getByTestId("training-allocation-add-dressing-room-add-button"));

    expect(await screen.findByRole("alert")).toHaveTextContent("archived");
    expect(screen.queryByTestId("training-allocations-dressing-room")).not.toBeInTheDocument();
  });

  it("groups already-assigned resources visually by Spielfeld/Halle, Garderobe, and Weitere Ressourcen", () => {
    render(
      <TrainingAllocationEditor
        trainingSeriesId="series-1"
        trainingSeriesTitle="U13 Training"
        initialAllocations={[
          makeAllocation({ id: "a1", facilityResourceId: "res-pitch-a" }),
          makeAllocation({
            id: "a2",
            facilityResourceId: "res-dressing-1",
            facilityResourceName: "Garderobe 1",
            facilityResourceType: "DRESSING_ROOM",
          }),
          makeAllocation({
            id: "a3",
            facilityResourceId: "res-other-1",
            facilityResourceName: "Materialraum",
            facilityResourceType: "OTHER",
          }),
        ]}
        facilityGroups={FACILITY_GROUPS_WITH_OTHER}
        canManage
      />,
    );

    const pitchGroup = screen.getByTestId("training-allocations-pitch-hall");
    expect(within(pitchGroup).getByText("Feld A ganz")).toBeInTheDocument();

    const dressingGroup = screen.getByTestId("training-allocations-dressing-room");
    expect(within(dressingGroup).getByText("Garderobe 1")).toBeInTheDocument();

    const otherGroup = screen.getByTestId("training-allocations-other");
    expect(within(otherGroup).getByText("Materialraum")).toBeInTheDocument();
  });

  it("hides the add-resource selectors entirely when the user cannot manage allocations", () => {
    render(
      <TrainingAllocationEditor
        trainingSeriesId="series-1"
        trainingSeriesTitle="U13 Training"
        initialAllocations={[]}
        facilityGroups={FACILITY_GROUPS}
        canManage={false}
      />,
    );

    expect(screen.queryByText("Spielfeld / Halle zuweisen")).not.toBeInTheDocument();
    expect(screen.queryByText("Garderobe zuweisen")).not.toBeInTheDocument();
  });

  it("shows a 'no resources configured' message for a group with zero resources of that type", () => {
    const groupsWithoutDressingRoom: FacilityGroup[] = [
      {
        facilityId: "facility-1",
        facilityName: "Sportanlage Brüel",
        resources: [
          { id: "res-pitch-a", name: "Feld A ganz", code: "PITCH_A_FULL", type: "FULL_PITCH", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
        ],
      },
    ];

    render(
      <TrainingAllocationEditor
        trainingSeriesId="series-1"
        trainingSeriesTitle="U13 Training"
        initialAllocations={[]}
        facilityGroups={groupsWithoutDressingRoom}
        canManage
      />,
    );

    expect(screen.getByTestId("training-allocation-add-dressing-room-no-resources")).toBeInTheDocument();
  });
});
