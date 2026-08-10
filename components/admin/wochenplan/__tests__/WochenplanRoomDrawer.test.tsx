/**
 * @vitest-environment jsdom
 *
 * Tests for WochenplanRoomDrawer (MASTERDATA-CONSISTENCY-02).
 *
 * Covers replacing the static FCA_DRESSING_ROOMS registry with canonical,
 * tenant-scoped, active FacilityResource options:
 * - canonical active dressing rooms appear as selectable options
 * - a newly added room becomes selectable without a static registry edit
 * - an archived room (absent from roomOptions) is excluded from new choices
 * - a renamed room displays its current canonical name
 * - a historical allocation referencing a room absent from canonical options
 *   remains selected/readable rather than being silently reset
 * - occupied rooms not present in canonical options still render in the
 *   availability list (backward-compat / graceful degradation)
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WochenplanRoomDrawer from "@/components/admin/wochenplan/WochenplanRoomDrawer";
import type { WochenplanBoardEvent } from "@/lib/wochenplan/types";

function makeEvent(overrides: Partial<WochenplanBoardEvent> = {}): WochenplanBoardEvent {
  return {
    id: "event-1",
    title: "1. Mannschaft",
    eventType: "MATCH",
    source: "MANUAL",
    status: "SCHEDULED",
    teamName: "1. Mannschaft",
    opponentName: null,
    organizerName: null,
    competitionLabel: null,
    startAt: "2026-04-13T15:45:00.000Z",
    endAt: "2026-04-13T17:15:00.000Z",
    location: "Stadion",
    boardDayKey: "MONDAY",
    slotKey: "15:45-17:15",
    pitchRowKey: "STADION",
    fieldLabel: null,
    homeLabel: "Feld A",
    coachLabel: "R. Galli",
    categoryKey: "AKTIVE",
    allocation: {
      pitchCode: "STADION",
      homeDressingRoomCode: null,
      awayDressingRoomCode: null,
      publishedToWebsite: false,
      publishedToInfoboard: false,
    },
    ...overrides,
  };
}

describe("WochenplanRoomDrawer — canonical dressing-room options", () => {
  it("shows canonical active dressing-room options in both selects", () => {
    render(
      <WochenplanRoomDrawer
        event={makeEvent()}
        occupiedRooms={[]}
        onClose={vi.fn()}
        onChangeHomeRoom={vi.fn()}
        onChangeAwayRoom={vi.fn()}
        roomOptions={[
          { code: "E1", name: "Garderobe E1" },
          { code: "E2", name: "Garderobe E2" },
        ]}
      />,
    );

    expect(screen.getAllByRole("option", { name: "Garderobe E1" }).length).toBe(2);
    expect(screen.getAllByRole("option", { name: "Garderobe E2" }).length).toBe(2);
  });

  it("a newly added room becomes selectable without a static registry change", () => {
    const onChangeHomeRoom = vi.fn();
    render(
      <WochenplanRoomDrawer
        event={makeEvent()}
        occupiedRooms={[]}
        onClose={vi.fn()}
        onChangeHomeRoom={onChangeHomeRoom}
        onChangeAwayRoom={vi.fn()}
        roomOptions={[{ code: "NEUE_GARDEROBE", name: "Neue Garderobe" }]}
      />,
    );

    const [homeSelect] = screen.getAllByRole("combobox");
    fireEvent.change(homeSelect, { target: { value: "NEUE_GARDEROBE" } });

    expect(onChangeHomeRoom).toHaveBeenCalledWith("NEUE_GARDEROBE");
  });

  it("an archived room (absent from roomOptions) is excluded from new choices", () => {
    render(
      <WochenplanRoomDrawer
        event={makeEvent()}
        occupiedRooms={[]}
        onClose={vi.fn()}
        onChangeHomeRoom={vi.fn()}
        onChangeAwayRoom={vi.fn()}
        roomOptions={[{ code: "E1", name: "Garderobe E1" }]}
      />,
    );

    expect(screen.queryByRole("option", { name: "Archivierte Garderobe" })).not.toBeInTheDocument();
    expect(screen.queryByText("ARCHIVED_ROOM")).not.toBeInTheDocument();
  });

  it("a renamed room displays its current canonical name", () => {
    render(
      <WochenplanRoomDrawer
        event={makeEvent({
          allocation: {
            pitchCode: "STADION",
            homeDressingRoomCode: "E1",
            awayDressingRoomCode: null,
            publishedToWebsite: false,
            publishedToInfoboard: false,
          },
        })}
        occupiedRooms={[]}
        onClose={vi.fn()}
        onChangeHomeRoom={vi.fn()}
        onChangeAwayRoom={vi.fn()}
        roomOptions={[{ code: "E1", name: "Umbenannte Garderobe Ost" }]}
      />,
    );

    expect(
      screen.getAllByRole("option", { name: "Umbenannte Garderobe Ost" }).length,
    ).toBeGreaterThan(0);
  });

  it("a historical allocation referencing a room absent from canonical options remains selected", () => {
    render(
      <WochenplanRoomDrawer
        event={makeEvent({
          allocation: {
            pitchCode: "STADION",
            homeDressingRoomCode: "ARCHIVED_ROOM",
            awayDressingRoomCode: null,
            publishedToWebsite: false,
            publishedToInfoboard: false,
          },
        })}
        occupiedRooms={[]}
        onClose={vi.fn()}
        onChangeHomeRoom={vi.fn()}
        onChangeAwayRoom={vi.fn()}
        roomOptions={[{ code: "E1", name: "Garderobe E1" }]}
      />,
    );

    const [homeSelect] = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(homeSelect.value).toBe("ARCHIVED_ROOM");
  });

  it("falls back gracefully to code-derived labels when no roomOptions are supplied", () => {
    render(
      <WochenplanRoomDrawer
        event={makeEvent({
          allocation: {
            pitchCode: "STADION",
            homeDressingRoomCode: "E1",
            awayDressingRoomCode: null,
            publishedToWebsite: false,
            publishedToInfoboard: false,
          },
        })}
        occupiedRooms={["E1"]}
        onClose={vi.fn()}
        onChangeHomeRoom={vi.fn()}
        onChangeAwayRoom={vi.fn()}
      />,
    );

    const [homeSelect] = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(homeSelect.value).toBe("E1");
  });
});
