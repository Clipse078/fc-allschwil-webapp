/**
 * app/api/training-series/[seriesId]/permanent/__tests__/route.test.ts
 *
 * ADMIN-DELETE-02A-C1 — Focused tests for the DELETE
 * /api/training-series/[seriesId]/permanent permanent-delete authorization
 * wiring AND the two-step "preview impact → explicit confirm" flow. The
 * resolver's own Club Admin / SCE Super Admin / delegated-user grant logic
 * is exhaustively covered at the resolver level — these tests verify the
 * ROUTE wiring only.
 *
 * All database and permission access is mocked. No live database access.
 *
 * TEST COVERAGE MAP:
 *   1. Club Admin: allowed within their own tenant (confirm=true deletes).
 *   2. Club Admin: denied for a series in another tenant.
 *   3. SCE Super Admin: allowed for a series in a different, ACTIVE tenant.
 *   4. Delegated user holding only trainings.delete: allowed.
 *   5. trainings.manage-only (no trainings.delete): denied.
 *   6. A client-supplied tenantId is ignored — the resolver is always
 *      called with the series' own DB-resolved tenantId.
 *   7. Without confirm=true: returns 200 with impact + requiresConfirmation,
 *      and NEVER calls deleteTrainingSeriesPermanently — even when the
 *      series has meaningful history (never blocked, never auto-deleted).
 *   8. 404 when the series does not exist.
 *   9. 401 when there is no session.
 *  10. With confirm=true: deletion proceeds even though history exists
 *      (never blocked for an authorized caller).
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  hasTenantDeletionAuthority: vi.fn(),
  logAction: vi.fn(),
  trainingSeriesFindUnique: vi.fn(),
  deleteTrainingSeriesPermanently: vi.fn(),
  getTrainingSeriesDeletionImpact: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    hasTenantDeletionAuthority: mocks.hasTenantDeletionAuthority,
  }),
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    trainingSeries: {
      findUnique: (...args: unknown[]) => mocks.trainingSeriesFindUnique(...args),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/training/training-lifecycle-service", () => ({
  deleteTrainingSeriesPermanently: mocks.deleteTrainingSeriesPermanently,
  getTrainingSeriesDeletionImpact: mocks.getTrainingSeriesDeletionImpact,
}));

import { DELETE } from "../route";
import { TrainingSeriesNotFoundError } from "@/lib/training/errors";

const SERIES_ID = "series-b2";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeContext() {
  return { params: Promise.resolve({ seriesId: SERIES_ID }) };
}

function makeAuthSession(userId = "user-01", effectiveUserId?: string) {
  return { user: { id: userId, effectiveUserId: effectiveUserId ?? userId } };
}

function makeUrl(confirm?: boolean) {
  const base = `http://localhost/api/training-series/${SERIES_ID}/permanent`;
  return confirm ? `${base}?confirm=true` : base;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(makeAuthSession());
  mocks.trainingSeriesFindUnique.mockResolvedValue({ id: SERIES_ID, tenantId: TENANT_A });
  mocks.logAction.mockResolvedValue(undefined);
  mocks.getTrainingSeriesDeletionImpact.mockResolvedValue([]);
});

describe("DELETE /api/training-series/[seriesId]/permanent — ADMIN-DELETE-02A-C1", () => {
  it("1 — Club Admin: allowed within their own tenant (confirm=true deletes)", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.trainingSeriesFindUnique.mockResolvedValueOnce({ id: SERIES_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTrainingSeriesPermanently.mockResolvedValueOnce({
      deleted: { id: SERIES_ID },
      impact: [],
    });

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith({
      userId: "club-admin-1",
      permission: "trainings.delete",
      tenantId: TENANT_A,
    });
    expect(mocks.deleteTrainingSeriesPermanently).toHaveBeenCalledWith(TENANT_A, SERIES_ID);
  });

  it("2 — Club Admin: denied for a series belonging to another tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.trainingSeriesFindUnique.mockResolvedValueOnce({ id: SERIES_ID, tenantId: TENANT_B });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(false);

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.deleteTrainingSeriesPermanently).not.toHaveBeenCalled();
  });

  it("3 — SCE Super Admin: allowed for a series in a different, ACTIVE tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("sce-super-admin-1"));
    mocks.trainingSeriesFindUnique.mockResolvedValueOnce({ id: SERIES_ID, tenantId: TENANT_B });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTrainingSeriesPermanently.mockResolvedValueOnce({
      deleted: { id: SERIES_ID },
      impact: [],
    });

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith({
      userId: "sce-super-admin-1",
      permission: "trainings.delete",
      tenantId: TENANT_B,
    });
  });

  it("4 — delegated user holding only trainings.delete: allowed within the granted tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("delegated-user-1"));
    mocks.trainingSeriesFindUnique.mockResolvedValueOnce({ id: SERIES_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTrainingSeriesPermanently.mockResolvedValueOnce({
      deleted: { id: SERIES_ID },
      impact: [],
    });

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.deleteTrainingSeriesPermanently).toHaveBeenCalledWith(TENANT_A, SERIES_ID);
  });

  it("5 — trainings.manage-only (no trainings.delete): denied, never falls back to a MANAGE check", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("manage-only-user"));
    mocks.trainingSeriesFindUnique.mockResolvedValueOnce({ id: SERIES_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(false);

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ permission: "trainings.delete" }),
    );
    expect(mocks.deleteTrainingSeriesPermanently).not.toHaveBeenCalled();
  });

  it("6 — a client-supplied tenantId (query string) is ignored; the series' own DB tenantId is used", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.trainingSeriesFindUnique.mockResolvedValueOnce({ id: SERIES_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTrainingSeriesPermanently.mockResolvedValueOnce({
      deleted: { id: SERIES_ID },
      impact: [],
    });

    const response = await DELETE(
      new NextRequest(
        `http://localhost/api/training-series/${SERIES_ID}/permanent?confirm=true&tenantId=${TENANT_B}`,
      ),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A }),
    );
    expect(mocks.deleteTrainingSeriesPermanently).toHaveBeenCalledWith(TENANT_A, SERIES_ID);
  });

  it("7 — without confirm=true: returns impact and NEVER deletes, even with meaningful history", async () => {
    mocks.trainingSeriesFindUnique.mockResolvedValueOnce({ id: SERIES_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.getTrainingSeriesDeletionImpact.mockResolvedValueOnce([
      { key: "sessions", label: "Generierte Trainingseinheiten", count: 12 },
    ]);

    const response = await DELETE(new NextRequest(makeUrl(false)), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresConfirmation).toBe(true);
    expect(body.impact).toEqual([
      { key: "sessions", label: "Generierte Trainingseinheiten", count: 12 },
    ]);
    expect(mocks.deleteTrainingSeriesPermanently).not.toHaveBeenCalled();
  });

  it("8 — 404 when the series does not exist (never authorizes or deletes)", async () => {
    mocks.trainingSeriesFindUnique.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(404);
    expect(mocks.hasTenantDeletionAuthority).not.toHaveBeenCalled();
    expect(mocks.deleteTrainingSeriesPermanently).not.toHaveBeenCalled();
  });

  it("8a — 404 when the series is deleted concurrently between authorization and the delete itself", async () => {
    mocks.trainingSeriesFindUnique.mockResolvedValueOnce({ id: SERIES_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTrainingSeriesPermanently.mockRejectedValueOnce(
      new TrainingSeriesNotFoundError(SERIES_ID),
    );

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(404);
  });

  it("9 — 401 when there is no session", async () => {
    mocks.auth.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(401);
    expect(mocks.trainingSeriesFindUnique).not.toHaveBeenCalled();
    expect(mocks.deleteTrainingSeriesPermanently).not.toHaveBeenCalled();
  });

  it("10 — with confirm=true: deletion proceeds even though history exists (never blocked)", async () => {
    mocks.trainingSeriesFindUnique.mockResolvedValueOnce({ id: SERIES_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTrainingSeriesPermanently.mockResolvedValueOnce({
      deleted: { id: SERIES_ID },
      impact: [{ key: "sessions", label: "Generierte Trainingseinheiten", count: 8 }],
    });

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.impact).toEqual([
      { key: "sessions", label: "Generierte Trainingseinheiten", count: 8 },
    ]);
    expect(mocks.deleteTrainingSeriesPermanently).toHaveBeenCalledWith(TENANT_A, SERIES_ID);
  });
});
