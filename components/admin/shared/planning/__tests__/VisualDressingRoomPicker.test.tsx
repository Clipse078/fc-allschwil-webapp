/**
 * @vitest-environment jsdom
 *
 * TRAINING-CENTER-PREMIUM-02 — aggregated dressing room picker tests.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VisualDressingRoomPicker } from "@/components/admin/shared/planning/VisualDressingRoomPicker";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import type { ResourceAvailabilityAnnotation } from "@/components/admin/training/FacilityResourceSelector";

const FACILITY_GROUPS: FacilityGroup[] = [
  {
    facilityId: "fac-1",
    facilityName: "Sportanlage",
    resources: [
      { id: "room-free", name: "E1", code: "E1", type: "DRESSING_ROOM", facilityId: "fac-1", facilityName: "Sportanlage" },
      { id: "room-occupied", name: "O4", code: "O4", type: "DRESSING_ROOM", facilityId: "fac-1", facilityName: "Sportanlage" },
    ],
  },
];

const MIXED_AVAILABILITY = new Map<string, ResourceAvailabilityAnnotation>([
  ["room-free", { status: "FREE" }],
  [
    "room-occupied",
    {
      status: "OCCUPIED",
      conflictLabel: "Junioren D-9 D1 Training",
      conflictStartAt: "2026-09-20T16:45:00.000Z",
      conflictEndAt: "2026-09-20T18:15:00.000Z",
    },
  ],
]);

describe("VisualDressingRoomPicker — aggregated layout", () => {
  it("shows free rooms in available section before occupied rooms", () => {
    render(
      <VisualDressingRoomPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set()}
        onSelect={vi.fn()}
        onDeselect={vi.fn()}
        availabilityByResourceId={MIXED_AVAILABILITY}
        layout="aggregated"
        testId="dressing-picker"
      />,
    );

    const available = screen.getByTestId("dressing-picker-available");
    const occupied = screen.getByTestId("dressing-picker-occupied");

    expect(available).toHaveTextContent("E1");
    expect(available).not.toHaveTextContent("O4");
    expect(occupied).toHaveTextContent("O4");
    expect(occupied).toHaveTextContent("Belegt");
    expect(occupied).toHaveTextContent("Junioren D-9 D1 Training");
  });

  it("allows selecting a free dressing room", () => {
    const onSelect = vi.fn();
    render(
      <VisualDressingRoomPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set()}
        onSelect={onSelect}
        onDeselect={vi.fn()}
        availabilityByResourceId={MIXED_AVAILABILITY}
        layout="aggregated"
        testId="dressing-picker"
      />,
    );

    fireEvent.click(screen.getByTestId("dressing-picker-card-room-free"));
    expect(onSelect).toHaveBeenCalledWith("room-free");
  });
});

describe("VisualDressingRoomPicker — reversible selection (TRAINING-CENTER-PREMIUM-02B)", () => {
  it("deselects a free dressing room via summary remove action", () => {
    const onDeselect = vi.fn();
    render(
      <VisualDressingRoomPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set(["room-free"])}
        onSelect={vi.fn()}
        onDeselect={onDeselect}
        availabilityByResourceId={MIXED_AVAILABILITY}
        layout="aggregated"
        testId="dressing-picker"
      />,
    );

    fireEvent.click(screen.getByTestId("dressing-picker-remove-room-free"));
    expect(onDeselect).toHaveBeenCalledWith("room-free");
  });

  it("deselects a free dressing room when the card is clicked again", () => {
    const onDeselect = vi.fn();
    render(
      <VisualDressingRoomPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set(["room-free"])}
        onSelect={vi.fn()}
        onDeselect={onDeselect}
        availabilityByResourceId={MIXED_AVAILABILITY}
        layout="aggregated"
        testId="dressing-picker"
      />,
    );

    fireEvent.click(screen.getByTestId("dressing-picker-card-room-free"));
    expect(onDeselect).toHaveBeenCalledWith("room-free");
  });

  it("does not select an occupied dressing room without confirm", () => {
    const onSelect = vi.fn();
    render(
      <VisualDressingRoomPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set()}
        onSelect={onSelect}
        onDeselect={vi.fn()}
        availabilityByResourceId={MIXED_AVAILABILITY}
        layout="aggregated"
        testId="dressing-picker"
      />,
    );

    fireEvent.click(screen.getByTestId("dressing-picker-card-room-occupied"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId("dressing-picker-occupied-confirm-room-occupied")).toBeInTheDocument();
  });

  it("selects an occupied dressing room via Trotzdem zuweisen", () => {
    const onSelect = vi.fn();
    render(
      <VisualDressingRoomPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set()}
        onSelect={onSelect}
        onDeselect={vi.fn()}
        availabilityByResourceId={MIXED_AVAILABILITY}
        layout="aggregated"
        testId="dressing-picker"
      />,
    );

    fireEvent.click(screen.getByTestId("dressing-picker-card-room-occupied"));
    fireEvent.click(screen.getByTestId("dressing-picker-assign-anyway-room-occupied"));
    expect(onSelect).toHaveBeenCalledWith("room-occupied");
  });

  it("deselects an occupied override via summary remove action", () => {
    const onDeselect = vi.fn();
    render(
      <VisualDressingRoomPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set(["room-occupied"])}
        onSelect={vi.fn()}
        onDeselect={onDeselect}
        availabilityByResourceId={MIXED_AVAILABILITY}
        layout="aggregated"
        testId="dressing-picker"
      />,
    );

    fireEvent.click(screen.getByTestId("dressing-picker-remove-room-occupied"));
    expect(onDeselect).toHaveBeenCalledWith("room-occupied");
  });

  it("deselects an occupied override when the selected chip is clicked again", () => {
    const onDeselect = vi.fn();
    render(
      <VisualDressingRoomPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set(["room-occupied"])}
        onSelect={vi.fn()}
        onDeselect={onDeselect}
        availabilityByResourceId={MIXED_AVAILABILITY}
        layout="aggregated"
        testId="dressing-picker"
      />,
    );

    fireEvent.click(screen.getByTestId("dressing-picker-card-room-occupied"));
    expect(onDeselect).toHaveBeenCalledWith("room-occupied");
  });
});
