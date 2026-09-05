/**
 * Pure public-route tests: all feed/publication queries are fully mocked.
 * No Prisma client, network service, or persistent state is used.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGroupedWochenplan: vi.fn(),
  getDefaultTenant: vi.fn(),
  getWochenplanPublication: vi.fn(),
  formatWochenplanVariantBadge: vi.fn(),
}));

vi.mock("@/lib/events/public-event-feed", () => ({
  getGroupedWochenplan: mocks.getGroupedWochenplan,
}));

vi.mock("@/lib/tenants/queries", () => ({
  getDefaultTenant: mocks.getDefaultTenant,
}));

vi.mock("@/lib/wochenplan/publication-queries", () => ({
  getWochenplanPublication: mocks.getWochenplanPublication,
  formatWochenplanVariantBadge: mocks.formatWochenplanVariantBadge,
}));

const { GET } = await import("../route");

describe("GET /api/public/wochenplan error disclosure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a generic 500 without a raw internal exception", async () => {
    mocks.getGroupedWochenplan.mockRejectedValue(
      new Error("Prisma P1001: cannot reach db.internal.example"),
    );

    const response = await GET(
      new NextRequest("https://sce.example/api/public/wochenplan"),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe(
      "Ein technischer Fehler ist aufgetreten. Bitte versuche es später erneut.",
    );
    expect(JSON.stringify(body)).not.toMatch(/Prisma|P1001|db\.internal/);
  });
});
