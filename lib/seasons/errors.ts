/**
 * lib/seasons/errors.ts
 *
 * SEASON-01 — controlled domain errors for lib/seasons/mutations.ts, mapped
 * to a stable `{ code, error }` response + HTTP status by API routes.
 */

export type SeasonDomainErrorCode =
  | "SEASON_NOT_FOUND"
  | "DUPLICATE_SEASON"
  | "VALIDATION_ERROR"
  | "HAS_DEPENDENCIES";

export class SeasonDomainError extends Error {
  readonly code: SeasonDomainErrorCode;
  readonly status: number;

  constructor(code: SeasonDomainErrorCode, message: string, status = 400) {
    super(message);
    this.name = "SeasonDomainError";
    this.code = code;
    this.status = status;
  }
}

export class SeasonNotFoundError extends SeasonDomainError {
  constructor() {
    super("SEASON_NOT_FOUND", "Saison nicht gefunden.", 404);
  }
}

export class DuplicateSeasonError extends SeasonDomainError {
  constructor(name: string) {
    super("DUPLICATE_SEASON", `Die Saison "${name}" existiert bereits.`, 409);
  }
}

export class SeasonValidationError extends SeasonDomainError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
  }
}

/** Thrown by deleteSeason() when the Season is still referenced elsewhere. */
export class SeasonHasDependenciesError extends SeasonDomainError {
  readonly counts: {
    teamSeasons: number;
    events: number;
    eventImportRuns: number;
    trainingPlans: number;
    orgUnitMemberships: number;
  };

  constructor(counts: SeasonHasDependenciesError["counts"]) {
    super(
      "HAS_DEPENDENCIES",
      "Diese Saison kann nicht gelöscht werden, da sie noch referenziert wird (Teams, Events oder andere Daten).",
      409,
    );
    this.counts = counts;
  }
}

export function toSeasonApiErrorResponse(error: unknown): {
  status: number;
  body: {
    error: string;
    code?: SeasonDomainErrorCode;
    counts?: SeasonHasDependenciesError["counts"];
  };
} {
  if (error instanceof SeasonHasDependenciesError) {
    return { status: error.status, body: { error: error.message, code: error.code, counts: error.counts } };
  }
  if (error instanceof SeasonDomainError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
  return { status: 500, body: { error: `Technischer Fehler: ${message}` } };
}
