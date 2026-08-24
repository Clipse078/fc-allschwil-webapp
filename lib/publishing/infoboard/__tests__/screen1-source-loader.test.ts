/**
 * lib/publishing/infoboard/__tests__/screen1-source-loader.test.ts
 *
 * Unit tests for createScreen1SourceLoader.
 *
 * Verifies:
 *   - Database contract (tenantId always present in where clause)
 *   - Date filter forwarding
 *   - SeasonKey / teamSlug filter forwarding
 *   - Deterministic ordering
 *   - Required policy fields mapped (infoboardVisible, websiteVisible,
 *     trainingsplanVisible, homeAway, type, status, tenantId)
 *   - Team.name mapped
 *   - Matching TeamSeason displayName and shortName mapped
 *   - Wrong-season TeamSeason not used
 *   - Raw Event.opponentName preserved as opponentFallbackName
 *   - Opponent is null (no opponentId on Event)
 *   - Pitch code resolved via static registry (label)
 *   - Pitch code resolved via DB FacilityResource name
 *   - Pitch raw code retained when resource missing
 *   - Home dressing-room code resolved via static registry
 *   - Away dressing-room code resolved via static registry
 *   - DB FacilityResource name used when present
 *   - Wrong-tenant resource never returned (enforced by DB interface contract)
 *   - No resource fabricated when code is null
 *   - facilityResource.findMany called with correct tenantId and codes
 *   - No N+1: facilityResource.findMany called exactly once per loader invocation
 *   - Empty result when no events
 *   - Database error propagates
 *   - Inputs not mutated
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createScreen1SourceLoader,
  type Screen1SourceDatabase,
  type Screen1DbEventRow,
} from "../screen1-source-loader";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-fca";
const SEASON_ID = "season-2025-26";

function makeDbEvent(overrides: Partial<Screen1DbEventRow> = {}): Screen1DbEventRow {
  return {
    id: "evt-1",
    tenantId: TENANT_ID,
    type: "TRAINING",
    status: "SCHEDULED",
    title: "Training A",
    startAt: new Date("2026-07-24T17:00:00.000Z"),
    endAt: new Date("2026-07-24T18:30:00.000Z"),
    seasonId: SEASON_ID,
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    homeAway: null,
    opponentName: null,
    organizerName: null,
    competitionLabel: null,
    meetingTime: null,
    resultLabel: null,
    intermediateResultLabel: null,
    pitchCode: null,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    season: { key: "2025-26" },
    team: null,
    ...overrides,
  };
}

function makeDb(
  events: Screen1DbEventRow[],
  facilityResources: Array<{ code: string; name: string }> = [],
): Screen1SourceDatabase {
  return {
    event: {
      findMany: vi.fn().mockResolvedValue(events),
    },
    facilityResource: {
      findMany: vi.fn().mockResolvedValue(facilityResources),
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createScreen1SourceLoader", () => {
  describe("tenant isolation", () => {
    it("always includes tenantId in the where clause", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID });

      const args = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(args.where.tenantId).toBe(TENANT_ID);
    });

    it("does not include global query without tenant scope", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID });

      const args = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      // where must contain tenantId
      expect(args.where).toHaveProperty("tenantId", TENANT_ID);
    });
  });

  describe("date filter forwarding", () => {
    it("forwards dateFrom as startAt.gte", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);
      const dateFrom = new Date("2026-07-23T00:00:00.000Z");

      await loader({ tenantId: TENANT_ID, dateFrom });

      const args = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(args.where.startAt?.gte).toEqual(dateFrom);
    });

    it("forwards dateTo as startAt.lte", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);
      const dateTo = new Date("2026-07-25T23:59:59.000Z");

      await loader({ tenantId: TENANT_ID, dateTo });

      const args = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(args.where.startAt?.lte).toEqual(dateTo);
    });

    it("omits startAt filter when neither dateFrom nor dateTo supplied", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID });

      const args = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(args.where.startAt).toBeUndefined();
    });

    it("includes both gte and lte when both supplied", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);
      const dateFrom = new Date("2026-07-23T00:00:00.000Z");
      const dateTo = new Date("2026-07-25T23:59:59.000Z");

      await loader({ tenantId: TENANT_ID, dateFrom, dateTo });

      const args = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(args.where.startAt).toEqual({ gte: dateFrom, lte: dateTo });
    });
  });

  describe("optional filter forwarding", () => {
    it("forwards seasonKey as season.key filter", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID, seasonKey: "2025-26" });

      const args = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(args.where.season).toEqual({ key: "2025-26" });
    });

    it("forwards teamSlug as team.slug filter", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID, teamSlug: "1-mannschaft" });

      const args = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(args.where.team).toEqual({ slug: "1-mannschaft" });
    });

    it("omits season filter when seasonKey not supplied", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID });

      const args = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(args.where.season).toBeUndefined();
    });

    it("omits team filter when teamSlug not supplied", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID });

      const args = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(args.where.team).toBeUndefined();
    });
  });

  describe("deterministic ordering", () => {
    it("orders by startAt asc first", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID });

      const args = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(args.orderBy[0]).toEqual({ startAt: "asc" });
    });

    it("orders by sortOrder asc second", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID });

      const args = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(args.orderBy[1]).toEqual({ sortOrder: "asc" });
    });

    it("orders by title asc third", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID });

      const args = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(args.orderBy[2]).toEqual({ title: "asc" });
    });
  });

  describe("source-event field mapping", () => {
    it("maps required PublicationPolicyEvent fields correctly", async () => {
      const row = makeDbEvent({
        tenantId: TENANT_ID,
        type: "MATCH",
        status: "SCHEDULED",
        infoboardVisible: true,
        websiteVisible: false,
        trainingsplanVisible: false,
        homeAway: "HOME",
      });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.tenantId).toBe(TENANT_ID);
      expect(event.type).toBe("MATCH");
      expect(event.status).toBe("SCHEDULED");
      expect(event.infoboardVisible).toBe(true);
      expect(event.websiteVisible).toBe(false);
      expect(event.trainingsplanVisible).toBe(false);
      expect(event.homeAway).toBe("HOME");
    });

    it("maps id, title, seasonKey correctly", async () => {
      const row = makeDbEvent({ id: "evt-abc", title: "Heimspiel", season: { key: "2025-26" } });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.id).toBe("evt-abc");
      expect(event.title).toBe("Heimspiel");
      expect(event.seasonKey).toBe("2025-26");
    });

    it("maps startAt and endAt as Date values", async () => {
      const startAt = new Date("2026-07-24T17:00:00.000Z");
      const endAt = new Date("2026-07-24T18:30:00.000Z");
      const row = makeDbEvent({ startAt, endAt });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.startAt).toEqual(startAt);
      expect(event.endAt).toEqual(endAt);
    });

    it("maps null endAt", async () => {
      const row = makeDbEvent({ endAt: null });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.endAt).toBeNull();
    });
  });

  describe("Team tenant-managed naming (INFOBOARD-TEAMNAME-01)", () => {
    it("maps Team.name when no teamSeasons exist", async () => {
      const row = makeDbEvent({
        team: { name: "1. Mannschaft", shortName: null, alternativeName: null, teamSeasons: [] },
      });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.team?.name).toBe("1. Mannschaft");
      expect(event.team?.shortName).toBeNull();
      expect(event.team?.alternativeName).toBeNull();
      expect(event.team?.displayName).toBeNull();
    });

    it("maps Team.shortName and Team.alternativeName from Team model", async () => {
      const row = makeDbEvent({
        seasonId: SEASON_ID,
        team: {
          name: "1. Mannschaft",
          shortName: "1M",
          alternativeName: "Erste Mannschaft",
          teamSeasons: [
            { seasonId: SEASON_ID, displayName: "1. Mannschaft 2025/26", shortName: "1M-season" },
          ],
        },
      });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.team?.shortName).toBe("1M");
      expect(event.team?.alternativeName).toBe("Erste Mannschaft");
    });

    it("still maps matching TeamSeason displayName for WEBSITE channel reuse", async () => {
      const row = makeDbEvent({
        seasonId: SEASON_ID,
        team: {
          name: "1. Mannschaft",
          shortName: null,
          alternativeName: null,
          teamSeasons: [
            { seasonId: SEASON_ID, displayName: "1. Mannschaft 2025/26", shortName: "1M" },
          ],
        },
      });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.team?.displayName).toBe("1. Mannschaft 2025/26");
    });

    it("does not use wrong-season TeamSeason for displayName", async () => {
      const row = makeDbEvent({
        seasonId: SEASON_ID,
        team: {
          name: "1. Mannschaft",
          shortName: null,
          alternativeName: null,
          teamSeasons: [
            { seasonId: "different-season-id", displayName: "Old Season Name", shortName: "OLD" },
          ],
        },
      });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.team?.name).toBe("1. Mannschaft");
      expect(event.team?.displayName).toBeNull();
      expect(event.team?.shortName).toBeNull();
    });

    it("uses matching TeamSeason displayName when multiple seasons present", async () => {
      const row = makeDbEvent({
        seasonId: SEASON_ID,
        team: {
          name: "1. Mannschaft",
          shortName: "1M",
          alternativeName: null,
          teamSeasons: [
            { seasonId: "old-season", displayName: "1M 2024/25", shortName: "1M-old" },
            { seasonId: SEASON_ID, displayName: "1M 2025/26", shortName: "1M-new" },
          ],
        },
      });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.team?.displayName).toBe("1M 2025/26");
      expect(event.team?.shortName).toBe("1M");
    });

    it("returns null team when event has no team", async () => {
      const row = makeDbEvent({ team: null });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.team).toBeNull();
    });
  });

  describe("Opponent name mapping", () => {
    it("maps raw Event.opponentName as opponentFallbackName", async () => {
      const row = makeDbEvent({ opponentName: "FC Basel" });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.opponentFallbackName).toBe("FC Basel");
    });

    it("returns null opponentFallbackName when opponentName is null", async () => {
      const row = makeDbEvent({ opponentName: null });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.opponentFallbackName).toBeNull();
    });

    it("returns null canonical opponent (no opponentId on Event)", async () => {
      const row = makeDbEvent({ opponentName: "FC Basel" });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      // No canonical Opponent join possible without opponentId on Event
      expect(event.opponent).toBeNull();
    });
  });

  describe("pitch resolution", () => {
    it("resolves pitch label from static registry when code is known", async () => {
      const row = makeDbEvent({ pitchCode: "STADION" });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      // Static registry (pitches.ts) maps STADION → "Stadion"
      expect(event.pitch?.label).toBe("Stadion");
      expect(event.pitch?.code).toBe("STADION");
    });

    it("provides DB FacilityResource name when available", async () => {
      const row = makeDbEvent({ pitchCode: "STADION" });
      const db = makeDb([row], [{ code: "STADION", name: "Stadion (DB-konfiguriert)" }]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.pitch?.name).toBe("Stadion (DB-konfiguriert)");
    });

    it("retains raw code when resource lookup yields no name", async () => {
      const row = makeDbEvent({ pitchCode: "UNKNOWN_CODE" });
      const db = makeDb([row]); // no facilityResource rows
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.pitch?.code).toBe("UNKNOWN_CODE");
      expect(event.pitch?.label).toBeNull(); // unknown to static registry
      expect(event.pitch?.name).toBeNull();  // not in DB
    });

    it("sets pitch to null when pitchCode is null", async () => {
      const row = makeDbEvent({ pitchCode: null });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.pitch).toBeNull();
    });
  });

  describe("dressing-room resolution", () => {
    it("resolves home dressing-room label from static registry", async () => {
      const row = makeDbEvent({ homeDressingRoomCode: "E1" });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      // Static registry maps E1 → "E1"
      expect(event.homeDressingRoom?.label).toBe("E1");
      expect(event.homeDressingRoom?.code).toBe("E1");
    });

    it("resolves away dressing-room label from static registry", async () => {
      const row = makeDbEvent({ awayDressingRoomCode: "O3" });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.awayDressingRoom?.label).toBe("O3");
      expect(event.awayDressingRoom?.code).toBe("O3");
    });

    it("provides DB name for home dressing-room when available", async () => {
      const row = makeDbEvent({ homeDressingRoomCode: "E1" });
      const db = makeDb([row], [{ code: "E1", name: "Kabine E1 (DB)" }]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.homeDressingRoom?.name).toBe("Kabine E1 (DB)");
    });

    it("sets homeDressingRoom to null when code is null", async () => {
      const row = makeDbEvent({ homeDressingRoomCode: null });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.homeDressingRoom).toBeNull();
    });

    it("sets awayDressingRoom to null when code is null", async () => {
      const row = makeDbEvent({ awayDressingRoomCode: null });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.awayDressingRoom).toBeNull();
    });

    it("refereeDressingRoom is always null (no field on Event)", async () => {
      const row = makeDbEvent();
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.refereeDressingRoom).toBeNull();
    });
  });

  describe("facility resource batch query", () => {
    it("calls facilityResource.findMany with the correct tenantId", async () => {
      const row = makeDbEvent({ pitchCode: "STADION" });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID });

      const frCalls = (db.facilityResource!.findMany as ReturnType<typeof vi.fn>).mock.calls;
      expect(frCalls.length).toBe(1);
      expect(frCalls[0][0].where.tenantId).toBe(TENANT_ID);
    });

    it("calls facilityResource.findMany exactly once (no N+1)", async () => {
      const rows = [
        makeDbEvent({ id: "e1", pitchCode: "STADION", homeDressingRoomCode: "E1" }),
        makeDbEvent({ id: "e2", pitchCode: "KUNSTRASEN_2", awayDressingRoomCode: "O2" }),
        makeDbEvent({ id: "e3", pitchCode: "STADION", homeDressingRoomCode: "E2" }),
      ];
      const db = makeDb(rows);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID });

      const frCalls = (db.facilityResource!.findMany as ReturnType<typeof vi.fn>).mock.calls;
      expect(frCalls.length).toBe(1);
    });

    it("includes all unique codes across events in the batch query", async () => {
      const rows = [
        makeDbEvent({ id: "e1", pitchCode: "STADION", homeDressingRoomCode: "E1" }),
        makeDbEvent({ id: "e2", awayDressingRoomCode: "O2" }),
      ];
      const db = makeDb(rows);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID });

      const frArgs = (db.facilityResource!.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const codes: string[] = frArgs.where.code.in;
      expect(codes).toContain("STADION");
      expect(codes).toContain("E1");
      expect(codes).toContain("O2");
    });

    it("does not call facilityResource.findMany when no events returned", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID });

      const frCalls = (db.facilityResource!.findMany as ReturnType<typeof vi.fn>).mock.calls;
      expect(frCalls.length).toBe(0);
    });

    it("does not call facilityResource.findMany when all allocation codes are null", async () => {
      const row = makeDbEvent({
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
      });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      await loader({ tenantId: TENANT_ID });

      const frCalls = (db.facilityResource!.findMany as ReturnType<typeof vi.fn>).mock.calls;
      expect(frCalls.length).toBe(0);
    });

    it("skips facilityResource query when database.facilityResource is absent", async () => {
      const row = makeDbEvent({ pitchCode: "STADION" });
      const db: Screen1SourceDatabase = {
        event: { findMany: vi.fn().mockResolvedValue([row]) },
        // facilityResource intentionally omitted
      };
      const loader = createScreen1SourceLoader(db);

      const events = await loader({ tenantId: TENANT_ID });

      // No crash; static registry label still works
      expect(events[0].pitch?.label).toBe("Stadion");
      expect(events[0].pitch?.name).toBeNull(); // no DB name
    });
  });

  describe("empty state and error propagation", () => {
    it("returns an empty array when no events are found", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);

      const result = await loader({ tenantId: TENANT_ID });

      expect(result).toEqual([]);
    });

    it("propagates database errors from event.findMany", async () => {
      const db: Screen1SourceDatabase = {
        event: { findMany: vi.fn().mockRejectedValue(new Error("DB connection error")) },
      };
      const loader = createScreen1SourceLoader(db);

      await expect(loader({ tenantId: TENANT_ID })).rejects.toThrow("DB connection error");
    });

    it("propagates database errors from facilityResource.findMany", async () => {
      const row = makeDbEvent({ pitchCode: "STADION" });
      const db: Screen1SourceDatabase = {
        event: { findMany: vi.fn().mockResolvedValue([row]) },
        facilityResource: {
          findMany: vi.fn().mockRejectedValue(new Error("Resource DB error")),
        },
      };
      const loader = createScreen1SourceLoader(db);

      await expect(loader({ tenantId: TENANT_ID })).rejects.toThrow("Resource DB error");
    });
  });

  describe("input immutability", () => {
    it("does not mutate the input object", async () => {
      const db = makeDb([]);
      const loader = createScreen1SourceLoader(db);
      const input = Object.freeze({ tenantId: TENANT_ID, dateFrom: new Date() });

      await expect(loader(input)).resolves.not.toThrow();
    });
  });

  describe("meetingTime, resultLabel, competitionLabel mapping", () => {
    it("maps meetingTime from DB row", async () => {
      const meetingTime = new Date("2026-07-24T15:30:00.000Z");
      const row = makeDbEvent({ meetingTime });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.meetingTime).toEqual(meetingTime);
    });

    it("maps resultLabel from DB row", async () => {
      const row = makeDbEvent({ resultLabel: "3:1" });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.resultLabel).toBe("3:1");
    });

    it("maps competitionLabel from DB row", async () => {
      const row = makeDbEvent({ competitionLabel: "Nationalliga A" });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.competitionLabel).toBe("Nationalliga A");
    });

    it("maps organizerName from DB row", async () => {
      const row = makeDbEvent({ organizerName: "Gemeinde Allschwil" });
      const db = makeDb([row]);
      const loader = createScreen1SourceLoader(db);

      const [event] = await loader({ tenantId: TENANT_ID });

      expect(event.organizerName).toBe("Gemeinde Allschwil");
    });
  });
});
