/**
 * @vitest-environment jsdom
 *
 * components/admin/training/__tests__/TrainingSessionAllocationEditor.revert.test.tsx
 *
 * TRAININGCENTER-EDIT-01B — per-group Serien-Standard revert isolation.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrainingSessionAllocationEditor } from "@/components/admin/training/TrainingSessionAllocationEditor";
import type { TrainingAllocationDto, TrainingSessionAllocationDto } from "@/lib/training/types";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

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

const seriesAllocations: TrainingAllocationDto[] = [
  {
    id: "series-pitch",
    tenantId: "tenant-1",
    trainingSeriesId: "series-1",
    facilityResourceId: "res-pitch-a",
    facilityResourceName: "Kunstrasen 3 A",
    facilityResourceCode: "KR3A",
    facilityResourceType: "HALF_PITCH",
    facilityId: "facility-1",
    facilityName: "Sportanlage",
    notes: null,
    displayOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "series-dressing",
    tenantId: "tenant-1",
    trainingSeriesId: "series-1",
    facilityResourceId: "res-dressing-e3",
    facilityResourceName: "E3",
    facilityResourceCode: "E3",
    facilityResourceType: "DRESSING_ROOM",
    facilityId: "facility-1",
    facilityName: "Sportanlage",
    notes: null,
    displayOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const initialAllocations: TrainingSessionAllocationDto[] = [
  {
    id: "override-pitch",
    tenantId: "tenant-1",
    trainingSessionId: "session-1",
    facilityResourceId: "res-pitch-b",
    facilityResourceName: "Kunstrasen 3 B",
    facilityResourceCode: "KR3B",
    facilityResourceType: "HALF_PITCH",
    facilityId: "facility-1",
    facilityName: "Sportanlage",
    notes: null,
    displayOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "override-dressing",
    tenantId: "tenant-1",
    trainingSessionId: "session-1",
    facilityResourceId: "res-dressing-o4",
    facilityResourceName: "O4",
    facilityResourceCode: "O4",
    facilityResourceType: "DRESSING_ROOM",
    facilityId: "facility-1",
    facilityName: "Sportanlage",
    notes: null,
    displayOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

describe("TrainingSessionAllocationEditor — Serien-Standard verwenden", () => {
  const deleteMock = vi.fn();

  beforeEach(() => {
    deleteMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          deleteMock(url);
          return Promise.resolve(jsonResponse({}));
        }
        if (url.startsWith("/api/facilities/availability")) {
          return Promise.resolve(jsonResponse({ availability: [] }));
        }
        return Promise.resolve(jsonResponse({}));
      }),
    );
  });

  it("shows series default alongside an occurrence override", () => {
    render(
      <TrainingSessionAllocationEditor
        sessionId="session-1"
        initialAllocations={initialAllocations}
        seriesAllocations={seriesAllocations}
        facilityGroups={FACILITY_GROUPS}
        canManage={true}
        sessionStartAt="2026-09-02T16:45:00.000Z"
        sessionEndAt="2026-09-02T18:15:00.000Z"
      />,
    );

    expect(screen.getByTestId("training-session-allocations-dressing-room-series-default")).toHaveTextContent(
      "Serien-Standard: E3",
    );
  });

  it("reverts only the dressing-room override and keeps pitch override intact", async () => {
    render(
      <TrainingSessionAllocationEditor
        sessionId="session-1"
        initialAllocations={initialAllocations}
        seriesAllocations={seriesAllocations}
        facilityGroups={FACILITY_GROUPS}
        canManage={true}
        sessionStartAt="2026-09-02T16:45:00.000Z"
        sessionEndAt="2026-09-02T18:15:00.000Z"
      />,
    );

    fireEvent.click(screen.getByTestId("training-session-allocations-dressing-room-use-default"));

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(deleteMock).toHaveBeenCalledWith("/api/training-sessions/session-1/allocations/override-dressing");
    });

    expect(screen.getByText("Kunstrasen 3 B")).toBeTruthy();
  });

  it("reverts only the pitch override and keeps dressing-room override intact", async () => {
    render(
      <TrainingSessionAllocationEditor
        sessionId="session-1"
        initialAllocations={initialAllocations}
        seriesAllocations={seriesAllocations}
        facilityGroups={FACILITY_GROUPS}
        canManage={true}
        sessionStartAt="2026-09-02T16:45:00.000Z"
        sessionEndAt="2026-09-02T18:15:00.000Z"
      />,
    );

    fireEvent.click(screen.getByTestId("training-session-allocations-pitch-hall-use-default"));

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(deleteMock).toHaveBeenCalledWith("/api/training-sessions/session-1/allocations/override-pitch");
    });

    expect(screen.getByTestId("training-session-allocations-dressing-room")).toHaveTextContent("O4");
  });
});
