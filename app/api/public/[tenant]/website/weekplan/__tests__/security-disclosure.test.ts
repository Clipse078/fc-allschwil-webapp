/**
 * Pure public-route test: the tenant lookup is mocked to fail before any
 * downstream query can run. No Prisma client, network, or persistent state.
 */
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tenantFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: { findFirst: mocks.tenantFindFirst },
  },
}));

const { GET } = await import("../route");

describe("GET /api/public/[tenant]/website/weekplan error disclosure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a generic 500 without a raw internal exception", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.tenantFindFirst.mockRejectedValue(
      new Error("Prisma P1001 at db.internal.example:5432"),
    );

    const response = await GET(
      new NextRequest(
        "https://sce.example/api/public/fc-test/website/weekplan",
      ),
      { params: Promise.resolve({ tenant: "fc-test" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe(
      "Ein technischer Fehler ist aufgetreten. Bitte versuche es später erneut.",
    );
    expect(JSON.stringify(body)).not.toMatch(/Prisma|P1001|db\.internal|5432/);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(
      /Prisma|P1001|db\.internal|5432/,
    );
  });
});
