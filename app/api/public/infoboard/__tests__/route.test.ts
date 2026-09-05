/**
 * Pure public-route tests: tenant and feed queries are fully mocked.
 * No Prisma client, network service, or persistent state is used.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDefaultTenant: vi.fn(),
  getInfoboardFeed: vi.fn(),
}));

vi.mock("@/lib/tenants/queries", () => ({
  getDefaultTenant: mocks.getDefaultTenant,
}));

vi.mock("@/lib/events/public-event-feed", () => ({
  getInfoboardFeed: mocks.getInfoboardFeed,
}));

const { GET } = await import("../route");

function request() {
  return new NextRequest("https://sce.example/api/public/infoboard");
}

describe("GET /api/public/infoboard error disclosure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getDefaultTenant.mockResolvedValue({
      id: "tenant-1",
      key: "fc-test",
    });
    mocks.getInfoboardFeed.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a generic 500 without a raw internal exception", async () => {
    mocks.getInfoboardFeed.mockRejectedValue(
      new Error(
        "Connection refused at db.internal.example:5432 user=app password=secret",
      ),
    );

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe(
      "Ein technischer Fehler ist aufgetreten. Bitte versuche es später erneut.",
    );
    expect(JSON.stringify(body)).not.toMatch(
      /db\.internal|5432|password|Connection refused/,
    );
  });

  it("preserves the intentional tenant-safe not-found response", async () => {
    mocks.getDefaultTenant.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Tenant not found." });
  });
});
