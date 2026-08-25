/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import TeamParticipationSection from "../TeamParticipationSection";

const UPCOMING = {
  teamSeasonId: "ts-01",
  events: [
    {
      eventKind: "TRAINING" as const,
      trainingSessionId: "session-01",
      title: "Dienstagstraining",
      date: "2026-08-26",
      eventKindLabel: "Training",
    },
  ],
};

const EVENT_DATA = {
  event: {
    eventKind: "TRAINING" as const,
    trainingSessionId: "session-01",
    title: "Dienstagstraining",
    date: "2026-08-26",
    eventKindLabel: "Training",
  },
  summary: {
    totalPlayers: 2,
    counts: { open: 1, yes: 1, no: 0, maybe: 0 },
  },
  players: [
    {
      personId: "p1",
      displayName: "Leon Muster",
      shirtNumber: 10,
      responseId: "r1",
      status: "YES" as const,
      statusLabel: "Dabei",
      responseSource: "PARENT" as const,
      responseSourceLabel: "Eltern",
      note: null,
      respondedAt: "2026-08-25T10:00:00.000Z",
    },
    {
      personId: "p2",
      displayName: "Luca Beispiel",
      shirtNumber: null,
      responseId: null,
      status: "OPEN" as const,
      statusLabel: "Offen",
      responseSource: null,
      responseSourceLabel: null,
      note: null,
      respondedAt: null,
    },
  ],
};

describe("TEAM-COCKPIT-03A — TeamParticipationSection", () => {
  it("renders participation table with German labels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => EVENT_DATA,
      }),
    );

    render(
      <TeamParticipationSection
        teamId="team-01"
        teamSeasonId="ts-01"
        initialUpcoming={UPCOMING}
      />,
    );

    expect(screen.getByTestId("team-participation-section")).toBeInTheDocument();
    expect(screen.getByText("Teilnahmen")).toBeInTheDocument();
    expect(await screen.findByTestId("team-participation-player-p1")).toHaveTextContent(
      "Leon Muster",
    );
    expect(screen.getByTestId("team-participation-player-p1")).toHaveTextContent("Dabei");
    expect(screen.getByTestId("team-participation-player-p1")).toHaveTextContent("Eltern");
    expect(screen.getByTestId("team-participation-summary")).toHaveTextContent(
      "2 Spieler · 1 dabei · 1 offen",
    );
  });

  it("shows empty state when no upcoming events", () => {
    render(
      <TeamParticipationSection
        teamId="team-01"
        teamSeasonId="ts-01"
        initialUpcoming={{ teamSeasonId: "ts-01", events: [] }}
      />,
    );

    expect(
      screen.getByText("Keine anstehenden Events für Teilnahme-Rückmeldungen."),
    ).toBeInTheDocument();
  });

  it("allows switching between upcoming events", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => EVENT_DATA,
      }),
    );

    render(
      <TeamParticipationSection
        teamId="team-01"
        teamSeasonId="ts-01"
        initialUpcoming={{
          teamSeasonId: "ts-01",
          events: [
            ...UPCOMING.events,
            {
              eventKind: "MATCH",
              eventId: "match-01",
              title: "Heimspiel",
              date: "2026-08-27",
              eventKindLabel: "Spiel",
            },
          ],
        }}
      />,
    );

    await user.click(screen.getByTestId("team-participation-event-MATCH:match-01"));
    expect(screen.getByTestId("team-participation-event-MATCH:match-01")).toBeInTheDocument();
  });
});
