/**
 * lib/publishing/infoboard/__tests__/screen1-event-mapper.test.ts
 *
 * Unit tests for mapScreen1Event — pure mapper from Screen1SourceEvent + TemporalBucket
 * to InfoboardScreen1Event.
 *
 * All tests are synchronous; no DB, no Prisma, no environment access.
 */

import { describe, it, expect } from "vitest";
import { mapScreen1Event } from "../screen1-event-mapper";
import type { Screen1SourceEvent, MapScreen1EventInput } from "../screen1-event-mapper";

// ── Test fixture helpers ───────────────────────────────────────────────────────

const START_AT = new Date("2026-07-23T14:00:00.000Z");
const END_AT = new Date("2026-07-23T15:50:00.000Z");

function makeBaseEvent(overrides: Partial<Screen1SourceEvent> = {}): Screen1SourceEvent {
  return {
    id: "evt-001",
    tenantId: "tenant-a",
    type: "TRAINING",
    status: "SCHEDULED",
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    homeAway: null,
    startAt: START_AT,
    endAt: END_AT,
    title: "U17 Training",
    seasonKey: "2025-26",
    ...overrides,
  };
}

function makeInput(
  eventOverrides: Partial<Screen1SourceEvent> = {},
  bucket: MapScreen1EventInput["temporalBucket"] = "next",
): MapScreen1EventInput {
  return { event: makeBaseEvent(eventOverrides), temporalBucket: bucket };
}

// ── Identity and core values ──────────────────────────────────────────────────

describe("mapScreen1Event — identity", () => {
  it("preserves event ID", () => {
    const result = mapScreen1Event(makeInput({ id: "event-xyz" }));
    expect(result.id).toBe("event-xyz");
  });

  it("preserves event type", () => {
    const result = mapScreen1Event(makeInput({ type: "MATCH" }));
    expect(result.type).toBe("MATCH");
  });

  it("preserves event status", () => {
    const result = mapScreen1Event(makeInput({ status: "LIVE" }));
    expect(result.status).toBe("LIVE");
  });

  it("preserves the supplied temporal bucket", () => {
    expect(mapScreen1Event(makeInput({}, "current")).temporalBucket).toBe("current");
    expect(mapScreen1Event(makeInput({}, "next")).temporalBucket).toBe("next");
    expect(mapScreen1Event(makeInput({}, "later")).temporalBucket).toBe("later");
  });

  it("preserves seasonKey", () => {
    const result = mapScreen1Event(makeInput({ seasonKey: "2024-25" }));
    expect(result.seasonKey).toBe("2024-25");
  });

  it("maps title to displayTitle", () => {
    const result = mapScreen1Event(makeInput({ title: "Jugend Training A" }));
    expect(result.displayTitle).toBe("Jugend Training A");
  });
});

// ── Timestamps ────────────────────────────────────────────────────────────────

describe("mapScreen1Event — timestamps", () => {
  it("converts startAt to UTC ISO-8601 string", () => {
    const event = makeBaseEvent({ startAt: new Date("2026-07-23T20:00:00.000Z") });
    const result = mapScreen1Event({ event, temporalBucket: "next" });
    expect(result.startAt).toBe("2026-07-23T20:00:00.000Z");
  });

  it("converts explicit endAt to UTC ISO-8601 string", () => {
    const event = makeBaseEvent({ endAt: new Date("2026-07-23T21:30:00.000Z") });
    const result = mapScreen1Event({ event, temporalBucket: "next" });
    expect(result.endAt).toBe("2026-07-23T21:30:00.000Z");
  });

  it("returns null endAt when source endAt is null", () => {
    const result = mapScreen1Event(makeInput({ endAt: null }));
    expect(result.endAt).toBeNull();
  });

  it("converts meetingTime to UTC ISO-8601 string when present", () => {
    const meetingTime = new Date("2026-07-23T13:30:00.000Z");
    const result = mapScreen1Event(makeInput({ meetingTime }));
    expect(result.meetingTime).toBe("2026-07-23T13:30:00.000Z");
  });

  it("returns null meetingTime when absent", () => {
    const result = mapScreen1Event(makeInput({ meetingTime: null }));
    expect(result.meetingTime).toBeNull();
  });

  it("returns null meetingTime when undefined", () => {
    const result = mapScreen1Event(makeInput({}));
    expect(result.meetingTime).toBeNull();
  });
});

// ── Result and intermediate result ────────────────────────────────────────────

describe("mapScreen1Event — result labels", () => {
  it("passes resultLabel through", () => {
    const result = mapScreen1Event(makeInput({ resultLabel: "2:1" }));
    expect(result.resultLabel).toBe("2:1");
  });

  it("returns null resultLabel when absent", () => {
    const result = mapScreen1Event(makeInput({ resultLabel: null }));
    expect(result.resultLabel).toBeNull();
  });

  it("passes intermediateResultLabel through", () => {
    const result = mapScreen1Event(makeInput({ intermediateResultLabel: "1:0 (HZ)" }));
    expect(result.intermediateResultLabel).toBe("1:0 (HZ)");
  });

  it("returns null intermediateResultLabel when absent", () => {
    const result = mapScreen1Event(makeInput({ intermediateResultLabel: null }));
    expect(result.intermediateResultLabel).toBeNull();
  });
});

// ── Organizer ─────────────────────────────────────────────────────────────────

describe("mapScreen1Event — organizer", () => {
  it("passes organizerName through to organizerDisplayName", () => {
    const result = mapScreen1Event(makeInput({ organizerName: "Stadtverein" }));
    expect(result.organizerDisplayName).toBe("Stadtverein");
  });

  it("returns null organizerDisplayName when absent", () => {
    const result = mapScreen1Event(makeInput({ organizerName: null }));
    expect(result.organizerDisplayName).toBeNull();
  });

  it("returns null organizerDisplayName when undefined", () => {
    const result = mapScreen1Event(makeInput({}));
    expect(result.organizerDisplayName).toBeNull();
  });
});

// ── Team display name ─────────────────────────────────────────────────────────

describe("mapScreen1Event — team display name (INFOBOARD tenant-managed priority)", () => {
  it("uses Team.shortName when present (highest infoboard priority)", () => {
    const result = mapScreen1Event(makeInput({
      team: { name: "FC Allschwil U17", displayName: "FCA U17", shortName: "U17" },
    }));
    expect(result.teamDisplayName).toBe("U17");
  });

  it("falls through blank Team.shortName to Team.name", () => {
    const result = mapScreen1Event(makeInput({
      team: { name: "FC Allschwil U17", displayName: "FCA U17", shortName: "  " },
    }));
    expect(result.teamDisplayName).toBe("FC Allschwil U17");
  });

  it("uses infoboardDisplayName when present", () => {
    const result = mapScreen1Event(makeInput({
      team: {
        infoboardDisplayName: "JUNIOREN E1",
        alternativeName: "Junioren E1",
        shortName: "E1",
        name: "E1",
        displayName: "Season E1",
      },
    }));
    expect(result.teamDisplayName).toBe("JUNIOREN E1");
  });

  it("prefers alternativeName over shortName when infoboardDisplayName absent", () => {
    const result = mapScreen1Event(makeInput({
      team: {
        name: "F2",
        displayName: "Season F2",
        shortName: "F2",
        alternativeName: "Junioren F2",
      },
    }));
    expect(result.teamDisplayName).toBe("Junioren F2");
  });

  it("prefers Team.name over TeamSeason.displayName when higher priorities absent", () => {
    const result = mapScreen1Event(makeInput({
      team: { name: "FC Allschwil U17", displayName: "FCA U17", shortName: null },
    }));
    expect(result.teamDisplayName).toBe("FC Allschwil U17");
  });

  it("uses Team.alternativeName when name and shortName absent", () => {
    const result = mapScreen1Event(makeInput({
      team: {
        name: null,
        displayName: "FCA U17",
        shortName: null,
        alternativeName: "Junioren U17",
      },
    }));
    expect(result.teamDisplayName).toBe("Junioren U17");
  });

  it("uses Team.name fallback when only name is present", () => {
    const result = mapScreen1Event(makeInput({
      team: { name: "FC Allschwil U17", displayName: null, shortName: null },
    }));
    expect(result.teamDisplayName).toBe("FC Allschwil U17");
  });

  it("uses teamFallbackName as last resort", () => {
    const result = mapScreen1Event(makeInput({
      team: { name: null, displayName: null, shortName: null },
      teamFallbackName: "Import Team Name",
    }));
    expect(result.teamDisplayName).toBe("Import Team Name");
  });

  it("returns null when no team candidates present", () => {
    const result = mapScreen1Event(makeInput({ team: null, teamFallbackName: null }));
    expect(result.teamDisplayName).toBeNull();
  });

  it("returns null when team is absent and fallbackName absent", () => {
    const result = mapScreen1Event(makeInput({ team: undefined, teamFallbackName: undefined }));
    expect(result.teamDisplayName).toBeNull();
  });

  it("does not mutate the input team object", () => {
    const team = { name: "FC Team", displayName: "Team Display", shortName: "T" };
    const teamOriginal = { ...team };
    mapScreen1Event(makeInput({ team }));
    expect(team).toEqual(teamOriginal);
  });
});

// ── Opponent display name ─────────────────────────────────────────────────────

describe("mapScreen1Event — opponent display name (INFOBOARD priority)", () => {
  it("uses infoboardName when present (highest infoboard priority)", () => {
    const result = mapScreen1Event(makeInput({
      type: "MATCH",
      homeAway: "HOME",
      opponent: {
        officialName: "FC Basel",
        shortName: "FCB",
        websiteName: "FC Basel Website",
        infoboardName: "Basel",
      },
    }));
    expect(result.opponentDisplayName).toBe("Basel");
  });

  it("falls through blank infoboardName to shortName", () => {
    const result = mapScreen1Event(makeInput({
      type: "MATCH",
      homeAway: "HOME",
      opponent: {
        officialName: "FC Basel",
        shortName: "FCB",
        infoboardName: "",
      },
    }));
    expect(result.opponentDisplayName).toBe("FCB");
  });

  it("uses shortName fallback when infoboardName absent", () => {
    const result = mapScreen1Event(makeInput({
      type: "MATCH",
      homeAway: "HOME",
      opponent: {
        officialName: "FC Basel",
        shortName: "FCB",
        infoboardName: null,
      },
    }));
    expect(result.opponentDisplayName).toBe("FCB");
  });

  it("uses officialName fallback when shortName absent", () => {
    const result = mapScreen1Event(makeInput({
      type: "MATCH",
      homeAway: "HOME",
      opponent: {
        officialName: "FC Basel",
        shortName: null,
        infoboardName: null,
      },
    }));
    expect(result.opponentDisplayName).toBe("FC Basel");
  });

  it("uses opponentFallbackName as last resort", () => {
    const result = mapScreen1Event(makeInput({
      type: "MATCH",
      homeAway: "HOME",
      opponent: {
        officialName: null,
        shortName: null,
        infoboardName: null,
      },
      opponentFallbackName: "Raw Opponent Name",
    }));
    expect(result.opponentDisplayName).toBe("Raw Opponent Name");
  });

  it("returns null for training without opponent", () => {
    const result = mapScreen1Event(makeInput({ type: "TRAINING", opponent: null }));
    expect(result.opponentDisplayName).toBeNull();
  });

  it("returns null when all opponent candidates absent", () => {
    const result = mapScreen1Event(makeInput({
      opponent: null,
      opponentFallbackName: null,
    }));
    expect(result.opponentDisplayName).toBeNull();
  });

  it("does not mutate the input opponent object", () => {
    const opponent = { officialName: "FC Basel", shortName: "FCB", infoboardName: "Basel" };
    const opponentOriginal = { ...opponent };
    mapScreen1Event(makeInput({ type: "MATCH", homeAway: "HOME", opponent }));
    expect(opponent).toEqual(opponentOriginal);
  });
});

// ── Competition label ─────────────────────────────────────────────────────────

describe("mapScreen1Event — competition label", () => {
  it("uses competitionLabel when present", () => {
    const result = mapScreen1Event(makeInput({ competitionLabel: "4. Liga Gruppe 1" }));
    expect(result.competitionLabel).toBe("4. Liga Gruppe 1");
  });

  it("falls through blank competitionLabel to fallback", () => {
    const result = mapScreen1Event(makeInput({
      competitionLabel: "",
      competitionFallbackLabel: "Fallback Liga",
    }));
    expect(result.competitionLabel).toBe("Fallback Liga");
  });

  it("uses fallback label when primary absent", () => {
    const result = mapScreen1Event(makeInput({
      competitionLabel: null,
      competitionFallbackLabel: "Regional Cup",
    }));
    expect(result.competitionLabel).toBe("Regional Cup");
  });

  it("returns null when both absent", () => {
    const result = mapScreen1Event(makeInput({
      competitionLabel: null,
      competitionFallbackLabel: null,
    }));
    expect(result.competitionLabel).toBeNull();
  });

  it("does not concatenate labels", () => {
    const result = mapScreen1Event(makeInput({
      competitionLabel: "Liga",
      competitionFallbackLabel: "Cup",
    }));
    expect(result.competitionLabel).toBe("Liga");
    expect(result.competitionLabel).not.toContain("Cup");
  });
});

// ── Pitch label ───────────────────────────────────────────────────────────────

describe("mapScreen1Event — pitch label", () => {
  it("uses pre-resolved label first", () => {
    const result = mapScreen1Event(makeInput({
      pitch: { label: "Stadion", code: "STADION", name: "Grosses Stadion", facilityName: "Brüelstadion" },
    }));
    expect(result.allocation.pitchLabel).toBe("Stadion");
  });

  it("falls through to code when label absent", () => {
    const result = mapScreen1Event(makeInput({
      pitch: { label: null, code: "KUNSTRASEN_2", name: "Kunstrasen 2", facilityName: "Brüelstadion" },
    }));
    expect(result.allocation.pitchLabel).toBe("KUNSTRASEN_2");
  });

  it("falls through to name when label and code absent", () => {
    const result = mapScreen1Event(makeInput({
      pitch: { label: null, code: null, name: "Kunstrasen 2", facilityName: "Brüelstadion" },
    }));
    expect(result.allocation.pitchLabel).toBe("Kunstrasen 2");
  });

  it("uses facilityName as last resort when all resource candidates absent", () => {
    const result = mapScreen1Event(makeInput({
      pitch: { label: null, code: null, name: null, facilityName: "Im Brüel" },
    }));
    expect(result.allocation.pitchLabel).toBe("Im Brüel");
  });

  it("returns null when pitch is null", () => {
    const result = mapScreen1Event(makeInput({ pitch: null }));
    expect(result.allocation.pitchLabel).toBeNull();
  });

  it("returns null when pitch is undefined", () => {
    const result = mapScreen1Event(makeInput({ pitch: undefined }));
    expect(result.allocation.pitchLabel).toBeNull();
  });

  it("does not automatically add a prefix to the pitch label", () => {
    const result = mapScreen1Event(makeInput({
      pitch: { label: null, code: "STADION", name: null },
    }));
    expect(result.allocation.pitchLabel).toBe("STADION");
    expect(result.allocation.pitchLabel).not.toMatch(/^Platz|^Pitch|^Feld/i);
  });

  it("does not concatenate facility name with resource label", () => {
    const result = mapScreen1Event(makeInput({
      pitch: { label: "Stadion", code: null, name: null, facilityName: "Brüelstadion" },
    }));
    expect(result.allocation.pitchLabel).toBe("Stadion");
    expect(result.allocation.pitchLabel).not.toContain("Brüelstadion");
  });
});

// ── Dressing rooms ────────────────────────────────────────────────────────────

describe("mapScreen1Event — dressing rooms", () => {
  it("uses home dressing-room label when present", () => {
    const result = mapScreen1Event(makeInput({
      homeDressingRoom: { label: "E1", code: "E1", name: "Erdgeschoss 1" },
    }));
    expect(result.allocation.homeDressingRoomLabel).toBe("E1");
  });

  it("falls through home code when label absent", () => {
    const result = mapScreen1Event(makeInput({
      homeDressingRoom: { label: null, code: "E2", name: "Erdgeschoss 2" },
    }));
    expect(result.allocation.homeDressingRoomLabel).toBe("E2");
  });

  it("falls through home name when label and code absent", () => {
    const result = mapScreen1Event(makeInput({
      homeDressingRoom: { label: null, code: null, name: "Heimkabine" },
    }));
    expect(result.allocation.homeDressingRoomLabel).toBe("Heimkabine");
  });

  it("returns null home label when assignment absent", () => {
    const result = mapScreen1Event(makeInput({ homeDressingRoom: null }));
    expect(result.allocation.homeDressingRoomLabel).toBeNull();
  });

  it("uses away dressing-room label when present", () => {
    const result = mapScreen1Event(makeInput({
      awayDressingRoom: { label: "O1", code: "O1", name: "Oben 1" },
    }));
    expect(result.allocation.awayDressingRoomLabel).toBe("O1");
  });

  it("falls through away code when label absent", () => {
    const result = mapScreen1Event(makeInput({
      awayDressingRoom: { label: null, code: "O2", name: "Oben 2" },
    }));
    expect(result.allocation.awayDressingRoomLabel).toBe("O2");
  });

  it("returns null away label when assignment absent", () => {
    const result = mapScreen1Event(makeInput({ awayDressingRoom: null }));
    expect(result.allocation.awayDressingRoomLabel).toBeNull();
  });

  it("resolves home and away dressing rooms independently (not swapped)", () => {
    const result = mapScreen1Event(makeInput({
      homeDressingRoom: { label: "HOME-DR", code: null, name: null },
      awayDressingRoom: { label: "AWAY-DR", code: null, name: null },
    }));
    expect(result.allocation.homeDressingRoomLabel).toBe("HOME-DR");
    expect(result.allocation.awayDressingRoomLabel).toBe("AWAY-DR");
  });

  it("resolves referee dressing room label", () => {
    const result = mapScreen1Event(makeInput({
      refereeDressingRoom: { label: "REF-DR", code: null, name: null },
    }));
    expect(result.allocation.refereeDressingRoomLabel).toBe("REF-DR");
  });

  it("returns null referee dressing room when absent", () => {
    const result = mapScreen1Event(makeInput({ refereeDressingRoom: null }));
    expect(result.allocation.refereeDressingRoomLabel).toBeNull();
  });

  it("does not automatically add a prefix to dressing-room labels", () => {
    const result = mapScreen1Event(makeInput({
      homeDressingRoom: { label: null, code: "E3", name: null },
    }));
    expect(result.allocation.homeDressingRoomLabel).toBe("E3");
    expect(result.allocation.homeDressingRoomLabel).not.toMatch(/^Kabine|^Garderobe/i);
  });

  it("does not mutate input dressing-room objects", () => {
    const homeDressingRoom = { label: "E1", code: "E1", name: "Room 1" };
    const awayDressingRoom = { label: "O1", code: "O1", name: "Room 2" };
    const homeCopy = { ...homeDressingRoom };
    const awayCopy = { ...awayDressingRoom };
    mapScreen1Event(makeInput({ homeDressingRoom, awayDressingRoom }));
    expect(homeDressingRoom).toEqual(homeCopy);
    expect(awayDressingRoom).toEqual(awayCopy);
  });
});

// ── Allocation structure ───────────────────────────────────────────────────────

describe("mapScreen1Event — allocation object", () => {
  it("always produces an allocation object with four fields", () => {
    const result = mapScreen1Event(makeInput());
    expect(result.allocation).toHaveProperty("pitchLabel");
    expect(result.allocation).toHaveProperty("homeDressingRoomLabel");
    expect(result.allocation).toHaveProperty("awayDressingRoomLabel");
    expect(result.allocation).toHaveProperty("refereeDressingRoomLabel");
  });

  it("returns all null labels when no allocation data present", () => {
    const result = mapScreen1Event(makeInput({
      pitch: null,
      homeDressingRoom: null,
      awayDressingRoom: null,
      refereeDressingRoom: null,
    }));
    expect(result.allocation.pitchLabel).toBeNull();
    expect(result.allocation.homeDressingRoomLabel).toBeNull();
    expect(result.allocation.awayDressingRoomLabel).toBeNull();
    expect(result.allocation.refereeDressingRoomLabel).toBeNull();
  });
});

// ── Purity and immutability ───────────────────────────────────────────────────

describe("mapScreen1Event — purity and immutability", () => {
  it("does not mutate the source event", () => {
    const event = makeBaseEvent({
      team: { name: "FC Team", displayName: "Team D", shortName: "T" },
      opponent: { officialName: "Opponent", infoboardName: "OPP" },
      pitch: { label: "Stadion", code: "STADION" },
      homeDressingRoom: { label: "E1", code: "E1" },
    });
    const snapshot = JSON.parse(JSON.stringify(event));
    mapScreen1Event({ event, temporalBucket: "current" });
    // Dates need special comparison
    expect(event.id).toBe(snapshot.id);
    expect(event.title).toBe(snapshot.title);
    expect(event.seasonKey).toBe(snapshot.seasonKey);
    expect(event.team).toEqual(snapshot.team);
    expect(event.opponent).toEqual(snapshot.opponent);
    expect(event.pitch).toEqual(snapshot.pitch);
    expect(event.homeDressingRoom).toEqual(snapshot.homeDressingRoom);
  });

  it("returns identical output for identical inputs", () => {
    const input = makeInput({
      team: { name: "FC Team", displayName: "FCA U17", shortName: "U17" },
      opponent: { officialName: "Opponent", infoboardName: "OPP" },
    });
    const result1 = mapScreen1Event(input);
    const result2 = mapScreen1Event(input);
    expect(result1).toEqual(result2);
  });

  it("returns a new object on each call", () => {
    const input = makeInput();
    const result1 = mapScreen1Event(input);
    const result2 = mapScreen1Event(input);
    expect(result1).not.toBe(result2);
  });

  it("does not share allocation object reference across calls", () => {
    const input = makeInput({ pitch: { code: "STADION" } });
    const result1 = mapScreen1Event(input);
    const result2 = mapScreen1Event(input);
    expect(result1.allocation).not.toBe(result2.allocation);
  });
});

// ── Event types ───────────────────────────────────────────────────────────────

describe("mapScreen1Event — event type variants", () => {
  it("maps TRAINING event correctly", () => {
    const result = mapScreen1Event(makeInput({ type: "TRAINING", homeAway: null }));
    expect(result.type).toBe("TRAINING");
    expect(result.opponentDisplayName).toBeNull();
  });

  it("maps MATCH event correctly", () => {
    const result = mapScreen1Event(makeInput({
      type: "MATCH",
      homeAway: "HOME",
      opponent: { officialName: "Opponent FC", infoboardName: "OFC" },
    }));
    expect(result.type).toBe("MATCH");
    expect(result.opponentDisplayName).toBe("OFC");
  });

  it("maps TOURNAMENT event correctly", () => {
    const result = mapScreen1Event(makeInput({ type: "TOURNAMENT", homeAway: null }));
    expect(result.type).toBe("TOURNAMENT");
  });
});

// ── Opponent logo URL pass-through ────────────────────────────────────────────

describe("mapScreen1Event — opponentLogoUrl", () => {
  it("passes through a non-null opponentLogoUrl to the DTO", () => {
    const result = mapScreen1Event(makeInput({
      type: "MATCH",
      homeAway: "HOME",
      opponentLogoUrl: "https://cdn.example.com/fc-schwarz-weiss.png",
    }));
    expect(result.opponentLogoUrl).toBe("https://cdn.example.com/fc-schwarz-weiss.png");
  });

  it("passes through null opponentLogoUrl when not set", () => {
    const result = mapScreen1Event(makeInput({ type: "MATCH", homeAway: "HOME" }));
    expect(result.opponentLogoUrl).toBeNull();
    expect(result.matchPresentation).toBeNull();
  });

  it("builds matchPresentation from canonical match identity", () => {
    const result = mapScreen1Event({
      event: makeBaseEvent({
        type: "MATCH",
        homeAway: "HOME",
        matchIdentity: {
          home: {
            isOwnTeam: true,
            clubName: null,
            clubLogoUrl: null,
            teamName: "FC Allschwil Junioren C2",
            teamShortName: null,
            teamAlternativeName: "Junioren C2",
            teamInfoboardDisplayName: null,
            fallbackDisplayName: "FC Allschwil Junioren C2",
          },
          away: {
            isOwnTeam: false,
            clubName: "FC Therwil",
            clubLogoUrl: "https://cdn.example.com/therwil.png",
            teamName: "FC Therwil C Gelb",
            teamShortName: "C Gelb",
            teamAlternativeName: null,
            teamInfoboardDisplayName: null,
            fallbackDisplayName: "FC Therwil C Gelb",
          },
        },
      }),
      temporalBucket: "current",
      tenantClubName: "FC Allschwil",
      tenantLogoUrl: "https://cdn.example.com/tenant.png",
    });

    expect(result.matchPresentation?.home.clubDisplayName).toBe("FC Allschwil");
    expect(result.matchPresentation?.home.teamSubDisplayName).toBe("Junioren C2");
    expect(result.matchPresentation?.home.clubLogoUrl).toBe(
      "https://cdn.example.com/tenant.png",
    );
    expect(result.matchPresentation?.away?.clubDisplayName).toBe("FC Therwil");
    expect(result.matchPresentation?.away?.teamSubDisplayName).toBe("C Gelb");
  });

  it("TRAINING events always have opponentLogoUrl null", () => {
    const result = mapScreen1Event(makeInput({ type: "TRAINING", homeAway: null }));
    expect(result.opponentLogoUrl).toBeNull();
  });
});
