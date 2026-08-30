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

const publication = {
  seasonName: "Saison 2026/27",
  showNextMatch: true,
  showNextTournament: false,
};

function renderCard(
  overrides: {
    publication?: typeof publication | null;
  } = {},
) {
  return render(
    <TeamSettingsCard
      team={team}
      availableOrgUnits={[]}
      availableCompetitions={[]}
      currentTeamSeasonId="season-a"
      currentParticipationType="TRAINING"
      currentSeasonOrgUnit={null}
      currentSeasonPublication={
        overrides.publication === undefined ? publication : overrides.publication
      }
      canManage
    />,
  );
}

function saveButtons() {
  return screen.getAllByRole("button", { name: "Team speichern" });
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes("/publication")) {
      return {
        ok: true,
        json: async () => ({
          message: "Website-Veröffentlichung wurde gespeichert.",
        }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        message: "Team erfolgreich gespeichert.",
        team,
      }),
    };
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
    expect(screen.getByText(/mit «Team speichern» übernommen/)).toBeVisible();
  });

  it("enables Team speichern when only showNextMatch changes", async () => {
    renderCard();

    expect(saveButtons()[0]).toBeDisabled();

    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Spiel anzeigen" }),
    );

    expect(saveButtons()[0]).toBeEnabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("persists only the changed showNextMatch setting via Team speichern", async () => {
    renderCard();

    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Spiel anzeigen" }),
    );
    await userEvent.click(saveButtons()[0]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/teams/team-a/team-seasons/season-a/publication",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ showNextMatch: false }),
        }),
      ),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/teams/team-a",
      expect.anything(),
    );
    expect(
      screen.getByText("Website-Veröffentlichung wurde gespeichert."),
    ).toBeVisible();
    expect(refresh).toHaveBeenCalled();
  });

  it("persists only the changed showNextTournament setting via Team speichern", async () => {
    renderCard();

    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    );
    await userEvent.click(saveButtons()[0]);

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

  it("persists both publication settings in one save", async () => {
    renderCard();

    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Spiel anzeigen" }),
    );
    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    );
    await userEvent.click(saveButtons()[0]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/teams/team-a/team-seasons/season-a/publication",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            showNextMatch: false,
            showNextTournament: true,
          }),
        }),
      ),
    );
  });

  it("refetches persisted publication state after save", async () => {
    const view = renderCard();

    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    );
    await userEvent.click(saveButtons()[0]);

    await waitFor(() => expect(refresh).toHaveBeenCalled());

    view.rerender(
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
          showNextTournament: true,
        }}
        canManage
      />,
    );

    expect(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(saveButtons()[0]).toBeDisabled();
  });

  it("shows the existing inline error behavior when publication save fails", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/publication")) {
        return {
          ok: false,
          json: async () => ({ error: "Speichern fehlgeschlagen." }),
        };
      }

      return {
        ok: true,
        json: async () => ({ message: "Team erfolgreich gespeichert.", team }),
      };
    });

    renderCard();
    const toggle = screen.getByRole("switch", {
      name: "Nächstes Turnier anzeigen",
    });

    await userEvent.click(toggle);
    await userEvent.click(saveButtons()[0]);

    await waitFor(() =>
      expect(screen.getByText("Speichern fehlgeschlagen.")).toBeVisible(),
    );
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(saveButtons()[0]).toBeEnabled();
  });

  it("does not regress normal Team save behaviour", async () => {
    renderCard();

    await userEvent.clear(screen.getByPlaceholderText("z. B. FC Allschwil Junioren B2"));
    await userEvent.type(
      screen.getByPlaceholderText("z. B. FC Allschwil Junioren B2"),
      "Team A Updated",
    );
    await userEvent.click(saveButtons()[0]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/teams/team-a",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("Team A Updated"),
        }),
      ),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/publication"),
      expect.anything(),
    );
    expect(screen.getByText("Team erfolgreich gespeichert.")).toBeVisible();
  });
});
