/**
 * lib/roles/errors.ts
 *
 * Controlled domain errors for the RPERM-05 Roles & Permissions
 * administration module. Every mutation in `lib/roles/mutations.ts` throws
 * one of these instead of a generic `Error` so API routes can map them to a
 * stable `{ code, error }` response and a correct HTTP status, per the
 * task's "mutation safety" requirement ("Return controlled domain errors").
 */

export type RoleDomainErrorCode =
  | "DUPLICATE_ROLE_NAME"
  | "ROLE_NOT_FOUND"
  | "INACCESSIBLE_TENANT"
  | "SCOPE_MISMATCH"
  | "PROTECTED_ROLE"
  | "LAST_REQUIRED_ADMIN"
  | "INACTIVE_MEMBERSHIP"
  | "ARCHIVED_ROLE"
  | "INVALID_PERMISSION_SCOPE"
  | "DELEGATION_FORBIDDEN"
  | "USER_NOT_FOUND"
  | "VALIDATION_ERROR";

export class RoleDomainError extends Error {
  readonly code: RoleDomainErrorCode;
  readonly status: number;

  constructor(code: RoleDomainErrorCode, message: string, status = 400) {
    super(message);
    this.name = "RoleDomainError";
    this.code = code;
    this.status = status;
  }
}

export class DuplicateRoleNameError extends RoleDomainError {
  constructor(name: string) {
    super(
      "DUPLICATE_ROLE_NAME",
      `Eine Rolle mit dem Namen "${name}" existiert bereits in diesem Mandanten.`,
      409,
    );
  }
}

export class RoleNotFoundError extends RoleDomainError {
  constructor() {
    super("ROLE_NOT_FOUND", "Rolle nicht gefunden.", 404);
  }
}

export class InaccessibleTenantError extends RoleDomainError {
  constructor() {
    super("INACCESSIBLE_TENANT", "Kein gültiger Mandanten-Kontext.", 403);
  }
}

export class ScopeMismatchError extends RoleDomainError {
  constructor(message = "Der Berechtigungs-Scope stimmt nicht mit dem Rollen-Scope überein.") {
    super("SCOPE_MISMATCH", message, 409);
  }
}

export class ProtectedRoleError extends RoleDomainError {
  constructor(message = "Diese Rolle ist systemgeschützt und kann nicht verändert werden.") {
    super("PROTECTED_ROLE", message, 409);
  }
}

export class LastRequiredAdminError extends RoleDomainError {
  constructor(
    message = "Diese Zuweisung kann nicht entfernt werden — es wäre kein Benutzer mehr mit dieser systemkritischen Rolle in diesem Mandanten vorhanden.",
  ) {
    super("LAST_REQUIRED_ADMIN", message, 409);
  }
}

export class InactiveMembershipError extends RoleDomainError {
  constructor(
    message = "Der Benutzer hat keine aktive Mitgliedschaft in diesem Mandanten.",
  ) {
    super("INACTIVE_MEMBERSHIP", message, 409);
  }
}

export class ArchivedRoleError extends RoleDomainError {
  constructor(message = "Archivierte Rollen können nicht zugewiesen oder bearbeitet werden.") {
    super("ARCHIVED_ROLE", message, 409);
  }
}

export class InvalidPermissionScopeError extends RoleDomainError {
  constructor(message = "Eine oder mehrere Berechtigungen sind für diesen Rollen-Scope ungültig.") {
    super("INVALID_PERMISSION_SCOPE", message, 400);
  }
}

export class DelegationForbiddenError extends RoleDomainError {
  constructor(
    message = "Sie dürfen nur Berechtigungen und Rollen delegieren, die Sie selbst aktuell besitzen.",
  ) {
    super("DELEGATION_FORBIDDEN", message, 403);
  }
}

export class RoleUserNotFoundError extends RoleDomainError {
  constructor() {
    super("USER_NOT_FOUND", "Benutzer nicht gefunden.", 404);
  }
}

export class RoleValidationError extends RoleDomainError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
  }
}

/**
 * Maps any thrown error to a `{ status, body }` pair for a JSON API
 * response. `RoleDomainError` instances map to their own `status`/`code`;
 * anything else is treated as an unexpected 500.
 */
export function toRoleApiErrorResponse(error: unknown): {
  status: number;
  body: { error: string; code?: RoleDomainErrorCode };
} {
  if (error instanceof RoleDomainError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
  return { status: 500, body: { error: `Technischer Fehler: ${message}` } };
}
