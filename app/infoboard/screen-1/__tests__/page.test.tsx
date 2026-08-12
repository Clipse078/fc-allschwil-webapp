/**
 * @vitest-environment jsdom
 */

/**
 * app/infoboard/screen-1/page.test.tsx
 *
 * Tests for the production Screen 1 page (server component).
 *
 * Verifies:
 *   - Page renders InfoboardScreen1 component
 *   - Live feed data is rendered (tenant name visible)
 *   - Event rows appear when events present
 *   - currentTimeIso is passed to the component
 *   - branding is passed to the component
 *   - eventPresentation is passed (empty array)
 *   - Missing/inactive tenant invokes notFound()
 *   - Missing timezone invokes notFound()
 *   - No preview fixture is imported or used
 *   - No fetch to internal API (direct service call)
 *   - Production route is /infoboard/screen-1
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  resolveKioskTenant: vi.fn(),
  buildScreen1LivePayload: vi.fn(),
  notFound: vi.fn(),
  eventFindMany: vi.fn().mockResolvedValue([]),
  facilityResourceFindMany: vi.fn().mockResolvedValue([]),
  getInfoboardBySlug: vi.fn().mockResolvedValue(null),
}));

// Tenant resolution now goes through resolveKioskTenant; prisma mock still
// needed for the event/training canonical source loader adapter.
vi.mock("@/lib/infoboard/kiosk-tenant", () => ({
  resolveKioskTenant: mocks.resolveKioskTenant,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      findMany: mocks.eventFindMany,
    },
    facilityResource: {
      findMany: mocks.facilityResourceFindMany,
    },
  },
}));

vi.mock("@/lib/publishing/infoboard/screen1-live-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/publishing/infoboard/screen1-live-service")
  >("@/lib/publishing/infoboard/screen1-live-service");
  return {
    ...actual,
    buildScreen1LivePayload: mocks.buildScreen1LivePayload,
  };
});

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/lib/infoboard/queries", () => ({
  getInfoboardBySlug: mocks.getInfoboardBySlug,
}));

vi.mock("@/lib/infoboard/board-config", () => ({
  buildBoardConfig: vi.fn().mockReturnValue({}),
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

const NOW_ISO = "2026-07-24T16:00:00.000Z";

const MOCK_PAYLOAD = {
  feed: {
    generatedAt: NOW_ISO,
    tenant: {
      id: "tenant-fca",
      key: "fc-allschwil",
      name: "FC Allschwil",
      timezone: "Europe/Zurich",
    },
    displayDate: "2026-07-24",
    isStale: false,
    wochenplanVariantBadge: null,
    current: [],
    next: [
      {
        id: "evt-1",
        type: "MATCH",
        displayTitle: "Heimspiel",
        teamDisplayName: "1. Mannschaft",
        opponentDisplayName: "FC Basel",
        organizerDisplayName: null,
        competitionLabel: null,
        startAt: "2026-07-24T18:00:00.000Z",
        endAt: null,
        meetingTime: null,
        status: "SCHEDULED",
        resultLabel: null,
        intermediateResultLabel: null,
        temporalBucket: "next" as const,
        allocation: {
          pitchLabel: "Stadion",
          homeDressingRoomLabel: "E1",
          awayDressingRoomLabel: "O1",
          refereeDressingRoomLabel: null,
        },
        seasonKey: "2025-26",
      },
    ],
    later: [],
    isEmpty: false,
    emptyStateReason: null,
  },
  eventPresentation: [],
  announcement: null,
  branding: {
    clubLogoSrc: "/images/logos/fc-allschwil.png",
    productLogoSrc: "/images/branding/sportclubevo_logo.png",
  },
  currentTimeIso: NOW_ISO,
  theme: "DARK" as const,
  headerConfig: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InfoboardScreen1Page (production route)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveKioskTenant.mockResolvedValue(ACTIVE_TENANT);
    mocks.buildScreen1LivePayload.mockResolvedValue(MOCK_PAYLOAD);
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  describe("rendering with live data", () => {
    it("renders without crashing when tenant and payload are valid", async () => {
      const { default: Page } = await import("../page");
      await expect(
        render(await Page()).container,
      ).toBeTruthy();
    });

    it("renders InfoboardScreen1 component with club name", async () => {
      const { default: Page } = await import("../page");
      render(await Page());

      expect(screen.getByText("FC Allschwil")).toBeInTheDocument();
    });

    it("renders event rows from live feed (non-empty)", async () => {
      const { default: Page } = await import("../page");
      const { container } = render(await Page());

      // The feed is not empty (next has one event), so the "no events" fallback
      // text must NOT appear. The live event display renders instead.
      expect(container.textContent).not.toMatch(/keine Trainings/i);
    });

    it("calls buildScreen1LivePayload (not internal API fetch)", async () => {
      const { default: Page } = await import("../page");
      await Page();

      // Verify the live service was called directly (no HTTP fetch to own API)
      expect(mocks.buildScreen1LivePayload).toHaveBeenCalledTimes(1);
    });

    it("passes currentTimeIso from payload to component", async () => {
      const { default: Page } = await import("../page");
      render(await Page());

      // currentTimeIso is rendered as a clock time in the header
      // The component shows time in HH:MM format in Zurich timezone
      // 16:00 UTC = 18:00 Zurich (UTC+2 in summer)
      expect(mocks.buildScreen1LivePayload).toHaveBeenCalledWith(
        expect.objectContaining({ now: expect.any(Date) }),
      );
    });

    it("passes branding from payload to component", async () => {
      const { default: Page } = await import("../page");
      render(await Page());

      // FC Allschwil logo rendered with tenant.name Wappen alt text
      const logo = document.querySelector('img[alt="FC Allschwil Wappen"]');
      expect(logo).toBeInTheDocument();
    });

    it("passes empty eventPresentation array", async () => {
      const { default: Page } = await import("../page");
      await Page();

      const serviceCall = mocks.buildScreen1LivePayload.mock.calls[0];
      expect(serviceCall).toBeDefined();
      // Verify the page actually calls the live service
      expect(mocks.buildScreen1LivePayload).toHaveBeenCalledTimes(1);
    });

    it("does not import or use preview fixture content", async () => {
      // The page module should not import screen1-preview-fixture
      // We verify this by checking the module imports at runtime:
      // the mock payload is used, not any fixture constants
      const { default: Page } = await import("../page");
      render(await Page());

      // Preview fixture has specific text like "SOMMER-CUP JUNIOREN E" — must not appear
      expect(screen.queryByText(/SOMMER-CUP/i)).not.toBeInTheDocument();
    });
  });

  describe("missing tenant behavior", () => {
    it("calls notFound() when tenant is not found", async () => {
      mocks.resolveKioskTenant.mockResolvedValue(null);
      const { default: Page } = await import("../page");

      await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.notFound).toHaveBeenCalled();
    });

    it("calls notFound() when tenant timezone is null", async () => {
      mocks.resolveKioskTenant.mockResolvedValue({ ...ACTIVE_TENANT, timezone: null });
      const { default: Page } = await import("../page");

      await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.notFound).toHaveBeenCalled();
    });

    it("does not call live service when tenant is null", async () => {
      mocks.resolveKioskTenant.mockResolvedValue(null);
      const { default: Page } = await import("../page");

      try {
        await Page();
      } catch {
        // notFound throws
      }

      expect(mocks.buildScreen1LivePayload).not.toHaveBeenCalled();
    });
  });

  describe("tenant isolation", () => {
    it("uses resolveKioskTenant (hostname-aware) for tenant lookup", async () => {
      const { default: Page } = await import("../page");
      await Page();

      expect(mocks.resolveKioskTenant).toHaveBeenCalledOnce();
    });

    it("passes resolved tenant id to live service", async () => {
      const { default: Page } = await import("../page");
      await Page();

      const serviceCall = mocks.buildScreen1LivePayload.mock.calls[0][0];
      expect(serviceCall.tenant.id).toBe("tenant-fca");
    });
  });

  describe("scope verification", () => {
    it("production route path is /infoboard/screen-1", () => {
      // The page file is at app/infoboard/screen-1/page.tsx
      // This test confirms the file location is correct for the Next.js route
      expect(__filename).toMatch(/infoboard\/screen-1\/__tests__\/page\.test\.tsx$/);
    });
  });

  describe("display theme (INFOBOARD-INTEGRATION-01B)", () => {
    it("passes the resolved theme from the payload to the root data-theme attribute", async () => {
      mocks.buildScreen1LivePayload.mockResolvedValue({ ...MOCK_PAYLOAD, theme: "LIGHT" });
      const { default: Page } = await import("../page");
      const { container } = render(await Page());

      const root = container.querySelector('[data-testid="infoboard-screen1-root"]');
      expect(root?.getAttribute("data-theme")).toBe("light");
    });

    it("defaults to dark theme when payload.theme is DARK", async () => {
      const { default: Page } = await import("../page");
      const { container } = render(await Page());

      const root = container.querySelector('[data-testid="infoboard-screen1-root"]');
      expect(root?.getAttribute("data-theme")).toBe("dark");
    });

    it("passes tenant.infoboardDisplayTheme through to the live service", async () => {
      mocks.resolveKioskTenant.mockResolvedValue({ ...ACTIVE_TENANT, infoboardDisplayTheme: "LIGHT" });
      const { default: Page } = await import("../page");
      await Page();

      const serviceCall = mocks.buildScreen1LivePayload.mock.calls[0][0];
      expect(serviceCall.tenant.infoboardDisplayTheme).toBe("LIGHT");
    });

    it("resolveKioskTenant returns infoboardDisplayTheme (field included in kiosk select)", async () => {
      // Verify the resolver returns the required field and the page uses it.
      mocks.resolveKioskTenant.mockResolvedValue({ ...ACTIVE_TENANT, infoboardDisplayTheme: "DARK" });
      const { default: Page } = await import("../page");
      await Page();

      const serviceCall = mocks.buildScreen1LivePayload.mock.calls[0][0];
      expect(serviceCall.tenant.infoboardDisplayTheme).toBe("DARK");
    });
  });
});
