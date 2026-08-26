/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-REGRESSION-01D — Wednesday 26.08.2026 golden fixture coverage.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  buildWednesday20260826Feed,
  resolveWednesdayPreviewCurrentTimeIso,
  WEDNESDAY_2026_08_26_PREVIEW_TIMES,
  WEDNESDAY_COHORT_TEAM_NAMES,
} from "@/components/infoboard/screen1/wednesday-2026-08-26-fixture";

const BRANDING = {
  clubLogoSrc: "/images/logos/fc-allschwil.png",
  productLogoSrc: "/images/branding/sportclubevo_logo.png",
};

function renderWednesdayAt(at: keyof typeof WEDNESDAY_2026_08_26_PREVIEW_TIMES) {
  const nowIso = resolveWednesdayPreviewCurrentTimeIso(at);
  const feed = buildWednesday20260826Feed(nowIso);
  return render(
    <InfoboardScreen1 feed={feed} branding={BRANDING} currentTimeIso={nowIso} />,
  );
}

function findTrainingGroupCard(trainingCount: string): HTMLElement {
  const card = screen.getAllByTestId("event-row").find(
    (row) =>
      row.getAttribute("data-type") === "TRAINING" &&
      row.getAttribute("data-training-count") === trainingCount,
  );
  if (card === undefined) {
    throw new Error(`Expected training card with ${trainingCount} rows`);
  }
  return card;
}

describe("Wednesday 2026-08-26 golden fixture", () => {
  it("exposes deterministic preview times in Europe/Zurich", () => {
    expect(WEDNESDAY_2026_08_26_PREVIEW_TIMES["15:45"]).toBe("2026-08-26T13:45:00.000Z");
    expect(WEDNESDAY_2026_08_26_PREVIEW_TIMES["20:15"]).toBe("2026-08-26T18:15:00.000Z");
  });

  it("15:45 — includes complete E3/F2/F3/G cohort with left TIME card", () => {
    renderWednesdayAt("15:45");

    const groupCard = findTrainingGroupCard("4");

    for (const teamName of WEDNESDAY_COHORT_TEAM_NAMES.at1545) {
      expect(within(groupCard).getByText(teamName)).toBeTruthy();
    }

    expect(within(groupCard).getByTestId("training-cohort-start-time").textContent).toBe("15:45");
    expect(within(groupCard).getByTestId("training-cohort-end-time").textContent).toBe("bis 17:15");

    const f3Annotation = within(groupCard).getByTestId("training-row-end-annotation");
    expect(f3Annotation.textContent).toBe("bis 18:45");

    for (const row of within(groupCard).getAllByTestId("training-group-row")) {
      expect(row.textContent?.toLowerCase()).not.toMatch(/\bbis\b/);
    }
  });

  it("17:15 — five-row cohort uses compact group density", () => {
    renderWednesdayAt("17:15");

    const compactCard = findTrainingGroupCard("5");
    expect(compactCard.getAttribute("data-group-density")).toBe("compact");

    for (const teamName of WEDNESDAY_COHORT_TEAM_NAMES.at1715) {
      expect(within(compactCard).getByText(teamName)).toBeTruthy();
    }

    expect(within(compactCard).getAllByTestId("training-group-row")).toHaveLength(5);
  });

  it("18:45 — six-row cohort remains readable with row alignment", () => {
    renderWednesdayAt("18:45");

    const denseCard = findTrainingGroupCard("6");
    expect(denseCard.getAttribute("data-group-density")).toBe("dense");

    for (const teamName of WEDNESDAY_COHORT_TEAM_NAMES.at1845) {
      expect(within(denseCard).getByText(teamName)).toBeTruthy();
    }

    const teamRows = within(denseCard).getAllByTestId("training-group-row");
    const kabineZone = denseCard.querySelector('[class*="cardDressingRoomZone"]');
    expect(kabineZone).toBeTruthy();
    const kabineAlignedRows = kabineZone?.querySelectorAll('[class*="trainingGroupAlignedRow"]');
    expect(kabineAlignedRows?.length).toBe(6);
    expect(teamRows).toHaveLength(6);
  });

  it("19:45 — renders 1. Mannschaft match card", () => {
    renderWednesdayAt("19:45");
    expect(screen.getByText("1. MANNSCHAFT")).toBeTruthy();
    expect(screen.getByText("FC MUTTENZ")).toBeTruthy();
  });

  it("20:15 — renders Senioren 30+ and Junioren A cohort", () => {
    renderWednesdayAt("20:15");

    const groupCard = findTrainingGroupCard("2");

    for (const teamName of WEDNESDAY_COHORT_TEAM_NAMES.at2015) {
      expect(within(groupCard).getByText(teamName)).toBeTruthy();
    }

    expect(within(groupCard).getByTestId("training-cohort-start-time").textContent).toBe("20:15");
    expect(within(groupCard).getByTestId("training-cohort-end-time").textContent).toBe("bis 21:45");
  });

  it("15:44 — Junioren G is visible before cohort start", () => {
    renderWednesdayAt("15:44");
    const groupCard = findTrainingGroupCard("4");
    expect(within(groupCard).getByText("JUNIOREN G")).toBeTruthy();
  });
});
