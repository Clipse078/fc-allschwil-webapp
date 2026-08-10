/**
 * lib/people/errors.ts
 *
 * ADMIN-MASTERDATA-UX-01-C1 — controlled domain errors for
 * lib/people/mutations.ts (Person <-> User linking). Mapped to a stable
 * `{ code, error }` response + HTTP status by the API route.
 */

export type PersonLinkErrorCode =
  | "PERSON_NOT_FOUND"
  | "PERSON_ALREADY_LINKED"
  | "USER_NOT_FOUND"
  | "USER_NOT_ELIGIBLE"
  | "USER_ALREADY_LINKED";

export class PersonLinkError extends Error {
  readonly code: PersonLinkErrorCode;
  readonly status: number;

  constructor(code: PersonLinkErrorCode, message: string, status = 400) {
    super(message);
    this.name = "PersonLinkError";
    this.code = code;
    this.status = status;
  }
}

export class PersonNotFoundError extends PersonLinkError {
  constructor() {
    super("PERSON_NOT_FOUND", "Person nicht gefunden.", 404);
  }
}

/** Person.userId is already set — caller must unlink before linking a different User. */
export class PersonAlreadyLinkedError extends PersonLinkError {
  constructor() {
    super(
      "PERSON_ALREADY_LINKED",
      "Diese Person ist bereits mit einem Benutzerkonto verknüpft. Zuerst die Verknüpfung lösen.",
      409,
    );
  }
}

export class LinkUserNotFoundError extends PersonLinkError {
  constructor() {
    super("USER_NOT_FOUND", "Benutzer nicht gefunden.", 404);
  }
}

/**
 * The target User has no active TenantMembership in the caller's active
 * tenant — covers both a cross-tenant User and a PLATFORM-only User with
 * no tenant membership at all. Same eligibility rule as tenant role
 * assignment (getEligibleTenantMembers()) — never a second rule.
 */
export class UserNotEligibleError extends PersonLinkError {
  constructor() {
    super(
      "USER_NOT_ELIGIBLE",
      "Dieser Benutzer ist kein aktives Mitglied des aktuellen Mandanten und kann nicht verknüpft werden.",
      409,
    );
  }
}

/** Person.userId is @unique — a User already linked to another Person cannot be linked again. */
export class UserAlreadyLinkedError extends PersonLinkError {
  constructor() {
    super(
      "USER_ALREADY_LINKED",
      "Dieser Benutzer ist bereits mit einer anderen Person verknüpft.",
      409,
    );
  }
}

export function toPersonLinkApiErrorResponse(error: unknown): {
  status: number;
  body: { error: string; code?: PersonLinkErrorCode };
} {
  if (error instanceof PersonLinkError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
  return { status: 500, body: { error: `Technischer Fehler: ${message}` } };
}
