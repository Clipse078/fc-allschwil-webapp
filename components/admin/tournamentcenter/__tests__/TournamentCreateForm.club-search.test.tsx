/**
 * @vitest-environment jsdom
 *
 * components/admin/tournamentcenter/__tests__/TournamentCreateForm.club-search.test.tsx
 *
 * MASTERDATA-SELECTOR-CONSISTENCY-03 (BUG 2) — focused tests for the
 * TournamentCenter external-club participant flow after replacing the
 * eagerly-fetched, silently-capped native <select> with the search-driven
 * ExternalClubPicker.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TournamentCreateForm from "@/components/admin/tournamentcenter/TournamentCreateForm";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const PITCH_HALL_GROUPS: FacilityGroup[] = [];
const DRESSING_ROOM_GROUPS: FacilityGroup[] = [];

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

/**
 * A club deliberately positioned well beyond the OLD un-searched default
 * cap (CLUB_DIRECTORY_DEFAULT_LIMIT = 50) — proves the fix is retrievable
 * regardless of alphabetical position, since it is never fetched as part
 * of a bulk/paged list at all.
 */
const CLUB_BEYOND_OLD_CAP = { id: "club-99", name: "SC Zunzgen 99", shortName: null };
const CLUB_ROSSONERI = { id: "club-rossoneri", name: "AC Rossoneri", shortName: null };

function installFetchMock() {
  const clubSearchCalls: string[] = [];

  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/seasons") {
      return jsonResponse({ seasons: [{ id: "season-1", key: "2025-2026", name: "Saison 2025/2026", isActive: true }] });
    }
    if (url === "/api/teams") {
      return jsonResponse([]);
    }
    if (url.startsWith("/api/club-directory/clubs")) {
      clubSearchCalls.push(url);
      const parsed = new URL(url, "http://localhost");
      const search = (parsed.searchParams.get("search") ?? "").toLowerCase();

      const all = [CLUB_BEYOND_OLD_CAP, CLUB_ROSSONERI];
      const matches = all.filter((c) => c.name.toLowerCase().includes(search));
      return jsonResponse({ clubs: matches });
    }
    if (url.startsWith("/api/facilities/availability")) {
      return jsonResponse({ availability: [] });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, clubSearchCalls };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("TournamentCreateForm — external club participant search (BUG 2 fix)", () => {
  it("never eagerly fetches the full Club Directory on mount (no un-searched GET /api/club-directory/clubs call)", async () => {
    const { fetchMock, clubSearchCalls } = installFetchMock();
    render(<TournamentCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Give any stray mount-time effect a tick to fire before asserting.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(clubSearchCalls).toHaveLength(0);
  });

  // 9. eligible club beyond previous result cap is retrievable
  it("9. a club positioned well beyond the previous 50-item cap is retrievable via search", async () => {
    installFetchMock();
    render(<TournamentCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} />);

    fireEvent.change(screen.getByTestId("tournament-create-add-external-club-search-input"), {
      target: { value: "zu" },
    });

    expect(await screen.findByText("SC Zunzgen 99")).toBeInTheDocument();
  });

  // 12. 2-character search returns matching canonical clubs
  it("12. a 2-character search returns matching canonical clubs", async () => {
    installFetchMock();
    render(<TournamentCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} />);

    fireEvent.change(screen.getByTestId("tournament-create-add-external-club-search-input"), {
      target: { value: "ro" },
    });

    expect(await screen.findByText("AC Rossoneri")).toBeInTheDocument();
  });

  // 13. non-matching clubs excluded from search result
  it("13. non-matching clubs are excluded from the search result", async () => {
    installFetchMock();
    render(<TournamentCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} />);

    fireEvent.change(screen.getByTestId("tournament-create-add-external-club-search-input"), {
      target: { value: "ro" },
    });

    await screen.findByText("AC Rossoneri");
    expect(screen.queryByText("SC Zunzgen 99")).not.toBeInTheDocument();
  });

  it("selecting a searched club and clicking + adds it as a participant, then the Anzeigename field is editable (PR #348 behavior preserved)", async () => {
    installFetchMock();
    render(<TournamentCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} />);

    fireEvent.change(screen.getByTestId("tournament-create-add-external-club-search-input"), {
      target: { value: "ro" },
    });
    fireEvent.mouseDown(await screen.findByTestId("tournament-create-add-external-club-search-option-club-rossoneri"));

    fireEvent.click(screen.getByTestId("tournament-create-add-external-club-button"));

    const row = await screen.findByTestId(/tournament-create-participant-row-/);
    expect(row).toHaveTextContent("AC Rossoneri");

    const displayNameInput = row.querySelector("input[placeholder='AC Rossoneri']") as HTMLInputElement;
    expect(displayNameInput).toBeInTheDocument();
    fireEvent.change(displayNameInput, { target: { value: "Gelb" } });
    expect(displayNameInput.value).toBe("Gelb");
  });

  it("the same club can be added twice with distinct Anzeigename values (PR #348 behavior preserved)", async () => {
    installFetchMock();
    render(<TournamentCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} />);

    async function addRossoneri() {
      fireEvent.change(screen.getByTestId("tournament-create-add-external-club-search-input"), {
        target: { value: "ro" },
      });
      fireEvent.mouseDown(await screen.findByTestId("tournament-create-add-external-club-search-option-club-rossoneri"));
      fireEvent.click(screen.getByTestId("tournament-create-add-external-club-button"));
    }

    await addRossoneri();
    await waitFor(() => expect(screen.getAllByText("AC Rossoneri")).toHaveLength(1));
    await addRossoneri();

    await waitFor(() => expect(screen.getAllByText("AC Rossoneri")).toHaveLength(2));
  });
});
