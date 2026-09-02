/**
 * lib/transport/__tests__/transport-direction-groups.test.ts
 *
 * INFOBOARD-TRANSPORT-02-UX3 — physical direction group classification tests.
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
    nextStopId: null,
    nextStopName: null,
    provider: "opendata.ch",
    hasRealtime: false,
    ...overrides,
  };
}

describe("transport direction groups", () => {
  it("classifies Hagmattstrasse departures to the Allschwil Zentrum group", () => {
    const departure = makeDeparture({
      line: "38",
      destination: "Allschwil, Friedhof",
      plannedDeparture: "2026-09-02T18:49:00+0200",
      nextStopName: "Allschwil, Hagmattstrasse",
      nextStopId: "8578173",
    });

    expect(
      resolveDepartureDirectionGroupId(departure, FC_ALLSCHWIL_DIRECTION_GROUPS),
    ).toBe("allschwil-zentrum");
  });

  it("classifies Kreuzstrasse departures to the Bachgraben/Basel group", () => {
    const departure = makeDeparture({
      line: "48",
      destination: "Basel, Bachgraben",
      plannedDeparture: "2026-09-02T18:52:00+0200",
      nextStopName: "Allschwil, Kreuzstrasse",
      nextStopId: "8578171",
    });

    expect(
      resolveDepartureDirectionGroupId(departure, FC_ALLSCHWIL_DIRECTION_GROUPS),
    ).toBe("bachgraben-basel");
  });

  it("groups different terminal destinations in the same physical direction", () => {
    const therwil = makeDeparture({
      line: "49",
      destination: "Therwil, Lindenfeld",
      plannedDeparture: "2026-09-02T18:54:00+0200",
      nextStopName: "Allschwil, Hagmattstrasse",
      nextStopId: "8578173",
    });
    const baselSbb = makeDeparture({
      line: "48",
      destination: "Basel, Bahnhof SBB",
      plannedDeparture: "2026-09-02T18:55:00+0200",
      nextStopName: "Allschwil, Hagmattstrasse",
      nextStopId: "8578173",
    });

    expect(resolveDepartureDirectionGroupId(therwil, FC_ALLSCHWIL_DIRECTION_GROUPS)).toBe(
      "allschwil-zentrum",
    );
    expect(resolveDepartureDirectionGroupId(baselSbb, FC_ALLSCHWIL_DIRECTION_GROUPS)).toBe(
      "allschwil-zentrum",
    );
  });

  it("keeps groups in stable left/right order and sorts chronologically", () => {
    const groups = classifyDeparturesIntoDirectionGroups(
      [
        makeDeparture({
          line: "48",
          destination: "Basel, Bachgraben",
          plannedDeparture: "2026-09-02T18:52:00+0200",
          realtimeDeparture: "2026-09-02T18:54:00+0200",
          nextStopName: "Allschwil, Kreuzstrasse",
        }),
        makeDeparture({
          line: "38",
          destination: "Allschwil, Friedhof",
          plannedDeparture: "2026-09-02T18:49:00+0200",
          nextStopName: "Allschwil, Hagmattstrasse",
        }),
        makeDeparture({
          line: "49",
          destination: "Oberwil BL, Hüslimatt",
          plannedDeparture: "2026-09-02T18:56:00+0200",
          nextStopName: "Allschwil, Hagmattstrasse",
        }),
      ],
      FC_ALLSCHWIL_DIRECTION_GROUPS,
      3,
    );

    expect(groups.map((group) => group.id)).toEqual(["allschwil-zentrum", "bachgraben-basel"]);
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
          nextStopName: "Allschwil, Kreuzstrasse",
        }),
      ],
      FC_ALLSCHWIL_DIRECTION_GROUPS,
      3,
    );

    expect(groups[0]?.departures).toHaveLength(0);
    expect(groups[1]?.departures).toHaveLength(1);
  });

  it("does not classify unrelated departures without next-stop topology", () => {
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
