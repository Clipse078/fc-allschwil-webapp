/**
 * @vitest-environment jsdom
 *
 * MASTERDATA-CONSISTENCY-02 — Wochenplan room allocation drawer regression
 * tests for WochenplanRoomDrawer.
 *
 * Covers:
 *   - the static FCA_DRESSING_ROOMS registry is gone; Home/Away selects and
 *     the availability grid render exactly the canonical `roomOptions` prop.
 *   - a newly created room appears.
 *   - a renamed room shows its current canonical name.
 *   - an archived room absent from roomOptions is excluded.
 *   - selecting a room calls the corresponding onChange callback with the code.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WochenplanRoomDrawer from "@/components/admin/wochenplan/WochenplanRoomDrawer";
import type { WochenplanBoardEvent } from "@/lib/wochenplan/types";
import type { FacilityResourceOption } from "@/lib/facilities/resource-options";

function makeEvent(overrides: Partial<WochenplanBoardEvent> = {}): WochenplanBoardEvent {
  return {
    id: "event-1",
    title: "1. Mannschaft",
    eventType: "MATCH",
    source: "CLUBCORNER_FVNWS",
    status: "SCHEDULED",
    teamName: "1. Mannschaft",
    opponentName: "FC Muttenz",
    organizerName: null,
    competitionLabel: null,
    startAt: "2026-08-10T17:00:00.000Z",
    endAt: "2026-08-10T18:30:00.000Z",
    location: "Stadion",
    allocation: {
      pitchCode: "STADION",
      homeDressingRoomCode: "E1",
      awayDressingRoomCode: null,
      publishedToWebsite: false,
      publishedToInfoboard: false,
    },
    boardDayKey: "MONDAY",
    slotKey: "17:15-18:45",
    pitchRowKey: "STADION",
    fieldLabel: null,
    homeLabel: "Feld A",
    coachLabel: "R. Galli",
    categoryKey: "AKTIVE",
    ...overrides,
  };
}

const DEFAULT_ROOM_OPTIONS: FacilityResourceOption[] = [
  { code: "E1", name: "E1" },
  { code: "E2", name: "E2" },
];

function renderDrawer(overrides: Partial<React.ComponentProps<typeof WochenplanRoomDrawer>> = {}) {
  return render(
    <WochenplanRoomDrawer
      event={makeEvent()}
      occupiedRooms={[]}
      onClose={() => {}}
      onChangeHomeRoom={() => {}}
      onChangeAwayRoom={() => {}}
      roomOptions={DEFAULT_ROOM_OPTIONS}
      {...overrides}
    />,
  );
}

describe("WochenplanRoomDrawer — canonical roomOptions", () => {
  it("renders a Home select option for every room in roomOptions", () => {
    renderDrawer();

    const selects = screen.getAllByRole("combobox");
    const homeOptions = within(selects[0]!).getAllByRole("option").map((o) => o.textContent);

    expect(homeOptions).toEqual(expect.arrayContaining(["E1", "E2"]));
  });

  it("a newly created room appears in both Home and Away selects", () => {
    renderDrawer({
      roomOptions: [...DEFAULT_ROOM_OPTIONS, { code: "E9", name: "Garderobe E9 (neu)" }],
    });

    const selects = screen.getAllByRole("combobox");
    for (const select of selects) {
      const options = within(select).getAllByRole("option").map((o) => o.textContent);
      expect(options).toContain("Garderobe E9 (neu)");
    }
  });

  it("a renamed room shows its current canonical name instead of the raw code", () => {
    renderDrawer({ roomOptions: [{ code: "E1", name: "Garderobe Nord (umbenannt)" }] });

    const selects = screen.getAllByRole("combobox");
    const homeOptions = within(selects[0]!).getAllByRole("option").map((o) => o.textContent);

    expect(homeOptions).toContain("Garderobe Nord (umbenannt)");
    expect(homeOptions).not.toContain("E1");
  });

  it("an archived room absent from roomOptions is excluded from the selects", () => {
    renderDrawer({ roomOptions: [{ code: "E1", name: "E1" }] });

    const selects = screen.getAllByRole("combobox");
    const homeOptions = within(selects[0]!).getAllByRole("option").map((o) => o.textContent);

    expect(homeOptions).toContain("E1");
    expect(homeOptions).not.toContain("E2");
  });

  it("calls onChangeHomeRoom with the selected room code", () => {
    const onChangeHomeRoom = vi.fn();
    renderDrawer({ onChangeHomeRoom });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0]!, { target: { value: "E2" } });

    expect(onChangeHomeRoom).toHaveBeenCalledWith("E2");
  });

  it("calls onChangeAwayRoom with the selected room code", () => {
    const onChangeAwayRoom = vi.fn();
    renderDrawer({ onChangeAwayRoom });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1]!, { target: { value: "E1" } });

    expect(onChangeAwayRoom).toHaveBeenCalledWith("E1");
  });

  it("renders availability badges for each canonical room, marking occupied ones", () => {
    renderDrawer({ occupiedRooms: ["E1"] });

    expect(screen.getByText(/E1 belegt/)).toBeInTheDocument();
    expect(screen.getByText(/E2 frei/)).toBeInTheDocument();
  });

  it("returns null (renders nothing) when no event is selected", () => {
    const { container } = renderDrawer({ event: null });
    expect(container).toBeEmptyDOMElement();
  });
});
