/**
 * @vitest-environment jsdom
 */

/**
 * app/infoboard/screen-2/__tests__/page.test.tsx
 *
 * INFOBOARD-MAP-01C — Focused tests for the /infoboard/screen-2 public route.
 *
 * Critical invariants:
 *   - ANLAGENUEBERSICHT board → renders InfoboardAnlageplan
 *   - TAGESUEBERSICHT / no board → renders InfoboardScreen2 (legacy)
 *   - Renderer selection is based on stored templateType, NOT the slug string
 *   - Background URL from the board is passed to InfoboardAnlageplan
 *   - Tenant not found → notFound()
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  resolveKioskTenant: vi.fn(),
  getInfoboardBySlug: vi.fn(),
  buildScreen2LivePayload: vi.fn(),
  buildAnlageplanLivePayload: vi.fn(),
  getCanonicalKioskWeather: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/lib/infoboard/kiosk-tenant", () => ({
  resolveKioskTenant: mocks.resolveKioskTenant,
}));

vi.mock("@/lib/infoboard/queries", () => ({
  getInfoboardBySlug: mocks.getInfoboardBySlug,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findMany: vi.fn().mockResolvedValue([]) },
    trainingSession: { findMany: vi.fn().mockResolvedValue([]) },
    facilityResource: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/publishing/infoboard/screen2-live-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/publishing/infoboard/screen2-live-service")
  >("@/lib/publishing/infoboard/screen2-live-service");
  return {
    ...actual,
    buildScreen2LivePayload: mocks.buildScreen2LivePayload,
  };
});

vi.mock("@/lib/publishing/infoboard/anlageplan-live-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/publishing/infoboard/anlageplan-live-service")
  >("@/lib/publishing/infoboard/anlageplan-live-service");
  return {
    ...actual,
    buildAnlageplanLivePayload: mocks.buildAnlageplanLivePayload,
  };
});

vi.mock("@/lib/infoboard/kiosk-weather", () => ({
  getCanonicalKioskWeather: mocks.getCanonicalKioskWeather,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTIVE_TENANT = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  timezone: "Europe/Zurich",
  logoUrl: null,
  infoboardDisplayTheme: null,
};

const NOW_ISO = "2026-08-14T10:00:00.000Z";

const BASE_SCREEN2_FEED = {
  generatedAt: NOW_ISO,
  tenant: {
    id: "tenant-fca",
    key: "fc-allschwil",
    name: "FC Allschwil",
    timezone: "Europe/Zurich",
  },
  pitches: [],
  dressingRooms: [],
  unallocated: [],
};

const SCREEN2_PAYLOAD = {
  feed: BASE_SCREEN2_FEED,
  branding: {
    clubLogoSrc: "/images/logos/fc-allschwil.png",
    productLogoSrc: "/images/branding/sportclubevo_logo.png",
  },
  currentTimeIso: NOW_ISO,
  theme: "DARK" as const,
};

const ANLAGEPLAN_PAYLOAD = {
  screen2: { feed: BASE_SCREEN2_FEED },
  anlageplanConfig: { version: 1 as const, elements: [] },
  backgroundUrl: "https://cdn.example.com/anlageplan.jpg",
  backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 },
  currentTimeIso: NOW_ISO,
};

const ANLAGEPLAN_BOARD = {
  id: "board-1",
  tenantId: "tenant-fca",
  name: "Anlageplan Screen 2",
  slug: "screen-2",
  status: "ACTIVE" as const,
  templateType: "ANLAGENUEBERSICHT",
  anlageplanJson: JSON.stringify({ version: 1, elements: [] }),
  anlageplanBackgroundUrl: "https://cdn.example.com/anlageplan.jpg",
  displayTheme: null,
  headerSubtitleEnabled: false,
  headerSubtitleText: null,
  headerShowTime: true,
  headerShowDate: true,
  headerShowWeather: false,
  announcementEnabled: false,
  announcementText: null,
  announcementBgColor: null,
  announcementTextColor: null,
  layoutJson: null,
  sortOrder: 1,
  createdAt: new Date(NOW_ISO),
  updatedAt: new Date(NOW_ISO),
};

const TAGESUEBERSICHT_BOARD = {
  ...ANLAGEPLAN_BOARD,
  templateType: "TAGESUEBERSICHT",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InfoboardScreen2Page — /infoboard/screen-2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveKioskTenant.mockResolvedValue(ACTIVE_TENANT);
    mocks.getInfoboardBySlug.mockResolvedValue(null);
    mocks.buildScreen2LivePayload.mockResolvedValue(SCREEN2_PAYLOAD);
    mocks.buildAnlageplanLivePayload.mockResolvedValue(ANLAGEPLAN_PAYLOAD);
    mocks.getCanonicalKioskWeather.mockResolvedValue({ isAvailable: false });
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  // ── Critical: ANLAGENUEBERSICHT → renders Anlageplan ────────────────────────

  describe("ANLAGENUEBERSICHT board renders InfoboardAnlageplan", () => {
    it("renders InfoboardAnlageplan when board templateType is ANLAGENUEBERSICHT", async () => {
      mocks.getInfoboardBySlug.mockResolvedValue(ANLAGEPLAN_BOARD);
      const { default: Page } = await import("../page");
      const { container } = render(await Page());

      // InfoboardAnlageplan renders the anlageplan-map-canvas (INFOBOARD-MAP-02)
      expect(container.querySelector('[data-testid="infoboard-anlageplan-root"]')).toBeTruthy();
    });

    it("calls buildAnlageplanLivePayload (not buildScreen2LivePayload) for ANLAGENUEBERSICHT", async () => {
      mocks.getInfoboardBySlug.mockResolvedValue(ANLAGEPLAN_BOARD);
      const { default: Page } = await import("../page");
      await Page();

      expect(mocks.buildAnlageplanLivePayload).toHaveBeenCalledTimes(1);
      expect(mocks.buildScreen2LivePayload).not.toHaveBeenCalled();
    });

    it("getInfoboardBySlug is called with slug 'screen-2'", async () => {
      const { default: Page } = await import("../page");
      await Page();

      expect(mocks.getInfoboardBySlug).toHaveBeenCalledWith(
        "screen-2",
        ACTIVE_TENANT.id,
      );
    });
  });

  // ── Legacy: no board / TAGESUEBERSICHT → renders Screen2 ────────────────────

  describe("Legacy Screen2 renderer for non-ANLAGENUEBERSICHT boards", () => {
    it("renders InfoboardScreen2 when no board exists with slug screen-2", async () => {
      mocks.getInfoboardBySlug.mockResolvedValue(null);
      const { default: Page } = await import("../page");
      const { container } = render(await Page());

      // InfoboardScreen2 has FELDBELEGUNG heading — verify via buildScreen2LivePayload
      expect(mocks.buildScreen2LivePayload).toHaveBeenCalledTimes(1);
      expect(mocks.buildAnlageplanLivePayload).not.toHaveBeenCalled();
    });

    it("renders InfoboardScreen2 when board templateType is TAGESUEBERSICHT", async () => {
      mocks.getInfoboardBySlug.mockResolvedValue(TAGESUEBERSICHT_BOARD);
      const { default: Page } = await import("../page");
      await Page();

      expect(mocks.buildScreen2LivePayload).toHaveBeenCalledTimes(1);
      expect(mocks.buildAnlageplanLivePayload).not.toHaveBeenCalled();
    });

    it("renders InfoboardScreen2 when board is DRAFT (not ACTIVE)", async () => {
      mocks.getInfoboardBySlug.mockResolvedValue({
        ...ANLAGEPLAN_BOARD,
        status: "DRAFT",
      });
      const { default: Page } = await import("../page");
      await Page();

      expect(mocks.buildScreen2LivePayload).toHaveBeenCalledTimes(1);
      expect(mocks.buildAnlageplanLivePayload).not.toHaveBeenCalled();
    });

    it("slug is just an identifier — 'screen-2' slug does not force Screen2 renderer", async () => {
      // The slug "screen-2" must not hard-select the Screen2 renderer.
      // Only templateType determines the renderer.
      mocks.getInfoboardBySlug.mockResolvedValue(ANLAGEPLAN_BOARD);
      const { default: Page } = await import("../page");
      await Page();

      // ANLAGENUEBERSICHT board with slug "screen-2" → Anlageplan
      expect(mocks.buildAnlageplanLivePayload).toHaveBeenCalledTimes(1);
      expect(mocks.buildScreen2LivePayload).not.toHaveBeenCalled();
    });
  });

  // ── Tenant resolution ────────────────────────────────────────────────────────

  describe("Tenant resolution", () => {
    it("calls notFound when tenant is null", async () => {
      mocks.resolveKioskTenant.mockResolvedValue(null);
      const { default: Page } = await import("../page");
      await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.notFound).toHaveBeenCalled();
    });

    it("calls notFound when tenant timezone is null", async () => {
      mocks.resolveKioskTenant.mockResolvedValue({ ...ACTIVE_TENANT, timezone: null });
      const { default: Page } = await import("../page");
      await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.notFound).toHaveBeenCalled();
    });

    it("passes resolved tenant id to slug lookup", async () => {
      const { default: Page } = await import("../page");
      await Page();
      expect(mocks.getInfoboardBySlug).toHaveBeenCalledWith(
        "screen-2",
        "tenant-fca",
      );
    });
  });

  // ── Background URL from board ─────────────────────────────────────────────

  describe("Background URL passed to Anlageplan renderer", () => {
    it("buildAnlageplanLivePayload receives board with anlageplanBackgroundUrl", async () => {
      mocks.getInfoboardBySlug.mockResolvedValue(ANLAGEPLAN_BOARD);
      const { default: Page } = await import("../page");
      await Page();

      const call = mocks.buildAnlageplanLivePayload.mock.calls[0][0] as {
        board: typeof ANLAGEPLAN_BOARD;
      };
      expect(call.board.anlageplanBackgroundUrl).toBe(
        "https://cdn.example.com/anlageplan.jpg",
      );
    });
  });
});
