/**
 * @vitest-environment jsdom
 *
 * components/admin/matchcenter/__tests__/MatchCreateForm.test.tsx
 *
 * PLANNING-CREATION-UX-01C — focused tests for the guided MatchCenter
 * creation flow: guided-progress nudge, HOME live Spielfeld/Halle +
 * Garderobe availability, AWAY hides facility sections entirely, Gegner
 * searchable Club Directory picker prefills the editable opponent name,
 * and submission sequences Event creation + operational-fields PATCH.
 *
 * MATCHCENTER-VEREINPICKER-01B — regression coverage for the searchable
 * canonical Verein picker (reuses TournamentCenter's ExternalClubPicker).
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

/** Club beyond the old teams-endpoint default cap (50) — generic fixture, not hardcoded production data. */
const CLUB_BEYOND_OLD_CAP = { id: "club-telegraph", name: "FC Telegraph", shortName: null };
const CLUB_CONCORDIA = { id: "club-1", name: "FC Concordia Basel", shortName: null };

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

function installFetchMock() {
  const availabilityCalls: string[] = [];
  const patchCalls: { url: string; body: unknown }[] = [];
  const clubSearchCalls: string[] = [];

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/seasons") {
      return jsonResponse({ seasons: [{ id: "season-1", key: "2025-2026", name: "Saison 2025/2026", isActive: true }] });
    }
    if (url === "/api/teams") {
      return jsonResponse([{ id: "team-1", name: "1. Mannschaft", ageGroup: null, genderGroup: null, isActive: true }]);
    }
    if (url === "/api/planning/writable-teams?domain=match") {
      return jsonResponse({ teams: [{ id: "team-1", name: "1. Mannschaft", displayName: "1. Mannschaft", ageGroup: null, genderGroup: null, isActive: true }] });
    }
    if (url.startsWith("/api/club-directory/clubs")) {
      clubSearchCalls.push(url);
      const parsed = new URL(url, "http://localhost");
      const search = (parsed.searchParams.get("search") ?? "").toLowerCase();
      const all = [CLUB_BEYOND_OLD_CAP, CLUB_CONCORDIA];
      const matches = all.filter((c) => c.name.toLowerCase().includes(search));
      return jsonResponse({ clubs: matches });
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
  return { fetchMock, availabilityCalls, patchCalls, clubSearchCalls };
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

    await waitFor(() => {
      expect(screen.getByText("Kunstrasen 2")).toBeInTheDocument();
      expect(screen.getAllByText("Frei").length).toBeGreaterThan(0);
    });
  });

  it("AWAY: never calls the availability endpoint and hides Spielfeld/Halle + Garderobe sections", async () => {
    const { availabilityCalls } = installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    fireEvent.click(screen.getByTestId("match-create-home-away-away"));
    fireEvent.change(screen.getByTestId("match-create-start-at"), { target: { value: "2026-09-20T10:00" } });

    expect(screen.queryByTestId("match-create-pitch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("match-create-home-dressing-room")).not.toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(availabilityCalls).toHaveLength(0);
  });
});

describe("MatchCreateForm — Gegner (Club Directory search)", () => {
  it("never eagerly fetches the Club Directory on mount", async () => {
    const { clubSearchCalls } = installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    await waitFor(() => expect(screen.getByTestId("match-create-team-select")).not.toBeDisabled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(clubSearchCalls).toHaveLength(0);
  });

  it("finds a club beyond the old limited dropdown via partial-name search", async () => {
    installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    fireEvent.change(screen.getByTestId("match-create-opponent-club-search-input"), {
      target: { value: "tele" },
    });

    expect(await screen.findByText("FC Telegraph")).toBeInTheDocument();
  });

  it("prefills the editable opponent display name and preserves the canonical club id on selection", async () => {
    installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    fireEvent.change(screen.getByTestId("match-create-opponent-club-search-input"), {
      target: { value: "conc" },
    });
    await screen.findByTestId("match-create-opponent-club-search-option-club-1");
    fireEvent.mouseDown(screen.getByTestId("match-create-opponent-club-search-option-club-1"));

    const nameInput = screen.getByTestId("match-create-opponent-name") as HTMLInputElement;
    expect(nameInput.value).toBe("FC Concordia Basel");
    expect(screen.getByTestId("match-create-opponent-club-search")).toHaveTextContent("FC Concordia Basel");

    fireEvent.change(nameInput, { target: { value: "FCC Basel (Freundschaftsspiel)" } });
    expect(nameInput.value).toBe("FCC Basel (Freundschaftsspiel)");
    expect(screen.getByTestId("match-create-opponent-club-search")).toHaveTextContent("FC Concordia Basel");
  });

  it("allows manual opponent-name entry without a directory selection", async () => {
    installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    const nameInput = screen.getByTestId("match-create-opponent-name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Freundschaftsgast FC" } });
    expect(nameInput.value).toBe("Freundschaftsgast FC");
    expect(screen.getByPlaceholderText("Verein suchen…")).toBeInTheDocument();
  });

  it("searches via the tenant-scoped GET /api/club-directory/clubs endpoint", async () => {
    const { fetchMock } = installFetchMock();
    render(<MatchCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} canValidateDirectly />);

    fireEvent.change(screen.getByTestId("match-create-opponent-club-search-input"), {
      target: { value: "tele" },
    });

    await waitFor(
      () => {
        const clubCall = fetchMock.mock.calls.find(([u]) => String(u).startsWith("/api/club-directory/clubs"));
        expect(clubCall).toBeDefined();
      },
      { timeout: 1000 },
    );

    const clubCall = fetchMock.mock.calls.find(([u]) => String(u).startsWith("/api/club-directory/clubs"));
    const parsed = new URL(String(clubCall![0]), "http://localhost");
    expect(parsed.pathname).toBe("/api/club-directory/clubs");
    expect(parsed.searchParams.get("search")).toBe("tele");
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

describe("MatchCreateForm — ORG-ACCESS-03 writable-teams picker", () => {
  it("shows German no-teams message when writable-teams returns empty list", async () => {
    const emptyTeamsMock = vi.fn(async (url: string) => {
      if (url === "/api/seasons") {
        return { ok: true, status: 200, json: async () => ({ seasons: [{ id: "s1", key: "2025-2026", name: "Saison 2025/2026", isActive: true }] }) } as Response;
      }
      if (url === "/api/planning/writable-teams?domain=match") {
        return { ok: true, status: 200, json: async () => ({ teams: [] }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    vi.stubGlobal("fetch", emptyTeamsMock);

    render(<MatchCreateForm pitchHallFacilityGroups={[]} dressingRoomFacilityGroups={[]} canValidateDirectly={false} />);

    await waitFor(() => {
      expect(screen.queryByText("Teams laden…")).not.toBeInTheDocument();
    });

    expect(screen.queryByTestId("match-create-team-select")).not.toBeInTheDocument();
    expect(screen.getByText(/Kein Team mit Schreibzugriff verfügbar/)).toBeInTheDocument();
  });

  it("shows the team select when writable-teams returns results", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/seasons") {
        return { ok: true, status: 200, json: async () => ({ seasons: [{ id: "s1", key: "2025-2026", name: "Saison 2025/2026", isActive: true }] }) } as Response;
      }
      if (url === "/api/planning/writable-teams?domain=match") {
        return { ok: true, status: 200, json: async () => ({ teams: [{ id: "team-1", name: "1. Mannschaft", displayName: "1. Mannschaft", ageGroup: null, genderGroup: null, isActive: true }] }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }));

    render(<MatchCreateForm pitchHallFacilityGroups={[]} dressingRoomFacilityGroups={[]} canValidateDirectly={false} />);

    await waitFor(() => {
      expect(screen.getByTestId("match-create-team-select")).not.toBeDisabled();
    });
    expect(screen.getByTestId("match-create-team-select")).toBeInTheDocument();
    expect(screen.queryByText(/Kein Team mit Schreibzugriff/)).not.toBeInTheDocument();
  });
});
