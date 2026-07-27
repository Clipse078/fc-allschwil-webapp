/**
 * Shared types for the Team registration wizard.
 */

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

export type WizardFormData = {
  // Step 1 — Saison und Organisation
  seasonId: string;
  orgUnitIds: string[]; // ordered; index 0 is primary

  // Step 2 — Team
  teamName: string;
  teamSlug: string;
  teamShortName: string;
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

  // Step 4 — Veröffentlichung
  websiteVisible: boolean;
  infoboardVisible: boolean;
};

export const INITIAL_FORM_DATA: WizardFormData = {
  seasonId: "",
  orgUnitIds: [],
  teamName: "",
  teamSlug: "",
  teamShortName: "",
  teamGenderGroup: "",
  teamAgeGroup: "",
  teamSortOrder: 0,
  existingTeamId: null,
  federationProvider: null,
  federationExternalTeamId: null,
  federationExternalSeasonId: null,
  federationProviderTeamName: null,
  federationProviderLeagueName: null,
  websiteVisible: true,
  infoboardVisible: true,
};

export type WizardStep = 0 | 1 | 2 | 3;
export const WIZARD_STEPS = [
  { index: 0, label: "Saison und Organisation" },
  { index: 1, label: "Team" },
  { index: 2, label: "Verband" },
  { index: 3, label: "Veröffentlichung" },
] as const;
