/**
 * lib/publishing/infoboard/__tests__/screen1-capacity-admission.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  admitDisplayItemsByCapacity,
  SCREEN1_CAPACITY_MAX,
} from "../screen1-capacity-admission";

type TestItem = { id: string; temporal: "current" | "next" | "later" };

function temporal(item: TestItem) {
  return item.temporal;
}

describe("admitDisplayItemsByCapacity", () => {
  it("always retains current active items", () => {
    const items: TestItem[] = [
      { id: "a", temporal: "current" },
      { id: "b", temporal: "current" },
    ];
    const demands = [6, 6];
    const admitted = admitDisplayItemsByCapacity(items, demands, temporal, 8);
    expect(admitted.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("always retains next upcoming block", () => {
    const items: TestItem[] = [
      { id: "cur", temporal: "current" },
      { id: "next", temporal: "next" },
    ];
    const demands = [8, 5];
    const admitted = admitDisplayItemsByCapacity(items, demands, temporal, 10);
    expect(admitted.map((i) => i.id)).toEqual(["cur", "next"]);
  });

  it("excludes later event when capacity exceeded", () => {
    const items: TestItem[] = [
      { id: "cur", temporal: "current" },
      { id: "next", temporal: "next" },
      { id: "later-match", temporal: "later" },
    ];
    const demands = [5, 4, 3];
    const admitted = admitDisplayItemsByCapacity(items, demands, temporal, 10);
    expect(admitted.map((i) => i.id)).toEqual(["cur", "next"]);
  });

  it("admits later Match after earlier Training expires and frees capacity", () => {
    const beforeExpiry: TestItem[] = [
      { id: "training", temporal: "current" },
      { id: "next-block", temporal: "next" },
      { id: "match-2015", temporal: "later" },
    ];
    const demands = [6.0, 5.0, 2.2];
    const admittedBefore = admitDisplayItemsByCapacity(
      beforeExpiry,
      demands,
      temporal,
      SCREEN1_CAPACITY_MAX,
    );
    expect(admittedBefore.map((i) => i.id)).toEqual(["training", "next-block"]);

    const afterExpiry: TestItem[] = [
      { id: "next-block", temporal: "next" },
      { id: "match-2015", temporal: "later" },
    ];
    const demandsAfter = [3.5, 2.2];
    const admittedAfter = admitDisplayItemsByCapacity(
      afterExpiry,
      demandsAfter,
      temporal,
      SCREEN1_CAPACITY_MAX,
    );
    expect(admittedAfter.map((i) => i.id)).toEqual(["next-block", "match-2015"]);
  });

  it("preserves deterministic ordering within priority tiers", () => {
    const items: TestItem[] = [
      { id: "c1", temporal: "current" },
      { id: "c2", temporal: "current" },
      { id: "n1", temporal: "next" },
      { id: "l1", temporal: "later" },
      { id: "l2", temporal: "later" },
    ];
    const demands = [2, 2, 2, 1, 1];
    const admitted = admitDisplayItemsByCapacity(items, demands, temporal, 20);
    expect(admitted.map((i) => i.id)).toEqual(["c1", "c2", "n1", "l1", "l2"]);
  });

  it("returns empty array for empty input", () => {
    expect(admitDisplayItemsByCapacity([], [], temporal)).toEqual([]);
  });
});
