/**
 * Tenant-configurable registration classification engine.
 *
 * This file is intentionally generic and does NOT hardcode FC Allschwil rules.
 * Every future tenant can supply their own ClassificationConfig to override
 * age brackets, target groups, coordinators and colour tokens.
 */

// ── Gender ───────────────────────────────────────────────────────────────────

export type GenderCode = "M" | "F" | "OTHER" | null;

export function extractGenderFromPayload(payloadJson: unknown): GenderCode {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson))
    return null;

  const p = payloadJson as Record<string, unknown>;
  // Website submissions (lib/website/integration-contract.ts) nest gender
  // under `person.gender`. Legacy / manual entries may store it top-level.
  // REGISTRATION-01D: check both so classification and display never miss
  // gender that was actually collected and persisted.
  const person = (p.person && typeof p.person === "object" && !Array.isArray(p.person)
    ? (p.person as Record<string, unknown>)
    : null);
  const raw = (person?.gender ?? p.gender ?? p.geschlecht ?? p.sex ?? "") as string;

  if (typeof raw !== "string" || !raw) return null;

  const n = raw.toLowerCase().trim();
  if (["m", "male", "mann", "männlich", "junge", "herr"].includes(n)) return "M";
  if (["f", "female", "frau", "weiblich", "mädchen", "dame"].includes(n)) return "F";
  return "OTHER";
}

export function getGenderLabel(gender: GenderCode, adult = false): string | null {
  if (gender === "M") return adult ? "Mann" : "Junge";
  if (gender === "F") return adult ? "Frau" : "Mädchen";
  return null;
}

// ── Classification result ─────────────────────────────────────────────────────

export type ClassificationResult = {
  targetGroupKey: string;
  targetGroupLabel: string;
  coordinatorRole: string;
  reasoning: string;
  colorToken: ColorToken;
};

export type ColorToken =
  | "green"
  | "blue"
  | "violet"
  | "orange"
  | "pink"
  | "amber"
  | "slate";

// ── Configurable age group ────────────────────────────────────────────────────

export type AgeGroupDef = {
  key: string;
  label: string;
  coordinatorRole: string;
  colorToken: ColorToken;
  /** Inclusive birth-year range (e.g. min=2015, max=2018) */
  minBirthYear: (baseYear: number) => number;
  maxBirthYear: (baseYear: number) => number;
  /** If set, only match registrations with these gender codes */
  genders?: GenderCode[];
};

export type ClassificationConfig = {
  /** Human-readable sport name, used for logging / admin UI */
  sport: string;
  ageGroups: AgeGroupDef[];
  /** Override result for a specific registration type key */
  typeOverrides?: Record<string, ClassificationResult>;
};

// ── Default Swiss football club configuration ─────────────────────────────────
// Age groups follow the SFV (Swiss Football Association) age brackets.
// A club with different sport / league / country rules can provide its own config.

const DEFAULT_AGE_GROUPS: AgeGroupDef[] = [
  {
    key: "KINDERFUSSBALL",
    label: "Kinderfussball",
    coordinatorRole: "KiFu-Koordinator",
    colorToken: "green",
    minBirthYear: (y) => y - 9,
    maxBirthYear: (y) => y - 5,
  },
  {
    key: "JUNIOREN_EF",
    label: "E/F Junioren",
    coordinatorRole: "Juniorenkoordinator",
    colorToken: "blue",
    minBirthYear: (y) => y - 13,
    maxBirthYear: (y) => y - 10,
    genders: ["M", "OTHER", null],
  },
  {
    key: "JUNIORINNEN_EF",
    label: "E/F Juniorinnen",
    coordinatorRole: "Juniorinnenkoordinator",
    colorToken: "violet",
    minBirthYear: (y) => y - 13,
    maxBirthYear: (y) => y - 10,
    genders: ["F"],
  },
  {
    key: "JUNIOREN_D",
    label: "D Junioren",
    coordinatorRole: "Juniorenkoordinator",
    colorToken: "blue",
    minBirthYear: (y) => y - 15,
    maxBirthYear: (y) => y - 14,
    genders: ["M", "OTHER", null],
  },
  {
    key: "JUNIORINNEN_D",
    label: "D Juniorinnen",
    coordinatorRole: "Juniorinnenkoordinator",
    colorToken: "violet",
    minBirthYear: (y) => y - 15,
    maxBirthYear: (y) => y - 14,
    genders: ["F"],
  },
  {
    key: "JUNIOREN_C",
    label: "C Junioren",
    coordinatorRole: "Juniorenkoordinator",
    colorToken: "blue",
    minBirthYear: (y) => y - 17,
    maxBirthYear: (y) => y - 16,
    genders: ["M", "OTHER", null],
  },
  {
    key: "JUNIOREN_AB",
    label: "A/B Junioren",
    coordinatorRole: "Juniorenkoordinator",
    colorToken: "blue",
    minBirthYear: (y) => y - 21,
    maxBirthYear: (y) => y - 18,
    genders: ["M", "OTHER", null],
  },
  {
    key: "AKTIVE_FRAUEN",
    label: "Frauen",
    coordinatorRole: "Frauenkoordinator",
    colorToken: "pink",
    minBirthYear: () => 1900,
    maxBirthYear: (y) => y - 18,
    genders: ["F"],
  },
  {
    key: "AKTIVE_MAENNER",
    label: "Aktive",
    coordinatorRole: "Sportchef",
    colorToken: "orange",
    minBirthYear: () => 1900,
    maxBirthYear: (y) => y - 18,
    genders: ["M", "OTHER", null],
  },
];

const DEFAULT_TYPE_OVERRIDES: Record<string, ClassificationResult> = {
  TRAINERANMELDUNG: {
    targetGroupKey: "TRAINER_STAFF",
    targetGroupLabel: "Trainerstaff",
    coordinatorRole: "Technischer Leiter",
    reasoning: "Traineranmeldung",
    colorToken: "slate",
  },
  SPONSORANFRAGE: {
    targetGroupKey: "SPONSOR",
    targetGroupLabel: "Sponsoring",
    coordinatorRole: "Marketing / Vorstand",
    reasoning: "Sponsoranfrage",
    colorToken: "amber",
  },
  KONTAKTANFRAGE: {
    targetGroupKey: "KONTAKT",
    targetGroupLabel: "Allgemein",
    coordinatorRole: "Sekretariat",
    reasoning: "Kontaktanfrage",
    colorToken: "slate",
  },
  // Website-integration type overrides
  MITGLIEDSCHAFT: {
    targetGroupKey: "MITGLIED",
    targetGroupLabel: "Mitglied",
    coordinatorRole: "Sekretariat / Vorstand",
    reasoning: "Mitgliedschaftsanfrage",
    colorToken: "blue",
  },
  FREIWILLIGENMELDUNG: {
    targetGroupKey: "FREIWILLIG",
    targetGroupLabel: "Freiwillige/r",
    coordinatorRole: "Vorstand",
    reasoning: "Freiwilligenmeldung",
    colorToken: "green",
  },
  SCHIEDSRICHTERANMELDUNG: {
    targetGroupKey: "SCHIEDSRICHTER",
    targetGroupLabel: "Schiedsrichter",
    coordinatorRole: "Schiedsrichterkoordinator",
    reasoning: "Schiedsrichteranmeldung",
    colorToken: "amber",
  },
  CAMP_ANMELDUNG: {
    targetGroupKey: "CAMP",
    targetGroupLabel: "Camp",
    coordinatorRole: "Camp-Koordinator",
    reasoning: "Camp-Anmeldung",
    colorToken: "violet",
  },
  VERANSTALTUNGSANMELDUNG: {
    targetGroupKey: "VERANSTALTUNG",
    targetGroupLabel: "Veranstaltung",
    coordinatorRole: "Event-Koordinator",
    reasoning: "Veranstaltungsanmeldung",
    colorToken: "slate",
  },
};

export const DEFAULT_CLASSIFICATION_CONFIG: ClassificationConfig = {
  sport: "football",
  ageGroups: DEFAULT_AGE_GROUPS,
  typeOverrides: DEFAULT_TYPE_OVERRIDES,
};

// ── Main classification function ───────────────────────────────────────────────

export function classifyRegistration(
  birthYear: number | null | undefined,
  gender: GenderCode,
  registrationType: string,
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG,
): ClassificationResult {
  const baseYear = new Date().getFullYear();

  // 1. Check type overrides first
  if (config.typeOverrides?.[registrationType]) {
    return config.typeOverrides[registrationType];
  }

  if (!birthYear) {
    return {
      targetGroupKey: "UNKNOWN",
      targetGroupLabel: "Nicht zugeordnet",
      coordinatorRole: "Koordinator",
      reasoning: "Kein Jahrgang angegeben",
      colorToken: "slate",
    };
  }

  const genderLabel = getGenderLabel(gender, birthYear <= baseYear - 18);

  // 2. Walk age groups — gender-specific groups take priority when gender is known
  for (const group of config.ageGroups) {
    const minY = group.minBirthYear(baseYear);
    const maxY = group.maxBirthYear(baseYear);
    const inRange = birthYear >= minY && birthYear <= maxY;
    const genderMatch =
      !group.genders ||
      (gender !== null
        ? group.genders.includes(gender)
        : group.genders.includes(null));

    if (inRange && genderMatch) {
      const reasoning = [
        `Jahrgang ${birthYear}`,
        genderLabel ? `· ${genderLabel}` : null,
      ]
        .filter(Boolean)
        .join(" ");

      return {
        targetGroupKey: group.key,
        targetGroupLabel: group.label,
        coordinatorRole: group.coordinatorRole,
        reasoning,
        colorToken: group.colorToken,
      };
    }
  }

  // 3. Fallback: adult
  const age = baseYear - birthYear;
  if (age >= 18) {
    if (gender === "F") {
      return {
        targetGroupKey: "AKTIVE_FRAUEN",
        targetGroupLabel: "Frauen",
        coordinatorRole: "Frauenkoordinator",
        reasoning: `Jahrgang ${birthYear} · Erwachsene Frau`,
        colorToken: "pink",
      };
    }
    return {
      targetGroupKey: "AKTIVE_MAENNER",
      targetGroupLabel: "Aktive",
      coordinatorRole: "Sportchef",
      reasoning: `Jahrgang ${birthYear} · Erwachsener`,
      colorToken: "orange",
    };
  }

  return {
    targetGroupKey: "UNKNOWN",
    targetGroupLabel: "Nicht zugeordnet",
    coordinatorRole: "Koordinator",
    reasoning: `Jahrgang ${birthYear}`,
    colorToken: "slate",
  };
}

// ── Color helpers ─────────────────────────────────────────────────────────────

export const TARGET_GROUP_COLORS: Record<
  ColorToken,
  { bg: string; text: string; border: string; dot: string }
> = {
  green: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  violet: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    dot: "bg-violet-500",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-500",
  },
  pink: {
    bg: "bg-pink-50",
    text: "text-pink-700",
    border: "border-pink-200",
    dot: "bg-pink-500",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  slate: {
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
};
