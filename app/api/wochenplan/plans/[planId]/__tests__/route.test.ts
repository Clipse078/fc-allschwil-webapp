/**
 * app/api/wochenplan/plans/[planId]/__tests__/route.test.ts
 *
 * WOCHENPLAN-2.0-02D — DELETE regression for legacy default draft deletion.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  deleteWochenplanPlan: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/wochenplan/plan-service", () => ({
  deleteWochenplanPlan: mocks.deleteWochenplanPlan,
  getWochenplanPlan: vi.fn(),
  renameWochenplanPlan: vi.fn(),
  activateWochenplanPlan: vi.fn(),
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import { DELETE } from "../route";
import { WochenplanPlanDeleteActiveForbiddenError } from "@/lib/wochenplan/plan-errors";

const TENANT_FCA = "tenant-fca";
const PLAN_LEGACY = "wcp-legacy";

function makeDeleteRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/wochenplan/plans/${PLAN_LEGACY}`, {
    method: "DELETE",
  });
}

function makeContext() {
  return { params: Promise.resolve({ planId: PLAN_LEGACY }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: "user-1", activeTenantId: TENANT_FCA } },
  });
  mocks.deleteWochenplanPlan.mockResolvedValue({ id: PLAN_LEGACY, name: "Wochenplan" });
  mocks.logAction.mockResolvedValue(undefined);
});

describe("DELETE /api/wochenplan/plans/[planId]", () => {
  it("returns 200 when inactive legacy default Wochenplan is deleted", async () => {
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toEqual({ id: PLAN_LEGACY, name: "Wochenplan" });
    expect(mocks.deleteWochenplanPlan).toHaveBeenCalledWith(TENANT_FCA, PLAN_LEGACY);
  });

  it("maps active-plan delete guard to 409", async () => {
    mocks.deleteWochenplanPlan.mockRejectedValue(new WochenplanPlanDeleteActiveForbiddenError(PLAN_LEGACY));

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/cannot be deleted/i);
  });
});
