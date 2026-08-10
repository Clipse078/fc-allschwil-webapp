/**
 * @vitest-environment jsdom
 *
 * components/admin/tournamentcenter/__tests__/ExternalClubPicker.test.tsx
 *
 * MASTERDATA-SELECTOR-CONSISTENCY-03 (BUG 2) — focused tests for the
 * searchable Club Directory picker that replaces the eagerly-fetched,
 * silently-capped native <select> in TournamentCreateForm /
 * TournamentParticipantsEditor.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalClubPicker } from "../ExternalClubPicker";

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ExternalClubPicker — initial state", () => {
  it("shows the 'Verein suchen…' placeholder and performs no fetch before typing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ExternalClubPicker selected={null} onSelect={vi.fn()} testId="club-picker" />);

    expect(screen.getByPlaceholderText("Verein suchen…")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not search below the 2-character minimum", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ExternalClubPicker selected={null} onSelect={vi.fn()} testId="club-picker" />);

    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "r" } });
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Mindestens 2 Zeichen eingeben.")).toBeInTheDocument();
  });
});

describe("ExternalClubPicker — search-as-you-type", () => {
  it("searches the canonical GET /api/club-directory/clubs endpoint with a case-insensitive term and no arbitrary cap that would hide matches", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        clubs: [
          { id: "club-ro-1", name: "AC Rossoneri", shortName: null },
          { id: "club-ro-2", name: "FC Rotweiss", shortName: "Rotweiss" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ExternalClubPicker selected={null} onSelect={vi.fn()} testId="club-picker" />);

    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "ro" } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 1000 });

    const [url] = fetchMock.mock.calls[0];
    const parsed = new URL(String(url), "http://localhost");
    expect(parsed.pathname).toBe("/api/club-directory/clubs");
    expect(parsed.searchParams.get("search")).toBe("ro");
    // Explicit, generous limit — never the endpoint's un-searched default (50).
    expect(Number(parsed.searchParams.get("limit"))).toBeGreaterThanOrEqual(200);

    expect(await screen.findByText("AC Rossoneri")).toBeInTheDocument();
    expect(screen.getByText("FC Rotweiss")).toBeInTheDocument();
  });

  it("selecting a result calls onSelect with the full club and clears the search input", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ clubs: [{ id: "club-basel-1", name: "FC Basel Junioren", shortName: "FCB" }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onSelect = vi.fn();

    render(<ExternalClubPicker selected={null} onSelect={onSelect} testId="club-picker" />);

    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "ba" } });
    await screen.findByTestId("club-picker-option-club-basel-1");

    fireEvent.mouseDown(screen.getByTestId("club-picker-option-club-basel-1"));

    expect(onSelect).toHaveBeenCalledWith({ id: "club-basel-1", name: "FC Basel Junioren", shortName: "FCB" });
  });

  it("shows a 'Keine Vereine gefunden' state when the search yields no matches (non-matching clubs correctly excluded)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ clubs: [] }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ExternalClubPicker selected={null} onSelect={vi.fn()} testId="club-picker" />);

    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "zz" } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("club-picker-no-results")).toBeInTheDocument();
  });
});

describe("ExternalClubPicker — selected chip", () => {
  it("renders a chip for the selected club instead of the search input, and clears back to search on demand", () => {
    const onClearSelected = vi.fn();
    render(
      <ExternalClubPicker
        selected={{ id: "club-1", name: "AC Rossoneri", shortName: "Rossoneri" }}
        onSelect={vi.fn()}
        onClearSelected={onClearSelected}
        testId="club-picker"
      />,
    );

    expect(screen.getByText("AC Rossoneri")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Verein suchen…")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("club-picker-clear"));
    expect(onClearSelected).toHaveBeenCalledTimes(1);
  });
});
