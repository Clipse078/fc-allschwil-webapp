/**
 * lib/facilities/__tests__/queries.test.ts
 *
 * Regression tests for the canonical Facility and FacilityResource
 * query layer (FACILITY-RESOURCE-01).
 *
 * Covers the full create → list lifecycle:
 *   - Created resources are persisted with correct tenantId and facilityId.
 *   - The canonical list query returns newly created active resources.
 *   - Cross-tenant isolation: resources from other tenants are excluded.
 *   - Different-facility isolation: resources from other facilities are excluded.
 *   - Archived resources are hidden by default.
 *   - getFacilityResourcesForFacility returns null for unknown / cross-tenant facilities.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (must use vi.hoisted so they are available before vi.mock factory) ──

const mocks = vi.hoisted(() => ({
  facilityFindMany: vi.fn(),
  facilityFindFirst: vi.fn(),
  facilityCreate: vi.fn(),
  facilityUpdateMany: vi.fn(),
  facilityResourceFindMany: vi.fn(),
  facilityResourceFindUnique: vi.fn(),
  facilityResourceCreate: vi.fn(),
  facilityResourceUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    facility: {
      findMany: mocks.facilityFindMany,
      findFirst: mocks.facilityFindFirst,
      create: mocks.facilityCreate,
      updateMany: mocks.facilityUpdateMany,
    },
    facilityResource: {
      findMany: mocks.facilityResourceFindMany,
      findUnique: mocks.facilityResourceFindUnique,
      create: mocks.facilityResourceCreate,
      updateMany: mocks.facilityResourceUpdateMany,
    },
  },
}));

import {
  getFacilitiesForTenant,
  getFacilityById,
  getFacilityResourcesForFacility,
  getFacilityResourcesByCodesForTenant,
  getActiveFacilityResourcesByCodesForTenant,
  getActiveResourceOptionsForTenant,
  createFacility,
  createFacilityResource,
  updateFacilityResource,
} from "../queries";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const FACILITY_1 = "facility-1";
const FACILITY_2 = "facility-2";
const RESOURCE_1 = "resource-1";

function makeFacility(overrides: Record<string, unknown> = {}) {
  return {
    id: FACILITY_1,
    tenantId: TENANT_A,
    name: "Hauptplatz",
    type: "PITCH" as const,
    status: "ACTIVE" as const,
    sortOrder: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    resources: [],
    ...overrides,
  };
}

function makeResource(overrides: Record<string, unknown> = {}) {
  return {
    id: RESOURCE_1,
    tenantId: TENANT_A,
    facilityId: FACILITY_1,
    name: "Stadion A",
    code: "STADION_A",
    type: "FULL_PITCH" as const,
    status: "ACTIVE" as const,
    sortOrder: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getFacilitiesForTenant", () => {
  it("returns non-archived facilities for the given tenant", async () => {
    const facility = makeFacility();
    mocks.facilityFindMany.mockResolvedValue([facility]);

    const result = await getFacilitiesForTenant(TENANT_A);

    expect(mocks.facilityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].tenantId).toBe(TENANT_A);
  });

  it("applies the archived status filter", async () => {
    mocks.facilityFindMany.mockResolvedValue([]);

    await getFacilitiesForTenant(TENANT_A);

    expect(mocks.facilityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_A, status: { not: "ARCHIVED" } },
      }),
    );
  });

  it("includes resources in the response", async () => {
    const resource = makeResource();
    const facility = makeFacility({ resources: [resource] });
    mocks.facilityFindMany.mockResolvedValue([facility]);

    const result = await getFacilitiesForTenant(TENANT_A);

    expect(result[0].resources).toHaveLength(1);
    expect(result[0].resources[0].id).toBe(RESOURCE_1);
  });

  it("filters archived resources within the include", async () => {
    mocks.facilityFindMany.mockResolvedValue([]);

    await getFacilitiesForTenant(TENANT_A);

    expect(mocks.facilityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          resources: expect.objectContaining({
            where: { status: { not: "ARCHIVED" } },
          }),
        },
      }),
    );
  });

  it("returns empty array when tenant has no facilities", async () => {
    mocks.facilityFindMany.mockResolvedValue([]);

    const result = await getFacilitiesForTenant(TENANT_A);

    expect(result).toEqual([]);
  });
});

describe("getFacilityById", () => {
  it("returns the facility when it belongs to the tenant", async () => {
    const facility = makeFacility({ resources: [] });
    mocks.facilityFindFirst.mockResolvedValue(facility);

    const result = await getFacilityById(FACILITY_1, TENANT_A);

    expect(mocks.facilityFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FACILITY_1, tenantId: TENANT_A },
      }),
    );
    expect(result?.id).toBe(FACILITY_1);
    expect(result?.tenantId).toBe(TENANT_A);
  });

  it("returns null when the facility belongs to a different tenant", async () => {
    mocks.facilityFindFirst.mockResolvedValue(null);

    const result = await getFacilityById(FACILITY_1, TENANT_B);

    expect(result).toBeNull();
  });

  it("returns null when the facility does not exist", async () => {
    mocks.facilityFindFirst.mockResolvedValue(null);

    const result = await getFacilityById("nonexistent", TENANT_A);

    expect(result).toBeNull();
  });
});

describe("getFacilityResourcesForFacility", () => {
  it("returns active resources for a tenant-owned facility", async () => {
    const resource = makeResource();
    const facility = makeFacility({ resources: [resource] });
    mocks.facilityFindFirst.mockResolvedValue(facility);

    const result = await getFacilityResourcesForFacility(FACILITY_1, TENANT_A);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe(RESOURCE_1);
    expect(result![0].tenantId).toBe(TENANT_A);
    expect(result![0].facilityId).toBe(FACILITY_1);
  });

  it("returns null when the facility belongs to a different tenant (cross-tenant isolation)", async () => {
    mocks.facilityFindFirst.mockResolvedValue(null);

    const result = await getFacilityResourcesForFacility(FACILITY_1, TENANT_B);

    expect(result).toBeNull();
  });

  it("returns null for a non-existent facility", async () => {
    mocks.facilityFindFirst.mockResolvedValue(null);

    const result = await getFacilityResourcesForFacility("nonexistent", TENANT_A);

    expect(result).toBeNull();
  });

  it("returns empty array when the facility has no active resources", async () => {
    const facility = makeFacility({ resources: [] });
    mocks.facilityFindFirst.mockResolvedValue(facility);

    const result = await getFacilityResourcesForFacility(FACILITY_1, TENANT_A);

    expect(result).toEqual([]);
  });

  it("applies tenant scoping in the query", async () => {
    const facility = makeFacility({ resources: [] });
    mocks.facilityFindFirst.mockResolvedValue(facility);

    await getFacilityResourcesForFacility(FACILITY_1, TENANT_A);

    expect(mocks.facilityFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FACILITY_1, tenantId: TENANT_A },
      }),
    );
  });

  it("applies the archived status filter to resources", async () => {
    const facility = makeFacility({ resources: [] });
    mocks.facilityFindFirst.mockResolvedValue(facility);

    await getFacilityResourcesForFacility(FACILITY_1, TENANT_A);

    expect(mocks.facilityFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          resources: expect.objectContaining({
            where: { status: { not: "ARCHIVED" } },
          }),
        },
      }),
    );
  });
});

describe("createFacility", () => {
  it("creates a facility with the correct tenantId and fields", async () => {
    const created = makeFacility({ resources: undefined });
    mocks.facilityCreate.mockResolvedValue(created);

    const result = await createFacility({
      tenantId: TENANT_A,
      name: "Hauptplatz",
      type: "PITCH",
      sortOrder: 0,
    });

    expect(mocks.facilityCreate).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_A,
        name: "Hauptplatz",
        type: "PITCH",
        sortOrder: 0,
      },
    });
    expect(result.tenantId).toBe(TENANT_A);
    expect(result.name).toBe("Hauptplatz");
  });

  it("defaults sortOrder to 0 when not provided", async () => {
    const created = makeFacility({ resources: undefined });
    mocks.facilityCreate.mockResolvedValue(created);

    await createFacility({ tenantId: TENANT_A, name: "Test", type: "OTHER" });

    expect(mocks.facilityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ sortOrder: 0 }),
    });
  });
});

describe("createFacilityResource", () => {
  it("creates a resource with correct tenantId, facilityId, and canonical type", async () => {
    const created = makeResource();
    mocks.facilityResourceCreate.mockResolvedValue(created);

    const result = await createFacilityResource({
      tenantId: TENANT_A,
      facilityId: FACILITY_1,
      name: "Stadion A",
      code: "STADION_A",
      type: "FULL_PITCH",
    });

    expect(mocks.facilityResourceCreate).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_A,
        facilityId: FACILITY_1,
        name: "Stadion A",
        code: "STADION_A",
        type: "FULL_PITCH",
        sortOrder: 0,
      },
    });
    expect(result.tenantId).toBe(TENANT_A);
    expect(result.facilityId).toBe(FACILITY_1);
    expect(result.type).toBe("FULL_PITCH");
  });

  it("creates HALF_PITCH resource with correct type", async () => {
    const created = makeResource({ type: "HALF_PITCH", code: "STADION_B" });
    mocks.facilityResourceCreate.mockResolvedValue(created);

    const result = await createFacilityResource({
      tenantId: TENANT_A,
      facilityId: FACILITY_1,
      name: "Stadion B",
      code: "STADION_B",
      type: "HALF_PITCH",
    });

    expect(result.type).toBe("HALF_PITCH");
  });

  it("creates DRESSING_ROOM resource with correct type", async () => {
    const created = makeResource({ type: "DRESSING_ROOM", code: "E1", name: "Garderobe E1" });
    mocks.facilityResourceCreate.mockResolvedValue(created);

    const result = await createFacilityResource({
      tenantId: TENANT_A,
      facilityId: FACILITY_1,
      name: "Garderobe E1",
      code: "E1",
      type: "DRESSING_ROOM",
    });

    expect(result.type).toBe("DRESSING_ROOM");
  });

  it("creates OTHER resource for halls, courts, rooms, and generic types", async () => {
    const created = makeResource({ type: "OTHER", code: "HALLE_A", name: "Halle A" });
    mocks.facilityResourceCreate.mockResolvedValue(created);

    const result = await createFacilityResource({
      tenantId: TENANT_A,
      facilityId: FACILITY_1,
      name: "Halle A",
      code: "HALLE_A",
      type: "OTHER",
    });

    expect(result.type).toBe("OTHER");
  });

  it("creates a resource that is active by default (status is not set to ARCHIVED)", async () => {
    const created = makeResource({ status: "ACTIVE" });
    mocks.facilityResourceCreate.mockResolvedValue(created);

    const result = await createFacilityResource({
      tenantId: TENANT_A,
      facilityId: FACILITY_1,
      name: "Test",
      code: "TEST",
      type: "OTHER",
    });

    expect(result.status).toBe("ACTIVE");
  });

  it("defaults sortOrder to 0 when not provided", async () => {
    const created = makeResource({ sortOrder: 0 });
    mocks.facilityResourceCreate.mockResolvedValue(created);

    await createFacilityResource({
      tenantId: TENANT_A,
      facilityId: FACILITY_1,
      name: "Test",
      code: "TEST",
      type: "OTHER",
    });

    expect(mocks.facilityResourceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ sortOrder: 0 }),
    });
  });
});

describe("create → list lifecycle", () => {
  it("newly created resource appears when listing resources for the same tenant and facility", async () => {
    // Step 1: Create a resource
    const created = makeResource();
    mocks.facilityResourceCreate.mockResolvedValue(created);

    await createFacilityResource({
      tenantId: TENANT_A,
      facilityId: FACILITY_1,
      name: "Stadion A",
      code: "STADION_A",
      type: "FULL_PITCH",
    });

    // Step 2: The list query returns the created resource
    const facilityWithResource = makeFacility({ resources: [created] });
    mocks.facilityFindFirst.mockResolvedValue(facilityWithResource);

    const resources = await getFacilityResourcesForFacility(FACILITY_1, TENANT_A);

    expect(resources).not.toBeNull();
    expect(resources!.some((r) => r.id === RESOURCE_1)).toBe(true);
  });

  it("cross-tenant list does not return the created resource", async () => {
    // Different tenant cannot see the resource
    mocks.facilityFindFirst.mockResolvedValue(null);

    const resources = await getFacilityResourcesForFacility(FACILITY_1, TENANT_B);

    expect(resources).toBeNull();
  });

  it("different-facility list does not return the created resource", async () => {
    // Facility 2 returns no resources for this tenant
    const facilityTwo = makeFacility({ id: FACILITY_2, resources: [] });
    mocks.facilityFindFirst.mockResolvedValue(facilityTwo);

    const resources = await getFacilityResourcesForFacility(FACILITY_2, TENANT_A);

    expect(resources).toEqual([]);
    expect(resources!.some((r) => r.id === RESOURCE_1)).toBe(false);
  });

  it("newly created facility appears when listing facilities for the tenant", async () => {
    const created = makeFacility({ resources: undefined });
    mocks.facilityCreate.mockResolvedValue(created);

    await createFacility({
      tenantId: TENANT_A,
      name: "Hauptplatz",
      type: "PITCH",
    });

    const facilityWithResources = makeFacility({ resources: [] });
    mocks.facilityFindMany.mockResolvedValue([facilityWithResources]);

    const facilities = await getFacilitiesForTenant(TENANT_A);

    expect(facilities.some((f) => f.id === FACILITY_1)).toBe(true);
  });
});

describe("archived resource filtering", () => {
  it("archived resources are excluded from getFacilitiesForTenant by default", async () => {
    mocks.facilityFindMany.mockResolvedValue([]);

    await getFacilitiesForTenant(TENANT_A);

    expect(mocks.facilityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          resources: expect.objectContaining({
            where: { status: { not: "ARCHIVED" } },
          }),
        },
      }),
    );
  });

  it("archived resources are excluded from getFacilityResourcesForFacility by default", async () => {
    const facility = makeFacility({ resources: [] });
    mocks.facilityFindFirst.mockResolvedValue(facility);

    await getFacilityResourcesForFacility(FACILITY_1, TENANT_A);

    expect(mocks.facilityFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          resources: expect.objectContaining({
            where: { status: { not: "ARCHIVED" } },
          }),
        },
      }),
    );
  });

  it("new resources have ACTIVE status (not created as archived)", async () => {
    const created = makeResource({ status: "ACTIVE" });
    mocks.facilityResourceCreate.mockResolvedValue(created);

    const result = await createFacilityResource({
      tenantId: TENANT_A,
      facilityId: FACILITY_1,
      name: "New Resource",
      code: "NEW",
      type: "OTHER",
    });

    expect(result.status).not.toBe("ARCHIVED");
    expect(result.status).toBe("ACTIVE");
  });
});

describe("updateFacilityResource", () => {
  it("applies tenant-scoped update (tenantId in where clause)", async () => {
    mocks.facilityResourceUpdateMany.mockResolvedValue({ count: 1 });

    await updateFacilityResource(RESOURCE_1, TENANT_A, { status: "ARCHIVED" });

    expect(mocks.facilityResourceUpdateMany).toHaveBeenCalledWith({
      where: { id: RESOURCE_1, tenantId: TENANT_A },
      data: { status: "ARCHIVED" },
    });
  });

  it("does not update a resource belonging to a different tenant", async () => {
    mocks.facilityResourceUpdateMany.mockResolvedValue({ count: 0 });

    await updateFacilityResource(RESOURCE_1, TENANT_B, { status: "ARCHIVED" });

    expect(mocks.facilityResourceUpdateMany).toHaveBeenCalledWith({
      where: { id: RESOURCE_1, tenantId: TENANT_B },
      data: { status: "ARCHIVED" },
    });
  });
});

describe("getFacilityResourcesByCodesForTenant", () => {
  it("returns empty map when codes array is empty", async () => {
    const result = await getFacilityResourcesByCodesForTenant([], TENANT_A);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mocks.facilityResourceFindMany).not.toHaveBeenCalled();
  });

  it("resolves code-to-name map for the given tenant", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([
      { code: "STADION_A", name: "Stadion A" },
      { code: "E1", name: "Garderobe E1" },
    ]);

    const result = await getFacilityResourcesByCodesForTenant(
      ["STADION_A", "E1"],
      TENANT_A,
    );

    expect(result.get("STADION_A")).toBe("Stadion A");
    expect(result.get("E1")).toBe("Garderobe E1");
  });
});

// ── MASTERDATA-CONSISTENCY-02 — canonical write-path validation + operational selectors ──

describe("getActiveFacilityResourcesByCodesForTenant", () => {
  it("returns empty map when codes array is empty", async () => {
    const result = await getActiveFacilityResourcesByCodesForTenant([], TENANT_A);

    expect(result.size).toBe(0);
    expect(mocks.facilityResourceFindMany).not.toHaveBeenCalled();
  });

  it("scopes the query to the given tenant and excludes archived resources", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([]);

    await getActiveFacilityResourcesByCodesForTenant(["STADION"], TENANT_A);

    expect(mocks.facilityResourceFindMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_A, code: { in: ["STADION"] }, status: { not: "ARCHIVED" } },
      select: { id: true, code: true, name: true, type: true },
    });
  });

  it("resolves an active resource by code (accepted)", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([
      { id: RESOURCE_1, code: "STADION_A", name: "Stadion A", type: "FULL_PITCH" },
    ]);

    const result = await getActiveFacilityResourcesByCodesForTenant(["STADION_A"], TENANT_A);

    expect(result.get("STADION_A")).toEqual(
      expect.objectContaining({ id: RESOURCE_1, type: "FULL_PITCH" }),
    );
  });

  it("does not resolve an archived resource (query already filters status)", async () => {
    // An archived resource never appears in the findMany result because the
    // where-clause excludes it — simulated by resolving without it.
    mocks.facilityResourceFindMany.mockResolvedValue([]);

    const result = await getActiveFacilityResourcesByCodesForTenant(["ARCHIVED_CODE"], TENANT_A);

    expect(result.has("ARCHIVED_CODE")).toBe(false);
  });

  it("does not resolve a resource belonging to a different tenant", async () => {
    // Cross-tenant codes never appear in the tenant-scoped findMany result.
    mocks.facilityResourceFindMany.mockResolvedValue([]);

    const result = await getActiveFacilityResourcesByCodesForTenant(["STADION_A"], TENANT_B);

    expect(result.has("STADION_A")).toBe(false);
    expect(mocks.facilityResourceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_B }) }),
    );
  });
});

describe("getActiveResourceOptionsForTenant", () => {
  it("returns only FULL_PITCH/HALF_PITCH resources for category 'PITCH'", async () => {
    const pitchResource = makeResource({ id: "res-pitch", code: "STADION", type: "FULL_PITCH" });
    const roomResource = makeResource({ id: "res-room", code: "E1", type: "DRESSING_ROOM" });
    const facility = makeFacility({ resources: [pitchResource, roomResource] });
    mocks.facilityFindMany.mockResolvedValue([facility]);

    const result = await getActiveResourceOptionsForTenant(TENANT_A, "PITCH");

    expect(result.map((r) => r.code)).toEqual(["STADION"]);
  });

  it("returns only DRESSING_ROOM resources for category 'DRESSING_ROOM'", async () => {
    const pitchResource = makeResource({ id: "res-pitch", code: "STADION", type: "FULL_PITCH" });
    const roomResource = makeResource({ id: "res-room", code: "E1", type: "DRESSING_ROOM" });
    const facility = makeFacility({ resources: [pitchResource, roomResource] });
    mocks.facilityFindMany.mockResolvedValue([facility]);

    const result = await getActiveResourceOptionsForTenant(TENANT_A, "DRESSING_ROOM");

    expect(result.map((r) => r.code)).toEqual(["E1"]);
  });

  it("includes a newly created resource without any static registry change", async () => {
    const newResource = makeResource({ id: "res-new", code: "NEUE_HALLE", name: "Neue Halle", type: "FULL_PITCH" });
    const facility = makeFacility({ resources: [newResource] });
    mocks.facilityFindMany.mockResolvedValue([facility]);

    const result = await getActiveResourceOptionsForTenant(TENANT_A, "PITCH");

    expect(result.some((r) => r.code === "NEUE_HALLE")).toBe(true);
  });

  it("excludes archived resources (relies on getFacilitiesForTenant's active-only filter)", async () => {
    // getFacilitiesForTenant already excludes archived facilities/resources at
    // the query level (status: { not: "ARCHIVED" }) — simulate that here.
    const facility = makeFacility({ resources: [] });
    mocks.facilityFindMany.mockResolvedValue([facility]);

    const result = await getActiveResourceOptionsForTenant(TENANT_A, "PITCH");

    expect(result).toEqual([]);
  });

  it("reflects a rename immediately (name comes straight from the DB row)", async () => {
    const renamed = makeResource({ id: RESOURCE_1, code: "STADION_A", name: "Neuer Name" });
    const facility = makeFacility({ resources: [renamed] });
    mocks.facilityFindMany.mockResolvedValue([facility]);

    const result = await getActiveResourceOptionsForTenant(TENANT_A, "PITCH");

    expect(result.find((r) => r.code === "STADION_A")?.name).toBe("Neuer Name");
  });

  it("scopes the underlying query to the given tenant", async () => {
    mocks.facilityFindMany.mockResolvedValue([]);

    await getActiveResourceOptionsForTenant(TENANT_A, "PITCH");

    expect(mocks.facilityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }),
    );
  });
});
