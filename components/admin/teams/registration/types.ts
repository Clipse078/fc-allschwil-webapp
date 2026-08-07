/**
 * Shared types for the Team registration wizard.
 */

// ---------------------------------------------------------------------------
// Participation Type
// ---------------------------------------------------------------------------

/**
 * ParticipationType mirrors the Prisma enum.
 * Defined here as a plain string union so the client bundle does not
 * import the Prisma enum (server-only).
 */
export type ParticipationType =
  | "COMPETITION"
  | "TRAINING"
  | "DEVELOPMENT"
  | "RECREATIONAL"
  | "OTHER";

export const PARTICIPATION_TYPES: {
  value: ParticipationType;
  label: string;
  description: string;
}[] = [
  {
    value: "COMPETITION",
    label: "Wettkampfteam",
    description:
      "Das Team nimmt an einem offiziellen Wettkampf teil (Liga, Pokal oder Turnier).",
  },
  {
    value: "TRAINING",
    label: "Trainingsgruppe",
    description:
      "Reines Trainingsteam ohne Wettkampfbeteiligung. Kein Wettkampf erforderlich.",
  },
  {
    value: "DEVELOPMENT",
    label: "Entwicklungsteam",
    description:
      "Fördergruppe oder Nachwuchsteam, das primär auf Spielerentwicklung ausgerichtet ist.",
  },
  {
    value: "RECREATIONAL",
    label: "Freizeitteam",
    description:
      "Freizeitgruppe ohne Wettkampfbeteiligung (z. B. Walking Football, Seniorengruppe).",
  },
  {
    value: "OTHER",
    label: "Sonstiges",
    description:
      "Sonstige Beteiligungsform, die nicht in eine der anderen Kategorien passt.",
  },
];

// ---------------------------------------------------------------------------
// Eligible data types
// ---------------------------------------------------------------------------

export type EligibleSeason = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  startDate: string | Date;
  endDate: string | Date;
  lifecycleStatus: string;
  lifecycleStatusLabel: string;
};

export type EligibleOrgUnit = {
  id: string;
  name: string;
  key: string;
  type: string;
  status: string;
};

export type ExistingTeam = {
  id: string;
  name: string;
  slug: string;
};

export type UnmappedFederationTeam = {
  id: string;
  provider: string;
  externalTeamId: number;
  externalSeasonId: number;
  providerTeamName: string | null;
  providerLeagueName: string | null;
  providerIsActive: boolean;
};

export type EligibleCompetition = {
  id: string;
  officialName: string;
  shortName: string | null;
  groupName: string | null;
  provider: string;
  competitionType: string;
  gender: string | null;
  ageCategory: string | null;
  externalSeasonId: number | null;
  isArchived: boolean;
  assignedTeamCount: number;
};

// ---------------------------------------------------------------------------
// Wizard form data
// ---------------------------------------------------------------------------

export type WizardFormData = {
  // Step 1 — Saison und Organisation
  seasonId: string;
  orgUnitIds: string[]; // ordered; index 0 is primary

  // Step 2 — Team
  teamName: string;
  teamSlug: string;
  teamShortName: string;
  // TEAM-IDENTITY-01: Team.alternativeName — tenant-owned, optional, canonical
  // ALTERNATIVE NAME (distinct from teamShortName, which maps to the
  // seasonal TeamSeason.shortName).
  teamAlternativeName: string;
  teamGenderGroup: string;
  teamAgeGroup: string;
  teamSortOrder: number;
  existingTeamId: string | null; // null = create new team identity

  // Step 3 — Verband (optional)
  federationProvider: string | null;
  federationExternalTeamId: number | null;
  federationExternalSeasonId: number | null;
  federationProviderTeamName: string | null;
  federationProviderLeagueName: string | null;

  // Step 4 — Teilnahme (Participation) — TEAM-CREATE-02
  participationType: ParticipationType;

  // Step 5 — Wettkampf (Competition) — TEAM-CREATE-02 (conditional: COMPETITION only)
  competitionId: string | null;

  // Step 6 — Veröffentlichung
  websiteVisible: boolean;
  infoboardVisible: boolean;
};

export const INITIAL_FORM_DATA: WizardFormData = {
  seasonId: "",
  orgUnitIds: [],
  teamName: "",
  teamSlug: "",
  teamShortName: "",
  teamAlternativeName: "",
  teamGenderGroup: "",
  teamAgeGroup: "",
  teamSortOrder: 0,
  existingTeamId: null,
  federationProvider: null,
  federationExternalTeamId: null,
  federationExternalSeasonId: null,
  federationProviderTeamName: null,
  federationProviderLeagueName: null,
  participationType: "TRAINING",
  competitionId: null,
  websiteVisible: true,
  infoboardVisible: true,
};

// ---------------------------------------------------------------------------
// Wizard step definitions
// ---------------------------------------------------------------------------

export const STEP_SEASON_ORG = 0;
export const STEP_TEAM = 1;
export const STEP_FEDERATION = 2;
export const STEP_PARTICIPATION = 3;
export const STEP_COMPETITION = 4;
export const STEP_PUBLICATION = 5;

export type WizardStep = 0 | 1 | 2 | 3 | 4 | 5;

export const WIZARD_STEP_DEFS: Array<{
  index: number;
  label: string;
  shortLabel: string;
}> = [
  { index: STEP_SEASON_ORG, label: "Saison", shortLabel: "Saison" },
  { index: STEP_TEAM, label: "Team", shortLabel: "Team" },
  { index: STEP_FEDERATION, label: "Verband", shortLabel: "Verband" },
  { index: STEP_PARTICIPATION, label: "Teilnahme", shortLabel: "Teilnahme" },
  { index: STEP_COMPETITION, label: "Wettkampf", shortLabel: "Wettkampf" },
  { index: STEP_PUBLICATION, label: "Website", shortLabel: "Website" },
];
