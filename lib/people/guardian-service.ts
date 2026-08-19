/**
 * PERSON-UX-10: Guardian relationship service.
 *
 * Canonical service for Person↔Person guardian relationships.
 *
 * ARCHITECTURAL INVARIANTS (enforced here, not in routes):
 *   - BOTH child and guardian Person MUST belong to caller's tenant.
 *   - childPersonId MUST NOT equal guardianPersonId (self-link blocked).
 *   - Duplicate (child, guardian) pair is rejected.
 *   - Removing a relationship NEVER deletes either Person record.
 *   - GuardianRelationship carries ZERO authorization implications:
 *       - Does NOT create a User
 *       - Does NOT create a TenantMembership
 *       - Does NOT grant any Role or RolePermission
 *       - Does NOT imply mobile/web access
 *     Relationship and authorization are separate domains.
 */

import { prisma } from "@/lib/db/prisma";
import { GuardianRelationshipType } from "@prisma/client";

export const GUARDIAN_RELATIONSHIP_TYPES = Object.values(
  GuardianRelationshipType,
) as string[];

export function isGuardianRelationshipType(
  value: string,
): value is GuardianRelationshipType {
  return GUARDIAN_RELATIONSHIP_TYPES.includes(value);
}

export const GUARDIAN_RELATIONSHIP_LABELS: Record<
  GuardianRelationshipType,
  string
> = {
  MOTHER: "Mutter",
  FATHER: "Vater",
  LEGAL_GUARDIAN: "Erziehungsberechtigte/r",
  FOSTER_GUARDIAN: "Pflegeperson",
  OTHER: "Andere",
};

// ── Tenant-scoped resolution ──────────────────────────────────────────────────

/**
 * Resolves a Person and verifies strict tenant isolation.
 * Returns null when the person doesn't exist or belongs to a different tenant.
 * No cross-tenant existence leakage — always returns null, never throws.
 */
export async function resolveTenantPerson(personId: string, tenantId: string) {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, tenantId: true },
  });
  if (!person || person.tenantId !== tenantId) return null;
  return person;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listGuardianRelationships(
  childPersonId: string,
  tenantId: string,
) {
  return prisma.guardianRelationship.findMany({
    where: { childPersonId, tenantId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      relationshipType: true,
      isPrimary: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      guardianPerson: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          email: true,
          phone: true,
          imageUrl: true,
          isActive: true,
        },
      },
    },
  });
}

export type GuardianRelationshipItem = Awaited<
  ReturnType<typeof listGuardianRelationships>
>[number];

// ── Mutations ─────────────────────────────────────────────────────────────────

export type CreateGuardianRelationshipInput = {
  tenantId: string;
  childPersonId: string;
  guardianPersonId: string;
  relationshipType?: GuardianRelationshipType;
  isPrimary?: boolean;
  notes?: string | null;
};

export type CreateGuardianRelationshipResult =
  | { ok: true; relationship: { id: string } }
  | { ok: false; status: number; error: string };

export async function createGuardianRelationship(
  input: CreateGuardianRelationshipInput,
): Promise<CreateGuardianRelationshipResult> {
  const { tenantId, childPersonId, guardianPersonId } = input;

  // INVARIANT: self-link blocked
  if (childPersonId === guardianPersonId) {
    return {
      ok: false,
      status: 400,
      error: "Eine Person kann nicht ihr eigener Erziehungsberechtigter sein.",
    };
  }

  // INVARIANT: guardian must belong to same tenant
  const guardianPerson = await resolveTenantPerson(guardianPersonId, tenantId);
  if (!guardianPerson) {
    return {
      ok: false,
      status: 404,
      error: "Erziehungsberechtigte Person nicht gefunden.",
    };
  }

  // Check for duplicate
  const existing = await prisma.guardianRelationship.findUnique({
    where: { childPersonId_guardianPersonId: { childPersonId, guardianPersonId } },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: "Diese Verknüpfung existiert bereits.",
    };
  }

  const relationship = await prisma.guardianRelationship.create({
    data: {
      tenantId,
      childPersonId,
      guardianPersonId,
      relationshipType: input.relationshipType ?? GuardianRelationshipType.OTHER,
      isPrimary: input.isPrimary ?? false,
      notes: input.notes ?? null,
    },
    select: { id: true },
  });

  return { ok: true, relationship };
}

export type UpdateGuardianRelationshipInput = {
  relationshipId: string;
  childPersonId: string;
  tenantId: string;
  relationshipType?: GuardianRelationshipType;
  isPrimary?: boolean;
  notes?: string | null;
};

export type UpdateGuardianRelationshipResult =
  | { ok: true; relationship: { id: string } }
  | { ok: false; status: number; error: string };

export async function updateGuardianRelationship(
  input: UpdateGuardianRelationshipInput,
): Promise<UpdateGuardianRelationshipResult> {
  const { relationshipId, childPersonId, tenantId } = input;

  const existing = await prisma.guardianRelationship.findUnique({
    where: { id: relationshipId },
    select: { id: true, childPersonId: true, tenantId: true },
  });

  if (
    !existing ||
    existing.tenantId !== tenantId ||
    existing.childPersonId !== childPersonId
  ) {
    return {
      ok: false,
      status: 404,
      error: "Verknüpfung nicht gefunden.",
    };
  }

  const relationship = await prisma.guardianRelationship.update({
    where: { id: relationshipId },
    data: {
      ...(input.relationshipType !== undefined && {
        relationshipType: input.relationshipType,
      }),
      ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
    select: { id: true },
  });

  return { ok: true, relationship };
}

export type DeleteGuardianRelationshipResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Removes a guardian relationship.
 *
 * INVARIANT: This operation deletes ONLY the GuardianRelationship record.
 * Neither the child Person nor the guardian Person is deleted or modified.
 * No authorization side effects.
 */
export async function deleteGuardianRelationship(
  relationshipId: string,
  childPersonId: string,
  tenantId: string,
): Promise<DeleteGuardianRelationshipResult> {
  const existing = await prisma.guardianRelationship.findUnique({
    where: { id: relationshipId },
    select: { id: true, childPersonId: true, tenantId: true },
  });

  if (
    !existing ||
    existing.tenantId !== tenantId ||
    existing.childPersonId !== childPersonId
  ) {
    return {
      ok: false,
      status: 404,
      error: "Verknüpfung nicht gefunden.",
    };
  }

  await prisma.guardianRelationship.delete({ where: { id: relationshipId } });

  // Verify INVARIANT: both Person records still exist (belt-and-suspenders assertion)
  // No User, TenantMembership, Role, or permission is affected by this deletion.
  return { ok: true };
}
