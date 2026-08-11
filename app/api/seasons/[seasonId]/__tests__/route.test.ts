/**
 * SEASON-01 — /api/seasons/[seasonId] route tests (PATCH edit, DELETE
 * dependency-checked delete). Business logic is covered live in
 * lib/seasons/__tests__/season-01-mutations.test.ts — this file asserts
 * request/response plumbing and domain-error -> HTTP mapping only.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  updateSeasonDetails: vi.fn(),
  deleteSeason: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/seasons/mutations", () => ({
  updateSeasonDetails: mocks.updateSeasonDetails,
  deleteSeason: mocks.deleteSeason,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { DELETE, PATCH } from "@/app/api/seasons/[seasonId]/route";
import { SeasonHasDependenciesError, SeasonNotFoundError } from "@/lib/seasons/errors";
import { NextRequest } from "next/server";

const SEASON_ID = "season-1";

function mockAuthorized() {
  mocks.requireApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: "actor-1" } },
  });
}

function ctx() {
  return { params: Promise.resolve({ seasonId: SEASON_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/seasons/[seasonId]", () => {
  it("delegates name/date edits to updateSeasonDetails", async () => {
    mockAuthorized();
    mocks.updateSeasonDetails.mockResolvedValue({
      id: SEASON_ID,
      key: "2026/2027",
      name: "Renamed",
      isActive: false,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2027-06-30"),
    });

    const req = new NextRequest(`http://localhost/api/seasons/${SEASON_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.updateSeasonDetails).toHaveBeenCalledWith(
      SEASON_ID,
      { name: "Renamed", startDate: undefined, endDate: undefined },
      "actor-1",
    );
    expect(body.season.name).toBe("Renamed");
  });

  it("maps SeasonNotFoundError to 404", async () => {
    mockAuthorized();
    mocks.updateSeasonDetails.mockRejectedValue(new SeasonNotFoundError());

    const req = new NextRequest(`http://localhost/api/seasons/${SEASON_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "x" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, ctx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when the caller lacks seasons.manage", async () => {
    mocks.requireApiPermission.mockResolvedValue({ ok: false, status: 403, error: "Forbidden", session: null });

    const req = new NextRequest(`http://localhost/api/seasons/${SEASON_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "x" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, ctx());
    expect(res.status).toBe(403);
    expect(mocks.updateSeasonDetails).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/seasons/[seasonId]", () => {
  it("deletes an unused Season", async () => {
    mockAuthorized();
    mocks.deleteSeason.mockResolvedValue({ id: SEASON_ID, name: "Season 2026/2027" });

    const req = new NextRequest(`http://localhost/api/seasons/${SEASON_ID}`, { method: "DELETE" });
    const res = await DELETE(req, ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toContain("gelöscht");
  });

  // toSeasonApiErrorResponse still maps SeasonHasDependenciesError → 409 for
  // any caller that might throw it. deleteSeason itself no longer throws it
  // (C1: deps are decoupled, not blocking), but the mapping is kept for safety.
  it("toSeasonApiErrorResponse maps SeasonHasDependenciesError to 409 with counts (error-mapper regression)", async () => {
    mockAuthorized();
    mocks.deleteSeason.mockRejectedValue(
      new SeasonHasDependenciesError({
        teamSeasons: 3,
        events: 1,
        eventImportRuns: 0,
        trainingPlans: 0,
        orgUnitMemberships: 0,
      }),
    );

    const req = new NextRequest(`http://localhost/api/seasons/${SEASON_ID}`, { method: "DELETE" });
    const res = await DELETE(req, ctx());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("HAS_DEPENDENCIES");
    expect(body.counts).toEqual({ teamSeasons: 3, events: 1, eventImportRuns: 0, trainingPlans: 0, orgUnitMemberships: 0 });
  });
});
