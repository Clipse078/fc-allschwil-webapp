/**
 * @vitest-environment jsdom
 *
 * components/admin/tournamentcenter/__tests__/TournamentCreateForm.availability.test.tsx
 *
 * PLANNING-CREATION-UX-01A — focused tests for the guided-creation nudge
 * summary and live Spielfeld/Halle + Garderobe availability wired into
 * TournamentCreateForm:
 *   - HOME shows availability (Frei/Belegt annotations fetched + rendered)
 *   - AWAY hides facility availability (no fetch, no facility sections)
 *   - missing-state summary reacts to form changes
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TournamentCreateForm from "@/components/admin/tournamentcenter/TournamentCreateForm";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const PITCH_HALL_GROUPS: FacilityGroup[] = [
  {
    facilityId: "facility-1",
    facilityName: "Sportanlage Brüel",
    resources: [
      { id: "res-pitch-a", name: "Kunstrasen 2", code: "KUNSTRASEN_2", type: "FULL_PITCH", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
      { id: "res-pitch-b", name: "Kunstrasen 3 A", code: "KUNSTRASEN_3_A", type: "HALF_PITCH", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
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

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

function installFetchMock() {
  const availabilityCalls: string[] = [];

  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/seasons") {
      return jsonResponse({ seasons: [{ id: "season-1", key: "2025-2026", name: "Saison 2025/2026", isActive: true }] });
    }
    if (url === "/api/teams") {
      return jsonResponse([{ id: "team-1", name: "1. Mannschaft", ageGroup: null, genderGroup: null, isActive: true }]);
    }
    if (url === "/api/club-directory/clubs") {
      return jsonResponse({ clubs: [] });
    }
    if (url.startsWith("/api/facilities/availability")) {
      availabilityCalls.push(url);
      if (url.includes("group=PITCH_HALL")) {
        return jsonResponse({
          availability: [
            { resourceId: "res-pitch-a", status: "FREE", conflictLabel: null, conflictStartAt: null, conflictEndAt: null },
            {
              resourceId: "res-pitch-b",
              status: "OCCUPIED",
              conflictLabel: "Training E2",
              conflictStartAt: "2026-09-20T17:00:00.000Z",
              conflictEndAt: "2026-09-20T18:00:00.000Z",
            },
          ],
        });
      }
      return jsonResponse({ availability: [] });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, availabilityCalls };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("TournamentCreateForm — guided-progress nudge summary", () => {
  it("lists missing items and shrinks the list as fields are filled", async () => {
    installFetchMock();
    render(<TournamentCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} />);

    const progress = await screen.findByTestId("tournament-create-guided-progress");
    expect(progress).toHaveTextContent("Start angeben");
    expect(progress).toHaveTextContent("Mindestens ein teilnehmendes Team hinzufügen");

    fireEvent.change(screen.getByTestId("tournament-create-start-at"), { target: { value: "2026-09-20T10:00" } });
    await waitFor(() => expect(screen.getByTestId("tournament-create-guided-progress")).not.toHaveTextContent("Start angeben"));

    await waitFor(() => expect(screen.getByTestId("tournament-create-add-team-select")).not.toBeDisabled());
    fireEvent.change(screen.getByTestId("tournament-create-add-team-select"), { target: { value: "team-1" } });
    fireEvent.click(screen.getByTestId("tournament-create-add-team-button"));

    await waitFor(() =>
      expect(screen.getByTestId("tournament-create-guided-progress")).not.toHaveTextContent(
        "Mindestens ein teilnehmendes Team hinzufügen",
      ),
    );
  });

  it("shows a Spielfeld/Halle nudge for HOME once a start date exists but no resource is assigned", async () => {
    installFetchMock();
    render(<TournamentCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} />);

    fireEvent.change(screen.getByTestId("tournament-create-start-at"), { target: { value: "2026-09-20T10:00" } });

    await waitFor(() =>
      expect(screen.getByTestId("tournament-create-guided-progress")).toHaveTextContent("Spielfeld / Halle zuweisen"),
    );
  });
});

describe("TournamentCreateForm — HOME/AWAY facility availability", () => {
  it("HOME: fetches and displays live Frei/Belegt availability once Start is set", async () => {
    installFetchMock();
    render(<TournamentCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} />);

    fireEvent.change(screen.getByTestId("tournament-create-start-at"), { target: { value: "2026-09-20T10:00" } });

    // PLANNING-RESOURCE-UX-01: visual picker replaces dropdown.
    // Verify Frei/Belegt states are shown in the visual resource cards.
    await waitFor(() => {
      expect(screen.getByText("Kunstrasen 2")).toBeInTheDocument();
      expect(screen.getAllByText("Frei").length).toBeGreaterThan(0);
    });
  });

  it("AWAY: never calls the availability endpoint and hides the Spielfeld/Halle section", async () => {
    const { availabilityCalls } = installFetchMock();
    render(<TournamentCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} />);

    fireEvent.change(screen.getByTestId("tournament-create-home-away-select"), { target: { value: "AWAY" } });
    fireEvent.change(screen.getByTestId("tournament-create-start-at"), { target: { value: "2026-09-20T10:00" } });

    expect(screen.queryByTestId("tournament-create-resource")).not.toBeInTheDocument();
    expect(screen.getByTestId("tournament-create-guided-progress")).not.toHaveTextContent("Spielfeld / Halle zuweisen");

    // Give any stray effect a tick to fire before asserting it never called out.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(availabilityCalls).toHaveLength(0);
  });
});
