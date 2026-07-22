import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizeOpponentName,
} from "../display-name";

describe("normalizeOpponentName", () => {
  it("trims leading and trailing whitespace", () => {
    expect(
      normalizeOpponentName(
        "  FC Basel  ",
      ),
    ).toBe("fc basel");
  });

  it("collapses repeated internal whitespace", () => {
    expect(
      normalizeOpponentName(
        "FC   Basel\t1893",
      ),
    ).toBe("fc basel 1893");
  });

  it("normalizes casing", () => {
    expect(
      normalizeOpponentName(
        "FC BASEL",
      ),
    ).toBe(
      normalizeOpponentName(
        "fc basel",
      ),
    );
  });

  it("preserves meaningful punctuation", () => {
    expect(
      normalizeOpponentName(
        "FC Aesch-Reinach 1908",
      ),
    ).toBe(
      "fc aesch-reinach 1908",
    );
  });

  it("rejects an empty normalized value", () => {
    expect(() =>
      normalizeOpponentName(
        "   \t\n ",
      ),
    ).toThrow(
      "Opponent name must not be empty.",
    );
  });
});