/**
 * lib/participation/errors.ts
 *
 * Typed errors for the participation domain.
 */

export class ParticipationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParticipationValidationError";
  }
}

export class ParticipationTenantMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParticipationTenantMismatchError";
  }
}

export class ParticipationEventNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParticipationEventNotFoundError";
  }
}

export class ParticipationNotFoundError extends Error {
  constructor(id: string) {
    super(`Teilnahme-Rückmeldung nicht gefunden: ${id}`);
    this.name = "ParticipationNotFoundError";
  }
}

export class ParticipationUnauthorizedError extends Error {
  constructor(message = "Keine Berechtigung für diese Teilnahme-Rückmeldung.") {
    super(message);
    this.name = "ParticipationUnauthorizedError";
  }
}
