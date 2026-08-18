/**
 * PERSON-UX-04: Pure date-validation helpers for PersonMembership.
 *
 * This module has NO Prisma / DB imports so it is safe to import in
 * unit and UI tests that run without a DATABASE_URL.
 *
 * membership-service.ts imports and re-uses these helpers.
 */

/** Validation result type. */
export type MembershipValidationResult =
  | { ok: true }
  | { ok: false; message: string; status: 400 };

/**
 * Validates that endsAt is not earlier than startsAt.
 * Also handles partial updates where only one date is changing.
 */
export function validateDates(
  startsAt: Date | undefined,
  endsAt: Date | null | undefined,
  existingStartsAt?: Date,
): MembershipValidationResult {
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
