/**
 * PERSON-UX-02 — Centralized Person capacity resolver.
 *
 * Derives trustworthy capacities from persisted relationships:
 *   PlayerSquadMember → TeamSeason → Season  (Spieler)
 *   TrainerTeamMember → TeamSeason → Season  (Trainer)
 *   PersonAssignment  → OrgUnit              (Organisation/Function)
 *
 * NEVER uses Person.isPlayer / Person.isTrainer as the sole source of truth.
 *
 * isPlayer/isTrainer drift analysis:
 *   These Boolean flags are denormalized convenience fields set at Person
 *   creation time (e.g. copied from a registration payload). They are NOT
 *   automatically updated when PlayerSquadMember / TrainerTeamMember records
 *   are later added or removed via team-admin workflows.
 *
 *   Confirmed drift scenarios:
 *   1. Person registered as a player → isPlayer=true. Later removed from all
 *      squads. isPlayer stays true indefinitely. Conversely, hasPlayerEvidence
 *      correctly reflects the presence/absence of PlayerSquadMember rows.
 *   2. Trainer added directly via team-season admin (no registration) →
 *      isTrainer may remain false even though TrainerTeamMember rows exist.
 *   3. Simultaneous roles: a person who is both player and trainer may have
 *      isPlayer=true, isTrainer=false — or vice versa — depending on creation
 *      path.
 *
 *   The flags are NOT removed in this slice. They serve as index-friendly
 *   quick-filter helpers in the directory query. But tab visibility,
 *   capacity labels, and the header summary MUST be driven by the
 *   relationship-chain evidence below.
 *
 * Simultaneous roles are first-class:
 *   A Person may be Spieler + Trainer + Funktionär in the same season.
 *   The resolver surfaces all roles. Callers MUST NOT reduce to a single
 *   "primary" role.
 */

import type { PersonSquadMembership, PersonTrainerMembership } from "./queries";

/** Active player status values — mirrors the PlayerSquadStatus enum. */
const ACTIVE_PLAYER_STATUSES = new Set(["ACTIVE", "INJURED", "ABSENT"]);

export type PersonCapacities = {
  /**
   * True iff at least one PlayerSquadMember record exists for this Person,
   * regardless of status or season. Covers current AND former players.
   */
  hasPlayerEvidence: boolean;
  /**
   * True iff at least one TrainerTeamMember record exists for this Person,
   * regardless of status or season. Covers current AND former trainers.
   */
  hasTrainerEvidence: boolean;
  /**
   * True iff the Person currently holds at least one active player membership
   * (status ACTIVE, INJURED, or ABSENT).
   */
  isCurrentPlayer: boolean;
  /**
   * True iff the Person currently holds at least one active trainer membership
   * (status ACTIVE).
   */
  isCurrentTrainer: boolean;
  /**
   * True iff hasPlayerEvidence OR hasTrainerEvidence. Used to gate the
   * Sport & Entwicklung tab and suppress sports-centric empty-state noise
   * for external/non-sporting Persons.
   */
  hasSportingEvidence: boolean;
};

/**
 * Resolves the canonical capacities for a Person from persisted relationship data.
 *
 * Pure function — safe for both server and client components.
 *
 * @param squadMemberships  All PlayerSquadMember records for this Person.
 * @param trainerMemberships  All TrainerTeamMember records for this Person.
 */
export function resolvePersonCapacities(
  squadMemberships: PersonSquadMembership[],
  trainerMemberships: PersonTrainerMembership[],
): PersonCapacities {
  const hasPlayerEvidence = squadMemberships.length > 0;
  const hasTrainerEvidence = trainerMemberships.length > 0;

  const isCurrentPlayer = squadMemberships.some((m) =>
    ACTIVE_PLAYER_STATUSES.has(m.status),
  );
  const isCurrentTrainer = trainerMemberships.some((m) => m.status === "ACTIVE");

  return {
    hasPlayerEvidence,
    hasTrainerEvidence,
    isCurrentPlayer,
    isCurrentTrainer,
    hasSportingEvidence: hasPlayerEvidence || hasTrainerEvidence,
  };
}
