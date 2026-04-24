import {
  getCanonicalSwissFootballSeasonLabelFromSeasonStartDate,
  getSwissFootballSeasonStartYearFromDate,
} from "@/lib/seasons/season-logic";

export type JuniorCategoryCode =
  | "G"
  | "F"
  | "E"
  | "D7"
  | "D9"
  | "C"
  | "B"
  | "A";

const BASE_JAHRGANG_BY_CODE: Record<JuniorCategoryCode, number[]> = {
  G: [2019, 2020],
  F: [2017, 2018],
  E: [2015, 2016],
  D7: [2014],
  D9: [2013, 2014],
  C: [2011, 2012],
  B: [2009, 2010],
  A: [2007, 2008],
};

const BASE_SEASON_START_YEAR = 2025;

export function normalizeJuniorCategoryCode(
  value: string | null | undefined
): JuniorCategoryCode | null {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace("-", "");

  if (normalized === "D7" || normalized.startsWith("D7")) return "D7";
  if (normalized === "D9" || normalized.startsWith("D9")) return "D9";
  if (normalized === "G" || normalized.startsWith("G")) return "G";
  if (normalized === "F" || normalized.startsWith("F")) return "F";
  if (normalized === "E" || normalized.startsWith("E")) return "E";
  if (normalized === "C" || normalized.startsWith("C")) return "C";
  if (normalized === "B" || normalized.startsWith("B")) return "B";
  if (normalized === "A" || normalized.startsWith("A")) return "A";

  return null;
}

export function getSeasonStartYearFromInput(
  seasonInput: string | Date
): number | null {
  if (typeof seasonInput === "string") {
    const match = seasonInput.match(/(\d{4})\s*\/\s*\d{4}/);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return getSwissFootballSeasonStartYearFromDate(seasonInput);
}

export function getSeasonStartYearFromDate(
  dateInput: string | Date
): number | null {
  return getSeasonStartYearFromInput(dateInput);
}

export function getCanonicalSeasonLabel(
  seasonStartDate: string | Date
): string | null {
  return getCanonicalSwissFootballSeasonLabelFromSeasonStartDate(seasonStartDate);
}

export function getAllowedBirthYearsForSeason(
  categoryCode: string | null | undefined,
  seasonInput: string | Date
): number[] {
  const normalizedCode = normalizeJuniorCategoryCode(categoryCode);
  const seasonStartYear = getSeasonStartYearFromInput(seasonInput);

  if (!normalizedCode || seasonStartYear === null) {
    return [];
  }

  const shift = seasonStartYear - BASE_SEASON_START_YEAR;

  return BASE_JAHRGANG_BY_CODE[normalizedCode].map((year) => year + shift);
}

export function isBirthYearAllowedForTeamSeason(args: {
  categoryCode: string | null | undefined;
  seasonStartDate: string | Date;
  birthDate: string | Date | null | undefined;
}) {
  const allowedBirthYears = getAllowedBirthYearsForSeason(
    args.categoryCode,
    args.seasonStartDate
  );

  if (!args.birthDate) {
    return {
      ok: false,
      reason: "Kein Geburtsdatum vorhanden.",
      allowedBirthYears,
      birthYear: null as number | null,
    };
  }

  const birthDate = new Date(args.birthDate);

  if (Number.isNaN(birthDate.getTime())) {
    return {
      ok: false,
      reason: "Ungültiges Geburtsdatum.",
      allowedBirthYears,
      birthYear: null as number | null,
    };
  }

  const birthYear = birthDate.getUTCFullYear();

  if (!allowedBirthYears.includes(birthYear)) {
    return {
      ok: false,
      reason: "Geburtsjahr nicht für diese Team-Saison zugelassen.",
      allowedBirthYears,
      birthYear,
    };
  }

  return {
    ok: true,
    reason: null,
    allowedBirthYears,
    birthYear,
  };
}

