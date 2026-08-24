/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import TeamAttendanceSection from "../TeamAttendanceSection";

vi.mock("../TeamAttendancePlayerDrawer", () => ({
  default: ({ open, player }: { open: boolean; player: { displayName: string } | null }) =>
    open ? <div data-testid="player-drawer">{player?.displayName}</div> : null,
}));

vi.mock("../TeamAttendanceEventSheet", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="event-sheet">Event Sheet</div> : null,
}));

const OVERVIEW = {
  teamSeasonId: "ts-01",
  players: [
    {
      personId: "p1",
      displayName: "Max Muster",
      shirtNumber: 10,
      eventCount: 2,
      counts: { open: 0, present: 1, absent: 1, excused: 0, injured: 0 },
      percentage: 0.5,
      percentageLabel: "50%",
    },
  ],
};

describe("TEAM-COCKPIT-02B — TeamAttendanceSection", () => {
  it("renders attendance overview table with German labels", () => {
    render(
      <TeamAttendanceSection
        teamId="team-01"
        teamSeasonId="ts-01"
        initialOverview={OVERVIEW}
        canManage={true}
      />,
    );

    expect(screen.getByTestId("team-attendance-section")).toBeInTheDocument();
    expect(screen.getByText("Anwesenheit")).toBeInTheDocument();
    expect(screen.getByTestId("team-attendance-player-p1")).toHaveTextContent("Max Muster");
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("opens player drawer on row click", async () => {
    const user = userEvent.setup();

    render(
      <TeamAttendanceSection
        teamId="team-01"
        teamSeasonId="ts-01"
        initialOverview={OVERVIEW}
        canManage={false}
      />,
    );

    await user.click(screen.getByTestId("team-attendance-player-p1"));
    expect(screen.getByTestId("player-drawer")).toHaveTextContent("Max Muster");
  });
});
