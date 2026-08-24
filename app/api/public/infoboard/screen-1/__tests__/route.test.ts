/**
 * app/api/public/infoboard/screen-1/route.test.ts
 *
 * Integration tests for GET /api/public/infoboard/screen-1.
 *
 * Verifies:
 *   - Valid host resolves tenant (via mock)
 *   - Valid request returns 200
 *   - Response contains feed, currentTimeIso, branding, eventPresentation
 *   - Unknown / inactive tenant returns 404
 *   - Missing timezone on tenant returns 400
 *   - Internal loader failure returns 500 without stack trace
 *   - Cache-Control: no-store header present
 *   - No rejected-event diagnostics in response
 *   - Tenant isolation: only the resolved tenant is queried
 *   - X-Tenant-Slug header is respected
 *   - Default tenant used when no X-Tenant-Slug header
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  tenantFindFirst: vi.fn(),
  buildScreen1LivePayload: vi.fn(),
  getInfoboardBySlug: vi.fn(),
  buildBoardConfig: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: {
      findFirst: mocks.tenantFindFirst,
    },
    event: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    facilityResource: {
      findMany: vi.fn().mockResolvedValue([]),
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

vi.mock("@/lib/infoboard/queries", () => ({
  getInfoboardBySlug: mocks.getInfoboardBySlug,
}));

vi.mock("@/lib/infoboard/board-config", () => ({
  buildBoardConfig: mocks.buildBoardConfig,
}));

import { GET } from "../route";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTIVE_TENANT = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  status: "ACTIVE",
  timezone: "Europe/Zurich",
  logoUrl: null,
};

const MOCK_PAYLOAD = {
  feed: {
    generatedAt: "2026-07-24T16:00:00.000Z",
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
    next: [],
    later: [],
    isEmpty: true,
  },
  eventPresentation: [],
  announcement: null,
  branding: {
    clubLogoSrc: "/images/logos/fc-allschwil.png",
    productLogoSrc: "/images/branding/sportclubevo_logo.png",
  },
  currentTimeIso: "2026-07-24T16:00:00.000Z",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost/api/public/infoboard/screen-1";

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(BASE_URL, {
    method: "GET",
    headers,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/public/infoboard/screen-1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.buildScreen1LivePayload.mockResolvedValue(MOCK_PAYLOAD);
    mocks.getInfoboardBySlug.mockResolvedValue(null);
  });

  describe("successful response", () => {
    it("returns 200 for a valid tenant", async () => {
      const response = await GET(makeRequest());
      expect(response.status).toBe(200);
    });

    it("response contains feed", async () => {
      const response = await GET(makeRequest());
      const body = await response.json();
      expect(body).toHaveProperty("feed");
    });

    it("response contains currentTimeIso", async () => {
      const response = await GET(makeRequest());
      const body = await response.json();
      expect(body).toHaveProperty("currentTimeIso");
      expect(typeof body.currentTimeIso).toBe("string");
    });

    it("response contains branding structure", async () => {
      const response = await GET(makeRequest());
      const body = await response.json();
      expect(body).toHaveProperty("branding");
      expect(body.branding).toHaveProperty("productLogoSrc");
    });

    it("response contains eventPresentation array", async () => {
      const response = await GET(makeRequest());
      const body = await response.json();
      expect(body).toHaveProperty("eventPresentation");
      expect(Array.isArray(body.eventPresentation)).toBe(true);
    });

    it("response contains feed.tenant.name", async () => {
      const response = await GET(makeRequest());
      const body = await response.json();
      expect(body.feed.tenant.name).toBe("FC Allschwil");
    });

    it("passes the tenant-scoped screen-1 board presentation to the live service", async () => {
      const board = { id: "board-1", tenantId: "tenant-fca" };
      const boardConfig = {
        presentation: {
          trainingFontSize: "LARGE",
          matchFontSize: "SMALL",
          tournamentFontSize: "XLARGE",
        },
      };
      mocks.getInfoboardBySlug.mockResolvedValue(board);
      mocks.buildBoardConfig.mockReturnValue(boardConfig);

      await GET(makeRequest());

      expect(mocks.getInfoboardBySlug).toHaveBeenCalledWith(
        "screen-1",
        "tenant-fca",
      );
      expect(mocks.buildBoardConfig).toHaveBeenCalledWith(board);
      expect(mocks.buildScreen1LivePayload).toHaveBeenCalledWith(
        expect.objectContaining({ boardConfig }),
      );
    });
  });

  describe("caching", () => {
    it("sets Cache-Control: no-store header", async () => {
      const response = await GET(makeRequest());
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
  });

  describe("tenant resolution", () => {
    it("uses default tenant when no X-Tenant-Slug header", async () => {
      await GET(makeRequest());
      expect(mocks.tenantFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "ACTIVE" }),
        }),
      );
    });

    it("respects X-Tenant-Slug header for tenant selection", async () => {
      const customTenant = {
        ...ACTIVE_TENANT,
        key: "sc-custom",
        name: "SC Custom",
      };
      mocks.tenantFindFirst.mockResolvedValue(customTenant);

      await GET(makeRequest({ "X-Tenant-Slug": "sc-custom" }));

      const call = mocks.tenantFindFirst.mock.calls[0][0];
      expect(call.where.key).toBe("sc-custom");
    });
  });

  describe("error responses", () => {
    it("returns 404 when tenant is not found", async () => {
      mocks.tenantFindFirst.mockResolvedValue(null);
      const response = await GET(makeRequest());
      expect(response.status).toBe(404);
    });

    it("404 response does not expose database details", async () => {
      mocks.tenantFindFirst.mockResolvedValue(null);
      const response = await GET(makeRequest());
      const body = await response.json();
      expect(JSON.stringify(body)).not.toMatch(/sql|query|prisma|database/i);
    });

    it("returns 400 when tenant timezone is null", async () => {
      mocks.tenantFindFirst.mockResolvedValue({ ...ACTIVE_TENANT, timezone: null });
      const response = await GET(makeRequest());
      expect(response.status).toBe(400);
    });

    it("returns 500 when live service throws", async () => {
      mocks.buildScreen1LivePayload.mockRejectedValue(new Error("DB failure"));
      const response = await GET(makeRequest());
      expect(response.status).toBe(500);
    });

    it("500 response contains safe error message (no stack trace)", async () => {
      mocks.buildScreen1LivePayload.mockRejectedValue(new Error("Internal DB error"));
      const response = await GET(makeRequest());
      const body = await response.json();
      expect(body).toHaveProperty("error");
      expect(JSON.stringify(body)).not.toMatch(/stack|at Object|at Module/i);
    });

    it("500 response does not expose rejected-event diagnostics", async () => {
      mocks.buildScreen1LivePayload.mockRejectedValue(new Error("failure"));
      const response = await GET(makeRequest());
      const body = await response.json();
      expect(JSON.stringify(body)).not.toMatch(/rejected|eligible|REJECTED/i);
    });

    it("500 response does not expose database details", async () => {
      mocks.buildScreen1LivePayload.mockRejectedValue(new Error("failure"));
      const response = await GET(makeRequest());
      const body = await response.json();
      expect(JSON.stringify(body)).not.toMatch(/sql|query|prisma|tenantId/i);
    });
  });

  describe("tenant isolation", () => {
    it("tenant query uses ACTIVE status filter", async () => {
      await GET(makeRequest());
      const call = mocks.tenantFindFirst.mock.calls[0][0];
      expect(call.where.status).toBe("ACTIVE");
    });

    it("passes resolved tenant id to live service", async () => {
      await GET(makeRequest());
      const serviceCall = mocks.buildScreen1LivePayload.mock.calls[0][0];
      expect(serviceCall.tenant.id).toBe("tenant-fca");
    });

    it("passes resolved tenant timezone to live service", async () => {
      await GET(makeRequest());
      const serviceCall = mocks.buildScreen1LivePayload.mock.calls[0][0];
      expect(serviceCall.tenant.timezone).toBe("Europe/Zurich");
    });
  });
});
