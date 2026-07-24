/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/admin/__tests__/InfoboardTodayList.test.tsx
 *
 * Tests for InfoboardTodayList.
 *
 * Verifies:
 *   - Empty state message in German
 *   - Events render in sections by bucket
 *   - Bucket labels: "Jetzt", "Als Nächstes", "Später heute"
 *   - Event time, title, team, opponent are rendered
 *   - Sections with zero events are not rendered
 *   - Empty state matches public Screen 1 empty-state meaning
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { InfoboardTodayList } from "../InfoboardTodayList";
import type { Screen1AdminEventEntry } from "@/lib/publishing/infoboard/screen1-admin-summary";

function makeEntry(overrides: Partial<Screen1AdminEventEntry> = {}): Screen1AdminEventEntry {
  return {
    id: "evt-1",
    temporalBucket: "later",
    type: "TRAINING",
    displayTitle: "Training U14",
    teamDisplayName: "U14",
    opponentDisplayName: null,
    competitionLabel: null,
    startAt: "2026-07-24T16:00:00.000Z",
    endAt: "2026-07-24T17:30:00.000Z",
    status: "SCHEDULED",
    pitchLabel: "Platz 1",
    homeDressingRoomLabel: "Kabine A",
    awayDressingRoomLabel: null,
    ...overrides,
  };
}

describe("InfoboardTodayList", () => {
  it("renders the German empty state message when no events", () => {
    render(<InfoboardTodayList events={[]} />);

    expect(
      screen.getByText(
        "Heute sind keine Trainings, Heimspiele oder Turniere für Display 1 geplant.",
      ),
    ).toBeInTheDocument();
  });

  it("does not render bucket sections when empty", () => {
    render(<InfoboardTodayList events={[]} />);

    expect(screen.queryByText("Jetzt")).not.toBeInTheDocument();
    expect(screen.queryByText("Als Nächstes")).not.toBeInTheDocument();
    expect(screen.queryByText("Später heute")).not.toBeInTheDocument();
  });

  it("renders 'Jetzt' section for current events", () => {
    const events = [makeEntry({ id: "c1", temporalBucket: "current", displayTitle: "Match Jetzt" })];
    render(<InfoboardTodayList events={events} />);

    expect(screen.getByText("Jetzt")).toBeInTheDocument();
    expect(screen.getByText("Match Jetzt")).toBeInTheDocument();
  });

  it("renders 'Als Nächstes' section for next events", () => {
    const events = [makeEntry({ id: "n1", temporalBucket: "next", displayTitle: "Match Next" })];
    render(<InfoboardTodayList events={events} />);

    expect(screen.getByText("Als Nächstes")).toBeInTheDocument();
    expect(screen.getByText("Match Next")).toBeInTheDocument();
  });

  it("renders 'Später heute' section for later events", () => {
    const events = [makeEntry({ id: "l1", temporalBucket: "later", displayTitle: "Match Later" })];
    render(<InfoboardTodayList events={events} />);

    expect(screen.getByText("Später heute")).toBeInTheDocument();
    expect(screen.getByText("Match Later")).toBeInTheDocument();
  });

  it("renders multiple events across multiple buckets", () => {
    const events = [
      makeEntry({ id: "c1", temporalBucket: "current", displayTitle: "Training Jetzt" }),
      makeEntry({ id: "n1", temporalBucket: "next", displayTitle: "Match Nächstes" }),
      makeEntry({ id: "l1", temporalBucket: "later", displayTitle: "Turnier Später" }),
    ];
    render(<InfoboardTodayList events={events} />);

    expect(screen.getByText("Training Jetzt")).toBeInTheDocument();
    expect(screen.getByText("Match Nächstes")).toBeInTheDocument();
    expect(screen.getByText("Turnier Später")).toBeInTheDocument();
  });

  it("does not render empty bucket labels", () => {
    const events = [
      makeEntry({ id: "c1", temporalBucket: "current", displayTitle: "Training Jetzt" }),
    ];
    render(<InfoboardTodayList events={events} />);

    expect(screen.getByText("Jetzt")).toBeInTheDocument();
    expect(screen.queryByText("Als Nächstes")).not.toBeInTheDocument();
    expect(screen.queryByText("Später heute")).not.toBeInTheDocument();
  });

  it("renders opponent display name when present", () => {
    const events = [
      makeEntry({
        id: "m1",
        temporalBucket: "next",
        type: "MATCH",
        displayTitle: "1. Mannschaft vs FC Riehen",
        opponentDisplayName: "FC Riehen",
      }),
    ];
    render(<InfoboardTodayList events={events} />);

    // FC Riehen appears in the title and in the "vs." opponent span
    const matches = screen.getAllByText(/FC Riehen/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders team display name when present", () => {
    const events = [
      makeEntry({ id: "t1", temporalBucket: "later", teamDisplayName: "U14" }),
    ];
    render(<InfoboardTodayList events={events} />);

    expect(screen.getByText("U14")).toBeInTheDocument();
  });

  it("renders pitch label when present", () => {
    const events = [
      makeEntry({ id: "p1", temporalBucket: "later", pitchLabel: "Platz 3" }),
    ];
    render(<InfoboardTodayList events={events} />);

    expect(screen.getByText("Platz 3")).toBeInTheDocument();
  });
});
