/**
 * @vitest-environment jsdom
 *
 * MASTERDATA-CONSISTENCY-02 (C1) — Wochenplan Schnellkorrektur regression
 * tests for WochenplanRoomDayPlannerDialog.
 *
 * Covers:
 *   - the previously hardcoded DRESSING_ROOMS array is gone; both the
 *     drag/drop rows and the Schnellkorrektur selects render exactly the
 *     canonical `roomOptions` prop passed in.
 *   - a newly created room appears (simply present in `roomOptions`).
 *   - a renamed room shows its current canonical name, not a raw code.
 *   - an archived room is excluded from choices when absent from
 *     `roomOptions` (caller-side withRequiredCodes decides what stays
 *     visible for historical compatibility).
 *   - a historical/archived-but-still-referenced code passed in via
 *     `roomOptions` (simulating the withRequiredCodes merge) remains
 *     selected/visible rather than being silently reset.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WochenplanRoomDayPlannerDialog from "@/components/admin/wochenplan/WochenplanRoomDayPlannerDialog";
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

function renderDialog(overrides: Partial<React.ComponentProps<typeof WochenplanRoomDayPlannerDialog>> = {}) {
  return render(
    <WochenplanRoomDayPlannerDialog
      isOpen
      dayKey="MONDAY"
      dayLabel="Montag 10. August 2026"
      events={[makeEvent()]}
      roomConflicts={[]}
      onClose={() => {}}
      onChangeRoom={() => {}}
      roomOptions={DEFAULT_ROOM_OPTIONS}
      {...overrides}
    />,
  );
}

describe("WochenplanRoomDayPlannerDialog — canonical roomOptions", () => {
  it("renders a drag/drop row for every room in roomOptions", () => {
    renderDialog();

    // "E1"/"E2" appear both as the row heading and as Schnellkorrektur
    // <option> text — assert at least one occurrence of each.
    expect(screen.getAllByText("E1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("E2").length).toBeGreaterThan(0);
  });

  it("a newly created room (present in roomOptions) appears as a drag/drop row", () => {
    renderDialog({
      roomOptions: [...DEFAULT_ROOM_OPTIONS, { code: "E9", name: "Garderobe E9 (neu)" }],
    });

    expect(screen.getAllByText("Garderobe E9 (neu)").length).toBeGreaterThan(0);
  });

  it("a renamed room shows its current canonical name in the drag/drop row heading", () => {
    renderDialog({
      roomOptions: [{ code: "E1", name: "Garderobe Nord (umbenannt)" }],
    });

    expect(screen.getAllByText("Garderobe Nord (umbenannt)").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("E1")).toHaveLength(0);
  });

  it("an archived room absent from roomOptions is excluded from the drag/drop rows", () => {
    renderDialog({ roomOptions: [{ code: "E1", name: "E1" }] });

    expect(screen.getAllByText("E1").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("E2")).toHaveLength(0);
  });

  it("renders a Schnellkorrektur select with an <option> for every room in roomOptions", () => {
    renderDialog();

    const selects = screen.getAllByRole("combobox");
    // Two selects rendered per event row (Home / Away).
    expect(selects.length).toBeGreaterThanOrEqual(2);

    for (const select of selects) {
      const options = within(select).getAllByRole("option").map((o) => o.textContent);
      expect(options).toEqual(expect.arrayContaining(["E1", "E2"]));
    }
  });

  it("Schnellkorrektur select options use the canonical current name, not the raw code, when renamed", () => {
    renderDialog({
      roomOptions: [{ code: "E1", name: "Garderobe Süd" }],
    });

    const selects = screen.getAllByRole("combobox");
    const firstSelectOptions = within(selects[0]!).getAllByRole("option").map((o) => o.textContent);

    expect(firstSelectOptions).toContain("Garderobe Süd");
    expect(firstSelectOptions).not.toContain("E1");
  });

  it("keeps a historical/archived room code selected when the caller merges it back into roomOptions", () => {
    // Simulates the caller's withRequiredCodes() merge: the event's
    // homeDressingRoomCode ("E1") is no longer part of the tenant's active
    // set, but has been merged back in as a historical fallback option.
    renderDialog({
      events: [makeEvent({ allocation: { pitchCode: "STADION", homeDressingRoomCode: "E1", awayDressingRoomCode: null, publishedToWebsite: false, publishedToInfoboard: false } })],
      roomOptions: [{ code: "E1", name: "E1 (archiviert)" }, { code: "E2", name: "E2" }],
    });

    const homeSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    expect(homeSelect.value).toBe("E1");
  });
});
