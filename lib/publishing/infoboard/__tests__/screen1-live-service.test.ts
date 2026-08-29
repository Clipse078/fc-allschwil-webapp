/**
 * lib/publishing/infoboard/__tests__/screen1-live-service.test.ts
 *
 * Unit tests for buildScreen1LivePayload.
 *
 * Verifies:
 *   - Loader called exactly once (via buildInfoboardScreen1Feed)
 *   - Same `now` value used for feed generatedAt and currentTimeIso
 *   - Tenant reference populated correctly
 *   - Tenant timezone used for temporal grouping
 *   - Date window is bounded (dateFrom < now, dateTo > now)
 *   - dateFrom includes overnight buffer (>= 24h before now)
 *   - dateTo covers next local day (>= 24h after now)
 *   - Feed builder called with correct tenant ref
 *   - eventPresentation is empty (no canonical tournament model)
 *   - announcement is null (no persisted setting)
 *   - branding: productLogoSrc is correct
 *   - branding: FC Allschwil clubLogoSrc resolved when tenant.key matches
 *   - branding: logoUrl from tenant overrides key-based resolution
 *   - branding: null clubLogoSrc for unknown tenant without logoUrl
 *   - payload currentTimeIso matches now.toISOString()
 *   - payload feed contains correct generatedAt
 *   - no mutation of inputs
 *   - RangeError from invalid timezone propagates
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildScreen1LivePayload } from "../screen1-live-service";
import type { Screen1TenantContext } from "../screen1-live-service";
import type { Screen1SourceEvent } from "../screen1-event-mapper";

// ── Constants ─────────────────────────────────────────────────────────────────

const NOW = new Date("2026-07-24T16:00:00.000Z");
const TZ_ZURICH = "Europe/Zurich";

const TENANT_FCA: Screen1TenantContext = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  timezone: TZ_ZURICH,
  logoUrl: null,
};

const TENANT_OTHER: Screen1TenantContext = {
  id: "tenant-other",
  key: "sc-testclub",
  name: "SC Testclub",
  timezone: TZ_ZURICH,
  logoUrl: null,
};

// ── Loader factory ────────────────────────────────────────────────────────────

function makeEmptyLoader(): (input: unknown) => Promise<Screen1SourceEvent[]> {
  return vi.fn().mockResolvedValue([]);
}

function makeLoader(events: Screen1SourceEvent[]) {
  return vi.fn().mockResolvedValue(events);
}

function makeBaseEvent(overrides: Partial<Screen1SourceEvent> = {}): Screen1SourceEvent {
  return {
    id: "evt-1",
    tenantId: "tenant-fca",
    type: "TRAINING",
    status: "SCHEDULED",
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    homeAway: null,
    startAt: new Date("2026-07-24T17:00:00.000Z"), // future today Zurich
    endAt: new Date("2026-07-24T18:30:00.000Z"),
    title: "Training",
    seasonKey: "2025-26",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildScreen1LivePayload", () => {
  describe("loader invocation", () => {
    it("calls the loader exactly once", async () => {
      const loader = makeEmptyLoader();
      await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it("passes tenantId to the loader", async () => {
      const loader = makeEmptyLoader();
      await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      const callArgs = (loader as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.tenantId).toBe("tenant-fca");
    });
  });

  describe("date window", () => {
    it("dateFrom is before now (overnight buffer)", async () => {
      const loader = makeEmptyLoader();
      await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      const callArgs = (loader as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.dateFrom.getTime()).toBeLessThan(NOW.getTime());
    });

    it("dateFrom is at least 24 hours before now", async () => {
      const loader = makeEmptyLoader();
      await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      const callArgs = (loader as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const diffHours = (NOW.getTime() - callArgs.dateFrom.getTime()) / (60 * 60 * 1000);
      expect(diffHours).toBeGreaterThanOrEqual(24);
    });

    it("dateTo is after now", async () => {
      const loader = makeEmptyLoader();
      await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      const callArgs = (loader as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.dateTo.getTime()).toBeGreaterThan(NOW.getTime());
    });

    it("dateTo covers at least 24 hours forward", async () => {
      const loader = makeEmptyLoader();
      await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      const callArgs = (loader as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const diffHours = (callArgs.dateTo.getTime() - NOW.getTime()) / (60 * 60 * 1000);
      expect(diffHours).toBeGreaterThanOrEqual(24);
    });

    it("window is bounded (dateFrom and dateTo are finite dates)", async () => {
      const loader = makeEmptyLoader();
      await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      const callArgs = (loader as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(isFinite(callArgs.dateFrom.getTime())).toBe(true);
      expect(isFinite(callArgs.dateTo.getTime())).toBe(true);
    });
  });

  describe("consistent now usage", () => {
    it("currentTimeIso equals now.toISOString()", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(payload.currentTimeIso).toBe(NOW.toISOString());
    });

    it("feed.generatedAt equals now.toISOString()", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(payload.feed.generatedAt).toBe(NOW.toISOString());
    });
  });

  describe("tenant reference in feed", () => {
    it("feed.tenant.id matches tenant.id", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(payload.feed.tenant.id).toBe(TENANT_FCA.id);
    });

    it("feed.tenant.key matches tenant.key", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(payload.feed.tenant.key).toBe(TENANT_FCA.key);
    });

    it("feed.tenant.name matches tenant.name", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(payload.feed.tenant.name).toBe(TENANT_FCA.name);
    });

    it("feed.tenant.timezone matches tenant.timezone", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(payload.feed.tenant.timezone).toBe(TENANT_FCA.timezone);
    });
  });

  describe("eventPresentation", () => {
    it("eventPresentation is an empty array when no tournament database is supplied", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(payload.eventPresentation).toEqual([]);
    });

    it("maps canonical tournament participants onto prefixed feed event ids", async () => {
      const tournament = makeBaseEvent({
        id: "tournament:evt-playmore",
        type: "TOURNAMENT",
        infoboardVisible: true,
        websiteVisible: true,
        title: "BRACK.CH PLAYMORE TURNIER",
        organizerName: "BRACK.CH",
        team: { name: "FC Allschwil" },
        startAt: new Date("2026-07-24T17:00:00.000Z"),
        endAt: new Date("2026-07-24T19:00:00.000Z"),
      });
      const loader = makeLoader([tournament]);
      const payload = await buildScreen1LivePayload({
        tenant: TENANT_FCA,
        now: NOW,
        loader,
        tournamentPresentationDatabase: {
          tournamentParticipant: {
            findMany: async () => [
              {
                id: "p-ext",
                eventId: "evt-playmore",
                displayName: null,
                manualLabel: null,
                displayOrder: 0,
                team: null,
                externalClub: {
                  name: "FC Möhlin-Riburg/ACLI",
                  shortName: null,
                  logoUrl: "https://cdn.example.com/moehlin.png",
                },
                externalTeam: null,
                dressingRoomAllocations: [],
              },
            ],
          },
        },
      });

      expect(payload.eventPresentation).toEqual([
        {
          eventId: "tournament:evt-playmore",
          participantAllocations: [
            {
              id: "p-ext",
              teamDisplayName: "FC Möhlin-Riburg/ACLI",
              dressingRoomLabel: null,
              clubLogoUrl: "https://cdn.example.com/moehlin.png",
            },
          ],
        },
      ]);
    });

    it("eventPresentation is always a new array (not mutated)", async () => {
      const loader = makeEmptyLoader();
      const p1 = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });
      const p2 = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(p1.eventPresentation).not.toBe(p2.eventPresentation);
    });
  });

  describe("announcement", () => {
    it("announcement is null (no persisted setting)", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(payload.announcement).toBeNull();
    });
  });

  describe("per-board Screen 1 presentation", () => {
    it("passes independent Training, Match, and Tournament settings to Screen 1", async () => {
      const loader = makeEmptyLoader();
      const presentation = {
        trainingShowLogos: false,
        trainingLogoSize: "SMALL" as const,
        matchShowLogos: true,
        matchLogoSize: "LARGE" as const,
        tournamentShowLogos: true,
        tournamentLogoSize: "XLARGE" as const,
        trainingFontSize: "LARGE" as const,
        matchFontSize: "SMALL" as const,
        tournamentFontSize: "XLARGE" as const,
      };

      const payload = await buildScreen1LivePayload({
        tenant: TENANT_FCA,
        now: NOW,
        loader,
        boardConfig: { presentation },
      });

      expect(payload.presentation).toEqual(presentation);
    });
  });

  describe("branding", () => {
    it("productLogoSrc is the SportClubEvo logo path", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(payload.branding.productLogoSrc).toBe("/images/branding/sportclubevo_logo.png");
    });

    it("uses known FC Allschwil logo path when tenant.key matches", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(payload.branding.clubLogoSrc).toBe("/images/logos/fc-allschwil.png");
    });

    it("uses tenant.logoUrl when set (highest priority)", async () => {
      const loader = makeEmptyLoader();
      const tenant: Screen1TenantContext = {
        ...TENANT_FCA,
        logoUrl: "https://example.com/custom-logo.png",
      };
      const payload = await buildScreen1LivePayload({ tenant, now: NOW, loader });

      expect(payload.branding.clubLogoSrc).toBe("https://example.com/custom-logo.png");
    });

    it("logoUrl overrides key-based resolution for FC Allschwil", async () => {
      const loader = makeEmptyLoader();
      const tenant: Screen1TenantContext = {
        ...TENANT_FCA,
        key: "fc-allschwil",
        logoUrl: "https://example.com/override.png",
      };
      const payload = await buildScreen1LivePayload({ tenant, now: NOW, loader });

      expect(payload.branding.clubLogoSrc).toBe("https://example.com/override.png");
    });

    it("returns null clubLogoSrc for unknown tenant without logoUrl", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({
        tenant: TENANT_OTHER,
        now: NOW,
        loader,
      });

      expect(payload.branding.clubLogoSrc).toBeNull();
    });
  });

  describe("feed content", () => {
    it("includes eligible training events in the feed", async () => {
      const event = makeBaseEvent({
        type: "TRAINING",
        infoboardVisible: true,
        trainingsplanVisible: true,
      });
      const loader = makeLoader([event]);
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      // Training in the future should appear in 'next' or 'later'
      const allEvents = [
        ...payload.feed.current,
        ...payload.feed.next,
        ...payload.feed.later,
      ];
      expect(allEvents.some((e) => e.id === event.id)).toBe(true);
    });

    it("away matches are excluded by publication policy (not infoboard eligible)", async () => {
      const awayMatch = makeBaseEvent({
        type: "MATCH",
        homeAway: "AWAY",
        infoboardVisible: true,
        websiteVisible: true,
      });
      const loader = makeLoader([awayMatch]);
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      const allEvents = [
        ...payload.feed.current,
        ...payload.feed.next,
        ...payload.feed.later,
      ];
      // Away matches are not eligible for INFOBOARD_SCREEN_1 per publication policy
      expect(allEvents.some((e) => e.id === awayMatch.id)).toBe(false);
    });

    it("feed isEmpty is true when no eligible events", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(payload.feed.isEmpty).toBe(true);
    });

    it("feed isStale is false (freshly loaded)", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(payload.feed.isStale).toBe(false);
    });
  });

  describe("error propagation", () => {
    it("propagates RangeError from invalid timezone", async () => {
      const loader = makeEmptyLoader();
      const tenant: Screen1TenantContext = {
        ...TENANT_FCA,
        timezone: "Not/A/Timezone",
      };

      await expect(
        buildScreen1LivePayload({ tenant, now: NOW, loader }),
      ).rejects.toThrow(RangeError);
    });

    it("propagates loader errors", async () => {
      const loader = vi.fn().mockRejectedValue(new Error("Loader failure"));
      await expect(
        buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader }),
      ).rejects.toThrow("Loader failure");
    });
  });

  describe("determinism", () => {
    it("same inputs produce structurally identical feed shape", async () => {
      const loader1 = makeEmptyLoader();
      const loader2 = makeEmptyLoader();
      const p1 = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader: loader1 });
      const p2 = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader: loader2 });

      expect(p1.feed.displayDate).toBe(p2.feed.displayDate);
      expect(p1.feed.tenant).toEqual(p2.feed.tenant);
    });
  });

  // ── Display theme (INFOBOARD-INTEGRATION-01B) ───────────────────────────────
  // Presentation only — theme resolution must never change feed content.

  describe("theme", () => {
    it("defaults to DARK when tenant.infoboardDisplayTheme is absent", async () => {
      const loader = makeEmptyLoader();
      const payload = await buildScreen1LivePayload({ tenant: TENANT_FCA, now: NOW, loader });

      expect(payload.theme).toBe("DARK");
    });

    it("defaults to DARK when tenant.infoboardDisplayTheme is null", async () => {
      const loader = makeEmptyLoader();
      const tenant: Screen1TenantContext = { ...TENANT_FCA, infoboardDisplayTheme: null };
      const payload = await buildScreen1LivePayload({ tenant, now: NOW, loader });

      expect(payload.theme).toBe("DARK");
    });

    it("resolves LIGHT when tenant.infoboardDisplayTheme is 'LIGHT'", async () => {
      const loader = makeEmptyLoader();
      const tenant: Screen1TenantContext = { ...TENANT_FCA, infoboardDisplayTheme: "LIGHT" };
      const payload = await buildScreen1LivePayload({ tenant, now: NOW, loader });

      expect(payload.theme).toBe("LIGHT");
    });

    it("resolves DARK when tenant.infoboardDisplayTheme is 'DARK'", async () => {
      const loader = makeEmptyLoader();
      const tenant: Screen1TenantContext = { ...TENANT_FCA, infoboardDisplayTheme: "DARK" };
      const payload = await buildScreen1LivePayload({ tenant, now: NOW, loader });

      expect(payload.theme).toBe("DARK");
    });

    it("falls back to DARK for an unrecognised persisted value", async () => {
      const loader = makeEmptyLoader();
      const tenant: Screen1TenantContext = { ...TENANT_FCA, infoboardDisplayTheme: "NEON" };
      const payload = await buildScreen1LivePayload({ tenant, now: NOW, loader });

      expect(payload.theme).toBe("DARK");
    });

    it("does not change the resolved feed content when theme is LIGHT vs DARK", async () => {
      const event = makeBaseEvent({ type: "TRAINING" });
      const darkPayload = await buildScreen1LivePayload({
        tenant: { ...TENANT_FCA, infoboardDisplayTheme: "DARK" },
        now: NOW,
        loader: makeLoader([event]),
      });
      const lightPayload = await buildScreen1LivePayload({
        tenant: { ...TENANT_FCA, infoboardDisplayTheme: "LIGHT" },
        now: NOW,
        loader: makeLoader([event]),
      });

      expect(darkPayload.theme).toBe("DARK");
      expect(lightPayload.theme).toBe("LIGHT");
      // Same activity data regardless of theme — presentation only.
      expect(darkPayload.feed.current).toEqual(lightPayload.feed.current);
      expect(darkPayload.feed.next).toEqual(lightPayload.feed.next);
      expect(darkPayload.feed.later).toEqual(lightPayload.feed.later);
      expect(darkPayload.feed.isEmpty).toBe(lightPayload.feed.isEmpty);
    });
  });
});
