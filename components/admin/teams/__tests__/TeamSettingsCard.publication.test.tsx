/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import TeamSettingsCard from "../TeamSettingsCard";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const team = {
  id: "team-a",
  name: "Team A",
  shortName: "A",
  alternativeName: null,
  infoboardDisplayName: null,
  infoboardTrainingDisplayName: null,
  infoboardMatchDisplayName: null,
  infoboardTournamentDisplayName: null,
  slug: "team-a",
  category: "JUNIOREN",
  genderGroup: null,
  ageGroup: null,
  sortOrder: 1,
  isActive: true,
  websiteVisible: true,
  infoboardVisible: true,
  orgUnitId: null,
  providerMapping: null,
  competition: null,
};

function renderCard() {
  return render(
    <TeamSettingsCard
      team={team}
      availableOrgUnits={[]}
      availableCompetitions={[]}
      currentTeamSeasonId="season-a"
      currentParticipationType="TRAINING"
      currentSeasonOrgUnit={null}
      currentSeasonPublication={{
        seasonName: "Saison 2026/27",
        showNextMatch: true,
        showNextTournament: false,
      }}
      canManage
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      message: "Website-Veröffentlichung wurde gespeichert.",
    }),
  });
});

describe("TeamSettingsCard seasonal next-event controls", () => {
  it("renders persisted state associated with the current season", () => {
    renderCard();

    expect(
      screen.getByRole("switch", { name: "Nächstes Spiel anzeigen" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/Einstellungen für Saison 2026\/27/)).toBeVisible();
  });

  it("immediately persists only the changed next-match setting", async () => {
    renderCard();

    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Spiel anzeigen" }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/teams/team-a/team-seasons/season-a/publication",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ showNextMatch: false }),
        }),
      ),
    );
    expect(screen.getByText("Website-Veröffentlichung wurde gespeichert.")).toBeVisible();
  });

  it("immediately persists only the changed next-tournament setting", async () => {
    renderCard();

    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/teams/team-a/team-seasons/season-a/publication",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ showNextTournament: true }),
        }),
      ),
    );
  });

  it("reverts the toggle and shows the existing inline error behavior", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Speichern fehlgeschlagen." }),
    });
    renderCard();
    const toggle = screen.getByRole("switch", {
      name: "Nächstes Turnier anzeigen",
    });

    await userEvent.click(toggle);

    await waitFor(() =>
      expect(screen.getByText("Speichern fehlgeschlagen.")).toBeVisible(),
    );
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});
