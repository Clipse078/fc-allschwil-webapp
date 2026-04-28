export type PlayerSuggestionTone = "PERFECT" | "YOUNGER_ALLOWED" | "NOT_MATCHING" | "UNKNOWN";

export type PlayerSuggestion = {
  tone: PlayerSuggestionTone;
  label: string;
  sortRank: number;
  birthYear: number | null;
  targetBirthYears: number[];
};

export function getBirthYearFromDate(dateOfBirth: Date | string | null | undefined): number | null {
  if (!dateOfBirth) return null;

  const date = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return null;

  return date.getUTCFullYear();
}

export function buildPlayerSuggestion({
  dateOfBirth,
  targetBirthYears,
}: {
  dateOfBirth: Date | string | null | undefined;
  targetBirthYears: number[];
}): PlayerSuggestion {
  const birthYear = getBirthYearFromDate(dateOfBirth);
  const cleanTargetYears = [...new Set(targetBirthYears)]
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);

  if (cleanTargetYears.length === 0) {
    return {
      tone: "UNKNOWN",
      label: "Jahrgang offen",
      sortRank: 30,
      birthYear,
      targetBirthYears: cleanTargetYears,
    };
  }

  if (birthYear === null) {
    return {
      tone: "UNKNOWN",
      label: "Jahrgang fehlt",
      sortRank: 30,
      birthYear,
      targetBirthYears: cleanTargetYears,
    };
  }

  if (cleanTargetYears.includes(birthYear)) {
    return {
      tone: "PERFECT",
      label: "Perfekter Jahrgang",
      sortRank: 0,
      birthYear,
      targetBirthYears: cleanTargetYears,
    };
  }

  const youngestTargetYear = Math.max(...cleanTargetYears);

  if (birthYear > youngestTargetYear) {
    return {
      tone: "YOUNGER_ALLOWED",
      label: "Grenzbereich",
      sortRank: 10,
      birthYear,
      targetBirthYears: cleanTargetYears,
    };
  }

  return {
    tone: "NOT_MATCHING",
    label: "Nicht passend",
    sortRank: 20,
    birthYear,
    targetBirthYears: cleanTargetYears,
  };
}
