/**
 * @vitest-environment jsdom
 *
 * components/admin/matchcenter/__tests__/MatchCreateForm.test.tsx
 *
 * PLANNING-CREATION-UX-01C — focused tests for the guided MatchCenter
 * creation flow: guided-progress nudge, HOME live Spielfeld/Halle +
 * Garderobe availability, AWAY hides facility sections entirely, Gegner
 * directory selection prefills the editable opponent name, and submission
 * sequences Event creation + operational-fields PATCH.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MatchCreateForm from "@/components/admin/matchcenter/MatchCreateForm";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
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
      { id: "res-dr-1", name: "Garderobe 1", code: "DR_1", type: "DRESSING_ROOM", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
      { id: "res-dr-2", name: "Garderobe 2", code: "DR_2", type: "DRESSING_ROOM", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
    ],
  },
];

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

function installFetchMock() {
  const availabilityCalls: string[] = [];
  const patchCalls: { url: string; body: unknown }[] = [];

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/seasons") {
      return jsonResponse({ seasons: [{ id: "season-1", key: "2025-2026", name: "Saison 2025/2026", isActive: true }] });
    }
    if (url === "/api/teams") {
      return jsonResponse([{ id: "team-1", name: "1. Mannschaft", ageGroup: null, genderGroup: null, isActive: true }]);
    }
    if (url === "/api/club-directory/teams") {
      return jsonResponse({
        teams: [
          { id: "ext-1", name: "FC Concordia Basel", categoryLabel: null, externalClub: { id: "club-1", name: "FC Concordia Basel" } },
        ],
      });
    }
    if (url.startsWith("/api/facilities/availability")) {
      availabilityCalls.push(url);
      if (url.includes("group=PITCH_HALL")) {
        return jsonResponse({
          availability: [{ resourceId: "res-pitch-a", status: "FREE", conflictLabel: null, conflictStartAt: null, conflictEndAt: null }],
        });
      }
      return jsonResponse({
        availability: [
          { resourceId: "res-dr-1", status: "FREE", conflictLabel: null, conflictStartAt: null, conflictEndAt: null },
          {
            resourceId: "res-dr-2",
            status: "OCCUPIED",
            conflictLabel: "Training E2",
            conflictStartAt: "2026-09-20T17:00:00.000Z",
            conflictEndAt: "2026-09-20T18:00:00.000Z",
          },
        ],
      });
    }
    if (url === "/api/events" && init?.method === "POST") {
      return jsonResponse({ eventIds: ["event-1"], reviewStage: "APPROVED", allowsDirectExecution: true }, 201);
    }
    if (url === "/api/matchcenter/event-1" && init?.method === "PATCH") {
      patchCalls.push({ url, body: init.body ? JSON.parse(String(init.body)) : null });
      return jsonResponse({ id: "event-1" });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, availabilityCalls, patchCalls };
}

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockClear();
  refreshMock.mockClear();
});

describe("MatchCreateForm — guided-progress nudge", () => {
  it("lists missing items and shrinks as fields are filled", async () => {
    installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    const progress = await screen.findByTestId("match-create-guided-progress");
    expect(progress).toHaveTextContent("Team auswählen");
    expect(progress).toHaveTextContent("Gegner angeben");
    expect(progress).toHaveTextContent("Termin angeben");

    await waitFor(() => expect(screen.getByTestId("match-create-team-select")).not.toBeDisabled());
    fireEvent.change(screen.getByTestId("match-create-team-select"), { target: { value: "team-1" } });

    await waitFor(() => expect(screen.getByTestId("match-create-guided-progress")).not.toHaveTextContent("Team auswählen"));
  });

  it("nudges Spielfeld/Halle and Garderobe only for HOME once a Termin is set", async () => {
    installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    fireEvent.change(screen.getByTestId("match-create-start-at"), { target: { value: "2026-09-20T10:00" } });
    await waitFor(() =>
      expect(screen.getByTestId("match-create-guided-progress")).toHaveTextContent("Spielfeld / Halle zuweisen"),
    );

    fireEvent.click(screen.getByTestId("match-create-home-away-away"));
    await waitFor(() =>
      expect(screen.getByTestId("match-create-guided-progress")).not.toHaveTextContent("Spielfeld / Halle zuweisen"),
    );
  });
});

describe("MatchCreateForm — HOME/AWAY facility availability", () => {
  it("HOME: fetches and displays live Frei/Belegt availability once Termin is set", async () => {
    installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    fireEvent.change(screen.getByTestId("match-create-start-at"), { target: { value: "2026-09-20T10:00" } });

    // PLANNING-RESOURCE-UX-01: visual picker replaces dropdown.
    // Verify Frei/Belegt states are shown in the visual resource cards.
    await waitFor(() => {
      expect(screen.getByText("Kunstrasen 2")).toBeInTheDocument();
      // Multiple "Frei" badges may appear (pitch + dressing rooms)
      expect(screen.getAllByText("Frei").length).toBeGreaterThan(0);
    });
  });

  it("AWAY: never calls the availability endpoint and hides Spielfeld/Halle + Garderobe sections", async () => {
    const { availabilityCalls } = installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    fireEvent.click(screen.getByTestId("match-create-home-away-away"));
    fireEvent.change(screen.getByTestId("match-create-start-at"), { target: { value: "2026-09-20T10:00" } });

    // Visual picker cards are not shown for AWAY matches
    expect(screen.queryByTestId("match-create-pitch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("match-create-home-dressing-room")).not.toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(availabilityCalls).toHaveLength(0);
  });
});

describe("MatchCreateForm — Gegner (Club Directory)", () => {
  it("prefills the editable opponent display name from the directory selection", async () => {
    installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    await waitFor(() => expect(screen.getByTestId("match-create-opponent-directory-select")).not.toBeDisabled());
    fireEvent.change(screen.getByTestId("match-create-opponent-directory-select"), { target: { value: "ext-1" } });

    const nameInput = screen.getByTestId("match-create-opponent-name") as HTMLInputElement;
    expect(nameInput.value).toBe("FC Concordia Basel");

    fireEvent.change(nameInput, { target: { value: "FCC Basel (Freundschaftsspiel)" } });
    expect(nameInput.value).toBe("FCC Basel (Freundschaftsspiel)");
  });
});

describe("MatchCreateForm — submission lifecycle copy + orchestration", () => {
  it("shows direct-validation copy and creates the Event + operational-fields PATCH for HOME", async () => {
    const { patchCalls } = installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    expect(screen.getByTestId("match-create-submit")).toHaveTextContent("Freigeben & Match erstellen");

    await waitFor(() => expect(screen.getByTestId("match-create-team-select")).not.toBeDisabled());
    fireEvent.change(screen.getByTestId("match-create-team-select"), { target: { value: "team-1" } });
    fireEvent.change(screen.getByTestId("match-create-opponent-name"), { target: { value: "FC Concordia Basel" } });
    fireEvent.change(screen.getByTestId("match-create-start-at"), { target: { value: "2026-09-20T10:00" } });

    // PLANNING-RESOURCE-UX-01: visual picker card replaces the dropdown.
    // Click the "Kunstrasen 2" pitch card to select it.
    await waitFor(() => expect(screen.getByTestId("match-create-pitch-card-res-pitch-a")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("match-create-pitch-card-res-pitch-a"));

    fireEvent.click(screen.getByTestId("match-create-submit"));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/matchcenter?submitted=1"));
    expect(patchCalls).toEqual([{ url: "/api/matchcenter/event-1", body: { pitchCode: "KUNSTRASEN_2", homeDressingRoomCode: null, awayDressingRoomCode: null } }]);
  });

  it("shows submit-for-review copy when the actor cannot validate directly", async () => {
    installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly={false} />);

    expect(screen.getByTestId("match-create-submit")).toHaveTextContent("Zur Prüfung einreichen");
    expect(screen.getByTestId("match-create-validation-note")).toHaveTextContent("zur Prüfung eingereicht");
  });

  it("AWAY: creates the Event without any operational-fields PATCH", async () => {
    const { patchCalls } = installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    fireEvent.click(screen.getByTestId("match-create-home-away-away"));

    await waitFor(() => expect(screen.getByTestId("match-create-team-select")).not.toBeDisabled());
    fireEvent.change(screen.getByTestId("match-create-team-select"), { target: { value: "team-1" } });
    fireEvent.change(screen.getByTestId("match-create-opponent-name"), { target: { value: "FC Concordia Basel" } });
    fireEvent.change(screen.getByTestId("match-create-start-at"), { target: { value: "2026-09-20T10:00" } });

    fireEvent.click(screen.getByTestId("match-create-submit"));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/matchcenter?submitted=1"));
    expect(patchCalls).toHaveLength(0);
  });
});
