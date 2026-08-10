/**
 * @vitest-environment jsdom
 *
 * components/admin/tournamentcenter/__tests__/TournamentParticipantsEditor.club-search.test.tsx
 *
 * MASTERDATA-SELECTOR-CONSISTENCY-03-C1 — item 7 ("TournamentCreateForm +
 * edit picker behavior unchanged"): TournamentParticipantsEditor (the
 * "edit tournament" participants editor) reuses the SAME ExternalClubPicker
 * component as TournamentCreateForm — this proves the paginated search fix
 * benefits the edit flow too, with no separate code path to fall behind.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TournamentParticipantsEditor from "@/components/admin/tournamentcenter/TournamentParticipantsEditor";
import type { TournamentParticipantDto } from "@/lib/tournaments/types";

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("TournamentParticipantsEditor — external club participant search (BUG 2-C1 fix)", () => {
  it("exposes a club beyond the previous 200-item search cap and adds it as a participant", async () => {
    const manyClubs = Array.from({ length: 210 }, (_, i) => ({
      id: `club-many-${i}`,
      name: `Testverein ${String(i).padStart(4, "0")}`,
      shortName: null as string | null,
    }));

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (url === "/api/teams") return jsonResponse([]);
      if (url.startsWith("/api/club-directory/clubs")) {
        const parsed = new URL(url, "http://localhost");
        const limit = Number(parsed.searchParams.get("limit"));
        const skip = Number(parsed.searchParams.get("skip") ?? "0");
        return jsonResponse({ clubs: manyClubs.slice(skip, skip + limit) });
      }
      if (url === "/api/tournaments/tournament-1/participants" && method === "POST") {
        return jsonResponse(
          {
            participant: {
              id: "participant-1",
              tournamentId: "tournament-1",
              kind: "EXTERNAL_CLUB",
              displayName: "Testverein 0209",
              team: null,
              externalTeam: null,
              externalClub: { club: { id: "club-many-209", name: "Testverein 0209", shortName: null }, rawDisplayName: null },
              manualLabel: null,
              displayOrder: 0,
              dressingRoomAllocations: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } satisfies TournamentParticipantDto,
          },
          201,
        );
      }
      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TournamentParticipantsEditor
        tournamentId="tournament-1"
        canManage
        homeAway="AWAY"
        initialParticipants={[]}
        dressingRoomFacilityGroups={[]}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/teams", expect.anything()));

    fireEvent.change(screen.getByTestId("tournament-participant-add-external-club-search-input"), {
      target: { value: "testverein" },
    });

    await screen.findByText("Testverein 0209");
    fireEvent.mouseDown(screen.getByTestId("tournament-participant-add-external-club-search-option-club-many-209"));
    fireEvent.click(screen.getByTestId("tournament-participant-add-external-club-button"));

    const row = await screen.findByTestId("tournament-participant-row-participant-1");
    expect(row).toHaveTextContent("Testverein 0209");
  });
});
