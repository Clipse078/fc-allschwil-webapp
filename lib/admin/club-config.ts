export type ClubCountryCode = "CH" | "DE" | "NL" | "CUSTOM";

export type ClubTeamCategoryRule = {
  key: string;
  label: string;
  sortOrder: number;
  allowedBirthYears: number[];
  minimumTrainerCount: number;
  requiredDiplomaLabels: string[];
  allowYoungerPlayers: boolean;
  blockOlderPlayers: boolean;
};

export type ClubWorkflowRule = {
  key: string;
  domain: "WEBSITE" | "NEWS" | "TEAMS" | "EVENTS" | "WOCHENPLAN" | "INFOBOARD" | "PEOPLE";
  label: string;
  preparerRoleKeys: string[];
  reviewerRoleKeys: string[];
  publisherRoleKeys: string[];
  reviewRequired: boolean;
  publishRequiresApproval: boolean;
};

export type ClubConfiguration = {
  tenantKey: string;
  clubName: string;
  countryCode: ClubCountryCode;
  federationLabel: string;
  seasonLabel: string;
  teamCategoryRules: ClubTeamCategoryRule[];
  workflowRules: ClubWorkflowRule[];
};

export const DEFAULT_FC_ALLSCHWIL_CONFIG: ClubConfiguration = {
  tenantKey: "fc-allschwil",
  clubName: "FC Allschwil",
  countryCode: "CH",
  federationLabel: "FVNWS / SFV",
  seasonLabel: "2025/2026",
  teamCategoryRules: [
    {
      key: "kifu-gfe",
      label: "Kinderfussball G/F/E",
      sortOrder: 10,
      allowedBirthYears: [],
      minimumTrainerCount: 1,
      requiredDiplomaLabels: ["D-Diplom", "Kinderfussball-Diplom"],
      allowYoungerPlayers: true,
      blockOlderPlayers: true,
    },
    {
      key: "junioren-cba",
      label: "Junioren C/B/A",
      sortOrder: 20,
      allowedBirthYears: [],
      minimumTrainerCount: 1,
      requiredDiplomaLabels: ["C-Diplom"],
      allowYoungerPlayers: true,
      blockOlderPlayers: true,
    },
    {
      key: "aktive",
      label: "Aktive",
      sortOrder: 30,
      allowedBirthYears: [],
      minimumTrainerCount: 1,
      requiredDiplomaLabels: ["B-Diplom"],
      allowYoungerPlayers: false,
      blockOlderPlayers: false,
    },
  ],
  workflowRules: [
    {
      key: "media-news-publishing",
      domain: "NEWS",
      label: "Mediateam News Publishing",
      preparerRoleKeys: ["mediateam-content-creator"],
      reviewerRoleKeys: ["redaktor"],
      publisherRoleKeys: ["redaktor"],
      reviewRequired: true,
      publishRequiresApproval: true,
    },
  ],
};
