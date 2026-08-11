/**
 * @vitest-environment jsdom
 *
 * components/admin/tournamentcenter/__tests__/TournamentEditForm.availability.test.tsx
 *
 * RESOURCE-AVAILABILITY-UX-01 — focused test proving the Tournament EDIT
 * surface (Spielfeld/Halle allocations + per-participant Garderobe) renders
 * live Frei/Belegt availability, sourced from the SAME
 * lib/facilities/availability-service.ts foundation already wired into
 * TournamentCreateForm — and requests self-exclusion (excludeEventId) so
 * this tournament's own existing allocations are never flagged as a
 * conflict with itself.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TournamentEditForm from "@/components/admin/tournamentcenter/TournamentEditForm";
import type { TournamentDto } from "@/lib/tournaments/types";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: { success: vi.fn(), danger: vi.fn() } }),
}));

const PITCH_HALL_GROUPS: FacilityGroup[] = [
  {
    facilityId: "facility-1",
    facilityName: "Sportanlage Brüel",
    resources: [
      { id: "res-pitch-a", name: "Kunstrasen 2", code: "KUNSTRASEN_2", type: "FULL_PITCH", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
    ],
  },
];

const DRESSING_ROOM_GROUPS: FacilityGroup[] = [
  {
    facilityId: "facility-1",
    facilityName: "Sportanlage Brüel",
    resources: [
      { id: "res-dressing-1", name: "E1", code: "DR_1", type: "DRESSING_ROOM", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
    ],
  },
];

const TOURNAMENT: TournamentDto = {
  id: "tournament-1",
  tenantId: "tenant-a",
  title: "U13 Hallenturnier",
  description: null,
  status: "SCHEDULED",
  source: "MANUAL",
  startAt: "2026-09-20T09:00:00.000Z",
  endAt: "2026-09-20T12:00:00.000Z",
  meetingTime: null,
  location: null,
  organizerName: null,
  competitionLabel: null,
  resultLabel: null,
  remarks: null,
  season: { id: "season-1", key: "2025-2026", name: "Saison 2025/2026" },
  team: null,
  homeAway: "HOME",
  participants: [
    {
      id: "participant-1",
      tournamentId: "tournament-1",
      kind: "TEAM",
      displayName: "1. Mannschaft",
      team: { id: "team-1", name: "1. Mannschaft", slug: "1-mannschaft", category: "SENIOR", ageGroup: null, genderGroup: null },
      externalTeam: null,
      externalClub: null,
      manualLabel: null,
      displayOrder: 0,
      dressingRoomAllocations: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  resourceAllocations: [],
  visibility: {
    websiteVisible: true,
    infoboardVisible: false,
    homepageVisible: false,
    wochenplanVisible: false,
    teamPageVisible: false,
  },
  reviewStage: "DRAFT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

function installFetchMock() {
  const availabilityCalls: string[] = [];
  const fetchMock = vi.fn((url: string) => {
    if (url === "/api/teams") {
      return Promise.resolve(jsonResponse([]));
    }
    if (url.startsWith("/api/facilities/availability")) {
      availabilityCalls.push(url);
      if (url.includes("group=PITCH_HALL")) {
        return Promise.resolve(
          jsonResponse({
            availability: [
              {
                resourceId: "res-pitch-a",
                resourceCode: "KUNSTRASEN_2",
                status: "OCCUPIED",
                conflictLabel: "Match vs. FC Muttenz",
                conflictStartAt: "2026-09-20T10:00:00.000Z",
                conflictEndAt: "2026-09-20T11:00:00.000Z",
              },
            ],
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({
          availability: [
            { resourceId: "res-dressing-1", resourceCode: "DR_1", status: "FREE", conflictLabel: null, conflictStartAt: null, conflictEndAt: null },
          ],
        }),
      );
    }
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, availabilityCalls };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("TournamentEditForm — RESOURCE-AVAILABILITY-UX-01 availability", () => {
  it("renders live Frei/Belegt availability on the Spielfeld/Halle and Garderobe selectors", async () => {
    installFetchMock();

    render(
      <TournamentEditForm
        tournament={TOURNAMENT}
        canManage={true}
        pitchHallFacilityGroups={PITCH_HALL_GROUPS}
        dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS}
      />,
    );

    const pitchSelect = await screen.findByTestId("tournament-resource-allocation-add-select");
    await waitFor(() => {
      expect(pitchSelect.textContent).toContain("Kunstrasen 2");
      expect(pitchSelect.textContent).toContain("Belegt");
      expect(pitchSelect.textContent).toContain("Match vs. FC Muttenz");
    });

    const dressingRoomSelect = await screen.findByTestId(
      "tournament-participant-participant-1-dressing-room-select",
    );
    await waitFor(() => {
      expect(dressingRoomSelect.textContent).toContain("Frei");
    });
  });

  it("requests availability excluding this tournament's own id (self-exclusion in edit mode)", async () => {
    const { availabilityCalls } = installFetchMock();

    render(
      <TournamentEditForm
        tournament={TOURNAMENT}
        canManage={true}
        pitchHallFacilityGroups={PITCH_HALL_GROUPS}
        dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS}
      />,
    );

    await waitFor(() => expect(availabilityCalls.length).toBeGreaterThan(0));
    expect(availabilityCalls.every((url) => url.includes("excludeEventId=tournament-1"))).toBe(true);
  });

  it("recalculates availability when Start is edited", async () => {
    const { availabilityCalls } = installFetchMock();

    render(
      <TournamentEditForm
        tournament={TOURNAMENT}
        canManage={true}
        pitchHallFacilityGroups={PITCH_HALL_GROUPS}
        dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS}
      />,
    );

    await waitFor(() => expect(availabilityCalls.length).toBeGreaterThan(0));
    const initialCallCount = availabilityCalls.length;

    const startInputs = screen.getAllByDisplayValue("2026-09-20T09:00");
    fireEvent.change(startInputs[0]!, { target: { value: "2026-09-21T09:00" } });

    await waitFor(() => expect(availabilityCalls.length).toBeGreaterThan(initialCallCount));
    expect(availabilityCalls[availabilityCalls.length - 1]).toContain("startAt=2026-09-21T09%3A00");
  });

  it("never requests availability for an AWAY tournament", async () => {
    const { availabilityCalls } = installFetchMock();

    render(
      <TournamentEditForm
        tournament={{ ...TOURNAMENT, homeAway: "AWAY" }}
        canManage={true}
        pitchHallFacilityGroups={PITCH_HALL_GROUPS}
        dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("tournament-participants-editor")).toBeInTheDocument());
    expect(availabilityCalls).toHaveLength(0);
  });
});
