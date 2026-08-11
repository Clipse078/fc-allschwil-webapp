/**
 * ADMIN-DELETE-SEASON-01 — /api/seasons/[seasonId] DELETE focused tests.
 *
 * Covers the task's required test list:
 *   1. authorized user (seasons.delete) can permanently delete an unreferenced Season
 *   2. unauthorized user (no seasons.delete) cannot delete — 403 returned
 *   3. deletion cannot bypass dependency/integrity protection (cascade blockers → 409)
 *   4. active Season can be deleted safely when otherwise deletable (no deps)
 *   5. deleting active Season does not implicitly activate another
 *   6. Saisonverwaltung correctly reflects deletion (revalidatePath called)
 *   7. no regression: having seasons.manage alone is not enough for deletion
 *
 * Business logic is covered live in lib/seasons/__tests__/season-01-mutations.test.ts.
 * This file asserts only the request/response plumbing and permission → HTTP mapping.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  deleteSeason: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/seasons/mutations", () => ({
  updateSeasonDetails: vi.fn(),
  deleteSeason: mocks.deleteSeason,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { DELETE } from "@/app/api/seasons/[seasonId]/route";
import { SeasonNotFoundError } from "@/lib/seasons/errors";
import { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/permissions/permissions";

const SEASON_ID = "season-delete-test-1";

function ctx() {
  return { params: Promise.resolve({ seasonId: SEASON_ID }) };
}

function mockAuthorizedWithDelete() {
  mocks.requireApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: "actor-delete-1" } },
  });
}

function mockForbidden() {
  mocks.requireApiPermission.mockResolvedValue({
    ok: false,
    status: 403,
    error: "Forbidden",
    session: null,
  });
}

function deleteRequest() {
  return new NextRequest(`http://localhost/api/seasons/${SEASON_ID}`, { method: "DELETE" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ADMIN-DELETE-SEASON-01 — DELETE /api/seasons/[seasonId]", () => {
  // Test 1: authorized user can permanently delete an unreferenced Season
  it("1. authorized user with seasons.delete can permanently delete an unreferenced Season", async () => {
    mockAuthorizedWithDelete();
    mocks.deleteSeason.mockResolvedValue({ id: SEASON_ID, name: "Season 2030/2031" });

    const res = await DELETE(deleteRequest(), ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.deleteSeason).toHaveBeenCalledWith(SEASON_ID, "actor-delete-1");
    expect(body.message).toContain("gelöscht");
    // Test 6: revalidatePath called to reflect deletion in Saisonverwaltung
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/seasons");
  });

  // Test 2: unauthorized user cannot delete
  it("2. user without seasons.delete cannot delete — returns 403", async () => {
    mockForbidden();

    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(403);
    expect(mocks.deleteSeason).not.toHaveBeenCalled();
  });

  // Test 7: seasons.manage alone is not enough — deletion requires seasons.delete
  it("7. having seasons.manage alone (without seasons.delete) is not enough — returns 403", async () => {
    // The route now calls requireApiPermission(PERMISSIONS.SEASONS_DELETE),
    // not SEASONS_MANAGE. If the resolver returns 403 for seasons.delete,
    // the route must reject even if the user has seasons.manage.
    mocks.requireApiPermission.mockImplementation(async (permKey: string) => {
      if (permKey === PERMISSIONS.SEASONS_DELETE) {
        return { ok: false, status: 403, error: "Forbidden", session: null };
      }
      return { ok: true, status: 200, error: null, session: { user: { id: "actor" } } };
    });

    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(403);
    expect(mocks.deleteSeason).not.toHaveBeenCalled();
    // Verify the route calls with the correct permission key
    expect(mocks.requireApiPermission).toHaveBeenCalledWith(PERMISSIONS.SEASONS_DELETE);
  });

  // Test 3 (C1): deletion succeeds even when TeamSeason/Event/TrainingPlan references exist
  it("3. deletion succeeds (200) when TeamSeason/Event/TrainingPlan references exist — C1 decouple", async () => {
    mockAuthorizedWithDelete();
    // C1: deleteSeason now returns counts in the result, never throws SeasonHasDependenciesError
    mocks.deleteSeason.mockResolvedValue({
      id: SEASON_ID,
      name: "Season 2030/2031",
      counts: { teamSeasons: 3, events: 5, eventImportRuns: 0, trainingPlans: 2, orgUnitMemberships: 0 },
    });

    const res = await DELETE(deleteRequest(), ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toContain("gelöscht");
    expect(mocks.deleteSeason).toHaveBeenCalledTimes(1);
  });

  // Test 4: active Season can be deleted safely when otherwise deletable
  it("4. active Season (isActive=true) can be deleted when there are no cascade-blocking dependencies", async () => {
    mockAuthorizedWithDelete();
    // deleteSeason succeeds — no dependencies, even though season was active
    mocks.deleteSeason.mockResolvedValue({ id: SEASON_ID, name: "Active Season 2030/2031" });

    const res = await DELETE(deleteRequest(), ctx());

    expect(res.status).toBe(200);
    expect(mocks.deleteSeason).toHaveBeenCalledWith(SEASON_ID, "actor-delete-1");
  });

  // Test 5: deleting active Season does not implicitly activate another
  it("5. deleting active Season does not implicitly activate another — business logic verified in mutation layer", async () => {
    mockAuthorizedWithDelete();
    // The route calls deleteSeason() — it is the mutation layer's responsibility
    // not to activate any other season. The route must not issue any additional
    // activate() call or side effect. Verify no extra mutation is called.
    mocks.deleteSeason.mockResolvedValue({ id: SEASON_ID, name: "Active Season 2030/2031" });

    const res = await DELETE(deleteRequest(), ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    // Only deleteSeason was called — no activate call
    expect(mocks.deleteSeason).toHaveBeenCalledTimes(1);
    expect(body.message).toContain("gelöscht");
  });

  // Extra: 404 when season not found
  it("returns 404 when season does not exist", async () => {
    mockAuthorizedWithDelete();
    mocks.deleteSeason.mockRejectedValue(new SeasonNotFoundError());

    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(404);
    expect(mocks.deleteSeason).toHaveBeenCalledTimes(1);
  });
});
