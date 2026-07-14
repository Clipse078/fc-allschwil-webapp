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

// ── Allocation conflict rules ─────────────────────────────────────────────────

/**
 * Load all conflict rules for a facility, with resource names resolved.
 * Returns both (A,B) and (B,A) orderings so the UI does not need to sort.
 */
export async function getConflictRulesForFacility(facilityId: string, tenantId: string) {
  return prisma.allocationConflictRule.findMany({
    where: { facilityId, tenantId },
    select: {
      id: true,
      resourceAId: true,
      resourceBId: true,
      resourceA: { select: { id: true, name: true, code: true } },
      resourceB: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export type ConflictRuleRow = Awaited<
  ReturnType<typeof getConflictRulesForFacility>
>[number];

/**
 * Create a conflict rule between two allocation units.
 * Canonical ordering: resourceAId < resourceBId (lexicographic) to prevent duplicates.
 */
export async function createConflictRule(input: {
  tenantId: string;
  facilityId: string;
  resourceAId: string;
  resourceBId: string;
}) {
  const [a, b] =
    input.resourceAId < input.resourceBId
      ? [input.resourceAId, input.resourceBId]
      : [input.resourceBId, input.resourceAId];

  return prisma.allocationConflictRule.create({
    data: {
      tenantId: input.tenantId,
      facilityId: input.facilityId,
      resourceAId: a,
      resourceBId: b,
    },
    select: {
      id: true,
      resourceAId: true,
      resourceBId: true,
      resourceA: { select: { id: true, name: true, code: true } },
      resourceB: { select: { id: true, name: true, code: true } },
    },
  });
}

/**
 * Delete a conflict rule. Tenant-scoped for safety.
 */
export async function deleteConflictRule(id: string, tenantId: string) {
  return prisma.allocationConflictRule.deleteMany({
    where: { id, tenantId },
  });
}

/**
 * Application-layer precondition check for creating a conflict rule.
 *
 * Verifies (in two DB round-trips):
 *  1. The facility exists and belongs to the authenticated tenant.
 *  2. Both resources exist, belong to the authenticated tenant, belong to
 *     the route facility, and have status ACTIVE.
 *
 * Cross-tenant IDs are treated as not found (404).
 * Inactive resources return 400.
 *
 * Returns { ok: true } when all conditions pass, or a controlled
 * { ok: false, status, error } when any condition fails.
 */
export async function validateConflictRuleResources(input: {
  tenantId: string;
  facilityId: string;
  resourceAId: string;
  resourceBId: string;
}): Promise<{ ok: true } | { ok: false; status: 400 | 404; error: string }> {
  const facility = await prisma.facility.findFirst({
    where: { id: input.facilityId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!facility) {
    return { ok: false, status: 404, error: "Facility not found" };
  }

  const resources = await prisma.facilityResource.findMany({
    where: {
      id: { in: [input.resourceAId, input.resourceBId] },
      tenantId: input.tenantId,
      facilityId: input.facilityId,
    },
    select: { id: true, status: true },
  });

  const byId = new Map(resources.map((r) => [r.id, r]));

  const rA = byId.get(input.resourceAId);
  if (!rA) {
    return { ok: false, status: 404, error: "Resource not found in this facility" };
  }

  const rB = byId.get(input.resourceBId);
  if (!rB) {
    return { ok: false, status: 404, error: "Resource not found in this facility" };
  }

  if (rA.status !== "ACTIVE") {
    return { ok: false, status: 400, error: "Both resources must have status ACTIVE" };
  }

  if (rB.status !== "ACTIVE") {
    return { ok: false, status: 400, error: "Both resources must have status ACTIVE" };
  }

  return { ok: true };
}

/**
 * Check whether a conflict rule already exists for a pair of resources.
 * Uses the same canonical ordering as createConflictRule.
 * Call before inserting to return a controlled 409 instead of a raw DB error.
 */
export async function conflictRuleExists(input: {
  facilityId: string;
  resourceAId: string;
  resourceBId: string;
}): Promise<boolean> {
  const [a, b] =
    input.resourceAId < input.resourceBId
      ? [input.resourceAId, input.resourceBId]
      : [input.resourceBId, input.resourceAId];

  const existing = await prisma.allocationConflictRule.findUnique({
    where: {
      facilityId_resourceAId_resourceBId: {
        facilityId: input.facilityId,
        resourceAId: a,
        resourceBId: b,
      },
    },
    select: { id: true },
  });

  return existing !== null;
}
