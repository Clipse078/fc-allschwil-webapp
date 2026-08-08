/**
 * lib/tournaments/errors.ts
 *
 * Typed errors for the TournamentCenter domain service, mirroring the
 * error-class conventions established by lib/training/errors.ts and
 * lib/matchcenter (tenant-scoped not-found + validation + transition
 * errors).
 */

export class TournamentNotFoundError extends Error {
  constructor(tournamentId: string) {
    super(`Tournament "${tournamentId}" was not found.`);
    this.name = "TournamentNotFoundError";
  }
}

export class TournamentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TournamentValidationError";
  }
}

export class TournamentInvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TournamentInvalidTransitionError";
  }
}
