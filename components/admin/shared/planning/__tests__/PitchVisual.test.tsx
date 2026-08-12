/**
 * @vitest-environment jsdom
 *
 * PLANNING-RESOURCE-UX-01 — focused tests for the shared PitchVisual component.
 * Verifies that half-pitch side detection, state colors, and rendering are correct.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PitchVisual, detectHalfSide } from "@/components/admin/shared/planning/PitchVisual";

describe("detectHalfSide", () => {
  it("returns A for names containing 'Hälfte A'", () => {
    expect(detectHalfSide("Kunstrasen 2 Hälfte A")).toBe("A");
  });

  it("returns B for names containing 'Hälfte B'", () => {
    expect(detectHalfSide("Kunstrasen 2 Hälfte B")).toBe("B");
  });

  it("returns A for names ending with ' A'", () => {
    expect(detectHalfSide("Kunstrasen 3 A")).toBe("A");
  });

  it("returns B for names ending with ' B'", () => {
    expect(detectHalfSide("Kunstrasen 3 B")).toBe("B");
  });

  it("defaults to A for unrecognized patterns", () => {
    expect(detectHalfSide("Spielfeld")).toBe("A");
  });
});

describe("PitchVisual", () => {
  it("renders without errors for FULL_PITCH", () => {
    const { container } = render(
      <PitchVisual resourceType="FULL_PITCH" resourceName="Hauptplatz" state="free" />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders without errors for HALF_PITCH", () => {
    const { container } = render(
      <PitchVisual resourceType="HALF_PITCH" resourceName="Kunstrasen 2 Hälfte A" state="free" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // Both half labels A and B should be present
    const texts = Array.from(svg!.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toContain("A");
    expect(texts).toContain("B");
  });

  it("renders a fallback for DRESSING_ROOM type (as Halle)", () => {
    const { container } = render(
      <PitchVisual resourceType="DRESSING_ROOM" resourceName="Garderobe 1" state="neutral" />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("uses compact dimensions when compact=true", () => {
    const { container } = render(
      <PitchVisual resourceType="FULL_PITCH" resourceName="Hauptplatz" state="free" compact />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("72");
    expect(svg?.getAttribute("height")).toBe("44");
  });
});
