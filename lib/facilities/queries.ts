/**
 * lib/facilities/queries.ts
 *
 * Database queries for tenant-scoped Facility and FacilityResource records.
 *
 * These queries power the Admin → Facilities & Resources UI and the
 * canonical display helpers in lib/facilities/display-helpers.ts.
 */

import { prisma } from "@/lib/db/prisma";
import type { FacilityStatus, FacilityType, FacilityResourceType } from "@prisma/client";

// ── Read queries ─────────────────────────────────────────────────────────────

export async function getFacilitiesForTenant(tenantId: string) {
  return prisma.facility.findMany({
    where: { tenantId, status: { not: "ARCHIVED" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      resources: {
        where: { status: { not: "ARCHIVED" } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });
}

export async function getFacilityById(id: string, tenantId: string) {
  return prisma.facility.findFirst({
    where: { id, tenantId },
    include: {
      resources: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });
}

/**
 * List active (non-archived) resources for a specific facility.
 *
 * Requires both facilityId AND tenantId so the query is always tenant-scoped.
 * Returns null when the facility itself does not exist or belongs to a different tenant.
 */
export async function getFacilityResourcesForFacility(
  facilityId: string,
  tenantId: string,
): Promise<FacilityResourceRow[] | null> {
  const facility = await prisma.facility.findFirst({
    where: { id: facilityId, tenantId },
    include: {
      resources: {
        where: { status: { not: "ARCHIVED" } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!facility) return null;
  return facility.resources;
}

/**
 * Look up a FacilityResource by allocation code for the given tenant.
 * Used by the canonical display helper to resolve tenant-configured labels.
 */
export async function getFacilityResourceByCode(
  code: string,
  tenantId: string,
): Promise<{ name: string } | null> {
  return prisma.facilityResource.findUnique({
    where: { tenantId_code: { tenantId, code } },
    select: { name: true },
  });
}

/**
 * Batch-load resource display names for a set of codes.
 * More efficient than N individual lookups when rendering event lists.
 */
export async function getFacilityResourcesByCodesForTenant(
  codes: string[],
  tenantId: string,
): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map();

  const resources = await prisma.facilityResource.findMany({
    where: {
      tenantId,
      code: { in: codes },
    },
    select: { code: true, name: true },
  });

  return new Map(resources.map((r) => [r.code, r.name]));
}

/**
 * MASTERDATA-CONSISTENCY-02 — canonical write-path validation helper.
 *
 * Batch-loads *active* (non-archived) FacilityResource rows for a set of
 * codes, scoped to a single tenant. Used by operational allocation
 * endpoints (e.g. Wochenplan allocation PATCH) to validate a client-supplied
 * resource code against the canonical DB state instead of a static
 * registry — an archived resource, a resource from another tenant, or an
 * unknown code all resolve to "not found" here.
 */
export async function getActiveFacilityResourcesByCodesForTenant(
  codes: string[],
  tenantId: string,
): Promise<Map<string, { id: string; code: string; name: string; type: FacilityResourceType }>> {
  if (codes.length === 0) return new Map();

  const resources = await prisma.facilityResource.findMany({
    where: {
      tenantId,
      code: { in: codes },
      status: { not: "ARCHIVED" },
    },
    select: { id: true, code: true, name: true, type: true },
  });

  return new Map(resources.map((r) => [r.code, r]));
}

/**
 * Canonical facility groups for a single allocation category, ready to
 * render as grouped `<select>` options (facility → resources).
 *
 * `category` selects which FacilityResourceType(s) are included:
 *   - "PITCH": FULL_PITCH + HALF_PITCH
 *   - "DRESSING_ROOM": DRESSING_ROOM
 *
 * Only active (non-archived) facilities/resources are returned — this is
 * the canonical source for live operational pitch/dressing-room selectors
 * (MatchCenter, Wochenplan), replacing the static FCA_PITCH_ALLOCATIONS /
 * FCA_DRESSING_ROOMS registries.
 */
export async function getActiveResourceOptionsForTenant(
  tenantId: string,
  category: "PITCH" | "DRESSING_ROOM",
): Promise<Array<{ id: string; code: string; name: string; type: FacilityResourceType }>> {
  const facilities = await getFacilitiesForTenant(tenantId);
  const allowedTypes: FacilityResourceType[] =
    category === "PITCH" ? ["FULL_PITCH", "HALF_PITCH"] : ["DRESSING_ROOM"];

  return facilities
    .flatMap((facility) => facility.resources)
    .filter((resource) => allowedTypes.includes(resource.type))
    .map((resource) => ({
      id: resource.id,
      code: resource.code,
      name: resource.name,
      type: resource.type,
    }));
}

// ── Types ────────────────────────────────────────────────────────────────────

export type FacilityWithResources = Awaited<
  ReturnType<typeof getFacilitiesForTenant>
>[number];

export type FacilityResourceRow = FacilityWithResources["resources"][number];

/**
 * Resolve display labels for the three fixed pitch row keys used by WochenplanBoard.
 *
 * Looks up tenant-configured FacilityResource names for the base pitch codes.
 * Falls back to provided defaults (typically from the static FCA registry).
 */
export async function getWochenplanPitchRowLabels<K extends string>(
  tenantId: string | null | undefined,
  defaults: Array<{ key: K; label: string }>,
): Promise<Array<{ key: K; label: string }>> {
  if (!tenantId) return defaults;

  const codes = defaults.map((d) => d.key);
  const resources = await prisma.facilityResource.findMany({
    where: { tenantId, code: { in: codes } },
    select: { code: true, name: true },
  });

  const byCode = new Map(resources.map((r) => [r.code, r.name]));

  return defaults.map((d) => ({
    key: d.key,
    label: byCode.get(d.key) ?? d.label,
  }));
}

// ── Write operations ─────────────────────────────────────────────────────────

export async function createFacility(input: {
  tenantId: string;
  name: string;
  type: FacilityType;
  sortOrder?: number;
}) {
  return prisma.facility.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      type: input.type,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateFacility(
  id: string,
  tenantId: string,
  data: Partial<{ name: string; type: FacilityType; status: FacilityStatus; sortOrder: number }>,
) {
  return prisma.facility.updateMany({
    where: { id, tenantId },
    data,
  });
}

export async function createFacilityResource(input: {
  tenantId: string;
  facilityId: string;
  name: string;
  code: string;
  type: FacilityResourceType;
  sortOrder?: number;
}) {
  return prisma.facilityResource.create({
    data: {
      tenantId: input.tenantId,
      facilityId: input.facilityId,
      name: input.name,
      code: input.code,
      type: input.type,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateFacilityResource(
  id: string,
  tenantId: string,
  data: Partial<{
    name: string;
    code: string;
    type: FacilityResourceType;
    status: FacilityStatus;
    sortOrder: number;
  }>,
) {
  return prisma.facilityResource.updateMany({
    where: { id, tenantId },
    data,
  });
}
