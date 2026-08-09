/**
 * app/api/weekplanner/plans/[planId]/__tests__/route.test.ts
 *
 * WEEKPLANNER-01E-C1 — focused tests for PATCH /api/weekplanner/plans/[planId]
 * activation/deactivation HTTP semantics:
 *   - { active: true } / { active: false } delegate to the domain service
 *   - WeekplannerPlanArchivedError → 409 (archive/activate race, Finding 1)
 *   - WeekplannerPlanActivationConflictError → 409, not an uncontrolled 500
 *     (concurrent A/B activation P2002, Finding 2)
 *   - an unrelated/unexpected error is NOT converted to 409 — it propagates
 *   - MANAGE permission is required for activation/deactivation
 *   - tenantId is always taken from the session, never the request body
 *
 * All service calls and permission checks are mocked. No live database
 * access.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  activateWeekplannerPlan: vi.fn(),
  deactivateWeekplannerPlan: vi.fn(),
  archiveWeekplannerPlan: vi.fn(),
  renameWeekplannerPlan: vi.fn(),
  deleteWeekplannerPlan: vi.fn(),
  getWeekplannerPlan: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/weekplanner/plan-service", () => ({
  activateWeekplannerPlan: mocks.activateWeekplannerPlan,
  deactivateWeekplannerPlan: mocks.deactivateWeekplannerPlan,
  archiveWeekplannerPlan: mocks.archiveWeekplannerPlan,
  renameWeekplannerPlan: mocks.renameWeekplannerPlan,
  deleteWeekplannerPlan: mocks.deleteWeekplannerPlan,
  getWeekplannerPlan: mocks.getWeekplannerPlan,
}));

import { PATCH } from "../route";
import {
  WeekplannerPlanArchivedError,
  WeekplannerPlanActivationConflictError,
  WeekplannerPlanNotFoundError,
} from "@/lib/weekplanner/plan-errors";

const TENANT_ID = "tenant-a";
const PLAN_ID = "plan-1";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/weekplanner/plans/${PLAN_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeContext() {
  return { params: Promise.resolve({ planId: PLAN_ID }) };
}

function makeSessionOk() {
  return {
    ok: true as const,
    status: 200,
    error: null,
    session: { user: { id: "user-01", activeTenantId: TENANT_ID } },
  };
}

function planDto(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    tenantId: TENANT_ID,
    weekId: "2026-08-10",
    name: "Schlechtwetterplan",
    createdByUserId: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    archivedAt: null,
    isActive: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(makeSessionOk());
});

describe("PATCH /api/weekplanner/plans/[planId] — { active: true } activation", () => {
  it("1: delegates to activateWeekplannerPlan with the session's tenantId (never from the body)", async () => {
    mocks.activateWeekplannerPlan.mockResolvedValueOnce(planDto({ isActive: true }));

    const res = await PATCH(makeRequest({ active: true, tenantId: "attacker-tenant" }), makeContext());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan.isActive).toBe(true);
    expect(mocks.activateWeekplannerPlan).toHaveBeenCalledWith(TENANT_ID, PLAN_ID);
  });

  it("2: FINDING 1 — archive/activate race: WeekplannerPlanArchivedError maps to a controlled 409, never a 500", async () => {
    mocks.activateWeekplannerPlan.mockRejectedValueOnce(new WeekplannerPlanArchivedError(PLAN_ID));

    const res = await PATCH(makeRequest({ active: true }), makeContext());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/archived/i);
  });

  it("3: FINDING 2 — concurrent A/B activation conflict (mapped P2002) maps to a controlled 409, never a 500", async () => {
    mocks.activateWeekplannerPlan.mockRejectedValueOnce(new WeekplannerPlanActivationConflictError(PLAN_ID));

    const res = await PATCH(makeRequest({ active: true }), makeContext());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/concurrently/i);
  });

  it("4: an unrelated/unexpected error from the service is NOT converted to 409 — it propagates", async () => {
    const unexpected = new Error("connection reset");
    mocks.activateWeekplannerPlan.mockRejectedValueOnce(unexpected);

    await expect(PATCH(makeRequest({ active: true }), makeContext())).rejects.toBe(unexpected);
  });

  it("5: not-found target maps to 404, not 409", async () => {
    mocks.activateWeekplannerPlan.mockRejectedValueOnce(new WeekplannerPlanNotFoundError(PLAN_ID));

    const res = await PATCH(makeRequest({ active: true }), makeContext());
    expect(res.status).toBe(404);
  });

  it("6: requires MANAGE permission — a viewer without manage rights is rejected before the service is called", async () => {
    mocks.requireApiAnyPermission.mockResolvedValueOnce({ ok: false, status: 403, error: "Forbidden" });

    const res = await PATCH(makeRequest({ active: true }), makeContext());

    expect(res.status).toBe(403);
    expect(mocks.activateWeekplannerPlan).not.toHaveBeenCalled();
  });

  it("7: missing tenant context on the session is rejected before the service is called", async () => {
    mocks.requireApiAnyPermission.mockResolvedValueOnce({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "user-01", activeTenantId: null } },
    });

    const res = await PATCH(makeRequest({ active: true }), makeContext());

    expect(res.status).toBe(400);
    expect(mocks.activateWeekplannerPlan).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/weekplanner/plans/[planId] — { active: false } deactivation", () => {
  it("8: delegates to deactivateWeekplannerPlan with the session's tenantId", async () => {
    mocks.deactivateWeekplannerPlan.mockResolvedValueOnce(planDto({ isActive: false }));

    const res = await PATCH(makeRequest({ active: false }), makeContext());

    expect(res.status).toBe(200);
    expect(mocks.deactivateWeekplannerPlan).toHaveBeenCalledWith(TENANT_ID, PLAN_ID);
  });

  it("9: requires MANAGE permission for deactivation too", async () => {
    mocks.requireApiAnyPermission.mockResolvedValueOnce({ ok: false, status: 403, error: "Forbidden" });

    const res = await PATCH(makeRequest({ active: false }), makeContext());

    expect(res.status).toBe(403);
    expect(mocks.deactivateWeekplannerPlan).not.toHaveBeenCalled();
  });
});
