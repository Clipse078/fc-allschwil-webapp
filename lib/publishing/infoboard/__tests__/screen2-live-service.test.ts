/**
 * lib/publishing/infoboard/__tests__/screen2-live-service.test.ts
 *
 * Unit tests for buildScreen2LivePayload.
 *
 * Covers:
 *   - Pitch inventory loaded with correct tenant + type + status filter
 *   - Active pitches included in feed
 *   - Feed facilityName derived from DB facility name
 *   - Branding resolved correctly (FC Allschwil key → known logo)
 *   - Branding: logoUrl from tenant overrides key-based resolution
 *   - Branding: null clubLogoSrc for unknown tenant without logoUrl
 *   - currentTimeIso matches now.toISOString()
 *   - Feed generatedAt matches now.toISOString()
 *   - dressingRooms is always empty (Screen 2)
 *   - Tenant ref populated correctly
 *   - RangeError from invalid timezone propagates
 *   - Pitch inventory query uses ACTIVE status filter
 *   - Pitch inventory query uses FULL_PITCH and HALF_PITCH types
 */

import { describe, it, expect, vi } from "vitest";
import {
  buildScreen2LivePayload,
  type Screen2SourceDatabase,
  type Screen2TenantContext,
} from "../screen2-live-service";
import type { Screen1DbEventRow } from "../screen1-source-loader";
import type { Screen2PitchRow } from "../screen2-live-service";

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

function makeDatabase(
  pitchRows: Screen2PitchRow[],
  eventRows: Screen1DbEventRow[] = [],
): Screen2SourceDatabase {
  return {
    event: {
      findMany: vi.fn().mockResolvedValue(eventRows),
    },
    facilityResource: {
      findMany: vi.fn().mockResolvedValue(pitchRows),
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
// ── dressingRooms ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("dressingRooms", () => {
  it("feed.dressingRooms is always empty (Screen 2 does not render cabins)", async () => {
    const database = makeDatabase([]);
    const payload = await buildScreen2LivePayload({
      tenant: FC_ALLSCHWIL_TENANT,
      now: NOW,
      database,
    });
    expect(payload.feed.dressingRooms).toEqual([]);
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
