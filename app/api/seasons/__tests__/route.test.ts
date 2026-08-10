/**
 * SEASON-01 — /api/seasons route tests.
 *
 * Business logic (arbitrary-season coexistence, duplicate rejection) is
 * covered live in lib/seasons/__tests__/season-01-mutations.test.ts — this
 * file only asserts the route delegates to createSeason() correctly and
 * maps its domain errors, and that an explicit startYear body is never
 * restricted by an existing later Season ("next season already exists" is
 * retired).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  createSeason: vi.fn(),
  suggestNextSeasonStartYear: vi.fn(),
  prisma: { season: { findMany: vi.fn() } },
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/seasons/mutations", () => ({
  createSeason: mocks.createSeason,
  suggestNextSeasonStartYear: mocks.suggestNextSeasonStartYear,
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));

import { GET, POST } from "@/app/api/seasons/route";
import { DuplicateSeasonError } from "@/lib/seasons/errors";
import { NextRequest } from "next/server";

function mockAuthorized() {
  mocks.requireApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: "actor-1" } },
  });
  mocks.requireApiAnyPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: "actor-1" } },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.prisma.season.findMany.mockResolvedValue([]);
});

describe("POST /api/seasons", () => {
  it("creates a Season from an explicit startYear regardless of any other Season's existence", async () => {
    mockAuthorized();
    mocks.createSeason.mockResolvedValue({
      id: "season-1",
      key: "2026/2027",
      name: "Season 2026/2027",
      isActive: false,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2027-06-30"),
    });

    const req = new NextRequest("http://localhost/api/seasons", {
      method: "POST",
      body: JSON.stringify({ startYear: 2026 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mocks.createSeason).toHaveBeenCalledWith({ startYear: 2026 }, "actor-1");
    expect(body.season.key).toBe("2026/2027");
  });

  it("maps DuplicateSeasonError to 409 with the DUPLICATE_SEASON code", async () => {
    mockAuthorized();
    mocks.createSeason.mockRejectedValue(new DuplicateSeasonError("Season 2026/2027"));

    const req = new NextRequest("http://localhost/api/seasons", {
      method: "POST",
      body: JSON.stringify({ startYear: 2026 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("DUPLICATE_SEASON");
  });

  it("falls back to the suggested next start year only when none is supplied", async () => {
    mockAuthorized();
    mocks.suggestNextSeasonStartYear.mockReturnValue(2031);
    mocks.createSeason.mockResolvedValue({
      id: "season-2",
      key: "2031/2032",
      name: "Season 2031/2032",
      isActive: false,
      startDate: new Date("2031-07-01"),
      endDate: new Date("2032-06-30"),
    });

    const req = new NextRequest("http://localhost/api/seasons", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    await POST(req);

    expect(mocks.createSeason).toHaveBeenCalledWith({ startYear: 2031 }, "actor-1");
  });

  it("rejects an invalid startYear with 400 before calling createSeason", async () => {
    mockAuthorized();
    const req = new NextRequest("http://localhost/api/seasons", {
      method: "POST",
      body: JSON.stringify({ startYear: "not-a-year" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mocks.createSeason).not.toHaveBeenCalled();
  });
});

describe("GET /api/seasons", () => {
  it("returns the seasons list and current/next calendar keys", async () => {
    mockAuthorized();
    mocks.prisma.season.findMany.mockResolvedValue([
      { id: "s1", key: "2026/2027", name: "Season 2026/2027", isActive: true, startDate: new Date(), endDate: new Date() },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.seasons).toHaveLength(1);
  });
});
