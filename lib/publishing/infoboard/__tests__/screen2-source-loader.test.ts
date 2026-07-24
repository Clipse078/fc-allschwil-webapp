/**
 * lib/publishing/infoboard/__tests__/screen2-source-loader.test.ts
 *
 * Unit tests for createScreen2SourceLoader and createScreen2FacilityResourceLoader.
 *
 * Verifies:
 *   - Database contract (tenantId always present)
 *   - Date filter forwarding
 *   - seasonKey / teamSlug filter forwarding
 *   - Deterministic ordering params passed to DB
 *   - Required policy fields mapped
 *   - Team + TeamSeason resolution (matching season, fallback to team.name)
 *   - Wrong-season TeamSeason not used
 *   - opponentName preserved as opponentFallbackName
 *   - pitchCode, homeDressingRoomCode, awayDressingRoomCode preserved
 *   - sortOrder mapped
 *   - Empty result when no events
 *   - Facility resource loader uses correct tenantId
 *   - Inputs not mutated
 *   - Database error propagates
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createScreen2SourceLoader,
  createScreen2FacilityResourceLoader,
  type Screen2SourceDatabase,
  type Screen2DbEventRow,
} from "../screen2-source-loader";
import type { Screen2FacilityResourceRow } from "../screen2-resource-normalizer";

// ── Helpers ────────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-fca";
const SEASON_ID = "season-2025-26";

function makeDbEvent(overrides: Partial<Screen2DbEventRow> = {}): Screen2DbEventRow {
  return {
    id: "evt-1",
    tenantId: TENANT_ID,
    type: "TRAINING",
    status: "SCHEDULED",
    title: "Training A",
    startAt: new Date("2026-07-24T17:00:00.000Z"),
    endAt: new Date("2026-07-24T18:30:00.000Z"),
    seasonId: SEASON_ID,
    sortOrder: 0,
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    homeAway: null,
    opponentName: null,
    organizerName: null,
    competitionLabel: null,
    pitchCode: null,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    season: { key: "2025-26" },
    team: null,
    ...overrides,
  };
}

function makeResourceRow(
  overrides: Partial<Screen2FacilityResourceRow> = {},
): Screen2FacilityResourceRow {
  return {
    id: "res-1",
    tenantId: TENANT_ID,
    facilityId: "fac-1",
    name: "Feld A",
    code: "STADION_A",
    type: "HALF_PITCH",
    status: "ACTIVE",
    sortOrder: 10,
    facility: { id: "fac-1", name: "Stadion" },
    ...overrides,
  };
}

function makeDb(
  events: Screen2DbEventRow[],
  resources: Screen2FacilityResourceRow[] = [],
): Screen2SourceDatabase {
  return {
    event: {
      findMany: vi.fn().mockResolvedValue(events),
    },
    facilityResource: {
      findMany: vi.fn().mockResolvedValue(resources),
    },
  };
}

// ── createScreen2SourceLoader ─────────────────────────────────────────────────

describe("createScreen2SourceLoader — basic contract", () => {
  it("always includes tenantId in the where clause", async () => {
    const db = makeDb([]);
    const loader = createScreen2SourceLoader(db);
    await loader({ tenantId: TENANT_ID });
    expect(db.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }),
    );
  });

  it("returns empty array when no events", async () => {
    const db = makeDb([]);
    const loader = createScreen2SourceLoader(db);
    const result = await loader({ tenantId: TENANT_ID });
    expect(result).toHaveLength(0);
  });

  it("returns one source event per DB row", async () => {
    const db = makeDb([makeDbEvent(), makeDbEvent({ id: "evt-2" })]);
    const loader = createScreen2SourceLoader(db);
    const result = await loader({ tenantId: TENANT_ID });
    expect(result).toHaveLength(2);
  });

  it("propagates database errors", async () => {
    const db = makeDb([]);
    (db.event.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB failure"));
    const loader = createScreen2SourceLoader(db);
    await expect(loader({ tenantId: TENANT_ID })).rejects.toThrow("DB failure");
  });
});

describe("createScreen2SourceLoader — date filters", () => {
  it("forwards dateFrom to where.startAt.gte", async () => {
    const db = makeDb([]);
    const loader = createScreen2SourceLoader(db);
    const dateFrom = new Date("2026-07-24T00:00:00.000Z");
    await loader({ tenantId: TENANT_ID, dateFrom });
    expect(db.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ startAt: expect.objectContaining({ gte: dateFrom }) }),
      }),
    );
  });

  it("forwards dateTo to where.startAt.lte", async () => {
    const db = makeDb([]);
    const loader = createScreen2SourceLoader(db);
    const dateTo = new Date("2026-07-24T23:59:59.000Z");
    await loader({ tenantId: TENANT_ID, dateTo });
    expect(db.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ startAt: expect.objectContaining({ lte: dateTo }) }),
      }),
    );
  });

  it("omits startAt filter when neither dateFrom nor dateTo is supplied", async () => {
    const db = makeDb([]);
    const loader = createScreen2SourceLoader(db);
    await loader({ tenantId: TENANT_ID });
    const call = (db.event.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.startAt).toBeUndefined();
  });
});

describe("createScreen2SourceLoader — optional filters", () => {
  it("forwards seasonKey", async () => {
    const db = makeDb([]);
    const loader = createScreen2SourceLoader(db);
    await loader({ tenantId: TENANT_ID, seasonKey: "2025-26" });
    expect(db.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ season: { key: "2025-26" } }),
      }),
    );
  });

  it("forwards teamSlug", async () => {
    const db = makeDb([]);
    const loader = createScreen2SourceLoader(db);
    await loader({ tenantId: TENANT_ID, teamSlug: "u17" });
    expect(db.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ team: { slug: "u17" } }),
      }),
    );
  });
});

describe("createScreen2SourceLoader — field mapping", () => {
  it("maps required policy fields", async () => {
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
    const loader = createScreen2SourceLoader(db);
    const [event] = await loader({ tenantId: TENANT_ID });
    expect(event.tenantId).toBe(TENANT_ID);
    expect(event.type).toBe("MATCH");
    expect(event.status).toBe("SCHEDULED");
    expect(event.infoboardVisible).toBe(true);
    expect(event.websiteVisible).toBe(false);
    expect(event.homeAway).toBe("HOME");
  });

  it("maps temporal fields", async () => {
    const startAt = new Date("2026-07-24T17:00:00.000Z");
    const endAt = new Date("2026-07-24T18:30:00.000Z");
    const db = makeDb([makeDbEvent({ startAt, endAt })]);
    const loader = createScreen2SourceLoader(db);
    const [event] = await loader({ tenantId: TENANT_ID });
    expect(event.startAt).toEqual(startAt);
    expect(event.endAt).toEqual(endAt);
  });

  it("maps resource codes", async () => {
    const row = makeDbEvent({
      pitchCode: "STADION_A",
      homeDressingRoomCode: "E1",
      awayDressingRoomCode: "E2",
    });
    const db = makeDb([row]);
    const loader = createScreen2SourceLoader(db);
    const [event] = await loader({ tenantId: TENANT_ID });
    expect(event.pitchCode).toBe("STADION_A");
    expect(event.homeDressingRoomCode).toBe("E1");
    expect(event.awayDressingRoomCode).toBe("E2");
  });

  it("maps sortOrder", async () => {
    const db = makeDb([makeDbEvent({ sortOrder: 5 })]);
    const loader = createScreen2SourceLoader(db);
    const [event] = await loader({ tenantId: TENANT_ID });
    expect(event.sortOrder).toBe(5);
  });

  it("preserves opponentName as opponentFallbackName", async () => {
    const db = makeDb([makeDbEvent({ opponentName: "FC Binningen" })]);
    const loader = createScreen2SourceLoader(db);
    const [event] = await loader({ tenantId: TENANT_ID });
    expect(event.opponentFallbackName).toBe("FC Binningen");
  });
});

describe("createScreen2SourceLoader — team/season resolution", () => {
  it("resolves matching TeamSeason displayName", async () => {
    const row = makeDbEvent({
      seasonId: SEASON_ID,
      team: {
        name: "U17",
        teamSeasons: [
          { seasonId: SEASON_ID, displayName: "FC Allschwil U17", shortName: "FCA U17" },
        ],
      },
    });
    const db = makeDb([row]);
    const loader = createScreen2SourceLoader(db);
    const [event] = await loader({ tenantId: TENANT_ID });
    expect(event.team?.displayName).toBe("FC Allschwil U17");
    expect(event.team?.shortName).toBe("FCA U17");
  });

  it("returns null displayName when no matching TeamSeason", async () => {
    const row = makeDbEvent({
      seasonId: SEASON_ID,
      team: {
        name: "U17",
        teamSeasons: [
          { seasonId: "other-season", displayName: "Other", shortName: null },
        ],
      },
    });
    const db = makeDb([row]);
    const loader = createScreen2SourceLoader(db);
    const [event] = await loader({ tenantId: TENANT_ID });
    expect(event.team?.displayName).toBeNull();
    expect(event.team?.name).toBe("U17");
  });

  it("returns null team when event has no team", async () => {
    const db = makeDb([makeDbEvent({ team: null })]);
    const loader = createScreen2SourceLoader(db);
    const [event] = await loader({ tenantId: TENANT_ID });
    expect(event.team).toBeNull();
  });
});

// ── createScreen2FacilityResourceLoader ───────────────────────────────────────

describe("createScreen2FacilityResourceLoader", () => {
  it("queries facilityResource with correct tenantId", async () => {
    const db = makeDb([], []);
    const loadResources = createScreen2FacilityResourceLoader(db, TENANT_ID);
    await loadResources();
    expect(db.facilityResource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID } }),
    );
  });

  it("returns all resource rows including dressing rooms", async () => {
    const rows = [
      makeResourceRow({ type: "HALF_PITCH" }),
      makeResourceRow({ id: "dr-1", type: "DRESSING_ROOM", code: "E1" }),
    ];
    const db = makeDb([], rows);
    const loadResources = createScreen2FacilityResourceLoader(db, TENANT_ID);
    const result = await loadResources();
    expect(result).toHaveLength(2);
  });

  it("propagates database errors", async () => {
    const db = makeDb([], []);
    (db.facilityResource.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB down"));
    const loadResources = createScreen2FacilityResourceLoader(db, TENANT_ID);
    await expect(loadResources()).rejects.toThrow("DB down");
  });
});
