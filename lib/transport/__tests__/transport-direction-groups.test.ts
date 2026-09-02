/**
 * lib/transport/__tests__/transport-direction-groups.test.ts
 *
 * INFOBOARD-TRANSPORT-02-UX2 — direction group classification tests.
 */

import { describe, expect, it } from "vitest";
import { FC_ALLSCHWIL_DIRECTION_GROUPS } from "@/lib/transport/transport-config";
import {
  classifyDeparturesIntoDirectionGroups,
  resolveDepartureDirectionGroupId,
} from "@/lib/transport/transport-direction-groups";
import type { TransportDeparture } from "@/lib/transport/transport-types";

function makeDeparture(
  overrides: Partial<TransportDeparture> & Pick<TransportDeparture, "destination" | "plannedDeparture">,
): TransportDeparture {
  return {
    line: "38",
    category: "bus",
    categoryLabel: "BUS",
    realtimeDeparture: null,
    delayMinutes: null,
    platform: null,
    direction: overrides.destination,
    provider: "opendata.ch",
    hasRealtime: false,
    ...overrides,
  };
}

describe("transport direction groups", () => {
  it("classifies Allschwil Dorf departures to the left group", () => {
    const departure = makeDeparture({
      line: "38",
      destination: "Allschwil, Friedhof",
      plannedDeparture: "2026-09-02T18:49:00+0200",
      direction: "Allschwil, Friedhof",
    });

    expect(
      resolveDepartureDirectionGroupId(departure, FC_ALLSCHWIL_DIRECTION_GROUPS),
    ).toBe("allschwil-dorf");
  });

  it("classifies Basel/Bachgraben departures to the right group", () => {
    const departure = makeDeparture({
      line: "48",
      destination: "Basel, Bachgraben",
      plannedDeparture: "2026-09-02T18:52:00+0200",
      direction: "Basel, Bachgraben",
    });

    expect(
      resolveDepartureDirectionGroupId(departure, FC_ALLSCHWIL_DIRECTION_GROUPS),
    ).toBe("bachgraben-basel");
  });

  it("uses destination fallback matchers when provider direction is missing", () => {
    const departure = makeDeparture({
      destination: "Basel, Claraplatz",
      plannedDeparture: "2026-09-02T18:52:00+0200",
      direction: null,
    });

    expect(
      resolveDepartureDirectionGroupId(departure, FC_ALLSCHWIL_DIRECTION_GROUPS),
    ).toBe("bachgraben-basel");
  });

  it("keeps groups in stable left/right order and sorts chronologically", () => {
    const groups = classifyDeparturesIntoDirectionGroups(
      [
        makeDeparture({
          line: "48",
          destination: "Basel, Bachgraben",
          plannedDeparture: "2026-09-02T18:52:00+0200",
          realtimeDeparture: "2026-09-02T18:54:00+0200",
          direction: "Basel, Bachgraben",
        }),
        makeDeparture({
          line: "38",
          destination: "Allschwil, Friedhof",
          plannedDeparture: "2026-09-02T18:49:00+0200",
          direction: "Allschwil, Friedhof",
        }),
        makeDeparture({
          line: "38",
          destination: "Allschwil, Friedhof",
          plannedDeparture: "2026-09-02T18:56:00+0200",
          direction: "Allschwil, Friedhof",
        }),
      ],
      FC_ALLSCHWIL_DIRECTION_GROUPS,
      4,
    );

    expect(groups.map((group) => group.id)).toEqual(["allschwil-dorf", "bachgraben-basel"]);
    expect(groups[0]?.orientation).toBe("left");
    expect(groups[1]?.orientation).toBe("right");
    expect(groups[0]?.departures.map((departure) => departure.plannedDeparture)).toEqual([
      "2026-09-02T18:49:00+0200",
      "2026-09-02T18:56:00+0200",
    ]);
    expect(groups[1]?.departures[0]?.realtimeDeparture).toBe("2026-09-02T18:54:00+0200");
  });

  it("keeps empty groups visible instead of borrowing departures", () => {
    const groups = classifyDeparturesIntoDirectionGroups(
      [
        makeDeparture({
          destination: "Basel, Bachgraben",
          plannedDeparture: "2026-09-02T18:52:00+0200",
          direction: "Basel, Bachgraben",
        }),
      ],
      FC_ALLSCHWIL_DIRECTION_GROUPS,
      4,
    );

    expect(groups[0]?.departures).toHaveLength(0);
    expect(groups[1]?.departures).toHaveLength(1);
  });

  it("does not classify unrelated destinations into either group", () => {
    const departure = makeDeparture({
      destination: "Therwil, Lindenfeld",
      plannedDeparture: "2026-09-02T18:54:00+0200",
      direction: "Therwil, Lindenfeld",
    });

    expect(
      resolveDepartureDirectionGroupId(departure, FC_ALLSCHWIL_DIRECTION_GROUPS),
    ).toBeNull();
  });
});
