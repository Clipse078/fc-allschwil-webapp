/**
 * @vitest-environment jsdom
 *
 * Tests for WochenplanRoomDayPlannerDialog (MASTERDATA-CONSISTENCY-02-C1).
 *
 * The dialog previously drove both its drag & drop room rows and its
 * "Schnellkorrektur" quick-correction selects from a locally hardcoded
 * DRESSING_ROOMS array. Covers replacing it with the canonical, tenant-
 * scoped, active roomOptions prop (the same shape/merge helper already
 * used by WochenplanRoomDrawer):
 *
 * 1. renders canonical active dressing rooms
 * 2. does not expose an archived room in new choices
 * 3. displays canonical renamed room name
 * 4. can represent an existing historical allocation absent from active options
 * 5. no longer contains/uses the local hardcoded DRESSING_ROOMS registry
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WochenplanRoomDayPlannerDialog from "@/components/admin/wochenplan/WochenplanRoomDayPlannerDialog";
import type { WochenplanBoardEvent } from "@/lib/wochenplan/types";

function makeEvent(overrides: Partial<WochenplanBoardEvent> = {}): WochenplanBoardEvent {
  return {
    id: "event-1",
    title: "1. Mannschaft",
    eventType: "MATCH",
    source: "MANUAL",
    status: "SCHEDULED",
    teamName: "1. Mannschaft",
    opponentName: "FC Muttenz",
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

function baseProps() {
  return {
    isOpen: true,
    dayKey: "MONDAY" as const,
    dayLabel: "Montag",
    events: [] as WochenplanBoardEvent[],
    roomConflicts: [],
    onClose: vi.fn(),
    onChangeRoom: vi.fn(),
  };
}

describe("WochenplanRoomDayPlannerDialog — canonical dressing-room options", () => {
  it("renders canonical active dressing rooms as room rows", () => {
    render(
      <WochenplanRoomDayPlannerDialog
        {...baseProps()}
        roomOptions={[
          { code: "E1", name: "Garderobe E1" },
          { code: "E2", name: "Garderobe E2" },
        ]}
      />,
    );

    expect(screen.getByText("Garderobe E1")).toBeInTheDocument();
    expect(screen.getByText("Garderobe E2")).toBeInTheDocument();
  });

  it("renders canonical active dressing rooms in the Schnellkorrektur selects", () => {
    render(
      <WochenplanRoomDayPlannerDialog
        {...baseProps()}
        events={[makeEvent()]}
        roomOptions={[
          { code: "E1", name: "Garderobe E1" },
          { code: "E2", name: "Garderobe E2" },
        ]}
      />,
    );

    expect(screen.getAllByRole("option", { name: "Garderobe E1" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("option", { name: "Garderobe E2" }).length).toBeGreaterThan(0);
  });

  it("does not expose an archived room (absent from roomOptions) in new choices", () => {
    render(
      <WochenplanRoomDayPlannerDialog
        {...baseProps()}
        events={[makeEvent()]}
        roomOptions={[{ code: "E1", name: "Garderobe E1" }]}
      />,
    );

    expect(screen.queryByText("Archivierte Garderobe")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Archivierte Garderobe" })).not.toBeInTheDocument();
  });

  it("displays the canonical renamed room name instead of the raw code", () => {
    render(
      <WochenplanRoomDayPlannerDialog
        {...baseProps()}
        events={[
          makeEvent({
            allocation: {
              pitchCode: "STADION",
              homeDressingRoomCode: "E1",
              awayDressingRoomCode: null,
              publishedToWebsite: false,
              publishedToInfoboard: false,
            },
          }),
        ]}
        roomOptions={[{ code: "E1", name: "Umbenannte Garderobe Ost" }]}
      />,
    );

    expect(screen.getAllByText("Umbenannte Garderobe Ost").length).toBeGreaterThan(0);
    expect(screen.queryByText("E1")).not.toBeInTheDocument();
  });

  it("keeps a historical allocation (code absent from active roomOptions) selected/readable", () => {
    render(
      <WochenplanRoomDayPlannerDialog
        {...baseProps()}
        events={[
          makeEvent({
            allocation: {
              pitchCode: "STADION",
              homeDressingRoomCode: "ARCHIVED_ROOM",
              awayDressingRoomCode: null,
              publishedToWebsite: false,
              publishedToInfoboard: false,
            },
          }),
        ]}
        roomOptions={[{ code: "E1", name: "Garderobe E1" }]}
      />,
    );

    // The historical code is merged in as its own row — the event remains visible
    // there instead of vanishing — and the Schnellkorrektur select keeps it as the
    // selected value rather than resetting to "Keine".
    expect(screen.getAllByText("1. Mannschaft").length).toBeGreaterThan(0);
    const homeSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    expect(homeSelect.value).toBe("ARCHIVED_ROOM");
  });

  it("renders zero room rows when no canonical options and no events reference any room (no hidden static fallback list)", () => {
    render(<WochenplanRoomDayPlannerDialog {...baseProps()} roomOptions={[]} />);

    // Each room row renders a "Keine Konflikte"/"Konflikt vorhanden" status line —
    // absence of both proves zero room rows were rendered from a hidden fallback list.
    expect(screen.queryByText("Keine Konflikte")).not.toBeInTheDocument();
    expect(screen.queryByText("Konflikt vorhanden")).not.toBeInTheDocument();
  });

  it("no longer defines or uses a local hardcoded DRESSING_ROOMS registry", () => {
    const sourcePath = path.join(
      process.cwd(),
      "components/admin/wochenplan/WochenplanRoomDayPlannerDialog.tsx",
    );
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toMatch(/const\s+DRESSING_ROOMS\s*=/);
    expect(source).not.toMatch(/\["E1",\s*"E2"/);
  });
});
