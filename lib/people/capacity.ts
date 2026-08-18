/**
 * PERSON-UX-02 — Centralized Person capacity resolver.
 * PERSON-UX-07 — Extended to cover all standard capacities + custom functions.
 *
 * Capacity model:
 *   "What is this Person?"
 *
 *   Standard capacities (explicit toggles set by admins):
 *     isPlayer       → Spieler/in
 *     isTrainer      → Trainer/in
 *     isFunctionary  → Funktionär/in
 *     isVolunteer    → Freiwillige/r
 *     isReferee      → Schiedsrichter/in
 *     isSponsorContact → Sponsor-/Partner-Kontakt
 *     customFunctions  → Weitere Funktion (club-defined, multiple)
 *
 *   Relationship evidence (from persisted membership chains):
 *     hasPlayerEvidence  — used for content in Spieler tab and Sport cross-view
 *     hasTrainerEvidence — used for content in Trainer tab and Sport cross-view
 *
 * PERSON-UX-07 tab visibility:
 *   Spieler tab: person.isPlayer (flag-based, not evidence-based)
 *   Trainer tab: person.isTrainer (flag-based, not evidence-based)
 *   Sport & Entwicklung: isPlayer OR isTrainer OR any membership evidence
 *
 * Invariant: Capacity ≠ Assignment ≠ Authorization.
 *   isPlayer=true does NOT auto-assign to a team.
 *   isTrainer=true does NOT grant trainer permissions.
 *   customFunction does NOT create any role or permission.
 *
 * Simultaneous capacities are always first-class.
 * NEVER reduce to a single "primary" capacity.
 *
 * NEVER uses Person.isPlayer / Person.isTrainer as the sole source of truth
 * for membership-evidence queries (squad data is separately tracked).
 */

import type { PersonSquadMembership, PersonTrainerMembership } from "./queries";

/** Active player status values — mirrors the PlayerSquadStatus enum. */
const ACTIVE_PLAYER_STATUSES = new Set(["ACTIVE", "INJURED", "ABSENT"]);

export type PersonCapacities = {
  /**
   * True iff at least one PlayerSquadMember record exists for this Person,
   * regardless of status or season. Covers current AND former players.
   * Used for content in the Spieler tab (not for tab visibility in UX-07).
   */
  hasPlayerEvidence: boolean;
  /**
   * True iff at least one TrainerTeamMember record exists for this Person,
   * regardless of status or season. Covers current AND former trainers.
   * Used for content in the Trainer tab (not for tab visibility in UX-07).
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
   * Sport & Entwicklung cross-view tab (along with isPlayer/isTrainer flags).
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

/**
 * Returns all currently-active standard capacity labels for a Person
 * (for display in headers, directory views, etc.).
 *
 * PERSON-UX-07 — reads from explicit capacity flags on the Person record.
 *
 * Returns: ordered list of labels (e.g. ["Spieler/in", "Trainer/in"]).
 * Returns empty array when no standard capacities are active.
 */
export function getActiveCapacityLabels(person: {
  isPlayer: boolean;
  isTrainer: boolean;
  isFunctionary?: boolean;
  isVolunteer?: boolean;
  isReferee?: boolean;
  isSponsorContact?: boolean;
}): string[] {
  const labels: string[] = [];
  if (person.isPlayer) labels.push("Spieler/in");
  if (person.isTrainer) labels.push("Trainer/in");
  if (person.isFunctionary) labels.push("Funktionär/in");
  if (person.isReferee) labels.push("Schiedsrichter/in");
  if (person.isVolunteer) labels.push("Freiwillige/r");
  if (person.isSponsorContact) labels.push("Sponsor-/Partner-Kontakt");
  return labels;
}
