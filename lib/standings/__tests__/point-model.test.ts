/**
 * Tests for lib/standings/point-model.ts
 *
 * Covers:
 *   A. DefaultPointModel values
 *   B. resolveOutcomes
 *   C. IPointModel interface compliance
 */

import { describe, it, expect } from "vitest";
import { DefaultPointModel, defaultPointModel, resolveOutcomes } from "../point-model";

describe("DefaultPointModel", () => {
  it("awards 3 points for a win", () => {
    expect(new DefaultPointModel().pointsFor("WIN")).toBe(3);
  });

  it("awards 1 point for a draw", () => {
    expect(new DefaultPointModel().pointsFor("DRAW")).toBe(1);
  });

  it("awards 0 points for a loss", () => {
    expect(new DefaultPointModel().pointsFor("LOSS")).toBe(0);
  });

  it("constants match expected values", () => {
    expect(DefaultPointModel.WIN_POINTS).toBe(3);
    expect(DefaultPointModel.DRAW_POINTS).toBe(1);
    expect(DefaultPointModel.LOSS_POINTS).toBe(0);
  });

  it("singleton defaultPointModel behaves identically", () => {
    expect(defaultPointModel.pointsFor("WIN")).toBe(3);
    expect(defaultPointModel.pointsFor("DRAW")).toBe(1);
    expect(defaultPointModel.pointsFor("LOSS")).toBe(0);
  });
});

describe("resolveOutcomes", () => {
  it("home win when scoreHome > scoreAway", () => {
    const { home, away } = resolveOutcomes(3, 1);
    expect(home).toBe("WIN");
    expect(away).toBe("LOSS");
  });

  it("away win when scoreAway > scoreHome", () => {
    const { home, away } = resolveOutcomes(0, 2);
    expect(home).toBe("LOSS");
    expect(away).toBe("WIN");
  });

  it("draw when scores are equal", () => {
    const { home, away } = resolveOutcomes(1, 1);
    expect(home).toBe("DRAW");
    expect(away).toBe("DRAW");
  });

  it("0-0 is a draw", () => {
    const { home, away } = resolveOutcomes(0, 0);
    expect(home).toBe("DRAW");
    expect(away).toBe("DRAW");
  });

  it("high-scoring home win", () => {
    const { home, away } = resolveOutcomes(10, 0);
    expect(home).toBe("WIN");
    expect(away).toBe("LOSS");
  });
});
