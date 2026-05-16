export type BasePitchCode =
  | "STADION"
  | "KUNSTRASEN_2"
  | "KUNSTRASEN_3";

export type PitchMode =
  | "FULL"
  | "HALF_A"
  | "HALF_B";

export type PitchAllocationCode =
  | "STADION"
  | "STADION_A"
  | "STADION_B"
  | "KUNSTRASEN_2"
  | "KUNSTRASEN_2_A"
  | "KUNSTRASEN_2_B"
  | "KUNSTRASEN_3"
  | "KUNSTRASEN_3_A"
  | "KUNSTRASEN_3_B";

export type PitchDefinition = {
  code: BasePitchCode;
  label: string;
  websiteLabel: string;
  canSplitForTraining: boolean;
};

export type PitchAllocationOption = {
  code: PitchAllocationCode;
  basePitchCode: BasePitchCode;
  mode: PitchMode;
  label: string;
  websiteLabel: string;
  usage: "MATCH_TOURNAMENT_ONLY" | "TRAINING_ONLY" | "ALL";
};

export const FCA_BASE_PITCHES: PitchDefinition[] = [
  {
    code: "STADION",
    label: "Stadion",
    websiteLabel: "Stadion",
    canSplitForTraining: true,
  },
  {
    code: "KUNSTRASEN_2",
    label: "Kunstrasen 2",
    websiteLabel: "Kunstrasen 2",
    canSplitForTraining: true,
  },
  {
    code: "KUNSTRASEN_3",
    label: "Kunstrasen 3",
    websiteLabel: "Kunstrasen 3",
    canSplitForTraining: true,
  },
];

export const FCA_PITCH_ALLOCATIONS: PitchAllocationOption[] = [
  {
    code: "STADION",
    basePitchCode: "STADION",
    mode: "FULL",
    label: "Stadion",
    websiteLabel: "Stadion",
    usage: "ALL",
  },
  {
    code: "STADION_A",
    basePitchCode: "STADION",
    mode: "HALF_A",
    label: "Stadion A",
    websiteLabel: "Stadion A",
    usage: "TRAINING_ONLY",
  },
  {
    code: "STADION_B",
    basePitchCode: "STADION",
    mode: "HALF_B",
    label: "Stadion B",
    websiteLabel: "Stadion B",
    usage: "TRAINING_ONLY",
  },
  {
    code: "KUNSTRASEN_2",
    basePitchCode: "KUNSTRASEN_2",
    mode: "FULL",
    label: "Kunstrasen 2",
    websiteLabel: "Kunstrasen 2",
    usage: "ALL",
  },
  {
    code: "KUNSTRASEN_2_A",
    basePitchCode: "KUNSTRASEN_2",
    mode: "HALF_A",
    label: "Kunstrasen 2 A",
    websiteLabel: "Kunstrasen 2 A",
    usage: "TRAINING_ONLY",
  },
  {
    code: "KUNSTRASEN_2_B",
    basePitchCode: "KUNSTRASEN_2",
    mode: "HALF_B",
    label: "Kunstrasen 2 B",
    websiteLabel: "Kunstrasen 2 B",
    usage: "TRAINING_ONLY",
  },
  {
    code: "KUNSTRASEN_3",
    basePitchCode: "KUNSTRASEN_3",
    mode: "FULL",
    label: "Kunstrasen 3",
    websiteLabel: "Kunstrasen 3",
    usage: "ALL",
  },
  {
    code: "KUNSTRASEN_3_A",
    basePitchCode: "KUNSTRASEN_3",
    mode: "HALF_A",
    label: "Kunstrasen 3 A",
    websiteLabel: "Kunstrasen 3 A",
    usage: "TRAINING_ONLY",
  },
  {
    code: "KUNSTRASEN_3_B",
    basePitchCode: "KUNSTRASEN_3",
    mode: "HALF_B",
    label: "Kunstrasen 3 B",
    websiteLabel: "Kunstrasen 3 B",
    usage: "TRAINING_ONLY",
  },
];

export function getPitchAllocationByCode(code: string | null | undefined) {
  if (!code) {
    return null;
  }

  return FCA_PITCH_ALLOCATIONS.find((item) => item.code === code) ?? null;
}

export function getPitchOptionsForEventType(eventType: string) {
  if (eventType === "TRAINING") {
    return FCA_PITCH_ALLOCATIONS;
  }

  return FCA_PITCH_ALLOCATIONS.filter((item) => item.mode === "FULL");
}