/**
 * @vitest-environment jsdom
 *
 * components/admin/tournamentcenter/__tests__/TournamentEditForm.delete.test.tsx
 *
 * ADMIN-DELETE-02A — focused UI-gating tests for the permanent "Endgültig
 * löschen" action on a Tournament. `canDelete` is an independent authority
 * signal from `canManage`/events.manage — cancel/restore/edit remain
 * governed by `canManage` alone, and this suite verifies the delete button
 * only renders when the caller holds tournaments.delete.
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TournamentEditForm from "@/components/admin/tournamentcenter/TournamentEditForm";
import type { TournamentDto } from "@/lib/tournaments/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: { success: vi.fn(), danger: vi.fn() } }),
}));

const TOURNAMENT: TournamentDto = {
  id: "tournament-1",
  tenantId: "tenant-a",
  title: "U13 Hallenturnier",
  description: null,
  status: "SCHEDULED",
  source: "MANUAL",
  startAt: "2026-01-10T09:00:00.000Z",
  endAt: null,
  meetingTime: null,
  location: null,
  organizerName: null,
  competitionLabel: null,
  resultLabel: null,
  remarks: null,
  season: { id: "season-1", key: "2025-2026", name: "Saison 2025/2026" },
  team: null,
  homeAway: "HOME",
  participants: [],
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

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
  );
});

describe("TournamentEditForm — ADMIN-DELETE-02A permission gating", () => {
  it("hides the permanent delete button for a canManage-only caller (canDelete=false)", () => {
    render(
      <TournamentEditForm
        tournament={TOURNAMENT}
        canManage={true}
        canDelete={false}
        pitchHallFacilityGroups={[]}
        dressingRoomFacilityGroups={[]}
      />,
    );

    expect(screen.queryByTestId("tournament-delete-button")).toBeNull();
  });

  it("shows the permanent delete button for a tournaments.delete-authorized caller", () => {
    render(
      <TournamentEditForm
        tournament={TOURNAMENT}
        canManage={false}
        canDelete={true}
        pitchHallFacilityGroups={[]}
        dressingRoomFacilityGroups={[]}
      />,
    );

    expect(screen.getByTestId("tournament-delete-button")).toBeTruthy();
  });

  it("shows both the cancel toggle and delete button when the caller holds both authorities", () => {
    render(
      <TournamentEditForm
        tournament={TOURNAMENT}
        canManage={true}
        canDelete={true}
        pitchHallFacilityGroups={[]}
        dressingRoomFacilityGroups={[]}
      />,
    );

    expect(screen.getByTestId("tournament-lifecycle-toggle")).toBeTruthy();
    expect(screen.getByTestId("tournament-delete-button")).toBeTruthy();
  });
});

describe("TournamentEditForm — ADMIN-DELETE-02A-C1 impact never blocks", () => {
  it("shows participants/resources as impact (warning), and the confirm button stays enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          impact: [{ key: "participants", label: "Teilnehmende Teams/Vereine", count: 4 }],
          requiresConfirmation: true,
        }),
      }),
    );

    render(
      <TournamentEditForm
        tournament={TOURNAMENT}
        canManage={false}
        canDelete={true}
        pitchHallFacilityGroups={[]}
        dressingRoomFacilityGroups={[]}
      />,
    );

    fireEvent.click(screen.getByTestId("tournament-delete-button"));

    await waitFor(() => {
      expect(screen.getByText(/Teilnehmende Teams\/Vereine: 4/)).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/tournaments/tournament-1",
      expect.objectContaining({ method: "DELETE" }),
    );

    const confirmButton = screen.getByTestId("tournament-delete-confirm");
    expect(confirmButton).not.toBeDisabled();
  });

  it("confirming calls the permanent-delete endpoint with ?confirm=true", async () => {
    // RESOURCE-AVAILABILITY-UX-01: TournamentEditForm now also fires a live
    // Frei/Belegt availability lookup on mount (this tournament is HOME with
    // a startAt) — keyed by URL rather than positional mockResolvedValueOnce
    // so that unrelated fetch doesn't consume the two delete-flow responses
    // this test actually asserts on.
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/tournaments/tournament-1") {
        return Promise.resolve({ ok: true, json: async () => ({ impact: [] }) });
      }
      if (url === "/api/tournaments/tournament-1?confirm=true") {
        return Promise.resolve({ ok: true, json: async () => ({ message: "ok", impact: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TournamentEditForm
        tournament={TOURNAMENT}
        canManage={false}
        canDelete={true}
        pitchHallFacilityGroups={[]}
        dressingRoomFacilityGroups={[]}
      />,
    );

    fireEvent.click(screen.getByTestId("tournament-delete-button"));

    await waitFor(() => {
      expect(screen.getByText(/Keine Teilnehmer, Ressourcen-Zuordnungen/)).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("tournament-delete-confirm"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/tournaments/tournament-1?confirm=true",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
