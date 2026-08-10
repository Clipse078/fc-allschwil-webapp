/**
 * @vitest-environment jsdom
 *
 * MASTERDATA-CONSISTENCY-02-C2 — regression tests proving historical/archived
 * dressing-room codes are scoped narrowly (per-event for the Room Drawer,
 * per-day for the Day Planner dialog) instead of being merged across the
 * whole week, so an archived room referenced only on one day never bleeds
 * into another day's/event's choices.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WochenplanBoard from "@/components/admin/wochenplan/WochenplanBoard";
import type { WochenplanBoardEvent } from "@/lib/wochenplan/types";
import type { FacilityResourceOption } from "@/lib/facilities/resource-options";

function makeEvent(overrides: Partial<WochenplanBoardEvent> = {}): WochenplanBoardEvent {
  return {
    id: "event-1",
    title: "1. Mannschaft",
    eventType: "TRAINING",
    source: "MANUAL",
    status: "SCHEDULED",
    teamName: "1. Mannschaft",
    opponentName: null,
    organizerName: null,
    competitionLabel: null,
    startAt: "2026-08-10T17:00:00.000Z",
    endAt: "2026-08-10T18:30:00.000Z",
    location: "Stadion",
    allocation: {
      pitchCode: "STADION",
      homeDressingRoomCode: null,
      awayDressingRoomCode: null,
      publishedToWebsite: false,
      publishedToInfoboard: false,
    },
    boardDayKey: "MONDAY",
    slotKey: "15:45-17:15",
    pitchRowKey: "STADION",
    fieldLabel: null,
    homeLabel: "Feld A",
    coachLabel: "R. Galli",
    categoryKey: "AKTIVE",
    ...overrides,
  };
}

// Canonical active rooms (tenant-scoped, small fixed set).
const ACTIVE_ROOM_OPTIONS: FacilityResourceOption[] = [
  { code: "E1", name: "E1" },
  { code: "E2", name: "E2" },
];

// "E9" has since been archived but is still referenced by the Monday event's
// allocation — its real DB name is resolved server-side.
const HISTORICAL_NAMES = { E9: "Garderobe E9 (archiviert)" };

// Monday event references the archived room "E9".
const mondayEvent = makeEvent({
  id: "monday-event",
  title: "Monday Training",
  boardDayKey: "MONDAY",
  allocation: {
    pitchCode: "STADION",
    homeDressingRoomCode: "E9",
    awayDressingRoomCode: null,
    publishedToWebsite: false,
    publishedToInfoboard: false,
  },
});

// Tuesday event has nothing to do with "E9" — only an active room.
const tuesdayEvent = makeEvent({
  id: "tuesday-event",
  title: "Tuesday Training",
  boardDayKey: "TUESDAY",
  allocation: {
    pitchCode: "STADION",
    homeDressingRoomCode: "E1",
    awayDressingRoomCode: null,
    publishedToWebsite: false,
    publishedToInfoboard: false,
  },
});

function renderBoard() {
  return render(
    <WochenplanBoard
      initialEvents={[mondayEvent, tuesdayEvent]}
      roomOptions={ACTIVE_ROOM_OPTIONS}
      historicalRoomNamesByCode={HISTORICAL_NAMES}
    />,
  );
}

function openDayPlanner(dayIndex: number) {
  const buttons = screen.getAllByRole("button", { name: /Garderobe Tagesplaner/ });
  fireEvent.click(buttons[dayIndex]!);
}

function openDrawerForEvent(title: string) {
  const card = screen.getByText(title).closest("button");
  expect(card).not.toBeNull();
  fireEvent.click(card!);
}

describe("WochenplanBoard — historical room scoping (no week-wide bleed)", () => {
  it("1. a Monday-only archived room does not appear in Tuesday's Day Planner dialog", () => {
    renderBoard();

    // DAYS order is MONDAY(0), TUESDAY(1), ... — open Tuesday's dialog.
    openDayPlanner(1);

    expect(screen.getByText(/Garderobe Tagesplaner – Dienstag/)).toBeInTheDocument();
    expect(screen.queryByText("Garderobe E9 (archiviert)")).not.toBeInTheDocument();
    expect(screen.queryByText("E9")).not.toBeInTheDocument();
  });

  it("2. a Monday-only archived room does not appear in the unrelated Tuesday event's Room Drawer", () => {
    renderBoard();

    openDrawerForEvent("Tuesday Training");

    expect(screen.queryByText("Garderobe E9 (archiviert)")).not.toBeInTheDocument();
    expect(screen.queryByText("E9")).not.toBeInTheDocument();
  });

  it("3. the archived room remains visible in the Room Drawer for the event that actually references it", () => {
    renderBoard();

    openDrawerForEvent("Monday Training");

    expect(screen.getAllByText("Garderobe E9 (archiviert)").length).toBeGreaterThan(0);
  });

  it("4. the archived room remains visible in the Day Planner dialog for the day that actually references it", () => {
    renderBoard();

    openDayPlanner(0); // MONDAY

    expect(screen.getByText(/Garderobe Tagesplaner – Montag/)).toBeInTheDocument();
    expect(screen.getAllByText("Garderobe E9 (archiviert)").length).toBeGreaterThan(0);
  });

  it("5. active canonical rooms remain available in both the Drawer and Day Planner regardless of day/event", () => {
    renderBoard();

    // Tuesday's Drawer (never referenced E9, but E1/E2 are canonical-active).
    openDrawerForEvent("Tuesday Training");
    expect(screen.getAllByText("E1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("E2").length).toBeGreaterThan(0);
  });

  it("5b. active canonical rooms remain available in Monday's Day Planner alongside the historical room", () => {
    renderBoard();

    openDayPlanner(0); // MONDAY
    expect(screen.getAllByText("E1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("E2").length).toBeGreaterThan(0);
  });

  it("6. the historical resource uses its real, resolved DB name rather than the raw code", () => {
    renderBoard();

    openDrawerForEvent("Monday Training");

    // The raw code "E9" must never be rendered on its own — only the
    // resolved canonical/historical name.
    expect(screen.queryByText("E9")).not.toBeInTheDocument();
    expect(screen.getAllByText("Garderobe E9 (archiviert)").length).toBeGreaterThan(0);
  });
});
