/**
 * PERSONS-01/02 — Canonical person function keys and German UI labels.
 *
 * These keys are stored in OrgUnitMembership.roleKey for person assignments
 * (where personId is set). They describe WHAT A PERSON DOES in an
 * organisational context — not what a User may access/do.
 *
 * CRITICAL: Person functions are ORGANISATIONAL LABELS ONLY.
 * They do NOT grant RPERM permissions. "Trainer/in" assignment does NOT
 * equal an authorization role. See PERSONS-01 architectural principle.
 */

export const PERSON_FUNCTIONS = {
  PLAYER: "SPIELER",
  HEAD_COACH: "TRAINER",
  ASSISTANT_COACH: "CO_TRAINER",
  GOALKEEPER_COACH: "TORWARTTRAINER",
  TEAM_MANAGER: "TEAMMANAGER",
  PHYSIO: "PHYSIO",
  COORDINATOR: "KOORDINATOR",
  CLUB_OFFICIAL: "VEREINSFUNKTIONAER",
  BOARD_MEMBER: "VORSTANDSMITGLIED",
  PRESIDENT: "PRAESIDENT",
  VICE_PRESIDENT: "VIZEPRAESIDENT",
  VOLUNTEER: "FREIWILLIGER",
  REFEREE: "SCHIEDSRICHTER",
  SPONSOR_CONTACT: "SPONSORING_KONTAKT",
  OTHER: "ANDERE",
} as const;

export type PersonFunctionKey = (typeof PERSON_FUNCTIONS)[keyof typeof PERSON_FUNCTIONS];

export const PERSON_FUNCTION_LABELS: Record<PersonFunctionKey, string> = {
  SPIELER: "Spieler/in",
  TRAINER: "Trainer/in",
  CO_TRAINER: "Co-Trainer/in",
  TORWARTTRAINER: "Torwarttrainer/in",
  TEAMMANAGER: "Teammanager/in",
  PHYSIO: "Physio",
  KOORDINATOR: "Koordinator/in",
  VEREINSFUNKTIONAER: "Vereinsfunktionär/in",
  VORSTANDSMITGLIED: "Vorstandsmitglied",
  PRAESIDENT: "Präsident/in",
  VIZEPRAESIDENT: "Vizepräsident/in",
  FREIWILLIGER: "Freiwillige/r",
  SCHIEDSRICHTER: "Schiedsrichter/in",
  SPONSORING_KONTAKT: "Sponsoring-Kontakt",
  ANDERE: "Andere Funktion",
};

export const PERSON_FUNCTION_OPTIONS = Object.entries(PERSON_FUNCTION_LABELS).map(
  ([value, label]) => ({ value: value as PersonFunctionKey, label }),
);

/** Quick-filter groups for the directory UI */
export const PERSON_FUNCTION_GROUPS = {
  SPIELER: [PERSON_FUNCTIONS.PLAYER],
  TRAINER_STAFF: [
    PERSON_FUNCTIONS.HEAD_COACH,
    PERSON_FUNCTIONS.ASSISTANT_COACH,
    PERSON_FUNCTIONS.GOALKEEPER_COACH,
    PERSON_FUNCTIONS.TEAM_MANAGER,
    PERSON_FUNCTIONS.PHYSIO,
  ],
  VEREINSLEITUNG: [
    PERSON_FUNCTIONS.CLUB_OFFICIAL,
    PERSON_FUNCTIONS.BOARD_MEMBER,
    PERSON_FUNCTIONS.PRESIDENT,
    PERSON_FUNCTIONS.VICE_PRESIDENT,
    PERSON_FUNCTIONS.COORDINATOR,
  ],
  FREIWILLIGE: [PERSON_FUNCTIONS.VOLUNTEER],
} as const;

/**
 * Returns the German display label for a function key.
 * Falls back to the raw key if unknown.
 */
export function getPersonFunctionLabel(key: string | null | undefined): string {
  if (!key) return "";
  return PERSON_FUNCTION_LABELS[key as PersonFunctionKey] ?? key;
}

/**
 * Returns true when the given roleKey is a recognised person-function key.
 * Used to distinguish person-function memberships from governance-role memberships.
 */
export function isPersonFunctionKey(key: string | null | undefined): key is PersonFunctionKey {
  if (!key) return false;
  return Object.values(PERSON_FUNCTIONS).includes(key as PersonFunctionKey);
}
