/**
 * Tests for GET /api/public/events (legacy unversioned route).
 *
 * F. Legacy route — /api/public/events cannot expose another tenant's events.
 *    Verifies tenant isolation is enforced via header or default tenant fallback.
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  tenantFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: { findFirst: mocks.tenantFindFirst },
    event: { findMany: mocks.eventFindMany },
  },
}));

const { GET } = await import("../route");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A = {
  id: "tenant-a",
  key: "fc-allschwil",
  name: "FC Allschwil",
  status: "ACTIVE",
  websiteEnabled: true,
  approvedDataOnly: false,
};

const TENANT_B = {
  id: "tenant-b",
  key: "sc-other",
  name: "SC Other",
  status: "ACTIVE",
  websiteEnabled: true,
  approvedDataOnly: false,
};

const BASE_URL = "http://localhost/api/public/events";

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(BASE_URL, { method: "GET", headers });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/public/events — tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(TENANT_A);
    mocks.eventFindMany.mockResolvedValue([]);
  });

  it("returns 200 when default tenant is resolved", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it("DB query is always scoped to the resolved tenant id", async () => {
    await GET(makeRequest());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-a");
  });

  it("X-Tenant-Slug header selects the correct tenant", async () => {
    mocks.tenantFindFirst.mockResolvedValue(TENANT_B);
    await GET(makeRequest({ "X-Tenant-Slug": "sc-other" }));
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-b");
  });

  it("events from Tenant A cannot be returned when Tenant B is resolved", async () => {
    // Simulate request for Tenant B: tenant resolution returns TENANT_B.
    // The DB query MUST use tenant-b, making it impossible to receive tenant-a events.
    mocks.tenantFindFirst.mockResolvedValue(TENANT_B);
    await GET(makeRequest({ "X-Tenant-Slug": "sc-other" }));
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-b");
    expect(call.where.tenantId).not.toBe("tenant-a");
  });

  it("returns 404 when no tenant can be resolved", async () => {
    mocks.tenantFindFirst.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it("response shape is backward-compatible (surface, count, filters, events)", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body).toHaveProperty("surface");
    expect(body).toHaveProperty("count");
    expect(body).toHaveProperty("filters");
    expect(body).toHaveProperty("events");
    expect(Array.isArray(body.events)).toBe(true);
  });

  it("default surface is 'all'", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.surface).toBe("all");
  });

  it("500 response does not expose stack traces or Prisma internals", async () => {
    mocks.eventFindMany.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    // Must not expose stack frames or ORM query details.
    expect(JSON.stringify(body)).not.toMatch(/at Object\.|at Module\.|stack|prisma\.event/i);
  });
});
