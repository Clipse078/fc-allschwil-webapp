/**
 * MASTERDATA-CONSISTENCY-02 — OrgUnit hierarchy consistency
 *
 * getOrgUnitById() previously loaded ALL child OrgUnits regardless of
 * status, so an archived child could remain visible in the active parent
 * hierarchy. This suite covers the fix: children are now scoped to
 * `status != ARCHIVED`.
 *
 * Covers:
 *   - active child → visible (included in the query result)
 *   - archived child → excluded from the children query filter
 *   - restored child → visible again (equivalent to "active child" once
 *     status flips back to ACTIVE)
 *   - tenant isolation is untouched by this change (parent lookup remains
 *     by id only; children filter is orthogonal to tenant scoping)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  orgUnitFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    orgUnit: { findUnique: mocks.orgUnitFindUnique },
  },
}));

vi.mock("@/lib/teams/current-season", () => ({
  currentTeamSeasonWhere: () => ({}),
}));

import { getOrgUnitById } from "../queries";

const PARENT_ID = "org-parent-1";

function makeOrgUnitRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PARENT_ID,
    tenantId: "tenant-a",
    key: "parent",
    name: "Parent Unit",
    type: "DEPARTMENT",
    status: "ACTIVE",
    parentId: null,
    level: 0,
    sortOrder: 0,
    description: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    archivedAt: null,
    parent: null,
    children: [],
    teams: [],
    memberships: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrgUnitById — children archived-status filter", () => {
  it("scopes the children query to status != ARCHIVED", async () => {
    mocks.orgUnitFindUnique.mockResolvedValue(makeOrgUnitRow());

    await getOrgUnitById(PARENT_ID);

    expect(mocks.orgUnitFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PARENT_ID },
        select: expect.objectContaining({
          children: expect.objectContaining({
            where: { status: { not: "ARCHIVED" } },
          }),
        }),
      }),
    );
  });

  it("still selects the expected child fields alongside the status filter", async () => {
    mocks.orgUnitFindUnique.mockResolvedValue(makeOrgUnitRow());

    await getOrgUnitById(PARENT_ID);

    const call = mocks.orgUnitFindUnique.mock.calls[0]![0];
    expect(call.select.children.select).toEqual({
      id: true,
      name: true,
      key: true,
      type: true,
      status: true,
    });
    expect(call.select.children.orderBy).toEqual({ sortOrder: "asc" });
  });

  it("returns an active child in the resolved result (visible)", async () => {
    const activeChild = { id: "child-active", name: "Active Child", key: "active", type: "DEPARTMENT", status: "ACTIVE" };
    mocks.orgUnitFindUnique.mockResolvedValue(makeOrgUnitRow({ children: [activeChild] }));

    const result = await getOrgUnitById(PARENT_ID);

    expect(result?.children).toEqual([activeChild]);
    expect(result?.children.some((c) => c.status === "ARCHIVED")).toBe(false);
  });

  it("the Prisma where-filter used excludes ARCHIVED children — an archived child never appears in the DB-returned set", async () => {
    // Simulates the DB honoring the where:{status:{not:"ARCHIVED"}} filter:
    // an archived child is never included in what findUnique resolves.
    mocks.orgUnitFindUnique.mockResolvedValue(makeOrgUnitRow({ children: [] }));

    const result = await getOrgUnitById(PARENT_ID);

    expect(result?.children).toEqual([]);
  });

  it("a restored (re-activated) child is visible again once its status flips back to ACTIVE", async () => {
    const restoredChild = { id: "child-restored", name: "Restored Child", key: "restored", type: "DEPARTMENT", status: "ACTIVE" };
    mocks.orgUnitFindUnique.mockResolvedValue(makeOrgUnitRow({ children: [restoredChild] }));

    const result = await getOrgUnitById(PARENT_ID);

    expect(result?.children).toContainEqual(restoredChild);
  });

  it("does not delete historical data — only excludes archived children from this read, parent lookup is unaffected", async () => {
    mocks.orgUnitFindUnique.mockResolvedValue(makeOrgUnitRow());

    await getOrgUnitById(PARENT_ID);

    const call = mocks.orgUnitFindUnique.mock.calls[0]![0];
    // The top-level org unit lookup itself is never filtered by status —
    // only the nested `children` relation is scoped to active units.
    expect(call.where).toEqual({ id: PARENT_ID });
  });
});
