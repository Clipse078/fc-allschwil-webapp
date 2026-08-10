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
    const fetchMock = vi.fn(async (url: string) => {
      void url;
      return jsonResponse({
        clubs: [
          { id: "club-ro-1", name: "AC Rossoneri", shortName: null },
          { id: "club-ro-2", name: "FC Rotweiss", shortName: "Rotweiss" },
        ],
      });
    });
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

describe("ExternalClubPicker — pagination (MASTERDATA-SELECTOR-CONSISTENCY-03-C1)", () => {
  /**
   * Simulates the real GET /api/club-directory/clubs limit/skip contract:
   * `total` matching clubs exist server-side ("Testverein 000".."Testverein
   * NNN"), and each request only ever returns up to `limit` of them
   * starting at `skip` — exactly like the real endpoint, so a client that
   * only fetches one page would silently miss everything past `limit`.
   */
  function installPaginatedFetchMock(total: number) {
    const allClubs = Array.from({ length: total }, (_, i) => ({
      id: `club-${String(i).padStart(4, "0")}`,
      name: `Testverein ${String(i).padStart(4, "0")}`,
      shortName: null as string | null,
    }));

    const calls: URL[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url, "http://localhost");
      calls.push(parsed);

      const limit = Number(parsed.searchParams.get("limit"));
      const skip = Number(parsed.searchParams.get("skip") ?? "0");
      const page = allClubs.slice(skip, skip + limit);
      return jsonResponse({ clubs: page });
    });

    vi.stubGlobal("fetch", fetchMock);
    return { fetchMock, calls, allClubs };
  }

  // 1. a search with more than 200 matching canonical clubs can expose a
  // result beyond position 200
  it("1. a search matching more than 200 canonical clubs exposes a result beyond position 200", async () => {
    installPaginatedFetchMock(250);

    render(<ExternalClubPicker selected={null} onSelect={vi.fn()} testId="club-picker" />);
    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "testverein" } });

    // "Testverein 0249" is the 250th match (0-indexed 249) — strictly past
    // the old fixed 200-item cap.
    expect(await screen.findByText("Testverein 0249")).toBeInTheDocument();
    expect(screen.getByText("Testverein 0000")).toBeInTheDocument();
  });

  // 2. all result pages are consumed if pagination is used
  it("2. walks every result page via skip until a less-than-full page is returned", async () => {
    const { fetchMock, calls } = installPaginatedFetchMock(250);

    render(<ExternalClubPicker selected={null} onSelect={vi.fn()} testId="club-picker" />);
    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "testverein" } });

    await screen.findByText("Testverein 0249");

    // 250 clubs at a 200-item page size → exactly 2 pages (200 + 50), then
    // stops because the second page came back less-than-full.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calls[0].searchParams.get("skip")).toBe("0");
    expect(calls[0].searchParams.get("limit")).toBe("200");
    expect(calls[1].searchParams.get("skip")).toBe("200");
  });

  it("stops after exactly one page when the match set is smaller than one page (no unnecessary extra request)", async () => {
    const { fetchMock } = installPaginatedFetchMock(3);

    render(<ExternalClubPicker selected={null} onSelect={vi.fn()} testId="club-picker" />);
    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "testverein" } });

    await screen.findByText("Testverein 0002");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // 3. unrelated/non-matching clubs remain excluded
  it("3. unrelated/non-matching clubs remain excluded even while paginating a large match set", async () => {
    const matching = Array.from({ length: 210 }, (_, i) => ({
      id: `match-${i}`,
      name: `Testverein ${i}`,
      shortName: null as string | null,
    }));
    const nonMatching = { id: "unrelated-1", name: "SC Nirgendwo", shortName: null };

    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url, "http://localhost");
      const term = (parsed.searchParams.get("search") ?? "").toLowerCase();
      const limit = Number(parsed.searchParams.get("limit"));
      const skip = Number(parsed.searchParams.get("skip") ?? "0");
      const all = [...matching, nonMatching].filter((c) => c.name.toLowerCase().includes(term));
      return jsonResponse({ clubs: all.slice(skip, skip + limit) });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ExternalClubPicker selected={null} onSelect={vi.fn()} testId="club-picker" />);
    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "testverein" } });

    expect(await screen.findByText("Testverein 209")).toBeInTheDocument();
    expect(screen.queryByText("SC Nirgendwo")).not.toBeInTheDocument();
  });

  // 4. tenant isolation unchanged
  it("4. never sends a client-supplied tenant identifier — tenant scoping stays exclusively server/session-derived", async () => {
    const { fetchMock, calls } = installPaginatedFetchMock(5);

    render(<ExternalClubPicker selected={null} onSelect={vi.fn()} testId="club-picker" />);
    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "testverein" } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    for (const url of calls) {
      expect(Array.from(url.searchParams.keys()).sort()).toEqual(["limit", "search", "skip"]);
    }
  });

  // 5. archived/ineligible clubs remain excluded
  it("5. never requests includeArchived — archived/ineligible clubs stay excluded by the endpoint's own default", async () => {
    const { calls } = installPaginatedFetchMock(5);

    render(<ExternalClubPicker selected={null} onSelect={vi.fn()} testId="club-picker" />);
    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "testverein" } });

    await screen.findByText("Testverein 0000");
    expect(calls[0].searchParams.get("includeArchived")).toBeNull();
  });

  // 6. 2-character search behavior unchanged
  it("6. still requires at least 2 characters before paginated search begins", async () => {
    const { fetchMock } = installPaginatedFetchMock(250);

    render(<ExternalClubPicker selected={null} onSelect={vi.fn()} testId="club-picker" />);
    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "t" } });
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "te" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("aborts a still-in-flight page walk when the search term changes, so stale results never overwrite a newer search", async () => {
    const pending: { resolveFirstPage: (() => void) | null } = { resolveFirstPage: null };
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url, "http://localhost");
      const term = parsed.searchParams.get("search");
      if (term === "aa") {
        await new Promise<void>((resolve) => {
          pending.resolveFirstPage = resolve;
        });
        return jsonResponse({ clubs: [{ id: "stale-club", name: "Stale Verein", shortName: null }] });
      }
      return jsonResponse({ clubs: [{ id: "fresh-club", name: "Fresh Verein", shortName: null }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ExternalClubPicker selected={null} onSelect={vi.fn()} testId="club-picker" />);

    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "aa" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByTestId("club-picker-input"), { target: { value: "bb" } });
    await screen.findByText("Fresh Verein");

    pending.resolveFirstPage?.();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.queryByText("Stale Verein")).not.toBeInTheDocument();
    expect(screen.getByText("Fresh Verein")).toBeInTheDocument();
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
