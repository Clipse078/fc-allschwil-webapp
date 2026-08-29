/**
 * @vitest-environment jsdom
 *
 * PLANNING-RESOURCE-UX-01 — focused tests for the shared visual resource picker.
 * Verifies availability display, recommended resources, and select/deselect behavior.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VisualResourceAvailabilityPicker } from "@/components/admin/shared/planning/VisualResourceAvailabilityPicker";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import type { ResourceAvailabilityAnnotation } from "@/components/admin/training/FacilityResourceSelector";

const FACILITY_GROUPS: FacilityGroup[] = [
  {
    facilityId: "fac-1",
    facilityName: "Sportanlage Brüel",
    resources: [
      { id: "res-pitch-a", name: "Kunstrasen 2", code: "KR2", type: "FULL_PITCH", facilityId: "fac-1", facilityName: "Sportanlage Brüel" },
      { id: "res-pitch-b", name: "Kunstrasen 3 A", code: "KR3A", type: "HALF_PITCH", facilityId: "fac-1", facilityName: "Sportanlage Brüel" },
    ],
  },
];

const FREE_AVAILABILITY = new Map<string, ResourceAvailabilityAnnotation>([
  ["res-pitch-a", { status: "FREE" }],
  ["res-pitch-b", { status: "FREE" }],
]);

const MIXED_AVAILABILITY = new Map<string, ResourceAvailabilityAnnotation>([
  ["res-pitch-a", { status: "FREE" }],
  ["res-pitch-b", { status: "OCCUPIED", conflictLabel: "Training E2", conflictStartAt: "2026-09-20T15:00:00.000Z", conflictEndAt: "2026-09-20T16:00:00.000Z" }],
]);

describe("VisualResourceAvailabilityPicker — availability display", () => {
  it("shows 'verfügbar' and 'belegt' counts when availability is known", () => {
    render(
      <VisualResourceAvailabilityPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set()}
        onSelect={vi.fn()}
        onDeselect={vi.fn()}
        availabilityByResourceId={MIXED_AVAILABILITY}
      />,
    );

    expect(screen.getByText("1 frei")).toBeInTheDocument();
    expect(screen.getByText("1 belegt")).toBeInTheDocument();
  });

  it("shows all resources as neutral when no availability data", () => {
    render(
      <VisualResourceAvailabilityPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set()}
        onSelect={vi.fn()}
        onDeselect={vi.fn()}
      />,
    );

    expect(screen.getByText("Kunstrasen 2")).toBeInTheDocument();
    expect(screen.getByText("Kunstrasen 3 A")).toBeInTheDocument();
  });

  it("shows 'Frei' badge for free resources", () => {
    render(
      <VisualResourceAvailabilityPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set()}
        onSelect={vi.fn()}
        onDeselect={vi.fn()}
        availabilityByResourceId={FREE_AVAILABILITY}
      />,
    );

    const freiBadges = screen.getAllByText("Frei");
    expect(freiBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Belegt' badge and conflict label for occupied resources", () => {
    render(
      <VisualResourceAvailabilityPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set()}
        onSelect={vi.fn()}
        onDeselect={vi.fn()}
        availabilityByResourceId={MIXED_AVAILABILITY}
      />,
    );

    expect(screen.getByText("Belegt")).toBeInTheDocument();
    expect(screen.getByText("Training E2")).toBeInTheDocument();
  });
});

describe("VisualResourceAvailabilityPicker — recommended resources", () => {
  it("shows 'Empfohlen' badge for free recommended resources", () => {
    render(
      <VisualResourceAvailabilityPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set()}
        onSelect={vi.fn()}
        onDeselect={vi.fn()}
        availabilityByResourceId={FREE_AVAILABILITY}
        maxRecommended={1}
      />,
    );

    expect(screen.getByText("Empfohlen")).toBeInTheDocument();
  });
});

describe("VisualResourceAvailabilityPicker — selection", () => {
  it("calls onSelect when a free resource card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <VisualResourceAvailabilityPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set()}
        onSelect={onSelect}
        onDeselect={vi.fn()}
        availabilityByResourceId={FREE_AVAILABILITY}
        testId="picker"
      />,
    );

    fireEvent.click(screen.getByTestId("picker-card-res-pitch-a"));
    expect(onSelect).toHaveBeenCalledWith("res-pitch-a");
  });

  it("calls onDeselect when a selected resource card is clicked", () => {
    const onDeselect = vi.fn();
    render(
      <VisualResourceAvailabilityPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set(["res-pitch-a"])}
        onSelect={vi.fn()}
        onDeselect={onDeselect}
        availabilityByResourceId={FREE_AVAILABILITY}
        testId="picker"
      />,
    );

    fireEvent.click(screen.getByTestId("picker-card-res-pitch-a"));
    expect(onDeselect).toHaveBeenCalledWith("res-pitch-a");
  });

  it("shows 'Ausgewählt' state for selected resources", () => {
    render(
      <VisualResourceAvailabilityPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set(["res-pitch-a"])}
        onSelect={vi.fn()}
        onDeselect={vi.fn()}
        availabilityByResourceId={FREE_AVAILABILITY}
      />,
    );

    expect(screen.getByText("Ausgewählt")).toBeInTheDocument();
  });

  it("shows occupied confirm flow and allows assign via Trotzdem zuweisen", () => {
    const onSelect = vi.fn();
    render(
      <VisualResourceAvailabilityPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set()}
        onSelect={onSelect}
        onDeselect={vi.fn()}
        availabilityByResourceId={MIXED_AVAILABILITY}
        testId="picker"
      />,
    );

    fireEvent.click(screen.getByTestId("picker-card-res-pitch-b"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId("picker-occupied-confirm-res-pitch-b")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("picker-assign-anyway-res-pitch-b"));
    expect(onSelect).toHaveBeenCalledWith("res-pitch-b");
  });

  it("shows Mehrfachbelegung when an occupied resource is selected", () => {
    render(
      <VisualResourceAvailabilityPicker
        facilityGroups={FACILITY_GROUPS}
        selectedResourceIds={new Set(["res-pitch-b"])}
        onSelect={vi.fn()}
        onDeselect={vi.fn()}
        availabilityByResourceId={MIXED_AVAILABILITY}
        testId="picker"
      />,
    );

    expect(screen.getByText("Mehrfachbelegung")).toBeInTheDocument();
  });
});

describe("VisualResourceAvailabilityPicker — empty state", () => {
  it("shows empty message when no resources are configured", () => {
    render(
      <VisualResourceAvailabilityPicker
        facilityGroups={[]}
        selectedResourceIds={new Set()}
        onSelect={vi.fn()}
        onDeselect={vi.fn()}
        emptyMessage="Keine Spielfelder konfiguriert."
      />,
    );

    expect(screen.getByText("Keine Spielfelder konfiguriert.")).toBeInTheDocument();
  });
});
