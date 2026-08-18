/**
 * PERSON-UX-04: Canonical PersonMembership domain service.
 *
 * Centralises all business validation and cross-tenant enforcement for club
 * membership operations. No Prisma calls are spread through routes.
 *
 * ARCHITECTURAL INVARIANTS (enforced here, not in routes):
 *   - Target Person MUST belong to the caller's tenant.
 *   - Membership MUST belong to the same tenant.
 *   - Membership MUST belong to the target Person.
 *   - endsAt MUST NOT be earlier than startsAt.
 *   - Ending a membership NEVER deletes the record.
 *   - Ending a membership does NOT touch Person.isActive, UserRole,
 *     TenantMembership, PersonAssignment, or any sporting relation.
 *   - Club membership is INDEPENDENT of every other relation.
 */

import { prisma } from "@/lib/db/prisma";
import { PersonMembershipStatus, PersonMembershipType } from "@prisma/client";

// ── Validation helpers ────────────────────────────────────────────────────────

export const VALID_MEMBERSHIP_STATUSES = Object.values(PersonMembershipStatus) as string[];
export const VALID_MEMBERSHIP_TYPES = Object.values(PersonMembershipType) as string[];

export function isMembershipStatus(value: string): value is PersonMembershipStatus {
  return VALID_MEMBERSHIP_STATUSES.includes(value);
}

export function isMembershipType(value: string): value is PersonMembershipType {
  return VALID_MEMBERSHIP_TYPES.includes(value);
}

// ── Tenant-scoped resolution ──────────────────────────────────────────────────

/**
 * Resolves a Person and enforces strict tenant isolation.
 * Returns null when the person doesn't exist or belongs to a different tenant.
 */
export async function resolveTenantPerson(personId: string, tenantId: string) {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, tenantId: true },
  });
  if (!person || person.tenantId !== tenantId) return null;
  return person;
}

/**
 * Resolves a PersonMembership and enforces strict tenant + person isolation.
 * Returns null when any constraint fails.
 */
export async function resolveTenantPersonMembership(
  membershipId: string,
  personId: string,
  tenantId: string,
) {
  const membership = await prisma.personMembership.findFirst({
    where: { id: membershipId, personId, tenantId },
    select: {
      id: true,
      tenantId: true,
      personId: true,
      membershipType: true,
      status: true,
      memberNumber: true,
      startsAt: true,
      endsAt: true,
      notes: true,
    },
  });
  return membership ?? null;
}

// ── Service operations ────────────────────────────────────────────────────────

export type CreateMembershipInput = {
  tenantId: string;
  personId: string;
  membershipType?: PersonMembershipType;
  memberNumber?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  notes?: string | null;
};

export type UpdateMembershipInput = {
  membershipType?: PersonMembershipType;
  status?: PersonMembershipStatus;
  memberNumber?: string | null;
  startsAt?: Date;
  endsAt?: Date | null;
  notes?: string | null;
};

/** Validation result type. */
type ValidationResult = { ok: true } | { ok: false; message: string; status: 400 };

/**
 * Validates that endsAt is not earlier than startsAt.
 * Also handles partial updates where only one date is changing.
 */
export function validateDates(
  startsAt: Date | undefined,
  endsAt: Date | null | undefined,
  existingStartsAt?: Date,
): ValidationResult {
  if (endsAt == null) return { ok: true };
  const effectiveStartsAt = startsAt ?? existingStartsAt;
  if (!effectiveStartsAt) return { ok: true };
  if (endsAt < effectiveStartsAt) {
    return {
      ok: false,
      message: "Austrittsdatum darf nicht vor dem Eintrittsdatum liegen.",
      status: 400,
    };
  }
  return { ok: true };
}

const MEMBERSHIP_SELECT = {
  id: true,
  tenantId: true,
  personId: true,
  membershipType: true,
  status: true,
  memberNumber: true,
  startsAt: true,
  endsAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Creates a new PersonMembership record.
 * Caller is responsible for tenant/person resolution before calling.
 */
export async function createPersonMembership(input: CreateMembershipInput) {
  return prisma.personMembership.create({
    data: {
      tenantId: input.tenantId,
      personId: input.personId,
      membershipType: input.membershipType ?? PersonMembershipType.ACTIVE_MEMBER,
      status: PersonMembershipStatus.ACTIVE,
      memberNumber: input.memberNumber ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      notes: input.notes ?? null,
    },
    select: MEMBERSHIP_SELECT,
  });
}

/**
 * Updates an existing PersonMembership record.
 * Caller must have resolved the membership first (resolveTenantPersonMembership).
 */
export async function updatePersonMembership(
  membershipId: string,
  input: UpdateMembershipInput,
) {
  return prisma.personMembership.update({
    where: { id: membershipId },
    data: {
      ...(input.membershipType !== undefined ? { membershipType: input.membershipType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.memberNumber !== undefined ? { memberNumber: input.memberNumber } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
    select: MEMBERSHIP_SELECT,
  });
}

/**
 * Ends a PersonMembership by setting status to ENDED and recording the end date.
 * NEVER deletes the record — historical membership periods are preserved permanently.
 * Does NOT touch Person.isActive or any other relation.
 */
export async function endPersonMembership(
  membershipId: string,
  endsAt: Date,
) {
  return prisma.personMembership.update({
    where: { id: membershipId },
    data: {
      status: PersonMembershipStatus.ENDED,
      endsAt,
    },
    select: MEMBERSHIP_SELECT,
  });
}
