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

function publicationPatchCalls() {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).includes("/publication"),
  );
}

function renderCardElement(
  overrides: {
    publication?: typeof publication | null;
  } = {},
) {
  return (
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
    />
  );
}

function renderCard(
  overrides: {
    publication?: typeof publication | null;
  } = {},
) {
  return render(renderCardElement(overrides));
}

function saveButtons() {
  return screen.getAllByRole("button", { name: "Team speichern" });
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes("/publication")) {
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : {};
      return {
        ok: true,
        json: async () => ({
          message: "Website-Veröffentlichung wurde gespeichert.",
          publication: {
            showNextMatch:
              typeof body.showNextMatch === "boolean"
                ? body.showNextMatch
                : publication.showNextMatch,
            showNextTournament:
              typeof body.showNextTournament === "boolean"
                ? body.showNextTournament
                : publication.showNextTournament,
          },
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

  it("TEAM-PUBLIC-NEXT-EVENT-01G regression: tournament-only false/true lifecycle", async () => {
    const onPublicationSaved = vi.fn();
    const view = render(
      <TeamSettingsCard
        team={team}
        availableOrgUnits={[]}
        availableCompetitions={[]}
        currentTeamSeasonId="season-a"
        currentParticipationType="TRAINING"
        currentSeasonOrgUnit={null}
        currentSeasonPublication={publication}
        canManage
        onPublicationSaved={onPublicationSaved}
      />,
    );

    expect(saveButtons()[0]).toBeDisabled();
    expect(publicationPatchCalls()).toHaveLength(0);

    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Spiel anzeigen" }),
    );
    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    );

    expect(
      screen.getByRole("switch", { name: "Nächstes Spiel anzeigen" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(saveButtons()[0]).toBeEnabled();
    expect(publicationPatchCalls()).toHaveLength(0);

    await userEvent.click(saveButtons()[0]);

    await waitFor(() => expect(publicationPatchCalls()).toHaveLength(1));
    expect(publicationPatchCalls()[0]).toEqual([
      "/api/teams/team-a/team-seasons/season-a/publication",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          showNextMatch: false,
          showNextTournament: true,
        }),
      }),
    ]);
    expect(onPublicationSaved).toHaveBeenCalledWith({
      showNextMatch: false,
      showNextTournament: true,
    });
    expect(saveButtons()[0]).toBeDisabled();

    view.rerender(
      renderCardElement({
        publication: {
          seasonName: "Saison 2026/27",
          showNextMatch: false,
          showNextTournament: true,
        },
      }),
    );

    expect(
      screen.getByRole("switch", { name: "Nächstes Spiel anzeigen" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(saveButtons()[0]).toBeDisabled();
  });

  it("keeps tournament-only draft edits when parent rerenders with a new object but unchanged canonical booleans", async () => {
    const view = renderCard();

    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Spiel anzeigen" }),
    );
    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    );

    view.rerender(
      renderCardElement({
        publication: {
          seasonName: publication.seasonName,
          showNextMatch: publication.showNextMatch,
          showNextTournament: publication.showNextTournament,
        },
      }),
    );

    expect(
      screen.getByRole("switch", { name: "Nächstes Spiel anzeigen" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(saveButtons()[0]).toBeEnabled();
    expect(publicationPatchCalls()).toHaveLength(0);
  });

  it.each([
    {
      label: "ON/OFF",
      initial: { showNextMatch: true, showNextTournament: false },
      toggles: [] as const,
      expectedBody: null,
    },
    {
      label: "ON/ON",
      initial: { showNextMatch: true, showNextTournament: false },
      toggles: ["tournament"] as const,
      expectedBody: { showNextTournament: true },
    },
    {
      label: "OFF/OFF",
      initial: { showNextMatch: true, showNextTournament: false },
      toggles: ["match"] as const,
      expectedBody: { showNextMatch: false },
    },
    {
      label: "OFF/ON",
      initial: { showNextMatch: true, showNextTournament: false },
      toggles: ["match", "tournament"] as const,
      expectedBody: { showNextMatch: false, showNextTournament: true },
    },
  ])(
    "supports publication combination $label",
    async ({ initial, toggles, expectedBody }) => {
      renderCard({
        publication: {
          seasonName: publication.seasonName,
          ...initial,
        },
      });

      for (const toggle of toggles) {
        await userEvent.click(
          screen.getByRole("switch", {
            name:
              toggle === "match"
                ? "Nächstes Spiel anzeigen"
                : "Nächstes Turnier anzeigen",
          }),
        );
      }

      if (!expectedBody) {
        expect(saveButtons()[0]).toBeDisabled();
        expect(publicationPatchCalls()).toHaveLength(0);
        return;
      }

      await userEvent.click(saveButtons()[0]);

      await waitFor(() => expect(publicationPatchCalls()).toHaveLength(1));
      expect(publicationPatchCalls()[0]).toEqual([
        "/api/teams/team-a/team-seasons/season-a/publication",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(expectedBody),
        }),
      ]);
    },
  );

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

  it("does not PATCH publication before Team speichern and remount restores canonical values", async () => {
    const view = renderCard();

    expect(
      screen.getByRole("switch", { name: "Nächstes Spiel anzeigen" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(saveButtons()[0]).toBeDisabled();

    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Spiel anzeigen" }),
    );

    expect(saveButtons()[0]).toBeEnabled();
    expect(publicationPatchCalls()).toHaveLength(0);

    view.unmount();
    const remounted = renderCard();

    expect(
      screen.getByRole("switch", { name: "Nächstes Spiel anzeigen" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(saveButtons()[0]).toBeDisabled();
    expect(publicationPatchCalls()).toHaveLength(0);

    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    );
    expect(saveButtons()[0]).toBeEnabled();
    await userEvent.click(saveButtons()[0]);

    await waitFor(() => expect(publicationPatchCalls()).toHaveLength(1));
    expect(publicationPatchCalls()[0]).toEqual([
      "/api/teams/team-a/team-seasons/season-a/publication",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ showNextTournament: true }),
      }),
    ]);
    expect(saveButtons()[0]).toBeDisabled();

    remounted.rerender(
      renderCardElement({
        publication: {
          seasonName: "Saison 2026/27",
          showNextMatch: true,
          showNextTournament: true,
        },
      }),
    );

    expect(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(saveButtons()[0]).toBeDisabled();
  });

  it("discards unsaved publication edits when canonical boolean props change from the server", async () => {
    const view = renderCard();

    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    );
    expect(saveButtons()[0]).toBeEnabled();
    expect(publicationPatchCalls()).toHaveLength(0);

    view.rerender(
      renderCardElement({
        publication: {
          seasonName: publication.seasonName,
          showNextMatch: false,
          showNextTournament: false,
        },
      }),
    );

    expect(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(saveButtons()[0]).toBeDisabled();
    expect(publicationPatchCalls()).toHaveLength(0);
  });

  it("saves publication and normal Team fields through their respective endpoints", async () => {
    renderCard();

    await userEvent.clear(screen.getByPlaceholderText("z. B. FC Allschwil Junioren B2"));
    await userEvent.type(
      screen.getByPlaceholderText("z. B. FC Allschwil Junioren B2"),
      "Team A Updated",
    );
    await userEvent.click(
      screen.getByRole("switch", { name: "Nächstes Turnier anzeigen" }),
    );
    await userEvent.click(saveButtons()[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/teams/team-a",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining("Team A Updated"),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/teams/team-a/team-seasons/season-a/publication",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ showNextTournament: true }),
      }),
    );
    expect(saveButtons()[0]).toBeDisabled();
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
