/**
 * lib/publishing/infoboard/__tests__/screen2-live-service.test.ts
 *
 * Unit tests for buildScreen2LivePayload.
 *
 * Covers:
 *   - Pitch inventory loaded with correct tenant + type + status filter
 *   - Dressing-room inventory loaded with correct tenant + type + status filter (INFOBOARD-INTEGRATION-01C)
 *   - Active pitches included in feed
 *   - Feed facilityName derived from DB facility name
 *   - Branding resolved correctly (FC Allschwil key → known logo)
 *   - Branding: logoUrl from tenant overrides key-based resolution
 *   - Branding: null clubLogoSrc for unknown tenant without logoUrl
 *   - currentTimeIso matches now.toISOString()
 *   - Feed generatedAt matches now.toISOString()
 *   - dressingRooms is empty when no dressing rooms are configured
 *   - Theme resolves to DARK by default and reuses resolveInfoboardDisplayTheme
 *     for an explicit LIGHT preference (INFOBOARD-INTEGRATION-01B/01C)
 *   - Tenant ref populated correctly
 *   - RangeError from invalid timezone propagates
 *   - Pitch inventory query uses ACTIVE status filter
 *   - Pitch inventory query uses FULL_PITCH and HALF_PITCH types
 */

import { describe, it, expect, vi } from "vitest";

// Screen 2 shares the canonical Weekplanner-backed source loader with
// Screen 1 (see canonical-source-loader.ts). These tests are only
// concerned with pitch inventory / branding / tenant / timezone plumbing,
// not with canonical planning resolution itself (that is covered by
// canonical-source-loader.test.ts and lib/weekplanner's own tests) — so the
// Weekplanner layer is mocked to consistently return "no activities today".
vi.mock("@/lib/weekplanner/queries", () => ({
  getWeekplannerDay: vi.fn().mockResolvedValue({ dayKey: "2026-09-12", items: [] }),
}));
vi.mock("@/lib/weekplanner/plan-service", () => ({
  getOperationalWeekplannerPlan: vi.fn().mockResolvedValue(null),
}));

import {
  buildScreen2LivePayload,
  type Screen2SourceDatabase,
  type Screen2TenantContext,
} from "../screen2-live-service";
import type { CanonicalEventPolicyRow } from "../canonical-source-loader";
import type { Screen2PitchRow, Screen2DressingRoomRow } from "../screen2-live-service";

// ── Test helpers ──────────────────────────────────────────────────────────────

const NOW = new Date("2026-09-12T15:35:00.000Z");

const FC_ALLSCHWIL_TENANT: Screen2TenantContext = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  timezone: "Europe/Zurich",
  logoUrl: null,
};

const OTHER_TENANT: Screen2TenantContext = {
  id: "tenant-other",
  key: "other-club",
  name: "Other Club",
  timezone: "Europe/Zurich",
  logoUrl: null,
};

function makePitchRow(code: string, name: string, facilityName = "Brüelstadion"): Screen2PitchRow {
  return {
    code,
    name,
    sortOrder: 0,
    facility: { name: facilityName },
  } as Screen2PitchRow & { facility: { name: string } };
}

function makeDressingRoomRow(code: string, name: string): Screen2DressingRoomRow {
  return { code, name, sortOrder: 0 };
}

function makeDatabase(
  pitchRows: Screen2PitchRow[],
  eventRows: CanonicalEventPolicyRow[] = [],
  dressingRoomRows: Screen2DressingRoomRow[] = [],
): Screen2SourceDatabase {
  const facilityResourceFindMany = vi.fn().mockImplementation((args: { where?: { type?: unknown } }) => {
    const type = args?.where?.type;
    if (type === "DRESSING_ROOM") return Promise.resolve(dressingRoomRows);
    return Promise.resolve(pitchRows);
  });
  return {
    event: {
      findMany: vi.fn().mockResolvedValue(eventRows),
    },
    trainingSession: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    facilityResource: {
      findMany: facilityResourceFindMany,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Pitch inventory query ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Pitch inventory query", () => {
  it("queries facilityResource with tenantId from tenant", async () => {
    const database = makeDatabase([]);
    await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    const call = (database.facilityResource.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-fca");
  });

  it("queries facilityResource with FULL_PITCH and HALF_PITCH types", async () => {
    const database = makeDatabase([]);
    await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    const call = (database.facilityResource.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.type.in).toContain("FULL_PITCH");
    expect(call.where.type.in).toContain("HALF_PITCH");
  });

  it("queries facilityResource with status ACTIVE", async () => {
    const database = makeDatabase([]);
    await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    const call = (database.facilityResource.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.status).toBe("ACTIVE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Pitch inclusion in feed ───────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Active pitch inclusion", () => {
  it("feed contains one pitch entry per DB pitch row", async () => {
    const database = makeDatabase([
      makePitchRow("P-1", "Platz 1"),
      makePitchRow("P-2", "Platz 2"),
    ]);
    const payload = await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    expect(payload.feed.pitches).toHaveLength(2);
    expect(payload.feed.pitches[0].code).toBe("P-1");
    expect(payload.feed.pitches[1].code).toBe("P-2");
  });

  it("empty pitch list produces empty pitches array", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    expect(payload.feed.pitches).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Facility name ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Facility name", () => {
  it("facilityName in feed comes from the DB pitch row facility name", async () => {
    const database = makeDatabase([makePitchRow("P-1", "Platz 1", "Brüelstadion")]);
    const payload = await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    expect(payload.feed.facilityName).toBe("Brüelstadion");
  });

  it("facilityName falls back to tenant.name when no pitches configured", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    expect(payload.feed.facilityName).toBe("FC Allschwil");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Branding ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Branding", () => {
  it("productLogoSrc is '/images/branding/sportclubevo_logo.png'", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    expect(payload.branding.productLogoSrc).toBe("/images/branding/sportclubevo_logo.png");
  });

  it("resolves FC Allschwil club logo by tenant key", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    expect(payload.branding.clubLogoSrc).toBe("/images/logos/fc-allschwil.png");
  });

  it("tenant.logoUrl overrides key-based resolution", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({
      tenant: { ...FC_ALLSCHWIL_TENANT, logoUrl: "/custom/logo.png" },
      now: NOW,
      database,
    });
    expect(payload.branding.clubLogoSrc).toBe("/custom/logo.png");
  });

  it("clubLogoSrc is null for unknown tenant without logoUrl", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({
      tenant: OTHER_TENANT,
      now: NOW,
      database,
    });
    expect(payload.branding.clubLogoSrc).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── currentTimeIso ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("currentTimeIso", () => {
  it("currentTimeIso matches now.toISOString()", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    expect(payload.currentTimeIso).toBe(NOW.toISOString());
  });

  it("feed.generatedAt matches now.toISOString()", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    expect(payload.feed.generatedAt).toBe(NOW.toISOString());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── dressingRooms (INFOBOARD-INTEGRATION-01C) ────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("dressingRooms", () => {
  it("feed.dressingRooms is empty when no dressing rooms are configured", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    expect(payload.feed.dressingRooms).toEqual([]);
  });

  it("feed contains one dressing-room entry per DB dressing-room row", async () => {
    const database = makeDatabase(
      [],
      [],
      [makeDressingRoomRow("G1", "Kabine 1"), makeDressingRoomRow("G2", "Kabine 2")],
    );
    const payload = await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    expect(payload.feed.dressingRooms).toHaveLength(2);
    expect(payload.feed.dressingRooms.map((r) => r.code)).toEqual(["G1", "G2"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Dressing-room inventory query ────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Dressing-room inventory query", () => {
  it("queries facilityResource with type DRESSING_ROOM", async () => {
    const database = makeDatabase([]);
    await buildScreen2LivePayload({ tenant: FC_ALLSCHWIL_TENANT, now: NOW, database });
    const calls = (database.facilityResource.findMany as ReturnType<typeof vi.fn>).mock.calls;
    const dressingRoomCall = calls.find((c) => c[0].where.type === "DRESSING_ROOM");
    expect(dressingRoomCall).toBeDefined();
    expect(dressingRoomCall![0].where.tenantId).toBe("tenant-fca");
    expect(dressingRoomCall![0].where.status).toBe("ACTIVE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Theme (reuses Tenant.infoboardDisplayTheme, INFOBOARD-INTEGRATION-01B/01C) ─
// ─────────────────────────────────────────────────────────────────────────────

describe("Theme", () => {
  it("defaults to DARK when tenant.infoboardDisplayTheme is absent", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({ tenant: FC_ALLSCHWIL_TENANT, now: NOW, database });
    expect(payload.theme).toBe("DARK");
  });

  it("resolves to LIGHT when tenant.infoboardDisplayTheme is 'LIGHT'", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({
      tenant: { ...FC_ALLSCHWIL_TENANT, infoboardDisplayTheme: "LIGHT" },
      now: NOW,
      database,
    });
    expect(payload.theme).toBe("LIGHT");
  });

  it("falls back to DARK for an unrecognised persisted value (fail-safe default)", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({
      tenant: { ...FC_ALLSCHWIL_TENANT, infoboardDisplayTheme: "not-a-theme" },
      now: NOW,
      database,
    });
    expect(payload.theme).toBe("DARK");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Tenant ref ────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Tenant ref", () => {
  it("feed.tenant matches supplied tenant context", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    expect(payload.feed.tenant.id).toBe("tenant-fca");
    expect(payload.feed.tenant.key).toBe("fc-allschwil");
    expect(payload.feed.tenant.timezone).toBe("Europe/Zurich");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Invalid timezone ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Invalid timezone", () => {
  it("propagates RangeError from invalid timezone", async () => {
    const database = makeDatabase([]);
    await expect(
      buildScreen2LivePayload({
        tenant: { ...FC_ALLSCHWIL_TENANT, timezone: "Bad/Zone" },
        now: NOW,
        database,
      }),
    ).rejects.toThrow(RangeError);
  });
});
