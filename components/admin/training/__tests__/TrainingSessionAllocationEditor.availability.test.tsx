/**
 * @vitest-environment jsdom
 *
 * components/admin/training/__tests__/TrainingSessionAllocationEditor.availability.test.tsx
 *
 * RESOURCE-AVAILABILITY-UX-01 — focused test proving the individual
 * TrainingSession edit surface renders live Frei/Belegt availability for
 * its pitch/hall + dressing-room selectors, and requests self-exclusion
 * (excludeTrainingSessionId) so this occurrence's own allocation is never
 * flagged as a conflict with itself.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrainingSessionAllocationEditor } from "@/components/admin/training/TrainingSessionAllocationEditor";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

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

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

function installFetchMock() {
  const availabilityCalls: string[] = [];
  const fetchMock = vi.fn((url: string) => {
    if (url.startsWith("/api/facilities/availability")) {
      availabilityCalls.push(url);
      if (url.includes("group=PITCH_HALL")) {
        return Promise.resolve(
          jsonResponse({
            availability: [
              { resourceId: "res-pitch-a", resourceCode: "PITCH_A_FULL", status: "FREE", conflictLabel: null, conflictStartAt: null, conflictEndAt: null },
              {
                resourceId: "res-pitch-b",
                resourceCode: "PITCH_B_HW",
                status: "OCCUPIED",
                conflictLabel: "Match vs. FC Muttenz",
                conflictStartAt: "2026-09-01T17:00:00.000Z",
                conflictEndAt: "2026-09-01T18:00:00.000Z",
              },
            ],
          }),
        );
      }
      return Promise.resolve(jsonResponse({ availability: [] }));
    }
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, availabilityCalls };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("TrainingSessionAllocationEditor — RESOURCE-AVAILABILITY-UX-01 availability", () => {
  it("renders live Frei/Belegt availability on the pitch/hall selector for this occurrence's own start/end", async () => {
    installFetchMock();

    render(
      <TrainingSessionAllocationEditor
        sessionId="session-1"
        initialAllocations={[]}
        seriesAllocations={[]}
        facilityGroups={FACILITY_GROUPS}
        canManage
        sessionStartAt="2026-09-01T16:00:00.000Z"
        sessionEndAt="2026-09-01T17:00:00.000Z"
      />,
    );

    const select = await screen.findByTestId("training-session-allocation-add-pitch-hall-select");

    await waitFor(() => {
      const optionTexts = within(select).getAllByRole("option").map((o) => o.textContent);
      expect(optionTexts.some((t) => t?.includes("Feld A ganz") && t?.includes("Frei"))).toBe(true);
      expect(
        optionTexts.some(
          (t) => t?.includes("Feld B halb West") && t?.includes("Belegt") && t?.includes("Match vs. FC Muttenz"),
        ),
      ).toBe(true);
    });
  });

  it("requests availability with excludeTrainingSessionId set to this occurrence's own id (self-exclusion in edit mode)", async () => {
    const { availabilityCalls } = installFetchMock();

    render(
      <TrainingSessionAllocationEditor
        sessionId="session-1"
        initialAllocations={[]}
        seriesAllocations={[]}
        facilityGroups={FACILITY_GROUPS}
        canManage
        sessionStartAt="2026-09-01T16:00:00.000Z"
        sessionEndAt="2026-09-01T17:00:00.000Z"
      />,
    );

    await waitFor(() => expect(availabilityCalls.length).toBeGreaterThan(0));
    expect(availabilityCalls.every((url) => url.includes("excludeTrainingSessionId=session-1"))).toBe(true);
  });
});
