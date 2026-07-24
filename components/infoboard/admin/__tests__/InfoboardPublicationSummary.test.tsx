/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/admin/__tests__/InfoboardPublicationSummary.test.tsx
 *
 * Tests for InfoboardPublicationSummary.
 *
 * Verifies:
 *   - All four KPI labels render in German
 *   - Zero counts render correctly (not treated as errors)
 *   - Non-zero counts render correctly
 *   - displayDate is rendered
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { InfoboardPublicationSummary } from "../InfoboardPublicationSummary";

const ZERO_COUNTS = {
  visibleToday: 0,
  currentCount: 0,
  nextCount: 0,
  laterCount: 0,
};

const FILLED_COUNTS = {
  visibleToday: 7,
  currentCount: 2,
  nextCount: 3,
  laterCount: 2,
};

describe("InfoboardPublicationSummary", () => {
  it("renders all four KPI labels", () => {
    render(
      <InfoboardPublicationSummary counts={ZERO_COUNTS} displayDate="2026-07-24" />,
    );

    expect(screen.getByText("Heute sichtbar")).toBeInTheDocument();
    expect(screen.getByText("Jetzt aktiv")).toBeInTheDocument();
    expect(screen.getByText("Als Nächstes")).toBeInTheDocument();
    expect(screen.getByText("Später heute")).toBeInTheDocument();
  });

  it("renders zero counts without error", () => {
    render(
      <InfoboardPublicationSummary counts={ZERO_COUNTS} displayDate="2026-07-24" />,
    );

    const zeros = screen.getAllByText("0");
    expect(zeros).toHaveLength(4);
  });

  it("renders non-zero counts correctly", () => {
    render(
      <InfoboardPublicationSummary counts={FILLED_COUNTS} displayDate="2026-07-24" />,
    );

    expect(screen.getByText("7")).toBeInTheDocument();
    // currentCount=2 and laterCount=2 both render; use getAllByText
    const twos = screen.getAllByText("2");
    expect(twos.length).toBe(2);
    expect(screen.getByText("3")).toBeInTheDocument(); // nextCount
  });

  it("renders the display date", () => {
    render(
      <InfoboardPublicationSummary counts={ZERO_COUNTS} displayDate="2026-07-25" />,
    );

    expect(screen.getByText("2026-07-25")).toBeInTheDocument();
  });
});
