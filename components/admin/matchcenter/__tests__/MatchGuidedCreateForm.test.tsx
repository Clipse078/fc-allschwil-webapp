/**
 * @vitest-environment jsdom
 *
 * components/admin/matchcenter/__tests__/MatchGuidedCreateForm.test.tsx
 *
 * PLANNING-CREATION-UX-01C — focused tests for the guided MatchCenter
 * creation form:
 *   - guided missing-state nudge reacts as fields are filled
 *   - HOME shows Spielfeld/Halle + Garderobe with live Frei/Belegt; AWAY hides them
 *   - submit creates the match via the EXISTING POST /api/events and (HOME
 *     only) attaches pitch/dressing-room codes via the EXISTING
 *     PATCH /api/matchcenter/[matchId]
 *   - submit label reflects the EXISTING review-decision outcome
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MatchGuidedCreateForm from "@/components/admin/matchcenter/MatchGuidedCreateForm";
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
    ],
  },
];

const DRESSING_ROOM_GROUPS: FacilityGroup[] = [
  {
    facilityId: "facility-1",
    facilityName: "Sportanlage Brüel",
    resources: [
      { id: "res-dressing-home", name: "Garderobe 1", code: "DR_1", type: "DRESSING_ROOM", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
      { id: "res-dressing-away", name: "Garderobe 2", code: "DR_2", type: "DRESSING_ROOM", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
    ],
  },
];

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

function installFetchMock() {
  const patchCalls: { url: string; body: unknown }[] = [];

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/teams") {
      return jsonResponse([{ id: "team-1", name: "E1", slug: "e1", category: "JUNIOREN", genderGroup: null, ageGroup: "E1", sortOrder: 0, isActive: true, websiteVisible: true, infoboardVisible: true, activeSeason: null }]);
    }
    if (url === "/api/seasons") {
      return jsonResponse({ currentSeasonKey: "2025-2026", nextSeasonKey: null, seasons: [{ id: "season-1", key: "2025-2026", name: "Saison 2025/2026", isActive: true, startDate: "2025-07-01", endDate: "2026-06-30" }] });
    }
    if (url === "/api/club-directory/teams") {
      return jsonResponse({ teams: [{ id: "ext-1", name: "FC Concordia Basel", shortName: null, categoryLabel: null, externalClub: { id: "club-1", name: "FC Concordia Basel", shortName: null } }] });
    }
    if (url.startsWith("/api/facilities/availability")) {
      if (url.includes("group=PITCH_HALL")) {
        return jsonResponse({ availability: [{ resourceId: "res-pitch-a", resourceName: "Kunstrasen 2", status: "FREE", conflictLabel: null, conflictStartAt: null, conflictEndAt: null }] });
      }
      return jsonResponse({
        availability: [
          { resourceId: "res-dressing-home", resourceName: "Garderobe 1", status: "FREE", conflictLabel: null, conflictStartAt: null, conflictEndAt: null },
          { resourceId: "res-dressing-away", resourceName: "Garderobe 2", status: "OCCUPIED", conflictLabel: "Training E2", conflictStartAt: "2026-09-22T17:00:00.000Z", conflictEndAt: "2026-09-22T18:00:00.000Z" },
        ],
      });
    }
    if (url === "/api/events") {
      return jsonResponse({ message: "ok", eventIds: ["event-1"], reviewStage: "APPROVED", occurrenceCount: 1, requiresReview: false, allowsDirectExecution: true }, 201);
    }
    if (url === "/api/matchcenter/event-1") {
      patchCalls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
      return jsonResponse({ id: "event-1" });
    }
    throw new Error(`Unexpected fetch call: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, patchCalls };
}

async function fillCommonFields() {
  await waitFor(() => expect(screen.getByTestId("match-create-team-select")).not.toBeDisabled());
  fireEvent.change(screen.getByTestId("match-create-team-select"), { target: { value: "team-1" } });
  fireEvent.change(screen.getByTestId("match-create-location"), { target: { value: "Sportplatz im Brüel" } });
  fireEvent.change(screen.getByTestId("match-create-opponent-name"), { target: { value: "FC Concordia Basel" } });
  fireEvent.change(screen.getByTestId("match-create-date"), { target: { value: "2026-09-22" } });
  fireEvent.change(screen.getByTestId("match-create-starts-at"), { target: { value: "17:00" } });
  fireEvent.change(screen.getByTestId("match-create-ends-at"), { target: { value: "19:00" } });
  await waitFor(() => expect(screen.getByTestId("match-create-pitch-select")).toBeInTheDocument());
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("MatchGuidedCreateForm — guided-progress nudge + Heim/Auswärts", () => {
  it("lists missing items and shrinks the list as fields are filled", async () => {
    installFetchMock();
    render(<MatchGuidedCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    const progress = screen.getByTestId("match-create-guided-progress");
    expect(progress).toHaveTextContent("Team auswählen");
    expect(progress).toHaveTextContent("Gegner angeben");

    await waitFor(() => expect(screen.getByTestId("match-create-team-select")).not.toBeDisabled());
    fireEvent.change(screen.getByTestId("match-create-team-select"), { target: { value: "team-1" } });
    await waitFor(() => expect(screen.getByTestId("match-create-guided-progress")).not.toHaveTextContent("Team auswählen"));
  });

  it("defaults to Heim and shows Spielfeld/Halle + Garderobe; Auswärts hides both", async () => {
    installFetchMock();
    render(<MatchGuidedCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    expect(screen.getByTestId("match-create-home")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("match-create-pitch-select")).toBeInTheDocument();
    expect(screen.getByTestId("match-create-home-dressing-select")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("match-create-away"));

    expect(screen.queryByTestId("match-create-pitch-select")).not.toBeInTheDocument();
    expect(screen.queryByTestId("match-create-home-dressing-select")).not.toBeInTheDocument();
    expect(screen.getByTestId("match-create-guided-progress")).not.toHaveTextContent("Spielfeld / Halle zuweisen");
  });
});

describe("MatchGuidedCreateForm — live Spielfeld/Halle + Garderobe availability (HOME only)", () => {
  it("fetches and displays live Frei/Belegt once Datum + Start/Ende are known", async () => {
    installFetchMock();
    render(<MatchGuidedCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    fireEvent.change(screen.getByTestId("match-create-date"), { target: { value: "2026-09-22" } });
    fireEvent.change(screen.getByTestId("match-create-starts-at"), { target: { value: "17:00" } });
    fireEvent.change(screen.getByTestId("match-create-ends-at"), { target: { value: "19:00" } });

    const pitchSelect = (await screen.findByTestId("match-create-pitch-select")) as HTMLSelectElement;
    await waitFor(() => {
      const optionTexts = Array.from(pitchSelect.options).map((o) => o.textContent);
      expect(optionTexts.some((t) => t?.includes("Kunstrasen 2") && t?.includes("Frei"))).toBe(true);
    });

    const awayDressingSelect = screen.getByTestId("match-create-away-dressing-select") as HTMLSelectElement;
    await waitFor(() => {
      const optionTexts = Array.from(awayDressingSelect.options).map((o) => o.textContent);
      expect(optionTexts.some((t) => t?.includes("Garderobe 2") && t?.includes("Belegt") && t?.includes("Training E2"))).toBe(true);
    });
  });

  it("does not query availability for Auswärts matches", async () => {
    const { fetchMock } = installFetchMock();
    render(<MatchGuidedCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    fireEvent.click(screen.getByTestId("match-create-away"));
    fireEvent.change(screen.getByTestId("match-create-date"), { target: { value: "2026-09-22" } });
    fireEvent.change(screen.getByTestId("match-create-starts-at"), { target: { value: "17:00" } });
    fireEvent.change(screen.getByTestId("match-create-ends-at"), { target: { value: "19:00" } });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/facilities/availability"))).toBe(false);
  });
});

describe("MatchGuidedCreateForm — submission", () => {
  it("HOME: creates the match via POST /api/events, then attaches pitch/dressing-room codes via PATCH", async () => {
    const { fetchMock, patchCalls } = installFetchMock();
    render(<MatchGuidedCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    await fillCommonFields();
    fireEvent.change(screen.getByTestId("match-create-pitch-select"), { target: { value: "res-pitch-a" } });
    fireEvent.change(screen.getByTestId("match-create-home-dressing-select"), { target: { value: "res-dressing-home" } });
    fireEvent.change(screen.getByTestId("match-create-away-dressing-select"), { target: { value: "res-dressing-away" } });

    await waitFor(() => expect(screen.getByTestId("match-create-submit")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("match-create-submit"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/events", expect.anything()));
    const createCall = fetchMock.mock.calls.find(([url]) => url === "/api/events");
    const createBody = JSON.parse((createCall?.[1] as RequestInit).body as string);
    expect(createBody).toMatchObject({
      type: "MATCH",
      source: "MANUAL",
      teamId: "team-1",
      location: "Sportplatz im Brüel",
      opponentName: "FC Concordia Basel",
      homeAway: "HOME",
    });

    await waitFor(() => expect(patchCalls.length).toBe(1));
    expect(patchCalls[0].body).toEqual({
      pitchCode: "KUNSTRASEN_2",
      homeDressingRoomCode: "DR_1",
      awayDressingRoomCode: "DR_2",
    });
  });

  it("AWAY: creates the match and never calls the pitch/dressing-room PATCH", async () => {
    const { fetchMock, patchCalls } = installFetchMock();
    render(<MatchGuidedCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    fireEvent.click(screen.getByTestId("match-create-away"));
    await waitFor(() => expect(screen.getByTestId("match-create-team-select")).not.toBeDisabled());
    fireEvent.change(screen.getByTestId("match-create-team-select"), { target: { value: "team-1" } });
    fireEvent.change(screen.getByTestId("match-create-location"), { target: { value: "Gegner-Stadion" } });
    fireEvent.change(screen.getByTestId("match-create-opponent-name"), { target: { value: "FC Concordia Basel" } });
    fireEvent.change(screen.getByTestId("match-create-date"), { target: { value: "2026-09-22" } });
    fireEvent.change(screen.getByTestId("match-create-starts-at"), { target: { value: "17:00" } });
    fireEvent.change(screen.getByTestId("match-create-ends-at"), { target: { value: "19:00" } });

    await waitFor(() => expect(screen.getByTestId("match-create-submit")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("match-create-submit"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/events", expect.anything()));
    const createCall = fetchMock.mock.calls.find(([url]) => url === "/api/events");
    const createBody = JSON.parse((createCall?.[1] as RequestInit).body as string);
    expect(createBody.homeAway).toBe("AWAY");

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(patchCalls).toHaveLength(0);
  });

  it("submit label reflects the review decision passed in from the server (canValidateDirectly)", () => {
    installFetchMock();
    const { rerender } = render(<MatchGuidedCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);
    expect(screen.getByTestId("match-create-submit")).toHaveTextContent("Freigeben & Match erstellen");

    rerender(<MatchGuidedCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly={false} />);
    expect(screen.getByTestId("match-create-submit")).toHaveTextContent("Zur Freigabe einreichen");
  });
});
